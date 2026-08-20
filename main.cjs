const { app, BrowserWindow, nativeImage, session, systemPreferences, ipcMain, shell, Notification, Tray, Menu, safeStorage } = require('electron');
const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs');
const http = require('http');
const { createHash, randomBytes } = require('crypto');
const electronUpdater = require('electron-updater');
let autoUpdater = null;

// Load .env file automatically into process.env
try {
  const possibleEnvPaths = [
    path.join(__dirname, '.env'),
    path.join(process.cwd(), '.env'),
  ];
  if (app && typeof app.getAppPath === 'function') {
    possibleEnvPaths.push(path.join(app.getAppPath(), '.env'));
  }
  for (const envPath of possibleEnvPaths) {
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
      break;
    }
  }
} catch (e) {
  console.warn('Could not load .env file in main process:', e);
}

// Enable hardware audio & media access switches
app.commandLine.appendSwitch('enable-speech-dispatcher');

function getVoiceConfigPath() {
  return path.join(app.getPath('userData'), 'voice-transcription.json');
}

function encryptSecret(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  try {
    if (safeStorage && safeStorage.isEncryptionAvailable()) {
      return {
        encoding: 'safeStorage',
        value: safeStorage.encryptString(raw).toString('base64')
      };
    }
  } catch (err) {
    console.warn('[Voice Config] Secure storage unavailable:', err.message);
  }
  return {
    encoding: 'base64',
    value: Buffer.from(raw, 'utf8').toString('base64')
  };
}

function decryptSecret(payload) {
  if (!payload || !payload.value) return '';
  try {
    if (payload.encoding === 'safeStorage' && safeStorage && safeStorage.isEncryptionAvailable()) {
      return safeStorage.decryptString(Buffer.from(payload.value, 'base64')).trim();
    }
    if (payload.encoding === 'base64') {
      return Buffer.from(payload.value, 'base64').toString('utf8').trim();
    }
  } catch (err) {
    console.warn('[Voice Config] Could not read saved voice transcription key.');
  }
  return '';
}

function readVoiceTranscriptionKey() {
  try {
    const configPath = getVoiceConfigPath();
    if (!fs.existsSync(configPath)) return '';
    const saved = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    return decryptSecret(saved.apiKey);
  } catch (err) {
    console.warn('[Voice Config] Could not load voice transcription settings.');
    return '';
  }
}

ipcMain.handle('get-voice-transcription-status', async () => {
  return { configured: Boolean(readVoiceTranscriptionKey()) };
});

ipcMain.handle('save-voice-transcription-key', async (event, apiKey) => {
  const encrypted = encryptSecret(apiKey);
  if (!encrypted) {
    return { success: false, message: 'Enter a valid transcription key.' };
  }

  try {
    fs.mkdirSync(app.getPath('userData'), { recursive: true });
    fs.writeFileSync(getVoiceConfigPath(), JSON.stringify({
      provider: 'groq',
      apiKey: encrypted,
      updatedAt: new Date().toISOString()
    }, null, 2));
    return { success: true };
  } catch (err) {
    console.warn('[Voice Config] Could not save voice transcription settings:', err.message);
    return { success: false, message: 'Could not save transcription settings.' };
  }
});

ipcMain.handle('clear-voice-transcription-key', async () => {
  try {
    const configPath = getVoiceConfigPath();
    if (fs.existsSync(configPath)) fs.unlinkSync(configPath);
    return { success: true };
  } catch (err) {
    console.warn('[Voice Config] Could not clear voice transcription settings:', err.message);
    return { success: false, message: 'Could not clear transcription settings.' };
  }
});

