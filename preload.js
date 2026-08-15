import { contextBridge, ipcRenderer } from 'electron';

// Expose safe desktop APIs to window
contextBridge.exposeInMainWorld('electronAPI', {
  appVersion: '1.0.0',
  platform: process.platform,
  isElectron: true,
  triggerDictation: () => ipcRenderer.invoke('trigger-dictation'),
  transcribeAudio: (arrayBuffer, mimeType) => ipcRenderer.invoke('transcribe-audio', arrayBuffer, mimeType),
  openExternalUrl: (url) => ipcRenderer.invoke('open-external-url', url),
  getAuthCallbackUrl: () => ipcRenderer.invoke('get-auth-callback-url'),
  startGoogleOAuth: (options) => ipcRenderer.invoke('start-google-oauth', options),
  onGoogleAuthSuccess: (callback) => ipcRenderer.on('google-auth-callback', (event, data) => callback(data)),
  sendDesktopNotification: (payload) => ipcRenderer.invoke('send-desktop-notification', payload),
  promptTouchID: () => ipcRenderer.invoke('prompt-touch-id'),
  onOpenQuickAdd: (callback) => ipcRenderer.on('open-quick-add', () => callback())
});
