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

const WS_EVENTS = [
  'OnJsonApiEvent_lol-champ-select_v1_session',
  'OnJsonApiEvent_lol-gameflow_v1_gameflow-phase',
];

const DEFAULT_TOGGLES = { runes: true, items: true, summoners: false, overlay: true };

class Companion extends EventEmitter {
  constructor({ repoRoot, configDir, lockfilePaths = [] }) {
    super();
    this.repoRoot = repoRoot;
    this.configPath = path.join(configDir, 'config.json');
    this.bible = new Bible(repoRoot);
    this.gd = new GameData();
    this.lcu = null;
    this.live = new LiveClient();
    this.watcher = new LockfileWatcher(lockfilePaths);
    this.summonerId = null;
    this.pollTimer = null;
    this.state = {
      connected: false,
      phase: null,
      enemies: [],
      picked: null,
      overlayMatchup: null,
      toggles: this.loadConfig(),
      log: [],
    };
  }

  loadConfig() {
    try { return { ...DEFAULT_TOGGLES, ...JSON.parse(fs.readFileSync(this.configPath, 'utf8')) }; }
    catch { return { ...DEFAULT_TOGGLES }; }
  }

  saveConfig() {
    fs.mkdirSync(path.dirname(this.configPath), { recursive: true });
    fs.writeFileSync(this.configPath, JSON.stringify(this.state.toggles, null, 2));
  }

  setToggle(key, value) {
    if (!(key in this.state.toggles)) return;
    this.state.toggles[key] = !!value;
    this.saveConfig();
    this.publish();
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
    this.live.on('game-end', () => this.log('info', 'Game ended'));
    return this;
  }

  async connect(creds) {
    try {
      this.lcu = new Lcu(creds);
      await this.gd.load(this.lcu);
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
      this.log('error', `Could not talk to the client: ${err.message}`);
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
    if (phase === 'InProgress') this.live.start();
    else this.live.stop();
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
      } catch (err) {
        this.log('error', `Runes: ${err.message}`);
      }
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
    if (t.summoners) {
      try {
        const r = await pushSummoners(this.lcu, this.gd, matchup);
        this.log('ok', `Summoners set: ${r.spell1} + ${r.spell2}`);
      } catch (err) {
        this.log('error', `Summoners: ${err.message}`);
      }
    }
    this.publish();
  }

  stop() {
    if (this.pollTimer) clearInterval(this.pollTimer);
    this.watcher.stop();
    this.live.stop();
    this.lcu?.close();
  }
}

module.exports = { Companion };
