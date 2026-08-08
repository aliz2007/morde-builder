const norm = s => String(s || '').toLowerCase().normalize('NFD')
  .replace(/[̀-ͯ]/g, '').replace(/['’ʼ`´.\-\s&:,()]/g, '');

const tokens = s => String(s || '').toLowerCase().normalize('NFD')
  .replace(/[̀-ͯ]/g, '').split(/[^a-z0-9]+/).filter(Boolean);

function score(query, candidate) {
  const q = norm(query), c = norm(candidate);
  if (!q || !c) return 0;
  if (q === c) return 100;
  if (c.startsWith(q) || q.startsWith(c)) return 80;
  if (c.includes(q) || q.includes(c)) return 60;
  const qt = new Set(tokens(query)), ct = new Set(tokens(candidate));
  const inter = [...qt].filter(t => ct.has(t)).length;
  const union = new Set([...qt, ...ct]).size;
  return union ? Math.round((inter / union) * 50) : 0;
}

function best(query, candidates, nameOf) {
  let top = null, second = 0;
  for (const c of candidates) {
    const s = score(query, nameOf(c));
    if (!top || s > top.s) { second = top ? top.s : 0; top = { c, s }; }
    else if (s > second) second = s;
  }
  if (!top || top.s < 40) return null;
  if (top.s < 100 && top.s - second < 10) return null;
  return top.c;
}

class GameData {
  constructor() {
    this.perks = new Map();
    this.styles = [];
    this.items = [];
    this.spells = [];
    this.champs = [];
  }

  async load(lcu) {
    const [styles, perks, items, spells, champs] = await Promise.all([
      lcu.get('/lol-game-data/assets/v1/perkstyles.json'),
      lcu.get('/lol-game-data/assets/v1/perks.json'),
      lcu.get('/lol-game-data/assets/v1/items.json'),
      lcu.get('/lol-game-data/assets/v1/summoner-spells.json'),
      lcu.get('/lol-game-data/assets/v1/champion-summary.json'),
    ]);
    this.styles = Array.isArray(styles) ? styles : (styles.styles || []);
    for (const p of perks) this.perks.set(p.id, p);
    this.items = items.filter(i => i.name);
    this.spells = spells.filter(s => s.name);
    this.champs = champs.filter(c => c.id > 0);
    return this;
  }

  perkName(id) { return this.perks.get(id)?.name || String(id); }

  slotKinds(style) {
    const key = [], regular = [], stat = [];
    for (const slot of style.slots || []) {
      const t = String(slot.type || '');
      if (/keystone/i.test(t)) key.push(slot);
      else if (/statmod/i.test(t)) stat.push(slot);
      else regular.push(slot);
    }
    return { key, regular, stat };
  }

  resolveRunePage(runes) {
    const misses = [];
    const primary = runes.primary || [];
    const secondary = runes.secondary || [];
    const shards = runes.shards || [];
    if (primary.length < 4) misses.push(`primary tree has ${primary.length} runes, need 4`);
    if (secondary.length < 2) misses.push(`secondary tree has ${secondary.length} runes, need 2`);
    if (shards.length < 3) misses.push(`${shards.length} stat shards, need 3`);
    if (misses.length) return { misses };

    let primaryStyle = null, keystoneId = null;
    for (const style of this.styles) {
      const { key } = this.slotKinds(style);
      const pool = key.flatMap(s => s.perks);
      const hit = best(primary[0], pool, id => this.perkName(id));
      if (hit != null) { primaryStyle = style; keystoneId = hit; break; }
    }
    if (!primaryStyle) return { misses: [`keystone "${primary[0]}" not found in any rune tree`] };

    const selected = [keystoneId];
    const { regular } = this.slotKinds(primaryStyle);
    const minors = primary.slice(1, 4);
    for (let i = 0; i < regular.length && i < 3; i++) {
      let hit = best(minors[i], regular[i].perks, id => this.perkName(id));
      if (hit == null) {
        for (const alt of minors) {
          hit = best(alt, regular[i].perks, id => this.perkName(id));
          if (hit != null) break;
        }
      }
      if (hit == null) {
        misses.push(`"${minors[i]}" not found in ${primaryStyle.name} row ${i + 1}`);
      } else {
        selected.push(hit);
      }
    }

    let subStyle = null;
    const subPicks = [];
    for (const style of this.styles) {
      if (style.id === primaryStyle.id) continue;
      const pool = this.slotKinds(style).regular.flatMap(s => s.perks);
      const hits = secondary.map(name => best(name, pool, id => this.perkName(id)));
      if (hits.every(h => h != null)) { subStyle = style; subPicks.push(...hits); break; }
    }
    if (!subStyle) {
      misses.push(`secondary runes "${secondary.join(' + ')}" not found together in one tree`);
    } else {
      selected.push(...subPicks);
    }

    const statSlots = primaryStyle ? this.slotKinds(primaryStyle).stat : [];
    for (let i = 0; i < 3; i++) {
      const pool = (statSlots[i] || statSlots[statSlots.length - 1])?.perks || [];
      const hit = best(shards[i], pool, id => this.perkName(id));
      if (hit == null) misses.push(`shard "${shards[i]}" not found in stat row ${i + 1}`);
      else selected.push(hit);
    }

    if (misses.length) return { misses };
    return {
      misses: [],
      primaryStyleId: primaryStyle.id,
      subStyleId: subStyle.id,
      selectedPerkIds: selected,
    };
  }

  itemByName(name) {
    const cleaned = String(name).replace(/\brush\b/ig, '').replace(/\(.*?\)/g, '').trim();
    if (!cleaned) return null;
    return best(cleaned, this.items, i => i.name);
  }

  spellByName(name) { return best(name, this.spells, s => s.name); }

  champByName(name) {
    return this.champs.find(c => norm(c.name) === norm(name) || norm(c.alias) === norm(name))
      || best(name, this.champs, c => c.name);
  }

  champById(id) { return this.champs.find(c => c.id === id) || null; }
}

module.exports = { GameData, norm, score, best };
