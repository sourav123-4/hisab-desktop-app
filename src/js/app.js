import { store } from './store.js';
import { parseNaturalLanguageHisab } from './aiParser.js';
import { renderDashboardView } from './components/dashboard.js';
import { renderHisabView } from './components/hisab.js';
import { renderLoansView } from './components/loans.js';
import { renderInvestmentsView } from './components/investments.js';
import { renderSalaryView } from './components/salary.js';
import { renderBudgetsView } from './components/budgets.js';

let activeTab = 'dashboard';
let currentMonthYear = getCurrentMonthYear();

function getCurrentMonthYear() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

document.addEventListener('DOMContentLoaded', () => {
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

    const parsed = parseNaturalLanguageHisab(text);
    if (parsed) {
      store.addTransaction(parsed);
      showToast(`✨ AI Saved: ${parsed.title} (₹${parsed.amount.toLocaleString('en-IN')}) via ${parsed.paymentMethod}`);
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

  // Speech Recognition Voice Feature & Voice Modal
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const voiceTranscriptInput = document.getElementById('voiceTranscriptInput');
  const submitVoiceBtn = document.getElementById('submitVoiceBtn');
  const voiceStatusText = document.getElementById('voiceStatusText');
  let speechRecInstance = null;
  let audioContext = null;
  let micStream = null;

  const handleVoiceSubmit = () => {
    if (speechRecInstance) {
      try { speechRecInstance.stop(); } catch (e) {}
    }
    if (micStream) {
      try { micStream.getTracks().forEach(t => t.stop()); } catch (e) {}
    }
    const text = voiceTranscriptInput?.value.trim();
    if (!text) return;

    const parsed = parseNaturalLanguageHisab(text);
    if (parsed) {
      store.addTransaction(parsed);
      showToast(`✨ AI Saved: ${parsed.title} (₹${parsed.amount.toLocaleString('en-IN')}) via ${parsed.paymentMethod}`);
      closeModal('voiceModal');
      if (voiceTranscriptInput) voiceTranscriptInput.value = '';
      if (aiInput) aiInput.value = '';
      renderCurrentTab();
    } else {
      showToast(`⚠️ Please include an amount (e.g. 'Paid 350 for lunch via UPI')`, 'warning');
    }
  };

  submitVoiceBtn?.addEventListener('click', handleVoiceSubmit);
  voiceTranscriptInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleVoiceSubmit();
  });

  aiVoiceBtn?.addEventListener('click', async () => {
    openModal('voiceModal');
    if (voiceTranscriptInput) {
      voiceTranscriptInput.value = '';
      setTimeout(() => voiceTranscriptInput.focus(), 150);
    }

    if (voiceStatusText) {
      voiceStatusText.textContent = '🔴 Microphone Active! Speak your transaction sentence below:';
    }

    // Connect Web Audio API to drive microphone visualizer
    try {
      micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const source = audioContext.createMediaStreamSource(micStream);
      const analyser = audioContext.createAnalyser();
      source.connect(analyser);
      analyser.fftSize = 64;

      const micCircle = document.querySelector('.mic-circle');
      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const updateVol = () => {
        if (!document.getElementById('voiceModal')?.classList.contains('active')) return;
        analyser.getByteFrequencyData(dataArray);
        const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        if (micCircle) {
          const scale = 1 + Math.min(avg / 128, 0.4);
          micCircle.style.transform = `scale(${scale})`;
        }
        requestAnimationFrame(updateVol);
      };
      updateVol();
    } catch (micErr) {
      console.warn('Microphone hardware warning:', micErr);
    }

    if (SpeechRecognition) {
      try {
        if (speechRecInstance) {
          try { speechRecInstance.abort(); } catch (e) {}
        }
        speechRecInstance = new SpeechRecognition();
        speechRecInstance.continuous = false;
        speechRecInstance.interimResults = true;
        speechRecInstance.lang = 'en-IN';

        speechRecInstance.onstart = () => {
          if (voiceStatusText) voiceStatusText.textContent = '🎙️ Listening... Speak your transaction now!';
        };

        speechRecInstance.onresult = (event) => {
          let transcript = '';
          for (let i = 0; i < event.results.length; i++) {
            transcript += event.results[i][0].transcript;
          }
          if (voiceTranscriptInput) voiceTranscriptInput.value = transcript;
        };

        speechRecInstance.onend = () => {
          if (voiceTranscriptInput && voiceTranscriptInput.value.trim()) {
            if (voiceStatusText) voiceStatusText.textContent = '✅ Speech captured! Click Process & Save below';
          } else {
            if (voiceStatusText) voiceStatusText.textContent = '🎙️ Microphone Ready! Speak (or use Mac Dictation) below:';
          }
        };

        speechRecInstance.onerror = () => {
          if (voiceStatusText) voiceStatusText.textContent = '🎙️ Microphone Ready! Speak (or use Mac Dictation) below:';
        };

        speechRecInstance.start();
      } catch (err) {
        if (voiceStatusText) voiceStatusText.textContent = '🎙️ Microphone Ready! Speak (or use Mac Dictation) below:';
      }
    } else {
      if (voiceStatusText) voiceStatusText.textContent = '🎙️ Microphone Ready! Speak (or use Mac Dictation) below:';
    }
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
