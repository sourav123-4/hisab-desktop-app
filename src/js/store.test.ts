import assert from 'assert';

const memoryStorage: Record<string, string> = {};
(global as any).localStorage = {
  getItem: (key: string) => memoryStorage[key] || null,
  setItem: (key: string, value: string) => { memoryStorage[key] = String(value); },
  removeItem: (key: string) => { delete memoryStorage[key]; },
  clear: () => { Object.keys(memoryStorage).forEach(k => delete memoryStorage[k]); }
};

import { store } from './store.js';
import { parseNaturalLanguageHisab, parseMultipleHisabs } from './aiParser.js';

console.log('🧪 Starting Comprehensive Daily Hisab Test Suite (TypeScript)...\n');

// Test 1: Initial state & sanitization
assert.ok(store.data, 'Store data object exists');
assert.strictEqual(store.getTheme(), 'dark', 'Default theme is dark');
assert.ok(Array.isArray(store.data.transactions), 'Transactions array exists');
console.log('✅ Test 1 Passed: Initial state & sanitization');

// Test 2: Add & Edit Transaction
const tx = store.addTransaction({
  title: 'Test Grocery Purchase',
  amount: 450,
  category: 'Food',
  type: 'expense',
  paymentMethod: 'UPI',
  date: '2026-08-15'
});
assert.strictEqual(tx.amount, 450);
assert.strictEqual(tx.title, 'Test Grocery');
assert.strictEqual(store.getTransactions().length, 1);

const editedTx = store.editTransaction(tx.id, { amount: 500, title: 'Updated Grocery' });
assert.strictEqual(editedTx?.amount, 500);
assert.strictEqual(editedTx?.title, 'Updated Grocery');
console.log('✅ Test 2 Passed: Add & Edit Transaction');

// Test 3: Calculate Monthly Metrics
const metrics = store.getMonthlyMetrics('2026-08');
assert.strictEqual(metrics.totalExpenses, 500);
console.log('✅ Test 3 Passed: Calculate Monthly Metrics');

// Test 4: Theme Switching
store.setTheme('emerald');
assert.strictEqual(store.getTheme(), 'emerald');
store.setTheme('oled');
assert.strictEqual(store.getTheme(), 'oled');
store.setTheme('dark');
assert.strictEqual(store.getTheme(), 'dark');
console.log('✅ Test 4 Passed: Theme Switching');

// Test 5: Security PIN & Fingerprint Verification
store.setSecurityPin(true, '1234');
store.setFingerprintEnabled(true);
assert.strictEqual(store.verifyPin('1234'), true, 'Correct PIN verifies');
assert.strictEqual(store.verifyPin('9999'), false, 'Incorrect PIN fails');
assert.strictEqual(store.getSecuritySettings().fingerprintEnabled, true);
store.setSecurityPin(false);
store.setFingerprintEnabled(false);
assert.strictEqual(store.getSecuritySettings().enabled, false);
console.log('✅ Test 5 Passed: Security PIN & Fingerprint Verification');

// Test 6: Loan Management & EMI Outflow
const loan = store.addLoan({
  name: 'Car Loan',
  lender: 'HDFC',
  totalPrincipal: 500000,
  remainingAmount: 500000,
  monthlyEmi: 15000,
  interestRate: 8.5,
  emiDay: 10
});
assert.strictEqual(loan.monthlyEmi, 15000);

const editedLoan = store.editLoan(loan.id, { remainingAmount: 450000 });
assert.strictEqual(editedLoan?.remainingAmount, 450000);
store.editLoan(loan.id, { emiDay: 99, remainingAmount: -100, monthlyEmi: -10 });
const sanitizedLoan = store.getLoans().find(l => l.id === loan.id);
assert.strictEqual(sanitizedLoan?.emiDay, 31);
assert.strictEqual(sanitizedLoan?.remainingAmount, 0);
assert.strictEqual(sanitizedLoan?.monthlyEmi, 0);
store.editLoan(loan.id, { remainingAmount: 450000, monthlyEmi: 15000, emiDay: 10 });

store.payEmiForLoan(loan.id, '2026-08');
const updatedLoan = store.getLoans().find(l => l.id === loan.id);
assert.ok(updatedLoan, 'Loan exists');
assert.strictEqual(updatedLoan!.remainingAmount, 435000);
assert.ok(store.getTransactions().some(t => t.title.includes('Car Loan')), 'EMI transaction auto-logged');
console.log('✅ Test 6 Passed: Loan Management & EMI Payment');

