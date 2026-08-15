import type { Transaction } from '../types/index.js';

export function parseNaturalLanguageHisab(text: string): Partial<Transaction> | null {
  if (!text || typeof text !== 'string') return null;

  const raw = text.trim();
  let lower = raw.toLowerCase();

  lower = lower.replace(/[$€£]/g, ' ').replace(/\b(usd|eur|gbp|dollars?|cents?)\b/gi, ' ');

  lower = lower
    .replace(/(\d+(?:\.\d+)?)\s*k\b/gi, (_, n) => `${parseFloat(n) * 1000}`)
    .replace(/(\d+(?:\.\d+)?)\s*(?:hazar|hazhar|thousand|thousands)\b/gi, (_, n) => `${parseFloat(n) * 1000}`)
    .replace(/(\d+(?:\.\d+)?)\s*(?:lakh|lakhs|lac|lacs)\b/gi, (_, n) => `${parseFloat(n) * 100000}`);

  lower = lower.replace(/(\d+)[\.,](\d{3})(?!\d)/g, '$1$2');
  lower = lower.replace(/(\d+)\.00\b/g, '$1');
  lower = lower.replace(/(\d+)\.(?!\d)/g, '$1');

  const amountMatch = lower.match(/(?:rs\.?|₹|inr|rupaye|rupees)?\s*(\d+(?:[\s,]\d+)*(?:\.\d{1,2})?)/i);
  if (!amountMatch) return null;

  const amountStr = amountMatch[1].replace(/[\s,]/g, '');
  let amount = parseFloat(amountStr);
  if (isNaN(amount) || amount <= 0) return null;

  const isHighValueContext = /salary|income|earned|paycheck|emi|loan|investment|rent/i.test(lower);
  if (isHighValueContext && amount > 0 && amount <= 150) {
    amount = amount * 1000;
  }

  let type: 'expense' | 'income' | 'investment' | 'emi' = 'expense';
  if (/received|got|credited|salary|freelance|bonus|income|earned|dividend|aaya|aayi|mila|mili|payout/i.test(lower)) {
    type = 'income';
  } else if (/invested|sip|mutual fund|stocks|sgb|gold|equity|fd|lagaya|invest/i.test(lower)) {
    type = 'investment';
  } else if (/emi|loan|installment|auto-debit/i.test(lower)) {
    type = 'emi';
  }

  let paymentMethod = 'UPI';
  if (/cash/i.test(lower)) paymentMethod = 'Cash';
  else if (/credit card|card|cc/i.test(lower)) paymentMethod = 'Credit Card';
  else if (/netbanking|bank transfer|neft|rtgs|imps|account/i.test(lower)) paymentMethod = 'NetBanking';
  else if (/auto-debit|autodebit/i.test(lower)) paymentMethod = 'Auto-Debit';
  else if (/paytm/i.test(lower)) paymentMethod = 'Paytm';
  else if (/phonepe/i.test(lower)) paymentMethod = 'PhonePe';
  else if (/gpay|google pay/i.test(lower)) paymentMethod = 'GPay';
  else if (/upi/i.test(lower)) paymentMethod = 'UPI';

  let category = 'Others';
  if (/food|zomato|swiggy|blinkit|zepto|instamart|restaurant|dining|groceries|grocery|supermarket|vegetables?|sabz?i|dinner|lunch|breakfast|tea|chai|coffee|starbucks|mcdonalds|kfc|dominos|pizza|burger|pasta|noodle|momos|roll|samosa|dosa|idli|paratha|sweets?|mithai|ice\s*cream|juice|fruits?|apple|banana|mango|orange|fish|machli|maach|chicken|mutton|meat|beef|pork|eggs?|anda|milk|doodh|paneer|cheese|butter|curd|dahi|bread|roti|dal|rice|chawal|biryani|khana|khaye|khaya/i.test(lower)) {
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

  let title = raw;
  title = title
    .replace(/(?:rs\.?|₹|inr|rupaye|rupees)?\s*\d+(?:[\s,]\d+)*(?:\.\d{1,2})?/gi, '')
    .replace(/\b(given|lent|borrowed|udhar|spent|paid|bought|got|received|to|from|for|on|at|via|through|using|in|by|rupees|rupaye|rs|upi|gpay|phonepe|paytm|cash|credit card|card|netbanking|auto-debit|today|yesterday|pe|ka|ki|diya|diye|liya|liye|kharcha|khareeda|hazar|hazhar|thousand|thousands|lakh|lakhs|lac|lacs|k)\b/gi, '')
    .replace(/[$₹€£]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!title || title.length < 2) {
    title = `${category} ${type === 'expense' ? 'Expense' : 'Transaction'}`;
  } else {
    title = title.charAt(0).toUpperCase() + title.slice(1);
  }

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

export function parseMultipleHisabs(text: string): Array<Partial<Transaction>> {
  if (!text || typeof text !== 'string') return [];

  const raw = text.trim();
  if (!raw) return [];

  const chunks = raw
    .split(/(?:\s*[\n;,]\s*|\s+(?:and|also|aur|then|plus|&)\s+)/i)
    .map(c => c.trim())
    .filter(Boolean);

  const results: Array<Partial<Transaction>> = [];
  for (const chunk of chunks) {
    const item = parseNaturalLanguageHisab(chunk);
    if (item) {
      results.push(item);
    }
  }

  if (results.length === 0) {
    const single = parseNaturalLanguageHisab(raw);
    if (single) results.push(single);
  }

  return results;
}
