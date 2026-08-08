const { contextBridge, ipcRenderer } = require('electron');
const path = require('path');
const { pathToFileURL } = require('url');

const rootArg = process.argv.find(a => a.startsWith('--mb-root='));
const repoRoot = rootArg ? rootArg.slice('--mb-root='.length) : path.resolve(__dirname, '..');

contextBridge.exposeInMainWorld('mb', {
  onState: cb => ipcRenderer.on('state', (_e, s) => cb(s)),
  ready: () => ipcRenderer.send('ready'),
  pick: name => ipcRenderer.send('pick', name),
  setToggle: (key, value) => ipcRenderer.send('toggle', key, value),
  overlayHide: () => ipcRenderer.send('overlay-hide'),
  overlayClickThrough: on => ipcRenderer.send('overlay-clickthrough', on),
  overlaySolid: () => ipcRenderer.send('overlay-solid'),
  pickerMin: () => ipcRenderer.send('picker-min'),
  pickerClose: () => ipcRenderer.send('picker-close'),
  assetUrl: file => pathToFileURL(path.join(repoRoot, 'assets/img', file)).href,
});