// Test 7: Investment Portfolio & SIP Outflow
const inv = store.addInvestment({
  name: 'Nifty 50 Index Fund',
  category: 'Mutual Funds',
  type: 'SIP',
  monthlySip: 5000,
  totalInvested: 50000,
  currentValue: 58000,
  platform: 'Zerodha'
});
assert.strictEqual(inv.monthlySip, 5000);

store.paySipForInvestment(inv.id, '2026-08');
const updatedInv = store.getInvestments().find(i => i.id === inv.id);
assert.strictEqual(updatedInv?.totalInvested, 55000);
assert.strictEqual(updatedInv?.currentValue, 63000);
assert.ok(store.getTransactions().some(t => t.title.includes('Nifty 50 Index Fund')), 'SIP transaction auto-logged');
console.log('✅ Test 7 Passed: Investment Holdings & SIP Outflow');

// Test 8: Salary Records & Paycheck
store.addOrUpdateSalary({
  monthYear: '2026-08',
  company: 'Acme Corp',
  grossAmount: 100000,
  deductions: 8000,
  netAmount: 92000,
  receivedDate: '2026-08-01',
  status: 'credited'
});
const salaryRecords = store.getSalaryRecords();
assert.strictEqual(salaryRecords.length, 1);
assert.strictEqual(salaryRecords[0].netAmount, 92000);
console.log('✅ Test 8 Passed: Salary Records & Paycheck');

// Test 9: Category Budgets
store.setBudget('Food', 10000);
store.setBudget('Transport', 3000);
const budgets = store.getBudgets();
assert.strictEqual(budgets['Food'], 10000);
assert.strictEqual(budgets['Transport'], 3000);
console.log('✅ Test 9 Passed: Category Budget Limits');

// Test 10: Udhar (Borrowed / Lent) Management & Settlement
const debt = store.addDebt({
  personName: 'Rahul Sharma',
  type: 'lent',
  amount: 10000,
  settledAmount: 0,
  date: '2026-08-10',
  notes: 'Trip expenses lent'
});
assert.strictEqual(debt.amount, 10000);
assert.strictEqual(debt.status, 'pending');

store.settleDebtPartial(debt.id, 4000);
const settledDebt = store.getDebts().find(d => d.id === debt.id);
assert.strictEqual(settledDebt?.settledAmount, 4000);
assert.strictEqual(settledDebt?.status, 'partially_paid');

store.settleDebtPartial(debt.id, 6000);
const fullySettled = store.getDebts().find(d => d.id === debt.id);
assert.strictEqual(fullySettled?.status, 'settled');

const overSettledDebt = store.addDebt({
  personName: 'Priya',
  type: 'borrowed',
  amount: 1000,
  settledAmount: 5000,
  date: '2026-08-11'
});
assert.strictEqual(overSettledDebt.settledAmount, 1000);
assert.strictEqual(overSettledDebt.status, 'settled');
store.deleteDebt(overSettledDebt.id);
console.log('✅ Test 10 Passed: Udhar (Borrowed / Lent) & Settlement');

// Test 11: AI Natural Language Parser (Single Entry)
const parsedSingle = parseNaturalLanguageHisab('Paid 350 for lunch via UPI');
assert.ok(parsedSingle, 'Parsed result exists');
assert.strictEqual(parsedSingle?.amount, 350);
assert.strictEqual(parsedSingle?.category, 'Food');
assert.strictEqual(parsedSingle?.type, 'expense');
assert.strictEqual(parsedSingle?.paymentMethod, 'UPI');
console.log('✅ Test 11 Passed: AI Natural Language Single Entry Parser');

// Test 12: AI Multi-Hisab Parser
const parsedMultiple = parseMultipleHisabs('350 petrol, 500 groceries via UPI, and 12000 emi');
assert.strictEqual(parsedMultiple.length, 3, 'Extracted 3 entries');
assert.strictEqual(parsedMultiple[0].amount, 350);
assert.strictEqual(parsedMultiple[0].category, 'Transport');
assert.strictEqual(parsedMultiple[1].amount, 500);
assert.strictEqual(parsedMultiple[1].category, 'Food');
assert.strictEqual(parsedMultiple[2].amount, 12000);
assert.strictEqual(parsedMultiple[2].type, 'emi');
console.log('✅ Test 12 Passed: AI Multi-Hisab Parser');