ipcMain.handle('transcribe-audio', async (event, arrayBuffer, mimeType) => {
  const transcriptionUrl = 'https://api.groq.com/openai/v1/audio/transcriptions';
  const apiKey = readVoiceTranscriptionKey();

  if (!apiKey) {
    return {
      success: false,
      code: 'not_configured',
      error: 'Voice transcription needs setup. Add your transcription key in Settings.'
    };
  }

  const extByMime = {
    'audio/webm': 'webm',
    'audio/ogg': 'ogg',
    'audio/mp4': 'mp4',
    'audio/mpeg': 'mp3',
    'audio/wav': 'wav',
    'audio/x-wav': 'wav',
    'audio/flac': 'flac'
  };

  try {
    const buffer = Buffer.from(arrayBuffer);
    if (!buffer || buffer.length < 2000) {
      return { success: false, error: "Recording too short. Try speaking a little longer." };
    }

    const baseMime = String(mimeType || 'audio/wav').split(';')[0].trim();
    const ext = extByMime[baseMime] || 'wav';
    const form = new FormData();
    form.append('file', new Blob([buffer], { type: baseMime }), `audio.${ext}`);
    form.append('model', 'whisper-large-v3-turbo');
    form.append('response_format', 'json');
    form.append('temperature', '0');

    let res;
    try {
      res = await fetch(transcriptionUrl, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}` },
        body: form,
        signal: AbortSignal.timeout(20000)
      });
    } catch (err) {
      if (err.name === 'TimeoutError') {
        return { success: false, error: 'Transcription timed out. Try again.' };
      }
      return { success: false, error: 'Could not reach the transcription service. Check your internet connection.' };
    }

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      console.error(`[Voice Transcription Error] HTTP ${res.status}: ${detail.slice(0, 300)}`);
      if (res.status === 401) {
        return { success: false, code: 'invalid_key', error: 'Voice transcription key was rejected. Update it in Settings.' };
      }
      if (res.status === 429) {
        return { success: false, error: 'Voice transcription is rate limited. Wait a moment and try again.' };
      }
      return { success: false, error: 'Voice transcription failed. Try again.' };
    }

    const data = await res.json();
    let transcript = String(data.text || '').trim();
    if (!transcript) {
      return { success: false, error: "Didn't hear anything. Speak louder or closer to the mic." };
    }

    transcript = transcript
      .replace(/\$/g, '₹')
      .replace(/\b(?:USD|dollars?|dollar)\b/gi, 'rupees');

    return { success: true, text: transcript };
  } catch (err) {
    console.error('[Voice Transcription Error]', err.message);
    return { success: false, error: 'Voice transcription failed. Try again.' };
  }
});

ipcMain.handle('prompt-touch-id', async () => {
  if (process.platform !== 'darwin') {
    return { success: false, reason: 'Touch ID is only supported on macOS' };
  }
  try {
    if (systemPreferences.canPromptTouchID && systemPreferences.canPromptTouchID()) {
      await systemPreferences.promptTouchID('Unlock Daily Hisab App');
      return { success: true };
    } else {
      return { success: false, reason: 'Touch ID is not configured or available on this Mac' };
    }
  } catch (err) {
    console.warn('[Touch ID Prompt Error]', err);
    return { success: false, reason: err.message || 'Touch ID verification failed' };
  }
});

let localServerUrl = null;
let mainWindow = null;
let appTray = null;
let pendingGoogleOAuth = null;

function getAutoUpdater() {
  if (!autoUpdater && electronUpdater && electronUpdater.autoUpdater) {
    autoUpdater = electronUpdater.autoUpdater;
    autoUpdater.autoDownload = false;
    autoUpdater.on('checking-for-update', () => sendUpdateStatus({ status: 'checking' }));
    autoUpdater.on('update-available', info => sendUpdateStatus({ status: 'available', info }));
    autoUpdater.on('update-not-available', info => sendUpdateStatus({ status: 'current', info }));
    autoUpdater.on('error', err => sendUpdateStatus({ status: 'error', message: err.message || 'Update error' }));
  }
  return autoUpdater;
}

function sendUpdateStatus(payload) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('update-status', payload);
  }
}

function base64Url(buffer) {
  return Buffer.from(buffer)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function isAllowedAuthUrl(url) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    const isLocalAuthHelper = (
      (host === 'localhost' || host === '127.0.0.1') &&
      parsed.pathname === '/google-auth.html'
    );
    return parsed.protocol === 'https:' && (
      host === 'accounts.google.com' ||
      host.endsWith('.google.com') ||
      host.endsWith('.googleusercontent.com') ||
      host.endsWith('.firebaseapp.com')
    ) || (parsed.protocol === 'http:' && isLocalAuthHelper);
  } catch (e) {
    return false;
  }
}

function openUrlInChrome(url) {
  return new Promise((resolve) => {
    const fallback = () => shell.openExternal(url).then(resolve).catch(resolve);

    if (process.platform === 'darwin') {
      execFile('open', ['-a', 'Google Chrome', url], (err) => {
        if (err) fallback();
        else resolve();
      });
      return;
    }

    if (process.platform === 'win32') {
      execFile('cmd', ['/c', 'start', '', 'chrome', url], (err) => {
        if (err) fallback();
        else resolve();
      });
      return;
    }

    execFile('google-chrome', [url], (err) => {
      if (err) fallback();
      else resolve();
    });
  });
}

ipcMain.handle('open-external-url', async (event, url) => {
  if (!url) return false;
  if (!isAllowedAuthUrl(url)) {
    console.warn(`[External URL Blocked] ${url}`);
    return false;
  }
  await openUrlInChrome(url);
  return true;
});

ipcMain.handle('get-auth-callback-url', async () => {
  return `${localServerUrl || 'http://localhost:5173'}/api/auth-callback`;
});

ipcMain.handle('start-google-oauth', async (event, options = {}) => {
  const clientId = String(options.clientId || '').trim();
  if (!clientId || !clientId.endsWith('.apps.googleusercontent.com')) {
    throw new Error('Google OAuth client id missing. Add VITE_GOOGLE_CLIENT_ID in .env.');
  }

  const redirectUri = `${localServerUrl || 'http://localhost:5173'}/api/auth-callback`;
  const state = base64Url(randomBytes(24));
  const codeVerifier = base64Url(randomBytes(64));
  const codeChallenge = base64Url(createHash('sha256').update(codeVerifier).digest());

  const clientSecret = String(options.clientSecret || process.env.GOOGLE_CLIENT_SECRET || process.env.VITE_GOOGLE_CLIENT_SECRET || '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').trim();

  pendingGoogleOAuth = {
    clientId,
    clientSecret,
    redirectUri,
    state,
    codeVerifier,
    webContents: event.sender
  };

  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', 'openid email profile');
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('code_challenge', codeChallenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');
  authUrl.searchParams.set('prompt', 'select_account');

  await openUrlInChrome(authUrl.toString());
  return true;
});

function startLocalServer() {
  return new Promise((resolve) => {
    const distDir = path.join(__dirname, 'dist');
    const staticDir = fs.existsSync(distDir) ? distDir : __dirname;

    const mimeTypes = {
      '.html': 'text/html',
      '.js': 'text/javascript',
      '.cjs': 'text/javascript',
      '.css': 'text/css',
      '.json': 'application/json',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.svg': 'image/svg+xml',
      '.ico': 'image/x-icon',
      '.woff2': 'font/woff2'
    };

    const server = http.createServer(async (req, res) => {
      const urlObj = new URL(req.url, 'http://127.0.0.1');
      let reqPath = urlObj.pathname;

      // Handle OAuth Loopback Callback from System Browser
      if (reqPath === '/api/auth-callback') {
        const code = urlObj.searchParams.get('code');
        const state = urlObj.searchParams.get('state');
        const oauthError = urlObj.searchParams.get('error');

        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', async () => {
          let payload = {};
          try {
            payload = JSON.parse(body || '{}');
          } catch (e) {}

          const idToken = payload.idToken || urlObj.searchParams.get('id_token') || urlObj.searchParams.get('idToken');
          const accessToken = payload.accessToken || urlObj.searchParams.get('access_token') || urlObj.searchParams.get('accessToken');

          const sendResponsePage = (ok, msg) => {
            res.writeHead(ok ? 200 : 400, {
              'Content-Type': 'text/html; charset=utf-8',
              'Access-Control-Allow-Origin': '*'
            });
            res.end(`
              <!DOCTYPE html>
              <html>
              <head>
                <title>Google Sign-In - Daily Hisab</title>
                <style>
                  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; text-align: center; }
                  .card { background: #1e293b; padding: 40px; border-radius: 16px; border: 1px solid #334155; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5); max-width: 440px; }
                  h2 { color: ${ok ? '#10b981' : '#ef4444'}; margin: 0 0 8px 0; }
                  p { color: #94a3b8; font-size: 14px; line-height: 1.5; margin: 0; }
                </style>
              </head>
              <body>
                <div class="card">
                  <div style="font-size: 48px; margin-bottom: 12px;">${ok ? '✅' : '⚠️'}</div>
                  <h2>${ok ? 'Signed In Successfully' : 'Sign-In Failed'}</h2>
                  <p>${msg}</p>
                </div>
                <script>
                  (function() {
                    const hash = window.location.hash ? window.location.hash.substring(1) : '';
                    const query = window.location.search ? window.location.search.substring(1) : '';
                    const params = new URLSearchParams(hash || query);
                    const idToken = params.get('id_token') || params.get('idToken');
                    const accessToken = params.get('access_token') || params.get('accessToken');

                    if (idToken || accessToken) {
                      fetch('/api/auth-callback', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ idToken: idToken, accessToken: accessToken })
                      }).finally(() => {
                        setTimeout(() => { try { window.close(); } catch(e) {} }, 1200);
                      });
                    } else {
                      setTimeout(() => { try { window.close(); } catch(e) {} }, ${ok ? 1500 : 5000});
                    }
                  })();
                </script>
              </body>
              </html>
            `);
          };

          if (idToken || accessToken) {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('google-auth-callback', { idToken, accessToken, ...payload });
              mainWindow.show();
              mainWindow.focus();
            }
            sendResponsePage(true, 'Google authentication complete. Return to Daily Hisab Desktop App.');
            return;
          }

          if (oauthError) {
            const errDesc = urlObj.searchParams.get('error_description') || oauthError;
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('google-auth-callback', { error: errDesc });
            }
            sendResponsePage(false, errDesc);
            return;
          }

          if (code && pendingGoogleOAuth && state === pendingGoogleOAuth.state) {
            try {
              const tokenParams = {
                client_id: pendingGoogleOAuth.clientId,
                code,
                code_verifier: pendingGoogleOAuth.codeVerifier,
                grant_type: 'authorization_code',
                redirect_uri: pendingGoogleOAuth.redirectUri
              };
              const clientSecret = pendingGoogleOAuth.clientSecret || process.env.GOOGLE_CLIENT_SECRET || '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';
              if (clientSecret) tokenParams.client_secret = clientSecret;

              const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams(tokenParams)
              });

              const tokenPayload = await tokenRes.json().catch(() => ({}));
              if (!tokenRes.ok || !tokenPayload.id_token) {
                throw new Error(tokenPayload.error_description || tokenPayload.error || `Google token exchange failed (${tokenRes.status})`);
              }

              const targetWebContents = pendingGoogleOAuth.webContents;
              pendingGoogleOAuth = null;

              if (targetWebContents && !targetWebContents.isDestroyed()) {
                targetWebContents.send('google-auth-callback', {
                  idToken: tokenPayload.id_token,
                  accessToken: tokenPayload.access_token || null
                });
              }
              if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.show();
                mainWindow.focus();
              }
              sendResponsePage(true, 'Google authentication complete. Return to Daily Hisab Desktop App.');
              return;
            } catch (err) {
              console.error('[Google Code Exchange Error]', err);
              pendingGoogleOAuth = null;
              if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('google-auth-callback', { error: err.message });
              }
              sendResponsePage(false, err.message);
              return;
            }
          }

          sendResponsePage(true, 'Google authentication complete. Return to Daily Hisab Desktop App.');
        });
        return;
      }

      if (reqPath === '/') reqPath = '/index.html';
      
      let filePath = path.join(staticDir, reqPath);
      if (!fs.existsSync(filePath) && reqPath === '/google-auth.html') {
        filePath = path.join(__dirname, 'google-auth.html');
      }
      if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        filePath = path.join(staticDir, 'index.html');
      }

      const ext = path.extname(filePath).toLowerCase();
      const contentType = mimeTypes[ext] || 'application/octet-stream';

      fs.readFile(filePath, (err, content) => {
        if (err) {
          res.writeHead(500);
          res.end('Server Error');
        } else {
          res.writeHead(200, { 
            'Content-Type': contentType,
            'Access-Control-Allow-Origin': '*'
          });
          res.end(content, 'utf-8');
        }
      });
    });

    server.listen(5173, '127.0.0.1', () => {
      localServerUrl = 'http://localhost:5173';
      console.log(`[Local Server] Serving Daily Hisab on ${localServerUrl}`);
      resolve(localServerUrl);
    }).on('error', () => {
      server.listen(0, '127.0.0.1', () => {
        const addr = server.address();
        const port = addr && typeof addr === 'object' ? addr.port : 0;
        localServerUrl = `http://localhost:${port}`;
        console.log(`[Local Server] Serving Daily Hisab on ${localServerUrl}`);
        resolve(localServerUrl);
      });
    });
  });
}

