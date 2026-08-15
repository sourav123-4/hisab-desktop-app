import { store } from '../store.js';
import type { DebtRecord } from '../../types/index.js';

export function renderDebtsView(container: HTMLElement, currentMonthYear: string): void {
  const debts = store.getDebts();
  const currency = store.data.currency || '₹';

  const totalLent = debts.filter(d => d.type === 'lent').reduce((sum, d) => sum + (d.amount - d.settledAmount), 0);
  const totalBorrowed = debts.filter(d => d.type === 'borrowed').reduce((sum, d) => sum + (d.amount - d.settledAmount), 0);
  const netDebtPosition = totalLent - totalBorrowed;
  const isNetPositive = netDebtPosition >= 0;

  const activeDebts = debts.filter(d => d.status !== 'settled');
  const settledDebts = debts.filter(d => d.status === 'settled');

  container.innerHTML = `
    <!-- Top Summary Metrics Grid for Udhar / Debts -->
    <div class="metrics-grid">
      <div class="metric-card">
        <div class="metric-header">
          <span class="metric-title">Money Given Out (You'll Receive)</span>
          <div class="metric-icon-box" style="background: var(--accent-success-light); color: var(--accent-success);">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
          </div>
        </div>
        <div class="metric-value" style="color: var(--accent-success);">${currency}${totalLent.toLocaleString('en-IN')}</div>
        <div class="metric-sub">${debts.filter(d => d.type === 'lent' && d.status !== 'settled').length} active borrower(s)</div>
      </div>

      <div class="metric-card">
        <div class="metric-header">
          <span class="metric-title">Money Taken In (You Owe)</span>
          <div class="metric-icon-box" style="background: var(--accent-danger-light); color: var(--accent-danger);">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/></svg>
          </div>
        </div>
        <div class="metric-value" style="color: var(--accent-danger);">${currency}${totalBorrowed.toLocaleString('en-IN')}</div>
        <div class="metric-sub">${debts.filter(d => d.type === 'borrowed' && d.status !== 'settled').length} active lender(s)</div>
      </div>

      <div class="metric-card">
        <div class="metric-header">
          <span class="metric-title">Net Udhar Position</span>
          <div class="metric-icon-box" style="background: ${isNetPositive ? 'var(--accent-success-light)' : 'var(--accent-danger-light)'}; color: ${isNetPositive ? 'var(--accent-success)' : 'var(--accent-danger)'};">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
          </div>
        </div>
        <div class="metric-value" style="color: ${isNetPositive ? 'var(--accent-success)' : 'var(--accent-danger)'};">
          ${isNetPositive ? '+' : ''}${currency}${Math.abs(netDebtPosition).toLocaleString('en-IN')}
        </div>
        <div class="metric-sub">${isNetPositive ? "Net surplus: people owe you more" : "Net debt: you owe more to others"}</div>
      </div>
    </div>

    <!-- Active Debts Table Card -->
    <div class="card">
      <div class="card-header">
        <div>
          <h3 class="card-title">🤝 Peer-to-Peer Udhar & Debt Ledger</h3>
          <p style="font-size: 12.5px; color: var(--text-secondary); margin-top: 4px;">Track money given to friends/family vs money borrowed from others with partial settlements.</p>
        </div>
        <button class="btn btn-primary" id="addDebtBtn">+ Add New Udhar Record</button>
      </div>

      <div class="table-responsive">
        <table class="custom-table">
          <thead>
            <tr>
              <th>Person Name</th>
              <th>Udhar Category</th>
              <th>Total Amount</th>
              <th>Settled / Received</th>
              <th>Pending Balance</th>
              <th>Due Date</th>
              <th style="text-align: right;">Action</th>
            </tr>
          </thead>
          <tbody>
            ${debts.length === 0 ? `
              <tr><td colspan="7" class="empty-state">No Udhar records found. Click "+ Add New Udhar Record" to track money lent or borrowed!</td></tr>
            ` : debts.map((d: DebtRecord) => {
              const remaining = d.amount - d.settledAmount;
              const isLent = d.type === 'lent';
              const percent = d.amount > 0 ? Math.round((d.settledAmount / d.amount) * 100) : 0;

              return `
                <tr>
                  <td>
                    <strong style="font-size: 14px; color: var(--text-primary);">${escapeHTML(d.personName)}</strong>
                    ${d.notes ? `<div style="font-size: 11px; color: var(--text-muted);">${escapeHTML(d.notes)}</div>` : ''}
                  </td>
                  <td>
                    <span class="badge ${isLent ? 'badge-success' : 'badge-danger'}">
                      ${isLent ? '🟢 Given (Lent)' : '🔴 Taken (Borrowed)'}
                    </span>
                  </td>
                  <td style="font-weight: 700;">${currency}${d.amount.toLocaleString('en-IN')}</td>
                  <td style="color: var(--accent-success); font-weight: 600;">${currency}${d.settledAmount.toLocaleString('en-IN')} (${percent}%)</td>
                  <td style="font-weight: 800; font-size: 14px; color: ${remaining === 0 ? 'var(--accent-success)' : isLent ? 'var(--accent-warning)' : 'var(--accent-danger)'};">
                    ${currency}${remaining.toLocaleString('en-IN')}
                  </td>
                  <td style="font-size: 12px; color: var(--text-secondary);">${d.dueDate || 'No Due Date'}</td>
                  <td style="text-align: right; min-width: 240px; white-space: nowrap;">
                    <div style="display: inline-flex; align-items: center; justify-content: flex-end; gap: 6px;">
                      ${remaining > 0 ? `
                        <button class="btn btn-success btn-sm settle-debt-btn" data-id="${d.id}" data-name="${escapeHTML(d.personName)}" data-rem="${remaining}">
                          🤝 Record Payment
                        </button>
                      ` : `
                        <span class="badge badge-success">✓ Fully Settled</span>
                      `}
                      <button class="btn btn-secondary btn-sm edit-debt-btn" data-id="${d.id}">✏️ Edit</button>
                      <button class="btn btn-secondary btn-sm delete-debt-btn" data-id="${d.id}" style="color: var(--accent-danger);">Delete</button>
                    </div>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  // Attach Event Listeners
  container.querySelector('#addDebtBtn')?.addEventListener('click', () => {
    openDebtModal();
  });

  container.querySelectorAll('.settle-debt-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      const name = btn.getAttribute('data-name');
      const rem = parseFloat(btn.getAttribute('data-rem') || '0');
      if (!id) return;

      const pStr = prompt(`Record settlement payment for ${name} (Remaining pending: ${currency}${rem.toLocaleString()}):\nEnter settlement amount (₹):`, String(rem));
      if (pStr !== null) {
        const amt = parseFloat(pStr);
        if (!isNaN(amt) && amt > 0) {
          store.settleDebtPartial(id, amt);
          renderDebtsView(container, currentMonthYear);
        }
      }
    });
  });

  container.querySelectorAll('.edit-debt-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      const d = debts.find(item => item.id === id);
      if (d) openDebtModal(d);
    });
  });

  container.querySelectorAll('.delete-debt-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      if (id && confirm('Are you sure you want to delete this Udhar record?')) {
        store.deleteDebt(id);
        renderDebtsView(container, currentMonthYear);
      }
    });
  });
}

