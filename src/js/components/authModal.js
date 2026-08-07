/**
 * Login, Register & User Account Modal Component for Daily Hisab
 */
import { 
  loginWithEmail, 
  registerWithEmail, 
  loginWithGoogle, 
  logoutUser, 
  resetPassword, 
  getCurrentUser 
} from '../firebase.js';
import { store } from '../store.js';

export function renderAuthModalHTML() {
  return `
    <div class="modal-overlay" id="authModal">
      <div class="modal-container" style="max-width: 440px; padding: 26px;">
        <!-- Premium Modal Header -->
        <div class="modal-header" style="margin-bottom: 20px; display: flex; align-items: center; justify-content: space-between; gap: 12px;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <div id="authHeaderIcon" style="width: 40px; height: 40px; border-radius: 12px; background: linear-gradient(135deg, rgba(99, 102, 241, 0.2) 0%, rgba(168, 85, 247, 0.25) 100%); border: 1px solid rgba(168, 85, 247, 0.35); display: flex; align-items: center; justify-content: center; font-size: 20px; flex-shrink: 0; box-shadow: 0 4px 12px rgba(168, 85, 247, 0.15);">🔑</div>
            <div>
              <h3 id="authModalTitle" style="font-size: 17px; font-weight: 800; color: var(--text-primary); letter-spacing: -0.3px; margin: 0;">User Account & Cloud Sync</h3>
              <p id="authModalSub" style="font-size: 12px; color: var(--text-secondary); margin: 2px 0 0 0;">Sign in to sync your expenses & data securely</p>
            </div>
          </div>
          <button class="close-btn" data-close="authModal" style="width: 32px; height: 32px; border-radius: 50%; background: rgba(255, 255, 255, 0.06); border: 1px solid var(--border-color); color: var(--text-secondary); display: flex; align-items: center; justify-content: center; font-size: 18px; cursor: pointer; transition: all var(--transition-fast); flex-shrink: 0;">&times;</button>
        </div>

        <div id="authAlert" style="display: none; padding: 10px 14px; border-radius: 8px; font-size: 12.5px; margin-bottom: 16px;"></div>

        <!-- UNAUTHENTICATED SECTION (Tabs, Forms, Divider, Google OAuth) -->
        <div id="unauthSection">
          <!-- Auth Tabs -->
          <div id="authTabs" style="display: flex; border-bottom: 1px solid var(--border-color); margin-bottom: 18px; gap: 12px;">
            <button class="auth-tab-btn active" data-tab="login" style="background: none; border: none; padding: 8px 12px; color: var(--accent-primary); font-weight: 700; border-bottom: 2px solid var(--accent-primary); cursor: pointer;">Sign In</button>
            <button class="auth-tab-btn" data-tab="register" style="background: none; border: none; padding: 8px 12px; color: var(--text-secondary); font-weight: 600; cursor: pointer;">Create Account</button>
            <button class="auth-tab-btn" data-tab="forgot" style="background: none; border: none; padding: 8px 12px; color: var(--text-secondary); font-weight: 600; cursor: pointer;">Reset Password</button>
          </div>

          <!-- LOGIN FORM -->
          <form id="loginForm">
            <div class="form-group">
              <label>Email Address *</label>
              <input type="email" id="loginEmail" class="form-control" placeholder="name@example.com" required />
            </div>
            <div class="form-group">
              <label>Password *</label>
              <input type="password" id="loginPassword" class="form-control" placeholder="••••••••" required />
            </div>
            <button type="submit" class="btn btn-primary" style="width: 100%; margin-top: 8px; font-weight: 700;">
              Sign In & Sync Data
            </button>
          </form>

          <!-- REGISTER FORM -->
          <form id="registerForm" style="display: none;">
            <div class="form-group">
              <label>Full Name</label>
              <input type="text" id="regName" class="form-control" placeholder="e.g. Sourav Mahanty" />
            </div>
            <div class="form-group">
              <label>Email Address *</label>
              <input type="email" id="regEmail" class="form-control" placeholder="name@example.com" required />
            </div>
            <div class="form-group">
              <label>Password *</label>
              <input type="password" id="regPassword" class="form-control" placeholder="At least 6 characters" required minlength="6" />
            </div>
            <button type="submit" class="btn btn-success" style="width: 100%; margin-top: 8px; font-weight: 700;">
              Create New Account
            </button>
          </form>

          <!-- FORGOT PASSWORD FORM -->
          <form id="forgotForm" style="display: none;">
            <p style="font-size: 12.5px; color: var(--text-secondary); margin-bottom: 14px;">Enter your registered email address to receive a password reset link.</p>
            <div class="form-group">
              <label>Registered Email *</label>
              <input type="email" id="forgotEmail" class="form-control" placeholder="name@example.com" required />
            </div>
            <button type="submit" class="btn btn-secondary" style="width: 100%; margin-top: 8px; font-weight: 700;">
              Send Reset Link
            </button>
          </form>

          <!-- DIVIDER & GOOGLE OAUTH -->
          <div id="authDivider" style="display: flex; align-items: center; margin: 18px 0; gap: 10px;">
            <div style="flex: 1; height: 1px; background: var(--border-color);"></div>
            <span style="font-size: 11px; color: var(--text-muted); text-transform: uppercase;">or</span>
            <div style="flex: 1; height: 1px; background: var(--border-color);"></div>
          </div>

          <button id="googleAuthBtn" class="btn btn-secondary" style="width: 100%; justify-content: center; gap: 10px; font-weight: 600;">
            <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#EA4335" d="M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.7 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.4 9 5 12 5z"/><path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z"/><path fill="#FBBC05" d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.3s.2-1.6.4-2.3L1.9 7.3C.7 9.7 0 10.8 0 12s.7 2.3 1.9 4.7l3.7-2.9z"/><path fill="#34A853" d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.4-6.4-5.2L1.9 16C3.7 19.7 7.5 23 12 23z"/></svg>
            Continue with Google
          </button>
        </div>

        <!-- AUTHENTICATED USER LOGGED IN VIEW -->
        <div id="loggedInView" style="display: none; text-align: center; padding: 10px 0 6px 0;">
          <div id="userAvatarBox" style="width: 64px; height: 64px; border-radius: 50%; background: var(--grad-primary); color: white; display: flex; align-items: center; justify-content: center; font-size: 26px; font-weight: 800; margin: 0 auto 14px auto; box-shadow: 0 0 25px rgba(168, 85, 247, 0.4); text-transform: uppercase;">👤</div>
          
          <h4 id="userDisplayName" style="font-size: 18px; font-weight: 800; color: var(--text-primary); letter-spacing: -0.3px; margin-bottom: 2px;">User Name</h4>
          <p id="userDisplayEmail" style="font-size: 13px; color: var(--text-secondary); margin-bottom: 16px;">user@example.com</p>
          
          <div style="display: inline-flex; align-items: center; gap: 8px; padding: 6px 16px; background: rgba(16, 185, 129, 0.12); color: var(--accent-success); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 20px; font-size: 12px; font-weight: 600; margin-bottom: 24px;">
            <span style="width: 8px; height: 8px; border-radius: 50%; background: var(--accent-success); display: inline-block;"></span>
            <span>Cloud Sync Active</span>
          </div>

          <button id="logoutBtn" class="btn btn-danger" style="width: 100%; justify-content: center; font-weight: 700; padding: 11px 18px;">
            🚪 Sign Out of Account
          </button>
        </div>
      </div>
    </div>
  `;
}

