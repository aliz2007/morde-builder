const https = require('https');
const http = require('http');
const { EventEmitter } = require('events');
const WebSocket = require('ws');

class Lcu extends EventEmitter {
  constructor({ port, password, protocol = 'https' }) {
    super();
    this.port = port;
    this.password = password;
    this.protocol = protocol;
    this.auth = 'Basic ' + Buffer.from(`riot:${password}`).toString('base64');
    this.ws = null;
  }

  request(method, path, body) {
    const mod = this.protocol === 'http' ? http : https;
    const payload = body === undefined ? null : JSON.stringify(body);
    return new Promise((resolve, reject) => {
      const req = mod.request({
        host: '127.0.0.1',
        port: this.port,
        method,
        path,
        timeout: 6000,
        rejectUnauthorized: false,
        headers: {
          Authorization: this.auth,
          Accept: 'application/json',
          ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {}),
        },
      }, res => {
        let data = '';
        res.on('data', c => { data += c; });
        res.on('end', () => {
          if (res.statusCode >= 400) {
            const err = new Error(`LCU ${method} ${path} -> ${res.statusCode} ${data.slice(0, 300)}`);
            err.status = res.statusCode;
            return reject(err);
          }
          if (!data) return resolve(null);
          try { resolve(JSON.parse(data)); } catch { resolve(data); }
        });
      });
      req.on('error', reject);
      req.on('timeout', () => req.destroy(new Error(`LCU ${method} ${path} timed out`)));
      if (payload) req.write(payload);
      req.end();
    });
  }

  get(p) { return this.request('GET', p); }
  post(p, b) { return this.request('POST', p, b); }
  put(p, b) { return this.request('PUT', p, b); }
  patch(p, b) { return this.request('PATCH', p, b); }
  del(p) { return this.request('DELETE', p); }

  connectWs(events) {
    const scheme = this.protocol === 'http' ? 'ws' : 'wss';
    const ws = new WebSocket(`${scheme}://127.0.0.1:${this.port}/`, {
      rejectUnauthorized: false,
      headers: { Authorization: this.auth },
    });
    this.ws = ws;
    ws.on('open', () => {
      for (const ev of events) ws.send(JSON.stringify([5, ev]));
      this.emit('ws-open');
    });
    ws.on('message', raw => {
      let msg;
      try { msg = JSON.parse(raw.toString()); } catch { return; }
      if (Array.isArray(msg) && msg[0] === 8 && msg[2]) {
        this.emit('event', { name: msg[1], uri: msg[2].uri, type: msg[2].eventType, data: msg[2].data });
      }
    });
    ws.on('close', () => this.emit('ws-close'));
    ws.on('error', err => this.emit('ws-error', err));
    return ws;
  }

  close() {
    this.ws?.close();
    this.ws = null;
  }
}

module.exports = { Lcu };
