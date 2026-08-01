import { store } from '../store.js';
import { renderExpenseCategoryChart, renderCashFlowBarChart } from '../charts.js';

export function renderDashboardView(container, currentMonthYear) {
  const metrics = store.getMonthlyMetrics(currentMonthYear);
  const txs = store.getTransactions(currentMonthYear);
  const loans = store.getLoans();
  const investments = store.getInvestments();

  // Calculate total loan remaining
  const totalLoanRemaining = loans.reduce((acc, l) => acc + (l.remainingAmount || 0), 0);
  const totalMonthlyEmiTarget = loans.reduce((acc, l) => acc + (l.monthlyEmi || 0), 0);

  // Calculate total investment value
  const totalPortfolioValue = investments.reduce((acc, i) => acc + (i.currentValue || 0), 0);
  const totalInvestedAmount = investments.reduce((acc, i) => acc + (i.totalInvested || 0), 0);

  // Category expense breakdown
  const categoryData = {};
  txs.filter(t => t.type === 'expense').forEach(t => {
    categoryData[t.category] = (categoryData[t.category] || 0) + t.amount;
  });

  const currency = store.data.currency || '₹';

  container.innerHTML = `
    <!-- AI Smart Quick Entry Banner -->
    <div class="card" style="background: linear-gradient(135deg, rgba(99, 102, 241, 0.12) 0%, rgba(168, 85, 247, 0.08) 100%); border-color: rgba(99, 102, 241, 0.3); padding: 14px 18px;">
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
        <span style="font-weight: 700; font-size: 13.5px; color: var(--accent-primary); display: flex; align-items: center; gap: 6px;">
          ✨ AI Smart Quick Entry
        </span>
        <span style="font-size: 11px; color: var(--text-muted);">Auto-detects Amount, Category & Payment Method</span>
      </div>
      <div style="display: flex; gap: 10px; align-items: center;">
        <input type="text" id="dashboardAiInput" class="form-control" placeholder="Type e.g. 'Paid 350 for groceries via UPI' or '350 petrol' or 'Salary 45000'..." style="flex: 1; font-weight: 500;" />
        <button class="btn btn-primary btn-sm" id="dashboardAiSaveBtn">✨ Save Entry</button>
      </div>
    </div>

    <!-- Top Summary Cards Grid -->
    <div class="metrics-grid">
      <!-- Income / Salary Card -->
      <div class="metric-card">
        <div class="metric-header">
          <span class="metric-title">Monthly Income / Salary</span>
          <div class="metric-icon-box" style="background: var(--accent-success-light); color: var(--accent-success);">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
          </div>
        </div>
        <div class="metric-value" style="color: var(--accent-success);">${currency}${metrics.totalIncome.toLocaleString('en-IN')}</div>
        <div class="metric-sub">For ${currentMonthYear}</div>
      </div>

      <!-- Daily Expenses Card -->
      <div class="metric-card">
        <div class="metric-header">
          <span class="metric-title">Daily Expenses (Hisab)</span>
          <div class="metric-icon-box" style="background: var(--accent-danger-light); color: var(--accent-danger);">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>
          </div>
        </div>
        <div class="metric-value" style="color: var(--accent-danger);">${currency}${metrics.totalExpenses.toLocaleString('en-IN')}</div>
        <div class="metric-sub">${txs.filter(t => t.type === 'expense').length} entries recorded</div>
      </div>

      <!-- Total Investments Card -->
      <div class="metric-card">
        <div class="metric-header">
          <span class="metric-title">Total Investments</span>
          <div class="metric-icon-box" style="background: var(--accent-primary-light); color: var(--accent-primary);">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
          </div>
        </div>
        <div class="metric-value" style="color: var(--accent-primary);">${currency}${totalPortfolioValue.toLocaleString('en-IN')}</div>
        <div class="metric-sub">${currency}${metrics.totalInvestments.toLocaleString('en-IN')} added this month</div>
      </div>

      <!-- Total Loans / EMIs Card -->
      <div class="metric-card">
        <div class="metric-header">
          <span class="metric-title">Total Loans & Debt</span>
          <div class="metric-icon-box" style="background: var(--accent-warning-light); color: var(--accent-warning);">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
          </div>
        </div>
        <div class="metric-value" style="color: var(--accent-warning);">${currency}${totalLoanRemaining.toLocaleString('en-IN')}</div>
        <div class="metric-sub">${currency}${metrics.totalEmisPaid.toLocaleString('en-IN')} EMI paid of ${currency}${totalMonthlyEmiTarget.toLocaleString('en-IN')} target</div>
      </div>
    </div>

    <!-- Charts Section -->
    <div class="charts-grid">
      <div class="card">
        <div class="card-header">
          <span class="card-title">Monthly Cash Flow Breakdown</span>
        </div>
        <div class="chart-container">
          <canvas id="cashFlowCanvas"></canvas>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <span class="card-title">Expenses by Category</span>
        </div>
        <div class="chart-container">
          <canvas id="categoryExpenseCanvas"></canvas>
        </div>
      </div>
    </div>

    <!-- Recent Transactions Table Card -->
    <div class="card">
      <div class="card-header">
        <span class="card-title">Recent Transactions & Hisab Ledger</span>
        <button class="btn btn-primary btn-sm" id="dashboardAddTxBtn">+ Add Hisab</button>
      </div>

      <div class="table-responsive">
        <table class="custom-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Description</th>
              <th>Category</th>
              <th>Payment Method</th>
              <th>Type</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            ${(() => {
              const recentList = store.getRecentTransactions(7);
              if (recentList.length === 0) {
                return `
                  <tr>
                    <td colspan="6" class="empty-state">No transactions recorded yet. Use AI Voice or Quick Entry to add entries!</td>
                  </tr>
                `;
              }
              return recentList.map(tx => `
                <tr>
                  <td>${tx.date}</td>
                  <td><strong>${escapeHTML(tx.title)}</strong> ${tx.notes ? `<div style="font-size: 11px; color: var(--text-muted);">${escapeHTML(tx.notes)}</div>` : ''}</td>
                  <td><span class="badge badge-info">${escapeHTML(tx.category)}</span></td>
                  <td>${escapeHTML(tx.paymentMethod)}</td>
                  <td>
                    ${tx.type === 'income' ? '<span class="badge badge-success">Income</span>' : ''}
                    ${tx.type === 'expense' ? '<span class="badge badge-danger">Expense</span>' : ''}
                    ${tx.type === 'investment' ? '<span class="badge badge-purple">Investment</span>' : ''}
                    ${tx.type === 'emi' ? '<span class="badge badge-warning">EMI</span>' : ''}
                  </td>
                  <td style="font-weight: 700; color: ${tx.type === 'income' ? 'var(--accent-success)' : 'var(--text-primary)'};">
                    ${tx.type === 'income' ? '+' : '-'}${currency}${tx.amount.toLocaleString('en-IN')}
                  </td>
                </tr>
              `).join('');
            })()}
          </tbody>
        </table>
      </div>
    </div>
  `;

  // Render Charts safely after DOM injection
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      renderCashFlowBarChart('cashFlowCanvas', metrics);
      renderExpenseCategoryChart('categoryExpenseCanvas', categoryData);
    });
  });
}

function escapeHTML(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
