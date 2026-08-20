import { store } from '../store.js';
import type { CreditCard, RecurringRule, SavingsGoal } from '../../types/index.js';

const CATEGORIES = ['Food', 'Bills', 'Transport', 'Shopping', 'Entertainment', 'Health', 'EMI', 'Investment', 'Income', 'Others'];

export function renderPlannerView(container: HTMLElement, currentMonthYear: string): void {
  const currency = store.data.currency || '₹';
  const insights = store.getMonthlyInsights(currentMonthYear);
  const events = store.getBillCalendarEvents(currentMonthYear);
  const recurringRules = store.getRecurringRules();
  const cards = store.getCreditCards();
  const goals = store.getSavingsGoals();

  container.innerHTML = `
    <div class="card" style="margin-bottom: 18px;">
      <div class="card-header">
        <div>
          <h3 class="card-title">Smart Monthly Insights (${currentMonthYear})</h3>
          <p style="font-size: 12px; color: var(--text-secondary); margin-top: 4px;">Budget, savings, card usage, and spending signals from your current data.</p>
        </div>
        <button class="btn btn-secondary btn-sm" id="generateRecurringBtn">🔁 Generate This Month</button>
      </div>
      <div class="metrics-grid" style="grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 12px;">
        ${insights.length === 0 ? `<div class="empty-state" style="grid-column: 1 / -1;">Add income, budgets, and expenses to see monthly insights.</div>` : insights.map(i => `
          <div class="metric-card" style="padding: 14px;">
            <div class="metric-header">
              <span class="metric-title">${escapeHTML(i.title)}</span>
              <span class="badge ${i.severity === 'danger' ? 'badge-danger' : i.severity === 'warning' ? 'badge-warning' : i.severity === 'good' ? 'badge-success' : 'badge-info'}">${i.severity}</span>
            </div>
            <div class="metric-sub" style="line-height: 1.45;">${escapeHTML(i.detail)}</div>
          </div>
        `).join('')}
      </div>
    </div>

    <div class="card" style="margin-bottom: 18px;">
      <div class="card-header">
        <h3 class="card-title">Bill Reminder Calendar</h3>
      </div>
      <div class="table-responsive">
        <table class="custom-table">
          <thead><tr><th>Date</th><th>Item</th><th>Type</th><th>Status</th><th>Amount</th></tr></thead>
          <tbody>
            ${events.length === 0 ? `<tr><td colspan="5" class="empty-state">No reminders for ${currentMonthYear}.</td></tr>` : events.map(e => `
              <tr>
                <td>${escapeHTML(e.date)}</td>
                <td><strong>${escapeHTML(e.title)}</strong></td>
                <td><span class="badge badge-info">${escapeHTML(e.type)}</span></td>
                <td><span class="badge ${e.status === 'paid' ? 'badge-success' : e.status === 'pending' ? 'badge-warning' : 'badge-danger'}">${escapeHTML(e.status)}</span></td>
                <td style="font-weight: 700;">${currency}${e.amount.toLocaleString('en-IN')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <div class="charts-grid">
      <div class="card">
        <div class="card-header"><h3 class="card-title">Recurring Transactions</h3></div>
        <form id="recurringForm">
          <div class="form-row">
            <div class="form-group"><label>Title</label><input class="form-control" id="recTitle" required placeholder="Rent, Netflix, SIP"></div>
            <div class="form-group"><label>Amount</label><input class="form-control" id="recAmount" type="number" min="0" step="any" required></div>
          </div>
          <div class="form-row">
            <div class="form-group"><label>Category</label><select class="form-control" id="recCategory">${CATEGORIES.map(c => `<option value="${c}">${c}</option>`).join('')}</select></div>
            <div class="form-group"><label>Type</label><select class="form-control" id="recType"><option value="expense">Expense</option><option value="investment">Investment</option><option value="emi">EMI</option><option value="income">Income</option></select></div>
          </div>
          <div class="form-row">
            <div class="form-group"><label>Due Day</label><input class="form-control" id="recDay" type="number" min="1" max="31" value="1"></div>
            <div class="form-group"><label>Tags</label><input class="form-control" id="recTags" placeholder="rent, fixed"></div>
          </div>
          <div class="modal-actions" style="padding: 0; margin-top: 8px;"><button class="btn btn-primary" type="submit">Save Rule</button></div>
        </form>
        <div style="margin-top: 16px;">${renderRecurringList(recurringRules, currency)}</div>
      </div>

      <div class="card">
        <div class="card-header"><h3 class="card-title">Credit Card Tracker</h3></div>
        <form id="cardForm">
          <div class="form-row">
            <div class="form-group"><label>Card Name</label><input class="form-control" id="cardName" required placeholder="HDFC Millennia"></div>
            <div class="form-group"><label>Bank</label><input class="form-control" id="cardBank" placeholder="HDFC"></div>
          </div>
          <div class="form-row">
            <div class="form-group"><label>Limit</label><input class="form-control" id="cardLimit" type="number" min="0" required></div>
            <div class="form-group"><label>Outstanding</label><input class="form-control" id="cardOutstanding" type="number" min="0" value="0"></div>
          </div>
          <div class="form-row">
            <div class="form-group"><label>Statement Day</label><input class="form-control" id="cardStatementDay" type="number" min="1" max="31" value="1"></div>
            <div class="form-group"><label>Due Day</label><input class="form-control" id="cardDueDay" type="number" min="1" max="31" value="15"></div>
          </div>
          <div class="modal-actions" style="padding: 0; margin-top: 8px;"><button class="btn btn-primary" type="submit">Save Card</button></div>
        </form>
        <div style="margin-top: 16px;">${renderCardList(cards, currentMonthYear, currency)}</div>
      </div>
    </div>

    <div class="charts-grid">
      <div class="card">
        <div class="card-header"><h3 class="card-title">Savings Goals</h3></div>
        <form id="goalForm">
          <div class="form-row">
            <div class="form-group"><label>Goal Name</label><input class="form-control" id="goalName" required placeholder="Emergency Fund"></div>
            <div class="form-group"><label>Target Amount</label><input class="form-control" id="goalTarget" type="number" min="0" required></div>
          </div>
          <div class="form-row">
            <div class="form-group"><label>Saved So Far</label><input class="form-control" id="goalCurrent" type="number" min="0" value="0"></div>
            <div class="form-group"><label>Monthly Contribution</label><input class="form-control" id="goalMonthly" type="number" min="0" value="0"></div>
          </div>
          <div class="form-row">
            <div class="form-group"><label>Target Date</label><input class="form-control" id="goalDate" type="date"></div>
            <div class="form-group"><label>Notes</label><input class="form-control" id="goalNotes" placeholder="Optional"></div>
          </div>
          <div class="modal-actions" style="padding: 0; margin-top: 8px;"><button class="btn btn-primary" type="submit">Save Goal</button></div>
        </form>
        <div style="margin-top: 16px;">${renderGoalList(goals, currency)}</div>
      </div>

      <div class="card">
        <div class="card-header"><h3 class="card-title">Split Expense</h3></div>
        <form id="splitForm">
          <div class="form-row">
            <div class="form-group"><label>Title</label><input class="form-control" id="splitTitle" required placeholder="Dinner, trip, cab"></div>
            <div class="form-group"><label>Total Amount</label><input class="form-control" id="splitAmount" type="number" min="0" step="any" required></div>
          </div>
          <div class="form-row">
            <div class="form-group"><label>People</label><input class="form-control" id="splitPeople" required placeholder="Rahul, Amit"></div>
            <div class="form-group"><label>Date</label><input class="form-control" id="splitDate" type="date" value="${new Date().toISOString().split('T')[0]}"></div>
          </div>
          <div class="form-row">
            <div class="form-group"><label>Category</label><select class="form-control" id="splitCategory">${CATEGORIES.filter(c => c !== 'Income').map(c => `<option value="${c}">${c}</option>`).join('')}</select></div>
            <div class="form-group"><label>Payment Method</label><select class="form-control" id="splitPayment"><option>UPI</option><option>Cash</option><option>Credit Card</option><option>NetBanking</option></select></div>
          </div>
          <div class="modal-actions" style="padding: 0; margin-top: 8px;"><button class="btn btn-primary" type="submit">Create Split</button></div>
        </form>
      </div>
    </div>
  `;

  attachPlannerListeners(container, currentMonthYear);
}

function renderRecurringList(rules: RecurringRule[], currency: string): string {
  if (rules.length === 0) return `<div class="empty-state">No recurring rules yet.</div>`;
  return rules.map(r => `
    <div class="metric-card" style="padding: 12px; margin-bottom: 10px;">
      <div class="metric-header">
        <span class="metric-title">${escapeHTML(r.title)}</span>
        <span class="badge ${r.active ? 'badge-success' : 'badge-warning'}">${r.active ? 'active' : 'paused'}</span>
      </div>
      <div class="metric-sub">${currency}${r.amount.toLocaleString('en-IN')} • ${escapeHTML(r.category)} • day ${r.dayOfMonth}</div>
      <div style="display: flex; gap: 8px; margin-top: 10px;">
        <button class="btn btn-secondary btn-sm toggle-recurring-btn" data-id="${r.id}">${r.active ? 'Pause' : 'Resume'}</button>
        <button class="btn btn-secondary btn-sm delete-recurring-btn" data-id="${r.id}" style="color: var(--accent-danger);">Delete</button>
      </div>
    </div>
  `).join('');
}

function renderCardList(cards: CreditCard[], monthYear: string, currency: string): string {
  if (cards.length === 0) return `<div class="empty-state">No credit cards saved yet.</div>`;
  return cards.map(card => {
    const monthSpend = store.getCreditCardSpend(card.id, monthYear);
    const total = card.currentOutstanding + monthSpend;
    const percent = card.limit > 0 ? Math.min(100, Math.round((total / card.limit) * 100)) : 0;
    return `
      <div class="metric-card" style="padding: 12px; margin-bottom: 10px;">
        <div class="metric-header"><span class="metric-title">${escapeHTML(card.name)}</span><span class="badge ${percent > 85 ? 'badge-danger' : percent > 65 ? 'badge-warning' : 'badge-success'}">${percent}% used</span></div>
        <div class="metric-value" style="font-size: 18px;">${currency}${total.toLocaleString('en-IN')} <span style="font-size: 11px; color: var(--text-muted);">/ ${currency}${card.limit.toLocaleString('en-IN')}</span></div>
        <div class="metric-sub">${escapeHTML(card.bank)} • Due day ${card.dueDay} • This month ${currency}${monthSpend.toLocaleString('en-IN')}</div>
        <div class="progress-bar-bg" style="margin-top: 8px;"><div class="progress-bar-fill" style="width: ${percent}%;"></div></div>
        <div style="display: flex; gap: 8px; margin-top: 10px;">
          <button class="btn btn-secondary btn-sm pay-card-btn" data-id="${card.id}">Record Payment</button>
          <button class="btn btn-secondary btn-sm delete-card-btn" data-id="${card.id}" style="color: var(--accent-danger);">Delete</button>
        </div>
      </div>
    `;
  }).join('');
}

function renderGoalList(goals: SavingsGoal[], currency: string): string {
  if (goals.length === 0) return `<div class="empty-state">No savings goals yet.</div>`;
  return goals.map(goal => {
    const percent = goal.targetAmount > 0 ? Math.min(100, Math.round((goal.currentAmount / goal.targetAmount) * 100)) : 0;
    return `
      <div class="metric-card" style="padding: 12px; margin-bottom: 10px;">
        <div class="metric-header"><span class="metric-title">${escapeHTML(goal.name)}</span><span class="badge ${goal.status === 'completed' ? 'badge-success' : 'badge-info'}">${percent}%</span></div>
        <div class="metric-value" style="font-size: 18px;">${currency}${goal.currentAmount.toLocaleString('en-IN')} <span style="font-size: 11px; color: var(--text-muted);">/ ${currency}${goal.targetAmount.toLocaleString('en-IN')}</span></div>
        <div class="metric-sub">Monthly: ${currency}${goal.monthlyContribution.toLocaleString('en-IN')}${goal.targetDate ? ` • Target: ${escapeHTML(goal.targetDate)}` : ''}</div>
        <div class="progress-bar-bg" style="margin-top: 8px;"><div class="progress-bar-fill" style="width: ${percent}%; background: var(--grad-success);"></div></div>
        <div style="display: flex; gap: 8px; margin-top: 10px;">
          <button class="btn btn-secondary btn-sm contribute-goal-btn" data-id="${goal.id}">Add Contribution</button>
          <button class="btn btn-secondary btn-sm delete-goal-btn" data-id="${goal.id}" style="color: var(--accent-danger);">Delete</button>
        </div>
      </div>
    `;
  }).join('');
}

function attachPlannerListeners(container: HTMLElement, currentMonthYear: string): void {
  container.querySelector('#generateRecurringBtn')?.addEventListener('click', () => {
    store.generateDueRecurringTransactions(currentMonthYear);
    renderPlannerView(container, currentMonthYear);
  });

  container.querySelector('#recurringForm')?.addEventListener('submit', (e: any) => {
    e.preventDefault();
    store.addRecurringRule({
      title: getInput('recTitle'),
      amount: getNumber('recAmount'),
      category: getInput('recCategory'),
      type: getInput('recType') as any,
      paymentMethod: 'Auto-Debit',
      frequency: 'monthly',
      dayOfMonth: getNumber('recDay'),
      startDate: `${currentMonthYear}-01`,
      tags: splitCsv(getInput('recTags')),
      active: true
    });
    renderPlannerView(container, currentMonthYear);
  });

  container.querySelector('#cardForm')?.addEventListener('submit', (e: any) => {
    e.preventDefault();
    store.addCreditCard({
      name: getInput('cardName'),
      bank: getInput('cardBank'),
      limit: getNumber('cardLimit'),
      currentOutstanding: getNumber('cardOutstanding'),
      statementDay: getNumber('cardStatementDay'),
      dueDay: getNumber('cardDueDay')
    });
    renderPlannerView(container, currentMonthYear);
  });

  container.querySelector('#goalForm')?.addEventListener('submit', (e: any) => {
    e.preventDefault();
    store.addSavingsGoal({
      name: getInput('goalName'),
      targetAmount: getNumber('goalTarget'),
      currentAmount: getNumber('goalCurrent'),
      monthlyContribution: getNumber('goalMonthly'),
      targetDate: getInput('goalDate'),
      notes: getInput('goalNotes')
    });
    renderPlannerView(container, currentMonthYear);
  });

  container.querySelector('#splitForm')?.addEventListener('submit', (e: any) => {
    e.preventDefault();
    store.addSplitExpense({
      title: getInput('splitTitle'),
      amount: getNumber('splitAmount'),
      category: getInput('splitCategory'),
      paymentMethod: getInput('splitPayment'),
      date: getInput('splitDate'),
      notes: 'Created from split expense'
    }, splitCsv(getInput('splitPeople')), true);
    renderPlannerView(container, currentMonthYear);
  });

  container.querySelectorAll('.toggle-recurring-btn').forEach(btn => btn.addEventListener('click', () => {
    const id = btn.getAttribute('data-id') || '';
    const rule = store.getRecurringRules().find(r => r.id === id);
    if (rule) store.editRecurringRule(id, { active: !rule.active });
    renderPlannerView(container, currentMonthYear);
  }));
  container.querySelectorAll('.delete-recurring-btn').forEach(btn => btn.addEventListener('click', () => {
    const id = btn.getAttribute('data-id') || '';
    if (id && confirm('Delete this recurring rule?')) store.deleteRecurringRule(id);
    renderPlannerView(container, currentMonthYear);
  }));
  container.querySelectorAll('.pay-card-btn').forEach(btn => btn.addEventListener('click', () => {
    const id = btn.getAttribute('data-id') || '';
    const amount = parseFloat(prompt('Payment amount?') || '0');
    if (id && amount > 0) store.recordCreditCardPayment(id, amount);
    renderPlannerView(container, currentMonthYear);
  }));
  container.querySelectorAll('.delete-card-btn').forEach(btn => btn.addEventListener('click', () => {
    const id = btn.getAttribute('data-id') || '';
    if (id && confirm('Delete this credit card?')) store.deleteCreditCard(id);
    renderPlannerView(container, currentMonthYear);
  }));
  container.querySelectorAll('.contribute-goal-btn').forEach(btn => btn.addEventListener('click', () => {
    const id = btn.getAttribute('data-id') || '';
    const amount = parseFloat(prompt('Contribution amount?') || '0');
    if (id && amount > 0) store.contributeToSavingsGoal(id, amount);
    renderPlannerView(container, currentMonthYear);
  }));
  container.querySelectorAll('.delete-goal-btn').forEach(btn => btn.addEventListener('click', () => {
    const id = btn.getAttribute('data-id') || '';
    if (id && confirm('Delete this savings goal?')) store.deleteSavingsGoal(id);
    renderPlannerView(container, currentMonthYear);
  }));
}

function getInput(id: string): string {
  const el = document.getElementById(id) as HTMLInputElement | HTMLSelectElement | null;
  return el ? String(el.value || '').trim() : '';
}

function getNumber(id: string): number {
  const val = parseFloat(getInput(id));
  return Number.isFinite(val) && val > 0 ? val : 0;
}

function splitCsv(value: string): string[] {
  return value.split(',').map(v => v.trim()).filter(Boolean);
}

function escapeHTML(str: string): string {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
