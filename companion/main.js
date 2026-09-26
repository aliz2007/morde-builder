const { app, BrowserWindow, Tray, Menu, globalShortcut, ipcMain, nativeImage, dialog } = require('electron');
const path = require('path');
const { Companion } = require('./core/app');

const REPO = app.isPackaged
  ? path.join(process.resourcesPath, 'bible')
  : path.resolve(__dirname, '..');
const SMOKE = process.argv.includes('--mb-smoke');

// Auto-update from GitHub Releases: downloads in the background, installs on
// quit (or on the spot if the user says so). Packaged builds only — in dev
// there is no app-update.yml to read.
function setupAutoUpdater() {
  if (!app.isPackaged || SMOKE) return;
  const { autoUpdater } = require('electron-updater');
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on('update-downloaded', info => {
    companion?.log('ok', `Update ${info.version} downloaded — it installs when you quit`);
    dialog.showMessageBox({
      type: 'info',
      title: 'Update ready',
      message: `Mordekaiser Bible Companion ${info.version} is downloaded.`,
      detail: 'Restart the app now to update, or it will update itself next time you quit.',
      buttons: ['Restart now', 'Later'],
      defaultId: 1,
    }).then(r => { if (r.response === 0) { app.isQuitting = true; autoUpdater.quitAndInstall(); } });
  });
  autoUpdater.on('error', err => companion?.log('warn', `Auto-update: ${err.message}`));
  const check = () => autoUpdater.checkForUpdates().catch(() => {});
  check();
  setInterval(check, 30 * 60 * 1000).unref?.();
}
const PRELOAD = {
  preload: path.join(__dirname, 'preload.js'),
  sandbox: false,
  additionalArguments: ['--mb-root=' + REPO],
};
let companion, picker, overlay, tray;
let lastPhase = null, lastOverlayName = null;

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (picker) { picker.show(); picker.focus(); }
  });
}

function createPicker() {
  picker = new BrowserWindow({
    width: 408, height: 596,
    title: 'Mordekaiser Bible',
    frame: false,
    backgroundColor: '#080B0B',
    icon: path.join(__dirname, 'build/icon-256.png'),
    webPreferences: PRELOAD,
  });
  picker.removeMenu?.();
  picker.loadFile(path.join(__dirname, 'ui/picker.html'));
  picker.on('close', e => {
    if (!app.isQuitting) { e.preventDefault(); picker.hide(); }
  });
}

function createOverlay() {
  const saved = companion.overlayBounds || {};
  overlay = new BrowserWindow({
    width: saved.width || 336, height: saved.height || 500,
    x: saved.x, y: saved.y,
    minWidth: 190, minHeight: 120,
    frame: false, transparent: true, resizable: true,
    alwaysOnTop: true, skipTaskbar: true, hasShadow: false,
    webPreferences: PRELOAD,
  });
  overlay.setAlwaysOnTop(true, 'screen-saver');
  overlay.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  overlay.loadFile(path.join(__dirname, 'ui/overlay.html'));
  overlay.hide();

  let boundsTimer = null;
  const persistBounds = () => {
    if (overlay && !overlay.isDestroyed() && overlay.isVisible()) {
      companion.saveOverlayBounds(overlay.getBounds());
    }
  };
  overlay.on('resize', () => {
    clearTimeout(boundsTimer);
    boundsTimer = setTimeout(persistBounds, 400);
  });
  overlay.on('move', () => {
    clearTimeout(boundsTimer);
    boundsTimer = setTimeout(persistBounds, 400);
  });
}

function showOverlay(show) {
  if (!overlay) return;
  if (show && companion.state.toggles.overlay) {
    // Re-assert topmost at the highest window level — after a game grabs
    // focus, borderless windows can silently drop below it in z-order.
    overlay.setAlwaysOnTop(true, 'screen-saver');
    overlay.showInactive();
    overlay.moveTop();
  } else overlay.hide();
}

function broadcast() {
  const snap = companion.snapshot();
  for (const w of [picker, overlay]) {
    if (w && !w.isDestroyed()) w.webContents.send('state', snap);
  }
  if (tray) tray.setToolTip(`Mordekaiser Bible — ${snap.connected ? (snap.phase || 'connected') : 'waiting for client'}`);
}

