const fs = require('fs');
const path = require('path');
const os = require('os');
const { EventEmitter } = require('events');

const CANDIDATES = [
  process.env.MB_LOCKFILE,
  '/Applications/League of Legends.app/Contents/LoL/lockfile',
  'C:/Riot Games/League of Legends/lockfile',
  'D:/Riot Games/League of Legends/lockfile',
  'C:/Program Files/Riot Games/League of Legends/lockfile',
  path.join(os.homedir(), 'Riot Games/League of Legends/lockfile'),
].filter(Boolean);

function parse(text) {
  const [name, pid, port, password, protocol] = text.trim().split(':');
  if (!port || !password) return null;
  return { name, pid: Number(pid), port: Number(port), password, protocol: protocol || 'https' };
}

class LockfileWatcher extends EventEmitter {
  constructor(extraPaths = []) {
    super();
    this.paths = [...extraPaths, ...CANDIDATES];
    this.current = null;
    this.timer = null;
  }

  start(intervalMs = 2000) {
    const scan = () => {
      for (const p of this.paths) {
        try {
          const creds = parse(fs.readFileSync(p, 'utf8'));
          if (creds) {
            if (!this.current || this.current.port !== creds.port || this.current.password !== creds.password) {
              this.current = creds;
              this.emit('found', creds);
            }
            return;
          }
        } catch { /* not there yet */ }
      }
      if (this.current) {
        this.current = null;
        this.emit('lost');
      }
    };
    scan();
    this.timer = setInterval(scan, intervalMs);
    this.timer.unref?.();
    return this;
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
}

module.exports = { LockfileWatcher, parse };
