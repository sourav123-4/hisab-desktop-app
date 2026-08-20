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
  RecurringRule,
  CreditCard,
  SavingsGoal,
  FinanceInsight,
  BillCalendarEvent,
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

function parsePositiveNumber(value: any, fallback: number = 0): number {
  const parsed = parseFloat(String(value ?? ''));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseNonNegativeNumber(value: any, fallback: number = 0): number {
  const parsed = parseFloat(String(value ?? ''));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

const sampleData: StoreData = {
  schemaVersion: 2,
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
  recurringRules: [],
  creditCards: [],
  savingsGoals: [],
  budgets: {
    'Food': 0,
    'Bills': 0,
    'Transport': 0,
    'Shopping': 0,
    'Entertainment': 0,
    'Health': 0
  }
};

const SECURITY_CACHE_KEY = 'daily_hisab_security_settings';
const SECURITY_LOCKED_KEY = 'daily_hisab_security_locked';

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

      if (Array.isArray(guestData.recurringRules) && guestData.recurringRules.length > 0) {
        const existingIds = new Set((userData.recurringRules || []).map((r: RecurringRule) => r.id));
        guestData.recurringRules.forEach((r: RecurringRule) => {
          if (!existingIds.has(r.id)) {
            userData.recurringRules.push(r);
            hasNewItems = true;
          }
        });
      }

      if (Array.isArray(guestData.creditCards) && guestData.creditCards.length > 0) {
        const existingIds = new Set((userData.creditCards || []).map((c: CreditCard) => c.id));
        guestData.creditCards.forEach((c: CreditCard) => {
          if (!existingIds.has(c.id)) {
            userData.creditCards.push(c);
            hasNewItems = true;
          }
        });
      }

      if (Array.isArray(guestData.savingsGoals) && guestData.savingsGoals.length > 0) {
        const existingIds = new Set((userData.savingsGoals || []).map((g: SavingsGoal) => g.id));
        guestData.savingsGoals.forEach((g: SavingsGoal) => {
          if (!existingIds.has(g.id)) {
            userData.savingsGoals.push(g);
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

    const unsubRecurring = subscribeToCloudCollection('recurringRules', (cloudRules: RecurringRule[]) => {
      if (Array.isArray(cloudRules)) {
        const prevJson = JSON.stringify(this.data.recurringRules);
        const mergedMap = new Map<string, RecurringRule>();
        (this.data.recurringRules || []).forEach(r => mergedMap.set(r.id, r));
        cloudRules.forEach(r => mergedMap.set(r.id, r));
        const newRules = Array.from(mergedMap.values());
        if (JSON.stringify(newRules) !== prevJson) {
          this.data.recurringRules = newRules;
          this.save(this.data);
          this.notifyStoreUpdate();
        }
      }
    });

    const unsubCards = subscribeToCloudCollection('creditCards', (cloudCards: CreditCard[]) => {
      if (Array.isArray(cloudCards)) {
        const prevJson = JSON.stringify(this.data.creditCards);
        const mergedMap = new Map<string, CreditCard>();
        (this.data.creditCards || []).forEach(c => mergedMap.set(c.id, c));
        cloudCards.forEach(c => mergedMap.set(c.id, c));
        const newCards = Array.from(mergedMap.values());
        if (JSON.stringify(newCards) !== prevJson) {
          this.data.creditCards = newCards;
          this.save(this.data);
          this.notifyStoreUpdate();
        }
      }
    });

    const unsubGoals = subscribeToCloudCollection('savingsGoals', (cloudGoals: SavingsGoal[]) => {
      if (Array.isArray(cloudGoals)) {
        const prevJson = JSON.stringify(this.data.savingsGoals);
        const mergedMap = new Map<string, SavingsGoal>();
        (this.data.savingsGoals || []).forEach(g => mergedMap.set(g.id, g));
        cloudGoals.forEach(g => mergedMap.set(g.id, g));
        const newGoals = Array.from(mergedMap.values());
        if (JSON.stringify(newGoals) !== prevJson) {
          this.data.savingsGoals = newGoals;
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

    this.activeUnsubscribers.push(unsubTx, unsubSal, unsubLoan, unsubInv, unsubDebts, unsubRecurring, unsubCards, unsubGoals, unsubSet);
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
      recurringRules: Array.isArray(parsed.recurringRules) ? parsed.recurringRules : [],
      creditCards: Array.isArray(parsed.creditCards) ? parsed.creditCards : [],
      savingsGoals: Array.isArray(parsed.savingsGoals) ? parsed.savingsGoals : [],
      budgets: typeof parsed.budgets === 'object' && parsed.budgets !== null ? parsed.budgets : {
        'Food': 0,
        'Bills': 0,
        'Transport': 0,
        'Shopping': 0,
        'Entertainment': 0,
        'Health': 0
      },
      schemaVersion: 2
    };
  }

  getStoredSecurityFallback(): Partial<StoreData> | null {
    try {
      const storage = this.getStorage();
      if (!storage) return null;

      const cachedRaw = storage.getItem(SECURITY_CACHE_KEY);
      if (cachedRaw) {
        const cached = JSON.parse(cachedRaw);
        const hasSecurity = Boolean((cached.securityPinEnabled && cached.securityPinHash) || cached.fingerprintEnabled);
        if (hasSecurity) {
          return {
            securityPinEnabled: Boolean(cached.securityPinEnabled),
            securityPinHash: cached.securityPinHash || '',
            fingerprintEnabled: Boolean(cached.fingerprintEnabled)
          };
        }
      }

      for (let i = 0; i < storage.length; i++) {
        const k = storage.key(i);
        if (!k || !k.startsWith('daily_hisab_app_data')) continue;

        try {
          const raw = storage.getItem(k);
          if (!raw) continue;

          const parsed = JSON.parse(raw);
          const hasSecurity = Boolean((parsed.securityPinEnabled && parsed.securityPinHash) || parsed.fingerprintEnabled);
          if (hasSecurity) {
            return {
              securityPinEnabled: Boolean(parsed.securityPinEnabled),
              securityPinHash: parsed.securityPinHash || '',
              fingerprintEnabled: Boolean(parsed.fingerprintEnabled)
            };
          }
        } catch (err) {}
      }
    } catch (e) {}

    return null;
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

      const hasLoadedSecurity = Boolean((data.securityPinEnabled && data.securityPinHash) || data.fingerprintEnabled);
      if (!hasLoadedSecurity) {
        const fallbackSecurity = this.getStoredSecurityFallback();
        if (fallbackSecurity) {
          data.securityPinEnabled = Boolean(fallbackSecurity.securityPinEnabled);
          data.securityPinHash = fallbackSecurity.securityPinHash || '';
          data.fingerprintEnabled = Boolean(fallbackSecurity.fingerprintEnabled);
        }
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
                  if (Array.isArray(legacyParsed.recurringRules) && legacyParsed.recurringRules.length > 0) data.recurringRules = legacyParsed.recurringRules;
                  if (Array.isArray(legacyParsed.creditCards) && legacyParsed.creditCards.length > 0) data.creditCards = legacyParsed.creditCards;
                  if (Array.isArray(legacyParsed.savingsGoals) && legacyParsed.savingsGoals.length > 0) data.savingsGoals = legacyParsed.savingsGoals;
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
          storage.setItem(SECURITY_LOCKED_KEY, 'true');
          storage.setItem(SECURITY_CACHE_KEY, JSON.stringify({
            securityPinEnabled: Boolean(sanitized.securityPinEnabled),
            securityPinHash: sanitized.securityPinHash || '',
            fingerprintEnabled: Boolean(sanitized.fingerprintEnabled)
          }));
        } else {
          storage.removeItem(SECURITY_LOCKED_KEY);
          storage.removeItem(SECURITY_CACHE_KEY);
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
      pinEnabled: Boolean(this.data.securityPinEnabled),
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
    return String(hash) === String(this.data.securityPinHash);
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
      if (Array.isArray(this.data.recurringRules)) {
        this.data.recurringRules.forEach(rule => deletePromises.push(deleteFromCloud('recurringRules', rule.id)));
      }
      if (Array.isArray(this.data.creditCards)) {
        this.data.creditCards.forEach(card => deletePromises.push(deleteFromCloud('creditCards', card.id)));
      }
      if (Array.isArray(this.data.savingsGoals)) {
        this.data.savingsGoals.forEach(goal => deletePromises.push(deleteFromCloud('savingsGoals', goal.id)));
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
      amount: parsePositiveNumber(tx.amount),
      category: category,
      type: tx.type || 'expense',
      paymentMethod: tx.paymentMethod || 'UPI',
      notes: tx.notes || '',
      tags: Array.isArray(tx.tags) ? tx.tags.filter(Boolean).map(String) : [],
      linkedCreditCardId: tx.linkedCreditCardId || '',
      recurringRuleId: tx.recurringRuleId || '',
      splitWith: Array.isArray(tx.splitWith) ? tx.splitWith.filter(Boolean).map(String) : []
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

    if (!tx.isInternalSync && newTx.paymentMethod === 'Credit Card' && newTx.linkedCreditCardId) {
      const card = this.getCreditCards().find(c => c.id === newTx.linkedCreditCardId);
      if (card && newTx.type === 'expense') {
        card.currentOutstanding += newTx.amount;
        saveToCloud('creditCards', card.id, card);
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
    tx.tags = updatedTx.tags !== undefined ? (Array.isArray(updatedTx.tags) ? updatedTx.tags.filter(Boolean).map(String) : []) : (tx.tags || []);
    tx.linkedCreditCardId = updatedTx.linkedCreditCardId !== undefined ? updatedTx.linkedCreditCardId : (tx.linkedCreditCardId || '');
    tx.recurringRuleId = updatedTx.recurringRuleId !== undefined ? updatedTx.recurringRuleId : (tx.recurringRuleId || '');
    tx.splitWith = updatedTx.splitWith !== undefined ? (Array.isArray(updatedTx.splitWith) ? updatedTx.splitWith.filter(Boolean).map(String) : []) : (tx.splitWith || []);

    saveToCloud('transactions', tx.id, tx);
    this.save();
    this.notifyStoreUpdate();
    return tx;
  }

  getLoans(): Loan[] {
    return this.data.loans;
  }

  addLoan(loan: Partial<Loan>): Loan {
    const totalPrincipal = parsePositiveNumber(loan.totalPrincipal);
    const remainingAmount = parseNonNegativeNumber(loan.remainingAmount, totalPrincipal);
    const newLoan: Loan = {
      id: loan.id || ('loan-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4)),
      name: loan.name || 'Loan',
      lender: loan.lender || '',
      totalPrincipal,
      remainingAmount,
      monthlyEmi: parsePositiveNumber(loan.monthlyEmi),
      interestRate: parseNonNegativeNumber(loan.interestRate),
      emiDay: clampNumber(parseInt(String(loan.emiDay), 10) || 5, 1, 31),
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
    loan.totalPrincipal = updatedLoan.totalPrincipal !== undefined ? parsePositiveNumber(updatedLoan.totalPrincipal) : loan.totalPrincipal;
    loan.remainingAmount = updatedLoan.remainingAmount !== undefined ? parseNonNegativeNumber(updatedLoan.remainingAmount) : loan.remainingAmount;
    loan.monthlyEmi = updatedLoan.monthlyEmi !== undefined ? parsePositiveNumber(updatedLoan.monthlyEmi) : loan.monthlyEmi;
    loan.interestRate = updatedLoan.interestRate !== undefined ? parseNonNegativeNumber(updatedLoan.interestRate) : loan.interestRate;
    loan.emiDay = updatedLoan.emiDay !== undefined ? clampNumber(parseInt(String(updatedLoan.emiDay), 10) || 5, 1, 31) : loan.emiDay;

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
    const totalInvested = parseNonNegativeNumber(inv.totalInvested);
    const newInv: Investment = {
      id: inv.id || ('inv-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4)),
      name: inv.name || 'Investment',
      category: inv.category || 'Mutual Funds',
      type: inv.type || 'SIP',
      monthlySip: parseNonNegativeNumber(inv.monthlySip),
      totalInvested,
      currentValue: parseNonNegativeNumber(inv.currentValue, totalInvested),
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
    inv.monthlySip = updatedInv.monthlySip !== undefined ? parseNonNegativeNumber(updatedInv.monthlySip) : inv.monthlySip;
    inv.totalInvested = updatedInv.totalInvested !== undefined ? parseNonNegativeNumber(updatedInv.totalInvested) : inv.totalInvested;
    inv.currentValue = updatedInv.currentValue !== undefined ? parseNonNegativeNumber(updatedInv.currentValue) : inv.currentValue;
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
      grossAmount: parsePositiveNumber(record.grossAmount),
      deductions: parseNonNegativeNumber(record.deductions),
      netAmount: record.netAmount !== undefined
        ? parseNonNegativeNumber(record.netAmount)
        : Math.max(0, parsePositiveNumber(record.grossAmount) - parseNonNegativeNumber(record.deductions)),
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
    const amountVal = parsePositiveNumber(debt.amount);
    const settledVal = Math.min(amountVal, parseNonNegativeNumber(debt.settledAmount));
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
    debt.amount = updatedDebt.amount !== undefined ? parsePositiveNumber(updatedDebt.amount) : debt.amount;
    debt.settledAmount = updatedDebt.settledAmount !== undefined ? Math.min(debt.amount, parseNonNegativeNumber(updatedDebt.settledAmount)) : Math.min(debt.amount, debt.settledAmount);
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

  getRecurringRules(): RecurringRule[] {
    return Array.isArray(this.data.recurringRules) ? this.data.recurringRules : [];
  }

  addRecurringRule(rule: Partial<RecurringRule>): RecurringRule {
    if (!Array.isArray(this.data.recurringRules)) this.data.recurringRules = [];
    const newRule: RecurringRule = {
      id: rule.id || ('rec-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4)),
      title: rule.title || 'Recurring Transaction',
      amount: parsePositiveNumber(rule.amount),
      category: rule.category || 'Others',
      type: rule.type || 'expense',
      paymentMethod: rule.paymentMethod || 'Auto-Debit',
      frequency: rule.frequency || 'monthly',
      dayOfMonth: clampNumber(parseInt(String(rule.dayOfMonth), 10) || 1, 1, 31),
      startDate: rule.startDate || new Date().toISOString().split('T')[0],
      endDate: rule.endDate || '',
      notes: rule.notes || '',
      tags: Array.isArray(rule.tags) ? rule.tags.filter(Boolean).map(String) : [],
      active: rule.active !== undefined ? Boolean(rule.active) : true
    };
    this.data.recurringRules.push(newRule);
    saveToCloud('recurringRules', newRule.id, newRule);
    this.save();
    triggerToast(`🔁 Recurring Rule Saved: ${newRule.title}`);
    this.notifyStoreUpdate();
    return newRule;
  }

  editRecurringRule(id: string, updatedRule: Partial<RecurringRule>): RecurringRule | null {
    const rule = this.getRecurringRules().find(r => r.id === id);
    if (!rule) return null;
    rule.title = updatedRule.title !== undefined ? updatedRule.title : rule.title;
    rule.amount = updatedRule.amount !== undefined ? parsePositiveNumber(updatedRule.amount) : rule.amount;
    rule.category = updatedRule.category !== undefined ? updatedRule.category : rule.category;
    rule.type = updatedRule.type !== undefined ? updatedRule.type : rule.type;
    rule.paymentMethod = updatedRule.paymentMethod !== undefined ? updatedRule.paymentMethod : rule.paymentMethod;
    rule.frequency = updatedRule.frequency !== undefined ? updatedRule.frequency : rule.frequency;
    rule.dayOfMonth = updatedRule.dayOfMonth !== undefined ? clampNumber(parseInt(String(updatedRule.dayOfMonth), 10) || 1, 1, 31) : rule.dayOfMonth;
    rule.startDate = updatedRule.startDate !== undefined ? updatedRule.startDate : rule.startDate;
    rule.endDate = updatedRule.endDate !== undefined ? updatedRule.endDate : rule.endDate;
    rule.notes = updatedRule.notes !== undefined ? updatedRule.notes : rule.notes;
    rule.tags = updatedRule.tags !== undefined ? (Array.isArray(updatedRule.tags) ? updatedRule.tags.filter(Boolean).map(String) : []) : (rule.tags || []);
    rule.active = updatedRule.active !== undefined ? Boolean(updatedRule.active) : rule.active;
    saveToCloud('recurringRules', rule.id, rule);
    this.save();
    this.notifyStoreUpdate();
    return rule;
  }

  deleteRecurringRule(id: string): void {
    this.data.recurringRules = this.getRecurringRules().filter(r => r.id !== id);
    deleteFromCloud('recurringRules', id);
    this.save();
    triggerToast('🔁 Recurring rule deleted', 'warning');
    this.notifyStoreUpdate();
  }

  generateDueRecurringTransactions(monthYear: string): number {
    const rules = this.getRecurringRules().filter(r => r.active);
    const [year, month] = monthYear.split('-').map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();
    let created = 0;
    rules.forEach(rule => {
      if (rule.frequency !== 'monthly') return;
      const date = `${monthYear}-${String(clampNumber(rule.dayOfMonth || 1, 1, daysInMonth)).padStart(2, '0')}`;
      if (rule.startDate && date < rule.startDate) return;
      if (rule.endDate && date > rule.endDate) return;
      const exists = this.data.transactions.some(tx => tx.recurringRuleId === rule.id && tx.date && tx.date.startsWith(monthYear));
      if (exists) return;
      this.addTransaction({
        title: rule.title,
        amount: rule.amount,
        category: rule.category,
        type: rule.type,
        paymentMethod: rule.paymentMethod,
        date,
        notes: rule.notes || `Auto-created from recurring rule`,
        tags: rule.tags || [],
        recurringRuleId: rule.id,
        isInternalSync: true
      });
      created++;
    });
    if (created > 0) {
      triggerToast(`🔁 Created ${created} recurring ${created === 1 ? 'entry' : 'entries'} for ${monthYear}`);
      this.notifyStoreUpdate();
    }
    return created;
  }

  getCreditCards(): CreditCard[] {
    return Array.isArray(this.data.creditCards) ? this.data.creditCards : [];
  }

  addCreditCard(card: Partial<CreditCard>): CreditCard {
    if (!Array.isArray(this.data.creditCards)) this.data.creditCards = [];
    const newCard: CreditCard = {
      id: card.id || ('card-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4)),
      name: card.name || 'Credit Card',
      bank: card.bank || '',
      limit: parsePositiveNumber(card.limit),
      statementDay: clampNumber(parseInt(String(card.statementDay), 10) || 1, 1, 31),
      dueDay: clampNumber(parseInt(String(card.dueDay), 10) || 1, 1, 31),
      currentOutstanding: parseNonNegativeNumber(card.currentOutstanding),
      notes: card.notes || ''
    };
    this.data.creditCards.push(newCard);
    saveToCloud('creditCards', newCard.id, newCard);
    this.save();
    triggerToast(`💳 Card Saved: ${newCard.name}`);
    this.notifyStoreUpdate();
    return newCard;
  }

  editCreditCard(id: string, updatedCard: Partial<CreditCard>): CreditCard | null {
    const card = this.getCreditCards().find(c => c.id === id);
    if (!card) return null;
    card.name = updatedCard.name !== undefined ? updatedCard.name : card.name;
    card.bank = updatedCard.bank !== undefined ? updatedCard.bank : card.bank;
    card.limit = updatedCard.limit !== undefined ? parsePositiveNumber(updatedCard.limit) : card.limit;
    card.statementDay = updatedCard.statementDay !== undefined ? clampNumber(parseInt(String(updatedCard.statementDay), 10) || 1, 1, 31) : card.statementDay;
    card.dueDay = updatedCard.dueDay !== undefined ? clampNumber(parseInt(String(updatedCard.dueDay), 10) || 1, 1, 31) : card.dueDay;
    card.currentOutstanding = updatedCard.currentOutstanding !== undefined ? parseNonNegativeNumber(updatedCard.currentOutstanding) : card.currentOutstanding;
    card.notes = updatedCard.notes !== undefined ? updatedCard.notes : card.notes;
    saveToCloud('creditCards', card.id, card);
    this.save();
    this.notifyStoreUpdate();
    return card;
  }

  deleteCreditCard(id: string): void {
    this.data.creditCards = this.getCreditCards().filter(c => c.id !== id);
    deleteFromCloud('creditCards', id);
    this.save();
    triggerToast('💳 Credit card deleted', 'warning');
    this.notifyStoreUpdate();
  }

  getCreditCardSpend(cardId: string, monthYear: string | null = null): number {
    return this.getTransactions(monthYear).filter(tx =>
      tx.paymentMethod === 'Credit Card' && (!cardId || tx.linkedCreditCardId === cardId)
    ).reduce((sum, tx) => sum + (parseFloat(String(tx.amount)) || 0), 0);
  }

  recordCreditCardPayment(cardId: string, amount: number, date: string = new Date().toISOString().split('T')[0]): void {
    const card = this.getCreditCards().find(c => c.id === cardId);
    if (!card) return;
    const payAmount = parsePositiveNumber(amount);
    card.currentOutstanding = Math.max(0, card.currentOutstanding - payAmount);
    saveToCloud('creditCards', card.id, card);
    this.addTransaction({
      date,
      title: `${card.name} Card Bill Payment`,
      amount: payAmount,
      category: 'Bills',
      type: 'expense',
      paymentMethod: 'NetBanking',
      notes: `Credit card payment for ${card.bank}`,
      isInternalSync: true
    });
    this.save();
    this.notifyStoreUpdate();
  }

  getSavingsGoals(): SavingsGoal[] {
    return Array.isArray(this.data.savingsGoals) ? this.data.savingsGoals : [];
  }

  addSavingsGoal(goal: Partial<SavingsGoal>): SavingsGoal {
    if (!Array.isArray(this.data.savingsGoals)) this.data.savingsGoals = [];
    const targetAmount = parsePositiveNumber(goal.targetAmount);
    const currentAmount = Math.min(targetAmount, parseNonNegativeNumber(goal.currentAmount));
    const newGoal: SavingsGoal = {
      id: goal.id || ('goal-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4)),
      name: goal.name || 'Savings Goal',
      targetAmount,
      currentAmount,
      targetDate: goal.targetDate || '',
      monthlyContribution: parseNonNegativeNumber(goal.monthlyContribution),
      notes: goal.notes || '',
      status: currentAmount >= targetAmount && targetAmount > 0 ? 'completed' : 'active'
    };
    this.data.savingsGoals.push(newGoal);
    saveToCloud('savingsGoals', newGoal.id, newGoal);
    this.save();
    triggerToast(`🎯 Goal Saved: ${newGoal.name}`);
    this.notifyStoreUpdate();
    return newGoal;
  }

  editSavingsGoal(id: string, updatedGoal: Partial<SavingsGoal>): SavingsGoal | null {
    const goal = this.getSavingsGoals().find(g => g.id === id);
    if (!goal) return null;
    goal.name = updatedGoal.name !== undefined ? updatedGoal.name : goal.name;
    goal.targetAmount = updatedGoal.targetAmount !== undefined ? parsePositiveNumber(updatedGoal.targetAmount) : goal.targetAmount;
    goal.currentAmount = updatedGoal.currentAmount !== undefined ? Math.min(goal.targetAmount, parseNonNegativeNumber(updatedGoal.currentAmount)) : Math.min(goal.targetAmount, goal.currentAmount);
    goal.targetDate = updatedGoal.targetDate !== undefined ? updatedGoal.targetDate : goal.targetDate;
    goal.monthlyContribution = updatedGoal.monthlyContribution !== undefined ? parseNonNegativeNumber(updatedGoal.monthlyContribution) : goal.monthlyContribution;
    goal.notes = updatedGoal.notes !== undefined ? updatedGoal.notes : goal.notes;
    goal.status = goal.currentAmount >= goal.targetAmount && goal.targetAmount > 0 ? 'completed' : 'active';
    saveToCloud('savingsGoals', goal.id, goal);
    this.save();
    this.notifyStoreUpdate();
    return goal;
  }

  contributeToSavingsGoal(id: string, amount: number, date: string = new Date().toISOString().split('T')[0]): void {
    const goal = this.getSavingsGoals().find(g => g.id === id);
    if (!goal) return;
    const contribution = parsePositiveNumber(amount);
    goal.currentAmount = Math.min(goal.targetAmount, goal.currentAmount + contribution);
    goal.status = goal.currentAmount >= goal.targetAmount ? 'completed' : 'active';
    saveToCloud('savingsGoals', goal.id, goal);
    this.addTransaction({
      date,
      title: `${goal.name} Savings Contribution`,
      amount: contribution,
      category: 'Investment',
      type: 'investment',
      paymentMethod: 'UPI',
      notes: `Savings goal contribution`,
      tags: ['goal', goal.name],
      isInternalSync: true
    });
    this.save();
    this.notifyStoreUpdate();
  }

  deleteSavingsGoal(id: string): void {
    this.data.savingsGoals = this.getSavingsGoals().filter(g => g.id !== id);
    deleteFromCloud('savingsGoals', id);
    this.save();
    triggerToast('🎯 Savings goal deleted', 'warning');
    this.notifyStoreUpdate();
  }

  findDuplicateTransactions(candidate: Partial<Transaction>, tolerance: number = 1): Transaction[] {
    const date = candidate.date || '';
    const amount = parseFloat(String(candidate.amount || 0));
    const title = String(candidate.title || '').toLowerCase().replace(/\s+/g, ' ').trim();
    if (!date || !amount) return [];
    return this.data.transactions.filter(tx => {
      const sameDate = tx.date === date;
      const sameAmount = Math.abs((parseFloat(String(tx.amount)) || 0) - amount) <= tolerance;
      const txTitle = String(tx.title || '').toLowerCase().replace(/\s+/g, ' ').trim();
      const similarTitle = title && txTitle && (txTitle.includes(title) || title.includes(txTitle));
      return sameDate && sameAmount && similarTitle;
    });
  }

  addSplitExpense(base: Partial<Transaction>, people: string[], paidBySelf: boolean = true): { transaction: Transaction; debts: DebtRecord[] } {
    const cleanPeople = people.map(p => p.trim()).filter(Boolean);
    const amount = parsePositiveNumber(base.amount);
    const transaction = this.addTransaction({
      ...base,
      amount,
      type: 'expense',
      splitWith: cleanPeople,
      notes: `${base.notes || ''} Split with: ${cleanPeople.join(', ')}`.trim()
    });
    const share = cleanPeople.length > 0 ? amount / (cleanPeople.length + (paidBySelf ? 1 : 0)) : 0;
    const debts: DebtRecord[] = [];
    if (share > 0 && paidBySelf) {
      cleanPeople.forEach(person => {
        debts.push(this.addDebt({
          personName: person,
          type: 'lent',
          amount: Math.round(share * 100) / 100,
          date: transaction.date,
          notes: `Split expense: ${transaction.title}`
        }));
      });
    }
    return { transaction, debts };
  }

  getBillCalendarEvents(monthYear: string): BillCalendarEvent[] {
    const events: BillCalendarEvent[] = [];
    const [year, month] = monthYear.split('-').map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();
    const clampDay = (day: number) => String(clampNumber(day || 1, 1, daysInMonth)).padStart(2, '0');
    this.getLoans().filter(l => l.status === 'Active' && l.monthlyEmi > 0).forEach(loan => {
      const date = `${monthYear}-${clampDay(loan.emiDay)}`;
      const paid = this.getTransactions(monthYear).some(tx => (tx.type === 'emi' || tx.category === 'EMI') && tx.title.toLowerCase().includes(loan.name.toLowerCase()));
      events.push({ id: `loan-${loan.id}`, date, title: `${loan.name} EMI`, amount: loan.monthlyEmi, type: 'emi', status: paid ? 'paid' : 'due' });
    });
    this.getInvestments().filter(i => i.monthlySip > 0).forEach(inv => {
      const date = `${monthYear}-10`;
      const paid = this.getTransactions(monthYear).some(tx => tx.type === 'investment' && tx.title.toLowerCase().includes(inv.name.toLowerCase()));
      events.push({ id: `sip-${inv.id}`, date, title: `${inv.name} SIP`, amount: inv.monthlySip, type: 'sip', status: paid ? 'paid' : 'due' });
    });
    this.getRecurringRules().filter(r => r.active).forEach(rule => {
      const date = `${monthYear}-${clampDay(rule.dayOfMonth)}`;
      events.push({ id: `rec-${rule.id}`, date, title: rule.title, amount: rule.amount, type: 'recurring', status: 'due' });
    });
    this.getCreditCards().forEach(card => {
      const monthSpend = this.getCreditCardSpend(card.id, monthYear);
      const amount = Math.max(card.currentOutstanding, monthSpend);
      if (amount > 0) {
        events.push({ id: `card-${card.id}`, date: `${monthYear}-${clampDay(card.dueDay)}`, title: `${card.name} Card Due`, amount, type: 'credit-card', status: 'due' });
      }
    });
    this.getSalaryRecords().filter(s => s.monthYear === monthYear).forEach(sal => {
      events.push({ id: `sal-${sal.id}`, date: sal.receivedDate || `${monthYear}-01`, title: `${sal.company} Salary`, amount: sal.netAmount, type: 'salary', status: sal.status === 'credited' ? 'paid' : 'pending' });
    });
    this.getDebts().filter(d => d.status !== 'settled' && d.dueDate && d.dueDate.startsWith(monthYear)).forEach(debt => {
      events.push({ id: `debt-${debt.id}`, date: debt.dueDate || `${monthYear}-01`, title: `${debt.personName} Udhar Due`, amount: debt.amount - debt.settledAmount, type: 'debt', status: 'due' });
    });
    return events.sort((a, b) => a.date.localeCompare(b.date));
  }

  getMonthlyInsights(monthYear: string): FinanceInsight[] {
    const insights: FinanceInsight[] = [];
    const metrics = this.getMonthlyMetrics(monthYear);
    const [year, month] = monthYear.split('-').map(Number);
    const prevDate = new Date(year, month - 2, 1);
    const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
    const prev = this.getMonthlyMetrics(prevMonth);
    const currency = this.data.currency || '₹';
    const savingsRate = metrics.totalIncome > 0 ? Math.round((metrics.monthlyRemainingBalance / metrics.totalIncome) * 100) : 0;

    if (metrics.totalIncome > 0) {
      insights.push({
        severity: savingsRate >= 20 ? 'good' : savingsRate >= 0 ? 'warning' : 'danger',
        title: `Savings rate: ${savingsRate}%`,
        detail: savingsRate >= 20 ? 'Strong savings pace this month.' : savingsRate >= 0 ? 'Savings are positive, but there is room to improve.' : 'Outflows are higher than income this month.'
      });
    }

    if (prev.totalExpenses > 0 && metrics.totalExpenses > prev.totalExpenses * 1.15) {
      const delta = Math.round(((metrics.totalExpenses - prev.totalExpenses) / prev.totalExpenses) * 100);
      insights.push({ severity: 'warning', title: `Expenses up ${delta}%`, detail: `This month's daily expenses are higher than ${prevMonth}.` });
    }

    const txs = this.getTransactions(monthYear).filter(t => t.type === 'expense');
    const byCat: Record<string, number> = {};
    txs.forEach(tx => { byCat[tx.category] = (byCat[tx.category] || 0) + tx.amount; });
    const topCat = Object.entries(byCat).sort((a, b) => b[1] - a[1])[0];
    if (topCat) {
      insights.push({ severity: 'info', title: `Top spend: ${topCat[0]}`, detail: `${currency}${Math.round(topCat[1]).toLocaleString('en-IN')} recorded in ${topCat[0]}.` });
    }

    Object.entries(this.getBudgets()).forEach(([cat, limit]) => {
      const spent = byCat[cat] || 0;
      if (limit > 0 && spent > limit) {
        insights.push({ severity: 'danger', title: `${cat} budget crossed`, detail: `${currency}${Math.round(spent - limit).toLocaleString('en-IN')} over the planned limit.` });
      } else if (limit > 0 && spent >= limit * 0.8) {
        insights.push({ severity: 'warning', title: `${cat} budget near limit`, detail: `${Math.round((spent / limit) * 100)}% used already.` });
      }
    });

    const cardRisk = this.getCreditCards().find(card => card.limit > 0 && (card.currentOutstanding + this.getCreditCardSpend(card.id, monthYear)) / card.limit >= 0.75);
    if (cardRisk) {
      insights.push({ severity: 'warning', title: `${cardRisk.name} usage is high`, detail: 'Outstanding plus this month card spends are above 75% of limit.' });
    }

    return insights.slice(0, 8);
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
