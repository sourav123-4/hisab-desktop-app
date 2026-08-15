import { store } from './store.js';
import { parseNaturalLanguageHisab, parseMultipleHisabs } from './aiParser.js';
import { renderDashboardView } from './components/dashboard.js';
import { renderHisabView } from './components/hisab.js';
import { renderLoansView } from './components/loans.js';
import { renderInvestmentsView } from './components/investments.js';
import { renderSalaryView } from './components/salary.js';
import { renderDebtsView, openDebtModal } from './components/debts.js';
import { renderBudgetsView } from './components/budgets.js';
import { renderAuthModalHTML, initAuthModalListeners, updateAuthModalUI } from './components/authModal.js';
import { onAuthChange } from './firebase.js';
import { onCloudStatusChange } from './firebaseSync.js';
import { initLockScreen } from './components/lockScreen.js';
import { renderSettingsModal } from './components/settingsModal.js';
import { checkAndTriggerDesktopAlerts } from './notifications.js';

let activeTab = 'dashboard';
let currentMonthYear = getCurrentMonthYear();

let micStream: MediaStream | null = null;
let mediaRecorder: MediaRecorder | null = null;
let audioChunks: Blob[] = [];
let audioContext: any = null;
let isAudioRecording = false;

function getCurrentMonthYear(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function startApp() {
  initLockScreen();
  (window as any).showToast = showToast;

  const currentTheme = store.getTheme();
  document.documentElement.setAttribute('data-theme', currentTheme);

  checkAndTriggerDesktopAlerts();

  if (window.electronAPI && window.electronAPI.onOpenQuickAdd) {
    window.electronAPI.onOpenQuickAdd(() => {
      openModal('txModal');
    });
  }

  const modalWrap = document.createElement('div');
  modalWrap.innerHTML = renderAuthModalHTML();
  if (modalWrap.firstElementChild) {
    document.body.appendChild(modalWrap.firstElementChild);
  }
  initAuthModalListeners();

  // Instant Frame-0 Sidebar Profile Rendering from Local Cache
  try {
    const cachedRaw = localStorage.getItem('daily_hisab_last_known_user');
    if (cachedRaw) {
      const cachedUser = JSON.parse(cachedRaw);
      if (cachedUser && cachedUser.email) {
        const name = cachedUser.displayName || cachedUser.email.split('@')[0] || 'User Account';
        const email = cachedUser.email;
        const initial = name.charAt(0).toUpperCase();

        const userNameEl = document.getElementById('sidebarUserName');
        const userSubEl = document.getElementById('sidebarUserSub');
        const avatarEl = document.getElementById('sidebarAvatar');
        if (userNameEl) userNameEl.textContent = name;
        if (userSubEl) userSubEl.textContent = email;
        if (avatarEl) avatarEl.textContent = initial;

        updateAuthModalUI({ ...cachedUser, isAnonymous: false });
      }
    }
  } catch (e) {}

  onAuthChange((user: any) => {
    updateAuthModalUI(user);
    store.switchUser(user);

    const userNameEl = document.getElementById('sidebarUserName');
    const userSubEl = document.getElementById('sidebarUserSub');
    const avatarEl = document.getElementById('sidebarAvatar');

    if (user && !user.isAnonymous) {
      const name = user.displayName || user.email?.split('@')[0] || 'User Account';
      const email = user.email || '';
      const initial = name.charAt(0).toUpperCase();

      if (userNameEl) userNameEl.textContent = name;
      if (userSubEl) userSubEl.textContent = email;
      if (avatarEl) avatarEl.textContent = initial;
    } else {
      if (userNameEl) userNameEl.textContent = 'Sign In / Account';
      if (userSubEl) userSubEl.textContent = 'Cloud Sync Account';
      if (avatarEl) avatarEl.textContent = '🔑';
    }
  });

  document.getElementById('sidebarUserProfile')?.addEventListener('click', () => {
    openModal('authModal');
  });
  document.getElementById('cloudSyncBadge')?.addEventListener('click', () => {
    openModal('authModal');
  });

  onCloudStatusChange((isConnected: boolean) => {
    const badge = document.getElementById('cloudSyncBadge');
    if (!badge) return;
    if (isConnected) {
      badge.style.background = 'rgba(16, 185, 129, 0.12)';
      badge.style.color = 'var(--accent-success)';
      badge.style.borderColor = 'rgba(16, 185, 129, 0.3)';
      badge.innerHTML = '<span style="width: 8px; height: 8px; border-radius: 50%; background: var(--accent-success); display: inline-block;"></span><span>Cloud Synced</span>';
    } else {
      badge.style.background = 'rgba(245, 158, 11, 0.12)';
      badge.style.color = 'var(--accent-warning)';
      badge.style.borderColor = 'rgba(245, 158, 11, 0.3)';
      badge.innerHTML = '<span style="width: 8px; height: 8px; border-radius: 50%; background: var(--accent-warning); display: inline-block;"></span><span>Local Mode</span>';
    }
  });

  // Global Keyboard Escape Listener to Close Open Modals
  document.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      stopAudioRecording();
      document.querySelectorAll('.modal-overlay.active').forEach(modal => {
        closeModal(modal.id);
      });
    }
  });

  // Global Event Delegation for Modal Close Buttons
  document.addEventListener('click', (e: any) => {
    const closeBtn = e.target.closest('[data-close]');
    if (closeBtn) {
      const modalId = closeBtn.getAttribute('data-close');
      if (modalId) {
        if (modalId === 'voiceModal') stopAudioRecording();
        closeModal(modalId);
      }
    }
  });

  // Global Backdrop Overlay Click to Close Modal
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e: any) => {
      if (e.target === overlay) {
        if (overlay.id === 'voiceModal') stopAudioRecording();
        closeModal(overlay.id);
      }
    });
  });

  let updateDebounceTimer: any = null;
  window.onHisabStoreUpdate = () => {
    if (updateDebounceTimer) clearTimeout(updateDebounceTimer);
    updateDebounceTimer = setTimeout(() => {
      document.documentElement.setAttribute('data-theme', store.getTheme());
      renderCurrentTab();
      checkAndTriggerDesktopAlerts();
    }, 50);
  };

  document.getElementById('themeToggleBtn')?.addEventListener('click', () => {
    renderSettingsModal();
  });

  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
      item.classList.add('active');

      activeTab = item.getAttribute('data-tab') || 'dashboard';
      renderCurrentTab();
    });
  });

  const monthSelector = document.getElementById('monthSelector') as HTMLSelectElement | null;
  if (monthSelector) {
    monthSelector.value = currentMonthYear;
    monthSelector.addEventListener('change', (e: any) => {
      currentMonthYear = e.target.value || getCurrentMonthYear();
      renderCurrentTab();
    });
  }

  document.getElementById('prevMonthBtn')?.addEventListener('click', () => {
    currentMonthYear = changeMonth(currentMonthYear, -1);
    if (monthSelector) monthSelector.value = currentMonthYear;
    renderCurrentTab();
  });

  document.getElementById('nextMonthBtn')?.addEventListener('click', () => {
    currentMonthYear = changeMonth(currentMonthYear, 1);
    if (monthSelector) monthSelector.value = currentMonthYear;
    renderCurrentTab();
  });

  document.getElementById('topQuickAddBtn')?.addEventListener('click', () => {
    openModal('txModal');
  });

  // Top Bar AI Smart Entry Setup
  const aiInput = document.getElementById('aiSmartInput') as HTMLInputElement | null;
  const aiSaveBtn = document.getElementById('aiSaveBtn');
  const aiVoiceBtn = document.getElementById('aiVoiceBtn');

  const processAISmartSave = () => {
    const input = (document.getElementById('aiSmartInput') as HTMLInputElement | null) || (document.getElementById('dashboardAiInput') as HTMLInputElement | null);
    if (!input) return;
    const text = input.value.trim();
    if (!text) return;

    const items = parseMultipleHisabs(text);
    if (items.length > 0) {
      const summaryItems: string[] = [];
      items.forEach(item => {
        const lower = text.toLowerCase();
        if (/given|lent|borrowed|udhar|diya|diye|liya|liye/i.test(lower)) {
          const isLent = /given|lent|diya|diye/i.test(lower);
          let name = item.title || 'Someone';
          name = name.replace(/^(Money Given to|Money Borrowed from|Given|Lent|Borrowed|Udhar)\s+/i, '').trim();
          if (!name || name.length < 2) name = 'Someone';

          store.addDebt({
            personName: name,
            type: isLent ? 'lent' : 'borrowed',
            amount: item.amount || 0,
            date: item.date || new Date().toISOString().split('T')[0],
            notes: `AI Smart Entry: "${text}"`
          });
          summaryItems.push(`🤝 ${isLent ? 'Given to' : 'Borrowed from'} ${name} (₹${(item.amount || 0).toLocaleString('en-IN')})`);
        } else {
          store.addTransaction(item);
          summaryItems.push(`📌 ${item.title || 'Entry'} (₹${(item.amount || 0).toLocaleString('en-IN')}) • ${item.category || 'General'}`);
        }
      });

      showToast(`✨ Entry Done: ${summaryItems.join(' | ')}`);
      input.value = '';
      input.blur();
      if (aiInput) {
        aiInput.value = '';
        aiInput.blur();
      }
      renderCurrentTab();
    } else {
      showToast(`⚠️ Please include an amount (e.g. 'fish 400' or 'given 5000 to tapas mamu')`, 'warning');
    }
  };

  aiSaveBtn?.addEventListener('click', processAISmartSave);
  aiInput?.addEventListener('keydown', (e: any) => {
    if (e.key === 'Enter') processAISmartSave();
  });

  // Voice Recording & Dictation Event Listeners
  aiVoiceBtn?.addEventListener('click', () => {
    if (isAudioRecording) {
      stopAudioRecording();
    } else {
      startAudioRecording();
    }
  });

  const macDictationBtn = document.getElementById('macDictationBtn');
  if (macDictationBtn) {
    macDictationBtn.addEventListener('click', () => {
      if (isAudioRecording) {
        stopAudioRecording();
      } else {
        startAudioRecording();
      }
    });
  }

  const toggleRecordBtn = document.getElementById('toggleRecordBtn');
  if (toggleRecordBtn) {
    toggleRecordBtn.addEventListener('click', () => {
      if (isAudioRecording) {
        stopAudioRecording();
      } else {
        startAudioRecording();
      }
    });
  }

  const voiceTranscriptInput = document.getElementById('voiceTranscriptInput') as HTMLTextAreaElement | null;
  if (voiceTranscriptInput) {
    voiceTranscriptInput.addEventListener('input', updateVoicePreview);
    voiceTranscriptInput.addEventListener('keyup', updateVoicePreview);
  }

  const submitVoiceBtn = document.getElementById('submitVoiceBtn');
  if (submitVoiceBtn) {
    submitVoiceBtn.addEventListener('click', handleVoiceSubmit);
  }

  const container = document.getElementById('contentContainer');
  if (container) {
    container.addEventListener('click', (e: any) => {
      if (e.target.id === 'dashboardAddTxBtn' || e.target.id === 'addHisabBtn') {
        openModal('txModal');
      } else if (e.target.id === 'addLoanBtn') {
        openModal('loanModal');
      } else if (e.target.id === 'addInvestmentBtn') {
        openModal('invModal');
      } else if (e.target.id === 'editSalaryBtn') {
        openModal('salaryModal');
      } else if (e.target.id === 'addDebtBtn') {
        openModal('debtModal');
      } else if (e.target.id === 'dashboardAiSaveBtn') {
        processAISmartSave();
      }
    });

    container.addEventListener('keydown', (e: any) => {
      if (e.target.id === 'dashboardAiInput' && e.key === 'Enter') {
        processAISmartSave();
      }
    });
  }

  setupForms();
  renderCurrentTab();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startApp);
} else {
  startApp();
}

