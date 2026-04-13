// rules-engine.js
// Auto-categorises and allocates transactions based on built-in and custom rules.

const BUILT_IN_RULES = [
  { matchField: 'reference',   matchText: 'TEN01732',              category: 'Parkside Rent',  allocation: 'Shared',   split: true  },
  { matchField: 'description', matchText: 'RAY WHITE',             category: 'Parkside Rent',  allocation: 'Shared',   split: true  },
  { matchField: 'description', matchText: 'RAIN REAL ESTATE',      category: 'Rental Income',  allocation: 'Income',   split: false },
  { matchField: 'description', matchText: 'HBF',                   category: 'Insurance',      allocation: 'Shared',   split: true  },
  { matchField: 'description', matchText: 'NIB',                   category: 'Insurance',      allocation: 'Shared',   split: true  },
  { matchField: 'description', matchText: 'OVER THE HILLS',        category: 'Childcare',      allocation: 'Shared',   split: true  },
  { matchField: 'description', matchText: 'FIRST STEPS',           category: 'Childcare',      allocation: 'Shared',   split: true  },
  { matchField: 'description', matchText: 'COULTERANNANGRVE',      category: 'Mia Swimming',   allocation: 'Shared',   split: true  },
  { matchField: 'description', matchText: 'MORALES COURTNEY GRACE',category: 'Loan Payment',   allocation: 'Shared',   split: true,  condition: 'outflow' },
  { matchField: 'description', matchText: 'SYDNEY WATER',          category: 'Utilities',      allocation: 'Shared',   split: true  },
  { matchField: 'description', matchText: 'ENERGYAUSTRALIA',       category: 'Utilities',      allocation: 'Shared',   split: true  },
  { matchField: 'description', matchText: 'ACCOUNT SERVICING FEE', category: 'Bank Fees',      allocation: 'Shared',   split: true  },
  { matchField: 'description', matchText: 'PAYMENT FROM JACK',     category: 'Savings',        allocation: 'Jack',     split: false },
  { matchField: 'description', matchText: 'PAYMENT FROM COURTNEY', category: 'Savings',        allocation: 'Courtney', split: false },
];

/**
 * Returns true if the transaction matches the given rule.
 */
function matchesRule(tx, rule) {
  // Condition: outflow means amount must be negative
  if (rule.condition === 'outflow' && tx.amount >= 0) {
    return false;
  }

  let text;
  switch (rule.matchField) {
    case 'description': text = tx.bankDesc;    break;
    case 'reference':   text = tx.reference;   break;
    case 'payee':       text = tx.payeeFull;   break;
    default:            return false;
  }

  if (!text) return false;
  return text.toUpperCase().includes(rule.matchText.toUpperCase());
}

/**
 * Applies rules to a single transaction, mutating it in place.
 * Sets category, allocation, and split.
 */
function applyRules(transaction, customRules = []) {
  const tx = transaction;

  // Priority 1: Built-in rules — first match wins
  for (const rule of BUILT_IN_RULES) {
    if (matchesRule(tx, rule)) {
      tx.category   = rule.category;
      tx.allocation = rule.allocation;
      tx.split      = rule.split;
      return;
    }
  }

  // Priority 1b: Custom rules — same matching logic, first match wins
  for (const rule of customRules) {
    if (matchesRule(tx, rule)) {
      tx.category   = rule.category;
      tx.allocation = rule.allocation;
      tx.split      = rule.split != null ? rule.split : false;
      return;
    }
  }

  // Priority 2: Payee name fallback (allocation only, no category set)
  if (tx.payeeFull === 'JACK HAYDEN MORALES') {
    tx.allocation = 'Jack';
  } else if (tx.payeeFull === 'COURTNEY GRACE HURWORTH') {
    tx.allocation = 'Courtney';
  }

  // Priority 3: CSV user note as category hint
  if (!tx.category && tx.notes && tx.notes.trim() !== '') {
    tx.category = tx.notes.trim();
  }

  // Default: Uncategorised
  if (!tx.category) {
    tx.category = 'Uncategorised';
  }
}

/**
 * For each transaction that has no category or is "Uncategorised",
 * resets category/allocation/split to defaults, then calls applyRules.
 */
function applyAllRules(transactions, customRules = []) {
  for (const tx of transactions) {
    if (!tx.category || tx.category === 'Uncategorised') {
      tx.category   = '';
      tx.allocation = '';
      tx.split      = false;
      applyRules(tx, customRules);
    }
  }
}

export { applyRules, applyAllRules };
