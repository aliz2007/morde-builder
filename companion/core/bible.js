const fs = require('fs');
const path = require('path');
const { norm } = require('./gamedata');

class Bible {
  constructor(repoRoot) {
    this.repoRoot = repoRoot;
    this.matchups = JSON.parse(fs.readFileSync(path.join(repoRoot, 'data/matchups.json'), 'utf8'));
    this.byName = new Map();
    for (const m of this.matchups) {
      this.byName.set(norm(m.name), m);
      for (const a of m.aliases || []) this.byName.set(norm(a), m);
    }
  }

  find(name) {
    return this.byName.get(norm(name)) || null;
  }

  portraitPath(m) {
    return m?.portrait ? path.join(this.repoRoot, 'assets/img', m.portrait) : null;
  }

  overlayData(m) {
    if (!m) return null;
    const tips = [];
    for (const heading of ['What to watch out for', 'Tips', 'How to trade', 'Early Game']) {
      const s = (m.sections || []).find(x => x.heading === heading);
      if (s) tips.push({ heading, items: s.items || [] });
    }
    return {
      name: m.name,
      overall: m.ratings?.overall ?? null,
      ratings: m.ratings,
      portrait: m.portrait,
      summoners: (m.summoners || []).map(s => s.name).filter(Boolean),
      runesRaw: (m.runes?.raw || '').replace(/\s*\n\s*/g, ' '),
      builds: (m.builds || []).map(b => ({
        condition: b.condition || '',
        icons: (b.icons || []).map(i => ({ file: i.file, name: i.name || i.placeholder || '' })),
        steps: (b.steps || []).filter(s => !s.aside).map(s => ({ item: s.item, note: s.note || '' })),
      })),
      tldr: (m.tldr || []).filter(t => !/^tl;?dr section$/i.test(String(t).trim())),
      tips,
    };
  }
}

module.exports = { Bible };
