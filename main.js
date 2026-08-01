import { app, BrowserWindow, nativeImage, session, systemPreferences } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Enable hardware audio & media access switches
app.commandLine.appendSwitch('enable-speech-dispatcher');

function createWindow() {
  const iconPath = path.join(__dirname, 'assets/icon.png');
  const appIcon = nativeImage.createFromPath(iconPath);

  if (process.platform === 'darwin' && app.dock) {
    try {
      app.dock.setIcon(appIcon);
    } catch (e) { }
  }

  const mainWindow = new BrowserWindow({
    title: 'Daily Hisab',
    icon: appIcon,
    width: 1100,
    height: 720,
    minWidth: 850,
    minHeight: 550,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#0f172a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false
    }
  });

  // Check if running in development mode
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist/index.html')).catch(() => {
      mainWindow.loadFile(path.join(__dirname, 'index.html'));
    });
  }
}

app.whenReady().then(async () => {
  if (process.platform === 'darwin') {
    try {
      await systemPreferences.askForMediaAccess('microphone');
    } catch (e) {}
  }

  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    callback(true);
  });
  session.defaultSession.setPermissionCheckHandler(() => true);

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
