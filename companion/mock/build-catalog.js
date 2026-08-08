const fs = require('fs');
const path = require('path');
const { toLcuShape } = require('../test/realdata');
const { Bible } = require('../core/bible');
const { fragments } = require('../core/itemset');
const { norm } = require('../core/gamedata');

const TREES = [8000, 8400, 8200];
const CHAMPIONS = ['Aatrox', 'Ahri', 'Darius', 'Mordekaiser', 'Dr. Mundo', 'Wukong', "Kai'Sa",
  'Jax', 'Garen', 'Tryndamere', 'Veigar', 'Kayle', 'Zilean', 'Shen'];
const SPELLS = ['Flash', 'Ignite', 'Ghost', 'Teleport', 'Barrier', 'Smite'];

function main() {
  const shape = toLcuShape();
  const bible = new Bible(path.resolve(__dirname, '../..'));

  const styles = shape.styles.filter(s => TREES.includes(s.id));
  const keep = new Set(styles.flatMap(s => s.slots).flatMap(s => s.perks));
  const perks = shape.perks.filter(p => keep.has(p.id));

  const wanted = new Set();
  for (const m of bible.matchups) {
    for (const b of m.builds || []) {
      for (const s of b.steps || []) if (!s.aside) for (const f of fragments(s.item)) wanted.add(f);
      for (const ic of b.icons || []) if (ic.name) wanted.add(ic.name);
    }
  }
  const rift = shape.items.filter(i => i.maps?.['11'] !== false && i.inStore !== false && !i.requiredAlly);
  const items = [];
  const taken = new Set();
  for (const want of wanted) {
    const cleaned = want.replace(/\brush\b/ig, '').replace(/\(.*?\)/g, '').trim();
    for (const i of rift) {
      if (taken.has(i.id)) continue;
      const a = norm(i.name), b = norm(cleaned);
      if (a === b || a.includes(b) || b.includes(a)) { taken.add(i.id); items.push({ id: i.id, name: i.name }); break; }
    }
  }

  const spells = SPELLS.map(n => shape.spells.find(s => s.name === n && s.id < 100));
  const champions = CHAMPIONS.map(n => {
    const hits = shape.champs.filter(c => c.name === n);
    return hits.reduce((a, b) => (b.id < a.id ? b : a));
  });

  const out = {
    patch: shape.version,
    styles,
    perks: [...perks].sort((a, b) => a.id - b.id),
    items: items.sort((a, b) => a.id - b.id),
    spells: spells.map(s => ({ id: s.id, name: s.name })),
    champions: champions.map(c => ({ id: c.id, name: c.name, alias: c.alias })),
  };
  fs.writeFileSync(path.join(__dirname, 'catalog.json'), JSON.stringify(out, null, 1));
  console.log(`patch ${out.patch}: ${out.styles.length} trees, ${out.perks.length} perks, ` +
    `${out.items.length} items, ${out.spells.length} spells, ${out.champions.length} champions`);
  const missed = [...wanted].filter(w => !items.some(i => norm(i.name).includes(norm(w)) || norm(w).includes(norm(i.name))));
  if (missed.length) console.log('no catalog entry for: ' + missed.join(', '));
}

main();
