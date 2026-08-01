import { store } from '../store.js';

export function renderBudgetsView(container, currentMonthYear) {
  const budgets = store.getBudgets();
  const txs = store.getTransactions(currentMonthYear);
  const currency = store.data.currency || '₹';

  // Calculate spent per category
  const categorySpent = {};
  txs.filter(t => t.type === 'expense').forEach(t => {
    categorySpent[t.category] = (categorySpent[t.category] || 0) + t.amount;
  });

  const categories = ['Food', 'Bills', 'Transport', 'Shopping', 'Entertainment', 'Health', 'Others'];

  container.innerHTML = `
    <!-- Category Budgets Section -->
    <div class="card">
      <div class="card-header">
        <div>
          <h3 class="card-title">Monthly Category Budget Limits (${currentMonthYear})</h3>
          <p style="font-size: 12px; color: var(--text-secondary); margin-top: 4px;">Set budget limits to keep your daily spending in check.</p>
        </div>
      </div>

      <div class="metrics-grid" style="grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 16px; padding-bottom: 8px;">
        ${categories.map(cat => {
    const limit = budgets[cat] || 0;
    const spent = categorySpent[cat] || 0;
    const percent = limit > 0 ? Math.min(100, Math.round((spent / limit) * 100)) : 0;
    const isOver = limit > 0 && spent > limit;
    const isNear = limit > 0 && percent >= 80 && !isOver;

    return `
            <div class="metric-card" style="padding: 16px; display: flex; flex-direction: column; justify-content: space-between;">
              <div>
                <div class="metric-header" style="display: flex; justify-content: space-between; align-items: center; gap: 6px;">
                  <span class="metric-title" style="font-size: 13px; font-weight: 700; text-transform: uppercase;">${cat}</span>
                  <span class="badge ${isOver ? 'badge-danger' : isNear ? 'badge-warning' : 'badge-success'}" style="white-space: nowrap; flex-shrink: 0; font-size: 11px;">
                    ${limit > 0 ? `${percent}% used` : 'No Limit Set'}
                  </span>
                </div>

                <div class="metric-value" style="font-size: 19px; margin-top: 4px;">
                  ${currency}${spent.toLocaleString('en-IN')}
                  <span style="font-size: 11.5px; color: var(--text-muted); font-weight: normal;"> / ${limit > 0 ? currency + limit.toLocaleString('en-IN') : 'Unlimited'}</span>
                </div>

                <div class="progress-bar-bg" style="margin-top: 6px;">
                  <div class="progress-bar-fill" style="width: ${percent}%; background: ${isOver ? 'var(--grad-danger)' : isNear ? 'var(--grad-warning)' : 'var(--grad-success)'};"></div>
                </div>
              </div>

              <div style="display: flex; gap: 8px; margin-top: 14px; align-items: center;">
                <input type="number" class="form-control budget-input" data-cat="${cat}" placeholder="Set budget ₹" value="${limit || ''}" style="padding: 6px 10px; font-size: 12px; flex: 1; min-width: 0;">
                <button class="btn btn-secondary btn-sm save-budget-btn" data-cat="${cat}" style="white-space: nowrap; flex-shrink: 0; padding: 6px 14px; font-weight: 600;">Save</button>
              </div>
            </div>
          `;
  }).join('')}
      </div>
    </div>



    <!-- Data Backup & Reset Settings Section -->
    <div class="card">
      <div class="card-header">
        <h3 class="card-title">Data Backup, Restore & App Controls</h3>
      </div>

      <div style="display: flex; gap: 16px; flex-wrap: wrap; align-items: center;">
        <button class="btn btn-primary" id="exportBackupBtn">
          📥 Export JSON Backup
        </button>

        <label class="btn btn-secondary" style="cursor: pointer;">
          📤 Import JSON Backup
          <input type="file" id="importBackupInput" accept=".json" style="display: none;">
        </label>

        <button class="btn btn-danger" id="resetSampleDataBtn" style="margin-left: auto;">
          ↺ Reset to Default Sample Data
        </button>
      </div>
    </div>
  `;

  // Attach Firebase Manual Cloud Sync Listener
  container.querySelector('#manualCloudSyncBtn')?.addEventListener('click', async () => {
    const btn = container.querySelector('#manualCloudSyncBtn');
    btn.textContent = '⏳ Syncing to Cloud...';
    const { fullSyncToCloud } = await import('../firebaseSync.js');
    const ok = await fullSyncToCloud(store.data);
    if (ok) {
      btn.textContent = '✅ Cloud Sync Complete!';
      setTimeout(() => { btn.textContent = '⚡ Force Real-Time Cloud Sync'; }, 3000);
    } else {
      btn.textContent = '⚠️ Cloud Sync Offline (Saved Locally)';
      setTimeout(() => { btn.textContent = '⚡ Force Real-Time Cloud Sync'; }, 3000);
    }
  });

  // Attach Test Firestore Listener
  container.querySelector('#testFirestoreBtn')?.addEventListener('click', async () => {
    const outBox = container.querySelector('#firestoreTestOutput');
    outBox.style.display = 'block';
    outBox.style.color = '#38bdf8';
    outBox.innerHTML = '⏳ Connecting to Firebase Cloud Firestore (project: taskmanager-bbf73)...';

    try {
      const { saveToCloud, subscribeToCloudCollection } = await import('../firebaseSync.js');
      const testId = 'test-' + Date.now();
      const testData = {
        id: testId,
        title: 'Diagnostic Test Transaction',
        amount: 100,
        category: 'Test',
        timestamp: new Date().toISOString()
      };

      outBox.innerHTML += `<br>📤 Sending test document ID: <code>${testId}</code>...`;
      const res = await saveToCloud('test_connection', testId, testData);

      if (res && res.success) {
        outBox.style.color = 'var(--accent-success)';
        outBox.innerHTML = `✅ <strong>SUCCESS!</strong> Test document successfully written to Cloud Firestore collection <code>test_connection/${testId}</code>!<br><span style="color: var(--text-muted);">Check your Firebase Console under project <strong>taskmanager-bbf73</strong> → Firestore Database → <strong>test_connection</strong> collection.</span>`;
      } else {
        const errObj = (res && res.error) ? res.error : {};
        outBox.style.color = 'var(--accent-danger)';
        outBox.innerHTML = `❌ <strong>FIRESTORE ERROR:</strong> ${errObj.code || 'unknown_code'}<br><code>${errObj.message || 'Write failed'}</code><br><br><span style="color: var(--text-secondary);">If the code is <strong>permission-denied</strong>, enable <code>allow read, write: if request.auth != null;</code> in Firebase Console → Firestore Database → Rules. If <strong>auth/operation-not-allowed</strong>, enable Anonymous Auth in Firebase Console → Authentication → Sign-in method.</span>`;
      }
    } catch (err) {
      outBox.style.color = 'var(--accent-danger)';
      outBox.innerHTML = `❌ <strong>Exception:</strong> ${err.message}`;
    }
  });

  // Attach Save Budget Listeners
  container.querySelectorAll('.save-budget-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const cat = btn.getAttribute('data-cat');
      const input = container.querySelector(`.budget-input[data-cat="${cat}"]`);
      const val = input.value;
      store.setBudget(cat, val);
      alert(`Budget for ${cat} set to ${currency}${parseFloat(val || 0).toLocaleString('en-IN')}`);
      renderBudgetsView(container, currentMonthYear);
    });
  });

  // Export / Import / Reset handlers
  container.querySelector('#exportBackupBtn')?.addEventListener('click', () => {
    store.exportJSON();
  });

  container.querySelector('#importBackupInput')?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (store.importJSON(event.target.result)) {
          alert('Backup restored successfully!');
        }
      };
      reader.readAsText(file);
    }
  });

  container.querySelector('#resetSampleDataBtn')?.addEventListener('click', () => {
    if (confirm('Reset all transactions, loans, and investment data to default sample dataset?')) {
      store.resetToSampleData();
    }
  });
}