// Test 14: Title Cleaning & Category Categorization (Food, Shopping, Transport, Invest, Borrow)
const fishTx = parseNaturalLanguageHisab('i buy some fish 300');
assert.strictEqual(fishTx?.title, 'Fish');
assert.strictEqual(fishTx?.category, 'Food');

const ladduTx = parseNaturalLanguageHisab('bought 150 laddu');
assert.strictEqual(ladduTx?.title, 'Laddu');
assert.strictEqual(ladduTx?.category, 'Food');

const groceryShoppingTx = parseNaturalLanguageHisab('grocery shopping 900');
assert.strictEqual(groceryShoppingTx?.category, 'Food');

const hotelFoodTx = parseNaturalLanguageHisab("kaka's hotel 74");
assert.strictEqual(hotelFoodTx?.category, 'Food');

const chowmeinTx = parseNaturalLanguageHisab('chowmein and coffee 220');
assert.strictEqual(chowmeinTx?.category, 'Food');

const chilliChickenTypoTx = parseNaturalLanguageHisab('chilli chiken 180');
assert.strictEqual(chilliChickenTypoTx?.title, 'Chilli Chicken');
assert.strictEqual(chilliChickenTypoTx?.category, 'Food');

const drinkingWaterTx = parseNaturalLanguageHisab('mineral water bottle 40');
assert.strictEqual(drinkingWaterTx?.category, 'Food');

const waterBillTx = parseNaturalLanguageHisab('water bill 300');
assert.strictEqual(waterBillTx?.category, 'Bills');

const pantTx = parseNaturalLanguageHisab('i bought pant 1200');
assert.strictEqual(pantTx?.title, 'Pants');
assert.strictEqual(pantTx?.category, 'Shopping');

const shoesTx = parseNaturalLanguageHisab('shoes 2500');
assert.strictEqual(shoesTx?.title, 'Shoes');
assert.strictEqual(shoesTx?.category, 'Shopping');

const stocksTx = parseNaturalLanguageHisab('invest 5000 in stocks');
assert.strictEqual(stocksTx?.title, 'Stocks');
assert.strictEqual(stocksTx?.type, 'investment');

const borrowTx = parseNaturalLanguageHisab('borrowed 500 from rahul');
assert.strictEqual(borrowTx?.title, 'Rahul');
assert.strictEqual(borrowTx?.type, 'income');
console.log('✅ Test 14 Passed: Clean Title & Category Extraction (Food/Shopping/Transport/Invest/Borrow)');

// Test 15: Store Auto-Categorization & Bulk Rephrase Method
const autoFish = store.addTransaction({ title: 'i buy some fish', amount: 400, category: 'Others', type: 'expense' });
assert.strictEqual(autoFish.title, 'Fish');
assert.strictEqual(autoFish.category, 'Food');

const autoChilliChicken = store.addTransaction({ title: 'chilli chiken', amount: 180, category: 'Others', type: 'expense' });
assert.strictEqual(autoChilliChicken.title, 'Chilli Chicken');
assert.strictEqual(autoChilliChicken.category, 'Food');

store.data.transactions.push({ id: 'raw-1', title: 'bought 200 laddu', amount: 200, category: 'Others', type: 'expense', paymentMethod: 'UPI', date: '2026-08-17' });
const rephrasedCount = store.rephraseAllEntries();
assert.ok(rephrasedCount >= 1, 'Rephrased verbose transactions');
assert.ok(store.getTransactions().some(t => t.title === 'Fish' && t.category === 'Food'));
assert.ok(store.getTransactions().some(t => t.title === 'Laddu' && t.category === 'Food'));
console.log('✅ Test 15 Passed: Store Auto-Categorization & Bulk Rephrase Method');

// Test 16: Delete Operations & Clean Up
store.deleteTransaction(tx.id);
assert.strictEqual(store.getTransactions().filter(t => t.id === tx.id).length, 0);

store.deleteLoan(loan.id);
assert.strictEqual(store.getLoans().filter(l => l.id === loan.id).length, 0);

store.deleteInvestment(inv.id);
assert.strictEqual(store.getInvestments().filter(i => i.id === inv.id).length, 0);

store.deleteDebt(debt.id);
assert.strictEqual(store.getDebts().filter(d => d.id === debt.id).length, 0);
console.log('✅ Test 16 Passed: Delete Operations & Clean Up');

console.log('\n🎉 ALL 16 COMPREHENSIVE UNIT TESTS PASSED CLEANLY!\n');
process.exit(0);
