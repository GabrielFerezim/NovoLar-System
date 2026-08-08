const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  readDatabase: () => ipcRenderer.invoke('db:read'),
  writeDatabase: (data) => ipcRenderer.invoke('db:write'),
  isElectron: true
});
