# Daily Hisab 💰

> A modern, fast, offline-first personal finance desktop app built with Electron, Vite, and Chart.js. Track expenses, category budgets, investments/SIPs, loans/EMIs, and monthly salary ledgers with Smart AI Natural Language Entry.

![Daily Hisab App](./assets/icon.png)

## ✨ Key Features

- 📊 **Dashboard & Analytics**: Monthly income vs expense breakdown, category donut charts, and cash flow bars.
- ⚡ **AI Smart Quick Entry**: Type or speak natural sentences (e.g. `Paid 350 for groceries via UPI` or `350 petrol` or `Salary 45000`) and auto-categorize instantly.
- 💳 **Loans & EMI Manager**: Track active principal balances, interest rates, and monthly EMI auto-debit due dates.
- 📈 **Investments & SIP Tracker**: Monitor monthly SIPs, stocks, mutual funds, gold (SGB), and total portfolio net worth.
- 💼 **Salary & Income Ledger**: Record gross salary, PF/TDS deductions, and net credited amount per month.
- 🎯 **Category Budgets**: Set spending limits per category with progress indicators and warnings.
- 💾 **Offline-First & Local Backup**: All data is securely stored locally on your desktop (`Application Support`). Export and import JSON backups anytime.

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18 or higher)
- npm

### Installation & Local Run

```bash
# 1. Clone repository
git clone https://github.com/sourav123-4/hisab-desktop-app.git

# 2. Go to directory
cd hisab-desktop-app

# 3. Install dependencies
npm install

# 4. Start local development app
npm start
```

---

## 📦 Building Native Installers

```bash
# Build production assets and package native macOS app (.app & .dmg)
npm run pack:mac

# Package native Windows installer (.exe)
npm run pack:win
```

Output installers will be generated inside the `release/` directory.

---

## 🛡️ License
MIT License
