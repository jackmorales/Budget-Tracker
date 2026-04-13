import {
  db,
  doc,
  setDoc,
  getDoc,
  getDocs,
  collection,
  writeBatch,
} from './firebase.js';

const DEFAULT_CATEGORIES = [
  'Parkside Rent',
  'Rental Income',
  'Insurance',
  'Childcare',
  'Mia Swimming',
  'Loan Payment',
  'Utilities',
  'Bank Fees',
  'Income',
  'Savings',
  'Shopping',
  'Food',
  'Fuel',
  'Health',
  'Gifts',
  'Uncategorised',
];

const DEFAULT_SAVINGS_CONFIG = {
  startDate: '2026-01-01',
  jackOpening: 38076.78,
  courtneyOpening: 38325.92,
  offsetOpening: 77196,
};

// ============================================================
// DETERMINISTIC TX ID — collision-free, based on date+amount+desc
// ============================================================

function txDocId(tx) {
  const raw = `${tx.date}|${tx.amount}|${tx.bankDesc || ''}`;
  // Base64-encode for a safe, deterministic Firestore doc ID
  return btoa(unescape(encodeURIComponent(raw)))
    .replace(/\//g, '_')
    .replace(/\+/g, '-')
    .replace(/=/g, '');
}

// ============================================================
// DATASTORE
// ============================================================

class DataStore {
  constructor() {
    this._transactions = [];
    this._categories = [...DEFAULT_CATEGORIES];
    this._customRules = [];
    this._savingsConfig = { ...DEFAULT_SAVINGS_CONFIG };
    this._uid = null;
  }

  // --- Auth ---

  setUid(uid) {
    this._uid = uid;
  }

  // --- Transactions ---

  getTransactions() {
    return this._transactions;
  }

  addTransactions(newTxns) {
    let added = 0;
    let skipped = 0;
    const newlyAdded = [];

    for (const tx of newTxns) {
      if (this._isDuplicate(tx)) {
        skipped++;
      } else {
        tx._docId = txDocId(tx);
        this._transactions.push(tx);
        newlyAdded.push(tx);
        added++;
      }
    }

    // Sort by date descending
    this._transactions.sort((a, b) => {
      if (a.date < b.date) return 1;
      if (a.date > b.date) return -1;
      return 0;
    });

    return { added, skipped, newlyAdded };
  }

  updateTransaction(index, updates) {
    if (index < 0 || index >= this._transactions.length) return;
    this._transactions[index] = { ...this._transactions[index], ...updates };
    return this._transactions[index];
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
      const amount = tx.amount;
      const category = tx.category;
      const allocation = tx.allocation;
      const split = tx.split;

      if (category === 'Income' || category === 'Savings') {
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

    // Offset balance = opening + ALL transactions in file (no date filter)
    const txTotal = sorted.reduce((s, tx) => s + tx.amount, 0);
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

  // ============================================================
  // FIRESTORE SYNC
  // ============================================================

  /** Load all user data from Firestore into memory */
  async loadFromFirestore(uid) {
    this._uid = uid;
    this.clear();

    // Load config
    const configRef = doc(db, 'users', uid, 'settings', 'config');
    const configSnap = await getDoc(configRef);
    if (configSnap.exists()) {
      const data = configSnap.data();
      if (data.savingsConfig) this._savingsConfig = { ...DEFAULT_SAVINGS_CONFIG, ...data.savingsConfig };
      if (data.categories) this._categories = data.categories;
      if (data.customRules) this._customRules = data.customRules;
    }

    // Load transactions
    const txRef = collection(db, 'users', uid, 'transactions');
    const txSnap = await getDocs(txRef);
    const txns = [];
    txSnap.forEach((docSnap) => {
      const tx = docSnap.data();
      tx._docId = docSnap.id;
      txns.push(tx);
    });

    // Sort by date descending
    txns.sort((a, b) => {
      if (a.date < b.date) return 1;
      if (a.date > b.date) return -1;
      return 0;
    });

    this._transactions = txns;
    return { transactions: txns.length };
  }

  /** Save newly added transactions to Firestore in batches */
  async saveTransactions(transactions) {
    if (!this._uid || transactions.length === 0) return;

    // Firestore batches max 500 writes
    const batchSize = 450;
    for (let i = 0; i < transactions.length; i += batchSize) {
      const chunk = transactions.slice(i, i + batchSize);
      const batch = writeBatch(db);

      for (const tx of chunk) {
        const docId = tx._docId || txDocId(tx);
        const ref = doc(db, 'users', this._uid, 'transactions', docId);
        // Strip internal fields before saving
        const { _docId, ...data } = tx;
        batch.set(ref, data);
      }

      await batch.commit();
    }
  }

  /** Update a single transaction in Firestore */
  async saveTransaction(tx) {
    if (!this._uid) return;
    const docId = tx._docId || txDocId(tx);
    const ref = doc(db, 'users', this._uid, 'transactions', docId);
    const { _docId, ...data } = tx;
    await setDoc(ref, data);
  }

  /** Save config (savings, categories, rules) to Firestore */
  async saveConfig() {
    if (!this._uid) return;
    const ref = doc(db, 'users', this._uid, 'settings', 'config');
    await setDoc(ref, {
      savingsConfig: this._savingsConfig,
      categories: this._categories,
      customRules: this._customRules,
    });
  }
}

export const dataStore = new DataStore();
