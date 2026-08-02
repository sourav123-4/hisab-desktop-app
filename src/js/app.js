import { store } from './store.js';
import { parseNaturalLanguageHisab, parseMultipleHisabs } from './aiParser.js';
import { renderDashboardView } from './components/dashboard.js';
import { renderHisabView } from './components/hisab.js';
import { renderLoansView } from './components/loans.js';
import { renderInvestmentsView } from './components/investments.js';
import { renderSalaryView } from './components/salary.js';
import { renderBudgetsView } from './components/budgets.js';
import { renderAuthModalHTML, initAuthModalListeners, updateAuthModalUI } from './components/authModal.js';
import { onAuthChange } from './firebase.js';
import { onCloudStatusChange, fullSyncToCloud } from './firebaseSync.js';

let activeTab = 'dashboard';
let currentMonthYear = getCurrentMonthYear();

function getCurrentMonthYear() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

document.addEventListener('DOMContentLoaded', () => {
  // Inject Auth Modal into DOM
  const modalWrap = document.createElement('div');
  modalWrap.innerHTML = renderAuthModalHTML();
  document.body.appendChild(modalWrap.firstElementChild);
  initAuthModalListeners();

  // Listen to Firebase Auth State Changes
  onAuthChange((user) => {
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

  // Open Auth Modal when clicking Sidebar User Profile or Cloud Badge
  document.getElementById('sidebarUserProfile')?.addEventListener('click', () => {
    document.getElementById('authModal')?.classList.add('active');
  });
  document.getElementById('cloudSyncBadge')?.addEventListener('click', () => {
    document.getElementById('authModal')?.classList.add('active');
  });

  // Listen to Firestore Cloud Connection Status
  onCloudStatusChange((isConnected) => {
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

  // Real-time Cloud Store Listener -> Debounced UI Re-render
  let updateDebounceTimer = null;
  window.onHisabStoreUpdate = () => {
    if (updateDebounceTimer) clearTimeout(updateDebounceTimer);
    updateDebounceTimer = setTimeout(() => {
      renderCurrentTab();
    }, 150);
  };

  // Initialize Theme from store
  const updateThemeBtnText = () => {
    const themeBtn = document.getElementById('themeToggleBtn');
    if (!themeBtn) return;
    const isLight = document.body.getAttribute('data-theme') === 'light';
    themeBtn.textContent = isLight ? '☀️ Switch to Dark Theme' : '🌙 Switch to Light Theme';
  };

  if (store.data.theme === 'light') {
    document.body.setAttribute('data-theme', 'light');
  }
  updateThemeBtnText();

  // Theme Toggle Handler
  document.getElementById('themeToggleBtn')?.addEventListener('click', () => {
    const isLight = document.body.getAttribute('data-theme') === 'light';
    const newTheme = isLight ? 'dark' : 'light';
    if (newTheme === 'light') {
      document.body.setAttribute('data-theme', 'light');
    } else {
      document.body.removeAttribute('data-theme');
    }
    store.data.theme = newTheme;
    store.save();
    updateThemeBtnText();
    renderCurrentTab();
  });

  // AI Smart Voice & Text Natural Language Auto Save
  const aiInput = document.getElementById('aiSmartInput');
  const aiSaveBtn = document.getElementById('aiSaveBtn');
  const aiVoiceBtn = document.getElementById('aiVoiceBtn');

  const processAISmartSave = () => {
    if (!aiInput) return;
    const text = aiInput.value.trim();
    if (!text) return;

    const items = parseMultipleHisabs(text);
    if (items.length > 0) {
      items.forEach(item => store.addTransaction(item));
      showToast(`✨ AI Saved ${items.length} ${items.length > 1 ? 'Entries' : 'Entry'}!`);
      aiInput.value = '';
      renderCurrentTab();
    } else {
      showToast(`⚠️ Please include an amount (e.g. 'Paid 350 for lunch via UPI')`, 'warning');
    }
  };

  aiSaveBtn?.addEventListener('click', processAISmartSave);
  aiInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') processAISmartSave();
  });

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const voiceTranscriptInput = document.getElementById('voiceTranscriptInput');
  const submitVoiceBtn = document.getElementById('submitVoiceBtn');
  const toggleRecordBtn = document.getElementById('toggleRecordBtn');
  const macDictationBtn = document.getElementById('macDictationBtn');
  const voiceStatusText = document.getElementById('voiceStatusText');

  let speechRecInstance = null;
  let audioContext = null;
  let micStream = null;
  let mediaRecorder = null;
  let audioChunks = [];
  let isRecording = false;

  const updateVoicePreview = () => {
    const text = voiceTranscriptInput?.value.trim();
    const items = parseMultipleHisabs(text);
    const previewEl = document.getElementById('voicePreviewItems');
    if (!previewEl) return;

    if (items.length === 0) {
      previewEl.innerHTML = '<span style="color: var(--text-muted); font-style: italic;">No transactions detected yet... Speak e.g. "350 petrol, 500 grocery"</span>';
    } else {
      previewEl.innerHTML = `
        <div style="font-size: 11px; font-weight: 700; color: var(--accent-primary); margin-bottom: 6px;">
          Found ${items.length} ${items.length > 1 ? 'Hisab Entries' : 'Entry'}:
        </div>
        ${items.map(item => `
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 4px 0; border-bottom: 1px dashed rgba(255,255,255,0.08);">
            <span>📌 <strong>${escapeHTML(item.title)}</strong> <span style="font-size: 10.5px; opacity: 0.8;">(${escapeHTML(item.category)})</span></span>
            <span style="font-weight: 700; color: var(--accent-success);">₹${item.amount.toLocaleString('en-IN')} <span style="font-size: 10.5px; opacity: 0.8;">(${escapeHTML(item.paymentMethod)})</span></span>
          </div>
        `).join('')}
      `;
    }
  };

  voiceTranscriptInput?.addEventListener('input', updateVoicePreview);
  voiceTranscriptInput?.addEventListener('keyup', updateVoicePreview);

  macDictationBtn?.addEventListener('click', async () => {
    if (voiceTranscriptInput) {
      voiceTranscriptInput.focus();
    }
    if (window.electronAPI?.triggerDictation) {
      await window.electronAPI.triggerDictation();
    }
    showToast('🎙️ System Dictation Triggered: Speak your transactions now!');
  });

  const stopAndTranscribe = () => {
    console.log('[Voice] stopAndTranscribe called, isRecording:', isRecording);
    if (!isRecording) return;
    isRecording = false;

    if (toggleRecordBtn) {
      toggleRecordBtn.innerHTML = '🔴 Start Voice Recording';
      toggleRecordBtn.className = 'btn btn-danger btn-sm';
    }
    const micCircle = document.querySelector('.mic-circle');
    if (micCircle) micCircle.style.transform = 'scale(1)';

    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      if (voiceStatusText) voiceStatusText.textContent = '⏳ Transcribing with Groq Whisper AI...';
      console.log('[Voice] Calling mediaRecorder.stop(), state:', mediaRecorder.state);
      mediaRecorder.stop();
    } else {
      console.log('[Voice] mediaRecorder not active:', mediaRecorder?.state);
      if (voiceStatusText) voiceStatusText.textContent = '⚠️ No audio recorded.';
    }
  };

  const startAudioRecording = async () => {
    console.log('[Voice] startAudioRecording called');
    audioChunks = [];
    isRecording = false; // will set true after successful setup

    try {
      micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      console.log('[Voice] Got mic stream');

      const mimeType = ['audio/webm;codecs=opus', 'audio/webm'].find(t =>
        MediaRecorder.isTypeSupported(t)
      );
      console.log('[Voice] Using mimeType:', mimeType);

      mediaRecorder = mimeType
        ? new MediaRecorder(micStream, { mimeType })
        : new MediaRecorder(micStream);
      audioChunks = [];

      mediaRecorder.ondataavailable = (e) => {
        console.log('[Voice] ondataavailable, chunk size:', e.data.size);
        if (e.data.size > 0) audioChunks.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        console.log('[Voice] onstop fired, chunks:', audioChunks.length);

        // Release mic
        if (micStream) {
          micStream.getTracks().forEach(t => t.stop());
          micStream = null;
        }
        if (audioContext) {
          try { audioContext.close(); } catch (e) {}
          audioContext = null;
        }

        if (audioChunks.length === 0) {
          console.log('[Voice] No audio chunks');
          if (voiceStatusText) voiceStatusText.textContent = '⚠️ No audio captured. Try again.';
          return;
        }

        const blob = new Blob(audioChunks, { type: mediaRecorder.mimeType || 'audio/webm' });
        audioChunks = [];
        console.log('[Voice] Audio blob size:', blob.size, 'type:', blob.type);

        if (blob.size < 2000) {
          if (voiceStatusText) voiceStatusText.textContent = '⚠️ Recording too short — speak longer.';
          return;
        }

        if (voiceStatusText) voiceStatusText.textContent = '✨ Converting audio to WAV...';

        // Convert WebM to 16kHz mono WAV for Groq (with 5s timeout)
        let audioBuffer, audioMime;
        try {
          const wavPromise = (async () => {
            const raw = await blob.arrayBuffer();
            const ctx = new OfflineAudioContext(1, 1, 16000);
            const decoded = await ctx.decodeAudioData(raw.slice(0)); // slice to avoid detached buffer
            const n = decoded.length;
            const mono = new Float32Array(n);
            for (let c = 0; c < decoded.numberOfChannels; c++) {
              const ch = decoded.getChannelData(c);
              for (let i = 0; i < n; i++) mono[i] += ch[i] / decoded.numberOfChannels;
            }
            const wav = new DataView(new ArrayBuffer(44 + n * 2));
            const wr = (off, s) => { for (let i = 0; i < s.length; i++) wav.setUint8(off + i, s.charCodeAt(i)); };
            wr(0, 'RIFF'); wav.setUint32(4, 36 + n * 2, true); wr(8, 'WAVE');
            wr(12, 'fmt '); wav.setUint32(16, 16, true); wav.setUint16(20, 1, true);
            wav.setUint16(22, 1, true); wav.setUint32(24, 16000, true); wav.setUint32(28, 32000, true);
            wav.setUint16(32, 2, true); wav.setUint16(34, 16, true);
            wr(36, 'data'); wav.setUint32(40, n * 2, true);
            for (let i = 0; i < n; i++) {
              const s = Math.max(-1, Math.min(1, mono[i]));
              wav.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
            }
            return wav.buffer;
          })();

          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('WAV conversion timed out')), 5000)
          );

          audioBuffer = await Promise.race([wavPromise, timeoutPromise]);
          audioMime = 'audio/wav';
          console.log('[Voice] WAV conversion done, size:', audioBuffer.byteLength);
        } catch (convErr) {
          console.warn('[Voice] WAV conversion failed, sending raw WebM:', convErr.message);
          audioBuffer = await blob.arrayBuffer();
          audioMime = blob.type;
        }

        if (voiceStatusText) voiceStatusText.textContent = '✨ Sending to Groq Whisper AI...';

        try {
          let res;
          if (window.electronAPI?.transcribeAudio) {
            console.log('[Voice] Calling transcribeAudio IPC, size:', audioBuffer.byteLength, 'mime:', audioMime);
            res = await window.electronAPI.transcribeAudio(audioBuffer, audioMime);
            console.log('[Voice] IPC result:', JSON.stringify(res));
          } else {
            console.warn('[Voice] electronAPI.transcribeAudio not available, trying direct fetch fallback...');
            const GROQ_KEY = typeof import.meta !== 'undefined' ? import.meta.env?.VITE_GROQ_API_KEY : undefined;
            if (GROQ_KEY) {
              const baseMime = String(audioMime || 'audio/wav').split(';')[0].trim();
              const form = new FormData();
              form.append('file', new Blob([audioBuffer], { type: baseMime }), 'audio.wav');
              form.append('model', 'whisper-large-v3-turbo');
              form.append('response_format', 'json');
              form.append('temperature', '0');
              const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
                method: 'POST',
                headers: { Authorization: `Bearer ${GROQ_KEY}` },
                body: form
              });
              if (response.ok) {
                const data = await response.json();
                res = { success: true, text: data.text };
              } else {
                const errText = await response.text().catch(() => '');
                res = { success: false, error: `Direct API failed (${response.status})` };
              }
            } else {
              res = { success: false, error: 'Transcription API not available.' };
            }
          }

          if (res && res.success && res.text) {
            const cleanText = String(res.text || '').replace(/\$/g, '₹').replace(/\b(?:USD|dollars?|dollar)\b/gi, 'rupees').trim();
            if (voiceTranscriptInput) {
              voiceTranscriptInput.value = cleanText;
              updateVoicePreview();
            }
            if (voiceStatusText) {
              voiceStatusText.textContent = '✅ Transcribed! Click "Process & Save All" below.';
            }
          } else {
            const errMsg = res?.error || "Couldn't transcribe — try speaking louder.";
            console.warn('[Voice] Transcription failed:', errMsg);
            if (voiceTranscriptInput && voiceTranscriptInput.value.trim()) {
              updateVoicePreview();
              if (voiceStatusText) {
                voiceStatusText.textContent = '✅ Ready to process! Click "Process & Save All" below.';
              }
            } else if (voiceStatusText) {
              voiceStatusText.textContent = `⚠️ ${errMsg}`;
            }
          }
        } catch (err) {
          console.error('[Voice] Transcription error:', err);
          if (voiceTranscriptInput && voiceTranscriptInput.value.trim()) {
            updateVoicePreview();
            if (voiceStatusText) {
              voiceStatusText.textContent = '✅ Text ready! Click "Process & Save All" below.';
            }
          } else if (voiceStatusText) {
            voiceStatusText.textContent = '⚠️ Error — check internet and try again.';
          }
        }
      };

      // Record full audio (no timeslice = single complete WebM on stop)
      mediaRecorder.start();
      isRecording = true;
      console.log('[Voice] MediaRecorder started, state:', mediaRecorder.state);

      // Auto-stop after 30 seconds
      setTimeout(() => {
        if (isRecording && mediaRecorder?.state === 'recording') {
          console.log('[Voice] Auto-stopping after 30s');
          stopAndTranscribe();
        }
      }, 30000);

      // Mic visualizer
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const source = audioContext.createMediaStreamSource(micStream);
      const analyser = audioContext.createAnalyser();
      source.connect(analyser);
      analyser.fftSize = 64;
      const micCircle = document.querySelector('.mic-circle');
      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const updateVol = () => {
        if (!isRecording) return;
        analyser.getByteFrequencyData(dataArray);
        const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        if (micCircle) {
          micCircle.style.transform = `scale(${1 + Math.min(avg / 100, 0.45)})`;
        }
        requestAnimationFrame(updateVol);
      };
      updateVol();

      if (toggleRecordBtn) {
        toggleRecordBtn.innerHTML = '⏹️ Stop & Transcribe';
        toggleRecordBtn.className = 'btn btn-danger btn-sm';
      }
      if (voiceStatusText) {
        voiceStatusText.textContent = '🔴 Recording... Speak now, then click "Stop & Transcribe"';
      }
    } catch (micErr) {
      console.error('[Voice] Mic error:', micErr);
      isRecording = false;
      if (micStream) {
        micStream.getTracks().forEach(t => t.stop());
        micStream = null;
      }
      if (voiceStatusText) {
        voiceStatusText.textContent = '❌ Microphone denied — allow in System Settings.';
      }
    }
  };

  const handleVoiceSubmit = () => {
    const text = voiceTranscriptInput?.value.trim();
    if (!text) {
      showToast('⚠️ No text to save — record or type transactions first.', 'warning');
      return;
    }
    const items = parseMultipleHisabs(text);
    if (items.length > 0) {
      items.forEach(item => store.addTransaction(item));
      showToast(`✨ AI Saved ${items.length} ${items.length > 1 ? 'Hisab Entries' : 'Entry'} Successfully!`);
      closeModal('voiceModal');
      if (voiceTranscriptInput) voiceTranscriptInput.value = '';
      if (aiInput) aiInput.value = '';
      renderCurrentTab();
    } else {
      showToast(`⚠️ Please include amounts (e.g. 'Paid 350 for lunch')`, 'warning');
    }
  };

  submitVoiceBtn?.addEventListener('click', handleVoiceSubmit);
  voiceTranscriptInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleVoiceSubmit();
    }
  });

  toggleRecordBtn?.addEventListener('click', () => {
    if (isRecording) {
      stopAndTranscribe();
    } else {
      startAudioRecording();
    }
  });

  aiVoiceBtn?.addEventListener('click', () => {
    openModal('voiceModal');
    if (voiceTranscriptInput) voiceTranscriptInput.value = '';
    updateVoicePreview();
    if (isRecording) stopAndTranscribe();
    startAudioRecording();
  });

  // Initialize Month Selector
  const monthSelector = document.getElementById('monthSelector');
  monthSelector.value = currentMonthYear;
  monthSelector.addEventListener('change', (e) => {
    currentMonthYear = e.target.value || getCurrentMonthYear();
    renderCurrentTab();
  });

  // Previous Month Button
  document.getElementById('prevMonthBtn')?.addEventListener('click', () => {
    currentMonthYear = changeMonth(currentMonthYear, -1);
    monthSelector.value = currentMonthYear;
    renderCurrentTab();
  });

  // Next Month Button
  document.getElementById('nextMonthBtn')?.addEventListener('click', () => {
    currentMonthYear = changeMonth(currentMonthYear, 1);
    monthSelector.value = currentMonthYear;
    renderCurrentTab();
  });

  // Navigation Items
  const navItems = document.querySelectorAll('.nav-item');
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      navItems.forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      activeTab = item.getAttribute('data-tab');

      // Update Top Title
      const titleMap = {
        dashboard: 'Dashboard & Analytics',
        hisab: 'Daily Expenses & Transaction Hisab',
        loans: 'Loans & EMI Manager',
        investments: 'Investments & SIP Holdings',
        salary: 'Salary & Income Ledger',
        budgets: 'Category Budgets & Data Settings'
      };
      document.getElementById('currentTabTitle').textContent = titleMap[activeTab] || 'Dashboard';
      renderCurrentTab();
    });
  });

  // Global Quick Add Button
  document.getElementById('topQuickAddBtn').addEventListener('click', () => {
    openModal('txModal');
  });

  // Modal Close Handlers
  document.querySelectorAll('[data-close]').forEach(btn => {
    btn.addEventListener('click', () => {
      const modalId = btn.getAttribute('data-close');
      closeModal(modalId);
    });
  });

  // Delegate Dynamic Button Clicks (e.g. "+ Add Hisab", "+ Add Loan", AI Save, etc.)
  const container = document.getElementById('contentContainer');
  container.addEventListener('click', (e) => {
    if (e.target.id === 'dashboardAddTxBtn' || e.target.id === 'addHisabBtn') {
      openModal('txModal');
    } else if (e.target.id === 'addLoanBtn') {
      openModal('loanModal');
    } else if (e.target.id === 'addInvestmentBtn') {
      openModal('invModal');
    } else if (e.target.id === 'editSalaryBtn') {
      openModal('salaryModal');
    } else if (e.target.id === 'dashboardAiSaveBtn') {
      const input = document.getElementById('dashboardAiInput');
      if (input && input.value.trim()) {
        const parsed = parseNaturalLanguageHisab(input.value.trim());
        if (parsed) {
          store.addTransaction(parsed);
          showToast(`✨ AI Saved: ${parsed.title} (₹${parsed.amount.toLocaleString('en-IN')}) via ${parsed.paymentMethod}`);
          input.value = '';
          renderCurrentTab();
        } else {
          showToast(`⚠️ Please include an amount (e.g. 'Paid 350 for lunch via UPI')`, 'warning');
        }
      }
    }
  });

  container.addEventListener('keydown', (e) => {
    if (e.target.id === 'dashboardAiInput' && e.key === 'Enter') {
      const input = e.target;
      if (input.value.trim()) {
        const parsed = parseNaturalLanguageHisab(input.value.trim());
        if (parsed) {
          store.addTransaction(parsed);
          showToast(`✨ AI Saved: ${parsed.title} (₹${parsed.amount.toLocaleString('en-IN')}) via ${parsed.paymentMethod}`);
          input.value = '';
          renderCurrentTab();
        } else {
          showToast(`⚠️ Please include an amount (e.g. 'Paid 350 for lunch via UPI')`, 'warning');
        }
      }
    }
  });

  // Form Submissions
  setupForms();

  // Initial Render
  renderCurrentTab();
});

