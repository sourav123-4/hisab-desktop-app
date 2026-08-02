import { 
  saveToCloud, 
  deleteFromCloud, 
  subscribeToCloudCollection, 
  fullSyncToCloud 
} from './firebaseSync.js';

const STORAGE_KEY = 'daily_hisab_app_data_v2';

// Clean initial data structure
const sampleData = {
  currency: '₹',
  theme: 'dark',
  salary: [],
  transactions: [],
  loans: [],
  investments: [],
  budgets: {
    'Food': 0,
    'Bills': 0,
    'Transport': 0,
    'Shopping': 0,
    'Entertainment': 0,
    'Health': 0
  }
};

class Store {
  constructor() {
    this.currentUserId = 'guest';
    this.activeUnsubscribers = [];
    this.data = this.load();
    this.initCloudSubscriptions();
  }

  getStorageKey() {
    if (this.currentUserId && this.currentUserId !== 'guest') {
      return `daily_hisab_app_data_user_${this.currentUserId}`;
    }
    return 'daily_hisab_app_data_v2';
  }

  clearCloudSubscriptions() {
    if (Array.isArray(this.activeUnsubscribers)) {
      this.activeUnsubscribers.forEach(unsub => {
        try { if (typeof unsub === 'function') unsub(); } catch (e) {}
      });
    }
    this.activeUnsubscribers = [];
  }

  switchUser(user) {
    const newUid = (user && !user.isAnonymous) ? user.uid : 'guest';
    if (this.currentUserId === newUid) return;

    this.currentUserId = newUid;
    this.clearCloudSubscriptions();
    this.data = this.load();
    this.initCloudSubscriptions();

    if (user && !user.isAnonymous) {
      fullSyncToCloud(this.data);
    }
    if (typeof window.onHisabStoreUpdate === 'function') window.onHisabStoreUpdate();
  }

  initCloudSubscriptions() {
    this.clearCloudSubscriptions();

    // Subscribe to Firestore Transactions
    const unsubTx = subscribeToCloudCollection('transactions', (cloudTxs) => {
      if (Array.isArray(cloudTxs)) {
        const prevJson = JSON.stringify(this.data.transactions);
        const cloudIds = new Set(cloudTxs.map(t => t.id));
        const mergedMap = new Map();
        this.data.transactions.forEach(t => { if (cloudIds.has(t.id)) mergedMap.set(t.id, t); });
        cloudTxs.forEach(t => mergedMap.set(t.id, t));
        const newTxs = Array.from(mergedMap.values()).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
        if (JSON.stringify(newTxs) !== prevJson) {
          this.data.transactions = newTxs;
          this.save(this.data);
          if (typeof window.onHisabStoreUpdate === 'function') window.onHisabStoreUpdate();
        }
      }
    });

    // Subscribe to Firestore Salary
    const unsubSal = subscribeToCloudCollection('salary', (cloudSalary) => {
      if (Array.isArray(cloudSalary)) {
        const prevJson = JSON.stringify(this.data.salary);
        const cloudIds = new Set(cloudSalary.map(s => s.id));
        const mergedMap = new Map();
        this.data.salary.forEach(s => { if (cloudIds.has(s.id)) mergedMap.set(s.id, s); });
        cloudSalary.forEach(s => mergedMap.set(s.id, s));
        const newSalary = Array.from(mergedMap.values());
        if (JSON.stringify(newSalary) !== prevJson) {
          this.data.salary = newSalary;
          this.save(this.data);
          if (typeof window.onHisabStoreUpdate === 'function') window.onHisabStoreUpdate();
        }
      }
    });

    // Subscribe to Firestore Loans
    const unsubLoan = subscribeToCloudCollection('loans', (cloudLoans) => {
      if (Array.isArray(cloudLoans)) {
        const prevJson = JSON.stringify(this.data.loans);
        const cloudIds = new Set(cloudLoans.map(l => l.id));
        const mergedMap = new Map();
        this.data.loans.forEach(l => { if (cloudIds.has(l.id)) mergedMap.set(l.id, l); });
        cloudLoans.forEach(l => mergedMap.set(l.id, l));
        const newLoans = Array.from(mergedMap.values());
        if (JSON.stringify(newLoans) !== prevJson) {
          this.data.loans = newLoans;
          this.save(this.data);
          if (typeof window.onHisabStoreUpdate === 'function') window.onHisabStoreUpdate();
        }
      }
    });

    // Subscribe to Firestore Investments
    const unsubInv = subscribeToCloudCollection('investments', (cloudInvs) => {
      if (Array.isArray(cloudInvs)) {
        const prevJson = JSON.stringify(this.data.investments);
        const cloudIds = new Set(cloudInvs.map(i => i.id));
        const mergedMap = new Map();
        this.data.investments.forEach(i => { if (cloudIds.has(i.id)) mergedMap.set(i.id, i); });
        cloudInvs.forEach(i => mergedMap.set(i.id, i));
        const newInvs = Array.from(mergedMap.values());
        if (JSON.stringify(newInvs) !== prevJson) {
          this.data.investments = newInvs;
          this.save(this.data);
          if (typeof window.onHisabStoreUpdate === 'function') window.onHisabStoreUpdate();
        }
      }
    });

    // Subscribe to Firestore Settings / Budgets
    const unsubSet = subscribeToCloudCollection('settings', (cloudSettings) => {
      if (Array.isArray(cloudSettings)) {
        const budgetObj = cloudSettings.find(s => s.categories || s.id === 'budgets');
        if (budgetObj && budgetObj.categories) {
          const prevJson = JSON.stringify(this.data.budgets);
          const newJson = JSON.stringify(budgetObj.categories);
          if (prevJson !== newJson) {
            this.data.budgets = budgetObj.categories;
            this.save(this.data);
            if (typeof window.onHisabStoreUpdate === 'function') window.onHisabStoreUpdate();
          }
        }
      }
    });

    this.activeUnsubscribers.push(unsubTx, unsubSal, unsubLoan, unsubInv, unsubSet);
  }

