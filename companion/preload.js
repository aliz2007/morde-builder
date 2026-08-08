const { contextBridge, ipcRenderer } = require('electron');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');

contextBridge.exposeInMainWorld('mb', {
  onState: cb => ipcRenderer.on('state', (_e, s) => cb(s)),
  ready: () => ipcRenderer.send('ready'),
  pick: name => ipcRenderer.send('pick', name),
  setToggle: (key, value) => ipcRenderer.send('toggle', key, value),
  overlayHide: () => ipcRenderer.send('overlay-hide'),
  overlayClickThrough: on => ipcRenderer.send('overlay-clickthrough', on),
  assetUrl: file => 'file://' + path.join(repoRoot, 'assets/img', file),
});
