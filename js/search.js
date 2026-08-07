/* ============================================================
   SEARCH — 139 records, client-side, synchronous.
   No debounce, no spinner, no async, no Fuse.js.
   ============================================================ */

import { DIFF_WORD, diffVar, img } from './data.js';

/* ——— 6.1 normalisation. U+2019 is the one that matters. ——— */
const RE_MARKS = /[̀-ͯ]/g;
const RE_STRIP = /['’ʼ`´.\-\s&]/g;
export const norm = s => String(s).toLowerCase().normalize('NFD')
  .replace(RE_MARKS, '').replace(RE_STRIP, '');

/* Single-match variants: `.test()` on a /g regex is stateful, so never reuse the above. */
const RE_MARK_ONE  = /[̀-ͯ]/;
const RE_STRIP_ONE = /['’ʼ`´.\-\s&]/;

/** Normalise while recording, for each output char, its index in the ORIGINAL string. */
function normMap(s) {
  const str = String(s);
  let out = '';
  const map = [];
  for (let i = 0; i < str.length; i++) {
    for (const d of str[i].normalize('NFD')) {
      if (RE_MARK_ONE.test(d)) continue;
      const low = d.toLowerCase();
      if (RE_STRIP_ONE.test(low)) continue;
      out += low;
      map.push(i);
    }
  }
  return { out, map };
}

/* ——— 6.3 alias table ——— */
export const ALIASES = {
  'j4':'Jarvan IV', 'jarvan4':'Jarvan IV', 'jarvaniv':'Jarvan IV', 'jarvan':'Jarvan IV',
  'tf':'Twisted Fate', 'asol':'Aurelion Sol', 'mundo':'Dr. Mundo', 'yi':'Master Yi',
  'xin':'Xin Zhao', 'kench':'Tahm Kench', 'tahm':'Tahm Kench', 'lee':'Lee Sin',
  'morde':'Mordekaiser', 'mf':'Miss Fortune', 'gp':'Gangplank', 'ganglank':'Gangplank',
  'lb':'LeBlanc', 'cait':'Caitlyn', 'kha':"Kha'Zix", 'k6':"Kha'Zix", 'cho':"Cho'Gath",
  'kog':"Kog'Maw", 'rek':"Rek'Sai", 'vel':"Vel'Koz", 'sera':'Seraphine', 'ori':'Orianna',
  'malz':'Malzahar', 'morg':'Morgana', 'heca':'Hecarim', 'voli':'Volibear', 'sej':'Sejuani',
  'naut':'Nautilus', 'blitz':'Blitzcrank', 'nid':'Nidalee', 'eve':'Evelynn',
  'panth':'Pantheon', 'noc':'Nocturne', 'ww':'Warwick', 'nunu':'Nunu & Willump',
  'renata':'Renata Glasc', 'monkeyking':'Wukong', 'trynd':'Tryndamere', 'tryn':'Tryndamere',
  'ksante':"K'Sante", 'kaisa':"Kai'Sa", 'belveth':"Bel'Veth", 'reksai':"Rek'Sai",
  'velkoz':"Vel'Koz", 'kogmaw':"Kog'Maw", 'chogath':"Cho'Gath", 'aurelionsol':'Aurelion Sol',
  'mumu':'Amumu', 'ez':'Ezreal', 'akshan':'Akshan', 'mao':'Maokai', 'yorick':'Yorick',
};

/* Champions that exist in League but have no entry in the Bible — used to tell
   "you typed a real champion we haven't covered" apart from "that isn't a champion". */
const ROSTER_EXTRA = ['Amumu','Ashe','Bard','Blitzcrank','Caitlyn','Ezreal','Janna','Jinx',
  'Kayn','Kha\'Zix','Kindred','Leona','Lillia','Milio','Miss Fortune','Nami','Nilah','Nunu & Willump',
  'Orianna','Rell','Renata Glasc','Samira','Senna','Seraphine','Sivir','Sona','Varus','Xayah',
  'Rakan','Yuumi','Zeri','Zilean','Gragas','Ivern','Amumu','Trundle','Nocturne','Fiddlesticks'];

export function buildIndex(matchups) {
  return matchups.map(m => {
    const { out, map } = normMap(m.name);
    const tokens = m.name.split(/[\s'’&.]+/).filter(Boolean).map(t => norm(t));
    const initials = m.name.split(/[\s&]+/).filter(Boolean).map(w => norm(w)[0] || '').join('');
    return { m, n: out, map, tokens, initials, aliases: (m.aliases || []).map(norm) };
  });
}

const isSubsequence = (q, s) => {
  let i = 0;
  for (const c of s) { if (c === q[i]) i++; if (i === q.length) return true; }
  return q.length === 0;
};

function damLev(a, b, cap) {
  const al = a.length, bl = b.length;
  if (Math.abs(al - bl) > cap) return cap + 1;
  const d = Array.from({ length: al + 1 }, (_, i) => [i, ...Array(bl).fill(0)]);
  for (let j = 0; j <= bl; j++) d[0][j] = j;
  for (let i = 1; i <= al; i++) {
    for (let j = 1; j <= bl; j++) {
      const c = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + c);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[al][bl];
}

/** 6.4 seven tiers. Tier 7 evaluated only when 1–6 come back empty. */
export function rank(index, query) {
  const q = norm(query);
  if (!q) return [];
  const aliasTarget = ALIASES[q] ? norm(ALIASES[q]) : null;
  const hits = [];

  for (const e of index) {
    let tier = 0, at = -1;
    if (e.n === q) { tier = 1; at = 0; }
    else if ((aliasTarget && e.n === aliasTarget) || e.aliases.includes(q)) { tier = 2; at = 0; }
    else if (e.n.startsWith(q)) { tier = 3; at = 0; }
    else {
      let cursor = 0, found = -1;
      for (const t of e.tokens) {
        if (t.startsWith(q)) { found = cursor; break; }
        cursor += t.length;
      }
      if (found >= 0) { tier = 4; at = found; }
      else if (e.initials.length > 1 && e.initials === q) { tier = 5; at = -1; }
      else if (q.length >= 3 && isSubsequence(q, e.n)) { tier = 6; at = -1; }
    }
    if (tier) hits.push({ e, tier, at });
  }

  if (!hits.length) {
    for (const e of index) {
      const cap = e.n.length >= 8 ? 2 : 1;
      if (damLev(q, e.n, cap) <= cap) hits.push({ e, tier: 7, at: -1 });
    }
  }

  hits.sort((a, b) => a.tier - b.tier || a.e.m.name.localeCompare(b.e.m.name));
  return hits;
}

/** Map a normalised match span back onto the original string for highlighting.
 *  Only literal substring matches are highlighted. An alias, initialism or
 *  subsequence hit ("mundo" -> Dr. Mundo, "mf" -> Miss Fortune) has no literal
 *  span at `at`, and marking one anyway bolds the wrong characters. */
export function highlight(entry, query, at) {
  const q = norm(query);
  const name = entry.m.name;
  if (!q) return escapeHtml(name);
  let start = at;
  if (start < 0 || entry.n.slice(start, start + q.length) !== q) start = entry.n.indexOf(q);
  if (start < 0) return escapeHtml(name);
  const from = entry.map[start];
  const toIdx = entry.map[start + q.length - 1];
  if (from == null || toIdx == null) return escapeHtml(name);
  const to = toIdx + 1;
  return escapeHtml(name.slice(0, from)) + '<mark>' + escapeHtml(name.slice(from, to)) +
         '</mark>' + escapeHtml(name.slice(to));
}

export const escapeHtml = s => String(s).replace(/[&<>"']/g, c =>
  ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));

/** Distinguish "not a champion" from "real champion, no writeup yet". */
export function knownChampion(query, matchups) {
  const q = norm(query);
  const covered = new Set(matchups.map(m => norm(m.name)));
  const uncovered = ROSTER_EXTRA.filter(c => !covered.has(norm(c)));
  const alias = ALIASES[q];
  if (alias && !covered.has(norm(alias)) && uncovered.some(c => norm(c) === norm(alias))) return alias;
  for (const c of uncovered) {
    if (norm(c) === q) return c;
    if (q.length >= 4 && norm(c).startsWith(q)) return c;
  }
  return null;
}

export function closest(index, query, n = 3) {
  const q = norm(query);
  return index
    .map(e => ({ e, d: damLev(q, e.n, 99) }))
    .sort((a, b) => a.d - b.d || a.e.m.name.localeCompare(b.e.m.name))
    .slice(0, n).map(x => x.e.m);
}

/* ——— recents ——— */
const RK = 'morde.recents';
export const recents = () => { try { return JSON.parse(localStorage.getItem(RK)) || []; } catch { return []; } };
export function pushRecent(slug) {
  try {
    const list = recents().filter(s => s !== slug);
    list.unshift(slug);
    localStorage.setItem(RK, JSON.stringify(list.slice(0, 4)));
  } catch { /* private mode — recents are a convenience, not a requirement */ }
}

/* ——— row markup ——— */
export function optionRow(m, id, active, inner) {
  const d = m.overall;
  return `<a class="opt${active ? ' is-active' : ''}" id="${id}" role="option"
     aria-selected="${active}" href="#/vs/${m.slug}" style="--pill:${diffVar(d)}">
    <img class="opt__img" src="${img(m.portrait)}" alt="" width="32" height="32" loading="lazy">
    <span class="opt__name">${inner || escapeHtml(m.name)}</span>
    <span class="opt__pill"><span class="opt__val">${d}/5</span>
    <span class="opt__word">${DIFF_WORD[d]}</span></span></a>`;
}
