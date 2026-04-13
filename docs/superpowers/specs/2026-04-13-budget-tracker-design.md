# C&J Budget Tracker — Design Spec

## Overview

A lightweight, client-side budget tracker dashboard for Jack and Courtney to manage their shared ANZ offset account. The app lets them upload bank CSVs, categorise transactions, allocate expenses between them, track individual and combined savings, and export everything to a master Excel workbook.

Built as a static single-page app (HTML/CSS/JS) with no backend. Data persists via an Excel workbook stored in cloud storage (Google Drive, iCloud, etc.) and uploaded/downloaded each session.

## Architecture

### Data Layer Separation

All data read/write operations go through a `DataStore` module that abstracts the underlying storage. The initial implementation uses an in-memory store populated from Excel upload and flushed on Excel export. This module exposes a clean interface (`loadWorkbook`, `saveWorkbook`, `getTransactions`, `upsertTransaction`, `getRules`, `getSavings`, etc.) so a future Google Sheets API backend can be swapped in without touching the UI code.

### Tech Stack

- **Vanilla HTML/CSS/JS** — no framework
- **SheetJS (xlsx)** — read/write Excel files in-browser (CDN)
- **Chart.js** — donut and bar charts (CDN)
- Single `index.html` entry point, with JS modules in separate files

### File Structure

```
/Budget Tracker/
├── index.html
├── css/
│   └── styles.css
├── js/
│   ├── app.js            # Router, page switching
│   ├── datastore.js       # Data layer abstraction
│   ├── csv-parser.js      # ANZ CSV parsing
│   ├── excel-io.js        # Master workbook read/write (SheetJS)
│   ├── rules-engine.js    # Auto-categorisation rules
│   ├── dashboard.js       # Dashboard page rendering + charts
│   ├── transactions.js    # Transactions page rendering + editing
│   └── upload.js          # Upload page logic
└── docs/
```

## Pages

### 1. Dashboard

**Layout:** Pastel purple sidebar (left) + light grey main content area.

**Sidebar:**
- Navigation: Dashboard, Transactions, Upload, Export
- Footer: Individual savings (Jack and Courtney balances, secondary prominence)

**Main content (top to bottom):**

1. **Header** — page title, current month, "Upload CSV" quick-action button
2. **Hero card** — Combined Savings (large number, pastel purple gradient background). Jack and Courtney circle avatars with individual amounts shown subtly beside it
3. **Stats row** (3 cards):
   - Income (with J/C breakdown)
   - Shared Expenses (top category names listed)
   - Account Balance (ANZ Offset total)
4. **Bottom row** (2 cards):
   - Spending by Category — donut chart (Chart.js) with legend
   - Recent Transactions — last 5-8 transactions with amount and colour coding

**Filters:** Month selector in the header to view any month's data.

### 2. Transactions

**Columns:**
| Column | Source | Editable |
|--------|--------|----------|
| Date | CSV Col 1 (DD/MM/YYYY) | No |
| Bank Description | CSV Col 3 (raw ANZ text) | No |
| Amount | CSV Col 2 | No |
| Notes | CSV Col 8 (pre-filled if present), otherwise user-entered | Yes — click to edit inline |
| Category | Auto-detected by rules engine, or manual dropdown | Yes — dropdown select |
| Allocated To | Auto-detected from CSV Col 4, or manual | Yes — dropdown (Jack / Courtney / Shared) |
| Split | Checkbox | Yes — tick = 50/50 split |

**Behaviour:**
- Rows needing attention (uncategorised or unallocated) are highlighted with a light yellow background
- Filters at the top: Month, Category, Allocation (Jack / Courtney / Shared / All)
- Sorting by date (default: newest first)
- Inline editing — click a Notes cell to type, click a Category/Allocation dropdown to change
- Changes are held in memory until Export

**Split checkbox logic:**
- When ticked: the expense is split 50/50 — half deducted from Jack's savings, half from Courtney's
- When unticked: the full amount is deducted from the allocated person's savings only
- Shared-allocated transactions default to split ticked
- Personal (Jack/Courtney) transactions default to split unticked

### 3. Upload

**Two upload zones:**

1. **Master Workbook** (.xlsx) — loads existing transactions, rules, savings state. Shown prominently on first visit ("Get started by uploading your master workbook, or upload a CSV to start fresh")
2. **ANZ CSV** (.csv) — parses new transactions and appends them

**CSV Parsing (ANZ format):**
- Col 1: Date (DD/MM/YYYY)
- Col 2: Amount (quoted, signed)
- Col 3: Bank description
- Col 4: Payer/Payee full name
- Col 5: Payer/Payee short name
- Col 6: (sparse, ignored)
- Col 7: Reference
- Col 8: User note (if present)
- No header row

**Duplicate detection:** A transaction is a duplicate if date + amount + bank description all match an existing row. Duplicates are skipped on import. Show a count of "X new transactions added, Y duplicates skipped".

**After upload:** Auto-redirect to Transactions page with new transactions highlighted.

### 4. Export

**Generates a master Excel workbook (.xlsx) with these sheets:**