function createWindow() {
  const iconPath = path.join(__dirname, 'assets/icon.png');
  const appIcon = nativeImage.createFromPath(iconPath);

  if (process.platform === 'darwin' && app.dock) {
    try {
      app.dock.setIcon(appIcon);
    } catch (e) { }
  }

  const preloadPath = fs.existsSync(path.join(__dirname, 'preload.cjs'))
    ? path.join(__dirname, 'preload.cjs')
    : path.join(__dirname, 'preload.js');

  const customUserAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

  mainWindow = new BrowserWindow({
    title: 'Daily Hisab',
    icon: appIcon,
    width: 1100,
    height: 720,
    minWidth: 850,
    minHeight: 550,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#0f172a',
    webPreferences: {
      preload: preloadPath,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      userAgent: customUserAgent
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    return {
      action: 'allow',
      overrideBrowserWindowOptions: {
        width: 500,
        height: 650,
        autoHideMenuBar: true,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          userAgent: customUserAgent
        }
      }
    };
  });

  if (process.env.DEBUG === '1' || process.argv.includes('--open-devtools') || process.argv.includes('-d') || process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }

  // Check if running in development mode or loaded via local server
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else if (localServerUrl) {
    mainWindow.loadURL(localServerUrl);
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist/index.html')).catch(() => {
      mainWindow.loadFile(path.join(__dirname, 'index.html'));
    });
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function showMainWindow(onReady) {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createWindow();
    if (onReady && mainWindow) {
      mainWindow.webContents.once('did-finish-load', () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          onReady();
        }
      });
    }
  } else {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
    if (onReady) {
      onReady();
    }
  }
}

