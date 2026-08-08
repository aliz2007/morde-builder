const norm = s => String(s || '').toLowerCase().normalize('NFD')
  .replace(/[̀-ͯ]/g, '')
  .replace(/&/g, 'and')
  .replace(/['’ʼ`´.\-\s:,()\/]/g, '');

const STOP = new Set(['and', 'of', 'the', 'a', 'an']);
const tokens = s => String(s || '').toLowerCase().normalize('NFD')
  .replace(/[̀-ͯ]/g, '').split(/[^a-z0-9]+/).filter(t => t && !STOP.has(t));

function distance(a, b) {
  if (a === b) return 0;
  if (!a.length || !b.length) return Math.max(a.length, b.length);
  let prev2 = null;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const row = new Array(b.length + 1);
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        row[j] = Math.min(row[j], prev2[j - 2] + 1);
      }
    }
    prev2 = prev;
    prev = row;
  }
  return prev[b.length];
}

function score(query, candidate) {
  const q = norm(query), c = norm(candidate);
  if (!q || !c) return 0;
  if (q === c) return 100;
  if (c.startsWith(q) || q.startsWith(c)) return 80;
  if (c.includes(q) || q.includes(c)) return 60;

  const qt = new Set(tokens(query)), ct = new Set(tokens(candidate));
  const inter = [...qt].filter(t => ct.has(t)).length;
  const union = new Set([...qt, ...ct]).size;
  const overlap = union ? Math.round((inter / union) * 50) : 0;

  const span = Math.max(q.length, c.length);
  const d = distance(q, c);
  const near = d <= Math.max(1, Math.floor(span * 0.2)) ? Math.round((1 - d / span) * 55) : 0;

  return Math.max(overlap, near);
}

function best(query, candidates, nameOf, prefer) {
  const scored = [];
  for (const c of candidates) {
    const s = score(query, nameOf(c));
    if (s >= 40) scored.push({ c, s, key: norm(nameOf(c)) });
  }
  if (!scored.length) return null;

  let top = scored[0];
  for (const x of scored) if (x.s > top.s) top = x;

  let rival = null;
  for (const x of scored) if (x.key !== top.key && (!rival || x.s > rival.s)) rival = x;
  if (top.s < 100 && rival && top.s - rival.s < 10) return null;

  const tied = scored.filter(x => x.s === top.s && x.key === top.key).map(x => x.c);
  if (tied.length === 1 || !prefer) return tied[0];
  return tied.slice().sort(prefer)[0];
}

const byId = (a, b) => a.id - b.id;
const firstAlternative = s => String(s || '').split(/\s+or\s+/i)[0].trim();

function onRift(entry) {
  if (entry.displayInItemSets === false) return false;
  if (entry.inStore === false) return false;
  if (entry.requiredAlly) return false;
  return !(entry.maps && entry.maps['11'] === false);
}

function inClassic(entry) {
  const modes = entry.modes || entry.gameModes;
  if (Array.isArray(modes) && modes.length && !modes.includes('CLASSIC')) return false;
  return onRift(entry);
}

class GameData {
  constructor() {
    this.perks = new Map();
    this.styles = [];
    this.items = [];
    this.shopItems = [];
    this.spells = [];
    this.riftSpells = [];
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

    this.shopItems = this.items.filter(onRift);
    if (!this.shopItems.length) this.shopItems = this.items;
    this.riftSpells = this.spells.filter(inClassic);
    if (!this.riftSpells.length) this.riftSpells = this.spells;
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

  matchRows(names, rows) {
    const options = names.map(n => rows
      .map((row, ri) => {
        const hit = best(n, row.perks, id => this.perkName(id));
        return hit == null ? null : { ri, id: hit };
      })
      .filter(Boolean));
    if (options.some(o => !o.length)) return null;

    const used = new Set();
    const picked = [];
    const walk = i => {
      if (i === options.length) return true;
      for (const o of options[i]) {
        if (used.has(o.ri)) continue;
        used.add(o.ri);
        picked.push(o);
        if (walk(i + 1)) return true;
        used.delete(o.ri);
        picked.pop();
      }
      return false;
    };
    if (!walk(0)) return null;
    return picked.slice().sort((a, b) => a.ri - b.ri).map(o => o.id);
  }

  resolveRunePage(runes) {
    const misses = [];
    const primary = (runes.primary || []).map(firstAlternative).filter(Boolean).slice(0, 4);
    const secondary = (runes.secondary || []).map(firstAlternative).filter(Boolean).slice(0, 2);
    const shards = (runes.shards || [])
      .flatMap(sh => {
        const m = /^double\s+(.+)$/i.exec(String(sh).trim());
        return m ? [m[1], m[1]] : [sh];
      })
      .map(firstAlternative).filter(Boolean).slice(0, 3);

    if (primary.length < 4) misses.push(`primary tree has ${primary.length} runes, need 4`);
    if (secondary.length < 2) misses.push(`secondary tree has ${secondary.length} runes, need 2`);
    if (shards.length < 3) misses.push(`${shards.length} stat shards, need 3`);
    if (misses.length) return { misses };

    let primaryStyle = null, keystoneId = null;
    for (const style of this.styles) {
      const pool = this.slotKinds(style).key.flatMap(s => s.perks);
      const hit = best(primary[0], pool, id => this.perkName(id));
      if (hit != null) { primaryStyle = style; keystoneId = hit; break; }
    }
    if (!primaryStyle) return { misses: [`keystone "${primary[0]}" not found in any rune tree`] };

    const selected = [keystoneId];
    const minorIds = this.matchRows(primary.slice(1, 4), this.slotKinds(primaryStyle).regular);
    if (!minorIds) {
      misses.push(`"${primary.slice(1, 4).join(' + ')}" do not fit three separate ${primaryStyle.name} rows`);
    } else {
      selected.push(...minorIds);
    }

    let subStyle = null;
    for (const style of this.styles) {
      if (style.id === primaryStyle.id) continue;
      const picks = this.matchRows(secondary, this.slotKinds(style).regular);
      if (picks) { subStyle = style; selected.push(...picks); break; }
    }
    if (!subStyle) {
      misses.push(`secondary runes "${secondary.join(' + ')}" are not in two separate rows of one tree`);
    }

    const statSlots = this.slotKinds(primaryStyle).stat;
    for (let i = 0; i < 3; i++) {
      const pool = (statSlots[i] || statSlots[statSlots.length - 1])?.perks || [];
      const hit = best(shards[i], pool, id => this.perkName(id));
      if (hit == null) misses.push(`shard "${shards[i]}" not found in stat row ${i + 1}`);
      else selected.push(hit);
    }

    if (!misses.length && selected.length !== 9) {
      misses.push(`built ${selected.length} perks, the client needs exactly 9`);
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
    return best(cleaned, this.shopItems, i => i.name, byId)
      || best(cleaned, this.items, i => i.name, byId);
  }

  spellByName(name) {
    return best(name, this.riftSpells, s => s.name, byId)
      || best(name, this.spells, s => s.name, byId);
  }

  champByName(name) {
    const k = norm(name);
    const exact = this.champs.filter(c => norm(c.name) === k || norm(c.alias) === k);
    if (exact.length) return exact.reduce((a, b) => (b.id < a.id ? b : a));
    return best(name, this.champs, c => c.name, byId);
  }

  champById(id) { return this.champs.find(c => c.id === id) || null; }
}

module.exports = { GameData, norm, score, best, distance, onRift, inClassic };
