import { store } from '../store.js';
import type { SalaryRecord, Transaction } from '../../types/index.js';

export function renderSalaryView(container: HTMLElement, currentMonthYear: string): void {
  const salaryRecords = store.getSalaryRecords();
  const monthTxs = store.getTransactions(currentMonthYear);
  const incomeTxs = monthTxs.filter(t => t.type === 'income' || t.category === 'Income' || /salary/i.test(t.title));
  const currentSalary = salaryRecords.find(s => s.monthYear === currentMonthYear);
  const currency = store.data.currency || '₹';

  const totalMonthIncomeTxs = incomeTxs.reduce((sum, t) => sum + t.amount, 0);
  const grossSalary = currentSalary ? Math.max(currentSalary.grossAmount, totalMonthIncomeTxs) : totalMonthIncomeTxs;
  const netSalary = currentSalary ? Math.max(currentSalary.netAmount, totalMonthIncomeTxs) : totalMonthIncomeTxs;
  const deductions = currentSalary ? currentSalary.deductions : 0;

  container.innerHTML = `
    <div class="metrics-grid">
      <div class="metric-card">
        <div class="metric-header">
          <span class="metric-title">Gross Monthly Income / Salary</span>
          <div class="metric-icon-box" style="background: var(--accent-primary-light); color: var(--accent-primary);">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
          </div>
        </div>
        <div class="metric-value" style="color: var(--accent-primary);">${currency}${grossSalary.toLocaleString('en-IN')}</div>
        <div class="metric-sub">${currentSalary ? escapeHTML(currentSalary.company) : `${incomeTxs.length} income credit(s) for ${currentMonthYear}`}</div>
      </div>

      <div class="metric-card">
        <div class="metric-header">
          <span class="metric-title">Statutory Deductions (PF / Tax)</span>
          <div class="metric-icon-box" style="background: var(--accent-danger-light); color: var(--accent-danger);">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </div>
        </div>
        <div class="metric-value" style="color: var(--accent-danger);">${currency}${deductions.toLocaleString('en-IN')}</div>
        <div class="metric-sub">TDS, Employee PF & Deductions</div>
      </div>

      <div class="metric-card">
        <div class="metric-header">
          <span class="metric-title">Net Salary Take-Home</span>
          <div class="metric-icon-box" style="background: var(--accent-success-light); color: var(--accent-success);">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
        </div>
        <div class="metric-value" style="color: var(--accent-success);">${currency}${netSalary.toLocaleString('en-IN')}</div>
        <div class="metric-sub">${currentSalary ? `Credited on ${currentSalary.receivedDate}` : incomeTxs.length > 0 ? `Total ${currency}${netSalary.toLocaleString('en-IN')} credited in ${currentMonthYear}` : 'Pending credit for ' + currentMonthYear}</div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <div>
          <h3 class="card-title">Salary & Monthly Pay Record (${currentMonthYear})</h3>
          <p style="font-size: 12.5px; color: var(--text-secondary); margin-top: 4px;">Log monthly paycheck, deductions (PF, Tax, LTA), and net received salary into your ledger.</p>
        </div>
        <button class="btn btn-primary" id="editSalaryBtn">
          ${currentSalary ? '✏️ Edit Salary Record' : '+ Log Salary for ' + currentMonthYear}
        </button>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <h3 class="card-title">Income & Salary Credits (${currentMonthYear})</h3>
      </div>

      <div class="table-responsive">
        <table class="custom-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Description / Source</th>
              <th>Category</th>
              <th>Payment Method</th>
              <th>Amount Credited</th>
              <th style="text-align: right;">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${incomeTxs.length === 0 ? `
              <tr><td colspan="6" class="empty-state">No income entries logged for ${currentMonthYear}. Use AI Voice or Quick Entry to add income!</td></tr>
            ` : incomeTxs.map((tx: Transaction) => `
              <tr>
                <td style="font-weight: 600;">${tx.date}</td>
                <td><strong>${escapeHTML(tx.title)}</strong></td>
                <td><span class="badge badge-success">${escapeHTML(tx.category)}</span></td>
                <td>${escapeHTML(tx.paymentMethod)}</td>
                <td style="font-weight: 800; font-size: 14px; color: var(--accent-success);">+${currency}${tx.amount.toLocaleString('en-IN')}</td>
                <td style="text-align: right; min-width: 150px; white-space: nowrap;">
                  <button class="btn btn-secondary btn-sm edit-income-btn" data-id="${tx.id}" style="margin-right: 6px;">✏️ Edit</button>
                  <button class="btn btn-secondary btn-sm delete-income-btn" data-id="${tx.id}" style="color: var(--accent-danger); border-color: rgba(239, 68, 68, 0.3);">Delete</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <h3 class="card-title">Monthly Pay Statements & Salary History</h3>
      </div>

      <div class="table-responsive">
        <table class="custom-table">
          <thead>
            <tr>
              <th>Month / Year</th>
              <th>Employer</th>
              <th>Gross Salary</th>
              <th>Deductions</th>
              <th>Net Credited</th>
              <th>Credit Date</th>
              <th>Status</th>
              <th style="text-align: right;">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${salaryRecords.length === 0 ? `
              <tr><td colspan="8" class="empty-state">No structured salary statements logged. Click "+ Log Salary" above.</td></tr>
            ` : salaryRecords.map((sal: SalaryRecord) => `
              <tr>
                <td><strong style="font-size: 14px;">${sal.monthYear}</strong></td>
                <td><strong>${escapeHTML(sal.company)}</strong></td>
                <td>${currency}${sal.grossAmount.toLocaleString('en-IN')}</td>
                <td style="color: var(--accent-danger); font-weight: 600;">-${currency}${sal.deductions.toLocaleString('en-IN')}</td>
                <td style="font-weight: 800; font-size: 14px; color: var(--accent-success);">${currency}${sal.netAmount.toLocaleString('en-IN')}</td>
                <td style="color: var(--text-secondary);">${sal.receivedDate || '-'}</td>
                <td>
                  <span class="badge ${sal.status === 'credited' ? 'badge-success' : 'badge-warning'}">
                    ${sal.status === 'credited' ? '✓ Credited' : '⏳ Pending'}
                  </span>
                </td>
                <td style="text-align: right; min-width: 150px; white-space: nowrap;">
                  <button class="btn btn-secondary btn-sm edit-statement-btn" data-id="${sal.id || sal.monthYear}" style="margin-right: 6px;">✏️ Edit</button>
                  <button class="btn btn-secondary btn-sm delete-statement-btn" data-id="${sal.id || sal.monthYear}" style="color: var(--accent-danger); border-color: rgba(239, 68, 68, 0.3);">Delete</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  container.querySelector('#editSalaryBtn')?.addEventListener('click', () => {
    openSalaryModal(currentSalary, currentMonthYear);
  });

  container.querySelectorAll('.edit-income-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      const tx = incomeTxs.find(t => t.id === id) || store.data.transactions.find(t => t.id === id);
      if (!tx) return;
      const form = document.getElementById('txForm') as HTMLFormElement | null;
      if (!form) return;
      form.dataset.editingId = tx.id;
      const editIdInput = document.getElementById('txEditId') as HTMLInputElement | null;
      if (editIdInput) editIdInput.value = tx.id;
      (document.getElementById('txTitle') as HTMLInputElement).value = tx.title || '';
      (document.getElementById('txAmount') as HTMLInputElement).value = String(tx.amount || '');
      (document.getElementById('txCategory') as HTMLSelectElement).value = tx.category || 'Income';
      (document.getElementById('txType') as HTMLSelectElement).value = 'income';
      (document.getElementById('txPaymentMethod') as HTMLSelectElement).value = tx.paymentMethod || 'UPI';
      (document.getElementById('txDate') as HTMLInputElement).value = tx.date || new Date().toISOString().split('T')[0];
      (document.getElementById('txNotes') as HTMLInputElement).value = tx.notes || '';
      const modalTitle = document.querySelector('#txModal .modal-header h3');
      if (modalTitle) modalTitle.textContent = '✏️ Edit Income Entry';
      const modal = document.getElementById('txModal');
      if (modal) modal.classList.add('active');
    });
  });

  container.querySelectorAll('.delete-income-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      if (id && confirm('Are you sure you want to delete this income entry?')) {
        store.deleteTransaction(id);
        renderSalaryView(container, currentMonthYear);
      }
    });
  });

  container.querySelectorAll('.edit-statement-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      const sal = salaryRecords.find(s => s.id === id || s.monthYear === id);
      openSalaryModal(sal, sal ? sal.monthYear : currentMonthYear);
    });
  });

  container.querySelectorAll('.delete-statement-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      if (id && confirm('Are you sure you want to delete this salary statement?')) {
        store.deleteSalary(id);
        renderSalaryView(container, currentMonthYear);
      }
    });
  });
}

function openSalaryModal(sal: SalaryRecord | undefined, monthYear: string): void {
  const form = document.getElementById('salaryForm');
  if (form) {
    (document.getElementById('salCompany') as HTMLInputElement).value = sal ? sal.company || '' : '';
    (document.getElementById('salGross') as HTMLInputElement).value = sal ? String(sal.grossAmount || '') : '';
    (document.getElementById('salDeductions') as HTMLInputElement).value = sal ? String(sal.deductions || 0) : '0';
    (document.getElementById('salNet') as HTMLInputElement).value = sal ? String(sal.netAmount || '') : '';
    (document.getElementById('salDate') as HTMLInputElement).value = sal ? sal.receivedDate || '' : new Date().toISOString().split('T')[0];
  }
  const modalTitle = document.querySelector('#salaryModal .modal-header h3');
  if (modalTitle) modalTitle.textContent = sal ? `✏️ Edit Salary Record (${monthYear})` : `Log Salary Record (${monthYear})`;
  const modal = document.getElementById('salaryModal');
  if (modal) modal.classList.add('active');
}

function escapeHTML(str: string): string {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
