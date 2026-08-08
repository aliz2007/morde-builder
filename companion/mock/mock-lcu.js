const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');
const fixtures = require('./fixtures');

const PASSWORD = 'mock-secret';

function startMock({ dir }) {
  const recorded = { runePosts: [], runeDeletes: [], itemSetPuts: [], selectionPatches: [] };
  let runePages = [
    { id: 1, name: 'Default page', isDeletable: true },
  ];
  let nextPageId = 100;
  let itemSets = { accountId: 777, timestamp: 0, itemSets: [{ title: 'My old set', blocks: [] }] };
  let phase = 'None';
  let session = null;
  const sockets = new Set();

  const routes = {
    'GET /lol-game-data/assets/v1/perkstyles.json': () => ({ schemaVersion: 2, styles: fixtures.styles }),
    'GET /lol-game-data/assets/v1/perks.json': () => fixtures.perks,
    'GET /lol-game-data/assets/v1/items.json': () => fixtures.items,
    'GET /lol-game-data/assets/v1/summoner-spells.json': () => fixtures.spells,
    'GET /lol-game-data/assets/v1/champion-summary.json': () => fixtures.champions,
    'GET /lol-summoner/v1/current-summoner': () => ({ summonerId: 777, displayName: 'MockPlayer' }),
    'GET /lol-gameflow/v1/gameflow-phase': () => phase,
    'GET /lol-champ-select/v1/session': () => session || { httpStatus: 404 },
    'GET /lol-perks/v1/pages': () => runePages,
    'POST /lol-perks/v1/pages': body => {
      const page = { ...body, id: nextPageId++ };
      runePages.push(page);
      recorded.runePosts.push(page);
      return page;
    },
    'GET /lol-item-sets/v1/item-sets/777/sets': () => itemSets,
    'PUT /lol-item-sets/v1/item-sets/777/sets': body => {
      itemSets = body;
      recorded.itemSetPuts.push(body);
      return null;
    },
    'PATCH /lol-champ-select/v1/session/my-selection': body => {
      recorded.selectionPatches.push(body);
      return null;
    },
  };

  const server = http.createServer((req, res) => {
    const auth = req.headers.authorization || '';
    const expected = 'Basic ' + Buffer.from(`riot:${PASSWORD}`).toString('base64');
    if (auth !== expected) {
      res.writeHead(401); return res.end('unauthorized');
    }
    let body = '';
    req.on('data', c => { body += c; });
    req.on('end', () => {
      const delMatch = req.method === 'DELETE' && req.url.match(/^\/lol-perks\/v1\/pages\/(\d+)$/);
      if (delMatch) {
        const id = Number(delMatch[1]);
        runePages = runePages.filter(p => p.id !== id);
        recorded.runeDeletes.push(id);
        res.writeHead(204); return res.end();
      }
      const handler = routes[`${req.method} ${req.url}`];
      if (!handler) { res.writeHead(404); return res.end('{}'); }
      const out = handler(body ? JSON.parse(body) : undefined);
      if (out && out.httpStatus === 404) { res.writeHead(404); return res.end('{}'); }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(out === null ? '' : JSON.stringify(out));
    });
  });

  const wss = new WebSocketServer({ server });
  wss.on('connection', ws => {
    sockets.add(ws);
    ws.on('close', () => sockets.delete(ws));
    ws.on('message', () => {});
  });

  const broadcast = (name, uri, data) => {
    const msg = JSON.stringify([8, name, { uri, eventType: 'Update', data }]);
    for (const ws of sockets) ws.send(msg);
  };

  return new Promise(resolve => {
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      const lockfile = path.join(dir, 'lockfile');
      fs.writeFileSync(lockfile, `MockClient:999:${port}:${PASSWORD}:http`);
      resolve({
        port,
        lockfile,
        recorded,
        get runePages() { return runePages; },
        get itemSets() { return itemSets; },
        setPhase(p) {
          phase = p;
          broadcast('OnJsonApiEvent_lol-gameflow_v1_gameflow-phase', '/lol-gameflow/v1/gameflow-phase', p);
        },
        setChampSelect(s) {
          session = s;
          broadcast('OnJsonApiEvent_lol-champ-select_v1_session', '/lol-champ-select/v1/session', s);
        },
        close() {
          for (const ws of sockets) ws.close();
          server.close();
          fs.rmSync(lockfile, { force: true });
        },
      });
    });
  });
}

function startMockLive() {
  let game = null;
  const server = http.createServer((req, res) => {
    if (req.url !== '/liveclientdata/allgamedata' || !game) {
      res.writeHead(404); return res.end();
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(game));
  });
  return new Promise(resolve => {
    server.listen(0, '127.0.0.1', () => {
      resolve({
        url: `http://127.0.0.1:${server.address().port}`,
        setGame(g) { game = g; },
        close() { server.close(); },
      });
    });
  });
}

module.exports = { startMock, startMockLive, PASSWORD };
