/**
 * Smart AI & Natural Language Transaction Parser for Daily Hisab
 */

export function parseNaturalLanguageHisab(text) {
  if (!text || typeof text !== 'string') return null;

  const raw = text.trim();
  let lower = raw.toLowerCase();

  // Strip foreign currency symbols ($ € £ USD EUR GBP) & convert all amounts strictly to Rupees
  lower = lower.replace(/[$€£]/g, ' ').replace(/\b(usd|eur|gbp|dollars?|cents?)\b/gi, ' ');

  // Normalize Hinglish shorthand numbers BEFORE extraction
  // (e.g. 52k -> 52000, 52.5k -> 52500, 52 hazar -> 52000, 52 thousand -> 52000, 1.5 lakh -> 150000)
  lower = lower
    .replace(/(\d+(?:\.\d+)?)\s*k\b/gi, (_, n) => `${parseFloat(n) * 1000}`)
    .replace(/(\d+(?:\.\d+)?)\s*(?:hazar|hazhar|thousand|thousands)\b/gi, (_, n) => `${parseFloat(n) * 1000}`)
    .replace(/(\d+(?:\.\d+)?)\s*(?:lakh|lakhs|lac|lacs)\b/gi, (_, n) => `${parseFloat(n) * 100000}`);

  // Fix speech-to-text formatting artifacts (e.g. "52,000", "52.000", "52000.00")
  // Replace thousand separators like "52,000" or "52.000" -> "52000"
  lower = lower.replace(/(\d+)[\.,](\d{3})(?!\d)/g, '$1$2');
  // Clean decimal zero endings like "52000.00" -> "52000", "52.00" -> "52"
  lower = lower.replace(/(\d+)\.00\b/g, '$1');

  // Remove trailing period at sentence end if after digits (e.g. '52000.' -> '52000')
  lower = lower.replace(/(\d+)\.(?!\d)/g, '$1');

  // 1. Extract Amount (e.g., 350, 1,200, ₹450, 52000, 52,000)
  const amountMatch = lower.match(/(?:rs\.?|₹|inr|rupaye|rupees)?\s*(\d+(?:[\s,]\d+)*(?:\.\d{1,2})?)/i);
  if (!amountMatch) return null;

  const amountStr = amountMatch[1].replace(/[\s,]/g, '');
  let amount = parseFloat(amountStr);
  if (isNaN(amount) || amount <= 0) return null;

  // Auto-scale salary/income shorthand amounts (e.g., "salary 52" or "salary 50" -> 52000 / 50000)
  // ONLY scale if the number is small (<= 150) and a high-value keyword is present.
  const isHighValueContext = /salary|income|earned|paycheck|emi|loan|investment|rent/i.test(lower);
  if (isHighValueContext && amount > 0 && amount <= 150) {
    amount = amount * 1000;
  }

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
  else if (/paytm/i.test(lower)) paymentMethod = 'Paytm';
  else if (/phonepe/i.test(lower)) paymentMethod = 'PhonePe';
  else if (/gpay|google pay/i.test(lower)) paymentMethod = 'GPay';
  else if (/upi/i.test(lower)) paymentMethod = 'UPI';

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
    .replace(/(?:rs\.?|₹|inr|rupaye|rupees)?\s*\d+(?:[\s,]\d+)*(?:\.\d{1,2})?/gi, '')
    .replace(/\b(spent|paid|bought|got|received|for|on|at|via|through|using|in|by|rupees|rupaye|rs|upi|gpay|phonepe|paytm|cash|credit card|card|netbanking|auto-debit|today|yesterday|pe|ka|ki|diya|kharcha|khareeda|hazar|hazhar|thousand|thousands|lakh|lakhs|lac|lacs|k)\b/gi, '')
    .replace(/[$₹€£]/g, '')
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

export function parseMultipleHisabs(text) {
  if (!text || typeof text !== 'string') return [];

  const raw = text.trim();
  if (!raw) return [];

  // Split multi-transaction speech by clauses: comma, semicolon, newline, " and ", " also ", " aur ", " then ", " plus ", " & "
  const chunks = raw
    .split(/(?:\s*[\n;,]\s*|\s+(?:and|also|aur|then|plus|&)\s+)/i)
    .map(c => c.trim())
    .filter(Boolean);

  const results = [];
  for (const chunk of chunks) {
    const item = parseNaturalLanguageHisab(chunk);
    if (item) {
      results.push(item);
    }
  }

  // If chunk splitting didn't yield results, try parsing the whole raw string as single item
  if (results.length === 0) {
    const single = parseNaturalLanguageHisab(raw);
    if (single) results.push(single);
  }

  return results;
}
