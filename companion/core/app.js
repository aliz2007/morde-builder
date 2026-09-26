const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');
const { LockfileWatcher } = require('./lockfile');
const { Lcu } = require('./lcu');
const { GameData } = require('./gamedata');
const { Bible } = require('./bible');
const { pushRunes, pushSummoners } = require('./runes');
const { pushItemSet } = require('./itemset');
const { LiveClient } = require('./live');
const { advise, resolveItem } = require('./advisor');
const { fragments } = require('./itemset');

const WS_EVENTS = [
  'OnJsonApiEvent_lol-champ-select_v1_session',
  'OnJsonApiEvent_lol-gameflow_v1_gameflow-phase',
];

const DEFAULT_TOGGLES = { runes: true, items: true, summoners: false, overlay: true, advisor: true };
// Which section the overlay card shows; 'all' shows everything.
const OVERLAY_SECTIONS = ['all', 'tldr', 'early', 'trade', 'watch', 'tips', 'builds', 'summoners', 'live'];

// The advisor's candidate pool beyond what the Bible's builds already use —
// the full universe from the author's itemization guide.
const COUNTERS = [
  'Hextech Rocketbelt', "Rylai's Crystal Scepter", 'Cosmic Drive',
  'Riftmaker', 'Dusk & Dawn', "Liandry's Torment", "Bloodletter's Curse",
  "Nashor's Tooth", 'Hextech Gunblade', "Rabadon's Deathcap", 'Shadowflame',
  'Void Staff', 'Experimental Hexplate',
  "Zhonya's Hourglass", "Banshee's Veil", 'Kaenic Rookern', "Sterak's Gage", "Death's Dance",
  "Randuin's Omen", 'Frozen Heart', 'Thornmail', 'Spirit Visage', 'Force of Nature',
  'Abyssal Mask', "Jak'Sho, The Protean", 'Unending Despair', "Dead Man's Plate",
  "Warmog's Armor", "Guardian's Angel",
  'Oblivion Orb', 'Morellonomicon', "Serpent's Fang",
  'Dark Seal', "Mejai's Soulstealer",
  'Plated Steelcaps', "Mercury's Treads", 'Boots of Swiftness', 'Gluttonous Greaves', "Sorcerer's Shoes",
];

class Companion extends EventEmitter {
  constructor({ repoRoot, configDir, lockfilePaths = [], liveIntervalMs }) {
    super();
    this.repoRoot = repoRoot;
    this.liveIntervalMs = liveIntervalMs;
    this.configPath = path.join(configDir, 'config.json');
    this.bible = new Bible(repoRoot);
    this.gd = new GameData();
    this.lcu = null;
    this.live = new LiveClient();
    this.watcher = new LockfileWatcher(lockfilePaths);
    this.summonerId = null;
    this.pollTimer = null;
    const cfg = this.loadConfig();
    this.overlayBounds = cfg.overlayBounds;
    this.pool = null;        // advisor candidate pool, built once the catalog loads
    this.catalogById = null; // classified catalog entries by item id
    this.lastAdviceKey = null;
    this.state = {
      connected: false,
      phase: null,
      enemies: [],
      picked: null,
      overlayMatchup: null,
      toggles: cfg.toggles,
      overlayFocus: cfg.overlayFocus,
      flashKey: cfg.flashKey,
      advice: null,
      log: [],
    };
  }

  loadConfig() {
    let raw = {};
    try { raw = JSON.parse(fs.readFileSync(this.configPath, 'utf8')); } catch {}
    // legacy shape: the whole file was the toggles object
    const legacy = 'runes' in raw || 'items' in raw;
    return {
      toggles: { ...DEFAULT_TOGGLES, ...(legacy ? raw : raw.toggles) },
      overlayFocus: OVERLAY_SECTIONS.includes(raw.overlayFocus) ? raw.overlayFocus : 'all',
      overlayBounds: legacy ? null : (raw.overlayBounds || null),
      flashKey: raw.flashKey === 'D' ? 'D' : 'F',
    };
  }

  saveConfig() {
    fs.mkdirSync(path.dirname(this.configPath), { recursive: true });
    fs.writeFileSync(this.configPath, JSON.stringify({
      toggles: this.state.toggles,
      overlayFocus: this.state.overlayFocus,
      overlayBounds: this.overlayBounds || null,
      flashKey: this.state.flashKey,
    }, null, 2));
  }

  setToggle(key, value) {
    if (!(key in this.state.toggles)) return;
    this.state.toggles[key] = !!value;
    if (key === 'advisor' && !value) {
      this.state.advice = null;
      this.lastAdviceKey = null;
    }
    this.saveConfig();
    this.publish();
  }

  // Which key Flash lands on (spell1 = D, spell2 = F). Re-pushes summoners
  // immediately if we're in champ select with a matchup already picked.
  setFlashKey(key) {
    if (key !== 'D' && key !== 'F') return;
    if (this.state.flashKey === key) return;
    this.state.flashKey = key;
    this.saveConfig();
    this.publish();
    if (this.state.picked && this.state.toggles.summoners && this.state.phase === 'ChampSelect') {
      this.pick(this.state.picked);
    }
  }

