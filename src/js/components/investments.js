import { store } from '../store.js';

export function renderInvestmentsView(container, currentMonthYear) {
  const investments = store.getInvestments();
  const monthTxs = store.getTransactions(currentMonthYear);
  const investmentTxs = monthTxs.filter(t => t.type === 'investment' || t.category === 'Investment' || /sip|invest/i.test(t.title));
  const currency = store.data.currency || '₹';

  const totalInvestedPortfolio = investments.reduce((acc, i) => acc + (i.totalInvested || 0), 0);
  const totalCurrentValue = investments.reduce((acc, i) => acc + (i.currentValue || 0), 0);
  const totalMonthlySipTarget = investments.reduce((acc, i) => acc + (i.monthlySip || 0), 0);

  const monthInvestmentOutflow = investmentTxs.reduce((sum, t) => sum + t.amount, 0);
  const totalInvested = totalInvestedPortfolio + monthInvestmentOutflow;
  const netGain = totalCurrentValue - totalInvestedPortfolio;
  const gainPercent = totalInvestedPortfolio > 0 ? ((netGain / totalInvestedPortfolio) * 100).toFixed(2) : 0;
  const isPositive = netGain >= 0;

  container.innerHTML = `
    <!-- Portfolio Overview Cards -->
    <div class="metrics-grid">
      <div class="metric-card">
        <div class="metric-header">
          <span class="metric-title">Portfolio Current Value</span>
          <div class="metric-icon-box" style="background: var(--accent-primary-light); color: var(--accent-primary);">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
          </div>
        </div>
        <div class="metric-value" style="color: var(--accent-primary);">${currency}${totalCurrentValue.toLocaleString('en-IN')}</div>
        <div class="metric-sub">Total capital invested: ${currency}${totalInvested.toLocaleString('en-IN')}</div>
      </div>

      <div class="metric-card">
        <div class="metric-header">
          <span class="metric-title">Net Profit / Returns</span>
          <div class="metric-icon-box" style="background: ${isPositive ? 'var(--accent-success-light)' : 'var(--accent-danger-light)'}; color: ${isPositive ? 'var(--accent-success)' : 'var(--accent-danger)'};">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
          </div>
        </div>
        <div class="metric-value" style="color: ${isPositive ? 'var(--accent-success)' : 'var(--accent-danger)'};">
          ${isPositive ? '+' : ''}${currency}${netGain.toLocaleString('en-IN')} (${gainPercent}%)
        </div>
        <div class="metric-sub">Unrealized gains across holdings</div>
      </div>

      <div class="metric-card">
        <div class="metric-header">
          <span class="metric-title">Monthly Investment Outflow (${currentMonthYear})</span>
          <div class="metric-icon-box" style="background: var(--accent-purple-light); color: var(--accent-purple);">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          </div>
        </div>
        <div class="metric-value" style="color: var(--accent-purple);">${currency}${monthInvestmentOutflow.toLocaleString('en-IN')}</div>
        <div class="metric-sub">${investmentTxs.length} investment entry(s) logged for ${currentMonthYear}</div>
      </div>
    </div>

    <!-- Logged Investment Transactions in current month -->
    <div class="card">
      <div class="card-header">
        <h3 class="card-title">Investment & SIP Outflow Entries (${currentMonthYear})</h3>
      </div>

      <div class="table-responsive">
        <table class="custom-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Investment Description</th>
              <th>Category</th>
              <th>Payment Method</th>
              <th>Amount Invested</th>
            </tr>
          </thead>
          <tbody>
            ${investmentTxs.length === 0 ? `
              <tr><td colspan="5" class="empty-state">No investment entries logged for ${currentMonthYear}. Use AI Voice or Quick Entry to add investments!</td></tr>
            ` : investmentTxs.map(tx => `
              <tr>
                <td style="font-weight: 600;">${tx.date}</td>
                <td><strong>${escapeHTML(tx.title)}</strong></td>
                <td><span class="badge badge-purple">${escapeHTML(tx.category)}</span></td>
                <td>${escapeHTML(tx.paymentMethod)}</td>
                <td style="font-weight: 800; font-size: 14px; color: var(--accent-purple);">${currency}${tx.amount.toLocaleString('en-IN')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <!-- Investments Portfolio Table -->
    <div class="card">
      <div class="card-header">
        <div>
          <h3 class="card-title">Investment Portfolio & SIP Holdings</h3>
          <p style="font-size: 12px; color: var(--text-secondary); margin-top: 4px;">Track Mutual Funds, Stocks, FDs, SGBs, and SIP outflows.</p>
        </div>
        <button class="btn btn-primary" id="addInvestmentBtn">+ Add Investment / SIP</button>
      </div>

      <div class="table-responsive">
        <table class="custom-table">
          <thead>
            <tr>
              <th>Asset Name & Broker</th>
              <th>Category</th>
              <th>Type</th>
              <th>Monthly SIP</th>
              <th>Total Invested</th>
              <th>Current Value</th>
              <th>Return (ROI)</th>
              <th style="text-align: right;">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${investments.length === 0 ? `
              <tr><td colspan="8" class="empty-state">No holdings added yet. Click "+ Add Investment / SIP" to create a portfolio holding.</td></tr>
            ` : investments.map(inv => {
              const gain = inv.currentValue - inv.totalInvested;
              const roi = inv.totalInvested > 0 ? ((gain / inv.totalInvested) * 100).toFixed(1) : 0;
              const positive = gain >= 0;

              return `
                <tr>
                  <td>
                    <strong>${escapeHTML(inv.name)}</strong>
                    <div style="font-size: 11px; color: var(--text-muted);">${escapeHTML(inv.platform)}</div>
                  </td>
                  <td><span class="badge badge-purple">${escapeHTML(inv.category)}</span></td>
                  <td><span class="badge badge-info">${escapeHTML(inv.type)}</span></td>
                  <td style="font-weight: 600;">${inv.monthlySip > 0 ? `${currency}${inv.monthlySip.toLocaleString('en-IN')}` : '-'}</td>
                  <td>${currency}${inv.totalInvested.toLocaleString('en-IN')}</td>
                  <td style="font-weight: 700;">${currency}${inv.currentValue.toLocaleString('en-IN')}</td>
                  <td style="font-weight: 700; color: ${positive ? 'var(--accent-success)' : 'var(--accent-danger)'};">
                    ${positive ? '+' : ''}${currency}${gain.toLocaleString('en-IN')} (${roi}%)
                  </td>
                  <td style="text-align: right; min-width: 220px; white-space: nowrap;">
                    <div style="display: inline-flex; align-items: center; justify-content: flex-end; gap: 8px; flex-wrap: nowrap;">
                      ${inv.monthlySip > 0 ? `
                        <button class="btn btn-success btn-sm pay-sip-btn" data-id="${inv.id}">
                          Log SIP (${currency}${inv.monthlySip.toLocaleString('en-IN')})
                        </button>
                      ` : ''}
                      <button class="btn btn-secondary btn-sm delete-inv-btn" data-id="${inv.id}" style="color: var(--accent-danger);">
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
  container.querySelectorAll('.pay-sip-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const invId = btn.getAttribute('data-id');
      const inv = investments.find(i => i.id === invId);
      if (confirm(`Log SIP investment outflow of ${currency}${inv.monthlySip.toLocaleString('en-IN')} for ${inv.name} into your ${currentMonthYear} Daily Hisab?`)) {
        store.paySipForInvestment(invId, currentMonthYear);
        renderInvestmentsView(container, currentMonthYear);
      }
    });
  });

  container.querySelectorAll('.delete-inv-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const invId = btn.getAttribute('data-id');
      if (confirm('Are you sure you want to delete this investment record?')) {
        store.deleteInvestment(invId);
        renderInvestmentsView(container, currentMonthYear);
      }
    });
  });
}

function escapeHTML(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