export function initAuthModalListeners() {
  const modal = document.getElementById('authModal');
  if (!modal) return;

  const tabBtns = modal.querySelectorAll('.auth-tab-btn');
  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');
  const forgotForm = document.getElementById('forgotForm');
  const googleBtn = document.getElementById('googleAuthBtn');
  const logoutBtn = document.getElementById('logoutBtn');
  const alertBox = document.getElementById('authAlert');

  const showAlert = (msg, isError = true) => {
    if (!alertBox) return;
    alertBox.style.display = 'block';
    alertBox.style.background = isError ? 'var(--accent-danger-light)' : 'var(--accent-success-light)';
    alertBox.style.color = isError ? 'var(--accent-danger)' : 'var(--accent-success)';
    alertBox.style.border = isError ? '1px solid rgba(239,68,68,0.3)' : '1px solid rgba(16,185,129,0.3)';
    alertBox.textContent = msg;
  };

  const hideAlert = () => {
    if (alertBox) alertBox.style.display = 'none';
  };

  // Switch Auth Tabs
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      hideAlert();
      tabBtns.forEach(b => {
        b.classList.remove('active');
        b.style.color = 'var(--text-secondary)';
        b.style.borderBottom = 'none';
      });
      btn.classList.add('active');
      btn.style.color = 'var(--accent-primary)';
      btn.style.borderBottom = '2px solid var(--accent-primary)';

      const tab = btn.getAttribute('data-tab');
      loginForm.style.display = tab === 'login' ? 'block' : 'none';
      registerForm.style.display = tab === 'register' ? 'block' : 'none';
      forgotForm.style.display = tab === 'forgot' ? 'block' : 'none';
    });
  });

  const formatAuthError = (err, type = 'email') => {
    const code = err?.code || '';
    if (code === 'auth/unauthorized-domain') {
      return '⚠️ Authorized Domain Required: Go to Firebase Console → Authentication → Settings → Authorized domains and add "localhost" & "127.0.0.1".';
    }
    if (code === 'auth/popup-closed-by-user') {
      return '⚠️ Google Sign-In popup was closed before completing.';
    }
    if (code === 'auth/operation-not-allowed') {
      return '⚠️ Google Provider Disabled: Please enable Google in Firebase Console → Authentication → Sign-in method.';
    }
    if (type === 'google' && (code === 'auth/invalid-credential' || code === 'auth/user-disabled')) {
      return `⚠️ Google Sign-In failed (${code || 'invalid credential'}). Check Firebase Console → Auth settings.`;
    }
    if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
      return '⚠️ Invalid email or password. If you do not have an account yet, click "Create Account" tab.';
    }
    if (code === 'auth/email-already-in-use') {
      return '⚠️ This email is already registered. Please click "Sign In" tab instead.';
    }
    return String(err?.message || 'Authentication failed').replace(/^Firebase:\s*/i, '');
  };

  // Login Submit
  loginForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideAlert();
    const email = document.getElementById('loginEmail').value.trim();
    const pass = document.getElementById('loginPassword').value.trim();

    try {
      showAlert('⏳ Signing in...', false);
      await loginWithEmail(email, pass);
      hideAlert();
      modal.classList.remove('active');
    } catch (err) {
      console.error('[Login Error]', err);
      showAlert(formatAuthError(err));
    }
  });

  // Register Submit
  registerForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideAlert();
    const name = document.getElementById('regName').value.trim();
    const email = document.getElementById('regEmail').value.trim();
    const pass = document.getElementById('regPassword').value.trim();

    try {
      showAlert('⏳ Creating account...', false);
      await registerWithEmail(email, pass, name);
      hideAlert();
      modal.classList.remove('active');
    } catch (err) {
      console.error('[Register Error]', err);
      showAlert(formatAuthError(err));
    }
  });

  // Forgot Submit
  forgotForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideAlert();
    const email = document.getElementById('forgotEmail').value.trim();

    try {
      showAlert('⏳ Sending reset link...', false);
      await resetPassword(email);
      showAlert('✅ Password reset email sent! Check your inbox.', false);
    } catch (err) {
      console.error('[Reset Error]', err);
      showAlert(formatAuthError(err));
    }
  });

  // Google OAuth
  googleBtn?.addEventListener('click', async () => {
    hideAlert();
    try {
      showAlert('⏳ Connecting to Google...', false);
      await loginWithGoogle();
      hideAlert();
      modal.classList.remove('active');
    } catch (err) {
      console.error('[Google Auth Error]', err);
      showAlert(formatAuthError(err, 'google'));
    }
  });

  // Logout Submit
  logoutBtn?.addEventListener('click', async () => {
    try {
      await logoutUser();
      modal.classList.remove('active');
    } catch (err) {
      showAlert(err.message);
    }
  });
}