  setOverlayFocus(key) {
    if (!OVERLAY_SECTIONS.includes(key)) return;
    this.state.overlayFocus = key;
    this.saveConfig();
    this.publish();
  }

  saveOverlayBounds(bounds) {
    if (!bounds || typeof bounds.width !== 'number' || typeof bounds.height !== 'number') return;
    this.overlayBounds = bounds;
    this.saveConfig();
  }

  log(level, message) {
    this.state.log.push({ t: Date.now(), level, message });
    if (this.state.log.length > 60) this.state.log.shift();
    this.publish();
  }

  publish() {
    this.emit('state', this.snapshot());
  }

  snapshot() {
    return {
      ...this.state,
      overlay: this.state.overlayMatchup
        ? this.bible.overlayData(this.state.overlayMatchup)
        : null,
    };
  }

  start() {
    this.watcher.on('found', creds => this.connect(creds));
    this.watcher.on('lost', () => {
      this.state.connected = false;
      this.lcu?.close();
      this.log('info', 'League client closed');
    });
    this.watcher.start();

    this.live.on('top-laner', name => {
      const m = this.bible.find(name);
      if (m && m !== this.state.overlayMatchup) {
        this.state.overlayMatchup = m;
        this.log('info', `In game: enemy top is ${name} — overlay switched`);
      }
    });
    this.live.on('game-state', gs => this.onGameState(gs));
    this.live.on('game-end', () => {
      this.state.advice = null;
      this.lastAdviceKey = null;
      this.log('info', 'Game ended');
    });
    return this;
  }

  // The advisor's item universe: every item the Bible's builds use, plus the
  // counter pool above — all resolved against the client's own catalog, so
  // anything the patch doesn't have is never recommended.
  buildPool() {
    this.catalogById = new Map();
    for (const i of this.gd.items) this.catalogById.set(Number(i.id), i);

    const ids = new Set();
    const fragCache = new Map();
    const resolve = f => {
      if (!fragCache.has(f)) fragCache.set(f, this.gd.itemByName(f));
      return fragCache.get(f);
    };
    for (const m of this.bible.matchups) {
      for (const b of m.builds || []) {
        for (const s of b.steps || []) {
          if (s.aside) continue;
          for (const f of fragments(s.item)) {
            const hit = resolve(f);
            if (hit) ids.add(Number(hit.id));
          }
        }
      }
    }
    for (const name of COUNTERS) {
      const hit = this.gd.itemByName(name);
      if (hit) ids.add(Number(hit.id));
    }
    const candidates = [...ids]
      .map(id => this.catalogById.get(id))
      .filter(Boolean)
      .map(resolveItem);
    this.pool = { candidates };
  }

  // The matchup's core: the first steps of its first build path.
  coreFor(matchup) {
    const build = (matchup?.builds || [])[0];
    if (!build) return [];
    const out = [];
    for (const s of (build.steps || []).filter(s => !s.aside).slice(0, 3)) {
      for (const f of fragments(s.item)) {
        const hit = this.gd.itemByName(f);
        if (hit) out.push({ id: Number(hit.id), name: hit.name });
      }
    }
    return [...new Map(out.map(o => [o.id, o])).values()];
  }

  onGameState(gs) {
    if (!this.state.toggles.advisor || !this.pool) return;
    // Unknown items (new patch, catalog not refreshed) still count their live
    // price toward the gold diff instead of silently vanishing.
    const enrich = p => ({
      ...p,
      items: p.items
        .map(i => this.catalogById.get(Number(i.id))
          || { id: i.id, name: `#${i.id}`, price: i.price ?? 0 })
        .map(resolveItem),
    });
    const advice = advise({
      me: enrich(gs.me),
      enemies: gs.enemies.map(enrich),
      allies: (gs.allies || []).map(enrich),
      core: this.coreFor(this.state.overlayMatchup),
      pool: this.pool,
      gameMinutes: Math.max(1, (gs.gameTime || 0) / 60),
      laneOpponent: this.state.overlayMatchup?.name || null,
    });
    const key = JSON.stringify(advice);
    if (key !== this.lastAdviceKey) {
      this.lastAdviceKey = key;
      this.state.advice = advice;
      this.publish();
    }
  }