function createTray() {
  const icon = nativeImage.createFromPath(path.join(__dirname, 'build/tray.png'));
  tray = new Tray(icon.isEmpty() ? nativeImage.createEmpty() : icon);
  const rebuild = () => {
    const t = companion.state.toggles;
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: 'Open picker', click: () => picker.show() },
      { label: 'Toggle overlay', accelerator: 'CommandOrControl+Shift+M', click: () => showOverlay(!overlay.isVisible()) },
      { type: 'separator' },
      { label: 'Push runes', type: 'checkbox', checked: t.runes, click: i => companion.setToggle('runes', i.checked) },
      { label: 'Save item set', type: 'checkbox', checked: t.items, click: i => companion.setToggle('items', i.checked) },
      { label: 'Set summoners', type: 'checkbox', checked: t.summoners, click: i => companion.setToggle('summoners', i.checked) },
      { label: 'Overlay enabled', type: 'checkbox', checked: t.overlay, click: i => companion.setToggle('overlay', i.checked) },
      { label: 'Live item advice', type: 'checkbox', checked: t.advisor, click: i => companion.setToggle('advisor', i.checked) },
      { label: 'Flash key', submenu: ['D', 'F'].map(k => ({
        label: `Flash on ${k}`, type: 'radio', checked: companion.state.flashKey === k,
        click: () => companion.setFlashKey(k),
      })) },
      { type: 'separator' },
      { label: 'Quit', click: () => { app.isQuitting = true; app.quit(); } },
    ]));
  };
  rebuild();
  companion.on('state', rebuild);
  // left-click (Windows/Linux) opens the picker — the tray icon can end up in
  // the overflow chevron, so this must be an obvious way back to the app
  tray.on('click', () => { picker.show(); picker.focus(); });
}

async function startSmoke() {
  const os = require('os');
  const fs = require('fs');
  const { startMock, startMockLive } = require('./mock/mock-lcu');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mb-smoke-'));
  const mock = await startMock({ dir: tmp });
  const live = await startMockLive();
  process.env.MB_LIVE_URL = live.url;
  companion = new Companion({ repoRoot: REPO, configDir: tmp, lockfilePaths: [mock.lockfile], liveIntervalMs: 400 });
  companion.live.base = new URL(live.url);
  companion.state.toggles.summoners = true;
  return { mock, live };
}