// MediaRecorder Audio Capture Controller
async function startAudioRecording() {
  openModal('voiceModal');

  const statusText = document.getElementById('voiceStatusText');
  const toggleBtn = document.getElementById('toggleRecordBtn');
  const micCircle = document.querySelector('.mic-circle') as HTMLElement | null;
  const transcriptInput = document.getElementById('voiceTranscriptInput') as HTMLTextAreaElement | null;

  if (transcriptInput) {
    transcriptInput.focus();
  }
  updateVoicePreview();

  audioChunks = [];
  isAudioRecording = false;

  try {
    micStream = await navigator.mediaDevices.getUserMedia({ audio: true });

    const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/wav'].find(t =>
      MediaRecorder.isTypeSupported(t)
    );

    mediaRecorder = mimeType
      ? new MediaRecorder(micStream, { mimeType })
      : new MediaRecorder(micStream);
    audioChunks = [];

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) audioChunks.push(e.data);
    };

    mediaRecorder.onstop = async () => {
      if (micStream) {
        micStream.getTracks().forEach(t => t.stop());
        micStream = null;
      }
      if (audioContext) {
        try { audioContext.close(); } catch (e) {}
        audioContext = null;
      }

      if (audioChunks.length === 0) {
        if (statusText) {
          statusText.style.color = 'var(--accent-warning)';
          statusText.textContent = '⚠️ No audio captured. Click "Start Voice Recording" to try again.';
        }
        return;
      }

      const blob = new Blob(audioChunks, { type: mediaRecorder?.mimeType || 'audio/webm' });
      audioChunks = [];

      if (blob.size < 1200) {
        if (statusText) {
          statusText.style.color = 'var(--accent-warning)';
          statusText.textContent = '⚠️ Recording too short — speak longer.';
        }
        return;
      }

      if (statusText) {
        statusText.style.color = 'var(--accent-primary)';
        statusText.textContent = '⏳ Transcribing audio...';
      }

      let audioBuffer: ArrayBuffer;
      let audioMime: string;
      try {
        const raw = await blob.arrayBuffer();
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const decoded = await ctx.decodeAudioData(raw.slice(0));
        const n = decoded.length;
        const mono = new Float32Array(n);
        for (let c = 0; c < decoded.numberOfChannels; c++) {
          const ch = decoded.getChannelData(c);
          for (let i = 0; i < n; i++) mono[i] += ch[i] / decoded.numberOfChannels;
        }
        const wav = new DataView(new ArrayBuffer(44 + n * 2));
        const wr = (off: number, s: string) => { for (let i = 0; i < s.length; i++) wav.setUint8(off + i, s.charCodeAt(i)); };
        wr(0, 'RIFF'); wav.setUint32(4, 36 + n * 2, true); wr(8, 'WAVE');
        wr(12, 'fmt '); wav.setUint32(16, 16, true); wav.setUint16(20, 1, true);
        wav.setUint16(22, 1, true); wav.setUint32(24, decoded.sampleRate || 16000, true);
        wav.setUint32(28, (decoded.sampleRate || 16000) * 2, true);
        wav.setUint16(32, 2, true); wav.setUint16(34, 16, true);
        wr(36, 'data'); wav.setUint32(40, n * 2, true);
        for (let i = 0; i < n; i++) {
          const s = Math.max(-1, Math.min(1, mono[i]));
          wav.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
        }
        audioBuffer = wav.buffer;
        audioMime = 'audio/wav';
      } catch (convErr: any) {
        audioBuffer = await blob.arrayBuffer();
        audioMime = blob.type;
      }

      try {
        let res: any;
        if (window.electronAPI?.transcribeAudio) {
          res = await window.electronAPI.transcribeAudio(audioBuffer, audioMime);
        } else {
          res = { success: false, error: 'Transcription service offline.' };
        }

        if (res && res.success && res.text) {
          const cleanText = String(res.text || '').replace(/\$/g, '₹').replace(/\b(?:USD|dollars?|dollar)\b/gi, 'rupees').trim();
          if (transcriptInput) {
            transcriptInput.value = cleanText;
            updateVoicePreview();
          }
          if (statusText) {
            statusText.style.color = 'var(--accent-success)';
            statusText.textContent = '✅ Audio Transcribed! Click "Process & Save All" below.';
          }
        } else {
          const errMsg = res?.error || "Couldn't transcribe audio — speak clearly or type text.";
          if (transcriptInput && transcriptInput.value.trim()) {
            updateVoicePreview();
            if (statusText) {
              statusText.style.color = 'var(--accent-success)';
              statusText.textContent = '✅ Ready to process! Click "Process & Save All" below.';
            }
          } else if (statusText) {
            statusText.style.color = 'var(--accent-warning)';
            statusText.textContent = `⚠️ ${errMsg}`;
          }
        }
      } catch (err) {
        if (transcriptInput && transcriptInput.value.trim()) {
          updateVoicePreview();
        } else if (statusText) {
          statusText.style.color = 'var(--accent-warning)';
          statusText.textContent = '⚠️ Audio transcription error. Please try again.';
        }
      }
    };

    mediaRecorder.start();
    isAudioRecording = true;

    // Real-Time Audio Visualizer
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    audioContext = new AudioCtx();
    const source = audioContext.createMediaStreamSource(micStream);
    const analyser = audioContext.createAnalyser();
    source.connect(analyser);
    analyser.fftSize = 64;

    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    const updateVol = () => {
      if (!isAudioRecording) return;
      analyser.getByteFrequencyData(dataArray);
      const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
      if (micCircle) {
        micCircle.style.transform = `scale(${1 + Math.min(avg / 90, 0.5)})`;
        micCircle.style.boxShadow = `0 0 ${15 + Math.min(avg / 3, 30)}px rgba(239, 68, 68, 0.6)`;
      }
      requestAnimationFrame(updateVol);
    };
    updateVol();

    if (toggleBtn) {
      toggleBtn.innerHTML = '⏹️ Stop & Transcribe';
      toggleBtn.className = 'btn btn-danger btn-sm';
    }
    if (statusText) {
      statusText.style.color = '#ef4444';
      statusText.textContent = '🔴 Recording Audio... Speak now, then click "Stop & Transcribe"';
    }
  } catch (micErr) {
    isAudioRecording = false;
    if (micStream) {
      micStream.getTracks().forEach(t => t.stop());
      micStream = null;
    }
    if (statusText) {
      statusText.style.color = 'var(--accent-warning)';
      statusText.textContent = '❌ Microphone access denied — Enable mic permissions in macOS System Settings → Privacy & Security → Microphone.';
    }
  }
}

