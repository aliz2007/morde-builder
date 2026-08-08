const path = require('path');
const { GameData, norm, score } = require('../core/gamedata');
const { Bible } = require('../core/bible');
const { buildItemSet, fragments } = require('../core/itemset');
const { toLcuShape, ReplayLcu } = require('./realdata');

const REPO = path.join(__dirname, '..', '..');
const findings = [];
const note = (severity, area, detail) => findings.push({ severity, area, detail });

function bar(title) {
  console.log('\n' + title);
  console.log('-'.repeat(title.length));
}

async function main() {
  const shape = toLcuShape();
  const gd = await new GameData().load(new ReplayLcu(shape));
  const bible = new Bible(REPO);

  console.log(`Data Dragon patch ${shape.version}`);
  console.log(`${gd.items.length} items, ${gd.spells.length} spells, ${gd.champs.length} champions, ` +
    `${gd.perks.size} perks, ${gd.styles.length} trees`);
  console.log(`${bible.matchups.length} matchups in the Bible`);

  auditCatalog(shape, gd);
  auditChampions(gd, bible);
  auditRunes(gd, bible);
  auditSummoners(gd, bible);
  auditItems(gd, bible);
  auditItemSets(gd, bible);

  bar('FINDINGS');
  if (!findings.length) {
    console.log('none');
  } else {
    const order = { bug: 0, risk: 1, data: 2, info: 3 };
    findings.sort((a, b) => order[a.severity] - order[b.severity]);
    for (const f of findings) console.log(`[${f.severity.toUpperCase()}] ${f.area}: ${f.detail}`);
  }
  const bugs = findings.filter(f => f.severity === 'bug').length;
  console.log(`\n${bugs} bug(s), ${findings.length - bugs} other finding(s)`);
  process.exitCode = bugs ? 1 : 0;
}

function auditCatalog(shape, gd) {
  bar('Catalog shape');
  const byName = new Map();
  for (const it of gd.items) {
    const k = norm(it.name);
    if (!byName.has(k)) byName.set(k, []);
    byName.get(k).push(it);
  }
  const dupes = [...byName.entries()].filter(([, v]) => v.length > 1);
  console.log(`${dupes.length} item names are shared by more than one id`);
  const worst = dupes.sort((a, b) => b[1].length - a[1].length).slice(0, 6);
  for (const [, v] of worst) console.log(`  ${v[0].name} x${v.length} -> ${v.map(i => i.id).join(', ')}`);

  const spellDupes = [...new Set(gd.spells.map(s => norm(s.name)))].length !== gd.spells.length;
  console.log(`summoner spell names unique: ${!spellDupes}`);
}

function auditChampions(gd, bible) {
  bar('Champions');
  const bad = [];
  for (const m of bible.matchups) {
    const hit = gd.champByName(m.name);
    if (!hit) bad.push(`${m.name} -> no champion`);
    else if (norm(hit.name) !== norm(m.name)) bad.push(`${m.name} -> ${hit.name}`);
  }
  console.log(`${bible.matchups.length - bad.length}/${bible.matchups.length} matchup names map to the right champion`);
  for (const b of bad) console.log('  ' + b);
  if (bad.length) note('bug', 'champByName', bad.join('; '));

  const wrong = [];
  for (const c of gd.champs) {
    const m = bible.find(c.name);
    if (m && norm(m.name) !== norm(c.name)) wrong.push(`client "${c.name}" -> matchup "${m.name}"`);
  }
  if (wrong.length) note('bug', 'Bible.find', wrong.join('; '));

  const roster = [...new Map(gd.champs.map(c => [norm(c.name), c])).values()];
  const uncovered = [...new Set(gd.champs.filter(c => !bible.find(c.name)).map(c => c.name))];
  console.log(`${roster.length - uncovered.length}/${roster.length} distinct champions have a writeup`);
  if (uncovered.length) note('info', 'coverage', `${uncovered.length} champions with no writeup: ${uncovered.slice(0, 20).join(', ')}${uncovered.length > 20 ? ', …' : ''}`);

  const byId = new Map();
  for (const c of gd.champs) {
    if (byId.has(c.id)) note('bug', 'champById', `duplicate id ${c.id}`);
    byId.set(c.id, c);
  }
  const sample = gd.champs.find(c => c.alias === 'MonkeyKing');
  if (sample && gd.champById(sample.id)?.name !== sample.name) note('bug', 'champById', 'id lookup mismatch');

  const shadowed = [];
  for (const c of gd.champs) {
    const back = gd.champByName(c.name);
    if (back && back.id !== c.id && back.id > c.id) shadowed.push(`${c.name}: name resolves to id ${back.id}, not ${c.id}`);
  }
  if (shadowed.length) note('bug', 'champByName', `game-mode variants shadow the real champion — ${shadowed.slice(0, 3).join('; ')}`);
  console.log(`${gd.champs.length - roster.length} game-mode champion duplicates in the catalog; name lookups ${shadowed.length ? 'DO' : 'do not'} pick them`);
}