app.whenReady().then(async () => {
  let smoke = null;
  if (SMOKE) {
    smoke = await startSmoke();
  } else {
    companion = new Companion({
      repoRoot: REPO,
      configDir: app.getPath('userData'),
    });
  }

  createPicker();
  createOverlay();
  createTray();
  setupAutoUpdater();

  companion.on('state', broadcast);
  companion.start();

  companion.on('state', s => {
    if (s.phase !== lastPhase) {
      lastPhase = s.phase;
      if (s.phase === 'ChampSelect' && picker && !picker.isVisible()) picker.show();
      // Game just launched: re-pin the overlay above a borderless game window
      // (exclusive fullscreen hides every external overlay — borderless only).
      if (s.phase === 'InProgress' && overlay && !overlay.isDestroyed() && overlay.isVisible()) {
        overlay.setAlwaysOnTop(true, 'screen-saver');
        overlay.moveTop();
      }
    }
    const name = s.overlay?.name || null;
    if (name && name !== lastOverlayName) {
      lastOverlayName = name;
      showOverlay(true);
    }
  });

  ipcMain.on('ready', broadcast);
  ipcMain.on('pick', (_e, name) => companion.pick(name));
  ipcMain.on('toggle', (_e, k, v) => {
    companion.setToggle(k, v);
    // the picker's "Overlay enabled" checkbox is also the recovery path when
    // the overlay was hidden with its hide button — flipping it brings it back
    if (k === 'overlay') showOverlay(!!v);
  });
  ipcMain.on('section', (_e, k) => companion.setOverlayFocus(k));
  ipcMain.on('flash-key', (_e, k) => companion.setFlashKey(k));
  ipcMain.on('overlay-hide', () => overlay.hide());
  let resizeStart = null;
  ipcMain.on('overlay-resize-start', () => {
    if (overlay && !overlay.isDestroyed()) resizeStart = overlay.getBounds();
  });
  ipcMain.on('overlay-resize-to', (_e, edge, sx, sy) => {
    if (!overlay || overlay.isDestroyed() || !resizeStart) return;
    if (!/^(n|s|e|w|ne|nw|se|sw)$/.test(edge)) return;
    const b = resizeStart;
    let x = b.x, y = b.y, width = b.width, height = b.height;
    if (edge.includes('e')) width = sx - b.x;
    if (edge.includes('w')) width = b.x + b.width - sx;
    if (edge.includes('s')) height = sy - b.y;
    if (edge.includes('n')) height = b.y + b.height - sy;
    width = Math.max(190, Math.round(width));
    height = Math.max(120, Math.round(height));
    // anchor the opposite side when dragging the west/north edges
    if (edge.includes('w')) x = b.x + b.width - width;
    if (edge.includes('n')) y = b.y + b.height - height;
    overlay.setBounds({ x, y, width, height });
  });
  ipcMain.on('picker-min', () => picker.minimize());
  ipcMain.on('picker-close', () => picker.hide());
  ipcMain.on('overlay-clickthrough', (_e, on) => overlay.setIgnoreMouseEvents(on, { forward: true }));
  ipcMain.on('overlay-solid', () => overlay.setIgnoreMouseEvents(false));

  globalShortcut.register('CommandOrControl+Shift+M', () => showOverlay(!overlay.isVisible()));

  if (SMOKE) {
    const { mock } = smoke;
    setTimeout(async () => {
      mock.setPhase('ChampSelect');
      mock.setChampSelect({
        localPlayerCellId: 0,
        myTeam: [{ cellId: 0, championId: 82 }],
        theirTeam: [
          { cellId: 5, championId: 266 }, { cellId: 6, championId: 122 },
          { cellId: 7, championId: 145 }, { cellId: 8, championId: 62 },
        ],
      });
      await new Promise(r => setTimeout(r, 800));
      await companion.pick('Aatrox');
      overlay.show();
      await new Promise(r => setTimeout(r, 1200));
      const out = process.env.MB_SMOKE_OUT || require('os').tmpdir();
      console.log('smoke shots ->', out);
      const shot = async (win, name) => {
        const img = await win.webContents.capturePage();
        require('fs').writeFileSync(path.join(out, name), img.toPNG());
      };
      await shot(picker, 'smoke-picker.png');
      await shot(overlay, 'smoke-overlay.png');

      // interaction checks: the section selector and edge/corner resizing
      const before = overlay.getBounds();
      const seX = before.x + before.width + 120, seY = before.y + before.height + 70;
      const checks = await overlay.webContents.executeJavaScript(`(() => {
        const out = {};
        const sel = document.querySelector('#focus');
        out.selectorOptions = [...sel.options].map(o => o.value);
        sel.value = 'trade';
        sel.dispatchEvent(new Event('change'));
        const h = document.querySelector('[data-edge="se"]');
        h.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, screenX: ${before.x + before.width - 4}, screenY: ${before.y + before.height - 4}, pointerId: 1 }));
        h.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, screenX: ${seX}, screenY: ${seY}, pointerId: 1 }));
        h.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 1 }));
        return out;
      })()`);
      await new Promise(r => setTimeout(r, 400));
      const after = overlay.getBounds();
      checks.resizeSent = [before.width, before.height, '->', after.width, after.height];
      checks.resized = after.width >= before.width + 100 && after.height >= before.height + 60;

      // west edge: dragging it left grows the width while the right edge stays put
      const wX = after.x - 60;
      await overlay.webContents.executeJavaScript(`(() => {
        const h = document.querySelector('[data-edge="w"]');
        h.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, screenX: ${after.x + 2}, screenY: ${after.y + 60}, pointerId: 2 }));
        h.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, screenX: ${wX}, screenY: ${after.y + 60}, pointerId: 2 }));
        h.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 2 }));
      })()`);
      await new Promise(r => setTimeout(r, 400));
      const afterW = overlay.getBounds();
      checks.westResize = [after.x, after.width, '->', afterW.x, afterW.width];
      checks.westResized = afterW.width >= after.width + 50
        && Math.abs(afterW.x + afterW.width - (after.x + after.width)) <= 2
        && Math.abs(afterW.height - after.height) <= 2;
      checks.onlyTradeShown = await overlay.webContents.executeJavaScript(`(() => {
        const txt = document.querySelector('#tipsWrap').textContent;
        return {
          tipsWrapHasTrade: txt.includes('How to trade'),
          buildsHidden: document.querySelector('#builds').classList.contains('hidden'),
          summsHidden: document.querySelector('#summsWrap').classList.contains('hidden'),
          selectorValue: document.querySelector('#focus').value,
        };
      })()`);
      checks.focusPersisted = companion.state.overlayFocus === 'trade';
      await shot(overlay, 'smoke-overlay-trade.png');

      // live advisor: go in game with an unbuilt core -> "finish your core"
      mock.setPhase('InProgress');
      const mk = (name, pos, team, items = []) => ({
        championName: name, position: pos, team, level: 11,
        scores: { kills: 0, deaths: 0, assists: 0, creepScore: 100 },
        riotId: name, summonerName: name,
        items: items.map(id => ({ itemID: id, price: 0 })),
      });
      smoke.live.setGame({
        activePlayer: { riotId: 'me', summonerName: 'me', currentGold: 1375 },
        gameData: { gameTime: 900 },
        allPlayers: [
          { ...mk('Mordekaiser', 'TOP', 'ORDER'), riotId: 'me', summonerName: 'me' },
          mk('Ahri', 'MIDDLE', 'ORDER'),
          mk('Aatrox', 'TOP', 'CHAOS', [4633]),
          mk('Dr. Mundo', 'JUNGLE', 'CHAOS'),
          mk('Jinx', 'BOTTOM', 'CHAOS'),
          mk('Lux', 'UTILITY', 'CHAOS'),
        ],
      });
      await new Promise(r => setTimeout(r, 1600));
      await overlay.webContents.executeJavaScript(`(() => {
        const sel = document.querySelector('#focus');
        sel.value = 'live';
        sel.dispatchEvent(new Event('change'));
      })()`);
      await new Promise(r => setTimeout(r, 600));
      checks.adviceState = companion.state.advice
        ? { coreDone: companion.state.advice.coreDone, missing: companion.state.advice.missingCore }
        : null;
      checks.adviceDom = await overlay.webContents.executeJavaScript(`(() => {
        const wrap = document.querySelector('#liveWrap');
        return {
          visible: !wrap.classList.contains('hidden'),
          text: document.querySelector('#live').textContent.trim().slice(0, 90),
        };
      })()`);
      checks.adviceOk = !!checks.adviceState
        && checks.adviceState.coreDone === false
        && checks.adviceState.missing.length > 0
        && checks.adviceDom.visible
        && checks.adviceDom.text.includes('Finish your core');
      // gold diff badge: me (0 items + 1375 pocket) vs Aatrox (one 0g mock item)
      checks.goldBadge = await overlay.webContents.executeJavaScript(`(() => {
        const g = document.querySelector('#gold');
        return {
          visible: !g.classList.contains('hidden'),
          text: g.textContent,
          positive: g.classList.contains('pos'),
          negative: g.classList.contains('neg'),
        };
      })()`);
      checks.goldOk = checks.goldBadge.visible
        && checks.goldBadge.text === '+1.4k'
        && checks.goldBadge.positive
        && companion.state.advice?.goldDiff === 1375;
      await shot(overlay, 'smoke-overlay-live.png');

      console.log('SMOKE CHECKS', JSON.stringify(checks));
      if (!checks.resized || !checks.westResized || !checks.onlyTradeShown.tipsWrapHasTrade || !checks.onlyTradeShown.buildsHidden || !checks.focusPersisted || !checks.adviceOk || !checks.goldOk) {
        console.error('SMOKE INTERACTION FAILED');
        process.exitCode = 1;
      }
      console.log('SMOKE OK');
      app.isQuitting = true;
      app.quit();
    }, 1500);
  }
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  companion?.stop();
});

app.on('window-all-closed', e => {
  if (!app.isQuitting) e.preventDefault();
});
