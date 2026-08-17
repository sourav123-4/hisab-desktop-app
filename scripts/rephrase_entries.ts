import { parseNaturalLanguageHisab, cleanHisabTitle, detectCategoryFromText } from '../src/js/aiParser.js';
import type { Transaction } from '../src/types/index.js';

console.log('🔄 Running Daily Hisab Transaction Rephraser & Category Fixer...\n');

// Mock/In-memory local storage for node runner
const memoryStorage: Record<string, string> = {};
(global as any).localStorage = {
  getItem: (key: string) => memoryStorage[key] || null,
  setItem: (key: string, value: string) => { memoryStorage[key] = String(value); },
  removeItem: (key: string) => { delete memoryStorage[key]; },
  clear: () => { Object.keys(memoryStorage).forEach(k => delete memoryStorage[k]); }
};

export function rephraseEntriesList(transactions: Transaction[]): { updated: Transaction[]; count: number } {
  let count = 0;
  const updated = transactions.map(tx => {
    const originalTitle = tx.title || '';
    const originalCategory = tx.category || 'Others';
    const textToParse = `${originalTitle} ${tx.notes || ''} ${tx.amount || ''}`.trim();
    const parsed = parseNaturalLanguageHisab(textToParse);

    let newCategory = originalCategory;
    const detectedCat = detectCategoryFromText(textToParse);

    if (detectedCat !== 'Others') {
      newCategory = detectedCat;
    } else if (parsed && parsed.category && (originalCategory === 'Others' || !originalCategory)) {
      newCategory = parsed.category;
    }

    const newTitle = cleanHisabTitle(originalTitle, newCategory as string, tx.type);

    if (newTitle !== originalTitle || newCategory !== originalCategory) {
      count++;
      console.log(`  ✨ Rephrased: "${originalTitle}" (${originalCategory}) ➔ "${newTitle}" (${newCategory})`);
      return {
        ...tx,
        title: newTitle,
        category: newCategory
      };
    }
    return tx;
  });

  return { updated, count };
}

// Quick self-test demonstration on sample entries
const sampleUserEntries: Transaction[] = [
  { id: '1', title: 'i buy some fish', amount: 300, category: 'Others', type: 'expense', paymentMethod: 'UPI', date: '2026-08-17' },
  { id: '2', title: 'buy 200 fish', amount: 200, category: 'Others', type: 'expense', paymentMethod: 'UPI', date: '2026-08-17' },
  { id: '3', title: 'bought laddu', amount: 150, category: 'Others', type: 'expense', paymentMethod: 'Cash', date: '2026-08-17' },
  { id: '4', title: 'laddu 100', amount: 100, category: 'Food', type: 'expense', paymentMethod: 'UPI', date: '2026-08-17' },
  { id: '5', title: 'i bought pant 1200', amount: 1200, category: 'Others', type: 'expense', paymentMethod: 'Card', date: '2026-08-17' },
  { id: '6', title: 'shoes 2500', amount: 2500, category: 'Shopping', type: 'expense', paymentMethod: 'UPI', date: '2026-08-17' },
  { id: '7', title: '350 petrol', amount: 350, category: 'Transport', type: 'expense', paymentMethod: 'UPI', date: '2026-08-17' },
  { id: '8', title: 'invest 5000 in stocks', amount: 5000, category: 'Investment', type: 'investment', paymentMethod: 'Auto-Debit', date: '2026-08-17' },
  { id: '9', title: 'borrowed 500 from rahul', amount: 500, category: 'Income', type: 'income', paymentMethod: 'UPI', date: '2026-08-17' },
  { id: '10', title: 'Popcorn', amount: 12, category: 'Others', type: 'expense', paymentMethod: 'UPI', date: '2026-08-15', notes: 'AI Smart Entry: "popcorn at 12"' },
  { id: '11', title: 'Alu Kata', amount: 20, category: 'Others', type: 'expense', paymentMethod: 'UPI', date: '2026-08-15', notes: 'AI Smart Entry: "alu kata at 20"' },
  { id: '12', title: 'Posto', amount: 100, category: 'Others', type: 'expense', paymentMethod: 'UPI', date: '2026-08-15', notes: 'AI Smart Entry: "posto in 100"' },
  { id: '13', title: 'Hair Cutting', amount: 130, category: 'Others', type: 'expense', paymentMethod: 'UPI', date: '2026-08-15', notes: 'AI Smart Entry: "hair cutting at 130"' },
  { id: '14', title: 'Puri', amount: 56, category: 'Others', type: 'expense', paymentMethod: 'UPI', date: '2026-08-15', notes: 'AI Smart Entry: "56 in puri"' },
  { id: '15', title: 'Money Tapas Mamu', amount: 5000, category: 'Others', type: 'expense', paymentMethod: 'UPI', date: '2026-08-15', notes: 'AI Smart Entry: "given 5000 to tapas mamu"' },
  { id: '16', title: 'Biriyani', amount: 250, category: 'Others', type: 'expense', paymentMethod: 'UPI', date: '2026-08-17', notes: 'AI Smart Entry: "biriyani 250"' },
  { id: '17', title: 'Kela', amount: 40, category: 'Others', type: 'expense', paymentMethod: 'Cash', date: '2026-08-17', notes: 'AI Smart Entry: "40 kela"' },
  { id: '18', title: 'Passpass', amount: 10, category: 'Others', type: 'expense', paymentMethod: 'Cash', date: '2026-08-17', notes: 'AI Smart Entry: "10 for passpass"' }
];

console.log('Sample Entries Rephrasing Test:');
const result = rephraseEntriesList(sampleUserEntries);
console.log(`\n✅ Completed! Successfully rephrased ${result.count} entries.\n`);
