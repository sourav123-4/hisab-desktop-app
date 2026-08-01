import { store } from '../store.js';

export function renderHisabView(container, currentMonthYear) {
  const txs = store.getTransactions(currentMonthYear);
  const currency = store.data.currency || '₹';

  const totalExpense = txs.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);
  const totalIncome = txs.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
  const totalEmi = txs.filter(t => t.type === 'emi').reduce((acc, t) => acc + t.amount, 0);

  container.innerHTML = `
    <!-- Top Summary Metrics for Hisab -->
    <div class="metrics-grid">
      <div class="metric-card">
        <div class="metric-header">
          <span class="metric-title">Total Monthly Expenses</span>
          <div class="metric-icon-box" style="background: var(--accent-danger-light); color: var(--accent-danger);">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>
          </div>
        </div>
        <div class="metric-value" style="color: var(--accent-danger);">${currency}${totalExpense.toLocaleString('en-IN')}</div>
        <div class="metric-sub">${txs.filter(t => t.type === 'expense').length} expense transactions</div>
      </div>

      <div class="metric-card">
        <div class="metric-header">
          <span class="metric-title">Total Extra Income</span>
          <div class="metric-icon-box" style="background: var(--accent-success-light); color: var(--accent-success);">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
          </div>
        </div>
        <div class="metric-value" style="color: var(--accent-success);">${currency}${totalIncome.toLocaleString('en-IN')}</div>
        <div class="metric-sub">${txs.filter(t => t.type === 'income').length} income records</div>
      </div>

      <div class="metric-card">
        <div class="metric-header">
          <span class="metric-title">EMI & Loan Outflows</span>
          <div class="metric-icon-box" style="background: var(--accent-warning-light); color: var(--accent-warning);">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
          </div>
        </div>
        <div class="metric-value" style="color: var(--accent-warning);">${currency}${totalEmi.toLocaleString('en-IN')}</div>
        <div class="metric-sub">Auto-debit installments paid</div>
      </div>
    </div>

    <!-- Main Hisab Card -->
    <div class="card">
      <div class="card-header">
        <div>
          <h3 class="card-title">Daily Expenses & Transaction Hisab (${currentMonthYear})</h3>
          <p style="font-size: 12.5px; color: var(--text-secondary); margin-top: 4px;">Search, filter, and track all your day-to-day transaction records.</p>
        </div>
        <button class="btn btn-primary" id="addHisabBtn">+ Add New Hisab Entry</button>
      </div>

      <!-- Filters & Search Toolbar -->
      <div style="display: flex; gap: 12px; flex-wrap: wrap;">
        <input type="text" id="hisabSearchInput" placeholder="🔍 Search entries by title, merchant or notes..." class="form-control" style="flex: 1; min-width: 220px;">
        <select id="hisabCategoryFilter" class="form-control" style="width: 170px;">
          <option value="">All Categories</option>
          <option value="Food">Food & Dining</option>
          <option value="Bills">Bills & Utilities</option>
          <option value="Transport">Transport & Fuel</option>
          <option value="Shopping">Shopping</option>
          <option value="Health">Health & Medical</option>
          <option value="Entertainment">Entertainment</option>
          <option value="EMI">EMI</option>
          <option value="Investment">Investment</option>
          <option value="Income">Income</option>
          <option value="Others">Others</option>
        </select>
        <select id="hisabTypeFilter" class="form-control" style="width: 150px;">
          <option value="">All Types</option>
          <option value="expense">Expense</option>
          <option value="income">Income</option>
          <option value="investment">Investment</option>
          <option value="emi">EMI</option>
        </select>
      </div>

      <!-- Transactions Table -->
      <div class="table-responsive">
        <table class="custom-table" id="hisabTable">
          <thead>
            <tr>
              <th>Date</th>
              <th>Description / Title</th>
              <th>Category</th>
              <th>Payment Method</th>
              <th>Type</th>
              <th>Amount</th>
              <th style="text-align: right;">Action</th>
            </tr>
          </thead>
          <tbody id="hisabTableBody">
            ${renderTableRows(txs, currency)}
          </tbody>
        </table>
      </div>
    </div>
  `;

  // Attach filter handlers
  const searchInput = container.querySelector('#hisabSearchInput');
  const catFilter = container.querySelector('#hisabCategoryFilter');
  const typeFilter = container.querySelector('#hisabTypeFilter');
  const tbody = container.querySelector('#hisabTableBody');

  const filterRows = () => {
    const query = searchInput.value.toLowerCase().trim();
    const cat = catFilter.value;
    const type = typeFilter.value;

    const filtered = txs.filter(t => {
      const matchQuery = !query || t.title.toLowerCase().includes(query) || (t.notes && t.notes.toLowerCase().includes(query));
      const matchCat = !cat || t.category === cat;
      const matchType = !type || t.type === type;
      return matchQuery && matchCat && matchType;
    });

    tbody.innerHTML = renderTableRows(filtered, currency);
    attachDeleteListeners(tbody, currentMonthYear, container);
  };

  searchInput.addEventListener('input', filterRows);
  catFilter.addEventListener('change', filterRows);
  typeFilter.addEventListener('change', filterRows);

  attachDeleteListeners(tbody, currentMonthYear, container);
}

function renderTableRows(txs, currency) {
  if (txs.length === 0) {
    return `<tr><td colspan="7" class="empty-state">No hisab entries found matching filters.</td></tr>`;
  }

  return txs.map(tx => `
    <tr>
      <td style="font-weight: 500; font-size: 13px; color: var(--text-secondary);">${tx.date}</td>
      <td>
        <strong style="color: var(--text-primary); font-size: 14px;">${escapeHTML(tx.title)}</strong>
        ${tx.notes ? `<div style="font-size: 11.5px; color: var(--text-muted); margin-top: 2px;">${escapeHTML(tx.notes)}</div>` : ''}
      </td>
      <td><span class="badge badge-info">${escapeHTML(tx.category)}</span></td>
      <td><span class="badge badge-purple" style="background: rgba(255,255,255,0.06); border-color: rgba(255,255,255,0.1); color: var(--text-primary);">${escapeHTML(tx.paymentMethod)}</span></td>
      <td>
        ${tx.type === 'income' ? '<span class="badge badge-success">Income</span>' : ''}
        ${tx.type === 'expense' ? '<span class="badge badge-danger">Expense</span>' : ''}
        ${tx.type === 'investment' ? '<span class="badge badge-purple">Investment</span>' : ''}
        ${tx.type === 'emi' ? '<span class="badge badge-warning">EMI</span>' : ''}
      </td>
      <td style="font-weight: 700; font-size: 14px; color: ${tx.type === 'income' ? 'var(--accent-success)' : 'var(--text-primary)'};">
        ${tx.type === 'income' ? '+' : '-'}${currency}${tx.amount.toLocaleString('en-IN')}
      </td>
      <td style="text-align: right;">
        <button class="btn btn-secondary btn-sm delete-tx-btn" data-id="${tx.id}" style="color: var(--accent-danger); border-color: rgba(239, 68, 68, 0.3);">Delete</button>
      </td>
    </tr>
  `).join('');
}

function attachDeleteListeners(tbody, currentMonthYear, container) {
  tbody.querySelectorAll('.delete-tx-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      if (confirm('Are you sure you want to delete this hisab entry?')) {
        store.deleteTransaction(id);
        renderHisabView(container, currentMonthYear);
      }
    });
  });
}

function escapeHTML(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