function stopAudioRecording() {
  if (!isAudioRecording) return;
  isAudioRecording = false;

  const statusText = document.getElementById('voiceStatusText');
  const toggleBtn = document.getElementById('toggleRecordBtn');
  const micCircle = document.querySelector('.mic-circle') as HTMLElement | null;

  if (toggleBtn) {
    toggleBtn.innerHTML = '🔴 Start Voice Recording';
    toggleBtn.className = 'btn btn-secondary btn-sm';
  }
  if (micCircle) {
    micCircle.style.transform = 'scale(1)';
    micCircle.style.boxShadow = 'none';
  }

  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    if (statusText) {
      statusText.style.color = 'var(--accent-primary)';
      statusText.textContent = '⏳ Transcribing audio...';
    }
    mediaRecorder.stop();
  }
}

function updateVoicePreview() {
  const transcriptInput = document.getElementById('voiceTranscriptInput') as HTMLTextAreaElement | null;
  const previewEl = document.getElementById('voicePreviewItems');
  if (!previewEl) return;

  const text = transcriptInput?.value.trim() || '';
  const items = parseMultipleHisabs(text);

  if (items.length === 0) {
    previewEl.innerHTML = '<span style="color: var(--text-muted); font-style: italic;">No transactions detected yet... Speak e.g. "given 5000 to tapas mamu, 350 petrol"</span>';
  } else {
    previewEl.innerHTML = `
      <div style="font-size: 11px; font-weight: 700; color: var(--accent-primary); margin-bottom: 6px;">
        Found ${items.length} ${items.length > 1 ? 'Hisab Entries' : 'Entry'}:
      </div>
      ${items.map(item => `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 4px 0; border-bottom: 1px dashed rgba(255,255,255,0.08);">
          <span>📌 <strong>${escapeHTML(item.title || '')}</strong> <span style="font-size: 10.5px; opacity: 0.8;">(${escapeHTML(item.category || '')})</span></span>
          <span style="font-weight: 700; color: var(--accent-success);">₹${(item.amount || 0).toLocaleString('en-IN')} <span style="font-size: 10.5px; opacity: 0.8;">(${escapeHTML(item.paymentMethod || 'UPI')})</span></span>
        </div>
      `).join('')}
    `;
  }
}

