import { store } from '../store.js';

export function renderLoansView(container, currentMonthYear) {
  const loans = store.getLoans();
  const currency = store.data.currency || '₹';

  const totalPrincipal = loans.reduce((acc, l) => acc + (l.totalPrincipal || 0), 0);
  const totalRemaining = loans.reduce((acc, l) => acc + (l.remainingAmount || 0), 0);
  const totalMonthlyEmi = loans.reduce((acc, l) => acc + (l.monthlyEmi || 0), 0);
  const overallPaidPercent = totalPrincipal > 0 ? Math.round(((totalPrincipal - totalRemaining) / totalPrincipal) * 100) : 0;

  container.innerHTML = `
    <!-- Loans Overview Banner -->
    <div class="metrics-grid">
      <div class="metric-card">
        <div class="metric-header">
          <span class="metric-title">Total Debt Remaining</span>
          <div class="metric-icon-box" style="background: var(--accent-danger-light); color: var(--accent-danger);">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
          </div>
        </div>
        <div class="metric-value" style="color: var(--accent-danger);">${currency}${totalRemaining.toLocaleString('en-IN')}</div>
        <div class="metric-sub">Out of ${currency}${totalPrincipal.toLocaleString('en-IN')} total principal</div>
      </div>

      <div class="metric-card">
        <div class="metric-header">
          <span class="metric-title">Monthly EMI Commitment</span>
          <div class="metric-icon-box" style="background: var(--accent-warning-light); color: var(--accent-warning);">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          </div>
        </div>
        <div class="metric-value" style="color: var(--accent-warning);">${currency}${totalMonthlyEmi.toLocaleString('en-IN')}</div>
        <div class="metric-sub">Across ${loans.length} active loan accounts</div>
      </div>

      <div class="metric-card">
        <div class="metric-header">
          <span class="metric-title">Loan Repayment Progress</span>
          <div class="metric-icon-box" style="background: var(--accent-success-light); color: var(--accent-success);">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
        </div>
        <div class="metric-value" style="color: var(--accent-success);">${overallPaidPercent}% Paid</div>
        <div class="progress-bar-bg" style="margin-top: 6px;">
          <div class="progress-bar-fill" style="width: ${overallPaidPercent}%; background: var(--grad-success);"></div>
        </div>
      </div>
    </div>

    <!-- Active Loans Header -->
    <div class="card">
      <div class="card-header">
        <div>
          <h3 class="card-title">Active Loans & EMI Schedule</h3>
          <p style="font-size: 12px; color: var(--text-secondary); margin-top: 4px;">Click "Record EMI Payment" to automatically log monthly EMI payments into your Daily Hisab.</p>
        </div>
        <button class="btn btn-primary" id="addLoanBtn">+ Add New Loan / EMI</button>
      </div>

      <div class="table-responsive">
        <table class="custom-table">
          <thead>
            <tr>
              <th>Loan Name & Bank</th>
              <th>Original Amount</th>
              <th>Remaining Debt</th>
              <th>Monthly EMI</th>
              <th>Interest Rate</th>
              <th>Due Day</th>
              <th>Repayment Status</th>
              <th style="text-align: right;">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${loans.length === 0 ? `
              <tr><td colspan="8" class="empty-state">No loans or EMIs added yet. Click "+ Add New Loan / EMI" to start tracking.</td></tr>
            ` : loans.map(loan => {
              const paidPercent = loan.totalPrincipal > 0 
                ? Math.round(((loan.totalPrincipal - loan.remainingAmount) / loan.totalPrincipal) * 100) 
                : 0;

              return `
                <tr>
                  <td>
                    <strong>${escapeHTML(loan.name)}</strong>
                    <div style="font-size: 11px; color: var(--text-muted);">${escapeHTML(loan.lender)}</div>
                  </td>
                  <td>${currency}${loan.totalPrincipal.toLocaleString('en-IN')}</td>
                  <td style="font-weight: 700; color: var(--accent-danger);">${currency}${loan.remainingAmount.toLocaleString('en-IN')}</td>
                  <td style="font-weight: 700;">${currency}${loan.monthlyEmi.toLocaleString('en-IN')}</td>
                  <td>${loan.interestRate}% p.a.</td>
                  <td><span class="badge badge-info">${loan.emiDay}th of month</span></td>
                  <td style="min-width: 140px;">
                    <div style="font-size: 11px; font-weight: 600; margin-bottom: 4px;">${paidPercent}% paid</div>
                    <div class="progress-bar-bg">
                      <div class="progress-bar-fill" style="width: ${paidPercent}%; background: var(--grad-primary);"></div>
                    </div>
                  </td>
                  <td style="text-align: right; min-width: 240px; white-space: nowrap;">
                    <div style="display: inline-flex; align-items: center; justify-content: flex-end; gap: 8px; flex-wrap: nowrap;">
                      <button class="btn btn-success btn-sm pay-emi-btn" data-id="${loan.id}">
                        Record EMI (${currency}${loan.monthlyEmi.toLocaleString('en-IN')})
                      </button>
                      <button class="btn btn-secondary btn-sm delete-loan-btn" data-id="${loan.id}" style="color: var(--accent-danger);">
                        Delete
                      </button>
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