  load() {
    try {
      const key = this.getStorageKey();
      const raw = localStorage.getItem(key);
      if (!raw) {
        const initialData = JSON.parse(JSON.stringify(sampleData));
        this.save(initialData);
        return initialData;
      }
      return JSON.parse(raw);
    } catch (e) {
      console.warn('Failed loading local data, resetting store', e);
      return JSON.parse(JSON.stringify(sampleData));
    }
  }

  save(data = this.data) {
    try {
      const key = this.getStorageKey();
      localStorage.setItem(key, JSON.stringify(data));
      this.data = data;
    } catch (e) {
      console.error('Failed saving data to localStorage', e);
    }
  }

  async resetToSampleData() {
    this.clearCloudSubscriptions();

    try {
      const deletePromises = [];
      if (Array.isArray(this.data.transactions)) {
        this.data.transactions.forEach(tx => deletePromises.push(deleteFromCloud('transactions', tx.id)));
      }
      if (Array.isArray(this.data.salary)) {
        this.data.salary.forEach(sal => deletePromises.push(deleteFromCloud('salary', sal.id)));
      }
      if (Array.isArray(this.data.loans)) {
        this.data.loans.forEach(loan => deletePromises.push(deleteFromCloud('loans', loan.id)));
      }
      if (Array.isArray(this.data.investments)) {
        this.data.investments.forEach(inv => deletePromises.push(deleteFromCloud('investments', inv.id)));
      }

      await Promise.race([
        Promise.all(deletePromises),
        new Promise(resolve => setTimeout(resolve, 1500))
      ]);
    } catch (err) {
      console.warn('Error clearing cloud data during reset:', err);
    }

    const freshData = JSON.parse(JSON.stringify(sampleData));
    this.data = freshData;
    this.save(freshData);
    this.initCloudSubscriptions();

    if (typeof window.onHisabStoreUpdate === 'function') window.onHisabStoreUpdate();
  }

  // Transactions
  getTransactions(monthYearFilter = null) {
    if (!monthYearFilter) return this.data.transactions;
    return this.data.transactions.filter(tx => tx.date && tx.date.startsWith(monthYearFilter));
  }

  getRecentTransactions(limit = 7) {
    if (!Array.isArray(this.data.transactions)) return [];
    return [...this.data.transactions].slice(0, limit);
  }