function handleVoiceSubmit() {
  const voiceTranscriptInput = document.getElementById('voiceTranscriptInput') as HTMLTextAreaElement | null;
  const text = voiceTranscriptInput?.value.trim();
  if (!text) {
    showToast('⚠️ No text to save — speak or type transactions first.', 'warning');
    return;
  }

  const items = parseMultipleHisabs(text);
  if (items.length > 0) {
    const summaryItems: string[] = [];
    items.forEach(item => {
      const lower = text.toLowerCase();
      if (/given|lent|borrowed|udhar|diya|diye|liya|liye/i.test(lower)) {
        const isLent = /given|lent|diya|diye/i.test(lower);
        let name = item.title || 'Someone';
        name = name.replace(/^(Money Given to|Money Borrowed from|Given|Lent|Borrowed|Udhar)\s+/i, '').trim();
        if (!name || name.length < 2) name = 'Someone';

        store.addDebt({
          personName: name,
          type: isLent ? 'lent' : 'borrowed',
          amount: item.amount || 0,
          date: item.date || new Date().toISOString().split('T')[0],
          notes: `AI Voice Entry: "${text}"`
        });
        summaryItems.push(`🤝 ${isLent ? 'Given to' : 'Borrowed from'} ${name} (₹${(item.amount || 0).toLocaleString('en-IN')})`);
      } else {
        store.addTransaction(item);
        summaryItems.push(`📌 ${item.title || 'Entry'} (₹${(item.amount || 0).toLocaleString('en-IN')}) • ${item.category || 'General'}`);
      }
    });

    showToast(`🎙️ Voice Entry Done: ${summaryItems.join(' | ')}`);
    stopAudioRecording();
    closeModal('voiceModal');
    if (voiceTranscriptInput) voiceTranscriptInput.value = '';
    renderCurrentTab();
  } else {
    showToast(`⚠️ Please include amounts (e.g. 'Paid 350 for groceries')`, 'warning');
  }
}

