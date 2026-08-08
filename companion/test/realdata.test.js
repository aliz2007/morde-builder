const { test, before } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { GameData, distance, score, norm } = require('../core/gamedata');
const { Bible } = require('../core/bible');
const { buildItemSet, fragments } = require('../core/itemset');
const { toLcuShape, ReplayLcu } = require('./realdata');

let gd, bible, shape;

before(async () => {
  shape = toLcuShape();
  gd = await new GameData().load(new ReplayLcu(shape));
  bible = new Bible(path.resolve(__dirname, '../..'));
});

test('the real catalog is loaded, not a stub', () => {
  assert.ok(gd.items.length > 500, `${gd.items.length} items`);
  assert.equal(gd.styles.length, 5);
  assert.ok(gd.champs.length > 160);
  assert.ok(gd.spells.length > 20);
});

test('duplicate item names across game modes do not defeat lookup', () => {
  const dupes = new Map();
  for (const i of gd.items) dupes.set(norm(i.name), (dupes.get(norm(i.name)) || 0) + 1);
  assert.ok([...dupes.values()].filter(n => n > 1).length > 100, 'fixture should contain the mode variants');

  for (const [query, want] of [
    ['Rocketbelt', 'Hextech Rocketbelt'],
    ["Liandry's", "Liandry's Torment"],
    ["Rylai's", "Rylai's Crystal Scepter"],
    ["Zhonya's", "Zhonya's Hourglass"],
    ['Riftmaker', 'Riftmaker'],
  ]) {
    const hit = gd.itemByName(query);
    assert.ok(hit, `${query} resolved to nothing`);
    assert.equal(hit.name, want);
    assert.ok(hit.id < 100000, `${query} picked mode variant ${hit.id}`);
  }
});

test('lookups prefer the Summoner\'s Rift version of an item', () => {
  const curse = gd.itemByName("Bloodletter's Curse");
  assert.equal(curse.name, "Bloodletter's Curse");
  assert.notEqual(curse.id, 4010, 'picked the Arena copy');
  assert.equal(shape.items.find(i => i.id === curse.id).maps['11'], true);
});

test('summoner spells resolve to the Summoner\'s Rift ids', () => {
  assert.equal(gd.spellByName('Flash').id, 4, 'Arena or Jade Flash would be rejected in champ select');
  assert.equal(gd.spellByName('Ignite').id, 14);
  assert.equal(gd.spellByName('Teleport').id, 12);
  assert.equal(gd.spellByName('Ghost').id, 6);
});

test('the author\'s typos and shorthand still resolve', () => {
  assert.equal(gd.itemByName('Mercury Treads').name, "Mercury's Treads");
  assert.equal(gd.itemByName("Mecury's Treads").name, "Mercury's Treads");
  assert.equal(gd.itemByName("Spirit's Visage").name, 'Spirit Visage');
  assert.equal(gd.itemByName('Dusk & Dawn').name, 'Dusk and Dawn');
  assert.equal(gd.itemByName("Doran's Helm start").name, "Doran's Helm");
});

test('a one-letter rune typo does not sink the whole page', () => {
  const page = gd.resolveRunePage({
    primary: ['Grasp of the Undying', 'Demolish', 'Second Wind', 'Overgrowth'],
    secondary: ['Transcendence', 'Scorch'],
    shards: ['Adapative Force', 'Movement Speed', 'Flat Health'],
  });
  assert.deepEqual(page.misses, []);
  assert.equal(page.selectedPerkIds.length, 9);
});

test('game-mode champion clones never shadow the real champion', () => {
  const clones = gd.champs.filter(c => c.id > 50000);
  assert.ok(clones.length > 0, 'fixture should contain the mode clones');
  for (const c of clones) {
    const back = gd.champByName(c.name);
    assert.ok(back.id < c.id, `${c.name} resolves to clone id ${back.id}`);
  }
  assert.equal(gd.champByName('Mordekaiser').id, 82);
});

