import type { Transaction } from '../types/index.js';

const FOOD_CONTEXT_REGEX = /\b(food|zomato|swiggy|blinkit|zepto|instamart|bigbasket|restaurant|dining|dhaba|hotel|tiffin|mess|canteen|cafe|caf[eé]|bakery|sweet\s*shop|eatery|meal|meals|dinner|lunch|breakfast|brunch|snack|snacks|tea|chai|coffee|cold\s*drink|soft\s*drink|soda|juice|lassi|shake|milkshake|smoothie|water\s*bottle|mineral\s*water|drinking\s*water|pizza|burger|sandwich|pasta|noodle|noodles|chowmein|chowmin|maggi|momos?|rolls?|wraps?|samosa|singara|kachori|kochuri|luchi|puri|poori|paratha|parotha|roti|chapati|naan|kulcha|dosa|idli|vada|uttapam|upma|poha|pav|pao|bhaji|misal|biryani|biriyani|fried\s*rice|rice|chawal|pulao|polao|khichdi|khichuri|dal|daal|curry|gravy|soup|salad|thali|bhojan|khana|khaye|khaya|sabz?i|sabji|tarkari|alu|aloo|potato|tomato|pyaz|onion|garlic|ginger|vegetables?|veggies|veg|fruit|fruits|apple|banana|kela|kele|mango|orange|grapes|fish(?:es)?|machli|machhli|maach|chingri|katla|rohu|hilsa|ilish|prawns?|crab|seafood|chilli|chilly|chili|chicken|chiken|chikn|murgi|mutton|meat|beef|pork|kabab|kebab|tandoori|tikka|eggs?|anda|ande|omelette|omlet|paneer|chana|rajma|chole|bhature|cheese|butter|ghee|curd|dahi|yogurt|cream|bread|toast|biscuit|biscuits|cookies?|chips|chanachur|namkeen|bhujia|muri|jhalmuri|popcorn|pakora|pakoda|chop|fuchka|puchka|golgappa|bhel|bhelpuri|ghugni|sweets?|mithai|jalebi|gulab\s*jamun|rasgulla|rosogolla|sandesh|pantua|payesh|kheer|halwa|cake|pastry|ice\s*cream|kulfi|dessert|ladd?u+s?|ladd?oo?s?|chocolate|chocolates|candy|candies|toffee|mint|mints|mentos|center\s*fresh|centre\s*fresh|pass\s*pass|passpass|paan|mouth\s*freshener|groceries|grocery|kirana|supermarket|ration|atta|flour|maida|suji|besan|oil|mustard\s*oil|masala|spices?|salt|sugar|posto)\b/i;
const UTILITY_CONTEXT_REGEX = /\b(electricity|bijli|bill|wifi|broadband|recharge|jio|airtel|power|gas|utility|mobile|rent)\b/i;