function showToast(message: string, type: string = 'success') {
  const existing = document.querySelectorAll('.toast-notification');
  existing.forEach(e => e.remove());

  const toast = document.createElement('div');
  toast.className = 'toast-notification';
  if (type === 'warning') {
    toast.style.borderColor = 'var(--accent-warning, #f59e0b)';
    toast.style.boxShadow = '0 10px 30px rgba(245, 158, 11, 0.35)';
  } else {
    toast.style.borderColor = 'var(--accent-success, #10b981)';
    toast.style.boxShadow = '0 10px 30px rgba(16, 185, 129, 0.35)';
  }
  toast.style.background = 'rgba(15, 23, 42, 0.95)';
  toast.style.color = '#f8fafc';
  toast.style.backdropFilter = 'blur(16px)';
  toast.style.fontSize = '14px';
  toast.style.fontWeight = '700';
  toast.style.padding = '14px 22px';
  toast.style.borderRadius = '16px';

  toast.innerHTML = message;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(20px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 4500);
}

function renderCurrentTab() {
  const container = document.getElementById('contentContainer');
  if (!container) return;
  container.innerHTML = '';

  switch (activeTab) {
    case 'hisab':
      renderHisabView(container, currentMonthYear);
      break;
    case 'loans':
      renderLoansView(container, currentMonthYear);
      break;
    case 'investments':
      renderInvestmentsView(container, currentMonthYear);
      break;
    case 'salary':
      renderSalaryView(container, currentMonthYear);
      break;
    case 'debts':
      renderDebtsView(container, currentMonthYear);
      break;
    case 'budgets':
      renderBudgetsView(container, currentMonthYear);
      break;
    default:
      renderDashboardView(container, currentMonthYear);
  }
}

