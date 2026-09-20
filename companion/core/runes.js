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

async function pushSummoners(lcu, gd, matchup) {
  const names = (matchup.summoners || []).map(s => s.name).filter(Boolean);
  if (names.length < 2) throw new Error(`matchup lists ${names.length} summoner spells`);
  const ids = names.map(n => gd.spellByName(n));
  const missing = names.filter((n, i) => !ids[i]);
  if (missing.length) throw new ResolveError(missing.map(n => `spell "${n}" not found`));
  await lcu.patch('/lol-champ-select/v1/session/my-selection', {
    spell1Id: ids[0].id,
    spell2Id: ids[1].id,
  });
  return { spell1: ids[0].name, spell2: ids[1].name };
}

module.exports = { pushRunes, pushSummoners, ResolveError, PREFIX };
