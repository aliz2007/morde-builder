/* ============================================================
   DATA — load and normalise. matchups.json is rendered
   byte-identical; normalisation touches metadata only.
   ============================================================ */

const KEYSTONE_CANON = {
  'conqueror': 'Conqueror',
  'stormraidersurge': "Stormraider's Surge",
  'presstheattack': 'Press the Attack',
  'unsealedspellbook': 'Unsealed Spellbook',
  'deathfiretouch': 'Deathfire Touch',
  'hailofblades': 'Hail of Blades',
  'graspoftheundying': 'Grasp of the Undying',
};

export const DIFF_WORD = { 1:'Free', 2:'Favourable', 3:'Even', 4:'Hard', 5:'Nightmare' };
export const diffVar = n => `var(--d-${Math.min(5, Math.max(1, n || 3))})`;

const flatten = s => String(s || '').toLowerCase().replace(/[^a-z]/g, '');

function canonKeystone(raw) {
  if (!raw) return null;
  const first = String(raw).split(/-\s*>/)[0].trim();
  return KEYSTONE_CANON[flatten(first)] || first;
}

/** Section slug + semantic variant, driven by the four stable headings. */
const SECT_META = {
  'early game':            { slug:'early-game',            variant:'early' },
  'how to trade':          { slug:'how-to-trade',          variant:'trade' },
  'what to watch out for': { slug:'what-to-watch-out-for', variant:'watch' },
  'tips':                  { slug:'tips',                  variant:'tips'  },
};
export const sectionMeta = h => SECT_META[String(h || '').toLowerCase().trim()]
  || { slug:'notes', variant:'early' };

let _cache = null;

export async function load() {
  if (_cache) return _cache;
  const [matchups, guides] = await Promise.all([
    fetch('data/matchups.json').then(r => r.json()),
    fetch('data/guides.json').then(r => r.json()),
  ]);

  for (const m of matchups) {
    m.keystone = canonKeystone(m.keystone);
    m.overall = m.ratings.overall || 3;
    m.overallWord = DIFF_WORD[m.overall];
    // A TL;DR exists on exactly one champion and its content is a placeholder.
    // Render only when it is real prose.
    m.tldr = (m.tldr || []).filter(t => t && !/^tl;?dr section$/i.test(t.trim()));
    m.sections = (m.sections || []).filter(s => (s.items && s.items.length) || (s.body || '').trim());
    m.variants = m.variants || [];
    m.hasWriteup = m.sections.length > 0 || m.variants.length > 1;
  }
  _cache = { matchups, guides };
  return _cache;
}

export const bySlug = (matchups, slug) => matchups.find(m => m.slug === slug) || null;
export const img = f => `assets/img/${f}`;
