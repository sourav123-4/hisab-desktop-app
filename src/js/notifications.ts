import { store } from './store.js';

export function checkAndTriggerDesktopAlerts(): void {
  const security = store.getSecuritySettings();
  if (!security.notificationsEnabled) return;

  const monthYear = new Date().toISOString().substring(0, 7);
  const txs = store.getTransactions(monthYear);
  const budgets = store.getBudgets();

  const categorySpent: Record<string, number> = {};
  txs.forEach(tx => {
    if (tx.type === 'expense') {
      categorySpent[tx.category] = (categorySpent[tx.category] || 0) + (parseFloat(String(tx.amount)) || 0);
    }
  });

  Object.keys(budgets).forEach(cat => {
    const limit = budgets[cat];
    if (limit > 0) {
      const spent = categorySpent[cat] || 0;
      const ratio = spent / limit;
      if (ratio >= 1.0) {
        sendNotification(`⚠️ Budget Exceeded: ${cat}`, `You spent ${store.data.currency}${spent} out of ${store.data.currency}${limit} budgeted for ${cat}.`);
      } else if (ratio >= 0.85) {
        sendNotification(`🔔 Budget Warning: ${cat}`, `You have reached ${Math.round(ratio * 100)}% of your ${cat} budget.`);
      }
    }
  });

  const today = new Date();
  const currentDay = today.getDate();
  const loans = store.getLoans();

  loans.forEach(loan => {
    if (loan.status === 'Active' && loan.emiDay) {
      const daysUntilDue = loan.emiDay - currentDay;
      if (daysUntilDue >= 0 && daysUntilDue <= 3) {
        const msg = daysUntilDue === 0 
          ? `EMI Due Today for ${loan.name}: ${store.data.currency}${loan.monthlyEmi}`
          : `EMI Due in ${daysUntilDue} day(s) for ${loan.name}: ${store.data.currency}${loan.monthlyEmi}`;
        sendNotification(`💳 EMI Reminder: ${loan.name}`, msg);
      }
    }
  });
}

function sendNotification(title: string, body: string): void {
  if (typeof window !== 'undefined' && window.electronAPI && window.electronAPI.sendDesktopNotification) {
    window.electronAPI.sendDesktopNotification({ title, body });
  } else if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    new Notification(title, { body });
  }
}
