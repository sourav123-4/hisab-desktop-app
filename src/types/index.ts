export type TransactionType = 'expense' | 'income' | 'investment' | 'emi';
export type CategoryName = 'Food' | 'Bills' | 'Transport' | 'Shopping' | 'Entertainment' | 'Health' | 'F&O Trading' | 'Stocks' | 'EMI' | 'Investment' | 'Income' | 'Others';
export type PaymentMethod = 'UPI' | 'Cash' | 'Credit Card' | 'NetBanking' | 'Auto-Debit';
export type ThemeName = 'dark' | 'light' | 'oled' | 'emerald';
export type DebtType = 'lent' | 'borrowed';
export type RecurringFrequency = 'monthly' | 'weekly' | 'yearly';

export interface Transaction {
  id: string;
  date: string;
  title: string;
  amount: number;
  category: CategoryName | string;
  type: TransactionType;
  paymentMethod: PaymentMethod | string;
  notes?: string;
  tags?: string[];
  linkedCreditCardId?: string;
  recurringRuleId?: string;
  splitWith?: string[];
  isInternalSync?: boolean;
}

export interface RecurringRule {
  id: string;
  title: string;
  amount: number;
  category: CategoryName | string;
  type: TransactionType;
  paymentMethod: PaymentMethod | string;
  frequency: RecurringFrequency;
  dayOfMonth: number;
  startDate: string;
  endDate?: string;
  notes?: string;
  tags?: string[];
  active: boolean;
}

export interface CreditCard {
  id: string;
  name: string;
  bank: string;
  limit: number;
  statementDay: number;
  dueDay: number;
  currentOutstanding: number;
  notes?: string;
}

export interface SavingsGoal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  targetDate?: string;
  monthlyContribution: number;
  notes?: string;
  status: 'active' | 'completed';
}

export interface FinanceInsight {
  severity: 'good' | 'warning' | 'danger' | 'info';
  title: string;
  detail: string;
}

export interface BillCalendarEvent {
  id: string;
  date: string;
  title: string;
  amount: number;
  type: 'emi' | 'recurring' | 'credit-card' | 'salary' | 'debt' | 'sip';
  status: 'due' | 'paid' | 'pending';
}

export interface Loan {
  id: string;
  name: string;
  lender: string;
  totalPrincipal: number;
  remainingAmount: number;
  monthlyEmi: number;
  interestRate: number;
  emiDay: number;
  status: 'Active' | 'Paid Off';
}

export interface Investment {
  id: string;
  name: string;
  category: string;
  type: string;
  monthlySip: number;
  totalInvested: number;
  currentValue: number;
  platform: string;
  startDate: string;
}

export interface SalaryRecord {
  id: string;
  monthYear: string;
  company: string;
  grossAmount: number;
  deductions: number;
  netAmount: number;
  receivedDate: string;
  status: 'credited' | 'pending';
  notes?: string;
}

export interface DebtRecord {
  id: string;
  personName: string;
  type: DebtType; // lent = money given to others, borrowed = money taken from others
  amount: number;
  settledAmount: number;
  date: string;
  dueDate?: string;
  notes?: string;
  status: 'pending' | 'partially_paid' | 'settled';
}

export interface CategoryBudgets {
  [category: string]: number;
}

export interface MonthlyMetrics {
  totalIncome: number;
  totalExpenses: number;
  totalInvestments: number;
  totalEmisPaid: number;
  netOutflow: number;
  monthlyRemainingBalance: number;
  openingBalance: number;
  availableBalance: number;
  remainingBalance: number;
  netSavings: number;
}

export interface SecuritySettings {
  enabled: boolean;
  pinEnabled: boolean;
  hasPin: boolean;
  fingerprintEnabled: boolean;
  notificationsEnabled: boolean;
}

export interface StoreData {
  schemaVersion?: number;
  currency: string;
  theme: ThemeName;
  securityPinEnabled: boolean;
  securityPinHash: string;
  fingerprintEnabled: boolean;
  notificationsEnabled: boolean;
  salary: SalaryRecord[];
  transactions: Transaction[];
  loans: Loan[];
  investments: Investment[];
  debts: DebtRecord[];
  recurringRules: RecurringRule[];
  creditCards: CreditCard[];
  savingsGoals: SavingsGoal[];
  budgets: CategoryBudgets;
}

declare global {
  interface Window {
    onHisabStoreUpdate?: () => void;
    electronAPI?: {
      appVersion: string;
      platform: string;
      isElectron: boolean;
      getVoiceTranscriptionStatus: () => Promise<{ configured: boolean }>;
      saveVoiceTranscriptionKey: (apiKey: string) => Promise<{ success: boolean; message?: string }>;
      clearVoiceTranscriptionKey: () => Promise<{ success: boolean; message?: string }>;
      transcribeAudio: (arrayBuffer: ArrayBuffer, mimeType: string) => Promise<{ success: boolean; text?: string; error?: string; code?: string }>;
      openExternalUrl: (url: string) => Promise<boolean>;
      getAuthCallbackUrl: () => Promise<string>;
      startGoogleOAuth: (options: Record<string, any>) => Promise<boolean>;
      onGoogleAuthSuccess: (callback: (data: any) => void) => void;
      sendDesktopNotification: (payload: { title: string; body: string }) => Promise<boolean>;
      promptTouchID: () => Promise<{ success: boolean; reason?: string }>;
      onOpenQuickAdd: (callback: () => void) => void;
      checkForUpdates: () => Promise<{ success: boolean; status: string; message?: string; updateInfo?: any }>;
      onUpdateStatus: (callback: (data: any) => void) => void;
    };
    SpeechRecognition?: any;
    webkitSpeechRecognition?: any;
    AudioContext?: any;
    webkitAudioContext?: any;
  }
}
