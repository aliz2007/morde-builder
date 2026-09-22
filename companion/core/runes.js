const PREFIX = 'MB: ';

class ResolveError extends Error {
  constructor(misses) {
    super('Could not resolve against the client: ' + misses.join('; '));
    this.misses = misses;
  }
}

async function pushRunes(lcu, gd, matchup) {
  const page = gd.resolveRunePage(matchup.runes || {});
  if (page.misses.length) throw new ResolveError(page.misses);

  const pages = (await lcu.get('/lol-perks/v1/pages')) || [];
  for (const p of pages.filter(p => p.name && p.name.startsWith(PREFIX))) {
    await lcu.del(`/lol-perks/v1/pages/${p.id}`).catch(() => {});
  }

  const body = {
    name: PREFIX + matchup.name,
    primaryStyleId: page.primaryStyleId,
    subStyleId: page.subStyleId,
    selectedPerkIds: page.selectedPerkIds,
    current: true,
  };

  // Rune pages have a hard cap in the client. When the cap is hit, free a slot
  // ourselves instead of making the user delete one by hand: oldest deletable,
  // non-current page first (MB pages were already removed above).
  const victims = pages
    .filter(p => !p.name || !p.name.startsWith(PREFIX))
    .filter(p => p.isDeletable !== false && p.isTemporary !== true)
    .sort((a, b) => {
      const act = p => (p.current || p.isActive ? 1 : 0);
      if (act(a) !== act(b)) return act(a) - act(b);
      return (a.lastModified || a.id) - (b.lastModified || b.id);
    });

  const freed = [];
  while (true) {
    try {
      await lcu.post('/lol-perks/v1/pages', body);
      if (freed.length) page.freedPages = freed;
      return page;
    } catch (err) {
      if ((err.status === 400 || err.status === 403) && victims.length) {
        const victim = victims.shift();
        await lcu.del(`/lol-perks/v1/pages/${victim.id}`).catch(() => {});
        freed.push(victim.name || `#${victim.id}`);
        continue;
      }
      if (err.status === 400 || err.status === 403) {
        throw new Error('The client refused the rune page and no deletable page was left to make room.');
      }
      throw err;
    }
  }
}

async function pushSummoners(lcu, gd, matchup, flashKey = 'F') {
  const names = (matchup.summoners || []).map(s => s.name).filter(Boolean);
  if (names.length < 2) throw new Error(`matchup lists ${names.length} summoner spells`);
  const ids = names.map(n => gd.spellByName(n));
  const missing = names.filter((n, i) => !ids[i]);
  if (missing.length) throw new ResolveError(missing.map(n => `spell "${n}" not found`));
  // Flash goes on the user's preferred key (spell1 = D, spell2 = F); the
  // other spell takes the remaining slot. Matchups without Flash keep the
  // Bible's order.
  let ordered = ids;
  const fi = ids.findIndex(s => s.name === 'Flash');
  if (fi !== -1) {
    const flash = ids[fi];
    const other = ids.find((_, i) => i !== fi);
    ordered = flashKey === 'D' ? [flash, other] : [other, flash];
  }
  await lcu.patch('/lol-champ-select/v1/session/my-selection', {
    spell1Id: ordered[0].id,
    spell2Id: ordered[1].id,
  });
  return { spell1: ordered[0].name, spell2: ordered[1].name };
}

module.exports = { pushRunes, pushSummoners, ResolveError, PREFIX };