function auditRunes(gd, bible) {
  bar('Runes');
  const treeNames = new Set();
  for (const style of gd.styles) {
    const { key, regular, stat } = gd.slotKinds(style);
    treeNames.add(style.name);
    if (key.length !== 1) note('bug', 'slotKinds', `${style.name} has ${key.length} keystone rows`);
    if (regular.length !== 3) note('bug', 'slotKinds', `${style.name} has ${regular.length} minor rows`);
    if (stat.length !== 3) note('bug', 'slotKinds', `${style.name} has ${stat.length} stat rows`);
  }
  console.log(`trees: ${[...treeNames].join(', ')}`);

  let ok = 0;
  const failures = [];
  const suspicious = [];
  const fuzzy = new Map();
  for (const m of bible.matchups) {
    const page = gd.resolveRunePage(m.runes || {});
    if (page.misses.length) { failures.push(`${m.name}: ${page.misses.join(' | ')}`); continue; }
    ok += 1;

    const ids = page.selectedPerkIds;
    const names = ids.map(id => gd.perkName(id));
    if (ids.length !== 9) suspicious.push(`${m.name}: ${ids.length} perks, expected 9`);
    const tree = ids.slice(0, 6);
    if (new Set(tree).size !== tree.length) {
      const dup = tree.map(id => gd.perkName(id)).filter((n, i, a) => a.indexOf(n) !== i);
      suspicious.push(`${m.name}: duplicate tree perk ${[...new Set(dup)].join(', ')}`);
    }
    if (page.primaryStyleId === page.subStyleId) suspicious.push(`${m.name}: primary and secondary tree are the same`);

    const primaryStyle = gd.styles.find(s => s.id === page.primaryStyleId);
    const subStyle = gd.styles.find(s => s.id === page.subStyleId);
    const inPrimary = new Set(gd.slotKinds(primaryStyle).key.concat(gd.slotKinds(primaryStyle).regular).flatMap(s => s.perks));
    const inSub = new Set(gd.slotKinds(subStyle).regular.flatMap(s => s.perks));
    for (const [i, id] of tree.entries()) {
      const where = i < 4 ? inPrimary : inSub;
      if (!where.has(id)) suspicious.push(`${m.name}: ${gd.perkName(id)} is not in ${(i < 4 ? primaryStyle : subStyle).name}`);
    }

    const rowOf = (style, id) => gd.slotKinds(style).regular.findIndex(r => r.perks.includes(id));
    const minorRows = ids.slice(1, 4).map(id => rowOf(primaryStyle, id));
    if (new Set(minorRows).size !== 3) suspicious.push(`${m.name}: primary minors share a row (${minorRows.join(',')})`);
    const subRows = ids.slice(4, 6).map(id => rowOf(subStyle, id));
    if (new Set(subRows).size !== 2) suspicious.push(`${m.name}: secondary runes share row ${subRows[0] + 1} — the client rejects this`);
    if (minorRows.some(r => r !== 0 && r !== 1 && r !== 2)) suspicious.push(`${m.name}: a primary minor is outside rows 1-3`);
    const statRows = gd.slotKinds(primaryStyle).stat;
    for (const [i, id] of ids.slice(6, 9).entries()) {
      if (statRows[i] && !statRows[i].perks.includes(id)) suspicious.push(`${m.name}: shard ${gd.perkName(id)} is not in stat row ${i + 1}`);
    }

    const alt = s => String(s).split(/\s+or\s+/i)[0].trim();
    const declared = [
      ...(m.runes.primary || []).slice(0, 4),
      ...(m.runes.secondary || []).slice(0, 2),
      ...(m.runes.shards || []).flatMap(s => {
        const d = /^double\s+(.+)$/i.exec(String(s).trim());
        return d ? [d[1], d[1]] : [s];
      }).slice(0, 3),
    ].map(alt);
    for (const [i, want] of declared.entries()) {
      const got = names[i];
      if (!got) continue;
      if (score(want, got) < 50) suspicious.push(`${m.name}: "${want}" resolved to "${got}"`);
      if (norm(want) !== norm(got)) {
        const k = `${want} => ${got}`;
        fuzzy.set(k, (fuzzy.get(k) || 0) + 1);
      }
    }
  }

  console.log(`${ok}/${bible.matchups.length} matchups produce a complete rune page`);
  if (fuzzy.size) {
    console.log('every rune name that did not match exactly — read this list, a wrong rune is silent:');
    for (const [k, n] of [...fuzzy].sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(4)}x ${k}`);
  }
  for (const f of failures.slice(0, 40)) console.log('  MISS ' + f);
  if (failures.length > 40) console.log(`  … ${failures.length - 40} more`);
  for (const s of suspicious.slice(0, 40)) console.log('  ODD  ' + s);

  if (failures.length) note('bug', 'resolveRunePage', `${failures.length}/${bible.matchups.length} matchups cannot build a rune page — first: ${failures[0]}`);
  if (suspicious.length) note('bug', 'resolveRunePage', `${suspicious.length} pages resolve to the wrong perks — first: ${suspicious[0]}`);
}

function auditSummoners(gd, bible) {
  bar('Summoner spells');
  const bad = [];
  const seen = new Set();
  for (const m of bible.matchups) {
    for (const s of m.summoners || []) {
      if (!s.name || seen.has(s.name)) continue;
      seen.add(s.name);
      const hit = gd.spellByName(s.name);
      if (!hit) bad.push(`${s.name} -> nothing`);
      else if (norm(hit.name) !== norm(s.name)) bad.push(`${s.name} -> ${hit.name}`);
    }
  }
  console.log(`${seen.size} distinct spell names used, ${seen.size - bad.length} resolve exactly`);
  for (const b of bad) console.log('  ' + b);
  if (bad.length) note('bug', 'spellByName', bad.join('; '));

  const shortNames = gd.spells.filter(s => s.name.length <= 5).map(s => s.name);
  if (shortNames.length) note('info', 'spellByName', `short spell names in the catalog that fuzzy matching can collide with: ${shortNames.join(', ')}`);
}

function auditItems(gd, bible) {
  bar('Items');
  const uses = new Map();
  for (const m of bible.matchups) {
    for (const b of m.builds || []) {
      for (const s of b.steps || []) {
        if (s.aside) continue;
        for (const f of fragments(s.item)) {
          if (!uses.has(f)) uses.set(f, []);
          uses.get(f).push(m.name);
        }
      }
      for (const ic of b.icons || []) {
        if (!ic.name) continue;
        if (!uses.has(ic.name)) uses.set(ic.name, []);
        uses.get(ic.name).push(m.name);
      }
    }
  }

  const missing = [];
  const renamed = [];
  const offMap = [];
  for (const [frag, where] of uses) {
    const cleaned = String(frag).replace(/\brush\b/ig, '').replace(/\(.*?\)/g, '').trim();
    const hit = gd.itemByName(frag);
    if (!hit) { missing.push([frag, where.length]); continue; }
    if (norm(hit.name) !== norm(cleaned)) renamed.push([frag, hit.name, where.length]);
    const full = gd.items.find(i => i.id === hit.id);
    if (full && full.maps && full.maps['11'] === false) offMap.push(`${frag} -> ${hit.name} (not on Summoner's Rift)`);
    if (full && full.requiredAlly) offMap.push(`${frag} -> ${hit.name} (requires ${full.requiredAlly} on the team)`);
  }

  console.log(`${uses.size} distinct item strings, ${uses.size - missing.length} resolve`);
  missing.sort((a, b) => b[1] - a[1]);
  for (const [f, n] of missing.slice(0, 40)) console.log(`  MISS ${f}  (${n} builds)`);
  if (missing.length > 40) console.log(`  … ${missing.length - 40} more`);
  renamed.sort((a, b) => b[2] - a[2]);
  for (const [f, to, n] of renamed.slice(0, 40)) console.log(`  FUZZ ${f} -> ${to}  (${n} builds)`);
  for (const o of offMap.slice(0, 20)) console.log('  MAP  ' + o);

  if (missing.length) note('data', 'itemByName', `${missing.length} item strings resolve to nothing, hitting ${missing.reduce((a, b) => a + b[1], 0)} build rows — worst: ${missing.slice(0, 5).map(m => m[0]).join(', ')}`);
  if (renamed.length) note('risk', 'itemByName', `${renamed.length} strings resolve to a differently-named item — e.g. ${renamed.slice(0, 5).map(r => `"${r[0]}"->"${r[1]}"`).join(', ')}`);
  if (offMap.length) note('bug', 'itemByName', `resolves to items that cannot be bought in a normal game: ${[...new Set(offMap)].slice(0, 5).join('; ')}`);
}

function auditItemSets(gd, bible) {
  bar('Item sets');
  const morde = gd.champByName('Mordekaiser');
  if (!morde) note('bug', 'buildItemSet', 'Mordekaiser not found in the champion catalog');
  let empty = 0, longest = 0, blocks = 0;
  const badIds = [];
  for (const m of bible.matchups) {
    const { set } = buildItemSet(gd, m, morde?.id);
    if (!set.blocks.length) { empty += 1; console.log(`  EMPTY ${m.name}`); continue; }
    blocks += set.blocks.length;
    for (const b of set.blocks) {
      longest = Math.max(longest, b.type.length);
      for (const it of b.items) {
        if (typeof it.id !== 'string' || !/^\d+$/.test(it.id)) badIds.push(`${m.name}: ${it.id}`);
        if (!gd.items.some(x => String(x.id) === it.id)) badIds.push(`${m.name}: unknown id ${it.id}`);
      }
    }
    if (set.associatedChampions.some(id => typeof id !== 'number')) note('bug', 'buildItemSet', `${m.name}: associatedChampions is not numeric`);
  }
  console.log(`${bible.matchups.length - empty}/${bible.matchups.length} matchups yield a non-empty item set, ${blocks} blocks total, longest label ${longest} chars`);
  if (empty) note('bug', 'buildItemSet', `${empty} matchups produce an item set with no blocks — pushItemSet throws for these`);
  if (badIds.length) note('bug', 'buildItemSet', badIds.slice(0, 5).join('; '));
  if (longest > 75) note('risk', 'buildItemSet', `block labels reach ${longest} chars and are truncated at 80`);
}

main().catch(err => { console.error(err); process.exit(1); });
