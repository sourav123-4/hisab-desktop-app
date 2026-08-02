import { contextBridge, ipcRenderer } from 'electron';

// Expose safe desktop APIs to window
contextBridge.exposeInMainWorld('electronAPI', {
  appVersion: '1.0.0',
  platform: process.platform,
  isElectron: true,
  triggerDictation: () => ipcRenderer.invoke('trigger-dictation'),
  transcribeAudio: (arrayBuffer, mimeType) => ipcRenderer.invoke('transcribe-audio', arrayBuffer, mimeType)
});
