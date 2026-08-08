const { PREFIX } = require('./runes');

function fragments(stepText) {
  return String(stepText).split(/\s*(?:\/|->)\s*/)
    .map(f => f.replace(/\(.*?\)/g, '').trim())
    .filter(f => f && !/^(flex items?|build variety items?|flex boots)$/i.test(f));
}

function buildItemSet(gd, matchup, mordeId) {
  const unresolved = [];
  const blocks = [];
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
        blocks.push({ type: `${label} — ${step}. ${s.item}`.slice(0, 80), items });
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