function openModal(modalId: string) {
  const modal = document.getElementById(modalId);
  if (!modal) return;

  if (modalId === 'txModal') {
    const form = document.getElementById('txForm') as HTMLFormElement | null;
    if (form && !form.dataset.editingId) {
      form.reset();
      const editIdInput = document.getElementById('txEditId') as HTMLInputElement | null;
      if (editIdInput) editIdInput.value = '';
      const dateInput = document.getElementById('txDate') as HTMLInputElement | null;
      if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];
      const modalTitle = document.querySelector('#txModal .modal-header h3');
      if (modalTitle) modalTitle.textContent = 'Add Daily Hisab Entry';
    }
  } else if (modalId === 'salaryModal') {
    const dateInput = document.getElementById('salDate') as HTMLInputElement | null;
    if (dateInput) dateInput.value = `${currentMonthYear}-01`;
  } else if (modalId === 'debtModal') {
    const form = document.getElementById('debtForm') as HTMLFormElement | null;
    if (!form?.dataset.editingId) {
      openDebtModal();
      return;
    }
  } else if (modalId === 'loanModal') {
    const form = document.getElementById('loanForm') as HTMLFormElement | null;
    if (form && !form.dataset.editingId) {
      form.reset();
      delete form.dataset.editingId;
      const editIdInput = document.getElementById('loanEditId') as HTMLInputElement | null;
      if (editIdInput) editIdInput.value = '';
    }
  } else if (modalId === 'invModal') {
    const form = document.getElementById('invForm') as HTMLFormElement | null;
    if (form && !form.dataset.editingId) {
      form.reset();
      delete form.dataset.editingId;
      const editIdInput = document.getElementById('invEditId') as HTMLInputElement | null;
      if (editIdInput) editIdInput.value = '';
    }
  }

  modal.classList.add('active');
  setTimeout(() => {
    const firstInput = modal.querySelector('input:not([type="hidden"]), select, textarea') as HTMLElement | null;
    if (firstInput) firstInput.focus();
  }, 100);
}

