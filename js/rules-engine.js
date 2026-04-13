// rules-engine.js
// Auto-categorises and allocates transactions based on built-in and custom rules.

// Map CSV user notes (lowercase) → category
const NOTE_TO_CATEGORY = {
  // Food & Groceries
  'woolies':                'Food',
  'woolworths':             'Food',
  'woolies order':          'Food',
  'woolies and bunnings':   'Food',
  'food':                   'Food',
  'food petrol':            'Food',
  'cheese':                 'Food',
  'dog food':               'Food',
  'italian takeaway':       'Food',
  'internet + food':        'Food',
  'massage and food shop':  'Food',
  'lunch':                  'Food',
  'dinner':                 'Food',
  'dinner stonecutters':    'Food',
  'coffee metro':           'Food',
  // Fuel & Transport
  'fuel':                   'Fuel',
  'bunnings and fuel':      'Fuel',
  'petrol  and tolls':      'Fuel',
  'tolls':                  'Fuel',
  'tyre':                   'Fuel',
  // Shopping
  'shopping':               'Shopping',
  'amazon':                 'Shopping',
  'jm amazon':              'Shopping',
  'amazon - cameras':       'Shopping',
  'bunnings':               'Shopping',
  'bunnings and chemist':   'Shopping',
  'security cameras':       'Shopping',
  'cameras':                'Shopping',
  'dog lounge covers':      'Shopping',
  'ecoy bed sheets':        'Shopping',
  'remainder of bed':       'Shopping',
  'golf clothes':           'Shopping',
  'car battery':            'Shopping',
  'last paypal monitor':    'Shopping',
  'paypal':                 'Shopping',
  'after pay':              'Shopping',
  // Health
  'allergist':              'Health',
  'physio':                 'Health',
  'knee':                   'Health',
  'haircut':                'Health',
  // Internet & Bills
  'optus':                  'Utilities',
  'internet bill + unifi ap': 'Utilities',
  // Gifts & Social
  'mum and dad':            'Gifts',
  'mum birthday':           'Gifts',
  'bee birthday':           'Gifts',
  'birthday payments':      'Gifts',
  'milan present':          'Gifts',
  'milan and bank top up':  'Gifts',
  'bianca bday dinner and drinks': 'Gifts',
  '2x golf lessons':        'Gifts',
  // Income (already caught by rules, but just in case)
  'savings':                'Income',
};

const BUILT_IN_RULES = [
  { matchField: 'reference',   matchText: 'TEN01732',              category: 'Parkside Rent',  allocation: 'Shared',   split: true  },
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
  { matchField: 'description', matchText: 'PAYMENT FROM JACK',     category: 'Income',         allocation: 'Jack',     split: false },
  { matchField: 'description', matchText: 'PAYMENT FROM COURTNEY', category: 'Income',         allocation: 'Courtney', split: false },
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

  // Priority 3: Map known CSV notes to categories
  if (!tx.category && tx.notes) {
    const note = tx.notes.trim().toLowerCase();
    const mapped = NOTE_TO_CATEGORY[note];
    if (mapped) {
      tx.category = mapped;
    }
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
