const fs = require('fs');
const path = require('path');
const stat = require('../mock/stat-shards');

const DIR = path.join(__dirname, 'realdata');

function read(name) {
  return JSON.parse(fs.readFileSync(path.join(DIR, name), 'utf8'));
}

function toLcuShape() {
  const reforged = read('runesReforged.json');
  const items = read('item.json');
  const spells = read('summoner.json');
  const champs = read('champion.json');

  const perks = [];
  const styles = reforged.map(style => {
    const slots = (style.slots || []).map((slot, i) => {
      for (const rune of slot.runes || []) perks.push({ id: rune.id, name: rune.name });
      return {
        type: i === 0 ? 'kKeyStone' : 'kMixedRegularSplashable',
        perks: (slot.runes || []).map(r => r.id),
      };
    });
    return {
      id: style.id,
      name: style.name,
      slots: [...slots, ...stat.slots.map(s => ({ type: s.type, perks: [...s.perks] }))],
    };
  });
  perks.push(...stat.perks);

  return {
    version: items.version,
    styles,
    perks,
    items: Object.entries(items.data).map(([id, it]) => ({
      id: Number(id),
      name: it.name,
      inStore: it.inStore !== false,
      requiredAlly: it.requiredAlly || null,
      maps: it.maps || {},
      price: it.gold?.total ?? 0,
      purchasable: it.gold?.purchasable !== false,
    })),
    spells: Object.values(spells.data).map(s => ({ id: Number(s.key), name: s.name, alias: s.id })),
    champs: Object.values(champs.data).map(c => ({ id: Number(c.key), name: c.name, alias: c.id })),
  };
}

class ReplayLcu {
  constructor(shape) {
    this.shape = shape;
    this.calls = [];
  }

  async get(p) {
    this.calls.push(['GET', p]);
    switch (p) {
      case '/lol-game-data/assets/v1/perkstyles.json': return { styles: this.shape.styles };
      case '/lol-game-data/assets/v1/perks.json': return this.shape.perks;
      case '/lol-game-data/assets/v1/items.json': return this.shape.items;
      case '/lol-game-data/assets/v1/summoner-spells.json': return this.shape.spells;
      case '/lol-game-data/assets/v1/champion-summary.json': return this.shape.champs;
      default: throw Object.assign(new Error(`unmapped ${p}`), { status: 404 });
    }
  }
}

module.exports = { toLcuShape, ReplayLcu, DIR };
