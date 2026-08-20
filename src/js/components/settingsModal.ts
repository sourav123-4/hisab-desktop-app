import { store } from '../store.js';
import type { ThemeName } from '../../types/index.js';

export function renderSettingsModal(): void {
  let modal = document.getElementById('settingsModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.id = 'settingsModal';
    document.body.appendChild(modal);
  }

  const currentTheme = store.getTheme();
  const security = store.getSecuritySettings();

  modal.innerHTML = `
    <div class="modal-container" style="max-width: 540px; padding: 28px; border-radius: 28px; background: var(--bg-card); border: 1px solid var(--border-color); box-shadow: 0 25px 60px -15px rgba(0, 0, 0, 0.7), 0 0 35px rgba(99, 102, 241, 0.15); backdrop-filter: blur(20px);">
      
      <!-- Header -->
      <div class="modal-header" style="margin-bottom: 22px; padding-bottom: 14px; border-bottom: 1px solid var(--border-color); display: flex; align-items: center; justify-content: space-between;">
        <div style="display: flex; align-items: center; gap: 12px;">
          <div style="width: 42px; height: 42px; border-radius: 14px; background: linear-gradient(135deg, rgba(99, 102, 241, 0.2), rgba(168, 85, 247, 0.25)); border: 1px solid rgba(168, 85, 247, 0.35); display: flex; align-items: center; justify-content: center; font-size: 22px;">⚙️</div>
          <div>
            <h3 style="font-size: 18px; font-weight: 800; color: var(--text-primary); margin: 0; letter-spacing: -0.3px;">Settings & Security Preferences</h3>
            <p style="font-size: 12px; color: var(--text-secondary); margin: 2px 0 0 0;">Customize themes, passcode lock, Touch ID, & backup data</p>
          </div>
        </div>
        <button class="close-btn" id="closeSettingsModalBtn" style="width: 32px; height: 32px; border-radius: 50%; background: rgba(255, 255, 255, 0.06); border: 1px solid var(--border-color); color: var(--text-secondary); font-size: 18px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all var(--transition-fast);">&times;</button>
      </div>

      <div style="display: flex; flex-direction: column; gap: 20px; max-height: calc(85vh - 120px); overflow-y: auto; padding-right: 4px;">
        
        <!-- Theme Section -->
        <div>
          <label style="font-weight: 700; font-size: 13.5px; color: var(--text-primary); display: flex; align-items: center; gap: 8px; margin-bottom: 10px;">
            <span>🎨 Application Appearance & Theme</span>
          </label>
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px;">
            
            <button class="theme-option-btn ${currentTheme === 'dark' ? 'active' : ''}" data-theme="dark" style="padding: 12px 14px; border-radius: 14px; border: ${currentTheme === 'dark' ? '2px solid #6366f1' : '1px solid rgba(255,255,255,0.1)'}; background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%); color: #f8fafc; text-align: left; cursor: pointer; display: flex; align-items: center; justify-content: space-between; box-shadow: ${currentTheme === 'dark' ? '0 0 16px rgba(99, 102, 241, 0.4)' : 'none'}; transition: all 0.2s ease;">
              <span style="font-weight: 700; font-size: 12.5px;">🌙 Dark Navy</span>
              ${currentTheme === 'dark' ? '<span style="font-weight: 800; font-size: 12px; background: #6366f1; color: #fff; width: 20px; height: 20px; border-radius: 50%; display: flex; align-items: center; justify-content: center;">✓</span>' : ''}
            </button>

            <button class="theme-option-btn ${currentTheme === 'light' ? 'active' : ''}" data-theme="light" style="padding: 12px 14px; border-radius: 14px; border: ${currentTheme === 'light' ? '2px solid #6366f1' : '1px solid #cbd5e1'}; background: linear-gradient(135deg, #ffffff 0%, #f1f5f9 100%); color: #0f172a; text-align: left; cursor: pointer; display: flex; align-items: center; justify-content: space-between; box-shadow: ${currentTheme === 'light' ? '0 0 16px rgba(99, 102, 241, 0.4)' : 'none'}; transition: all 0.2s ease;">
              <span style="font-weight: 700; font-size: 12.5px; color: #0f172a;">☀️ Clean Light</span>
              ${currentTheme === 'light' ? '<span style="font-weight: 800; font-size: 12px; background: #6366f1; color: #fff; width: 20px; height: 20px; border-radius: 50%; display: flex; align-items: center; justify-content: center;">✓</span>' : ''}
            </button>

            <button class="theme-option-btn ${currentTheme === 'oled' ? 'active' : ''}" data-theme="oled" style="padding: 12px 14px; border-radius: 14px; border: ${currentTheme === 'oled' ? '2px solid #a855f7' : '1px solid rgba(255,255,255,0.1)'}; background: #000000; color: #ffffff; text-align: left; cursor: pointer; display: flex; align-items: center; justify-content: space-between; box-shadow: ${currentTheme === 'oled' ? '0 0 16px rgba(168, 85, 247, 0.4)' : 'none'}; transition: all 0.2s ease;">
              <span style="font-weight: 700; font-size: 12.5px;">🕶️ OLED Pitch Black</span>
              ${currentTheme === 'oled' ? '<span style="font-weight: 800; font-size: 12px; background: #a855f7; color: #fff; width: 20px; height: 20px; border-radius: 50%; display: flex; align-items: center; justify-content: center;">✓</span>' : ''}
            </button>

            <button class="theme-option-btn ${currentTheme === 'emerald' ? 'active' : ''}" data-theme="emerald" style="padding: 12px 14px; border-radius: 14px; border: ${currentTheme === 'emerald' ? '2px solid #10b981' : '1px solid rgba(16, 185, 129, 0.25)'}; background: linear-gradient(135deg, #064e3b 0%, #022c22 100%); color: #ecfdf5; text-align: left; cursor: pointer; display: flex; align-items: center; justify-content: space-between; box-shadow: ${currentTheme === 'emerald' ? '0 0 16px rgba(16, 185, 129, 0.4)' : 'none'}; transition: all 0.2s ease;">
              <span style="font-weight: 700; font-size: 12.5px; color: #ecfdf5;">🌿 Emerald Glass</span>
              ${currentTheme === 'emerald' ? '<span style="font-weight: 800; font-size: 12px; background: #10b981; color: #fff; width: 20px; height: 20px; border-radius: 50%; display: flex; align-items: center; justify-content: center;">✓</span>' : ''}
            </button>

          </div>
        </div>

        <hr style="border: 0; border-top: 1px dashed var(--border-color); margin: 0;" />

        <!-- Security & Passcode Section -->
        <div style="display: flex; flex-direction: column; gap: 14px;">
          
          <!-- PIN Passcode Row -->
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px;">
            <div>
              <label style="font-weight: 700; font-size: 13.5px; color: var(--text-primary); display: block;">
                🔒 App PIN Passcode Protection
              </label>
              <span style="font-size: 11.5px; color: var(--text-secondary);">Require 4-digit PIN when opening Daily Hisab</span>
            </div>
            
            <!-- Custom Styled Toggle Switch with White Sliding Knob -->
            <label class="switch" style="position: relative; display: inline-flex; align-items: center; width: 46px; height: 24px; cursor: pointer; flex-shrink: 0;">
              <input type="checkbox" id="pinToggleCheck" ${security.pinEnabled ? 'checked' : ''} style="display: none;">
              <span style="position: absolute; inset: 0; background: ${security.pinEnabled ? 'var(--grad-primary)' : 'rgba(255,255,255,0.12)'}; border-radius: 24px; transition: all 0.25s ease; border: 1px solid ${security.pinEnabled ? 'rgba(168,85,247,0.5)' : 'rgba(255,255,255,0.15)'};">
                <span style="position: absolute; top: 2px; left: ${security.pinEnabled ? '23px' : '3px'}; width: 18px; height: 18px; border-radius: 50%; background: #ffffff; box-shadow: 0 2px 5px rgba(0,0,0,0.3); transition: all 0.25s ease;"></span>
              </span>
            </label>
          </div>

          <!-- PIN Code Setup Box -->
          <div id="pinSetupBox" style="display: ${security.pinEnabled ? 'block' : 'none'}; background: rgba(0, 0, 0, 0.25); padding: 14px 16px; border-radius: 16px; border: 1px solid var(--border-color);">
            <label style="font-size: 12px; font-weight: 600; color: var(--text-secondary); display: block; margin-bottom: 8px;">
              Enter 4-Digit Passcode
            </label>
            <div style="display: flex; gap: 10px; align-items: center;">
              <input type="password" id="pinInputCode" maxlength="4" inputmode="numeric" pattern="\\d{4}" autocomplete="off" class="form-control" placeholder="••••" style="width: 120px; font-size: 18px; font-weight: 800; letter-spacing: 6px; text-align: center; border-radius: 10px; padding: 6px 10px;" value="${security.hasPin ? '••••' : ''}" />
              <button class="btn btn-primary btn-sm" id="savePinBtn" style="font-weight: 700; padding: 8px 16px; border-radius: 10px;">Save PIN</button>
            </div>
            <span id="pinStatusText" style="font-size: 11.5px; font-weight: 600; color: var(--accent-success); margin-top: 8px; display: block;"></span>
          </div>

          <!-- Touch ID Biometric Row -->
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px;">
            <div>
              <label style="font-weight: 700; font-size: 13.5px; color: var(--text-primary); display: block;">
                ☝️ Touch ID / Biometric Fingerprint Unlock
              </label>
              <span style="font-size: 11.5px; color: var(--text-secondary);">Enable quick Touch ID / Fingerprint sensor unlock on launch</span>
            </div>
            
            <label class="switch" style="position: relative; display: inline-flex; align-items: center; width: 46px; height: 24px; cursor: pointer; flex-shrink: 0;">
              <input type="checkbox" id="fingerprintToggleCheck" ${security.fingerprintEnabled ? 'checked' : ''} style="display: none;">
              <span style="position: absolute; inset: 0; background: ${security.fingerprintEnabled ? 'var(--grad-primary)' : 'rgba(255,255,255,0.12)'}; border-radius: 24px; transition: all 0.25s ease; border: 1px solid ${security.fingerprintEnabled ? 'rgba(168,85,247,0.5)' : 'rgba(255,255,255,0.15)'};">
                <span style="position: absolute; top: 2px; left: ${security.fingerprintEnabled ? '23px' : '3px'}; width: 18px; height: 18px; border-radius: 50%; background: #ffffff; box-shadow: 0 2px 5px rgba(0,0,0,0.3); transition: all 0.25s ease;"></span>
              </span>
            </label>
          </div>

        </div>

        <hr style="border: 0; border-top: 1px dashed var(--border-color); margin: 0;" />

        <!-- Notifications Section -->
        <div>
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px;">
            <div>
              <label style="font-weight: 700; font-size: 13.5px; color: var(--text-primary); display: block;">
                🔔 Native Desktop Notifications
              </label>
              <span style="font-size: 11.5px; color: var(--text-secondary);">Receive alerts for budget warnings & EMI due dates</span>
            </div>
            
            <label class="switch" style="position: relative; display: inline-flex; align-items: center; width: 46px; height: 24px; cursor: pointer; flex-shrink: 0;">
              <input type="checkbox" id="notifToggleCheck" ${security.notificationsEnabled ? 'checked' : ''} style="display: none;">
              <span style="position: absolute; inset: 0; background: ${security.notificationsEnabled ? 'var(--grad-primary)' : 'rgba(255,255,255,0.12)'}; border-radius: 24px; transition: all 0.25s ease; border: 1px solid ${security.notificationsEnabled ? 'rgba(168,85,247,0.5)' : 'rgba(255,255,255,0.15)'};">
                <span style="position: absolute; top: 2px; left: ${security.notificationsEnabled ? '23px' : '3px'}; width: 18px; height: 18px; border-radius: 50%; background: #ffffff; box-shadow: 0 2px 5px rgba(0,0,0,0.3); transition: all 0.25s ease;"></span>
              </span>
            </label>
          </div>

          <button class="btn btn-secondary btn-sm" id="testNotifBtn" style="margin-top: 10px; font-size: 12px; font-weight: 600; padding: 7px 14px; border-radius: 10px;">
            🔔 Test Desktop Notification
          </button>
        </div>

        <hr style="border: 0; border-top: 1px dashed var(--border-color); margin: 0;" />

        <!-- Data Backup & Restore -->
        <div>
          <label style="font-weight: 700; font-size: 13.5px; color: var(--text-primary); display: block; margin-bottom: 10px;">
            💾 Data Backup & Restore
          </label>
          <div style="display: flex; gap: 10px; flex-wrap: wrap;">
            <button class="btn btn-secondary btn-sm" id="settingsExportBtn" style="font-size: 12px; font-weight: 600; padding: 8px 14px; border-radius: 10px; gap: 6px;">
              <span>⬇️</span> Export JSON Backup
            </button>
            <button class="btn btn-secondary btn-sm" id="settingsImportBtn" style="font-size: 12px; font-weight: 600; padding: 8px 14px; border-radius: 10px; gap: 6px;">
              <span>⬆️</span> Restore JSON Backup
            </button>
            <button class="btn btn-secondary btn-sm" id="settingsEncryptedExportBtn" style="font-size: 12px; font-weight: 600; padding: 8px 14px; border-radius: 10px; gap: 6px;">
              <span>🔐</span> Export Encrypted
            </button>
            <button class="btn btn-secondary btn-sm" id="settingsEncryptedImportBtn" style="font-size: 12px; font-weight: 600; padding: 8px 14px; border-radius: 10px; gap: 6px;">
              <span>🔓</span> Restore Encrypted
            </button>
            <input type="file" id="settingsImportFile" accept=".json" style="display: none;" />
            <input type="file" id="settingsEncryptedImportFile" accept=".json" style="display: none;" />
          </div>
        </div>

        <hr style="border: 0; border-top: 1px dashed var(--border-color); margin: 0;" />

        <div>
          <label style="font-weight: 700; font-size: 13.5px; color: var(--text-primary); display: block; margin-bottom: 10px;">
            ⬆️ App Updates
          </label>
          <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
            <button class="btn btn-secondary btn-sm" id="settingsUpdateCheckBtn" style="font-size: 12px; font-weight: 600; padding: 8px 14px; border-radius: 10px;">
              Check for Updates
            </button>
            <span id="settingsUpdateStatus" style="font-size: 12px; color: var(--text-secondary);"></span>
          </div>
        </div>

      </div>

      <!-- Action Button -->
      <div class="modal-actions" style="margin-top: 22px; padding-top: 14px; border-top: 1px solid var(--border-color); display: flex; justify-content: flex-end;">
        <button class="btn btn-primary" id="closeSettingsModalDoneBtn" style="padding: 10px 28px; font-weight: 700; border-radius: 12px;">Done</button>
      </div>
    </div>
  `;

  modal.classList.add('active');

  const closeModal = () => modal?.classList.remove('active');

  const closeBtn = document.getElementById('closeSettingsModalBtn');
  if (closeBtn) closeBtn.onclick = closeModal;

  const doneBtn = document.getElementById('closeSettingsModalDoneBtn');
  if (doneBtn) doneBtn.onclick = closeModal;

  modal.querySelectorAll('.theme-option-btn').forEach(btn => {
    (btn as HTMLElement).onclick = () => {
      const theme = (btn as HTMLElement).dataset.theme as ThemeName;
      store.setTheme(theme);
      renderSettingsModal();
    };
  });

  const pinCheck = document.getElementById('pinToggleCheck') as HTMLInputElement | null;
  const pinBox = document.getElementById('pinSetupBox');
  if (pinCheck && pinBox) {
    pinCheck.onchange = () => {
      if (pinCheck.checked) {
        pinBox.style.display = 'block';
        store.setSecurityPin(true);
      } else {
        pinBox.style.display = 'none';
        store.setSecurityPin(false);
      }
      renderSettingsModal();
    };
  }

  const fingerprintCheck = document.getElementById('fingerprintToggleCheck') as HTMLInputElement | null;
  if (fingerprintCheck) {
    fingerprintCheck.onchange = (e: any) => {
      store.setFingerprintEnabled(e.target.checked);
      renderSettingsModal();
    };
  }

  const savePinBtn = document.getElementById('savePinBtn');
  if (savePinBtn) {
    savePinBtn.onclick = () => {
      const pinInput = document.getElementById('pinInputCode') as HTMLInputElement | null;
      const code = pinInput ? pinInput.value.trim() : '';
      if (code.length === 4 && /^\d{4}$/.test(code)) {
        store.setSecurityPin(true, code);
        const statusText = document.getElementById('pinStatusText');
        if (statusText) statusText.textContent = '✅ PIN saved successfully!';
      } else {
        alert('Please enter a valid 4-digit numeric PIN');
      }
    };
  }

  const notifCheck = document.getElementById('notifToggleCheck') as HTMLInputElement | null;
  if (notifCheck) {
    notifCheck.onchange = (e: any) => {
      store.setNotificationsEnabled(e.target.checked);
      renderSettingsModal();
    };
  }

  const testNotifBtn = document.getElementById('testNotifBtn');
  if (testNotifBtn) {
    testNotifBtn.onclick = async () => {
      if (window.electronAPI && window.electronAPI.sendDesktopNotification) {
        const ok = await window.electronAPI.sendDesktopNotification({
          title: 'Daily Hisab Alert',
          body: 'This is a test notification from Daily Hisab!'
        });
        if (!ok && typeof Notification !== 'undefined') {
          new Notification('Daily Hisab Alert', { body: 'This is a test notification from Daily Hisab!' });
        }
      } else if (typeof Notification !== 'undefined') {
        Notification.requestPermission().then(() => {
          new Notification('Daily Hisab Alert', { body: 'This is a test notification from Daily Hisab!' });
        });
      }
    };
  }

  const exportBtn = document.getElementById('settingsExportBtn');
  if (exportBtn) exportBtn.onclick = () => store.exportJSON();

  const encryptedExportBtn = document.getElementById('settingsEncryptedExportBtn');
  if (encryptedExportBtn) {
    encryptedExportBtn.onclick = async () => {
      const passphrase = prompt('Create a backup passphrase. You will need it to restore this file.');
      if (passphrase) await store.exportEncryptedJSON(passphrase);
    };
  }

  const importBtn = document.getElementById('settingsImportBtn');
  const importFile = document.getElementById('settingsImportFile') as HTMLInputElement | null;
  if (importBtn && importFile) {
    importBtn.onclick = () => importFile.click();
    importFile.onchange = (e: any) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event: any) => store.importJSON(event.target.result);
        reader.readAsText(file);
      }
    };
  }

  const encryptedImportBtn = document.getElementById('settingsEncryptedImportBtn');
  const encryptedImportFile = document.getElementById('settingsEncryptedImportFile') as HTMLInputElement | null;
  if (encryptedImportBtn && encryptedImportFile) {
    encryptedImportBtn.onclick = () => encryptedImportFile.click();
    encryptedImportFile.onchange = (e: any) => {
      const file = e.target.files[0];
      if (!file) return;
      const passphrase = prompt('Enter the backup passphrase.');
      if (!passphrase) return;
      const reader = new FileReader();
      reader.onload = async (event: any) => {
        await store.importEncryptedJSON(event.target.result, passphrase);
      };
      reader.readAsText(file);
    };
  }

  const updateBtn = document.getElementById('settingsUpdateCheckBtn');
  const updateStatus = document.getElementById('settingsUpdateStatus');
  if (window.electronAPI?.onUpdateStatus && updateStatus) {
    window.electronAPI.onUpdateStatus((data: any) => {
      updateStatus.textContent = data.status === 'available'
        ? 'Update available.'
        : data.status === 'current'
          ? 'You are on the latest version.'
          : data.status === 'error'
            ? `Update check failed: ${data.message || 'Unknown error'}`
            : 'Checking for updates...';
    });
  }
  if (updateBtn) {
    updateBtn.onclick = async () => {
      if (!window.electronAPI?.checkForUpdates) {
        if (updateStatus) updateStatus.textContent = 'Update checks are available in the desktop app.';
        return;
      }
      if (updateStatus) updateStatus.textContent = 'Checking for updates...';
      const result = await window.electronAPI.checkForUpdates();
      if (!result.success && updateStatus) updateStatus.textContent = result.message || 'Update check unavailable.';
    };
  }
}
