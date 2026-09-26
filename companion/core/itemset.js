const { PREFIX } = require('./runes');

const FILLER = /^(?:flex|variety|items?|flex items?|flex boots?|build variety|build variety items?)$/i;

// The Bible's build icons are mostly unnamed, but the icon FILES are stable
// identifiers across the whole document: the first icon of every build path
// is the level-1 starter the author recommends against that specific
// opponent. Identified visually: image97 = Doran's Ring, image116 = Doran's
// Helm, image91 = Doran's Shield, image237 = Dark Seal.
const STARTER_BY_ICON_FILE = {
  'image97.jpg': "Doran's Ring",
  'image116.jpg': "Doran's Helm",
  'image91.jpg': "Doran's Shield",
  'image237.jpg': 'Dark Seal',
};

// Fallback when a matchup's starter can't be identified: the three Doran's
// choices. Starters that don't exist in the current patch's catalog are
// skipped silently (no bogus warnings).
const STARTERS = ["Doran's Ring", "Doran's Shield", "Doran's Helm"];

// The matchup-specific starter: the first icon of each build path, resolved
// by name when the Bible names it, otherwise by icon file.
function startersFor(matchup) {
  const names = [];
  for (const b of matchup.builds || []) {
    const ic = (b.icons || [])[0];
    const name = ic?.name || STARTER_BY_ICON_FILE[ic?.file];
    if (name && STARTERS.concat('Dark Seal').includes(name) && !names.includes(name)) names.push(name);
  }
  return names;
}

function fragments(stepText) {
  return String(stepText).split(/\s*(?:\/|->)\s*/)
    .map(f => f.replace(/\([^)]*\)/g, ' ').replace(/[()]/g, ' ').replace(/\s+/g, ' ').trim())
    .filter(f => /[a-z]/i.test(f) && !FILLER.test(f) && f.split(' ').length <= 5);
}

function buildItemSet(gd, matchup, mordeId) {
  const unresolved = [];
  const blocks = [];
  const specific = startersFor(matchup);
  const starters = (specific.length ? specific : STARTERS)
    .map(n => gd.itemByName(n))
    .filter(Boolean)
    .map(i => ({ id: String(i.id), count: 1 }));
  if (starters.length) {
    blocks.push({
      type: specific.length ? `Start vs ${matchup.name}` : 'Starting items',
      items: starters,
    });
  }
  for (const [bi, build] of (matchup.builds || []).entries()) {
    const label = build.condition
      ? build.condition.replace(/:$/, '')
      : (matchup.builds.length > 1 ? `Build ${bi + 1}` : `Vs ${matchup.name}`);
    let step = 0;
    for (const s of build.steps || []) {
      if (s.aside) continue;
      step += 1;
      const items = [];
      for (const frag of fragments(s.item)) {
        const hit = gd.itemByName(frag);
        if (hit) items.push({ id: String(hit.id), count: 1 });
        else unresolved.push(frag);
      }
      if (items.length) {
        const head = `${step}. ${s.item}`.slice(0, 78);
        const tail = ` — ${label}`;
        blocks.push({ type: (head.length + tail.length <= 78 ? head + tail : head), items });
      }
    }
  }
  return {
    set: {
      title: PREFIX + matchup.name,
      type: 'custom',
      map: 'any',
      mode: 'any',
      priority: false,
      sortrank: 100,
      associatedChampions: mordeId ? [mordeId] : [],
      associatedMaps: [],
      blocks,
    },
    unresolved: [...new Set(unresolved)],
  };
}

async function pushItemSet(lcu, gd, matchup, summonerId) {
  const morde = gd.champByName('Mordekaiser');
  const { set, unresolved } = buildItemSet(gd, matchup, morde?.id);
  if (!set.blocks.length) throw new Error('no items in this matchup resolved against the client');
  const url = `/lol-item-sets/v1/item-sets/${summonerId}/sets`;
  const cur = await lcu.get(url).catch(() => null) || {};
  const kept = (cur.itemSets || []).filter(s => !(s.title || '').startsWith(PREFIX));
  await lcu.put(url, {
    accountId: cur.accountId ?? summonerId,
    timestamp: Date.now(),
    itemSets: [...kept, set],
  });
  return { blocks: set.blocks.length, unresolved };
}

module.exports = { buildItemSet, pushItemSet, fragments };
