import { store } from '../store.js';

export function renderLoansView(container, currentMonthYear) {
  const loans = store.getLoans();
  const monthTxs = store.getTransactions(currentMonthYear);
  const emiTxs = monthTxs.filter(t => t.type === 'emi' || t.category === 'EMI' || /loan|emi/i.test(t.title));
  const currency = store.data.currency || '₹';

  const totalPrincipal = loans.reduce((acc, l) => acc + (l.totalPrincipal || 0), 0);
  const totalRemaining = loans.reduce((acc, l) => acc + (l.remainingAmount || 0), 0);
  const totalMonthlyEmiTarget = loans.reduce((acc, l) => acc + (l.monthlyEmi || 0), 0);
  const monthEmisPaid = emiTxs.reduce((sum, t) => sum + t.amount, 0);
  const overallPaidPercent = totalPrincipal > 0 ? Math.round(((totalPrincipal - totalRemaining) / totalPrincipal) * 100) : 0;
  const activeLoans = loans.filter(l => (l.remainingAmount || 0) > 0);
  const monthEmiPending = Math.max(0, totalMonthlyEmiTarget - monthEmisPaid);

  container.innerHTML = `
    <!-- Top Summary Metrics Grid -->
    <div class="metrics-grid">
      <!-- Total Outstanding Debt -->
      <div class="metric-card">
        <div class="metric-header">
          <span class="metric-title">Total Debt Remaining</span>
          <div class="metric-icon-box" style="background: var(--accent-danger-light); color: var(--accent-danger);">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
          </div>
        </div>
        <div class="metric-value" style="color: var(--accent-danger);">${currency}${totalRemaining.toLocaleString('en-IN')}</div>
        <div class="metric-sub">${activeLoans.length} active loan account(s)</div>
      </div>

      <!-- Current Month EMI Target & Paid -->
      <div class="metric-card">
        <div class="metric-header">
          <span class="metric-title">Monthly EMI Paid (${currentMonthYear})</span>
          <div class="metric-icon-box" style="background: var(--accent-warning-light); color: var(--accent-warning);">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          </div>
        </div>
        <div class="metric-value" style="color: var(--accent-warning);">${currency}${monthEmisPaid.toLocaleString('en-IN')}</div>
        <div class="metric-sub">Target: ${currency}${totalMonthlyEmiTarget.toLocaleString('en-IN')} • Pending: ${currency}${monthEmiPending.toLocaleString('en-IN')}</div>
      </div>

      <!-- Repayment Progress -->
      <div class="metric-card">
        <div class="metric-header">
          <span class="metric-title">Overall Debt Payoff Progress</span>
          <div class="metric-icon-box" style="background: var(--accent-success-light); color: var(--accent-success);">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
        </div>
        <div class="metric-value" style="color: var(--accent-success);">${overallPaidPercent}% Paid Off</div>
        <div class="progress-bar-bg" style="margin-top: 6px;">
          <div class="progress-bar-fill" style="width: ${overallPaidPercent}%; background: var(--grad-success);"></div>
        </div>
      </div>
    </div>

    <!-- Clean Single Loans & EMI Table Card -->
    <div class="card">
      <div class="card-header">
        <div>
          <h3 class="card-title">💳 Loan & EMI Portfolio (${currentMonthYear})</h3>
          <p style="font-size: 12px; color: var(--text-secondary); margin-top: 4px;">Track monthly due dates, principal balances, and record EMI payments cleanly.</p>
        </div>
        <button class="btn btn-primary" id="addLoanBtn">+ Add New Loan / EMI</button>
      </div>

      <div class="table-responsive">
        <table class="custom-table">
          <thead>
            <tr>
              <th>Loan & Bank</th>
              <th>Due Date</th>
              <th>Monthly EMI</th>
              <th>Remaining Debt</th>
              <th>Progress & Status</th>
              <th style="text-align: right;">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${loans.length === 0 ? `
              <tr><td colspan="6" class="empty-state">No loan accounts recorded. Click "+ Add New Loan / EMI" to create an account.</td></tr>
            ` : loans.map(loan => {
              const dueDayStr = String(loan.emiDay || 5).padStart(2, '0');
              const fullDueDateStr = `${currentMonthYear}-${dueDayStr}`;
              
              const isPaidThisMonth = emiTxs.some(t => 
                t.title.toLowerCase().includes(loan.name.toLowerCase()) || 
                (loan.lender && t.notes?.toLowerCase().includes(loan.lender.toLowerCase()))
              );

              const paidPercent = loan.totalPrincipal > 0 
                ? Math.round(((loan.totalPrincipal - loan.remainingAmount) / loan.totalPrincipal) * 100) 
                : 0;

              return `
                <tr>
                  <td>
                    <strong style="font-size: 14px; color: var(--text-primary);">${escapeHTML(loan.name)}</strong>
                    <div style="font-size: 11.5px; color: var(--text-muted); margin-top: 2px;">
                      ${escapeHTML(loan.lender || 'Bank')} • ${loan.interestRate || 0}% p.a.
                    </div>
                  </td>

                  <td>
                    <div style="font-weight: 600; font-size: 13px; color: var(--accent-primary);">📅 Day ${loan.emiDay || 5}</div>
                    <div style="font-size: 11px; color: var(--text-muted);">${fullDueDateStr}</div>
                  </td>

                  <td style="font-weight: 700; font-size: 14px;">
                    ${currency}${loan.monthlyEmi.toLocaleString('en-IN')}
                  </td>

                  <td style="font-weight: 700; font-size: 14px; color: var(--accent-danger);">
                    ${currency}${loan.remainingAmount.toLocaleString('en-IN')}
                    <div style="font-size: 10.5px; color: var(--text-muted); font-weight: normal;">Original: ${currency}${loan.totalPrincipal.toLocaleString('en-IN')}</div>
                  </td>

                  <td style="min-width: 150px;">
                    <div style="display: flex; justify-content: space-between; font-size: 11px; font-weight: 600; margin-bottom: 4px;">
                      <span>${paidPercent}% paid</span>
                      <span class="badge ${isPaidThisMonth ? 'badge-success' : 'badge-warning'}">
                        ${isPaidThisMonth ? 'Paid This Month' : 'Due Soon'}
                      </span>
                    </div>
                    <div class="progress-bar-bg">
                      <div class="progress-bar-fill" style="width: ${paidPercent}%; background: var(--grad-primary);"></div>
                    </div>
                  </td>

                  <td style="text-align: right; min-width: 250px; white-space: nowrap;">
                    <div style="display: inline-flex; align-items: center; justify-content: flex-end; gap: 6px;">
                      ${loan.remainingAmount > 0 ? `
                        <button class="btn ${isPaidThisMonth ? 'btn-secondary' : 'btn-warning'} btn-sm pay-emi-btn" data-id="${loan.id}">
                          ${isPaidThisMonth ? 'Record Additional EMI' : `Record EMI (${currency}${loan.monthlyEmi.toLocaleString('en-IN')})`}
                        </button>
                      ` : `
                        <span class="badge badge-success">Fully Paid</span>
                      `}
                      <button class="btn btn-secondary btn-sm edit-loan-btn" data-id="${loan.id}">✏️ Edit</button>
                      <button class="btn btn-secondary btn-sm delete-loan-btn" data-id="${loan.id}" style="color: var(--accent-danger); border-color: rgba(239, 68, 68, 0.3);">Delete</button>
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

  // Attach Event Handlers
  container.querySelector('#addLoanBtn')?.addEventListener('click', () => {
    const form = document.getElementById('loanForm');
    if (form) {
      form.reset();
      delete form.dataset.editingId;
      if (document.getElementById('loanEditId')) document.getElementById('loanEditId').value = '';
    }
    const modalTitle = document.getElementById('loanModalTitle');
    if (modalTitle) modalTitle.textContent = 'Add New Loan / EMI Account';
    const modal = document.getElementById('loanModal');
    if (modal) modal.classList.add('active');
  });

  container.querySelectorAll('.edit-loan-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const loanId = btn.getAttribute('data-id');
      const loan = loans.find(l => l.id === loanId);
      if (!loan) return;

      const form = document.getElementById('loanForm');
      if (!form) return;

      form.dataset.editingId = loan.id;
      if (document.getElementById('loanEditId')) document.getElementById('loanEditId').value = loan.id;
      document.getElementById('loanName').value = loan.name || '';
      document.getElementById('loanLender').value = loan.lender || '';
      if (document.getElementById('loanTotalAmount')) document.getElementById('loanTotalAmount').value = loan.totalPrincipal || 0;
      if (document.getElementById('loanRemainingAmount')) document.getElementById('loanRemainingAmount').value = loan.remainingAmount || 0;
      if (document.getElementById('loanMonthlyEmi')) document.getElementById('loanMonthlyEmi').value = loan.monthlyEmi || 0;
      document.getElementById('loanDueDay').value = loan.emiDay || 5;

      const modalTitle = document.getElementById('loanModalTitle');
      if (modalTitle) modalTitle.textContent = '✏️ Edit Loan / EMI Account';

      const modal = document.getElementById('loanModal');
      if (modal) modal.classList.add('active');
    });
  });

  container.querySelectorAll('.pay-emi-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const loanId = btn.getAttribute('data-id');
      const loan = loans.find(l => l.id === loanId);
      if (confirm(`Record EMI payment of ${currency}${loan.monthlyEmi.toLocaleString('en-IN')} for ${loan.name} into your ${currentMonthYear} Daily Hisab?`)) {
        store.payEmiForLoan(loanId, currentMonthYear);
        renderLoansView(container, currentMonthYear);
      }
    });
  });

  container.querySelectorAll('.delete-loan-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const loanId = btn.getAttribute('data-id');
      if (confirm('Are you sure you want to delete this loan record?')) {
        store.deleteLoan(loanId);
        renderLoansView(container, currentMonthYear);
      }
    });
  });
}

function escapeHTML(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
