const DEFAULT_CATEGORIES = [
  'Parkside Rent',
  'Rental Income',
  'Insurance',
  'Childcare',
  'Mia Swimming',
  'Loan Payment',
  'Utilities',
  'Bank Fees',
  'Savings',
  'Shopping',
  'Fuel',
  'Uncategorised',
];

const DEFAULT_SAVINGS_CONFIG = {
  startDate: '2026-01-01',
  jackOpening: 38076.78,
  courtneyOpening: 38325.92,
  offsetOpening: 77196,
};

class DataStore {
  constructor() {
    this._transactions = [];
    this._categories = [...DEFAULT_CATEGORIES];
    this._customRules = [];
    this._savingsConfig = { ...DEFAULT_SAVINGS_CONFIG };
  }

  // --- Transactions ---

  getTransactions() {
    return this._transactions;
  }

  addTransactions(newTxns) {
    let added = 0;
    let skipped = 0;

    for (const tx of newTxns) {
      if (this._isDuplicate(tx)) {
        skipped++;
      } else {
        this._transactions.push(tx);
        added++;
      }
    }

    // Sort by date descending
    this._transactions.sort((a, b) => {
      if (a.date < b.date) return 1;
      if (a.date > b.date) return -1;
      return 0;
    });

    return { added, skipped };
  }

  updateTransaction(index, updates) {
    if (index < 0 || index >= this._transactions.length) return;
    this._transactions[index] = { ...this._transactions[index], ...updates };
  }

  _isDuplicate(tx) {
    return this._transactions.some(
      (existing) =>
        existing.date === tx.date &&
        existing.amount === tx.amount &&
        existing.bankDesc === tx.bankDesc
    );
  }

  // --- Categories ---

  getCategories() {
    return [...this._categories];
  }

  addCategory(name) {
    if (!this._categories.includes(name)) {
      this._categories.push(name);
    }
  }

  // --- Custom Rules ---

  getCustomRules() {
    return this._customRules;
  }

  addCustomRule(rule) {
    this._customRules.push(rule);
  }

  removeCustomRule(index) {
    this._customRules.splice(index, 1);
  }

  // --- Savings ---

  getSavingsConfig() {
    return { ...this._savingsConfig };
  }

  setSavingsConfig(config) {
    this._savingsConfig = { ...this._savingsConfig, ...config };
  }

  getSavingsState() {
    const { jackOpening, courtneyOpening, startDate, offsetOpening } = this._savingsConfig;

    let jack = jackOpening;
    let courtney = courtneyOpening;

    // Sort transactions by date ascending for chronological calculation
    const sorted = [...this._transactions].sort((a, b) => {
      if (a.date < b.date) return -1;
      if (a.date > b.date) return 1;
      return 0;
    });

    for (const tx of sorted) {
      // Only process transactions on or after startDate
      if (tx.date < startDate) continue;

      const amount = tx.amount;
      const category = tx.category;
      const allocation = tx.allocation;
      const split = tx.split;

      if (category === 'Savings') {
        if (allocation === 'Jack') {
          jack += amount;
        } else if (allocation === 'Courtney') {
          courtney += amount;
        }
      } else if (category === 'Rental Income') {
        jack += amount / 2;
        courtney += amount / 2;
      } else if (amount > 0) {
        // Positive non-savings, non-rental income — skip
        continue;
      } else {
        // Expense (amount <= 0)
        if (split) {
          jack += amount / 2;
          courtney += amount / 2;
        } else if (allocation === 'Jack') {
          jack += amount;
        } else if (allocation === 'Courtney') {
          courtney += amount;
        }
      }
    }

    // Offset balance = opening + all transactions from startDate
    const txTotal = sorted
      .filter(tx => tx.date >= startDate)
      .reduce((s, tx) => s + tx.amount, 0);
    const offsetBalance = (offsetOpening || 0) + txTotal;

    // Combined savings = difference between current and starting balance
    const combined = offsetBalance - (offsetOpening || 0);

    return {
      jack: Math.round(jack * 100) / 100,
      courtney: Math.round(courtney * 100) / 100,
      combined: Math.round(combined * 100) / 100,
      offsetBalance: Math.round(offsetBalance * 100) / 100,
    };
  }

  // --- Other ---

  clear() {
    this._transactions = [];
    this._categories = [...DEFAULT_CATEGORIES];
    this._customRules = [];
    this._savingsConfig = { ...DEFAULT_SAVINGS_CONFIG };
  }
}

export const dataStore = new DataStore();