test('every matchup builds a rune page the client would accept', () => {
  const bad = [];
  for (const m of bible.matchups) {
    const page = gd.resolveRunePage(m.runes || {});
    if (page.misses.length) { bad.push(`${m.name}: ${page.misses.join('; ')}`); continue; }

    const ids = page.selectedPerkIds;
    if (ids.length !== 9) { bad.push(`${m.name}: ${ids.length} perks`); continue; }
    if (page.primaryStyleId === page.subStyleId) bad.push(`${m.name}: one tree used twice`);

    const primary = gd.styles.find(s => s.id === page.primaryStyleId);
    const sub = gd.styles.find(s => s.id === page.subStyleId);
    const keyIds = gd.slotKinds(primary).key.flatMap(s => s.perks);
    if (!keyIds.includes(ids[0])) bad.push(`${m.name}: keystone outside the primary tree`);

    const rowOf = (style, id) => gd.slotKinds(style).regular.findIndex(r => r.perks.includes(id));
    const minorRows = ids.slice(1, 4).map(id => rowOf(primary, id));
    if (minorRows.some(r => r < 0) || new Set(minorRows).size !== 3) bad.push(`${m.name}: primary minors ${minorRows.join(',')}`);
    const subRows = ids.slice(4, 6).map(id => rowOf(sub, id));
    if (subRows.some(r => r < 0) || new Set(subRows).size !== 2) bad.push(`${m.name}: secondary rows ${subRows.join(',')}`);

    const statRows = gd.slotKinds(primary).stat;
    ids.slice(6, 9).forEach((id, i) => {
      if (!statRows[i].perks.includes(id)) bad.push(`${m.name}: shard ${i + 1} outside its row`);
    });
  }
  assert.deepEqual(bad, [], `${bad.length}/${bible.matchups.length} matchups produce an invalid page`);
});

test('a third secondary rune is dropped and "A OR B" takes the first option', () => {
  const page = gd.resolveRunePage({
    primary: ['Grasp of the Undying', 'Demolish', 'Second Wind', 'Overgrowth'],
    secondary: ['Transcendence', 'Scorch OR Gathering Storm', 'Manaflow Band'],
    shards: ['Adaptive Force', 'Movement Speed', 'Flat Health'],
  });
  assert.deepEqual(page.misses, []);
  assert.equal(page.selectedPerkIds.length, 9);
  assert.equal(gd.perkName(page.selectedPerkIds[5]), 'Scorch');
});

test('two secondary runes from the same row are refused, not silently pushed', () => {
  const page = gd.resolveRunePage({
    primary: ['Grasp of the Undying', 'Demolish', 'Second Wind', 'Overgrowth'],
    secondary: ['Nimbus Cloak', 'Manaflow Band'],
    shards: ['Adaptive Force', 'Movement Speed', 'Flat Health'],
  });
  assert.ok(page.misses.length, 'both runes sit in Sorcery row 1');
});

test('every matchup yields an item set of ids that exist in the catalog', () => {
  const known = new Set(gd.items.map(i => String(i.id)));
  const morde = gd.champByName('Mordekaiser');
  const empty = [];
  const unknown = [];
  for (const m of bible.matchups) {
    const { set } = buildItemSet(gd, m, morde.id);
    if (!set.blocks.length) empty.push(m.name);
    for (const b of set.blocks) {
      assert.ok(b.type.length <= 80, `${m.name}: block label ${b.type.length} chars`);
      for (const it of b.items) if (!known.has(it.id)) unknown.push(`${m.name}: ${it.id}`);
    }
  }
  assert.deepEqual(empty, [], 'pushItemSet throws when a matchup yields no blocks');
  assert.deepEqual(unknown, []);
});

test('build steps drop prose but keep real items', () => {
  assert.deepEqual(fragments('Bramble Vest Rush -> Boots'), ['Bramble Vest Rush', 'Boots']);
  assert.deepEqual(fragments("Bloodletter's Curse / Liandry's / Flex Items"), ["Bloodletter's Curse", "Liandry's"]);
  assert.deepEqual(fragments('I\'m testing something out in this specific matchup'), []);
  assert.deepEqual(fragments('Flex items ( suited towards the enemy team composition )'), []);
  assert.deepEqual(fragments('Riftmaker (For Ramping Damage)'), ['Riftmaker']);
});

test('edit distance is Damerau, not plain Levenshtein', () => {
  assert.equal(distance('abc', 'abc'), 0);
  assert.equal(distance('ca', 'ac'), 1);
  assert.equal(distance('', 'abc'), 3);
  assert.equal(distance('adapative', 'adaptive'), 1);
  assert.ok(score('Adapative Force', 'Adaptive Force') >= 40);
  assert.ok(score('Adaptive Force', 'Attack Speed') < 40);
});