function closeModal(modalId: string) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('active');
    const activeEl = document.activeElement as HTMLElement | null;
    if (activeEl && modal.contains(activeEl)) {
      activeEl.blur();
    }
    const form = modal.querySelector('form') as HTMLFormElement | null;
    if (form) {
      delete form.dataset.editingId;
      form.reset();
      const hiddenInputs = form.querySelectorAll('input[type="hidden"]');
      hiddenInputs.forEach(i => (i as HTMLInputElement).value = '');
    }
  }
}

function setupForms() {
  document.getElementById('txForm')?.addEventListener('submit', (e: any) => {
    e.preventDefault();
    const form = e.target;
    const editingId = form.dataset.editingId || (document.getElementById('txEditId') as HTMLInputElement)?.value;

    const txData = {
      title: (document.getElementById('txTitle') as HTMLInputElement).value,
      amount: parseFloat((document.getElementById('txAmount') as HTMLInputElement).value) || 0,
      category: (document.getElementById('txCategory') as HTMLSelectElement).value,
      type: (document.getElementById('txType') as HTMLSelectElement).value as any,
      paymentMethod: (document.getElementById('txPaymentMethod') as HTMLSelectElement).value,
      date: (document.getElementById('txDate') as HTMLInputElement).value,
      notes: (document.getElementById('txNotes') as HTMLInputElement).value
    };

    if (editingId) {
      store.editTransaction(editingId, txData);
      delete form.dataset.editingId;
      const editIdInput = document.getElementById('txEditId') as HTMLInputElement | null;
      if (editIdInput) editIdInput.value = '';
      showToast(`✨ Updated: ${txData.title} (₹${txData.amount.toLocaleString('en-IN')})`);
    } else {
      store.addTransaction(txData);
      showToast(`✨ Entry Done: ${txData.title} (₹${txData.amount.toLocaleString('en-IN')}) • ${txData.category}`);
    }

    closeModal('txModal');
    form.reset();
    renderCurrentTab();
  });

  document.getElementById('loanForm')?.addEventListener('submit', (e: any) => {
    e.preventDefault();
    const form = e.target;
    const editingId = form.dataset.editingId || (document.getElementById('loanEditId') as HTMLInputElement)?.value;

    const loanData = {
      name: (document.getElementById('loanName') as HTMLInputElement).value,
      lender: (document.getElementById('loanLender') as HTMLInputElement).value,
      totalPrincipal: parseFloat((document.getElementById('loanTotalAmount') as HTMLInputElement)?.value || (document.getElementById('loanPrincipal') as HTMLInputElement)?.value) || 0,
      remainingAmount: parseFloat((document.getElementById('loanRemainingAmount') as HTMLInputElement)?.value || (document.getElementById('loanRemaining') as HTMLInputElement)?.value) || 0,
      monthlyEmi: parseFloat((document.getElementById('loanMonthlyEmi') as HTMLInputElement)?.value || (document.getElementById('loanEmi') as HTMLInputElement)?.value) || 0,
      emiDay: parseInt((document.getElementById('loanDueDay') as HTMLInputElement).value) || 5
    };

    if (editingId) {
      store.editLoan(editingId, loanData);
      delete form.dataset.editingId;
      const editIdInput = document.getElementById('loanEditId') as HTMLInputElement | null;
      if (editIdInput) editIdInput.value = '';
      showToast(`✨ Updated Loan: ${loanData.name}`);
    } else {
      store.addLoan(loanData);
      showToast(`✨ Loan Saved: ${loanData.name} (EMI ₹${loanData.monthlyEmi.toLocaleString('en-IN')})`);
    }

    closeModal('loanModal');
    form.reset();
    renderCurrentTab();
  });

  document.getElementById('invForm')?.addEventListener('submit', (e: any) => {
    e.preventDefault();
    const form = e.target;
    const editingId = form.dataset.editingId || (document.getElementById('invEditId') as HTMLInputElement)?.value;

    const invData = {
      name: (document.getElementById('invName') as HTMLInputElement).value,
      category: (document.getElementById('invCategory') as HTMLSelectElement).value,
      type: (document.getElementById('invType') as HTMLSelectElement).value,
      monthlySip: parseFloat((document.getElementById('invMonthlySip') as HTMLInputElement).value) || 0,
      platform: (document.getElementById('invPlatform') as HTMLInputElement).value,
      totalInvested: parseFloat((document.getElementById('invTotalInvested') as HTMLInputElement).value) || 0,
      currentValue: parseFloat((document.getElementById('invCurrentValue') as HTMLInputElement).value) || 0
    };

    if (editingId) {
      store.editInvestment(editingId, invData);
      delete form.dataset.editingId;
      const editIdInput = document.getElementById('invEditId') as HTMLInputElement | null;
      if (editIdInput) editIdInput.value = '';
      showToast(`✨ Updated Investment: ${invData.name}`);
    } else {
      store.addInvestment(invData);
      showToast(`✨ Investment Saved: ${invData.name} (₹${invData.currentValue.toLocaleString('en-IN')})`);
    }

    closeModal('invModal');
    form.reset();
    renderCurrentTab();
  });

  document.getElementById('salaryForm')?.addEventListener('submit', (e: any) => {
    e.preventDefault();
    const grossVal = parseFloat((document.getElementById('salGross') as HTMLInputElement).value) || 0;
    const dedVal = parseFloat((document.getElementById('salDeductions') as HTMLInputElement).value) || 0;
    const netInputVal = (document.getElementById('salNet') as HTMLInputElement).value;
    const netVal = netInputVal ? parseFloat(netInputVal) : (grossVal - dedVal);

    store.addOrUpdateSalary({
      monthYear: currentMonthYear,
      company: (document.getElementById('salCompany') as HTMLInputElement).value,
      grossAmount: grossVal,
      deductions: dedVal,
      netAmount: netVal,
      receivedDate: (document.getElementById('salDate') as HTMLInputElement).value,
      status: 'credited'
    });
    showToast(`💰 Salary Recorded: ₹${netVal.toLocaleString('en-IN')} for ${currentMonthYear}`);
    closeModal('salaryModal');
    e.target.reset();
    renderCurrentTab();
  });

  document.getElementById('debtForm')?.addEventListener('submit', (e: any) => {
    e.preventDefault();
    const form = e.target;
    const editingId = form.dataset.editingId || (document.getElementById('debtEditId') as HTMLInputElement)?.value;

    const debtData = {
      personName: (document.getElementById('debtPersonName') as HTMLInputElement).value,
      type: (document.getElementById('debtType') as HTMLSelectElement).value as any,
      amount: parseFloat((document.getElementById('debtAmount') as HTMLInputElement).value) || 0,
      settledAmount: parseFloat((document.getElementById('debtSettledAmount') as HTMLInputElement).value) || 0,
      date: (document.getElementById('debtDate') as HTMLInputElement).value || new Date().toISOString().split('T')[0],
      dueDate: (document.getElementById('debtDueDate') as HTMLInputElement).value || '',
      notes: (document.getElementById('debtNotes') as HTMLInputElement).value || ''
    };

    if (editingId) {
      store.editDebt(editingId, debtData);
      delete form.dataset.editingId;
      const editIdInput = document.getElementById('debtEditId') as HTMLInputElement | null;
      if (editIdInput) editIdInput.value = '';
      showToast(`✨ Updated Udhar: ${debtData.personName} (₹${debtData.amount.toLocaleString('en-IN')})`);
    } else {
      store.addDebt(debtData);
      const actionLabel = debtData.type === 'lent' ? 'Given to' : 'Borrowed from';
      showToast(`🤝 Udhar Entry Done: ${actionLabel} ${debtData.personName} (₹${debtData.amount.toLocaleString('en-IN')})`);
    }

    closeModal('debtModal');
    form.reset();
    renderCurrentTab();
  });
}

function changeMonth(monthStr: string, delta: number): string {
  const [yearStr, mStr] = monthStr.split('-');
  let year = parseInt(yearStr);
  let month = parseInt(mStr) + delta;

  if (month > 12) {
    month = 1;
    year++;
  } else if (month < 1) {
    month = 12;
    year--;
  }

  return `${year}-${String(month).padStart(2, '0')}`;
}

function formatMonthDisplay(monthStr: string): string {
  const [yearStr, mStr] = monthStr.split('-');
  const date = new Date(parseInt(yearStr), parseInt(mStr) - 1, 1);
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function escapeHTML(str: string): string {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