  addTransaction(tx) {
    const newTx = {
      id: 'tx-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
      date: tx.date || new Date().toISOString().split('T')[0],
      title: tx.title,
      amount: parseFloat(tx.amount) || 0,
      category: tx.category || 'Others',
      type: tx.type || 'expense',
      paymentMethod: tx.paymentMethod || 'UPI',
      notes: tx.notes || ''
    };
    this.data.transactions.unshift(newTx);
    saveToCloud('transactions', newTx.id, newTx);

    const monthYear = newTx.date.substring(0, 7);

    // 1. Auto-sync Income/Salary entries into Salary Ledger
    if (newTx.type === 'income' || newTx.category === 'Income' || /salary/i.test(newTx.title)) {
      if (!Array.isArray(this.data.salary)) this.data.salary = [];
      const existingIndex = this.data.salary.findIndex(s => s.monthYear === monthYear);
      if (existingIndex >= 0) {
        this.data.salary[existingIndex].grossAmount += newTx.amount;
        this.data.salary[existingIndex].netAmount += newTx.amount;
        saveToCloud('salary', this.data.salary[existingIndex].id, this.data.salary[existingIndex]);
      } else {
        const salObj = {
          id: 'sal-' + Date.now(),
          monthYear: monthYear,
          company: newTx.title || 'Income Credit',
          grossAmount: newTx.amount,
          deductions: 0,
          netAmount: newTx.amount,
          receivedDate: newTx.date,
          status: 'credited'
        };
        this.data.salary.unshift(salObj);
        saveToCloud('salary', salObj.id, salObj);
      }
    }

    // 2. Auto-sync EMI/Loans
    if (newTx.type === 'emi' || newTx.category === 'EMI' || /loan|emi/i.test(newTx.title)) {
      if (Array.isArray(this.data.loans) && this.data.loans.length > 0) {
        const matchingLoan = this.data.loans.find(l => 
          newTx.title.toLowerCase().includes(l.name.toLowerCase()) || 
          newTx.title.toLowerCase().includes(l.lender.toLowerCase())
        ) || this.data.loans.find(l => l.status === 'Active');

        if (matchingLoan) {
          matchingLoan.remainingAmount = Math.max(0, matchingLoan.remainingAmount - newTx.amount);
          if (matchingLoan.remainingAmount === 0) matchingLoan.status = 'Paid Off';
          saveToCloud('loans', matchingLoan.id, matchingLoan);
        }
      }
    }

    // 3. Auto-sync Investment/SIP
    if (newTx.type === 'investment' || newTx.category === 'Investment' || /sip|invest|stocks|mutual fund/i.test(newTx.title)) {
      if (Array.isArray(this.data.investments) && this.data.investments.length > 0) {
        const matchingInv = this.data.investments.find(i => 
          newTx.title.toLowerCase().includes(i.name.toLowerCase()) ||
          newTx.title.toLowerCase().includes(i.platform.toLowerCase())
        ) || this.data.investments[0];

        if (matchingInv) {
          matchingInv.totalInvested += newTx.amount;
          matchingInv.currentValue += newTx.amount;
          saveToCloud('investments', matchingInv.id, matchingInv);
        }
      }
    }

    this.save();
    return newTx;
  }

  deleteTransaction(id) {
    this.data.transactions = this.data.transactions.filter(tx => tx.id !== id);
    deleteFromCloud('transactions', id);
    this.save();
  }

  // Loans & EMIs
  getLoans() {
    return this.data.loans;
  }

  addLoan(loan) {
    const newLoan = {
      id: 'loan-' + Date.now(),
      name: loan.name,
      lender: loan.lender || '',
      totalPrincipal: parseFloat(loan.totalPrincipal) || 0,
      remainingAmount: parseFloat(loan.remainingAmount) || parseFloat(loan.totalPrincipal) || 0,
      monthlyEmi: parseFloat(loan.monthlyEmi) || 0,
      interestRate: parseFloat(loan.interestRate) || 0,
      emiDay: parseInt(loan.emiDay) || 5,
      status: 'Active'
    };
    this.data.loans.push(newLoan);
    saveToCloud('loans', newLoan.id, newLoan);
    this.save();
    return newLoan;
  }

  deleteLoan(id) {
    this.data.loans = this.data.loans.filter(l => l.id !== id);
    deleteFromCloud('loans', id);
    this.save();
  }

  payEmiForLoan(loanId, monthYear) {
    const loan = this.data.loans.find(l => l.id === loanId);
    if (!loan) return;

    loan.remainingAmount = Math.max(0, loan.remainingAmount - loan.monthlyEmi);
    if (loan.remainingAmount === 0) loan.status = 'Paid Off';
    saveToCloud('loans', loan.id, loan);

    const today = new Date();
    const dateStr = monthYear ? `${monthYear}-05` : today.toISOString().split('T')[0];

    this.addTransaction({
      date: dateStr,
      title: `${loan.name} Monthly EMI`,
      amount: loan.monthlyEmi,
      category: 'EMI',
      type: 'emi',
      paymentMethod: 'Auto-Debit',
      notes: `EMI Payment recorded for ${loan.lender}`
    });
  }

  // Investments
  getInvestments() {
    return this.data.investments;
  }

