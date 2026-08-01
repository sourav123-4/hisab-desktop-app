/**
 * Smart AI & Natural Language Transaction Parser for Daily Hisab
 */

export function parseNaturalLanguageHisab(text) {
  if (!text || typeof text !== 'string') return null;

  const raw = text.trim();
  let lower = raw.toLowerCase();

  // Normalize Hinglish shorthand numbers (e.g. 5k -> 5000, 20 hazar -> 20000, 1 lakh -> 100000)
  lower = lower
    .replace(/(\d+)\s*k\b/gi, (_, n) => `${parseFloat(n) * 1000}`)
    .replace(/(\d+)\s*(?:hazar|thousand)/gi, (_, n) => `${parseFloat(n) * 1000}`)
    .replace(/(\d+)\s*lakh/gi, (_, n) => `${parseFloat(n) * 100000}`);

  // 1. Extract Amount (e.g., 350, 1,200, ₹450, 15000)
  const amountMatch = lower.match(/(?:rs\.?|₹|inr|rupaye|rupees)?\s*(\d+(?:,\d+)*(?:\.\d+)?)/i);
  if (!amountMatch) return null;

  const amountStr = amountMatch[1].replace(/,/g, '');
  const amount = parseFloat(amountStr);
  if (isNaN(amount) || amount <= 0) return null;

  // 2. Determine Transaction Type
  let type = 'expense'; // default
  if (/received|got|credited|salary|freelance|bonus|income|earned|dividend|aaya|aayi|mila|mili|payout/i.test(lower)) {
    type = 'income';
  } else if (/invested|sip|mutual fund|stocks|sgb|gold|equity|fd|lagaya|invest/i.test(lower)) {
    type = 'investment';
  } else if (/emi|loan|installment|auto-debit/i.test(lower)) {
    type = 'emi';
  }

  // 3. Determine Payment Method
  let paymentMethod = 'UPI'; // default in India
  if (/cash/i.test(lower)) paymentMethod = 'Cash';
  else if (/credit card|card|cc/i.test(lower)) paymentMethod = 'Credit Card';
  else if (/netbanking|bank transfer|neft|rtgs|imps|account/i.test(lower)) paymentMethod = 'NetBanking';
  else if (/auto-debit|autodebit/i.test(lower)) paymentMethod = 'Auto-Debit';
  else if (/gpay|google pay|phonepe|paytm|upi/i.test(lower)) paymentMethod = 'UPI';

  // 4. Determine Category
  let category = 'Others';
  if (/food|zomato|swiggy|restaurant|dining|groceries|supermarket|vegetables|sabji|dinner|lunch|breakfast|tea|chai|coffee|starbucks|mcdonalds|pizza|khana/i.test(lower)) {
    category = 'Food';
  } else if (/electricity|bijli|bill|water|wifi|broadband|recharge|jio|airtel|power|gas|utility|mobile|rent/i.test(lower)) {
    category = 'Bills';
  } else if (/petrol|diesel|fuel|tel|uber|ola|cab|auto|bus|flight|train|metro|transport|fastag/i.test(lower)) {
    category = 'Transport';
  } else if (/shopping|amazon|flipkart|clothes|shoes|myntra|electronics|mall|khareeda/i.test(lower)) {
    category = 'Shopping';
  } else if (/medicine|dawa|doctor|hospital|pharmacy|health|clinic|lab/i.test(lower)) {
    category = 'Health';
  } else if (/movie|cinema|netflix|prime|bookmyshow|game|concert|entertainment|gym/i.test(lower)) {
    category = 'Entertainment';
  } else if (type === 'emi') {
    category = 'EMI';
  } else if (type === 'investment') {
    category = 'Investment';
  } else if (type === 'income') {
    category = 'Income';
  }

  // 5. Clean Title Description
  let title = raw;
  title = title
    .replace(/(?:rs\.?|₹|inr|rupaye|rupees)?\s*\d+(?:,\d+)*(?:\.\d+)?/gi, '')
    .replace(/\b(spent|paid|bought|got|received|for|on|at|via|through|using|in|by|rupees|rupaye|rs|upi|gpay|phonepe|paytm|cash|credit card|card|netbanking|auto-debit|today|yesterday|pe|ka|ki|diya|kharcha|khareeda)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!title || title.length < 2) {
    title = `${category} ${type === 'expense' ? 'Expense' : 'Transaction'}`;
  } else {
    // Capitalize title
    title = title.charAt(0).toUpperCase() + title.slice(1);
  }

  // 6. Date determination
  let date = new Date().toISOString().split('T')[0];
  if (/yesterday|kal/i.test(lower)) {
    const yest = new Date();
    yest.setDate(yest.getDate() - 1);
    date = yest.toISOString().split('T')[0];
  }

  return {
    title,
    amount,
    category,
    type,
    paymentMethod,
    date,
    notes: `AI Smart Entry: "${raw}"`
  };
}
