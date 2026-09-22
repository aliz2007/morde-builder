// Advisor stress harness: ~5.6k randomized + degenerate games across all matchups.
// Throws every matchup + randomized and degenerate game states at advise()
// and checks invariants on every run. Wired into npm test.
const fs = require('fs');
const path = require('path');
const { GameData } = require('../core/gamedata');
const { Bible } = require('../core/bible');
const { advise, resolveItem, CH } = require('../core/advisor');
const { fragments } = require('../core/itemset');

// --- app.js buildPool/coreFor replicated against the mock catalog ----------
const gd = new GameData();
gd.items = require('./realdata').toLcuShape().items.filter(i => i.name);
gd.shopItems = gd.items;
const bible = new Bible(path.resolve(__dirname, '../..'));
const catalogById = new Map();
for (const i of gd.items) catalogById.set(Number(i.id), i);

const COUNTERS = [
  'Hextech Rocketbelt', "Rylai's Crystal Scepter", 'Cosmic Drive',
  'Riftmaker', 'Dusk & Dawn', "Liandry's Torment", "Bloodletter's Curse",
  "Nashor's Tooth", 'Hextech Gunblade', "Rabadon's Deathcap", 'Shadowflame',
  'Void Staff', 'Experimental Hexplate',
  "Zhonya's Hourglass", "Banshee's Veil", 'Kaenic Rookern', "Sterak's Gage", "Death's Dance",
  "Randuin's Omen", 'Frozen Heart', 'Thornmail', 'Spirit Visage', 'Force of Nature',
  'Abyssal Mask', "Jak'Sho, The Protean", 'Unending Despair', "Dead Man's Plate",
  "Warmog's Armor", "Guardian's Angel", 'Oblivion Orb', 'Morellonomicon', "Serpent's Fang",
  'Dark Seal', "Mejai's Soulstealer",
  'Plated Steelcaps', "Mercury's Treads", 'Boots of Swiftness', 'Gluttonous Greaves',
];
const ids = new Set();
for (const m of bible.matchups) {
  for (const b of m.builds || []) {
    for (const s of b.steps || []) {
      if (s.aside) continue;
      for (const f of fragments(s.item)) {
        const hit = gd.itemByName(f);
        if (hit) ids.add(Number(hit.id));
      }
    }
  }
}
for (const name of COUNTERS) {
  const hit = gd.itemByName(name);
  if (hit) ids.add(Number(hit.id));
}
const pool = { candidates: [...ids].map(id => catalogById.get(id)).filter(Boolean).map(resolveItem) };
console.log(`pool: ${pool.candidates.length} candidates from ${bible.matchups.length} matchups`);

function coreFor(matchup) {
  const build = (matchup?.builds || [])[0];
  if (!build) return [];
  const out = [];
  for (const s of (build.steps || []).filter(s => !s.aside).slice(0, 3)) {
    for (const f of fragments(s.item)) {
      const hit = gd.itemByName(f);
      if (hit) out.push({ id: Number(hit.id), name: hit.name });
    }
  }
  return [...new Map(out.map(o => [o.id, o])).values()];
}

// --- sampling universes -----------------------------------------------------
const champs = [...new Set([
  ...Object.values(CH).flatMap(s => [...s]),
  ...bible.matchups.map(m => m.name),
  'Teemo', 'Serious Sam', "Kai'Sa", 'BelVeth Typo',
])];
const enemyItems = gd.items
  .map(i => catalogById.get(Number(i.id)))
  .filter(Boolean)
  .map(resolveItem)
  .filter(t => t.hp || t.ad || t.ap || t.armor || t.mr || t.crit || t.as || (t.flags || []).length);

