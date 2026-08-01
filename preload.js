import { contextBridge } from 'electron';

// Expose safe desktop APIs to window
contextBridge.exposeInMainWorld('electronAPI', {
  appVersion: '1.0.0',
  platform: process.platform
});
