import { app, BrowserWindow, nativeImage, session, systemPreferences, ipcMain } from 'electron';
import { exec } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env file automatically into process.env
try {
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, 'utf8');
    envConfig.split(/\r?\n/).forEach(line => {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let value = match[2] || '';
        if (value.length > 0 && value.startsWith('"') && value.endsWith('"')) {
          value = value.substring(1, value.length - 1);
        }
        if (!process.env[key]) {
          process.env[key] = value.trim();
        }
      }
    });
  }
} catch (e) {
  console.warn('Could not load .env file in main process:', e);
}

// Enable hardware audio & media access switches
app.commandLine.appendSwitch('enable-speech-dispatcher');

ipcMain.handle('trigger-dictation', async () => {
  return new Promise((resolve) => {
    if (process.platform === 'darwin') {
      exec("osascript -e 'tell application \"System Events\" to key code 63'", (err) => {
        resolve(!err);
      });
    } else if (process.platform === 'win32') {
      exec("powershell -Command \"$wshell = New-Object -ComObject wscript.shell; $wshell.SendKeys('#h')\"", (err) => {
        resolve(!err);
      });
    } else {
      resolve(false);
    }
  });
});

ipcMain.handle('transcribe-audio', async (event, arrayBuffer, mimeType) => {
  const GROQ_URL = 'https://api.groq.com/openai/v1/audio/transcriptions';
  const GROQ_KEY = process.env.GROQ_API_KEY;

  if (!GROQ_KEY) {
    console.warn('GROQ_API_KEY not set in .env');
    return { success: false, error: 'GROQ_API_KEY is not defined in .env file' };
  }

  // Extension map — Groq infers format from filename extension
  const EXT_BY_MIME = {
    'audio/webm': 'webm',
    'audio/ogg': 'ogg',
    'audio/mp4': 'mp4',
    'audio/mpeg': 'mp3',
    'audio/wav': 'wav',
    'audio/x-wav': 'wav',
    'audio/flac': 'flac',
  };

  const MIN_BYTES = 2000;

  try {
    const buffer = Buffer.from(arrayBuffer);
    if (!buffer || buffer.length < MIN_BYTES) {
      return { success: false, error: "Recording too short — didn't hear anything." };
    }

    const baseMime = String(mimeType || 'audio/wav').split(';')[0].trim();
    const ext = EXT_BY_MIME[baseMime] || 'wav';

    const form = new FormData();
    form.append('file', new Blob([buffer], { type: baseMime }), `audio.${ext}`);
    form.append('model', 'whisper-large-v3-turbo');
    form.append('response_format', 'json');
    form.append('temperature', '0');

    let res;
    try {
      res = await fetch(GROQ_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${GROQ_KEY}` },
        body: form,
        signal: AbortSignal.timeout(20000),
      });
    } catch (err) {
      if (err.name === 'TimeoutError') {
        return { success: false, error: 'Transcription timed out — try again.' };
      }
      return { success: false, error: 'Cannot reach Groq — check your internet.' };
    }

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      console.error(`[STT Groq Error] ${res.status}: ${detail.slice(0, 500)}`);
      if (res.status === 401) return { success: false, error: 'Invalid Groq API key.' };
      if (res.status === 429) return { success: false, error: 'Rate limited — wait a moment.' };
      return { success: false, error: `Transcription failed (HTTP ${res.status})` };
    }

    const data = await res.json();
    let transcript = String(data.text || '').trim();
    if (!transcript) {
      return { success: false, error: "Didn't hear anything — speak louder or closer." };
    }
    // Convert dollar symbols & USD to Rupees (₹)
    transcript = transcript
      .replace(/\$/g, '₹')
      .replace(/\b(?:USD|dollars?|dollar)\b/gi, 'rupees');

    return { success: true, text: transcript };
  } catch (err) {
    console.error('[Transcribe Audio Error]', err.message);
    return { success: false, error: err.message };
  }
});

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
      preload: path.join(__dirname, 'preload.cjs'),
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