export function updateAuthModalUI(user) {
  const modal = document.getElementById('authModal');
  if (!modal) return;

  const unauthSection = document.getElementById('unauthSection');
  const loggedInView = document.getElementById('loggedInView');
  const alertBox = document.getElementById('authAlert');
  const modalIcon = document.getElementById('authHeaderIcon');
  const modalTitle = document.getElementById('authModalTitle');
  const modalSub = document.getElementById('authModalSub');

  if (alertBox) alertBox.style.display = 'none';

  if (user && !user.isAnonymous) {
    // User is logged in
    if (unauthSection) unauthSection.style.display = 'none';
    if (loggedInView) loggedInView.style.display = 'block';
    if (modalIcon) modalIcon.textContent = '👤';
    if (modalTitle) modalTitle.textContent = 'User Profile & Account';
    if (modalSub) modalSub.textContent = 'Logged in & real-time data sync active';

    const name = user.displayName || user.email?.split('@')[0] || 'User Account';
    const email = user.email || '';
    const initial = name.charAt(0).toUpperCase();

    document.getElementById('userDisplayName').textContent = name;
    document.getElementById('userDisplayEmail').textContent = email;
    document.getElementById('userAvatarBox').textContent = initial;
  } else {
    // Unauthenticated or Anonymous Guest
    if (unauthSection) unauthSection.style.display = 'block';
    if (loggedInView) loggedInView.style.display = 'none';
    if (modalIcon) modalIcon.textContent = '🔑';
    if (modalTitle) modalTitle.textContent = 'User Account & Cloud Sync';
    if (modalSub) modalSub.textContent = 'Sign in to sync your expenses & data securely';
  }
}
