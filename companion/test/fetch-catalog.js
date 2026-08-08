const fs = require('fs');
const path = require('path');
const https = require('https');

const BASE = process.env.MB_DDRAGON_BASE
  || 'https://raw.githubusercontent.com/InFinity54/LoL_DDragon/master/latest/data/en_US';
const OUT = path.join(__dirname, 'realdata');

function fetch(url) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      if (res.statusCode === 301 || res.statusCode === 302) return resolve(fetch(res.headers.location));
      if (res.statusCode !== 200) return reject(new Error(`${res.statusCode} ${url}`));
      let body = '';
      res.setEncoding('utf8');
      res.on('data', c => { body += c; });
      res.on('end', () => { try { resolve(JSON.parse(body)); } catch (e) { reject(e); } });
    }).on('error', reject);
  });
}

const write = (name, value) => {
  fs.writeFileSync(path.join(OUT, name), JSON.stringify(value));
  const kb = (fs.statSync(path.join(OUT, name)).size / 1024).toFixed(0);
  console.log(`${name}  ${kb} KB`);
};

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const [runes, items, spells, champs] = await Promise.all([
    fetch(`${BASE}/runesReforged.json`),
    fetch(`${BASE}/item.json`),
    fetch(`${BASE}/summoner.json`),
    fetch(`${BASE}/champion.json`),
  ]);

  write('runesReforged.json', runes.map(style => ({
    id: style.id,
    key: style.key,
    name: style.name,
    slots: style.slots.map(slot => ({ runes: slot.runes.map(r => ({ id: r.id, key: r.key, name: r.name })) })),
  })));

  const itemData = {};
  for (const [id, it] of Object.entries(items.data)) {
    itemData[id] = { name: it.name, maps: it.maps, inStore: it.inStore, requiredAlly: it.requiredAlly, gold: { total: it.gold?.total ?? 0, purchasable: it.gold?.purchasable !== false } };
  }
  write('item.json', { version: items.version, data: itemData });

  const spellData = {};
  for (const [k, s] of Object.entries(spells.data)) spellData[k] = { id: s.id, key: s.key, name: s.name, modes: s.modes };
  write('summoner.json', { version: spells.version, data: spellData });

  const champData = {};
  for (const [k, c] of Object.entries(champs.data)) champData[k] = { id: c.id, key: c.key, name: c.name };
  write('champion.json', { version: champs.version, data: champData });

  console.log(`\npatch ${items.version} from ${BASE}`);
}

main().catch(err => { console.error(err.message); process.exit(1); });
