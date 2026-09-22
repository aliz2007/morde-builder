const https = require('https');
const http = require('http');
const { EventEmitter } = require('events');

const DEFAULT_URL = 'https://127.0.0.1:2999';

class LiveClient extends EventEmitter {
  constructor(baseUrl = process.env.MB_LIVE_URL || DEFAULT_URL) {
    super();
    this.base = new URL(baseUrl);
    this.timer = null;
    this.topLaner = null;
    this.inGame = false;
    this.lastState = null;
  }

  fetch(path) {
    const mod = this.base.protocol === 'http:' ? http : https;
    return new Promise((resolve, reject) => {
      const req = mod.get({
        host: this.base.hostname,
        port: this.base.port,
        path,
        rejectUnauthorized: false,
        timeout: 2000,
      }, res => {
        let data = '';
        res.on('data', c => { data += c; });
        res.on('end', () => {
          try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
        });
      });
      req.on('error', reject);
      req.on('timeout', () => req.destroy(new Error('timeout')));
    });
  }

  async poll() {
    let all;
    try {
      all = await this.fetch('/liveclientdata/allgamedata');
    } catch {
      if (this.inGame) {
        this.inGame = false;
        this.topLaner = null;
        this.lastState = null;
        this.emit('game-end');
      }
      return;
    }
    if (!all?.allPlayers?.length) return;
    if (!this.inGame) { this.inGame = true; this.emit('game-start'); }
    const meId = all.activePlayer?.riotId ?? all.activePlayer?.summonerName;
    const me = all.allPlayers.find(p => p.riotId === meId || p.summonerName === meId);
    if (!me) return;
    const top = all.allPlayers.find(p => p.team !== me.team && String(p.position).toUpperCase() === 'TOP');
    const name = top?.championName || null;
    if (name && name !== this.topLaner) {
      this.topLaner = name;
      this.emit('top-laner', name);
    }

    // Slim game state for the item advisor: who is fed, what they built.
    const slim = p => ({
      championName: p.championName,
      position: p.position,
      level: p.level,
      kills: p.scores?.kills ?? 0,
      deaths: p.scores?.deaths ?? 0,
      assists: p.scores?.assists ?? 0,
      cs: p.scores?.creepScore ?? 0,
      items: (p.items || []).map(i => ({ id: i.itemID, price: i.price ?? 0 })),
    });
    const state = {
      gameTime: all.gameData?.gameTime ?? 0,
      me: { ...slim(me), currentGold: Math.round(all.activePlayer?.currentGold ?? 0) },
      enemies: all.allPlayers.filter(p => p.team !== me.team).map(slim),
      allies: all.allPlayers.filter(p => p.team === me.team && p !== me).map(slim),
    };
    const key = JSON.stringify(state);
    if (key !== this.lastState) {
      this.lastState = key;
      this.emit('game-state', state);
    }
  }

  start(intervalMs = 5000) {
    this.poll();
    this.timer = setInterval(() => this.poll(), intervalMs);
    this.timer.unref?.();
    return this;
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.lastState = null;
  }
}

module.exports = { LiveClient };