export function openDebtModal(debt?: DebtRecord): void {
  let modal = document.getElementById('debtModal');
  if (!modal) return;

  const form = document.getElementById('debtForm') as HTMLFormElement | null;
  if (!form) return;

  const hiddenIdInput = document.getElementById('debtEditId') as HTMLInputElement | null;

  if (debt) {
    form.dataset.editingId = debt.id;
    if (hiddenIdInput) hiddenIdInput.value = debt.id;
    (document.getElementById('debtPersonName') as HTMLInputElement).value = debt.personName || '';
    (document.getElementById('debtType') as HTMLSelectElement).value = debt.type || 'lent';
    (document.getElementById('debtAmount') as HTMLInputElement).value = String(debt.amount || '');
    (document.getElementById('debtSettledAmount') as HTMLInputElement).value = String(debt.settledAmount || 0);
    (document.getElementById('debtDate') as HTMLInputElement).value = debt.date || new Date().toISOString().split('T')[0];
    (document.getElementById('debtDueDate') as HTMLInputElement).value = debt.dueDate || '';
    (document.getElementById('debtNotes') as HTMLInputElement).value = debt.notes || '';
    const modalTitle = document.getElementById('debtModalTitle');
    if (modalTitle) modalTitle.textContent = '✏️ Edit Udhar Record';
  } else {
    delete form.dataset.editingId;
    if (hiddenIdInput) hiddenIdInput.value = '';
    form.reset();
    (document.getElementById('debtDate') as HTMLInputElement).value = new Date().toISOString().split('T')[0];
    const modalTitle = document.getElementById('debtModalTitle');
    if (modalTitle) modalTitle.textContent = '🤝 Add New Udhar Record';
  }

  modal.classList.add('active');
}

function escapeHTML(str: string): string {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
