import { store } from '../store.js';
import type { Transaction } from '../../types/index.js';

export function renderHisabView(container: HTMLElement, currentMonthYear: string): void {
  const txs = store.getTransactions(currentMonthYear);
  const currency = store.data.currency || '₹';

  const totalExpense = txs.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);
  const totalIncome = txs.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
  const totalEmi = txs.filter(t => t.type === 'emi').reduce((acc, t) => acc + t.amount, 0);

  container.innerHTML = `
    <div class="card" style="background: linear-gradient(135deg, rgba(99, 102, 241, 0.12) 0%, rgba(168, 85, 247, 0.08) 100%); border-color: rgba(99, 102, 241, 0.3); padding: 14px 18px; margin-bottom: 20px;">
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
        <span style="font-weight: 700; font-size: 13.5px; color: var(--accent-primary); display: flex; align-items: center; gap: 6px;">
          ✨ AI Smart Quick Entry
        </span>
        <span style="font-size: 11px; color: var(--text-muted);">Auto-detects Amount, Category & Payment Method</span>
      </div>
      <div style="display: flex; gap: 10px; align-items: center;">
        <input type="text" id="hisabAiInput" class="form-control ai-smart-input" placeholder="Type e.g. 'Paid 350 for groceries' or '80 fish' or 'pant 1200'..." style="flex: 1; font-weight: 500;" />
        <button class="btn btn-primary btn-sm ai-smart-save-btn" id="hisabAiSaveBtn">✨ Save Entry</button>
      </div>
    </div>

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

    <div class="card">
      <div class="card-header">
        <div>
          <h3 class="card-title">Daily Expenses & Transaction Hisab (${currentMonthYear})</h3>
          <p style="font-size: 12.5px; color: var(--text-secondary); margin-top: 4px;">Search, filter, and track all your day-to-day transaction records.</p>
        </div>
        <button class="btn btn-primary" id="addHisabBtn">+ Add New Hisab Entry</button>
      </div>

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
        <select id="hisabPaymentFilter" class="form-control" style="width: 165px;">
          <option value="">All Payments</option>
          <option value="UPI">UPI</option>
          <option value="Cash">Cash</option>
          <option value="Credit Card">Credit Card</option>
          <option value="NetBanking">NetBanking</option>
          <option value="Auto-Debit">Auto-Debit</option>
        </select>
        <input type="date" id="hisabFromDate" class="form-control" style="width: 155px;" title="From date">
        <input type="date" id="hisabToDate" class="form-control" style="width: 155px;" title="To date">
        <input type="number" id="hisabMinAmount" placeholder="Min ₹" class="form-control" style="width: 110px;">
        <input type="number" id="hisabMaxAmount" placeholder="Max ₹" class="form-control" style="width: 110px;">
      </div>

      <div class="table-responsive">
        <table class="custom-table ledger-table" id="hisabTable">
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

  const searchInput = container.querySelector('#hisabSearchInput') as HTMLInputElement;
  const catFilter = container.querySelector('#hisabCategoryFilter') as HTMLSelectElement;
  const typeFilter = container.querySelector('#hisabTypeFilter') as HTMLSelectElement;
  const paymentFilter = container.querySelector('#hisabPaymentFilter') as HTMLSelectElement;
  const fromDateInput = container.querySelector('#hisabFromDate') as HTMLInputElement;
  const toDateInput = container.querySelector('#hisabToDate') as HTMLInputElement;
  const minAmountInput = container.querySelector('#hisabMinAmount') as HTMLInputElement;
  const maxAmountInput = container.querySelector('#hisabMaxAmount') as HTMLInputElement;
  const tbody = container.querySelector('#hisabTableBody') as HTMLElement;

  const filterRows = () => {
    const query = searchInput.value.toLowerCase().trim();
    const cat = catFilter.value;
    const type = typeFilter.value;
    const payment = paymentFilter.value;
    const fromDate = fromDateInput.value;
    const toDate = toDateInput.value;
    const minAmount = parseFloat(minAmountInput.value);
    const maxAmount = parseFloat(maxAmountInput.value);

    const filtered = txs.filter(t => {
      const tagsText = (t.tags || []).join(' ').toLowerCase();
      const matchQuery = !query || t.title.toLowerCase().includes(query) || (t.notes && t.notes.toLowerCase().includes(query)) || tagsText.includes(query);
      const matchCat = !cat || t.category === cat;
      const matchType = !type || t.type === type;
      const matchPayment = !payment || t.paymentMethod === payment;
      const matchFrom = !fromDate || t.date >= fromDate;
      const matchTo = !toDate || t.date <= toDate;
      const matchMin = !Number.isFinite(minAmount) || t.amount >= minAmount;
      const matchMax = !Number.isFinite(maxAmount) || t.amount <= maxAmount;
      return matchQuery && matchCat && matchType && matchPayment && matchFrom && matchTo && matchMin && matchMax;
    });

    tbody.innerHTML = renderTableRows(filtered, currency);
    attachActionListeners(tbody, currentMonthYear, container, txs);
  };

  searchInput.addEventListener('input', filterRows);
  catFilter.addEventListener('change', filterRows);
  typeFilter.addEventListener('change', filterRows);
  paymentFilter.addEventListener('change', filterRows);
  fromDateInput.addEventListener('change', filterRows);
  toDateInput.addEventListener('change', filterRows);
  minAmountInput.addEventListener('input', filterRows);
  maxAmountInput.addEventListener('input', filterRows);

  attachActionListeners(tbody, currentMonthYear, container, txs);
}

function renderTableRows(txs: Transaction[], currency: string): string {
  if (txs.length === 0) {
    return `<tr><td colspan="7" class="empty-state">No hisab entries found matching filters.</td></tr>`;
  }

  return txs.map(tx => `
    <tr>
      <td style="font-weight: 500; font-size: 13px; color: var(--text-secondary);">${tx.date}</td>
      <td>
        <strong style="color: var(--text-primary); font-size: 14px;">${escapeHTML(tx.title)}</strong>
        ${tx.notes ? `<div style="font-size: 11.5px; color: var(--text-muted); margin-top: 2px;">${escapeHTML(tx.notes)}</div>` : ''}
        ${(tx.tags || []).length > 0 ? `<div style="font-size: 11px; color: var(--text-muted); margin-top: 4px;">${(tx.tags || []).map(tag => `<span class="badge badge-info" style="font-size: 10px; margin-right: 4px;">#${escapeHTML(tag)}</span>`).join('')}</div>` : ''}
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
      <td style="text-align: right; min-width: 140px; white-space: nowrap;">
        <button class="btn btn-secondary btn-sm edit-tx-btn" data-id="${tx.id}" style="margin-right: 6px;">✏️ Edit</button>
        <button class="btn btn-secondary btn-sm delete-tx-btn" data-id="${tx.id}" style="color: var(--accent-danger); border-color: rgba(239, 68, 68, 0.3);">Delete</button>
      </td>
    </tr>
  `).join('');
}

function attachActionListeners(tbody: HTMLElement, currentMonthYear: string, container: HTMLElement, txs: Transaction[]): void {
  tbody.querySelectorAll('.edit-tx-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      const tx = txs.find(t => t.id === id);
      if (!tx) return;

      const form = document.getElementById('txForm') as HTMLFormElement | null;
      if (!form) return;

      form.dataset.editingId = tx.id;
      const editIdInput = document.getElementById('txEditId') as HTMLInputElement | null;
      if (editIdInput) editIdInput.value = tx.id;
      (document.getElementById('txTitle') as HTMLInputElement).value = tx.title || '';
      (document.getElementById('txAmount') as HTMLInputElement).value = String(tx.amount || '');
      (document.getElementById('txCategory') as HTMLSelectElement).value = tx.category || 'Food';
      (document.getElementById('txType') as HTMLSelectElement).value = tx.type || 'expense';
      (document.getElementById('txPaymentMethod') as HTMLSelectElement).value = tx.paymentMethod || 'UPI';
      const cardSelect = document.getElementById('txCreditCard') as HTMLSelectElement | null;
      if (cardSelect) {
        cardSelect.innerHTML = `<option value="">No linked card</option>` + store.getCreditCards().map(card => `<option value="${escapeHTML(card.id)}">${escapeHTML(card.name)}${card.bank ? ` • ${escapeHTML(card.bank)}` : ''}</option>`).join('');
        cardSelect.value = tx.linkedCreditCardId || '';
      }
      const tagsInput = document.getElementById('txTags') as HTMLInputElement | null;
      if (tagsInput) tagsInput.value = (tx.tags || []).join(', ');
      (document.getElementById('txDate') as HTMLInputElement).value = tx.date || new Date().toISOString().split('T')[0];
      (document.getElementById('txNotes') as HTMLInputElement).value = tx.notes || '';

      const modalTitle = document.querySelector('#txModal .modal-header h3');
      if (modalTitle) modalTitle.textContent = '✏️ Edit Daily Hisab Entry';

      const modal = document.getElementById('txModal');
      if (modal) modal.classList.add('active');
    });
  });

  tbody.querySelectorAll('.delete-tx-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      if (id && confirm('Are you sure you want to delete this hisab entry?')) {
        store.deleteTransaction(id);
        renderHisabView(container, currentMonthYear);
      }
    });
  });
}

function escapeHTML(str: string): string {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
