import { store } from '../store.js';
import { renderExpenseCategoryChart, renderCashFlowBarChart, renderMomTrendChart } from '../charts.js';
import { exportTransactionsCSV, printFinancialStatementPDF } from '../statementExporter.js';
import { renderCsvImporterModal } from './csvImporter.js';
import { parseMultipleHisabs } from '../aiParser.js';
import type { Transaction } from '../../types/index.js';

export function renderDashboardView(container: HTMLElement, currentMonthYear: string): void {
  const metrics = store.getMonthlyMetrics(currentMonthYear);
  const txs = store.getTransactions(currentMonthYear);
  const loans = store.getLoans();
  const investments = store.getInvestments();

  const totalPortfolioValue = investments.reduce((acc, i) => acc + (i.currentValue || 0), 0);

  const categoryData: Record<string, number> = {};
  txs.filter(t => t.type === 'expense').forEach(t => {
    categoryData[t.category] = (categoryData[t.category] || 0) + t.amount;
  });

  const currency = store.data.currency || '₹';
  const totalExpensesAndEmis = metrics.totalExpenses + metrics.totalEmisPaid;
  const exactCashBalance = metrics.remainingBalance;

  const isAlreadyInDom = container.querySelector('#cashFlowCanvas') !== null;

  if (!isAlreadyInDom) {
    container.innerHTML = `
      <div style="display: flex; gap: 10px; margin-bottom: 16px; flex-wrap: wrap; justify-content: flex-end;">
        <button class="btn btn-secondary btn-sm" id="dashExportPdfBtn">
          📄 Print / PDF Statement
        </button>
        <button class="btn btn-secondary btn-sm" id="dashExportCsvBtn">
          📊 Export CSV Statement
        </button>
        <button class="btn btn-primary btn-sm" id="dashImportBankCsvBtn">
          📑 Import Bank CSV
        </button>
      </div>

      <div class="card" style="background: linear-gradient(135deg, rgba(99, 102, 241, 0.12) 0%, rgba(168, 85, 247, 0.08) 100%); border-color: rgba(99, 102, 241, 0.3); padding: 14px 18px; margin-bottom: 20px;">
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

      <div class="metrics-grid">
        <div class="metric-card">
          <div class="metric-header">
            <span class="metric-title">Money Available This Cycle</span>
            <div class="metric-icon-box" style="background: var(--accent-success-light); color: var(--accent-success);">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
            </div>
          </div>
          <div class="metric-value" id="dashValAvailable" style="color: var(--accent-success);"></div>
          <div class="metric-sub" id="dashSubAvailable"></div>
        </div>

        <div class="metric-card">
          <div class="metric-header">
            <span class="metric-title">Total Expenses (Hisab + EMI)</span>
            <div class="metric-icon-box" style="background: var(--accent-danger-light); color: var(--accent-danger);">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>
            </div>
          </div>
          <div class="metric-value" id="dashValExpenses" style="color: var(--accent-danger);"></div>
          <div class="metric-sub" id="dashSubExpenses"></div>
        </div>

        <div class="metric-card">
          <div class="metric-header">
            <span class="metric-title">Total Invested Amount</span>
            <div class="metric-icon-box" style="background: var(--accent-primary-light); color: var(--accent-primary);">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
            </div>
          </div>
          <div class="metric-value" id="dashValPortfolio" style="color: var(--accent-primary);"></div>
          <div class="metric-sub" id="dashSubPortfolio"></div>
        </div>

        <div class="metric-card">
          <div class="metric-header">
            <span class="metric-title">Exact Current Balance</span>
            <div class="metric-icon-box" id="dashBoxBalance">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
            </div>
          </div>
          <div class="metric-value" id="dashValBalance"></div>
          <div class="metric-sub">Only recorded paid EMIs reduce this balance</div>
        </div>
      </div>

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

      <div class="card" style="margin-bottom: 20px;">
        <div class="card-header">
          <span class="card-title">📈 Month-over-Month (MoM) Cash Flow Trend</span>
        </div>
        <div class="chart-container" style="height: 220px;">
          <canvas id="momTrendCanvas"></canvas>
        </div>
      </div>

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
                <th style="text-align: right;">Action</th>
              </tr>
            </thead>
            <tbody id="dashboardRecentTbody"></tbody>
          </table>
        </div>
      </div>
    `;

    const exportPdfBtn = container.querySelector('#dashExportPdfBtn') as HTMLElement | null;
    if (exportPdfBtn) exportPdfBtn.onclick = () => printFinancialStatementPDF(currentMonthYear);

    const exportCsvBtn = container.querySelector('#dashExportCsvBtn') as HTMLElement | null;
    if (exportCsvBtn) exportCsvBtn.onclick = () => exportTransactionsCSV(currentMonthYear);

    const importBankBtn = container.querySelector('#dashImportBankCsvBtn') as HTMLElement | null;
    if (importBankBtn) importBankBtn.onclick = () => renderCsvImporterModal();

    const aiSaveBtn = container.querySelector('#dashboardAiSaveBtn');
    const aiInput = container.querySelector('#dashboardAiInput') as HTMLInputElement | null;
    if (aiSaveBtn && aiInput) {
      const runAiSave = () => {
        const text = aiInput.value.trim();
        if (!text) return;
        const items = parseMultipleHisabs(text);
        if (items.length > 0) {
          items.forEach(i => store.addTransaction(i));
          aiInput.value = '';
        }
      };
      aiSaveBtn.addEventListener('click', runAiSave);
      aiInput.addEventListener('keydown', (e: any) => { if (e.key === 'Enter') runAiSave(); });
    }

    const addTxBtn = container.querySelector('#dashboardAddTxBtn');
    if (addTxBtn) {
      addTxBtn.addEventListener('click', () => {
        const modal = document.getElementById('txModal');
        if (modal) modal.classList.add('active');
      });
    }
  }

  const dashValAvailable = container.querySelector('#dashValAvailable');
  if (dashValAvailable) {
    dashValAvailable.textContent = `${metrics.availableBalance < 0 ? '-' : ''}${currency}${Math.abs(metrics.availableBalance).toLocaleString('en-IN')}`;
  }
  const dashSubAvailable = container.querySelector('#dashSubAvailable');
  if (dashSubAvailable) {
    dashSubAvailable.textContent = `Previous: ${metrics.openingBalance < 0 ? '-' : ''}${currency}${Math.abs(metrics.openingBalance).toLocaleString('en-IN')} • Income: ${currency}${metrics.totalIncome.toLocaleString('en-IN')}`;
  }

  const dashValExpenses = container.querySelector('#dashValExpenses');
  if (dashValExpenses) {
    dashValExpenses.textContent = `${currency}${totalExpensesAndEmis.toLocaleString('en-IN')}`;
  }
  const dashSubExpenses = container.querySelector('#dashSubExpenses');
  if (dashSubExpenses) {
    dashSubExpenses.textContent = `Expenses: ${currency}${metrics.totalExpenses.toLocaleString('en-IN')} • EMI: ${currency}${metrics.totalEmisPaid.toLocaleString('en-IN')}`;
  }

  const dashValPortfolio = container.querySelector('#dashValPortfolio');
  if (dashValPortfolio) {
    dashValPortfolio.textContent = `${currency}${totalPortfolioValue.toLocaleString('en-IN')}`;
  }
  const dashSubPortfolio = container.querySelector('#dashSubPortfolio');
  if (dashSubPortfolio) {
    dashSubPortfolio.textContent = `${currency}${metrics.totalInvestments.toLocaleString('en-IN')} invested in ${currentMonthYear}`;
  }

  const dashValBalance = container.querySelector('#dashValBalance') as HTMLElement | null;
  if (dashValBalance) {
    dashValBalance.style.color = exactCashBalance >= 0 ? 'var(--accent-success)' : 'var(--accent-danger)';
    dashValBalance.textContent = `${exactCashBalance < 0 ? '-' : ''}${currency}${Math.abs(exactCashBalance).toLocaleString('en-IN')}`;
  }
  const dashBoxBalance = container.querySelector('#dashBoxBalance') as HTMLElement | null;
  if (dashBoxBalance) {
    dashBoxBalance.style.background = exactCashBalance >= 0 ? 'var(--accent-success-light)' : 'var(--accent-danger-light)';
    dashBoxBalance.style.color = exactCashBalance >= 0 ? 'var(--accent-success)' : 'var(--accent-danger)';
  }

  const recentTbody = container.querySelector('#dashboardRecentTbody');
  if (recentTbody) {
    const recentList = store.getRecentTransactions(7);
    if (recentList.length === 0) {
      recentTbody.innerHTML = `<tr><td colspan="7" class="empty-state">No transactions recorded yet. Use AI Voice or Quick Entry to add entries!</td></tr>`;
    } else {
      recentTbody.innerHTML = recentList.map((tx: Transaction) => `
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
          <td style="text-align: right; min-width: 150px; white-space: nowrap;">
            <button class="btn btn-secondary btn-sm dashboard-edit-tx-btn" data-id="${tx.id}" style="margin-right: 6px;">✏️ Edit</button>
            <button class="btn btn-secondary btn-sm dashboard-delete-tx-btn" data-id="${tx.id}" style="color: var(--accent-danger); border-color: rgba(239, 68, 68, 0.3);">Delete</button>
          </td>
        </tr>
      `).join('');

      recentTbody.querySelectorAll('.dashboard-edit-tx-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.getAttribute('data-id');
          const tx = txs.find(t => t.id === id) || store.data.transactions.find(t => t.id === id);
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
          (document.getElementById('txDate') as HTMLInputElement).value = tx.date || new Date().toISOString().split('T')[0];
          (document.getElementById('txNotes') as HTMLInputElement).value = tx.notes || '';
          const modalTitle = document.querySelector('#txModal .modal-header h3');
          if (modalTitle) modalTitle.textContent = '✏️ Edit Daily Hisab Entry';
          const modal = document.getElementById('txModal');
          if (modal) modal.classList.add('active');
        });
      });

      recentTbody.querySelectorAll('.dashboard-delete-tx-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.getAttribute('data-id');
          if (id && confirm('Are you sure you want to delete this hisab entry?')) {
            store.deleteTransaction(id);
            renderDashboardView(container, currentMonthYear);
          }
        });
      });
    }
  }

  renderCashFlowBarChart('cashFlowCanvas', metrics);
  renderExpenseCategoryChart('categoryExpenseCanvas', categoryData);
  renderMomTrendChart('momTrendCanvas', store);
}

function escapeHTML(str: string): string {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
