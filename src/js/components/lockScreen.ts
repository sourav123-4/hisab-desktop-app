import { store } from '../store.js';

export function initLockScreen(): void {
  const security = store.getSecuritySettings();
  if (!security.enabled || (!security.hasPin && !security.fingerprintEnabled)) {
    document.documentElement.classList.remove('app-is-locked');
    return;
  }

  let lockOverlay = document.getElementById('appLockScreen');
  if (!lockOverlay) {
    lockOverlay = document.createElement('div');
    lockOverlay.id = 'appLockScreen';
    lockOverlay.style.cssText = `
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: radial-gradient(circle at center, rgba(17, 24, 39, 0.96) 0%, rgba(9, 13, 22, 0.99) 100%);
      z-index: 99999;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      backdrop-filter: blur(24px);
      -webkit-backdrop-filter: blur(24px);
      transition: opacity 0.35s cubic-bezier(0.4, 0, 0.2, 1);
    `;
    document.body.appendChild(lockOverlay);
  }

  let enteredPin = '';

  const unlockApp = () => {
    document.documentElement.classList.remove('app-is-locked');
    window.removeEventListener('keydown', handleKeyDown);
    if (lockOverlay) {
      lockOverlay.style.opacity = '0';
      setTimeout(() => {
        lockOverlay?.remove();
      }, 350);
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (!document.getElementById('appLockScreen')) return;
    
    if (/^[0-9]$/.test(e.key)) {
      if (enteredPin.length < 4) {
        enteredPin += e.key;
        updateDots();
        if (enteredPin.length === 4) {
          verifyPinAttempt();
        }
      }
    } else if (e.key === 'Backspace') {
      enteredPin = enteredPin.slice(0, -1);
      updateDots();
    } else if (e.key === 'Escape' || e.key === 'Delete') {
      enteredPin = '';
      updateDots();
    }
  };

  const triggerFingerprintScan = async () => {
    const errorMsg = document.getElementById('pinErrorMsg');
    const fingerprintIcon = document.getElementById('fingerprintIconBox');
    
    if (fingerprintIcon) {
      fingerprintIcon.style.transform = 'scale(1.15)';
      fingerprintIcon.style.borderColor = 'var(--accent-success, #10b981)';
      fingerprintIcon.style.boxShadow = '0 0 30px rgba(16, 185, 129, 0.6)';
    }

    if (errorMsg) {
      errorMsg.style.color = '#38bdf8';
      errorMsg.textContent = '👆 Touch ID sensor scanning... Touch the fingerprint sensor';
    }

    if (window.electronAPI && typeof window.electronAPI.promptTouchID === 'function') {
      try {
        const res = await window.electronAPI.promptTouchID();
        if (res && res.success) {
          unlockApp();
          return;
        } else {
          if (errorMsg) {
            errorMsg.style.color = '#ef4444';
            errorMsg.textContent = `❌ ${res?.reason || 'Touch ID verification failed. Enter 4-digit PIN.'}`;
          }
          return;
        }
      } catch (err: any) {
        console.warn('[Touch ID IPC Error]', err);
        if (errorMsg) {
          errorMsg.style.color = '#ef4444';
          errorMsg.textContent = '❌ Touch ID error. Please enter PIN.';
        }
        return;
      }
    } else if (!security.hasPin) {
      // Fallback auto-unlock only if no PIN is configured
      setTimeout(() => {
        unlockApp();
      }, 500);
    }
  };

  const renderLockContent = () => {
    if (!lockOverlay) return;
    lockOverlay.innerHTML = `
      <div style="text-align: center; width: 100%; max-width: 380px; padding: 36px 30px; background: rgba(17, 24, 39, 0.85); border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 32px; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.6), 0 0 40px rgba(99, 102, 241, 0.15); backdrop-filter: blur(16px);">
        
        <!-- Security Icon -->
        <div style="position: relative; width: 72px; height: 72px; margin: 0 auto 16px auto; display: flex; align-items: center; justify-content: center;">
          <div style="position: absolute; inset: 0; border-radius: 50%; background: linear-gradient(135deg, rgba(99,102,241,0.3), rgba(168,85,247,0.3)); filter: blur(10px);"></div>
          <div id="fingerprintIconBox" style="position: relative; width: 68px; height: 68px; border-radius: 22px; background: linear-gradient(135deg, #1e1b4b 0%, #31104b 100%); border: 1px solid rgba(168, 85, 247, 0.4); display: flex; align-items: center; justify-content: center; font-size: 32px; cursor: pointer; transition: all 0.3s ease; box-shadow: 0 10px 25px rgba(99, 102, 241, 0.3);" title="Click to unlock with Touch ID / Fingerprint">
            ${security.fingerprintEnabled ? '☝️' : '🔒'}
          </div>
        </div>

        <h2 style="font-size: 22px; font-weight: 800; color: #f8fafc; margin: 0 0 4px 0; letter-spacing: -0.5px;">Daily Hisab Locked</h2>
        <p style="font-size: 13px; color: #94a3b8; margin: 0 0 20px 0;">
          ${security.fingerprintEnabled ? 'Type PIN on laptop keyboard or use Touch ID' : 'Type 4-digit PIN on laptop keyboard to unlock'}
        </p>

        <!-- PIN Dots Indicator -->
        <div id="pinDotsContainer" style="display: flex; gap: 16px; justify-content: center; margin-bottom: 20px;">
          <div class="pin-dot" style="width: 14px; height: 14px; border-radius: 50%; border: 2px solid #6366f1; background: ${enteredPin.length >= 1 ? '#6366f1' : 'transparent'}; box-shadow: ${enteredPin.length >= 1 ? '0 0 12px rgba(99,102,241,0.8)' : 'none'}; transition: all 0.15s ease;"></div>
          <div class="pin-dot" style="width: 14px; height: 14px; border-radius: 50%; border: 2px solid #6366f1; background: ${enteredPin.length >= 2 ? '#6366f1' : 'transparent'}; box-shadow: ${enteredPin.length >= 2 ? '0 0 12px rgba(99,102,241,0.8)' : 'none'}; transition: all 0.15s ease;"></div>
          <div class="pin-dot" style="width: 14px; height: 14px; border-radius: 50%; border: 2px solid #6366f1; background: ${enteredPin.length >= 3 ? '#6366f1' : 'transparent'}; box-shadow: ${enteredPin.length >= 3 ? '0 0 12px rgba(99,102,241,0.8)' : 'none'}; transition: all 0.15s ease;"></div>
          <div class="pin-dot" style="width: 14px; height: 14px; border-radius: 50%; border: 2px solid #6366f1; background: ${enteredPin.length >= 4 ? '#6366f1' : 'transparent'}; box-shadow: ${enteredPin.length >= 4 ? '0 0 12px rgba(99,102,241,0.8)' : 'none'}; transition: all 0.15s ease;"></div>
        </div>

        <div id="pinErrorMsg" style="font-size: 12.5px; color: #ef4444; font-weight: 600; min-height: 20px; margin-bottom: 16px;"></div>

        <!-- On-Screen Keypad -->
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; max-width: 250px; margin: 0 auto 16px auto;">
          ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => `
            <button class="pin-btn" data-val="${num}" style="width: 64px; height: 64px; border-radius: 50%; border: 1px solid rgba(255, 255, 255, 0.1); background: rgba(255, 255, 255, 0.05); color: #f8fafc; font-size: 22px; font-weight: 700; cursor: pointer; transition: all 0.15s ease; outline: none;">${num}</button>
          `).join('')}
          <button class="pin-btn" data-action="clear" style="width: 64px; height: 64px; border-radius: 50%; border: 1px solid rgba(255, 255, 255, 0.1); background: rgba(255, 255, 255, 0.04); color: #94a3b8; font-size: 13px; font-weight: 600; cursor: pointer;">Clear</button>
          <button class="pin-btn" data-val="0" style="width: 64px; height: 64px; border-radius: 50%; border: 1px solid rgba(255, 255, 255, 0.1); background: rgba(255, 255, 255, 0.05); color: #f8fafc; font-size: 22px; font-weight: 700; cursor: pointer;">0</button>
          <button class="pin-btn" data-action="back" style="width: 64px; height: 64px; border-radius: 50%; border: 1px solid rgba(255, 255, 255, 0.1); background: rgba(255, 255, 255, 0.04); color: #94a3b8; font-size: 18px; font-weight: 600; cursor: pointer;">⌫</button>
        </div>

        ${security.fingerprintEnabled ? `
          <button id="touchIdBtn" style="margin-top: 6px; background: rgba(16, 185, 129, 0.14); border: 1px solid rgba(16, 185, 129, 0.35); color: #10b981; padding: 10px 20px; border-radius: 20px; font-size: 12.5px; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; transition: all 0.2s ease;">
            <span>☝️ Touch ID Sensor Unlock</span>
          </button>
        ` : ''}
      </div>
    `;

    lockOverlay.querySelectorAll('.pin-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const val = (btn as HTMLElement).dataset.val;
        const action = (btn as HTMLElement).dataset.action;

        if (val !== undefined) {
          if (enteredPin.length < 4) {
            enteredPin += val;
            updateDots();
            if (enteredPin.length === 4) {
              verifyPinAttempt();
            }
          }
        } else if (action === 'clear') {
          enteredPin = '';
          updateDots();
        } else if (action === 'back') {
          enteredPin = enteredPin.slice(0, -1);
          updateDots();
        }
      });
    });

    const fingerprintBox = document.getElementById('fingerprintIconBox');
    if (fingerprintBox && security.fingerprintEnabled) {
      fingerprintBox.addEventListener('click', triggerFingerprintScan);
    }

    const touchBtn = document.getElementById('touchIdBtn');
    if (touchBtn) {
      touchBtn.addEventListener('click', triggerFingerprintScan);
    }
  };

  const updateDots = () => {
    const dotsContainer = document.getElementById('pinDotsContainer');
    if (dotsContainer) {
      dotsContainer.querySelectorAll('.pin-dot').forEach((dot, index) => {
        const isFilled = index < enteredPin.length;
        (dot as HTMLElement).style.background = isFilled ? '#6366f1' : 'transparent';
        (dot as HTMLElement).style.boxShadow = isFilled ? '0 0 12px rgba(99,102,241,0.8)' : 'none';
      });
    }
  };

  const verifyPinAttempt = () => {
    const errorMsg = document.getElementById('pinErrorMsg');
    if (store.verifyPin(enteredPin)) {
      unlockApp();
    } else {
      if (errorMsg) {
        errorMsg.style.color = '#ef4444';
        errorMsg.textContent = '❌ Incorrect PIN. Please try again.';
      }
      enteredPin = '';
      setTimeout(() => {
        updateDots();
      }, 300);
    }
  };

  window.addEventListener('keydown', handleKeyDown);
  renderLockContent();

  if (security.fingerprintEnabled) {
    setTimeout(() => {
      triggerFingerprintScan();
    }, 200);
  }
}
