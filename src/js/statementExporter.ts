import { store } from './store.js';
import type { Transaction } from '../types/index.js';

export function exportTransactionsCSV(monthYear: string | null = null): void {
  const txs = store.getTransactions(monthYear);
  if (!txs || txs.length === 0) {
    alert('No transactions found to export.');
    return;
  }

  const headers = ['ID', 'Date', 'Title', 'Category', 'Type', 'Amount (₹)', 'Payment Method', 'Notes'];
  const csvRows = [headers.join(',')];

  txs.forEach((tx: Transaction) => {
    const row = [
      `"${tx.id || ''}"`,
      `"${tx.date || ''}"`,
      `"${(tx.title || '').replace(/"/g, '""')}"`,
      `"${tx.category || ''}"`,
      `"${tx.type || ''}"`,
      tx.amount || 0,
      `"${tx.paymentMethod || ''}"`,
      `"${(tx.notes || '').replace(/"/g, '""')}"`
    ];
    csvRows.push(row.join(','));
  });

  const csvString = csvRows.join('\n');
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `hisab_statement_${monthYear || 'all'}_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function printFinancialStatementPDF(monthYear: string | null = null): void {
  const selectedMonth = monthYear || new Date().toISOString().substring(0, 7);
  const metrics = store.getMonthlyMetrics(selectedMonth);
  const txs = store.getTransactions(selectedMonth);

  const printWin = window.open('', '_blank', 'width=900,height=750');
  if (!printWin) {
    alert('Popup blocked! Please allow popups to view printable report.');
    return;
  }

  printWin.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Daily Hisab Financial Report - ${selectedMonth}</title>
      <style>
        body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #1e293b; padding: 30px; background: #fff; }
        .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #6366f1; padding-bottom: 12px; margin-bottom: 20px; }
        .header h1 { margin: 0; color: #6366f1; font-size: 24px; }
        .header p { margin: 4px 0 0 0; color: #64748b; font-size: 13px; }
        .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 24px; }
        .card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; text-align: center; }
        .card-title { font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 700; margin-bottom: 4px; }
        .card-val { font-size: 18px; font-weight: 800; color: #0f172a; }
        table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 12px; }
        th, td { border: 1px solid #e2e8f0; padding: 8px 10px; text-align: left; }
        th { background: #f1f5f9; color: #475569; font-weight: 700; }
        tr:nth-child(even) { background: #f8fafc; }
        .footer { margin-top: 30px; border-top: 1px solid #e2e8f0; padding-top: 12px; font-size: 11px; color: #94a3b8; text-align: center; }
      </style>
    </head>
    <body>
      <div class="header">
        <div>
          <h1>Daily Hisab Financial Statement</h1>
          <p>Monthly Performance Report for <strong>${selectedMonth}</strong></p>
        </div>
        <div style="text-align: right; font-size: 12px; color: #64748b;">
          Generated: ${new Date().toLocaleDateString()}
        </div>
      </div>

      <div class="grid">
        <div class="card">
          <div class="card-title">Total Income</div>
          <div class="card-val" style="color: #10b981;">₹${metrics.totalIncome.toLocaleString()}</div>
        </div>
        <div class="card">
          <div class="card-title">Total Expenses</div>
          <div class="card-val" style="color: #ef4444;">₹${metrics.totalExpenses.toLocaleString()}</div>
        </div>
        <div class="card">
          <div class="card-title">Investments</div>
          <div class="card-val" style="color: #06b6d4;">₹${metrics.totalInvestments.toLocaleString()}</div>
        </div>
        <div class="card">
          <div class="card-title">Net Balance</div>
          <div class="card-val" style="color: #6366f1;">₹${metrics.remainingBalance.toLocaleString()}</div>
        </div>
      </div>

      <h3>Itemized Transactions (${txs.length})</h3>
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Title</th>
            <th>Category</th>
            <th>Type</th>
            <th>Payment</th>
            <th>Amount (₹)</th>
          </tr>
        </thead>
        <tbody>
          ${txs.map((t: Transaction) => `
            <tr>
              <td>${t.date || ''}</td>
              <td>${t.title || ''}</td>
              <td>${t.category || ''}</td>
              <td>${t.type || ''}</td>
              <td>${t.paymentMethod || ''}</td>
              <td style="font-weight: 700;">₹${parseFloat(String(t.amount || 0)).toLocaleString()}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <div class="footer">
        Generated securely by Daily Hisab Desktop App • Personal Finance Ledger
      </div>
    </body>
    </html>
  `);
  printWin.document.close();
  setTimeout(() => {
    printWin.focus();
    printWin.print();
  }, 350);
}
