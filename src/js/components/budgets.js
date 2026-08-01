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

      <div class="metrics-grid">
        ${categories.map(cat => {
          const limit = budgets[cat] || 0;
          const spent = categorySpent[cat] || 0;
          const percent = limit > 0 ? Math.min(100, Math.round((spent / limit) * 100)) : 0;
          const isOver = limit > 0 && spent > limit;
          const isNear = limit > 0 && percent >= 80 && !isOver;

          return `
            <div class="metric-card">
              <div class="metric-header">
                <span class="metric-title">${cat}</span>
                <span class="badge ${isOver ? 'badge-danger' : isNear ? 'badge-warning' : 'badge-success'}">
                  ${limit > 0 ? `${percent}% used` : 'No Limit Set'}
                </span>
              </div>

              <div class="metric-value" style="font-size: 20px;">
                ${currency}${spent.toLocaleString('en-IN')}
                <span style="font-size: 13px; color: var(--text-muted); font-weight: normal;"> / ${limit > 0 ? currency + limit.toLocaleString('en-IN') : 'Unlimited'}</span>
              </div>

              <div class="progress-bar-bg">
                <div class="progress-bar-fill" style="width: ${percent}%; background: ${isOver ? 'var(--grad-danger)' : isNear ? 'var(--grad-warning)' : 'var(--grad-success)'};"></div>
              </div>

              <div style="display: flex; gap: 8px; margin-top: 8px;">
                <input type="number" class="form-control budget-input" data-cat="${cat}" placeholder="Set budget ₹" value="${limit || ''}" style="padding: 4px 8px; font-size: 12px; flex: 1;">
                <button class="btn btn-secondary btn-sm save-budget-btn" data-cat="${cat}">Save</button>
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
  container.querySelector('#exportBackupBtn').addEventListener('click', () => {
    store.exportJSON();
  });

  container.querySelector('#importBackupInput').addEventListener('change', (e) => {
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

  container.querySelector('#resetSampleDataBtn').addEventListener('click', () => {
    if (confirm('Reset all transactions, loans, and investment data to default sample dataset?')) {
      store.resetToSampleData();
    }
  });
}
