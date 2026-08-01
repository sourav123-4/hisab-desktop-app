const { contextBridge, ipcRenderer } = require('electron');

// Expose safe desktop APIs to renderer window
contextBridge.exposeInMainWorld('electronAPI', {
  appVersion: '1.0.0',
  platform: process.platform,
  triggerDictation: () => ipcRenderer.invoke('trigger-dictation'),
  transcribeAudio: (arrayBuffer, mimeType) => ipcRenderer.invoke('transcribe-audio', arrayBuffer, mimeType)
});