  addInvestment(inv) {
    const newInv = {
      id: 'inv-' + Date.now(),
      name: inv.name,
      category: inv.category || 'Mutual Funds',
      type: inv.type || 'SIP',
      monthlySip: parseFloat(inv.monthlySip) || 0,
      totalInvested: parseFloat(inv.totalInvested) || 0,
      currentValue: parseFloat(inv.currentValue) || parseFloat(inv.totalInvested) || 0,
      platform: inv.platform || '',
      startDate: inv.startDate || new Date().toISOString().split('T')[0]
    };
    this.data.investments.push(newInv);
    saveToCloud('investments', newInv.id, newInv);
    this.save();
    return newInv;
  }

  deleteInvestment(id) {
    this.data.investments = this.data.investments.filter(i => i.id !== id);
    deleteFromCloud('investments', id);
    this.save();
  }

  paySipForInvestment(invId, monthYear) {
    const inv = this.data.investments.find(i => i.id === invId);
    if (!inv || inv.monthlySip <= 0) return;

    inv.totalInvested += inv.monthlySip;
    inv.currentValue += inv.monthlySip;
    saveToCloud('investments', inv.id, inv);

    const today = new Date();
    const dateStr = monthYear ? `${monthYear}-10` : today.toISOString().split('T')[0];

    this.addTransaction({
      date: dateStr,
      title: `${inv.name} Monthly SIP`,
      amount: inv.monthlySip,
      category: 'Investment',
      type: 'investment',
      paymentMethod: 'Auto-Debit',
      notes: `SIP Investment payment for ${inv.platform}`
    });
  }

  // Salary & Income
  getSalaryRecords() {
    return this.data.salary;
  }

  addOrUpdateSalary(record) {
    const monthYear = record.monthYear;
    const existingIndex = this.data.salary.findIndex(s => s.monthYear === monthYear);
    const salObj = {
      id: existingIndex >= 0 ? this.data.salary[existingIndex].id : 'sal-' + Date.now(),
      monthYear: monthYear,
      company: record.company || 'Employer',
      grossAmount: parseFloat(record.grossAmount) || 0,
      deductions: parseFloat(record.deductions) || 0,
      netAmount: parseFloat(record.netAmount) || (parseFloat(record.grossAmount) - parseFloat(record.deductions || 0)),
      receivedDate: record.receivedDate || new Date().toISOString().split('T')[0],
      status: record.status || 'credited',
      notes: record.notes || ''
    };

    if (existingIndex >= 0) {
      this.data.salary[existingIndex] = salObj;
    } else {
      this.data.salary.push(salObj);
    }
    saveToCloud('salary', salObj.id, salObj);
    this.save();
  }

  // Budgets
  getBudgets() {
    return this.data.budgets || {};
  }

  setBudget(category, amount) {
    if (!this.data.budgets) this.data.budgets = {};
    this.data.budgets[category] = parseFloat(amount) || 0;
    saveToCloud('settings', 'budgets', { categories: this.data.budgets });
    this.save();
  }

  // Analytics Helpers (Accurate Single-Source Calculation)
  getMonthlyMetrics(monthYear) {
    const txs = this.getTransactions(monthYear);

    let totalIncome = 0;
    let totalExpenses = 0;
    let totalInvestments = 0;
    let totalEmisPaid = 0;

    txs.forEach(tx => {
      if (tx.type === 'income' || tx.category === 'Income' || /salary/i.test(tx.title)) {
        totalIncome += tx.amount;
      } else if (tx.type === 'investment' || tx.category === 'Investment') {
        totalInvestments += tx.amount;
      } else if (tx.type === 'emi' || tx.category === 'EMI') {
        totalEmisPaid += tx.amount;
      } else {
        totalExpenses += tx.amount;
      }
    });

    // Also include salary record if logged separately and higher than transaction sum
    const salaryRec = Array.isArray(this.data.salary) ? this.data.salary.find(s => s.monthYear === monthYear) : null;
    if (salaryRec && salaryRec.netAmount > totalIncome) {
      totalIncome = salaryRec.netAmount;
    }

    const netOutflow = totalExpenses + totalInvestments + totalEmisPaid;
    const netSavings = totalIncome - netOutflow;

    return {
      totalIncome,
      totalExpenses,
      totalInvestments,
      totalEmisPaid,
      netOutflow,
      netSavings
    };
  }

  exportJSON() {
    const str = JSON.stringify(this.data, null, 2);
    const blob = new Blob([str], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hisabkit_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  importJSON(jsonString) {
    try {
      const parsed = JSON.parse(jsonString);
      if (parsed && parsed.transactions && parsed.loans) {
        this.save(parsed);
        window.location.reload();
        return true;
      }
    } catch (e) {
      alert('Invalid JSON backup file format');
    }
    return false;
  }
}

export const store = new Store();
