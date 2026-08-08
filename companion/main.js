const { app, BrowserWindow, Tray, Menu, globalShortcut, ipcMain, nativeImage } = require('electron');
const path = require('path');
const { Companion } = require('./core/app');

const REPO = app.isPackaged
  ? path.join(process.resourcesPath, 'bible')
  : path.resolve(__dirname, '..');
const SMOKE = process.argv.includes('--mb-smoke');
const PRELOAD = {
  preload: path.join(__dirname, 'preload.js'),
  sandbox: false,
  additionalArguments: ['--mb-root=' + REPO],
};
let companion, picker, overlay, tray;
let lastPhase = null, lastOverlayName = null;

function createPicker() {
  picker = new BrowserWindow({
    width: 400, height: 560,
    title: 'Mordekaiser Bible',
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
  overlay = new BrowserWindow({
    width: 336, height: 500,
    frame: false, transparent: true, resizable: false,
    alwaysOnTop: true, skipTaskbar: true, hasShadow: false,
    webPreferences: PRELOAD,
  });
  overlay.setAlwaysOnTop(true, 'screen-saver');
  overlay.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  overlay.loadFile(path.join(__dirname, 'ui/overlay.html'));
  overlay.hide();
}

function showOverlay(show) {
  if (!overlay) return;
  if (show && companion.state.toggles.overlay) overlay.showInactive();
  else overlay.hide();
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
      { type: 'separator' },
      { label: 'Quit', click: () => { app.isQuitting = true; app.quit(); } },
    ]));
  };
  rebuild();
  companion.on('state', rebuild);
}

async function startSmoke() {
  const os = require('os');
  const fs = require('fs');
  const { startMock, startMockLive } = require('./mock/mock-lcu');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mb-smoke-'));
  const mock = await startMock({ dir: tmp });
  const live = await startMockLive();
  process.env.MB_LIVE_URL = live.url;
  companion = new Companion({ repoRoot: REPO, configDir: tmp, lockfilePaths: [mock.lockfile] });
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

  companion.on('state', broadcast);
  companion.start();

  companion.on('state', s => {
    if (s.phase !== lastPhase) {
      lastPhase = s.phase;
      if (s.phase === 'ChampSelect' && picker && !picker.isVisible()) picker.show();
    }
    const name = s.overlay?.name || null;
    if (name && name !== lastOverlayName) {
      lastOverlayName = name;
      showOverlay(true);
    }
  });

  ipcMain.on('ready', broadcast);
  ipcMain.on('pick', (_e, name) => companion.pick(name));
  ipcMain.on('toggle', (_e, k, v) => companion.setToggle(k, v));
  ipcMain.on('overlay-hide', () => overlay.hide());
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