export function cleanHisabTitle(raw: string, category: string = 'Others', type: string = 'expense'): string {
  if (!raw || typeof raw !== 'string') {
    return `${category} ${type === 'expense' ? 'Expense' : 'Transaction'}`;
  }

  let cleaned = raw.trim();

  // 1. Remove explicit currency amounts (e.g. ₹500, Rs. 1000, 200 rupees, $50)
  cleaned = cleaned
    .replace(/(?:rs\.?|₹|inr|rupaye|rupees|\$|€|£)\s*\d+(?:[\s,]\d+)*(?:\.\d{1,2})?/gi, '')
    .replace(/\d+(?:[\s,]\d+)*(?:\.\d{1,2})?\s*(?:rupees|rupaye|rs|inr|usd|eur|gbp|dollars?|cents?)\b/gi, '');

  // 2. Remove payment methods & timing words
  cleaned = cleaned
    .replace(/\b(upi|gpay|google pay|phonepe|paytm|cash|credit card|card|cc|netbanking|auto-debit|autodebit|today|yesterday|tomorrow|kal|aaj)\b/gi, '');

  // 3. Remove action verbs, pronouns, and filler words
  const stopWordsRegex = /\b(given|lent|borrowed|borrow|udhar|spent|spend|paid|pay|bought|buy|buyed|buying|purchase|purchased|purchasing|selling|sell|sold|invested|invest|investing|got|get|credited|received|receive|give|gave|take|took|taken|i|we|you|he|she|they|me|my|mine|our|us|some|any|kind|of|a|an|the|this|that|these|those|to|from|for|on|at|via|through|using|in|by|with|and|also|then|or|plus|pe|par|ka|ki|ke|ko|se|diya|diye|liya|liye|kharcha|khareeda|khareede|hazar|hazhar|thousand|thousands|lakh|lakhs|lac|lacs|k|money)\b/gi;
  cleaned = cleaned.replace(stopWordsRegex, ' ').replace(/\s+/g, ' ').trim();

  // 4. Remove standalone leading or trailing amount numbers (e.g. "150 laddu" or "laddu 150")
  cleaned = cleaned
    .replace(/(^\d+(?:\.\d{1,2})?\s+)|(\s+\d+(?:\.\d{1,2})?$)/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // 5. Remove unwanted punctuation and collapse whitespace
  cleaned = cleaned.replace(/[\.,;:\-_\/\\()'"]/g, ' ').replace(/\s+/g, ' ').trim();

  // 6. Canonical mapping for common items
  if (cleaned) {
    const lowerClean = cleaned.toLowerCase();
    if (/^fish(es)?$/i.test(lowerClean) || /^(machli|machhli|maach)$/i.test(lowerClean)) return 'Fish';
    if (/^eggs?$/i.test(lowerClean) || /^(anda|ande)$/i.test(lowerClean)) return 'Egg';
    if (/^ladd?u+s?$/i.test(lowerClean) || /^ladd?oo?s?$/i.test(lowerClean)) return 'Laddu';
    if (/^shoes?$/i.test(lowerClean) || /^(joota|joote)$/i.test(lowerClean)) return 'Shoes';
    if (/^pants?$/i.test(lowerClean)) return 'Pants';
    if (/^shirts?$/i.test(lowerClean)) return 'Shirt';
    if (/^petrol$/i.test(lowerClean)) return 'Petrol';
    if (/^diesel$/i.test(lowerClean)) return 'Diesel';
    if (/^stocks?$/i.test(lowerClean)) return 'Stocks';
    if (/^popcorn$/i.test(lowerClean)) return 'Popcorn';
    if (/^posto$/i.test(lowerClean)) return 'Posto';
    if (/^puris?|pooris?$/i.test(lowerClean)) return 'Puri';
    if (/^alu\s*kata|aloo\s*kata$/i.test(lowerClean)) return 'Alu Kata';
    if (/^hair\s*cutting|haircut$/i.test(lowerClean)) return 'Hair Cutting';
    if (/^bir[iy]*ani$/i.test(lowerClean)) return 'Biryani';
    if (/^kela|kele$/i.test(lowerClean)) return 'Kela';
    if (/^pass\s*pass$/i.test(lowerClean)) return 'Pass Pass';
    if (/^(chilli|chilly|chili)\s+(chicken|chiken|chikn)$/i.test(lowerClean)) return 'Chilli Chicken';
    if (/^(chicken|chiken|chikn)$/i.test(lowerClean)) return 'Chicken';

    return cleaned
      .split(' ')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');
  }

  return `${category} ${type === 'expense' ? 'Expense' : 'Transaction'}`;
}

export function detectCategoryFromText(text: string): string {
  if (!text || typeof text !== 'string') return 'Others';
  const lower = text.toLowerCase();

  if (FOOD_CONTEXT_REGEX.test(lower)) {
    return 'Food';
  }
  if (UTILITY_CONTEXT_REGEX.test(lower) || /\bwater\b/i.test(lower)) {
    return 'Bills';
  }
  if (/shopping|amazon|flipkart|clothes|clothing|shoes?|shoe|joota|joote|sneakers?|footwear|pants?|pant|shirt|shirts|jeans|t-shirt|tshirt|dress|myntra|zudio|trends|electronics|mall|khareeda/i.test(lower)) {
    return 'Shopping';
  }
  if (/petrol|diesel|fuel|tel|uber|ola|rapido|cab|auto|bus|flight|train|metro|transport|fastag|bike|car|parking|toll|rickshaw|toto/i.test(lower)) {
    return 'Transport';
  }
  if (/medicine|dawa|doctor|hospital|pharmacy|health|clinic|lab|pathology|hair\s*cut|haircut|hair\s*cutting|barber|salon|parlour|grooming|facial|spa|shave|trim/i.test(lower)) {
    return 'Health';
  }
  if (/movie|cinema|netflix|prime|bookmyshow|game|concert|entertainment|gym/i.test(lower)) {
    return 'Entertainment';
  }

  return 'Others';
}

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
  if (/received|got|credited|salary|freelance|bonus|income|earned|dividend|aaya|aayi|mila|mili|payout|sold|sell/i.test(lower)) {
    type = 'income';
  } else if (/invested|sip|mutual fund|stocks|sgb|gold|equity|fd|lagaya|invest/i.test(lower)) {
    type = 'investment';
  } else if (/emi|loan|installment|auto-debit/i.test(lower)) {
    type = 'emi';
  } else if (/borrowed|borrow/i.test(lower)) {
    type = 'income';
  } else if (/bought|buy|buyed|spent|spend|paid|pay|khareeda|khareede|lent|given/i.test(lower)) {
    type = 'expense';
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

  let category = detectCategoryFromText(lower);
  if (category === 'Others') {
    if (type === 'emi') {
      category = 'EMI';
    } else if (type === 'investment') {
      category = 'Investment';
    } else if (type === 'income') {
      category = 'Income';
    }
  }

  const title = cleanHisabTitle(raw, category, type);

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
