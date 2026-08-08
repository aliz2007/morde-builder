const { test, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startMock, startMockLive } = require('../mock/mock-lcu');
const { Companion } = require('../core/app');

const REPO = path.resolve(__dirname, '../..');
let tmp, mock, live, app;

const waitFor = (fn, ms = 4000) => new Promise((resolve, reject) => {
  const t0 = Date.now();
  const tick = () => {
    const v = fn();
    if (v) return resolve(v);
    if (Date.now() - t0 > ms) return reject(new Error('waitFor timed out'));
    setTimeout(tick, 40);
  };
  tick();
});

before(async () => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mb-companion-'));
  mock = await startMock({ dir: tmp });
  live = await startMockLive();
  process.env.MB_LIVE_URL = live.url;
  app = new Companion({ repoRoot: REPO, configDir: tmp, lockfilePaths: [mock.lockfile] });
  app.state.toggles.summoners = true;
  app.live.base = new URL(live.url);
  app.start();
  await waitFor(() => app.state.connected);
});

after(() => {
  app.stop();
  mock.close();
  live.close();
});

test('connects and loads patch data from the client', () => {
  assert.equal(app.state.connected, true);
  assert.equal(app.summonerId, 777);
  assert.ok(app.gd.items.length >= 20);
  assert.ok(app.gd.perks.size >= 40);
});

test('champ select surfaces the enemy team with writeup availability', async () => {
  mock.setPhase('ChampSelect');
  mock.setChampSelect({
    localPlayerCellId: 0,
    myTeam: [{ cellId: 0, championId: 82 }],
    theirTeam: [
      { cellId: 5, championId: 266 },
      { cellId: 6, championId: 122 },
      { cellId: 7, championId: 145 },
      { cellId: 8, championId: 62 },
      { cellId: 9, championId: 0 },
    ],
  });
  const enemies = await waitFor(() => app.state.enemies.length === 4 && app.state.enemies);
  assert.deepEqual(enemies.map(e => e.name), ['Aatrox', 'Darius', "Kai'Sa", 'Wukong']);
  assert.ok(enemies.every(e => e.hasWriteup), 'all four should have writeups');
});

test('picking Aatrox pushes a correct rune page', async () => {
  await app.pick('Aatrox');
  assert.equal(mock.recorded.runePosts.length, 1);
  const page = mock.recorded.runePosts[0];
  assert.equal(page.name, 'MB: Aatrox');
  assert.equal(page.primaryStyleId, 8000);
  assert.equal(page.subStyleId, 8400);
  assert.deepEqual(page.selectedPerkIds, [8010, 9111, 9104, 8299, 8401, 8473, 5005, 5010, 5011]);
  assert.equal(page.current, true);
});

test('picking Aatrox pushes summoner spells', () => {
  assert.equal(mock.recorded.selectionPatches.length, 1);
  assert.deepEqual(mock.recorded.selectionPatches[0], { spell1Id: 4, spell2Id: 14 });
});

test('picking Aatrox saves an item set without touching other sets', () => {
  assert.equal(mock.recorded.itemSetPuts.length, 1);
  const put = mock.recorded.itemSetPuts[0];
  assert.ok(put.itemSets.some(s => s.title === 'My old set'), 'pre-existing set kept');
  const set = put.itemSets.find(s => s.title === 'MB: Aatrox');
  assert.ok(set, 'MB set present');
  assert.deepEqual(set.associatedChampions, [82]);
  assert.ok(set.blocks.length >= 8, `expected both build paths, got ${set.blocks.length} blocks`);
  const ids = set.blocks.flatMap(b => b.items.map(i => i.id));
  for (const id of ['3076', '1001', '4629', '3047', '4633', '447102', '6653', '447101']) {
    assert.ok(ids.includes(id), `item ${id} missing from set`);
  }
});

test('re-picking replaces the MB rune page and item set instead of stacking', async () => {
  await app.pick('Darius');
  assert.equal(mock.recorded.runeDeletes.length, 1, 'old MB page deleted');
  const pages = mock.runePages.filter(p => p.name.startsWith('MB: '));
  assert.equal(pages.length, 1);
  assert.equal(pages[0].name, 'MB: Darius');
  const mbSets = mock.itemSets.itemSets.filter(s => s.title.startsWith('MB: '));
  assert.equal(mbSets.length, 1);
  assert.equal(mbSets[0].title, 'MB: Darius');
});

test('a matchup whose runes cannot be resolved fails loudly and pushes nothing', async () => {
  const unresolvable = app.bible.matchups.find(m => m.keystone === 'Unsealed Spellbook');
  assert.ok(unresolvable, 'fixture assumes an Unsealed Spellbook matchup exists');
  const posts = mock.recorded.runePosts.length;
  await app.pick(unresolvable.name);
  assert.equal(mock.recorded.runePosts.length, posts, 'no page pushed');
  const err = app.state.log.findLast(l => l.level === 'error' && /Runes:/.test(l.message));
  assert.ok(err, 'error surfaced in the log');
  assert.match(err.message, /not found/);
});

test('overlay data carries builds, tips and the difficulty', async () => {
  await app.pick('Aatrox');
  const snap = app.snapshot();
  assert.equal(snap.overlay.name, 'Aatrox');
  assert.equal(snap.overlay.overall, 3);
  assert.equal(snap.overlay.builds.length, 2);
  assert.ok(snap.overlay.builds[0].steps.length >= 4);
  assert.ok(snap.overlay.tips.some(t => t.heading === 'Tips'));
  assert.deepEqual(snap.overlay.summoners, ['Flash', 'Ignite']);
  assert.ok(!snap.overlay.tldr.some(t => /tl;?dr section/i.test(t)), 'placeholder filtered');
  assert.ok(snap.overlay.tldr.includes("Don't die level 1"));
});

test('in game, the overlay follows the real enemy top laner', async () => {
  mock.setPhase('InProgress');
  await waitFor(() => app.state.phase === 'InProgress');
  live.setGame({
    activePlayer: { riotId: 'Me#EUW' },
    allPlayers: [
      { riotId: 'Me#EUW', team: 'ORDER', position: 'TOP', championName: 'Mordekaiser' },
      { riotId: 'Foe#EUW', team: 'CHAOS', position: 'TOP', championName: 'Darius' },
      { riotId: 'Foe2#EUW', team: 'CHAOS', position: 'JUNGLE', championName: 'Wukong' },
    ],
  });
  await app.live.poll();
  assert.equal(app.live.topLaner, 'Darius');
  assert.equal(app.snapshot().overlay.name, 'Darius');
});

test('toggles persist to disk', () => {
  app.setToggle('summoners', false);
  const saved = JSON.parse(fs.readFileSync(path.join(tmp, 'config.json'), 'utf8'));
  assert.equal(saved.summoners, false);
  assert.equal(saved.runes, true);
});
