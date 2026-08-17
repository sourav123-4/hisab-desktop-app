import { 
  saveToCloud, 
  deleteFromCloud, 
  subscribeToCloudCollection, 
  fullSyncToCloud 
} from './firebaseSync.js';
import { cleanHisabTitle, parseNaturalLanguageHisab, detectCategoryFromText } from './aiParser.js';
import type { 
  StoreData, 
  Transaction, 
  Loan, 
  Investment, 
  SalaryRecord, 
  DebtRecord,
  CategoryBudgets, 
  MonthlyMetrics, 
  SecuritySettings, 
  ThemeName 
} from '../types/index.js';

function triggerToast(message: string, type: string = 'success'): void {
  if (typeof window !== 'undefined' && typeof (window as any).showToast === 'function') {
    (window as any).showToast(message, type);
  }
}

const sampleData: StoreData = {
  currency: '₹',
  theme: 'dark',
  securityPinEnabled: false,
  securityPinHash: '',
  fingerprintEnabled: false,
  notificationsEnabled: true,
  salary: [],
  transactions: [],
  loans: [],
  investments: [],
  debts: [],
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
  public currentUserId: string;
  public activeUnsubscribers: Array<(() => void) | any>;
  public data: StoreData;

  constructor() {
    this.currentUserId = this.getLastKnownUserId();
    this.activeUnsubscribers = [];
    this.data = this.load();
    this.initCloudSubscriptions();
  }

  getLastKnownUserId(): string {
    try {
      const storage = this.getStorage();
      if (storage) {
        const raw = storage.getItem('daily_hisab_last_known_user');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && parsed.uid) return parsed.uid;
        }
      }
    } catch (e) {}
    return 'guest';
  }

  getStorageKey(): string {
    if (this.currentUserId && this.currentUserId !== 'guest') {
      return `daily_hisab_app_data_user_${this.currentUserId}`;
    }
    return 'daily_hisab_app_data_v2';
  }

  notifyStoreUpdate(): void {
    if (typeof window !== 'undefined' && typeof window.onHisabStoreUpdate === 'function') {
      window.onHisabStoreUpdate();
    }
  }

  clearCloudSubscriptions(): void {
    if (Array.isArray(this.activeUnsubscribers)) {
      this.activeUnsubscribers.forEach(unsub => {
        try { if (typeof unsub === 'function') unsub(); } catch (e) {}
      });
    }
    this.activeUnsubscribers = [];
  }

  getStorage(): Storage | null {
    try {
      if (typeof window !== 'undefined' && window.localStorage) return window.localStorage;
      if (typeof localStorage !== 'undefined') return localStorage;
    } catch (e) {}
    return null;
  }

  migrateGuestDataToUser(targetUserId: string): void {
    try {
      const storage = this.getStorage();
      if (!storage) return;

      const guestKey = 'daily_hisab_app_data_v2';
      const guestRaw = storage.getItem(guestKey);
      if (!guestRaw) return;

      const guestData = JSON.parse(guestRaw);
      const userKey = `daily_hisab_app_data_user_${targetUserId}`;
      const userRaw = storage.getItem(userKey);
      const userData: StoreData = userRaw ? JSON.parse(userRaw) : JSON.parse(JSON.stringify(sampleData));

      let hasNewItems = false;

      if (Array.isArray(guestData.transactions) && guestData.transactions.length > 0) {
        const existingTxIds = new Set((userData.transactions || []).map((t: Transaction) => t.id));
        guestData.transactions.forEach((t: Transaction) => {
          if (!existingTxIds.has(t.id)) {
            userData.transactions.unshift(t);
            hasNewItems = true;
          }
        });
      }

      if (Array.isArray(guestData.salary) && guestData.salary.length > 0) {
        const existingSalIds = new Set((userData.salary || []).map((s: SalaryRecord) => s.id));
        guestData.salary.forEach((s: SalaryRecord) => {
          if (!existingSalIds.has(s.id)) {
            userData.salary.unshift(s);
            hasNewItems = true;
          }
        });
      }

      if (Array.isArray(guestData.loans) && guestData.loans.length > 0) {
        const existingLoanIds = new Set((userData.loans || []).map((l: Loan) => l.id));
        guestData.loans.forEach((l: Loan) => {
          if (!existingLoanIds.has(l.id)) {
            userData.loans.push(l);
            hasNewItems = true;
          }
        });
      }

      if (Array.isArray(guestData.investments) && guestData.investments.length > 0) {
        const existingInvIds = new Set((userData.investments || []).map((i: Investment) => i.id));
        guestData.investments.forEach((i: Investment) => {
          if (!existingInvIds.has(i.id)) {
            userData.investments.push(i);
            hasNewItems = true;
          }
        });
      }

      if (guestData.budgets) {
        userData.budgets = { ...userData.budgets, ...guestData.budgets };
        hasNewItems = true;
      }

      if (hasNewItems) {
        storage.setItem(userKey, JSON.stringify(userData));
        console.log(`[Store Migration] Successfully migrated guest items into user account (${targetUserId})`);
      }

      storage.setItem(guestKey, JSON.stringify(sampleData));
    } catch (err) {
      console.error('[Store Migration Error]', err);
    }
  }

  switchUser(user: any): void {
    const newUid = (user && !user.isAnonymous) ? user.uid : 'guest';
    const storage = this.getStorage();
    if (storage) {
      if (user && !user.isAnonymous) {
        storage.setItem('daily_hisab_last_known_user', JSON.stringify({
          uid: user.uid,
          email: user.email || '',
          displayName: user.displayName || user.email?.split('@')[0] || ''
        }));
      } else {
        storage.removeItem('daily_hisab_last_known_user');
      }
    }

    if (this.currentUserId === newUid) {
      if (user && !user.isAnonymous && (!this.activeUnsubscribers || this.activeUnsubscribers.length === 0)) {
        this.initCloudSubscriptions();
      }
      return;
    }

    if (this.currentUserId === 'guest' && newUid !== 'guest') {
      this.migrateGuestDataToUser(newUid);
    }

    this.currentUserId = newUid;
    this.clearCloudSubscriptions();
    this.data = this.load();
    this.initCloudSubscriptions();

    if (user && !user.isAnonymous) {
      fullSyncToCloud(this.data);
    }
    this.notifyStoreUpdate();
  }

  initCloudSubscriptions(): void {
    this.clearCloudSubscriptions();

    const unsubTx = subscribeToCloudCollection('transactions', (cloudTxs: Transaction[]) => {
      if (Array.isArray(cloudTxs)) {
        const prevJson = JSON.stringify(this.data.transactions);
        const mergedMap = new Map<string, Transaction>();
        (this.data.transactions || []).forEach(t => mergedMap.set(t.id, t));
        cloudTxs.forEach(t => mergedMap.set(t.id, t));
        const newTxs = Array.from(mergedMap.values()).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
        this.data.transactions = newTxs;
        this.rephraseAllEntries();
        if (JSON.stringify(this.data.transactions) !== prevJson) {
          this.save(this.data);
          this.notifyStoreUpdate();
        }
      }
    });

    const unsubSal = subscribeToCloudCollection('salary', (cloudSalary: SalaryRecord[]) => {
      if (Array.isArray(cloudSalary)) {
        const prevJson = JSON.stringify(this.data.salary);
        const mergedMap = new Map<string, SalaryRecord>();
        (this.data.salary || []).forEach(s => mergedMap.set(s.id, s));
        cloudSalary.forEach(s => mergedMap.set(s.id, s));
        const newSalary = Array.from(mergedMap.values());
        if (JSON.stringify(newSalary) !== prevJson) {
          this.data.salary = newSalary;
          this.save(this.data);
          this.notifyStoreUpdate();
        }
      }
    });

    const unsubLoan = subscribeToCloudCollection('loans', (cloudLoans: Loan[]) => {
      if (Array.isArray(cloudLoans)) {
        const prevJson = JSON.stringify(this.data.loans);
        const mergedMap = new Map<string, Loan>();
        (this.data.loans || []).forEach(l => mergedMap.set(l.id, l));
        cloudLoans.forEach(l => mergedMap.set(l.id, l));
        const newLoans = Array.from(mergedMap.values());
        if (JSON.stringify(newLoans) !== prevJson) {
          this.data.loans = newLoans;
          this.save(this.data);
          this.notifyStoreUpdate();
        }
      }
    });

    const unsubInv = subscribeToCloudCollection('investments', (cloudInvs: Investment[]) => {
      if (Array.isArray(cloudInvs)) {
        const prevJson = JSON.stringify(this.data.investments);
        const mergedMap = new Map<string, Investment>();
        (this.data.investments || []).forEach(i => mergedMap.set(i.id, i));
        cloudInvs.forEach(i => mergedMap.set(i.id, i));
        const newInvs = Array.from(mergedMap.values());
        if (JSON.stringify(newInvs) !== prevJson) {
          this.data.investments = newInvs;
          this.save(this.data);
          this.notifyStoreUpdate();
        }
      }
    });

    const unsubDebts = subscribeToCloudCollection('debts', (cloudDebts: DebtRecord[]) => {
      if (Array.isArray(cloudDebts)) {
        const prevJson = JSON.stringify(this.data.debts);
        const mergedMap = new Map<string, DebtRecord>();
        (this.data.debts || []).forEach(d => mergedMap.set(d.id, d));
        cloudDebts.forEach(d => mergedMap.set(d.id, d));
        const newDebts = Array.from(mergedMap.values());
        if (JSON.stringify(newDebts) !== prevJson) {
          this.data.debts = newDebts;
          this.save(this.data);
          this.notifyStoreUpdate();
        }
      }
    });

    const unsubSet = subscribeToCloudCollection('settings', (cloudSettings: any[]) => {
      if (Array.isArray(cloudSettings)) {
        const budgetObj = cloudSettings.find(s => s.categories || s.id === 'budgets');
        if (budgetObj && budgetObj.categories) {
          const prevJson = JSON.stringify(this.data.budgets);
          const newJson = JSON.stringify(budgetObj.categories);
          if (prevJson !== newJson) {
            this.data.budgets = budgetObj.categories;
            this.save(this.data);
            this.notifyStoreUpdate();
          }
        }
      }
    });

    this.activeUnsubscribers.push(unsubTx, unsubSal, unsubLoan, unsubInv, unsubDebts, unsubSet);
  }

  sanitizeData(parsed: any): StoreData {
    if (!parsed || typeof parsed !== 'object') parsed = {};
    return {
      currency: parsed.currency || '₹',
      theme: parsed.theme || 'dark',
      securityPinEnabled: Boolean(parsed.securityPinEnabled),
      securityPinHash: parsed.securityPinHash || '',
      fingerprintEnabled: Boolean(parsed.fingerprintEnabled),
      notificationsEnabled: parsed.notificationsEnabled !== undefined ? Boolean(parsed.notificationsEnabled) : true,
      salary: Array.isArray(parsed.salary) ? parsed.salary : [],
      transactions: Array.isArray(parsed.transactions) ? parsed.transactions : [],
      loans: Array.isArray(parsed.loans) ? parsed.loans : [],
      investments: Array.isArray(parsed.investments) ? parsed.investments : [],
      debts: Array.isArray(parsed.debts) ? parsed.debts : [],
      budgets: typeof parsed.budgets === 'object' && parsed.budgets !== null ? parsed.budgets : {
        'Food': 0,
        'Bills': 0,
        'Transport': 0,
        'Shopping': 0,
        'Entertainment': 0,
        'Health': 0
      }
    };
  }

  load(): StoreData {
    try {
      const key = this.getStorageKey();
      const storage = this.getStorage();
      const raw = storage ? storage.getItem(key) : null;
      let data: StoreData;
      if (!raw) {
        data = this.sanitizeData(JSON.parse(JSON.stringify(sampleData)));
      } else {
        data = this.sanitizeData(JSON.parse(raw));
      }

      // Auto-Recovery: If current storage key has 0 transactions, check for existing data in other local storage keys and recover it!
      if (storage && (!data.transactions || data.transactions.length === 0)) {
        for (let i = 0; i < storage.length; i++) {
          const k = storage.key(i);
          if (k && k.startsWith('daily_hisab_app_data')) {
            try {
              const legacyRaw = storage.getItem(k);
              if (legacyRaw) {
                const legacyParsed = JSON.parse(legacyRaw);
                if (Array.isArray(legacyParsed.transactions) && legacyParsed.transactions.length > 0) {
                  data.transactions = legacyParsed.transactions;
                  if (Array.isArray(legacyParsed.salary) && legacyParsed.salary.length > 0) data.salary = legacyParsed.salary;
                  if (Array.isArray(legacyParsed.loans) && legacyParsed.loans.length > 0) data.loans = legacyParsed.loans;
                  if (Array.isArray(legacyParsed.investments) && legacyParsed.investments.length > 0) data.investments = legacyParsed.investments;
                  if (Array.isArray(legacyParsed.debts) && legacyParsed.debts.length > 0) data.debts = legacyParsed.debts;
                  if (legacyParsed.budgets) data.budgets = legacyParsed.budgets;
                  console.log(`[Store Auto-Recovery] Restored ${data.transactions.length} transactions from key: ${k}`);
                  break;
                }
              }
            } catch (err) {}
          }
        }
      }

      this.rephraseAllEntries(data);
      this.save(data);
      return data;
    } catch (e) {
      console.warn('Failed loading local data, resetting store', e);
      return this.sanitizeData(JSON.parse(JSON.stringify(sampleData)));
    }
  }

  rephraseAllEntries(targetData: StoreData = this.data): number {
    if (!targetData || !Array.isArray(targetData.transactions)) return 0;
    let count = 0;
    targetData.transactions.forEach(tx => {
      const originalTitle = tx.title || '';
      const originalCategory = tx.category || 'Others';
      const notes = tx.notes || '';
      const combinedText = `${originalTitle} ${notes} ${tx.amount || ''}`.trim();
      const parsed = parseNaturalLanguageHisab(combinedText);

      let newCategory = originalCategory;
      const detectedCat = detectCategoryFromText(combinedText);

      if (detectedCat !== 'Others') {
        newCategory = detectedCat;
      } else if (parsed && parsed.category && (originalCategory === 'Others' || !originalCategory)) {
        newCategory = parsed.category;
      }

      const newTitle = cleanHisabTitle(originalTitle, newCategory as string, tx.type);

      if (newTitle !== originalTitle || newCategory !== originalCategory) {
        tx.title = newTitle;
        tx.category = newCategory;
        saveToCloud('transactions', tx.id, tx);
        count++;
      }
    });

    if (count > 0 && targetData === this.data) {
      this.save(targetData);
      this.notifyStoreUpdate();
    }
    return count;
  }

  save(data: StoreData = this.data): void {
    try {
      const key = this.getStorageKey();
      const storage = this.getStorage();
      const sanitized = this.sanitizeData(data);
      if (storage) {
        storage.setItem(key, JSON.stringify(sanitized));

        const isSecLocked = Boolean((sanitized.securityPinEnabled && sanitized.securityPinHash) || sanitized.fingerprintEnabled);
        if (isSecLocked) {
          storage.setItem('daily_hisab_security_locked', 'true');
        } else {
          storage.removeItem('daily_hisab_security_locked');
        }
      }
      this.data = sanitized;
    } catch (e) {
      console.error('Failed saving data to localStorage', e);
    }
  }

  getTheme(): ThemeName {
    return this.data.theme || 'dark';
  }

  setTheme(themeName: ThemeName): void {
    const validThemes: ThemeName[] = ['dark', 'light', 'oled', 'emerald'];
    if (!validThemes.includes(themeName)) themeName = 'dark';
    this.data.theme = themeName;
    this.save();
    if (typeof document !== 'undefined' && document.documentElement) {
      document.documentElement.setAttribute('data-theme', themeName);
    }
    this.notifyStoreUpdate();
  }

  getSecuritySettings(): SecuritySettings {
    return {
      enabled: Boolean(this.data.securityPinEnabled || this.data.fingerprintEnabled),
      hasPin: Boolean(this.data.securityPinHash),
      fingerprintEnabled: Boolean(this.data.fingerprintEnabled),
      notificationsEnabled: Boolean(this.data.notificationsEnabled)
    };
  }

  setFingerprintEnabled(enabled: boolean): void {
    this.data.fingerprintEnabled = Boolean(enabled);
    this.save();
    this.notifyStoreUpdate();
  }

  setSecurityPin(enabled: boolean, pinCode: string = ''): void {
    this.data.securityPinEnabled = Boolean(enabled);
    if (pinCode) {
      let hash = 0;
      for (let i = 0; i < pinCode.length; i++) {
        hash = ((hash << 5) - hash) + pinCode.charCodeAt(i);
        hash |= 0;
      }
      this.data.securityPinHash = String(hash);
    } else if (!enabled) {
      this.data.securityPinHash = '';
    }
    this.save();
  }

  verifyPin(pinCode: string): boolean {
    if (!this.data.securityPinEnabled || !this.data.securityPinHash) return true;
    let hash = 0;
    for (let i = 0; i < pinCode.length; i++) {
      hash = ((hash << 5) - hash) + pinCode.charCodeAt(i);
      hash |= 0;
    }
    return String(hash) === this.data.securityPinHash;
  }

  setNotificationsEnabled(enabled: boolean): void {
    this.data.notificationsEnabled = Boolean(enabled);
    this.save();
  }

  async resetToSampleData(): Promise<void> {
    this.clearCloudSubscriptions();

    try {
      const deletePromises: Promise<any>[] = [];
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

    const freshData = this.sanitizeData(JSON.parse(JSON.stringify(sampleData)));
    this.data = freshData;
    this.save(freshData);
    this.initCloudSubscriptions();
    this.notifyStoreUpdate();
  }

  getTransactions(monthYearFilter: string | null = null): Transaction[] {
    if (!Array.isArray(this.data.transactions)) return [];
    this.rephraseAllEntries();
    if (!monthYearFilter) return this.data.transactions;
    return this.data.transactions.filter(tx => tx.date && tx.date.startsWith(monthYearFilter));
  }

  getRecentTransactions(limit: number = 7): Transaction[] {
    if (!Array.isArray(this.data.transactions)) return [];
    this.rephraseAllEntries();
    return [...this.data.transactions].slice(0, limit);
  }

  addTransaction(tx: Partial<Transaction>): Transaction {
    let category = tx.category || 'Others';
    const textForCat = `${tx.title || ''} ${tx.notes || ''}`.trim();
    const detected = detectCategoryFromText(textForCat);
    if (detected !== 'Others' && (category === 'Others' || !tx.category)) {
      category = detected;
    }

    let title = tx.title || 'Untitled Entry';
    if (tx.title) {
      title = cleanHisabTitle(tx.title, category as string, tx.type || 'expense');
    }

    const newTx: Transaction = {
      id: tx.id || ('tx-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4)),
      date: tx.date || new Date().toISOString().split('T')[0],
      title: title,
      amount: parseFloat(String(tx.amount)) || 0,
      category: category,
      type: tx.type || 'expense',
      paymentMethod: tx.paymentMethod || 'UPI',
      notes: tx.notes || ''
    };
    this.data.transactions.unshift(newTx);
    saveToCloud('transactions', newTx.id, newTx);

    const monthYear = newTx.date.substring(0, 7);

    if (newTx.type === 'income' || newTx.category === 'Income' || /salary/i.test(newTx.title)) {
      if (!Array.isArray(this.data.salary)) this.data.salary = [];
      const existingIndex = this.data.salary.findIndex(s => s.monthYear === monthYear);
      if (existingIndex >= 0) {
        this.data.salary[existingIndex].grossAmount += newTx.amount;
        this.data.salary[existingIndex].netAmount += newTx.amount;
        saveToCloud('salary', this.data.salary[existingIndex].id, this.data.salary[existingIndex]);
      } else {
        const salObj: SalaryRecord = {
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

    if (!tx.isInternalSync && (newTx.type === 'emi' || newTx.category === 'EMI' || /loan|emi/i.test(newTx.title))) {
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

    if (!tx.isInternalSync && (newTx.type === 'investment' || newTx.category === 'Investment' || /sip|invest|stocks|mutual fund/i.test(newTx.title))) {
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
    if (!tx.isInternalSync) {
      triggerToast(`✨ Entry Done: ${newTx.title} (₹${newTx.amount.toLocaleString('en-IN')}) • ${newTx.category}`);
    }
    return newTx;
  }

  deleteTransaction(id: string): void {
    this.data.transactions = this.data.transactions.filter(tx => tx.id !== id);
    deleteFromCloud('transactions', id);
    this.save();
    triggerToast(`🗑️ Entry Deleted Successfully`, 'warning');
    this.notifyStoreUpdate();
  }

  editTransaction(id: string, updatedTx: Partial<Transaction>): Transaction | null {
    const index = this.data.transactions.findIndex(t => t.id === id);
    if (index === -1) return null;

    const tx = this.data.transactions[index];
    tx.title = updatedTx.title !== undefined ? updatedTx.title : tx.title;
    tx.amount = updatedTx.amount !== undefined ? (parseFloat(String(updatedTx.amount)) || 0) : tx.amount;
    tx.category = updatedTx.category !== undefined ? updatedTx.category : tx.category;
    tx.type = updatedTx.type !== undefined ? updatedTx.type : tx.type;
    tx.paymentMethod = updatedTx.paymentMethod !== undefined ? updatedTx.paymentMethod : tx.paymentMethod;
    tx.date = updatedTx.date !== undefined ? updatedTx.date : tx.date;
    tx.notes = updatedTx.notes !== undefined ? updatedTx.notes : tx.notes;

    saveToCloud('transactions', tx.id, tx);
    this.save();
    this.notifyStoreUpdate();
    return tx;
  }

  getLoans(): Loan[] {
    return this.data.loans;
  }

  addLoan(loan: Partial<Loan>): Loan {
    const newLoan: Loan = {
      id: loan.id || ('loan-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4)),
      name: loan.name || 'Loan',
      lender: loan.lender || '',
      totalPrincipal: parseFloat(String(loan.totalPrincipal)) || 0,
      remainingAmount: parseFloat(String(loan.remainingAmount)) || parseFloat(String(loan.totalPrincipal)) || 0,
      monthlyEmi: parseFloat(String(loan.monthlyEmi)) || 0,
      interestRate: parseFloat(String(loan.interestRate)) || 0,
      emiDay: parseInt(String(loan.emiDay)) || 5,
      status: 'Active'
    };
    this.data.loans.push(newLoan);
    saveToCloud('loans', newLoan.id, newLoan);
    this.save();
    triggerToast(`✨ Loan Saved: ${newLoan.name} (EMI ₹${newLoan.monthlyEmi.toLocaleString('en-IN')})`);
    return newLoan;
  }

  deleteLoan(id: string): void {
    this.data.loans = this.data.loans.filter(l => l.id !== id);
    deleteFromCloud('loans', id);
    this.save();
    triggerToast(`🗑️ Loan Deleted Successfully`, 'warning');
    this.notifyStoreUpdate();
  }

  editLoan(id: string, updatedLoan: Partial<Loan>): Loan | null {
    const loan = this.data.loans.find(l => l.id === id);
    if (!loan) return null;

    loan.name = updatedLoan.name !== undefined ? updatedLoan.name : loan.name;
    loan.lender = updatedLoan.lender !== undefined ? updatedLoan.lender : loan.lender;
    loan.totalPrincipal = updatedLoan.totalPrincipal !== undefined ? (parseFloat(String(updatedLoan.totalPrincipal)) || 0) : loan.totalPrincipal;
    loan.remainingAmount = updatedLoan.remainingAmount !== undefined ? (parseFloat(String(updatedLoan.remainingAmount)) || 0) : loan.remainingAmount;
    loan.monthlyEmi = updatedLoan.monthlyEmi !== undefined ? (parseFloat(String(updatedLoan.monthlyEmi)) || 0) : loan.monthlyEmi;
    loan.interestRate = updatedLoan.interestRate !== undefined ? (parseFloat(String(updatedLoan.interestRate)) || 0) : loan.interestRate;
    loan.emiDay = updatedLoan.emiDay !== undefined ? (parseInt(String(updatedLoan.emiDay)) || 5) : loan.emiDay;

    saveToCloud('loans', loan.id, loan);
    this.save();
    triggerToast(`✏️ Loan Updated: ${loan.name}`);
    this.notifyStoreUpdate();
    return loan;
  }

  payEmiForLoan(loanId: string, monthYear?: string): void {
    const loan = this.data.loans.find(l => l.id === loanId);
    if (!loan) return;

    loan.remainingAmount = Math.max(0, loan.remainingAmount - loan.monthlyEmi);
    if (loan.remainingAmount === 0) loan.status = 'Paid Off';
    saveToCloud('loans', loan.id, loan);

    const today = new Date();
    const emiDay = String(Math.min(31, Math.max(1, loan.emiDay || 5))).padStart(2, '0');
    const dateStr = monthYear ? `${monthYear}-${emiDay}` : today.toISOString().split('T')[0];

    this.addTransaction({
      date: dateStr,
      title: `${loan.name} Monthly EMI`,
      amount: loan.monthlyEmi,
      category: 'EMI',
      type: 'emi',
      paymentMethod: 'Auto-Debit',
      notes: `EMI Payment recorded for ${loan.lender}`,
      isInternalSync: true
    });
    triggerToast(`💳 EMI Paid: ₹${loan.monthlyEmi.toLocaleString('en-IN')} for ${loan.name}`);
  }

  getInvestments(): Investment[] {
    return this.data.investments;
  }

  addInvestment(inv: Partial<Investment>): Investment {
    const newInv: Investment = {
      id: inv.id || ('inv-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4)),
      name: inv.name || 'Investment',
      category: inv.category || 'Mutual Funds',
      type: inv.type || 'SIP',
      monthlySip: parseFloat(String(inv.monthlySip)) || 0,
      totalInvested: parseFloat(String(inv.totalInvested)) || 0,
      currentValue: parseFloat(String(inv.currentValue)) || parseFloat(String(inv.totalInvested)) || 0,
      platform: inv.platform || '',
      startDate: inv.startDate || new Date().toISOString().split('T')[0]
    };
    this.data.investments.push(newInv);
    saveToCloud('investments', newInv.id, newInv);
    this.save();
    triggerToast(`✨ Investment Saved: ${newInv.name} (${newInv.platform || 'SIP'})`);
    this.notifyStoreUpdate();
    return newInv;
  }

  editInvestment(id: string, updatedInv: Partial<Investment>): Investment | null {
    const inv = this.data.investments.find(i => i.id === id);
    if (!inv) return null;

    inv.name = updatedInv.name !== undefined ? updatedInv.name : inv.name;
    inv.category = updatedInv.category !== undefined ? updatedInv.category : inv.category;
    inv.type = updatedInv.type !== undefined ? updatedInv.type : inv.type;
    inv.monthlySip = updatedInv.monthlySip !== undefined ? (parseFloat(String(updatedInv.monthlySip)) || 0) : inv.monthlySip;
    inv.totalInvested = updatedInv.totalInvested !== undefined ? (parseFloat(String(updatedInv.totalInvested)) || 0) : inv.totalInvested;
    inv.currentValue = updatedInv.currentValue !== undefined ? (parseFloat(String(updatedInv.currentValue)) || 0) : inv.currentValue;
    inv.platform = updatedInv.platform !== undefined ? updatedInv.platform : inv.platform;

    saveToCloud('investments', inv.id, inv);
    this.save();
    triggerToast(`✏️ Investment Updated: ${inv.name}`);
    this.notifyStoreUpdate();
    return inv;
  }

  deleteInvestment(id: string): void {
    this.data.investments = this.data.investments.filter(i => i.id !== id);
    deleteFromCloud('investments', id);
    this.save();
    triggerToast(`🗑️ Investment Deleted`, 'warning');
    this.notifyStoreUpdate();
  }

  paySipForInvestment(invId: string, monthYear?: string): void {
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
      notes: `SIP Investment payment for ${inv.platform}`,
      isInternalSync: true
    });
    triggerToast(`📈 SIP Paid: ₹${inv.monthlySip.toLocaleString('en-IN')} for ${inv.name}`);
  }

  getSalary(): SalaryRecord[] {
    return this.data.salary;
  }

  getSalaryRecords(): SalaryRecord[] {
    return this.data.salary;
  }

  addOrUpdateSalary(record: Partial<SalaryRecord> & { monthYear?: string }): void {
    const id = record.id || 'sal-' + Date.now();
    const existingIndex = this.data.salary.findIndex(s => s.id === id);
    const monthYear = record.monthYear || new Date().toISOString().slice(0, 7);

    const salObj: SalaryRecord = {
      id,
      monthYear,
      company: record.company || 'Employer',
      grossAmount: parseFloat(String(record.grossAmount)) || 0,
      deductions: parseFloat(String(record.deductions)) || 0,
      netAmount: parseFloat(String(record.netAmount)) || (parseFloat(String(record.grossAmount || 0)) - parseFloat(String(record.deductions || 0))),
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
    triggerToast(`💰 Salary Recorded: ₹${salObj.netAmount.toLocaleString('en-IN')} for ${salObj.monthYear} (${salObj.company})`);
    this.notifyStoreUpdate();
  }

  deleteSalary(id: string): void {
    this.data.salary = this.data.salary.filter(s => s.id !== id && s.monthYear !== id);
    deleteFromCloud('salary', id);
    this.save();
    triggerToast(`🗑️ Salary Record Deleted`, 'warning');
    this.notifyStoreUpdate();
  }

  getDebts(): DebtRecord[] {
    return Array.isArray(this.data.debts) ? this.data.debts : [];
  }

  addDebt(debt: Partial<DebtRecord>): DebtRecord {
    if (!Array.isArray(this.data.debts)) this.data.debts = [];
    const amountVal = parseFloat(String(debt.amount)) || 0;
    const settledVal = parseFloat(String(debt.settledAmount)) || 0;
    const newDebt: DebtRecord = {
      id: debt.id || ('debt-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4)),
      personName: debt.personName || 'Someone',
      type: debt.type === 'borrowed' ? 'borrowed' : 'lent',
      amount: amountVal,
      settledAmount: settledVal,
      date: debt.date || new Date().toISOString().split('T')[0],
      dueDate: debt.dueDate || '',
      notes: debt.notes || '',
      status: settledVal >= amountVal && amountVal > 0 ? 'settled' : settledVal > 0 ? 'partially_paid' : 'pending'
    };
    this.data.debts.unshift(newDebt);
    saveToCloud('debts', newDebt.id, newDebt);
    this.save();

    // Auto-log initial money entry
    const isLent = newDebt.type === 'lent';
    this.addTransaction({
      date: newDebt.date,
      title: `${isLent ? 'Money Given to' : 'Money Borrowed from'} ${newDebt.personName}`,
      amount: newDebt.amount,
      category: isLent ? 'Others' : 'Income',
      type: isLent ? 'expense' : 'income',
      paymentMethod: 'UPI',
      notes: newDebt.notes || `Udhar: ${isLent ? 'Lent' : 'Borrowed'} ${newDebt.amount}`,
      isInternalSync: true
    });

    const label = isLent ? 'Given to' : 'Borrowed from';
    triggerToast(`🤝 Udhar Saved: ${label} ${newDebt.personName} (₹${newDebt.amount.toLocaleString('en-IN')})`);
    this.notifyStoreUpdate();
    return newDebt;
  }

  editDebt(id: string, updatedDebt: Partial<DebtRecord>): DebtRecord | null {
    if (!Array.isArray(this.data.debts)) return null;
    const debt = this.data.debts.find(d => d.id === id);
    if (!debt) return null;

    debt.personName = updatedDebt.personName !== undefined ? updatedDebt.personName : debt.personName;
    debt.type = updatedDebt.type !== undefined ? updatedDebt.type : debt.type;
    debt.amount = updatedDebt.amount !== undefined ? (parseFloat(String(updatedDebt.amount)) || 0) : debt.amount;
    debt.settledAmount = updatedDebt.settledAmount !== undefined ? (parseFloat(String(updatedDebt.settledAmount)) || 0) : debt.settledAmount;
    debt.date = updatedDebt.date !== undefined ? updatedDebt.date : debt.date;
    debt.dueDate = updatedDebt.dueDate !== undefined ? updatedDebt.dueDate : debt.dueDate;
    debt.notes = updatedDebt.notes !== undefined ? updatedDebt.notes : debt.notes;
    debt.status = debt.settledAmount >= debt.amount && debt.amount > 0 ? 'settled' : debt.settledAmount > 0 ? 'partially_paid' : 'pending';

    saveToCloud('debts', debt.id, debt);
    this.save();
    triggerToast(`✏️ Udhar Updated: ${debt.personName} (₹${debt.amount.toLocaleString('en-IN')})`);
    this.notifyStoreUpdate();
    return debt;
  }

  deleteDebt(id: string): void {
    if (!Array.isArray(this.data.debts)) return;
    this.data.debts = this.data.debts.filter(d => d.id !== id);
    deleteFromCloud('debts', id);
    this.save();
    triggerToast(`🗑️ Udhar Record Deleted`, 'warning');
    this.notifyStoreUpdate();
  }

  settleDebtPartial(id: string, paymentAmount: number, paymentMethod: string = 'UPI'): void {
    if (!Array.isArray(this.data.debts)) return;
    const debt = this.data.debts.find(d => d.id === id);
    if (!debt) return;

    const pAmt = parseFloat(String(paymentAmount)) || 0;
    if (pAmt <= 0) return;

    debt.settledAmount = Math.min(debt.amount, debt.settledAmount + pAmt);
    debt.status = debt.settledAmount >= debt.amount ? 'settled' : 'partially_paid';

    saveToCloud('debts', debt.id, debt);

    const isLent = debt.type === 'lent';
    this.addTransaction({
      date: new Date().toISOString().split('T')[0],
      title: `${isLent ? 'Udhar Returned by' : 'Udhar Settled to'} ${debt.personName}`,
      amount: pAmt,
      category: isLent ? 'Income' : 'Others',
      type: isLent ? 'income' : 'expense',
      paymentMethod: paymentMethod || 'UPI',
      notes: `Partial/Full settlement of Udhar (${debt.type})`,
      isInternalSync: true
    });

    this.save();
    triggerToast(`🤝 Udhar Settled: ₹${pAmt.toLocaleString('en-IN')} ${isLent ? 'received from' : 'paid to'} ${debt.personName}`);
    this.notifyStoreUpdate();
  }

  getBudgets(): CategoryBudgets {
    return this.data.budgets || {};
  }

  setBudget(category: string, amount: number | string): void {
    if (!this.data.budgets) this.data.budgets = {};
    const val = parseFloat(String(amount)) || 0;
    this.data.budgets[category] = val;
    saveToCloud('settings', 'budgets', { categories: this.data.budgets });
    this.save();
    triggerToast(`🎯 Budget Set: ${category} limit updated to ₹${val.toLocaleString('en-IN')}`);
  }

  getKnownMonthYears(): string[] {
    const months = new Set<string>();

    if (Array.isArray(this.data.transactions)) {
      this.data.transactions.forEach(tx => {
        if (tx.date && /^\d{4}-\d{2}/.test(tx.date)) {
          months.add(tx.date.substring(0, 7));
        }
      });
    }

    if (Array.isArray(this.data.salary)) {
      this.data.salary.forEach(sal => {
        if (sal.monthYear && /^\d{4}-\d{2}$/.test(sal.monthYear)) {
          months.add(sal.monthYear);
        }
      });
    }

    return Array.from(months).sort();
  }

  calculateMonthTotals(monthYear: string) {
    const txs = this.getTransactions(monthYear);

    let transactionIncome = 0;
    let totalExpenses = 0;
    let totalInvestments = 0;
    let totalEmisPaid = 0;

    txs.forEach(tx => {
      const amount = parseFloat(String(tx.amount)) || 0;
      if (tx.type === 'income' || tx.category === 'Income' || /salary/i.test(tx.title)) {
        transactionIncome += amount;
      } else if (tx.type === 'investment' || tx.category === 'Investment') {
        totalInvestments += amount;
      } else if (tx.type === 'emi' || tx.category === 'EMI') {
        totalEmisPaid += amount;
      } else {
        totalExpenses += amount;
      }
    });

    const salaryRec = Array.isArray(this.data.salary) ? this.data.salary.find(s => s.monthYear === monthYear) : null;
    const salaryNetAmount = salaryRec ? (parseFloat(String(salaryRec.netAmount)) || 0) : 0;
    const totalIncome = Math.max(transactionIncome, salaryNetAmount);

    const netOutflow = totalExpenses + totalInvestments + totalEmisPaid;
    const monthlyRemainingBalance = totalIncome - netOutflow;

    return {
      totalIncome,
      totalExpenses,
      totalInvestments,
      totalEmisPaid,
      netOutflow,
      monthlyRemainingBalance
    };
  }

  getMonthlyMetrics(monthYear: string): MonthlyMetrics {
    const currentTotals = this.calculateMonthTotals(monthYear);
    const openingBalance = this.getKnownMonthYears()
      .filter(month => month < monthYear)
      .reduce((sum, month) => sum + this.calculateMonthTotals(month).monthlyRemainingBalance, 0);

    const availableBalance = openingBalance + currentTotals.totalIncome;
    const remainingBalance = availableBalance - currentTotals.netOutflow;

    return {
      ...currentTotals,
      openingBalance,
      availableBalance,
      monthlyRemainingBalance: currentTotals.monthlyRemainingBalance,
      remainingBalance,
      netSavings: remainingBalance
    };
  }

  exportJSON(): void {
    const str = JSON.stringify(this.data, null, 2);
    const blob = new Blob([str], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hisabkit_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  importJSON(jsonString: string): boolean {
    try {
      const parsed = JSON.parse(jsonString);
      if (parsed && parsed.transactions && parsed.loans) {
        this.save(parsed);
        if (typeof window !== 'undefined') window.location.reload();
        return true;
      }
    } catch (e) {
      alert('Invalid JSON backup file format');
    }
    return false;
  }
}

export const store = new Store();
