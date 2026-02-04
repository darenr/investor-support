const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  onFileLoaded: (callback) => ipcRenderer.on('file:loaded', callback),
  onMenuAnalyze: (callback) => ipcRenderer.on('menu:analyze', callback),
  askAI: (question) => ipcRenderer.invoke('ai:ask', question),
  runTask: (taskType) => ipcRenderer.invoke('ai:task', taskType)
});
