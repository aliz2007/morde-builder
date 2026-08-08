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
      if (this.inGame) { this.inGame = false; this.topLaner = null; this.emit('game-end'); }
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
  }
}

module.exports = { LiveClient };