function showToast(message, type = 'success') {
  const existing = document.querySelector('.toast-notification');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = 'toast-notification';
  if (type === 'warning') toast.style.borderColor = 'var(--accent-warning)';
  toast.innerHTML = message;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 4000);
}

function renderCurrentTab() {
  const container = document.getElementById('contentContainer');
  container.innerHTML = '';

  switch (activeTab) {
    case 'dashboard':
      renderDashboardView(container, currentMonthYear);
      break;
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
    case 'budgets':
      renderBudgetsView(container, currentMonthYear);
      break;
    default:
      renderDashboardView(container, currentMonthYear);
  }
}

function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;

  // Set default dates if needed
  if (modalId === 'txModal') {
    document.getElementById('txDate').value = new Date().toISOString().split('T')[0];
  } else if (modalId === 'salaryModal') {
    document.getElementById('salDate').value = `${currentMonthYear}-01`;
  }

  modal.classList.add('active');
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.remove('active');
}

function setupForms() {
  // Transaction Form
  document.getElementById('txForm').addEventListener('submit', (e) => {
    e.preventDefault();
    store.addTransaction({
      title: document.getElementById('txTitle').value,
      amount: document.getElementById('txAmount').value,
      category: document.getElementById('txCategory').value,
      type: document.getElementById('txType').value,
      paymentMethod: document.getElementById('txPaymentMethod').value,
      date: document.getElementById('txDate').value,
      notes: document.getElementById('txNotes').value
    });
    closeModal('txModal');
    e.target.reset();
    renderCurrentTab();
  });

  // Loan Form
  document.getElementById('loanForm').addEventListener('submit', (e) => {
    e.preventDefault();
    store.addLoan({
      name: document.getElementById('loanName').value,
      lender: document.getElementById('loanLender').value,
      interestRate: document.getElementById('loanInterest').value,
      totalPrincipal: document.getElementById('loanPrincipal').value,
      remainingAmount: document.getElementById('loanRemaining').value || document.getElementById('loanPrincipal').value,
      monthlyEmi: document.getElementById('loanEmi').value,
      emiDay: document.getElementById('loanDueDay').value
    });
    closeModal('loanModal');
    e.target.reset();
    renderCurrentTab();
  });

  // Investment Form
  document.getElementById('invForm').addEventListener('submit', (e) => {
    e.preventDefault();
    store.addInvestment({
      name: document.getElementById('invName').value,
      category: document.getElementById('invCategory').value,
      type: document.getElementById('invType').value,
      monthlySip: document.getElementById('invMonthlySip').value,
      platform: document.getElementById('invPlatform').value,
      totalInvested: document.getElementById('invTotalInvested').value,
      currentValue: document.getElementById('invCurrentValue').value
    });
    closeModal('invModal');
    e.target.reset();
    renderCurrentTab();
  });

  // Salary Form
  document.getElementById('salaryForm').addEventListener('submit', (e) => {
    e.preventDefault();
    store.addOrUpdateSalary({
      monthYear: currentMonthYear,
      company: document.getElementById('salCompany').value,
      grossAmount: document.getElementById('salGross').value,
      deductions: document.getElementById('salDeductions').value,
      netAmount: document.getElementById('salNet').value || (parseFloat(document.getElementById('salGross').value) - parseFloat(document.getElementById('salDeductions').value || 0)),
      receivedDate: document.getElementById('salDate').value,
      status: 'credited'
    });
    closeModal('salaryModal');
    e.target.reset();
    renderCurrentTab();
  });
}

function changeMonth(monthStr, delta) {
  const [yearStr, mStr] = monthStr.split('-');
  let year = parseInt(yearStr);
  let month = parseInt(mStr) + delta;

  if (month > 12) {
    month = 1;
    year += 1;
  } else if (month < 1) {
    month = 12;
    year -= 1;
  }

  const newMStr = String(month).padStart(2, '0');
  return `${year}-${newMStr}`;
}
