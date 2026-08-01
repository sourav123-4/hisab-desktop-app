/**
 * HisabKit Local Data Store & Engine
 */

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
    this.data = this.load();
  }

  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        this.save(sampleData);
        return JSON.parse(JSON.stringify(sampleData));
      }
      return JSON.parse(raw);
    } catch (e) {
      console.warn('Failed loading local data, resetting store', e);
      return JSON.parse(JSON.stringify(sampleData));
    }
  }

  save(data = this.data) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      this.data = data;
    } catch (e) {
      console.error('Failed saving data to localStorage', e);
    }
  }

  resetToSampleData() {
    this.save(sampleData);
    window.location.reload();
  }

  // Transactions
  getTransactions(monthYearFilter = null) {
    if (!monthYearFilter) return this.data.transactions;
    return this.data.transactions.filter(tx => tx.date.startsWith(monthYearFilter));
  }

  addTransaction(tx) {
    const newTx = {
      id: 'tx-' + Date.now(),
      date: tx.date || new Date().toISOString().split('T')[0],
      title: tx.title,
      amount: parseFloat(tx.amount) || 0,
      category: tx.category || 'Others',
      type: tx.type || 'expense',
      paymentMethod: tx.paymentMethod || 'UPI',
      notes: tx.notes || ''
    };
    this.data.transactions.unshift(newTx);
    this.save();
    return newTx;
  }

  deleteTransaction(id) {
    this.data.transactions = this.data.transactions.filter(tx => tx.id !== id);
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
    this.save();
    return newLoan;
  }

  deleteLoan(id) {
    this.data.loans = this.data.loans.filter(l => l.id !== id);
    this.save();
  }

  payEmiForLoan(loanId, monthYear) {
    const loan = this.data.loans.find(l => l.id === loanId);
    if (!loan) return;

    // Reduce remaining loan balance
    loan.remainingAmount = Math.max(0, loan.remainingAmount - loan.monthlyEmi);
    if (loan.remainingAmount === 0) loan.status = 'Paid Off';

    // Log EMI Transaction into Daily Hisab
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

    this.save();
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
    this.save();
    return newInv;
  }

  deleteInvestment(id) {
    this.data.investments = this.data.investments.filter(i => i.id !== id);
    this.save();
  }

  paySipForInvestment(invId, monthYear) {
    const inv = this.data.investments.find(i => i.id === invId);
    if (!inv || inv.monthlySip <= 0) return;

    inv.totalInvested += inv.monthlySip;
    inv.currentValue += inv.monthlySip;

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

    this.save();
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
    this.save();
  }

  // Budgets
  getBudgets() {
    return this.data.budgets || {};
  }

  setBudget(category, amount) {
    if (!this.data.budgets) this.data.budgets = {};
    this.data.budgets[category] = parseFloat(amount) || 0;
    this.save();
  }

  // Analytics Helpers
  getMonthlyMetrics(monthYear) {
    const txs = this.getTransactions(monthYear);
    const salaryRec = this.data.salary.find(s => s.monthYear === monthYear);

    let totalIncome = salaryRec ? salaryRec.netAmount : 0;
    let totalExpenses = 0;
    let totalInvestments = 0;
    let totalEmisPaid = 0;

    txs.forEach(tx => {
      if (tx.type === 'income' && (!salaryRec || tx.title !== salaryRec.notes)) {
        totalIncome += tx.amount;
      } else if (tx.type === 'expense') {
        totalExpenses += tx.amount;
      } else if (tx.type === 'investment') {
        totalInvestments += tx.amount;
      } else if (tx.type === 'emi') {
        totalEmisPaid += tx.amount;
      }
    });

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