1. **Transactions** — all transaction data with columns: Date, Bank Description, Amount, Notes, Category, Allocated To, Split (Y/N)
2. **Rules** — custom categorisation rules: Match Field (description/reference/payee), Match Text, Category, Allocation, Split Default
3. **Savings** — monthly savings tracker: Month, Jack Opening, Jack Income, Jack Shared Expenses, Jack Personal, Jack Closing, Courtney Opening, Courtney Income, Courtney Shared Expenses, Courtney Personal, Courtney Closing, Combined Closing
4. **Summary** — monthly category totals: Month, then one column per category with total spend

**Filename:** `CJ_Budget_Master_YYYY-MM-DD.xlsx`

## Rules Engine

### Auto-Categorisation

Rules are checked in priority order. First match wins.

**Priority 1 — Reference/Payee specific rules:**

| Match Type | Match Text | Category | Allocation | Split |
|-----------|-----------|----------|------------|-------|
| Reference contains | TEN01732 | Parkside Rent | Shared | Yes |
| Description contains | RAY WHITE | Parkside Rent | Shared | Yes |
| Description contains | RAIN REAL ESTATE | Rental Income | Income | No |
| Description contains | HBF | Insurance | Shared | Yes |
| Description contains | NIB | Insurance | Shared | Yes |
| Description contains | OVER THE HILLS | Childcare | Shared | Yes |
| Description contains | FIRST STEPS | Childcare | Shared | Yes |
| Description contains | COULTERANNANGRVE | Mia Swimming | Shared | Yes |
| Description contains | MORALES COURTNEY GRACE (outflow) | Loan Payment | Shared | Yes |
| Description contains | SYDNEY WATER | Utilities | Shared | Yes |
| Description contains | ENERGYAUSTRALIA | Utilities | Shared | Yes |
| Description contains | ACCOUNT SERVICING FEE | Bank Fees | Shared | Yes |
| Description contains | PAYMENT FROM JACK | Savings | Jack | No |
| Description contains | PAYMENT FROM COURTNEY | Savings | Courtney | No |

**Priority 2 — Payee name fallback (allocation only, no category):**

| Col 4 Value | Allocation |
|------------|------------|
| JACK HAYDEN MORALES | Jack |
| COURTNEY GRACE HURWORTH | Courtney |

**Priority 3 — CSV Col 8 note as category hint:**
If Col 8 has a value (e.g. "Shopping", "Fuel"), use it as the category if no Priority 1 rule matched.

**Custom rules:** Users can create new rules from the Transactions page (e.g. "Description contains AMAZON → Category: Amazon, Allocation: Jack"). Custom rules are stored in the Rules sheet of the master workbook and loaded on next upload. Custom rules are checked after built-in rules.

### Default Categories

Parkside Rent, Rental Income, Insurance, Childcare, Mia Swimming, Loan Payment, Utilities, Bank Fees, Savings, Shopping, Fuel, Uncategorised

Users can create new categories at any time. New categories persist in the Rules sheet.

## Savings Calculation

**Starting state:** A known combined balance and individual balances (configurable, stored in the master workbook). Default from 2026 tab: Combined $76,402.69, Jack $38,076.78, Courtney $38,325.92 as of 1 Jan 2026.

**Per transaction, savings are updated as follows:**

- **Savings income** (Payment J / Payment C): Added to that person's individual savings
- **Shared expense with split ticked**: Half deducted from Jack's savings, half from Courtney's
- **Personal expense (Jack, split unticked)**: Full amount deducted from Jack's savings
- **Personal expense (Courtney, split unticked)**: Full amount deducted from Courtney's savings
- **Rental Income**: Added to combined balance, split 50/50
- **J Remove / C Remove** (personal withdrawals): Deducted from that person's savings — these are money taken out of the offset for personal use

**Combined savings** = Jack's savings + Courtney's savings (always derived, never stored independently).

**Monthly snapshots** are calculated and stored in the Savings sheet for historical tracking.

## Visual Design

### Colour Palette

- **Sidebar:** Pastel purple gradient (`#c4b5fd` → `#a78bfa`)
- **Hero card:** Matching pastel purple gradient
- **Main background:** Light grey (`#f5f6fa`)
- **Cards:** White with subtle shadow
- **Jack accent:** Indigo (`#818cf8`)
- **Courtney accent:** Pink (`#f472b6`)
- **Shared accent:** Purple (`#7c3aed`)
- **Income/positive:** Green (`#16a34a`)
- **Expense/negative:** Red (`#ef4444`)
- **Warning/uncategorised:** Amber (`#d97706`)
- **Typography:** System font stack (`-apple-system, BlinkMacSystemFont, sans-serif`)

### Responsive

The app should work on tablet and desktop. On smaller screens, the sidebar collapses to icons only. Mobile is not a priority but the layout should not break.

## Future Considerations (Not in scope for v1)

- Google Sheets API backend (swap DataStore implementation)
- GitHub Pages hosting
- Real-time collaboration between Jack and Courtney
- Budget targets and alerts
- Recurring transaction templates