function createTray() {
  if (appTray) return;
  try {
    const iconPath = path.join(__dirname, 'assets/icon.png');
    const trayIcon = nativeImage.createFromPath(iconPath).resize({ width: 18, height: 18 });
    appTray = new Tray(trayIcon);
    appTray.setToolTip('Daily Hisab Personal Finance');

    const contextMenu = Menu.buildFromTemplate([
      { label: '💰 Open Daily Hisab', click: () => showMainWindow() },
      { 
        label: '⚡ Quick Add Entry', 
        click: () => {
          showMainWindow(() => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('open-quick-add');
            }
          });
        }
      },
      { type: 'separator' },
      { label: 'Quit', click: () => app.quit() }
    ]);

    appTray.setContextMenu(contextMenu);
    appTray.on('click', () => {
      if (!mainWindow || mainWindow.isDestroyed()) {
        createWindow();
      } else {
        if (mainWindow.isVisible()) {
          mainWindow.hide();
        } else {
          if (mainWindow.isMinimized()) mainWindow.restore();
          mainWindow.show();
          mainWindow.focus();
        }
      }
    });
  } catch (e) {
    console.warn('Could not initialize system tray:', e.message);
  }
}

ipcMain.handle('send-desktop-notification', async (event, { title, body }) => {
  try {
    if (Notification.isSupported()) {
      const iconPath = path.join(__dirname, 'assets/icon.png');
      const notif = new Notification({
        title: title || 'Daily Hisab Alert',
        body: body || '',
        icon: nativeImage.createFromPath(iconPath)
      });
      notif.show();
      return true;
    }
  } catch (e) {
    console.warn('Desktop notification error:', e);
  }
  return false;
});

ipcMain.handle('check-for-updates', async () => {
  if (!app.isPackaged) {
    return { success: false, status: 'development', message: 'Update checks run only in packaged builds.' };
  }
  try {
    const updater = getAutoUpdater();
    const result = await updater.checkForUpdates();
    return { success: true, status: 'checking', updateInfo: result?.updateInfo || null };
  } catch (err) {
    return { success: false, status: 'error', message: err.message || 'Update check failed.' };
  }
});

app.whenReady().then(async () => {
  const customUserAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';
  session.defaultSession.setUserAgent(customUserAgent);

  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    callback(true);
  });
  session.defaultSession.setPermissionCheckHandler(() => true);

  await startLocalServer();
  createWindow();
  createTray();
  if (app.isPackaged) {
    setTimeout(() => getAutoUpdater().checkForUpdates().catch(err => {
      console.warn('Auto-update check failed:', err.message);
    }), 5000);
  }

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