  async connect(creds) {
    this.lcu?.close();
    if (this.retryTimer) { clearTimeout(this.retryTimer); this.retryTimer = null; }
    try {
      this.lcu = new Lcu(creds);
      await this.gd.load(this.lcu);
      this.buildPool();
      const me = await this.lcu.get('/lol-summoner/v1/current-summoner');
      this.summonerId = me?.summonerId ?? null;
      this.state.connected = true;
      this.log('info', `Connected to the client (patch data: ${this.gd.items.length} items, ${this.gd.perks.size} runes)`);

      this.lcu.on('event', ev => this.onEvent(ev));
      this.lcu.on('ws-error', () => {});
      this.lcu.connectWs(WS_EVENTS);
      this.startPolling();

      const phase = await this.lcu.get('/lol-gameflow/v1/gameflow-phase').catch(() => null);
      if (phase) this.onPhase(String(phase).replace(/"/g, ''));
      const session = await this.lcu.get('/lol-champ-select/v1/session').catch(() => null);
      if (session) this.onChampSelect(session);
    } catch (err) {
      this.state.connected = false;
      this.log('warn', `Client not ready yet (${err.code || err.message}) — retrying in 3s`);
      this.retryTimer = setTimeout(() => {
        this.retryTimer = null;
        if (this.watcher.current?.port === creds.port) this.connect(creds);
      }, 3000);
      this.retryTimer.unref?.();
    }
  }

  startPolling(intervalMs = 3000) {
    if (this.pollTimer) clearInterval(this.pollTimer);
    this.pollTimer = setInterval(async () => {
      if (!this.state.connected) return;
      const phase = await this.lcu.get('/lol-gameflow/v1/gameflow-phase').catch(() => null);
      if (phase != null) this.onPhase(String(phase).replace(/"/g, ''));
      if (this.state.phase === 'ChampSelect') {
        const session = await this.lcu.get('/lol-champ-select/v1/session').catch(() => null);
        if (session) this.onChampSelect(session);
      }
    }, intervalMs);
    this.pollTimer.unref?.();
  }

  onEvent(ev) {
    if (ev.uri === '/lol-champ-select/v1/session' && ev.type !== 'Delete') this.onChampSelect(ev.data);
    if (ev.uri === '/lol-gameflow/v1/gameflow-phase') this.onPhase(ev.data);
  }

  onPhase(phase) {
    if (phase === this.state.phase) return;
    this.state.phase = phase;
    if (phase === 'InProgress') this.live.start(this.liveIntervalMs);
    else {
      this.live.stop();
      if (this.state.advice) {
        this.state.advice = null;
        this.lastAdviceKey = null;
      }
    }
    if (phase === 'ChampSelect') this.log('info', 'Champ select started — pick the enemy top laner');
    this.publish();
  }

  onChampSelect(session) {
    if (!session?.theirTeam) return;
    const enemies = session.theirTeam
      .filter(p => p.championId > 0)
      .map(p => {
        const champ = this.gd.champById(p.championId);
        const name = champ?.name || `#${p.championId}`;
        const matchup = this.bible.find(name);
        return { championId: p.championId, name, hasWriteup: !!matchup, portrait: matchup?.portrait || null };
      });
    const changed = JSON.stringify(enemies) !== JSON.stringify(this.state.enemies);
    this.state.enemies = enemies;
    if (changed) this.publish();
  }

  async pick(name) {
    const matchup = this.bible.find(name);
    if (!matchup) {
      this.log('warn', `${name} — the Bible has no writeup for this champion`);
      return;
    }
    this.state.picked = name;
    this.state.overlayMatchup = matchup;
    this.log('info', `Picked ${matchup.name} (${matchup.ratings?.overall ?? '?'}/5)`);

    const t = this.state.toggles;
    if (!this.state.connected) {
      this.log('warn', 'Not connected to the client — overlay only');
      this.publish();
      return;
    }
    if (t.runes) {
      try {
        const page = await pushRunes(this.lcu, this.gd, matchup);
        this.log('ok', `Runes set: ${page.selectedPerkIds.length} perks pushed`);
        if (page.freedPages?.length) {
          this.log('info', `Pages were full — deleted "${page.freedPages.join('", "')}" to make room`);
        }
      } catch (err) {
        this.log('error', `Runes: ${err.message}`);
      }
    }
    if (t.items && this.summonerId == null) {
      this.log('warn', 'Items: no summoner id from the client yet');
    }
    if (t.items && this.summonerId != null) {
      try {
        const r = await pushItemSet(this.lcu, this.gd, matchup, this.summonerId);
        this.log('ok', `Item set saved (${r.blocks} rows)`);
        if (r.unresolved.length) this.log('warn', `Not in the shop catalog: ${r.unresolved.join(', ')}`);
      } catch (err) {
        this.log('error', `Items: ${err.message}`);
      }
    }
    if (t.summoners && this.state.phase !== 'ChampSelect') {
      this.log('warn', 'Summoners: only settable during champ select');
    } else if (t.summoners) {
      try {
        const r = await pushSummoners(this.lcu, this.gd, matchup, this.state.flashKey);
        this.log('ok', `Summoners set: ${r.spell1} on D, ${r.spell2} on F`);
      } catch (err) {
        this.log('error', `Summoners: ${err.message}`);
      }
    }
    this.publish();
  }

  stop() {
    if (this.pollTimer) clearInterval(this.pollTimer);
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.watcher.stop();
    this.live.stop();
    this.lcu?.close();
  }
}

module.exports = { Companion };
