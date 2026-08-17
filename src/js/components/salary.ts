import { store } from '../store.js';
import type { SalaryRecord, Transaction } from '../../types/index.js';

export function renderSalaryView(container: HTMLElement, currentMonthYear: string): void {
  const salaryRecords = store.getSalaryRecords();
  const monthTxs = store.getTransactions(currentMonthYear);
  const incomeTxs = monthTxs.filter(t => t.type === 'income' || t.category === 'Income' || /salary/i.test(t.title));
  const currentMonthSalaries = salaryRecords.filter(s => s.monthYear === currentMonthYear);
  const currency = store.data.currency || '₹';

  const totalMonthIncomeTxs = incomeTxs.reduce((sum, t) => sum + t.amount, 0);
  const totalSalGross = currentMonthSalaries.reduce((sum, s) => sum + s.grossAmount, 0);
  const totalSalNet = currentMonthSalaries.reduce((sum, s) => sum + s.netAmount, 0);
  const totalSalDeductions = currentMonthSalaries.reduce((sum, s) => sum + s.deductions, 0);

  const grossSalary = Math.max(totalSalGross, totalMonthIncomeTxs);
  const netSalary = Math.max(totalSalNet, totalMonthIncomeTxs);
  const deductions = totalSalDeductions;

  const employerNames = currentMonthSalaries.map(s => s.company).filter(Boolean);
  const employerSummaryText = employerNames.length > 0
    ? `${currentMonthSalaries.length} salary slip(s) (${employerNames.join(', ')}) for ${currentMonthYear}`
    : `${incomeTxs.length} income credit(s) for ${currentMonthYear}`;

  container.innerHTML = `
    <div class="card" style="background: linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(59, 130, 246, 0.08) 100%); border-color: rgba(16, 185, 129, 0.3); padding: 14px 18px; margin-bottom: 20px;">
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
        <span style="font-weight: 700; font-size: 13.5px; color: var(--accent-success); display: flex; align-items: center; gap: 6px;">
          ✨ AI Smart Quick Entry (Salary & Extra Income)
        </span>
        <span style="font-size: 11px; color: var(--text-muted);">Auto-detects Salary, Freelance, Consulting & Side Income</span>
      </div>
      <div style="display: flex; gap: 10px; align-items: center;">
        <input type="text" id="salaryAiInput" class="form-control ai-smart-input" placeholder="Type e.g. 'Salary credited 55000' or 'Freelance 15000 via NetBanking' or 'Bonus 5000'..." style="flex: 1; font-weight: 500;" />
        <button class="btn btn-primary btn-sm ai-smart-save-btn" id="salaryAiSaveBtn" style="background: linear-gradient(135deg, #10b981, #059669); border: none; font-weight: 600;">✨ Save Entry</button>
      </div>
    </div>

    <div class="metrics-grid">
      <div class="metric-card">
        <div class="metric-header">
          <span class="metric-title">Gross Monthly Income / Salary</span>
          <div class="metric-icon-box" style="background: var(--accent-primary-light); color: var(--accent-primary);">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
          </div>
        </div>
        <div class="metric-value" style="color: var(--accent-primary);">${currency}${grossSalary.toLocaleString('en-IN')}</div>
        <div class="metric-sub">${escapeHTML(employerSummaryText)}</div>
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
        <div class="metric-sub">${currentMonthSalaries.length > 0 ? `${currentMonthSalaries.length} salary slip(s) credited for ${currentMonthYear}` : incomeTxs.length > 0 ? `Total ${currency}${netSalary.toLocaleString('en-IN')} credited in ${currentMonthYear}` : 'Pending credit for ' + currentMonthYear}</div>
      </div>
    </div>

    <div class="card">
      <div class="card-header" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
        <div>
          <h3 class="card-title">Salary & Monthly Pay Record (${currentMonthYear})</h3>
          <p style="font-size: 12.5px; color: var(--text-secondary); margin-top: 4px;">Log salary statements, PF/tax deductions, and add extra salary/income from secondary jobs or side streams.</p>
        </div>
        <div style="display: flex; gap: 10px; flex-wrap: wrap;">
          <button class="btn btn-primary" id="addExtraIncomeBtn" style="background: linear-gradient(135deg, #10b981, #059669); border: none; font-weight: 600;">
            💰 + Add Extra Salary / Income
          </button>
          <button class="btn btn-secondary" id="editSalaryBtn">
            + Log Salary Record (${currentMonthYear})
          </button>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-header" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
        <div>
          <h3 class="card-title">Income & Salary Credits (${currentMonthYear})</h3>
          <p style="font-size: 12.5px; color: var(--text-secondary); margin-top: 4px;">All income streams credited for ${currentMonthYear} (Primary salary, Freelance, Bonus, Secondary job, Side income).</p>
        </div>
        <button class="btn btn-primary btn-sm" id="addIncomeTableBtn" style="background: linear-gradient(135deg, #10b981, #059669); border: none; font-weight: 600;">
          + Add Income Credit
        </button>
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
              <tr><td colspan="6" class="empty-state">No income entries logged for ${currentMonthYear}. Click "💰 + Add Extra Salary / Income" above to log credits!</td></tr>
            ` : incomeTxs.map((tx: Transaction) => `
              <tr>
                <td style="font-weight: 600;">${tx.date}</td>
                <td><strong>${escapeHTML(tx.title)}</strong> ${tx.notes ? `<div style="font-size: 11px; color: var(--text-muted);">${escapeHTML(tx.notes)}</div>` : ''}</td>
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
      <div class="card-header" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
        <div>
          <h3 class="card-title">Monthly Pay Statements & Salary History</h3>
          <p style="font-size: 12.5px; color: var(--text-secondary); margin-top: 4px;">Log salary slips for any month or multiple employers (Company A, Company B, Freelance Retainer).</p>
        </div>
        <button class="btn btn-secondary btn-sm" id="addSalaryRecordBtn">
          + Add Salary Record / Slip
        </button>
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
              <tr><td colspan="8" class="empty-state">No structured salary statements logged. Click "+ Add Salary Record" above.</td></tr>
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
                  <button class="btn btn-secondary btn-sm edit-statement-btn" data-id="${sal.id}" style="margin-right: 6px;">✏️ Edit</button>
                  <button class="btn btn-secondary btn-sm delete-statement-btn" data-id="${sal.id}" style="color: var(--accent-danger); border-color: rgba(239, 68, 68, 0.3);">Delete</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  container.querySelector('#addExtraIncomeBtn')?.addEventListener('click', () => {
    openExtraIncomeModal(currentMonthYear);
  });

  container.querySelector('#addIncomeTableBtn')?.addEventListener('click', () => {
    openExtraIncomeModal(currentMonthYear);
  });

  container.querySelector('#editSalaryBtn')?.addEventListener('click', () => {
    openSalaryModal(undefined, currentMonthYear);
  });

  container.querySelector('#addSalaryRecordBtn')?.addEventListener('click', () => {
    openSalaryModal(undefined, currentMonthYear);
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
      const sal = salaryRecords.find(s => s.id === id);
      if (sal) {
        openSalaryModal(sal, sal.monthYear);
      }
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

function openExtraIncomeModal(currentMonthYear: string): void {
  const form = document.getElementById('txForm') as HTMLFormElement | null;
  if (form) {
    delete form.dataset.editingId;
    form.reset();
  }
  const editIdInput = document.getElementById('txEditId') as HTMLInputElement | null;
  if (editIdInput) editIdInput.value = '';

  const modalTitle = document.querySelector('#txModal .modal-header h3');
  if (modalTitle) modalTitle.textContent = '💰 Add Extra Salary / Income Credit';

  const titleInput = document.getElementById('txTitle') as HTMLInputElement | null;
  if (titleInput) {
    titleInput.value = '';
    titleInput.placeholder = 'e.g. Second Employer Salary, Freelance, Bonus, Consulting';
  }

  const categorySelect = document.getElementById('txCategory') as HTMLSelectElement | null;
  if (categorySelect) categorySelect.value = 'Income';

  const typeSelect = document.getElementById('txType') as HTMLSelectElement | null;
  if (typeSelect) typeSelect.value = 'income';

  const paymentSelect = document.getElementById('txPaymentMethod') as HTMLSelectElement | null;
  if (paymentSelect) paymentSelect.value = 'NetBanking';

  const dateInput = document.getElementById('txDate') as HTMLInputElement | null;
  if (dateInput) {
    const today = new Date().toISOString().split('T')[0];
    dateInput.value = today.startsWith(currentMonthYear) ? today : `${currentMonthYear}-01`;
  }

  const notesInput = document.getElementById('txNotes') as HTMLInputElement | null;
  if (notesInput) notesInput.value = 'Extra Salary / Secondary Income';

  const modal = document.getElementById('txModal');
  if (modal) modal.classList.add('active');
}

function openSalaryModal(sal: SalaryRecord | undefined, monthYear: string): void {
  const form = document.getElementById('salaryForm') as HTMLFormElement | null;
  if (form) {
    if (sal) {
      form.dataset.editingId = sal.id;
    } else {
      delete form.dataset.editingId;
    }
  }
  const editIdInput = document.getElementById('salEditId') as HTMLInputElement | null;
  if (editIdInput) editIdInput.value = sal ? sal.id : '';

  const monthYearInput = document.getElementById('salMonthYear') as HTMLInputElement | null;
  if (monthYearInput) monthYearInput.value = sal ? sal.monthYear : monthYear;

  const companyInput = document.getElementById('salCompany') as HTMLInputElement | null;
  if (companyInput) companyInput.value = sal ? sal.company || '' : '';

  const grossInput = document.getElementById('salGross') as HTMLInputElement | null;
  if (grossInput) grossInput.value = sal ? String(sal.grossAmount || '') : '';

  const dedInput = document.getElementById('salDeductions') as HTMLInputElement | null;
  if (dedInput) dedInput.value = sal ? String(sal.deductions || 0) : '0';

  const netInput = document.getElementById('salNet') as HTMLInputElement | null;
  if (netInput) netInput.value = sal ? String(sal.netAmount || '') : '';

  const dateInput = document.getElementById('salDate') as HTMLInputElement | null;
  if (dateInput) dateInput.value = sal ? sal.receivedDate || '' : new Date().toISOString().split('T')[0];

  const modalTitle = document.getElementById('salaryModalTitle') || document.querySelector('#salaryModal .modal-header h3');
  if (modalTitle) modalTitle.textContent = sal ? `✏️ Edit Salary Record (${sal.monthYear})` : `Log Salary Record (${monthYear})`;

  const modal = document.getElementById('salaryModal');
  if (modal) modal.classList.add('active');
}

function escapeHTML(str: string): string {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