// --- seeded RNG -------------------------------------------------------------
let seed = 20260922;
const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
const ri = n => Math.floor(rnd() * n);
const pickN = (arr, n) => {
  const c = [...arr];
  const out = [];
  while (out.length < n && c.length) out.push(c.splice(ri(c.length), 1)[0]);
  return out;
};
const POSITIONS = ['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'UTILITY', '', undefined];

// --- invariant checker ------------------------------------------------------
let runs = 0, failures = 0;
const freq = new Map();
function check(label, input, out) {
  runs++;
  const fail = msg => { failures++; console.log(`FAIL [${label}] ${msg}`); if (failures > 15) process.exit(1); };
  if (!out || typeof out !== 'object') return fail('no output object');
  const myIds = new Set(input.me.items.map(i => Number(i.id)));
  if (!Array.isArray(out.recommendations) || out.recommendations.length > 3) return fail('recs not 0..3');
  const seen = new Set();
  for (const r of out.recommendations) {
    if (!r.name || r.name.startsWith('#')) return fail(`bad rec name ${r.name}`);
    if (!Number.isFinite(r.score)) return fail(`non-finite score for ${r.name}`);
    if (!Array.isArray(r.reasons) || !r.reasons.length) return fail(`${r.name} has no reasons`);
    if (r.reasons.some(x => !x || /undefined|NaN/.test(x))) return fail(`${r.name} has broken reason text: ${r.reasons}`);
    if (myIds.has(r.id)) return fail(`recommends owned item ${r.name}`);
    if (seen.has(r.id)) return fail(`duplicate rec ${r.name}`);
    seen.add(r.id);
    freq.set(r.name, (freq.get(r.name) || 0) + 1);
  }
  if (out.goldDiff !== null && !Number.isFinite(out.goldDiff)) return fail(`goldDiff=${out.goldDiff}`);
  if (out.goldDiff !== null && typeof out.goldVs !== 'string') return fail('goldDiff without goldVs');
  if (input.enemies.length === 0 && out.goldDiff !== null) return fail('goldDiff with no enemies');
  if (out.boots !== null && (!out.boots || !out.boots.name || !out.boots.why)) return fail('broken boots');
  if (out.coreDone === false) {
    if (out.recommendations.length) return fail('recs despite unfinished core');
    if (!out.missingCore.length) return fail('coreDone false but nothing missing');
  }
  const again = advise(JSON.parse(JSON.stringify(input)));
  if (JSON.stringify(again) !== JSON.stringify(out)) return fail('non-deterministic output');
}

function randomPlayer(pos) {
  const fed = rnd() < 0.22;
  const inting = !fed && rnd() < 0.15;
  const nItems = ri(7);
  return {
    championName: champs[ri(champs.length)],
    position: pos !== undefined ? pos : POSITIONS[ri(POSITIONS.length)],
    level: 1 + ri(18),
    kills: fed ? 8 + ri(8) : inting ? 0 : ri(8),
    deaths: inting ? 6 + ri(8) : fed ? ri(2) : ri(6),
    assists: ri(14),
    cs: ri(350),
    items: pickN(enemyItems, nItems),
  };
}

// --- scenario A: every matchup x 40 random games ----------------------------
for (const m of bible.matchups) {
  const core = coreFor(m);
  for (let g = 0; g < 40; g++) {
    const enemies = Array.from({ length: 5 }, () => randomPlayer());
    if (rnd() < 0.5) enemies[0].championName = m.name;
    const me = { ...randomPlayer('TOP'), items: pickN(pool.candidates, ri(7)) };
    if (rnd() < 0.7) me.currentGold = ri(6000);
    const allies = Array.from({ length: ri(5) }, () => randomPlayer());
    const input = { me, enemies, allies, core, pool, gameMinutes: 1 + ri(60) };
    check(`matchup ${m.name}#${g}`, input, advise(input));
  }
}

// --- scenario B: degenerate inputs ------------------------------------------
const deg = (label, input) => check(`degenerate ${label}`, input, advise(input));
const someCore = coreFor(bible.matchups[0]);
deg('no enemies', { me: { items: [], kills: 0, deaths: 0, assists: 0, position: 'TOP' }, enemies: [], allies: [], core: someCore, pool });
deg('empty everything', { me: { items: [], kills: 0, deaths: 0, assists: 0 }, enemies: [], allies: [], core: [], pool });
deg('enemy no items', { me: { items: [], kills: 0, deaths: 0, assists: 0, position: 'TOP' }, enemies: [randomPlayer('TOP')].map(p => ({ ...p, items: [] })), allies: [], core: someCore, pool });
deg('empty pool', { me: { items: [], kills: 0, deaths: 0, assists: 0, position: 'TOP' }, enemies: [randomPlayer('TOP')], allies: [], core: someCore, pool: { candidates: [] } });
deg('me owns entire pool', { me: { items: pool.candidates, kills: 5, deaths: 1, assists: 3, position: 'TOP', currentGold: 9999 }, enemies: Array.from({ length: 5 }, () => randomPlayer()), allies: [], core: someCore, pool });
deg('me 0/20/0', { me: { items: [], kills: 0, deaths: 20, assists: 0, position: 'TOP', currentGold: 0 }, enemies: Array.from({ length: 5 }, () => randomPlayer()), allies: [], core: someCore, pool });
deg('me 20/0/20', { me: { items: pickN(pool.candidates, 5), kills: 20, deaths: 0, assists: 20, position: 'TOP', currentGold: 5000 }, enemies: Array.from({ length: 5 }, () => randomPlayer()), allies: [], core: someCore, pool });
deg('all fed enemies', { me: { items: pickN(pool.candidates, 3), kills: 1, deaths: 1, assists: 1, position: 'TOP' }, enemies: Array.from({ length: 5 }, () => ({ ...randomPlayer(), kills: 15, deaths: 0 })), allies: [], core: someCore, pool });
deg('positions undefined', { me: { items: pickN(pool.candidates, 2), kills: 2, deaths: 1, assists: 1 }, enemies: Array.from({ length: 5 }, () => { const p = randomPlayer(); delete p.position; return p; }), allies: [], core: someCore, pool });
deg('minute 1', { me: { items: [], kills: 0, deaths: 0, assists: 0, position: 'TOP', currentGold: 500 }, enemies: [randomPlayer('TOP')].map(p => ({ ...p, items: [] })), allies: [], core: someCore, pool, gameMinutes: 1 });
deg('minute 90', { me: { items: pickN(pool.candidates, 6), kills: 4, deaths: 4, assists: 4, position: 'TOP' }, enemies: Array.from({ length: 5 }, () => randomPlayer()), allies: [], core: someCore, pool, gameMinutes: 90 });
deg('unknown items on enemy', {
  me: { items: pickN(pool.candidates, 3), kills: 2, deaths: 1, assists: 1, position: 'TOP' },
  enemies: [{ championName: 'Vayne', position: 'TOP', kills: 3, deaths: 1, assists: 1, items: [resolveItem({ id: 999001, name: 'Some New Item', priceTotal: 3200, description: 'Grants 60 Attack Damage and 20% Critical Strike chance.' })] }],
  allies: [], core: someCore, pool,
});
deg('NaN gold', { me: { items: [], kills: 0, deaths: 0, assists: 0, position: 'TOP', currentGold: NaN }, enemies: [randomPlayer('TOP')], allies: [], core: someCore, pool });

// --- report ------------------------------------------------------------------
console.log(`\n${runs} runs, ${failures} failures`);
const top = [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);
console.log('most recommended:', top.map(([n, c]) => `${n}(${c})`).join(', '));
process.exit(failures ? 1 : 0);
