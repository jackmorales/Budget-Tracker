# C&J Budget Tracker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a client-side budget tracker dashboard for Jack and Courtney to upload ANZ bank CSVs, categorise transactions, track savings, and export to an Excel master workbook.

**Architecture:** Single-page vanilla JS app with hash-based routing. Data flows through a `DataStore` abstraction (in-memory, future-swappable to Google Sheets). SheetJS handles Excel I/O, Chart.js renders dashboard charts. All state lives in memory until explicit export.

**Tech Stack:** Vanilla HTML/CSS/JS, SheetJS (xlsx) via CDN, Chart.js via CDN

**Spec:** `docs/superpowers/specs/2026-04-13-budget-tracker-design.md`

**Sample data:** `/Users/valkeen/Downloads/ANZ (15).csv` (160 rows, Jan–Apr 2026, ANZ offset account)

---

## File Structure

```
/Users/valkeen/Budget Tracker/
├── index.html              # Shell: sidebar, page containers, CDN script tags
├── css/
│   └── styles.css          # All styles: sidebar, cards, table, forms, responsive
├── js/
│   ├── app.js              # Hash router, page switching, sidebar active state
│   ├── datastore.js        # In-memory store: transactions[], rules[], savings config
│   ├── csv-parser.js       # Parse ANZ CSV text → transaction objects
│   ├── rules-engine.js     # Apply rules to transactions, manage custom rules
│   ├── savings.js          # Calculate running savings from transactions
│   ├── excel-io.js         # Read/write master workbook (SheetJS)
│   ├── dashboard.js        # Render dashboard page + Chart.js charts
│   ├── transactions.js     # Render transaction table + inline editing
│   └── upload.js           # File upload handlers, duplicate detection, CSV import
└── docs/
```

---

### Task 1: HTML Shell + CSS Foundation

**Files:**
- Create: `/Users/valkeen/Budget Tracker/index.html`
- Create: `/Users/valkeen/Budget Tracker/css/styles.css`
- Create: `/Users/valkeen/Budget Tracker/js/app.js`

- [ ] **Step 1: Create index.html with sidebar and page containers**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>C&J Budget Tracker</title>
  <link rel="stylesheet" href="css/styles.css">
  <script src="https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.7/dist/chart.umd.min.js"></script>
</head>
<body>
  <div class="app">
    <aside class="sidebar">
      <div class="sidebar-brand">C&J Budget</div>
      <nav class="sidebar-nav">
        <a href="#dashboard" class="nav-link active" data-page="dashboard">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
          <span>Dashboard</span>
        </a>
        <a href="#transactions" class="nav-link" data-page="transactions">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
          <span>Transactions</span>
        </a>
        <a href="#upload" class="nav-link" data-page="upload">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          <span>Upload</span>
        </a>
        <a href="#export" class="nav-link" data-page="export">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          <span>Export</span>
        </a>
      </nav>
      <div class="sidebar-footer">
        <div class="sidebar-savings">
          <div class="savings-label">Individual Savings</div>
          <div class="savings-row">
            <div class="savings-person">
              <span class="savings-name">Jack</span>
              <span class="savings-amount jack" id="sidebar-jack-savings">$0</span>
            </div>
            <div class="savings-person">
              <span class="savings-name">Courtney</span>
              <span class="savings-amount courtney" id="sidebar-courtney-savings">$0</span>
            </div>
          </div>
        </div>
      </div>
    </aside>
    <main class="main-content">
      <div id="page-dashboard" class="page"></div>
      <div id="page-transactions" class="page" style="display:none"></div>
      <div id="page-upload" class="page" style="display:none"></div>
      <div id="page-export" class="page" style="display:none"></div>
    </main>
  </div>
  <script type="module" src="js/app.js"></script>
</body>
</html>
```

- [ ] **Step 2: Create css/styles.css with full styling**

```css
/* === Reset & Base === */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  background: #f5f6fa;
  color: #1e293b;
  min-height: 100vh;
}

/* === App Layout === */
.app { display: flex; min-height: 100vh; }

/* === Sidebar === */
.sidebar {
  width: 220px;
  background: linear-gradient(180deg, #c4b5fd, #a78bfa);
  color: white;
  padding: 24px 16px;
  display: flex;
  flex-direction: column;
  position: fixed;
  top: 0;
  left: 0;
  bottom: 0;
  z-index: 10;
}
.sidebar-brand {
  font-size: 18px;
  font-weight: 700;
  margin-bottom: 24px;
  letter-spacing: -0.5px;
}
.sidebar-nav { display: flex; flex-direction: column; gap: 4px; }
.nav-link {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border-radius: 8px;
  color: rgba(255,255,255,0.75);
  text-decoration: none;
  font-size: 13px;
  transition: background 0.15s, color 0.15s;
}
.nav-link:hover { background: rgba(255,255,255,0.15); color: white; }
.nav-link.active { background: rgba(255,255,255,0.3); color: white; font-weight: 600; }
.sidebar-footer { margin-top: auto; }
.sidebar-savings {
  background: rgba(255,255,255,0.15);
  border-radius: 10px;
  padding: 14px;
}
.savings-label {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: rgba(255,255,255,0.7);
  margin-bottom: 10px;
}
.savings-row { display: flex; justify-content: space-between; }
.savings-person { text-align: center; }
.savings-name { display: block; font-size: 10px; color: rgba(255,255,255,0.7); }
.savings-amount { display: block; font-size: 15px; font-weight: 700; margin-top: 2px; }

/* === Main Content === */
.main-content {
  flex: 1;
  margin-left: 220px;
  padding: 24px 28px;
  min-height: 100vh;
}
.page { max-width: 1100px; }

/* === Page Header === */
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}
.page-title { font-size: 20px; font-weight: 700; }
.page-subtitle { font-size: 12px; color: #94a3b8; margin-top: 2px; }

/* === Buttons === */
.btn {
  padding: 8px 18px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 600;
  border: none;
  cursor: pointer;
  transition: opacity 0.15s;
}
.btn:hover { opacity: 0.85; }
.btn-primary { background: #a78bfa; color: white; }
.btn-outline { background: white; color: #64748b; border: 1px solid #e2e8f0; }

/* === Hero Card === */
.hero-card {
  background: linear-gradient(135deg, #c4b5fd, #a78bfa);
  border-radius: 14px;
  padding: 22px 24px;
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: white;
}
.hero-label {
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  opacity: 0.8;
}
.hero-amount { font-size: 32px; font-weight: 800; margin-top: 4px; }
.hero-change { font-size: 12px; opacity: 0.85; margin-top: 6px; }
.hero-avatars { display: flex; gap: 16px; }
.hero-avatar {
  text-align: center;
}
.hero-avatar-circle {
  width: 42px;
  height: 42px;
  border-radius: 50%;
  background: rgba(255,255,255,0.25);
  border: 2px solid white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  font-weight: 700;
}
.hero-avatar-amount {
  font-size: 10px;
  opacity: 0.8;
  margin-top: 4px;
}

/* === Stats Row === */
.stats-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  margin-bottom: 16px;
}
.stat-card {
  background: white;
  border-radius: 12px;
  padding: 16px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06);
}
.stat-label {
  font-size: 11px;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}
.stat-value { font-size: 20px; font-weight: 700; margin-top: 4px; }
.stat-detail { font-size: 11px; margin-top: 4px; }
.stat-detail.purple { color: #a78bfa; }
.stat-detail.red { color: #ef4444; }
.stat-detail.muted { color: #94a3b8; }

/* === Bottom Row (charts + recent) === */
.bottom-row {
  display: grid;
  grid-template-columns: 1fr 1.3fr;
  gap: 12px;
}
.card {
  background: white;
  border-radius: 12px;
  padding: 18px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06);
}
.card-title {
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 12px;
}

/* === Chart === */
.chart-container {
  display: flex;
  align-items: center;
  gap: 16px;
}
.chart-canvas-wrap { width: 120px; height: 120px; flex-shrink: 0; }
.chart-legend { font-size: 11px; color: #64748b; line-height: 2; }
.chart-legend-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-right: 6px;
}

/* === Recent Transactions List === */
.recent-list { list-style: none; }
.recent-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid #f1f5f9;
  font-size: 12px;
}
.recent-item:last-child { border-bottom: none; }
.recent-desc { color: #475569; }
.recent-amount { font-weight: 600; }
.recent-amount.income { color: #16a34a; }
.recent-amount.expense { color: #ef4444; }

/* === Transaction Table === */
.filters-row {
  display: flex;
  gap: 8px;
  margin-bottom: 14px;
}
.filter-select {
  padding: 6px 12px;
  border-radius: 6px;
  border: 1px solid #e2e8f0;
  font-size: 11px;
  color: #64748b;
  background: white;
}
.tx-table {
  width: 100%;
  background: white;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06);
  border-collapse: collapse;
  overflow: hidden;
}
.tx-table thead th {
  background: #f8fafc;
  padding: 10px 12px;
  font-size: 10px;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  font-weight: 600;
  text-align: left;
  border-bottom: 1px solid #e2e8f0;
}
.tx-table thead th.text-right { text-align: right; }
.tx-table thead th.text-center { text-align: center; }
.tx-table tbody td {
  padding: 10px 12px;
  font-size: 11px;
  border-bottom: 1px solid #f1f5f9;
  vertical-align: middle;
}
.tx-table tbody tr:last-child td { border-bottom: none; }
.tx-table tbody tr.needs-attention { background: #fffdf7; }
.tx-table .col-date { width: 70px; color: #64748b; }
.tx-table .col-desc {
  max-width: 250px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.tx-table .col-amount { width: 80px; text-align: right; font-weight: 600; }
.tx-table .col-amount.income { color: #16a34a; }
.tx-table .col-amount.expense { color: #ef4444; }
.tx-table .col-notes { width: 130px; }
.tx-table .col-category { width: 120px; text-align: center; }
.tx-table .col-allocation { width: 90px; text-align: center; }
.tx-table .col-split { width: 50px; text-align: center; }

/* === Pills === */
.pill {
  display: inline-block;
  padding: 3px 10px;
  border-radius: 12px;
  font-size: 10px;
  font-weight: 500;
}
.pill-jack { background: #eef2ff; color: #818cf8; }
.pill-courtney { background: #fdf2f8; color: #ec4899; }
.pill-shared { background: #f5f3ff; color: #7c3aed; }
.pill-income { background: #f0fdf4; color: #16a34a; }
.pill-rent { background: #fef2f2; color: #dc2626; }
.pill-insurance { background: #eff6ff; color: #3b82f6; }
.pill-childcare { background: #f0fdf4; color: #16a34a; }
.pill-utilities { background: #fefce8; color: #ca8a04; }
.pill-fuel { background: #fef9c3; color: #ca8a04; }
.pill-shopping { background: #fef3c7; color: #d97706; }
.pill-bank-fees { background: #f1f5f9; color: #64748b; }
.pill-uncategorised { background: #fffbeb; color: #d97706; border: 1px dashed #fde68a; }
.pill-savings { background: #f0fdf4; color: #16a34a; }
.pill-default { background: #f1f5f9; color: #64748b; }

/* === Inline Edit === */
.notes-input {
  width: 100%;
  padding: 4px 8px;
  border: 1px solid #e2e8f0;
  border-radius: 5px;
  font-size: 10px;
  font-family: inherit;
  color: #1e293b;
  background: #fafafa;
}
.notes-input:focus { outline: none; border-color: #a78bfa; background: white; }
.notes-placeholder {
  color: #a1a1aa;
  font-style: italic;
  font-size: 10px;
  cursor: pointer;
  padding: 4px 8px;
  border: 1px dashed #d4d4d8;
  border-radius: 5px;
}
.category-select, .allocation-select {
  padding: 3px 6px;
  border-radius: 6px;
  border: 1px solid #e2e8f0;
  font-size: 10px;
  color: #64748b;
  background: white;
  cursor: pointer;
}
.category-select.needs-input {
  border-color: #fde68a;
  background: #fffbeb;
  color: #d97706;
}
.split-checkbox {
  width: 16px;
  height: 16px;
  accent-color: #a78bfa;
  cursor: pointer;
}

/* === Upload Page === */
.upload-zones {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  margin-top: 16px;
}
.upload-zone {
  background: white;
  border: 2px dashed #d4d4d8;
  border-radius: 14px;
  padding: 40px 24px;
  text-align: center;
  cursor: pointer;
  transition: border-color 0.2s, background 0.2s;
}
.upload-zone:hover { border-color: #a78bfa; background: #faf5ff; }
.upload-zone.drag-over { border-color: #a78bfa; background: #f5f3ff; }
.upload-icon { font-size: 36px; margin-bottom: 12px; opacity: 0.6; }
.upload-title { font-size: 14px; font-weight: 600; margin-bottom: 6px; }
.upload-desc { font-size: 12px; color: #94a3b8; }
.upload-result {
  margin-top: 16px;
  padding: 14px 18px;
  border-radius: 10px;
  font-size: 13px;
}
.upload-result.success { background: #f0fdf4; color: #16a34a; }
.upload-result.error { background: #fef2f2; color: #dc2626; }

/* === Export Page === */
.export-card {
  background: white;
  border-radius: 14px;
  padding: 32px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06);
  max-width: 500px;
  text-align: center;
}
.export-icon { font-size: 48px; margin-bottom: 16px; }
.export-summary { font-size: 13px; color: #64748b; margin: 16px 0 24px; line-height: 1.8; }

/* === Toast notification === */
.toast {
  position: fixed;
  bottom: 24px;
  right: 24px;
  background: #1e293b;
  color: white;
  padding: 12px 20px;
  border-radius: 10px;
  font-size: 13px;
  z-index: 100;
  opacity: 0;
  transform: translateY(10px);
  transition: opacity 0.3s, transform 0.3s;
}
.toast.show { opacity: 1; transform: translateY(0); }

/* === Rules Modal === */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 50;
}
.modal {
  background: white;
  border-radius: 14px;
  padding: 28px;
  width: 460px;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: 0 20px 60px rgba(0,0,0,0.15);
}
.modal-title { font-size: 16px; font-weight: 700; margin-bottom: 16px; }
.modal-field { margin-bottom: 14px; }
.modal-field label {
  display: block;
  font-size: 11px;
  color: #64748b;
  margin-bottom: 4px;
  font-weight: 500;
}
.modal-field input, .modal-field select {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 12px;
  font-family: inherit;
}
.modal-actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 20px; }

/* === Responsive === */
@media (max-width: 900px) {
  .sidebar { width: 60px; padding: 16px 8px; }
  .sidebar-brand { font-size: 0; }
  .sidebar-brand::first-letter { font-size: 18px; }
  .nav-link span { display: none; }
  .nav-link { justify-content: center; padding: 10px; }
  .sidebar-savings { display: none; }
  .main-content { margin-left: 60px; padding: 16px; }
  .stats-row { grid-template-columns: 1fr; }
  .bottom-row { grid-template-columns: 1fr; }
  .upload-zones { grid-template-columns: 1fr; }
}
```

- [ ] **Step 3: Create js/app.js with hash router**

```js
import { renderDashboard } from './dashboard.js';
import { renderTransactions } from './transactions.js';
import { renderUpload } from './upload.js';
import { renderExport } from './export.js';
import { dataStore } from './datastore.js';

const pages = { dashboard: renderDashboard, transactions: renderTransactions, upload: renderUpload, export: renderExport };

function navigate() {
  const hash = (location.hash || '#dashboard').slice(1);
  const page = pages[hash] ? hash : 'dashboard';

  document.querySelectorAll('.page').forEach(p => p.style.display = 'none');
  document.getElementById(`page-${page}`).style.display = '';

  document.querySelectorAll('.nav-link').forEach(a => {
    a.classList.toggle('active', a.dataset.page === page);
  });

  pages[page](document.getElementById(`page-${page}`), dataStore);
}

export function showToast(message) {
  let toast = document.querySelector('.toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
}

export function updateSidebarSavings() {
  const savings = dataStore.getSavingsState();
  document.getElementById('sidebar-jack-savings').textContent = formatCurrency(savings.jack);
  document.getElementById('sidebar-courtney-savings').textContent = formatCurrency(savings.courtney);
}

export function formatCurrency(n) {
  const abs = Math.abs(n);
  const formatted = '$' + abs.toLocaleString('en-AU', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  return n < 0 ? '-' + formatted : formatted;
}

export function formatCurrencyFull(n) {
  const abs = Math.abs(n);
  const formatted = '$' + abs.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return n < 0 ? '-' + formatted : formatted;
}

window.addEventListener('hashchange', navigate);
window.addEventListener('DOMContentLoaded', navigate);
```

- [ ] **Step 4: Verify the shell renders**

Open `/Users/valkeen/Budget Tracker/index.html` in a browser. Confirm: purple sidebar with 4 nav links, grey main area, sidebar savings footer. Click nav links and verify hash changes and page containers toggle.

- [ ] **Step 5: Commit**

```bash
cd "/Users/valkeen/Budget Tracker"
git add index.html css/styles.css js/app.js
git commit -m "feat: add HTML shell, CSS styles, and hash router"
```

---

### Task 2: DataStore Module

**Files:**
- Create: `/Users/valkeen/Budget Tracker/js/datastore.js`

- [ ] **Step 1: Create js/datastore.js**

```js
class DataStore {
  constructor() {
    this.transactions = [];
    this.customRules = [];
    this.categories = [
      'Parkside Rent', 'Rental Income', 'Insurance', 'Childcare',
      'Mia Swimming', 'Loan Payment', 'Utilities', 'Bank Fees',
      'Savings', 'Shopping', 'Fuel', 'Uncategorised'
    ];
    this.savingsConfig = {
      startDate: '2026-01-01',
      jackOpening: 38076.78,
      courtneyOpening: 38325.92,
    };
  }

  getTransactions() { return this.transactions; }

  addTransactions(newTxns) {
    let added = 0, skipped = 0;
    for (const tx of newTxns) {
      if (this._isDuplicate(tx)) {
        skipped++;
      } else {
        this.transactions.push(tx);
        added++;
      }
    }
    this.transactions.sort((a, b) => b.date - a.date);
    return { added, skipped };
  }

  _isDuplicate(tx) {
    return this.transactions.some(existing =>
      existing.date.getTime() === tx.date.getTime() &&
      existing.amount === tx.amount &&
      existing.bankDesc === tx.bankDesc
    );
  }

  updateTransaction(index, updates) {
    const tx = this.transactions[index];
    if (tx) Object.assign(tx, updates);
  }

  getCategories() { return [...this.categories]; }

  addCategory(name) {
    if (!this.categories.includes(name)) {
      this.categories.push(name);
    }
  }

  getCustomRules() { return this.customRules; }

  addCustomRule(rule) {
    this.customRules.push(rule);
  }

  removeCustomRule(index) {
    this.customRules.splice(index, 1);
  }

  getSavingsConfig() { return { ...this.savingsConfig }; }

  setSavingsConfig(config) {
    Object.assign(this.savingsConfig, config);
  }

  getSavingsState() {
    return calculateSavings(this.transactions, this.savingsConfig);
  }

  clear() {
    this.transactions = [];
    this.customRules = [];
    this.categories = [
      'Parkside Rent', 'Rental Income', 'Insurance', 'Childcare',
      'Mia Swimming', 'Loan Payment', 'Utilities', 'Bank Fees',
      'Savings', 'Shopping', 'Fuel', 'Uncategorised'
    ];
    this.savingsConfig = {
      startDate: '2026-01-01',
      jackOpening: 38076.78,
      courtneyOpening: 38325.92,
    };
  }
}

function calculateSavings(transactions, config) {
  let jack = config.jackOpening;
  let courtney = config.courtneyOpening;

  const sorted = [...transactions].sort((a, b) => a.date - b.date);

  for (const tx of sorted) {
    if (tx.category === 'Savings') {
      if (tx.allocation === 'Jack') jack += tx.amount;
      else if (tx.allocation === 'Courtney') courtney += tx.amount;
      continue;
    }
    if (tx.category === 'Rental Income') {
      jack += tx.amount / 2;
      courtney += tx.amount / 2;
      continue;
    }
    if (tx.amount >= 0) continue;
    const expense = Math.abs(tx.amount);
    if (tx.split) {
      jack -= expense / 2;
      courtney -= expense / 2;
    } else if (tx.allocation === 'Jack') {
      jack -= expense;
    } else if (tx.allocation === 'Courtney') {
      courtney -= expense;
    }
  }

  return { jack: Math.round(jack * 100) / 100, courtney: Math.round(courtney * 100) / 100, combined: Math.round((jack + courtney) * 100) / 100 };
}

export const dataStore = new DataStore();
```

- [ ] **Step 2: Commit**

```bash
cd "/Users/valkeen/Budget Tracker"
git add js/datastore.js
git commit -m "feat: add DataStore module with savings calculation"
```

---

### Task 3: CSV Parser

**Files:**
- Create: `/Users/valkeen/Budget Tracker/js/csv-parser.js`

- [ ] **Step 1: Create js/csv-parser.js**

The ANZ CSV has no header row. Columns: Date, Amount (quoted), Bank Description, Payee Full Name, Payee Short Name, (ignored), Reference, User Note. Amounts are quoted with sign.

```js
export function parseANZCSV(csvText) {
  const lines = csvText.trim().split('\n');
  const transactions = [];

  for (const line of lines) {
    if (!line.trim()) continue;
    const cols = parseCSVLine(line);
    if (cols.length < 3) continue;

    const dateParts = cols[0].split('/');
    const date = new Date(
      parseInt(dateParts[2]),
      parseInt(dateParts[1]) - 1,
      parseInt(dateParts[0])
    );

    const amount = parseFloat(cols[1].replace(/"/g, ''));
    const bankDesc = cols[2] || '';
    const payeeFull = (cols[3] || '').trim();
    const payeeShort = (cols[4] || '').trim();
    const reference = (cols[6] || '').trim();
    const userNote = (cols[7] || '').trim();

    transactions.push({
      date,
      amount,
      bankDesc,
      payeeFull,
      payeeShort,
      reference,
      notes: userNote,
      category: '',
      allocation: '',
      split: false,
    });
  }

  return transactions;
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}
```

- [ ] **Step 2: Commit**

```bash
cd "/Users/valkeen/Budget Tracker"
git add js/csv-parser.js
git commit -m "feat: add ANZ CSV parser"
```

---

### Task 4: Rules Engine

**Files:**
- Create: `/Users/valkeen/Budget Tracker/js/rules-engine.js`

- [ ] **Step 1: Create js/rules-engine.js**

```js
const BUILT_IN_RULES = [
  // Priority 1: Reference/payee-specific rules
  { matchField: 'reference', matchText: 'TEN01732', category: 'Parkside Rent', allocation: 'Shared', split: true },
  { matchField: 'description', matchText: 'RAY WHITE', category: 'Parkside Rent', allocation: 'Shared', split: true },
  { matchField: 'description', matchText: 'RAIN REAL ESTATE', category: 'Rental Income', allocation: 'Income', split: false },
  { matchField: 'description', matchText: 'HBF', category: 'Insurance', allocation: 'Shared', split: true },
  { matchField: 'description', matchText: 'NIB', category: 'Insurance', allocation: 'Shared', split: true },
  { matchField: 'description', matchText: 'OVER THE HILLS', category: 'Childcare', allocation: 'Shared', split: true },
  { matchField: 'description', matchText: 'FIRST STEPS', category: 'Childcare', allocation: 'Shared', split: true },
  { matchField: 'description', matchText: 'COULTERANNANGRVE', category: 'Mia Swimming', allocation: 'Shared', split: true },
  { matchField: 'description', matchText: 'MORALES COURTNEY GRACE', category: 'Loan Payment', allocation: 'Shared', split: true, condition: 'outflow' },
  { matchField: 'description', matchText: 'SYDNEY WATER', category: 'Utilities', allocation: 'Shared', split: true },
  { matchField: 'description', matchText: 'ENERGYAUSTRALIA', category: 'Utilities', allocation: 'Shared', split: true },
  { matchField: 'description', matchText: 'ACCOUNT SERVICING FEE', category: 'Bank Fees', allocation: 'Shared', split: true },
  { matchField: 'description', matchText: 'PAYMENT FROM JACK', category: 'Savings', allocation: 'Jack', split: false },
  { matchField: 'description', matchText: 'PAYMENT FROM COURTNEY', category: 'Savings', allocation: 'Courtney', split: false },
];

export function applyRules(transaction, customRules) {
  // Priority 1: Built-in rules
  for (const rule of BUILT_IN_RULES) {
    if (matchesRule(transaction, rule)) {
      transaction.category = rule.category;
      transaction.allocation = rule.allocation;
      transaction.split = rule.split;
      return;
    }
  }

  // Priority 1b: Custom rules (same logic, checked after built-in)
  for (const rule of customRules) {
    if (matchesRule(transaction, rule)) {
      transaction.category = rule.category;
      if (rule.allocation) transaction.allocation = rule.allocation;
      if (rule.split !== undefined) transaction.split = rule.split;
      return;
    }
  }

  // Priority 2: Payee name fallback (allocation only)
  if (transaction.payeeFull === 'JACK HAYDEN MORALES') {
    transaction.allocation = 'Jack';
  } else if (transaction.payeeFull === 'COURTNEY GRACE HURWORTH') {
    transaction.allocation = 'Courtney';
  }

  // Priority 3: CSV user note as category hint
  if (!transaction.category && transaction.notes) {
    transaction.category = transaction.notes;
  }

  // Default
  if (!transaction.category) transaction.category = 'Uncategorised';
  if (!transaction.allocation) transaction.allocation = '';
}

function matchesRule(tx, rule) {
  if (rule.condition === 'outflow' && tx.amount >= 0) return false;

  let text = '';
  if (rule.matchField === 'description') text = tx.bankDesc.toUpperCase();
  else if (rule.matchField === 'reference') text = tx.reference.toUpperCase();
  else if (rule.matchField === 'payee') text = tx.payeeFull.toUpperCase();

  return text.includes(rule.matchText.toUpperCase());
}

export function applyAllRules(transactions, customRules) {
  for (const tx of transactions) {
    if (!tx.category || tx.category === 'Uncategorised') {
      // Reset before re-applying
      tx.category = '';
      tx.allocation = '';
      tx.split = false;
      applyRules(tx, customRules);
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
cd "/Users/valkeen/Budget Tracker"
git add js/rules-engine.js
git commit -m "feat: add rules engine with built-in and custom rule support"
```

---

### Task 5: Excel I/O (SheetJS)

**Files:**
- Create: `/Users/valkeen/Budget Tracker/js/excel-io.js`

- [ ] **Step 1: Create js/excel-io.js**

```js
import { dataStore } from './datastore.js';
import { applyAllRules } from './rules-engine.js';

export function readMasterWorkbook(arrayBuffer) {
  const wb = XLSX.read(arrayBuffer, { type: 'array', cellDates: true });

  // Read Transactions sheet
  if (wb.SheetNames.includes('Transactions')) {
    const ws = wb.Sheets['Transactions'];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, dateNF: 'dd/mm/yyyy' });
    const transactions = [];

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || !row[0]) continue;

      const dateParts = String(row[0]).split('/');
      let date;
      if (dateParts.length === 3) {
        date = new Date(parseInt(dateParts[2]), parseInt(dateParts[1]) - 1, parseInt(dateParts[0]));
      } else {
        date = new Date(row[0]);
      }

      transactions.push({
        date,
        bankDesc: row[1] || '',
        amount: parseFloat(row[2]) || 0,
        notes: row[3] || '',
        category: row[4] || '',
        allocation: row[5] || '',
        split: row[6] === 'Y',
        payeeFull: row[7] || '',
        payeeShort: row[8] || '',
        reference: row[9] || '',
      });
    }
    dataStore.addTransactions(transactions);
  }

  // Read Rules sheet
  if (wb.SheetNames.includes('Rules')) {
    const ws = wb.Sheets['Rules'];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || !row[0]) continue;
      dataStore.addCustomRule({
        matchField: row[0],
        matchText: row[1] || '',
        category: row[2] || '',
        allocation: row[3] || '',
        split: row[4] === 'Y',
      });
    }
  }

  // Read Categories sheet (if present, for custom categories)
  if (wb.SheetNames.includes('Categories')) {
    const ws = wb.Sheets['Categories'];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
    for (let i = 1; i < rows.length; i++) {
      if (rows[i] && rows[i][0]) dataStore.addCategory(rows[i][0]);
    }
  }

  // Read Savings config
  if (wb.SheetNames.includes('Savings')) {
    const ws = wb.Sheets['Savings'];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
    if (rows.length > 1 && rows[1]) {
      dataStore.setSavingsConfig({
        startDate: rows[1][0] || '2026-01-01',
        jackOpening: parseFloat(rows[1][1]) || 0,
        courtneyOpening: parseFloat(rows[1][2]) || 0,
      });
    }
  }
}

export function writeMasterWorkbook() {
  const wb = XLSX.utils.book_new();

  // Transactions sheet
  const txHeader = ['Date', 'Bank Description', 'Amount', 'Notes', 'Category', 'Allocated To', 'Split', 'Payee Full', 'Payee Short', 'Reference'];
  const txRows = dataStore.getTransactions().map(tx => [
    formatDate(tx.date),
    tx.bankDesc,
    tx.amount,
    tx.notes,
    tx.category,
    tx.allocation,
    tx.split ? 'Y' : 'N',
    tx.payeeFull || '',
    tx.payeeShort || '',
    tx.reference || '',
  ]);
  const txSheet = XLSX.utils.aoa_to_sheet([txHeader, ...txRows]);
  setColWidths(txSheet, [12, 50, 12, 20, 16, 14, 6, 24, 20, 20]);
  XLSX.utils.book_append_sheet(wb, txSheet, 'Transactions');

  // Rules sheet
  const rulesHeader = ['Match Field', 'Match Text', 'Category', 'Allocation', 'Split Default'];
  const rulesRows = dataStore.getCustomRules().map(r => [
    r.matchField, r.matchText, r.category, r.allocation || '', r.split ? 'Y' : 'N'
  ]);
  const rulesSheet = XLSX.utils.aoa_to_sheet([rulesHeader, ...rulesRows]);
  XLSX.utils.book_append_sheet(wb, rulesSheet, 'Rules');

  // Categories sheet
  const catHeader = ['Category'];
  const catRows = dataStore.getCategories().map(c => [c]);
  const catSheet = XLSX.utils.aoa_to_sheet([catHeader, ...catRows]);
  XLSX.utils.book_append_sheet(wb, catSheet, 'Categories');

  // Savings sheet
  const savingsConfig = dataStore.getSavingsConfig();
  const savingsHeader = ['Start Date', 'Jack Opening', 'Courtney Opening'];
  const savingsSheet = XLSX.utils.aoa_to_sheet([
    savingsHeader,
    [savingsConfig.startDate, savingsConfig.jackOpening, savingsConfig.courtneyOpening]
  ]);

  // Add monthly snapshots
  const snapshots = calculateMonthlySnapshots();
  const snapHeader = ['Month', 'Jack Opening', 'Jack Income', 'Jack Shared', 'Jack Personal', 'Jack Closing', 'Courtney Opening', 'Courtney Income', 'Courtney Shared', 'Courtney Personal', 'Courtney Closing', 'Combined'];
  const snapRows = snapshots.map(s => [
    s.month, s.jackOpening, s.jackIncome, s.jackShared, s.jackPersonal, s.jackClosing,
    s.courtneyOpening, s.courtneyIncome, s.courtneyShared, s.courtneyPersonal, s.courtneyClosing,
    s.combined
  ]);
  XLSX.utils.sheet_add_aoa(savingsSheet, [[]], { origin: -1 });
  XLSX.utils.sheet_add_aoa(savingsSheet, [snapHeader, ...snapRows], { origin: -1 });
  XLSX.utils.book_append_sheet(wb, savingsSheet, 'Savings');

  // Summary sheet (monthly category totals)
  const summary = calculateMonthlySummary();
  const summarySheet = XLSX.utils.aoa_to_sheet(summary);
  XLSX.utils.book_append_sheet(wb, summarySheet, 'Summary');

  // Download
  const today = new Date();
  const filename = `CJ_Budget_Master_${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}.xlsx`;
  XLSX.writeFile(wb, filename);
  return filename;
}

function calculateMonthlySnapshots() {
  const config = dataStore.getSavingsConfig();
  const transactions = [...dataStore.getTransactions()].sort((a, b) => a.date - b.date);
  if (transactions.length === 0) return [];

  const months = {};
  for (const tx of transactions) {
    const key = `${tx.date.getFullYear()}-${String(tx.date.getMonth()+1).padStart(2,'0')}`;
    if (!months[key]) months[key] = [];
    months[key].push(tx);
  }

  const snapshots = [];
  let jackBal = config.jackOpening;
  let courtneyBal = config.courtneyOpening;

  for (const month of Object.keys(months).sort()) {
    const txns = months[month];
    const snap = {
      month,
      jackOpening: round2(jackBal),
      jackIncome: 0, jackShared: 0, jackPersonal: 0,
      courtneyOpening: round2(courtneyBal),
      courtneyIncome: 0, courtneyShared: 0, courtneyPersonal: 0,
    };

    for (const tx of txns) {
      if (tx.category === 'Savings') {
        if (tx.allocation === 'Jack') { jackBal += tx.amount; snap.jackIncome += tx.amount; }
        else if (tx.allocation === 'Courtney') { courtneyBal += tx.amount; snap.courtneyIncome += tx.amount; }
        continue;
      }
      if (tx.category === 'Rental Income') {
        jackBal += tx.amount / 2; courtneyBal += tx.amount / 2;
        snap.jackIncome += tx.amount / 2; snap.courtneyIncome += tx.amount / 2;
        continue;
      }
      if (tx.amount >= 0) continue;
      const expense = Math.abs(tx.amount);
      if (tx.split) {
        jackBal -= expense / 2; courtneyBal -= expense / 2;
        snap.jackShared += expense / 2; snap.courtneyShared += expense / 2;
      } else if (tx.allocation === 'Jack') {
        jackBal -= expense; snap.jackPersonal += expense;
      } else if (tx.allocation === 'Courtney') {
        courtneyBal -= expense; snap.courtneyPersonal += expense;
      }
    }

    snap.jackClosing = round2(jackBal);
    snap.courtneyClosing = round2(courtneyBal);
    snap.combined = round2(jackBal + courtneyBal);
    snap.jackIncome = round2(snap.jackIncome);
    snap.jackShared = round2(snap.jackShared);
    snap.jackPersonal = round2(snap.jackPersonal);
    snap.courtneyIncome = round2(snap.courtneyIncome);
    snap.courtneyShared = round2(snap.courtneyShared);
    snap.courtneyPersonal = round2(snap.courtneyPersonal);
    snapshots.push(snap);
  }

  return snapshots;
}

function calculateMonthlySummary() {
  const transactions = dataStore.getTransactions();
  const categories = dataStore.getCategories().filter(c => c !== 'Uncategorised' && c !== 'Savings');
  const months = {};

  for (const tx of transactions) {
    if (tx.amount >= 0) continue;
    const key = `${tx.date.getFullYear()}-${String(tx.date.getMonth()+1).padStart(2,'0')}`;
    if (!months[key]) months[key] = {};
    const cat = tx.category || 'Uncategorised';
    months[key][cat] = (months[key][cat] || 0) + Math.abs(tx.amount);
  }

  const allCats = [...new Set([...categories, ...Object.values(months).flatMap(m => Object.keys(m))])];
  const header = ['Month', ...allCats];
  const rows = Object.keys(months).sort().map(month => {
    return [month, ...allCats.map(cat => round2(months[month][cat] || 0))];
  });

  return [header, ...rows];
}

function formatDate(d) {
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
}

function setColWidths(ws, widths) {
  ws['!cols'] = widths.map(w => ({ wch: w }));
}

function round2(n) { return Math.round(n * 100) / 100; }
```

- [ ] **Step 2: Commit**

```bash
cd "/Users/valkeen/Budget Tracker"
git add js/excel-io.js
git commit -m "feat: add Excel I/O with master workbook read/write"
```

---

### Task 6: Upload Page

**Files:**
- Create: `/Users/valkeen/Budget Tracker/js/upload.js`

- [ ] **Step 1: Create js/upload.js**

```js
import { dataStore } from './datastore.js';
import { parseANZCSV } from './csv-parser.js';
import { readMasterWorkbook } from './excel-io.js';
import { applyAllRules } from './rules-engine.js';
import { showToast } from './app.js';

export function renderUpload(container, store) {
  container.innerHTML = `
    <div class="page-header">
      <div>
        <div class="page-title">Upload</div>
        <div class="page-subtitle">Import your master workbook or new bank transactions</div>
      </div>
    </div>
    <div class="upload-zones">
      <div class="upload-zone" id="zone-xlsx">
        <div class="upload-icon">📊</div>
        <div class="upload-title">Master Workbook</div>
        <div class="upload-desc">Upload your existing .xlsx master file to load transactions, rules, and savings</div>
        <input type="file" accept=".xlsx,.xls" style="display:none" id="file-xlsx">
      </div>
      <div class="upload-zone" id="zone-csv">
        <div class="upload-icon">📄</div>
        <div class="upload-title">ANZ CSV</div>
        <div class="upload-desc">Upload a new bank statement CSV to import transactions</div>
        <input type="file" accept=".csv" style="display:none" id="file-csv">
      </div>
    </div>
    <div id="upload-result"></div>
  `;

  const zoneXlsx = container.querySelector('#zone-xlsx');
  const zoneCsv = container.querySelector('#zone-csv');
  const fileXlsx = container.querySelector('#file-xlsx');
  const fileCsv = container.querySelector('#file-csv');
  const resultDiv = container.querySelector('#upload-result');

  // Click handlers
  zoneXlsx.addEventListener('click', () => fileXlsx.click());
  zoneCsv.addEventListener('click', () => fileCsv.click());

  // Drag and drop for both zones
  [zoneXlsx, zoneCsv].forEach(zone => {
    zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag-over'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
    zone.addEventListener('drop', e => {
      e.preventDefault();
      zone.classList.remove('drag-over');
      const file = e.dataTransfer.files[0];
      if (!file) return;
      if (zone === zoneXlsx && file.name.match(/\.xlsx?$/i)) handleXlsx(file);
      else if (zone === zoneCsv && file.name.endsWith('.csv')) handleCsv(file);
    });
  });

  fileXlsx.addEventListener('change', () => { if (fileXlsx.files[0]) handleXlsx(fileXlsx.files[0]); });
  fileCsv.addEventListener('change', () => { if (fileCsv.files[0]) handleCsv(fileCsv.files[0]); });

  function handleXlsx(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        dataStore.clear();
        readMasterWorkbook(e.target.result);
        const count = dataStore.getTransactions().length;
        const ruleCount = dataStore.getCustomRules().length;
        resultDiv.innerHTML = `<div class="upload-result success">Loaded master workbook: ${count} transactions, ${ruleCount} custom rules</div>`;
        showToast(`Master workbook loaded — ${count} transactions`);
        import('./app.js').then(m => m.updateSidebarSavings());
      } catch (err) {
        resultDiv.innerHTML = `<div class="upload-result error">Error reading workbook: ${err.message}</div>`;
      }
    };
    reader.readAsArrayBuffer(file);
  }

  function handleCsv(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const transactions = parseANZCSV(e.target.result);
        applyAllRules(transactions, dataStore.getCustomRules());
        const { added, skipped } = dataStore.addTransactions(transactions);
        resultDiv.innerHTML = `<div class="upload-result success">${added} new transactions added, ${skipped} duplicates skipped</div>`;
        showToast(`${added} transactions imported`);
        import('./app.js').then(m => m.updateSidebarSavings());
        // Navigate to transactions after short delay
        setTimeout(() => { location.hash = '#transactions'; }, 1000);
      } catch (err) {
        resultDiv.innerHTML = `<div class="upload-result error">Error parsing CSV: ${err.message}</div>`;
      }
    };
    reader.readAsText(file);
  }
}
```

- [ ] **Step 2: Commit**

```bash
cd "/Users/valkeen/Budget Tracker"
git add js/upload.js
git commit -m "feat: add upload page with CSV import and workbook loading"
```

---

### Task 7: Transactions Page

**Files:**
- Create: `/Users/valkeen/Budget Tracker/js/transactions.js`

- [ ] **Step 1: Create js/transactions.js**

```js
import { dataStore } from './datastore.js';
import { formatCurrencyFull, updateSidebarSavings } from './app.js';

let currentFilters = { month: 'all', category: 'all', allocation: 'all' };

export function renderTransactions(container, store) {
  const transactions = store.getTransactions();
  const categories = store.getCategories();
  const months = getUniqueMonths(transactions);

  container.innerHTML = `
    <div class="page-header">
      <div>
        <div class="page-title">Transactions</div>
        <div class="page-subtitle">${transactions.length} transactions</div>
      </div>
      <div style="display: flex; gap: 8px;">
        <button class="btn btn-outline" id="btn-add-rule">+ Add Rule</button>
      </div>
    </div>
    <div class="filters-row">
      <select class="filter-select" id="filter-month">
        <option value="all">All Months</option>
        ${months.map(m => `<option value="${m}" ${currentFilters.month === m ? 'selected' : ''}>${m}</option>`).join('')}
      </select>
      <select class="filter-select" id="filter-category">
        <option value="all">All Categories</option>
        ${categories.map(c => `<option value="${c}" ${currentFilters.category === c ? 'selected' : ''}>${c}</option>`).join('')}
      </select>
      <select class="filter-select" id="filter-allocation">
        <option value="all">All (J / C / Shared)</option>
        <option value="Jack" ${currentFilters.allocation === 'Jack' ? 'selected' : ''}>Jack</option>
        <option value="Courtney" ${currentFilters.allocation === 'Courtney' ? 'selected' : ''}>Courtney</option>
        <option value="Shared" ${currentFilters.allocation === 'Shared' ? 'selected' : ''}>Shared</option>
        <option value="" ${currentFilters.allocation === '' ? 'selected' : ''}>Unallocated</option>
      </select>
    </div>
    <div id="tx-table-container"></div>
  `;

  renderTable(container, transactions, categories);

  container.querySelector('#filter-month').addEventListener('change', e => {
    currentFilters.month = e.target.value;
    renderTable(container, store.getTransactions(), categories);
  });
  container.querySelector('#filter-category').addEventListener('change', e => {
    currentFilters.category = e.target.value;
    renderTable(container, store.getTransactions(), categories);
  });
  container.querySelector('#filter-allocation').addEventListener('change', e => {
    currentFilters.allocation = e.target.value;
    renderTable(container, store.getTransactions(), categories);
  });
  container.querySelector('#btn-add-rule').addEventListener('click', () => showRuleModal(container, store, categories));
}

function renderTable(container, allTransactions, categories) {
  const filtered = filterTransactions(allTransactions);
  const tableContainer = container.querySelector('#tx-table-container');

  tableContainer.innerHTML = `
    <table class="tx-table">
      <thead>
        <tr>
          <th>Date</th>
          <th>Bank Description</th>
          <th class="text-right">Amount</th>
          <th>Notes</th>
          <th class="text-center">Category</th>
          <th class="text-center">Allocated</th>
          <th class="text-center">Split</th>
        </tr>
      </thead>
      <tbody id="tx-tbody"></tbody>
    </table>
  `;

  const tbody = tableContainer.querySelector('#tx-tbody');
  const allTxns = dataStore.getTransactions();

  for (const tx of filtered) {
    const globalIndex = allTxns.indexOf(tx);
    const needsAttention = tx.category === 'Uncategorised' || !tx.allocation;
    const tr = document.createElement('tr');
    if (needsAttention) tr.className = 'needs-attention';

    const isIncome = tx.amount >= 0;

    tr.innerHTML = `
      <td class="col-date">${formatDateShort(tx.date)}</td>
      <td class="col-desc" title="${escapeHtml(tx.bankDesc)}">${escapeHtml(tx.bankDesc)}</td>
      <td class="col-amount ${isIncome ? 'income' : 'expense'}">${isIncome ? '+' : ''}${formatCurrencyFull(tx.amount)}</td>
      <td class="col-notes">
        <input class="notes-input" type="text" value="${escapeHtml(tx.notes)}" placeholder="+ add note" data-index="${globalIndex}" data-field="notes">
      </td>
      <td class="col-category">
        <select class="category-select ${tx.category === 'Uncategorised' ? 'needs-input' : ''}" data-index="${globalIndex}" data-field="category">
          ${categories.map(c => `<option value="${c}" ${tx.category === c ? 'selected' : ''}>${c}</option>`).join('')}
          <option value="__new__">+ New Category</option>
        </select>
      </td>
      <td class="col-allocation">
        <select class="allocation-select" data-index="${globalIndex}" data-field="allocation">
          <option value="" ${!tx.allocation ? 'selected' : ''}>Assign...</option>
          <option value="Jack" ${tx.allocation === 'Jack' ? 'selected' : ''}>Jack</option>
          <option value="Courtney" ${tx.allocation === 'Courtney' ? 'selected' : ''}>Courtney</option>
          <option value="Shared" ${tx.allocation === 'Shared' ? 'selected' : ''}>Shared</option>
          <option value="Income" ${tx.allocation === 'Income' ? 'selected' : ''}>Income</option>
        </select>
      </td>
      <td class="col-split">
        <input type="checkbox" class="split-checkbox" ${tx.split ? 'checked' : ''} data-index="${globalIndex}" data-field="split">
      </td>
    `;
    tbody.appendChild(tr);
  }

  // Event delegation for inline edits
  tbody.addEventListener('change', (e) => {
    const el = e.target;
    const index = parseInt(el.dataset.index);
    const field = el.dataset.field;
    if (isNaN(index) || !field) return;

    if (field === 'category' && el.value === '__new__') {
      const name = prompt('Enter new category name:');
      if (name && name.trim()) {
        dataStore.addCategory(name.trim());
        dataStore.updateTransaction(index, { category: name.trim() });
        renderTransactions(container, dataStore);
      } else {
        el.value = dataStore.getTransactions()[index].category;
      }
      return;
    }

    const value = field === 'split' ? el.checked : el.value;
    dataStore.updateTransaction(index, { [field]: value });

    if (field === 'allocation') {
      if (value === 'Shared') {
        dataStore.updateTransaction(index, { split: true });
      } else if (value === 'Jack' || value === 'Courtney') {
        dataStore.updateTransaction(index, { split: false });
      }
      renderTable(container, dataStore.getTransactions(), dataStore.getCategories());
    }
    updateSidebarSavings();
  });

  tbody.addEventListener('input', (e) => {
    const el = e.target;
    if (el.dataset.field === 'notes') {
      const index = parseInt(el.dataset.index);
      dataStore.updateTransaction(index, { notes: el.value });
    }
  });
}

function showRuleModal(container, store, categories) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal">
      <div class="modal-title">Add Custom Rule</div>
      <div class="modal-field">
        <label>Match Field</label>
        <select id="rule-field">
          <option value="description">Bank Description contains</option>
          <option value="reference">Reference contains</option>
          <option value="payee">Payee contains</option>
        </select>
      </div>
      <div class="modal-field">
        <label>Match Text</label>
        <input type="text" id="rule-text" placeholder="e.g. AMAZON">
      </div>
      <div class="modal-field">
        <label>Category</label>
        <select id="rule-category">
          ${categories.map(c => `<option value="${c}">${c}</option>`).join('')}
          <option value="__new__">+ New Category</option>
        </select>
      </div>
      <div class="modal-field">
        <label>Allocation</label>
        <select id="rule-allocation">
          <option value="">No default</option>
          <option value="Jack">Jack</option>
          <option value="Courtney">Courtney</option>
          <option value="Shared">Shared</option>
        </select>
      </div>
      <div class="modal-field">
        <label><input type="checkbox" id="rule-split"> Split 50/50 by default</label>
      </div>
      <div class="modal-actions">
        <button class="btn btn-outline" id="rule-cancel">Cancel</button>
        <button class="btn btn-primary" id="rule-save">Save Rule</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  overlay.querySelector('#rule-cancel').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

  overlay.querySelector('#rule-category').addEventListener('change', (e) => {
    if (e.target.value === '__new__') {
      const name = prompt('Enter new category name:');
      if (name && name.trim()) {
        store.addCategory(name.trim());
        const opt = document.createElement('option');
        opt.value = name.trim();
        opt.textContent = name.trim();
        opt.selected = true;
        e.target.insertBefore(opt, e.target.querySelector('[value="__new__"]'));
      }
    }
  });

  overlay.querySelector('#rule-save').addEventListener('click', () => {
    const rule = {
      matchField: overlay.querySelector('#rule-field').value,
      matchText: overlay.querySelector('#rule-text').value.trim(),
      category: overlay.querySelector('#rule-category').value,
      allocation: overlay.querySelector('#rule-allocation').value,
      split: overlay.querySelector('#rule-split').checked,
    };
    if (!rule.matchText) { alert('Match text is required'); return; }
    if (rule.category === '__new__') { alert('Please select a valid category'); return; }

    store.addCustomRule(rule);

    // Re-apply rules to uncategorised transactions
    const { applyAllRules } = await_import_workaround();
    for (const tx of store.getTransactions()) {
      if (tx.category === 'Uncategorised' || !tx.category) {
        tx.category = '';
        tx.allocation = '';
        tx.split = false;
      }
    }
    import('./rules-engine.js').then(({ applyAllRules }) => {
      applyAllRules(store.getTransactions(), store.getCustomRules());
      renderTransactions(container, store);
      updateSidebarSavings();
    });

    overlay.remove();
  });
}

function filterTransactions(transactions) {
  return transactions.filter(tx => {
    if (currentFilters.month !== 'all') {
      const key = `${tx.date.getFullYear()}-${String(tx.date.getMonth()+1).padStart(2,'0')}`;
      if (key !== currentFilters.month) return false;
    }
    if (currentFilters.category !== 'all' && tx.category !== currentFilters.category) return false;
    if (currentFilters.allocation !== 'all' && tx.allocation !== currentFilters.allocation) return false;
    return true;
  });
}

function getUniqueMonths(transactions) {
  const set = new Set();
  for (const tx of transactions) {
    set.add(`${tx.date.getFullYear()}-${String(tx.date.getMonth()+1).padStart(2,'0')}`);
  }
  return [...set].sort().reverse();
}

function formatDateShort(d) {
  return `${String(d.getDate()).padStart(2,'0')} ${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()]}`;
}

function escapeHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
```

**Note:** The `showRuleModal` function has an issue with the async import pattern. Fix it in Step 2.

- [ ] **Step 2: Fix the rule modal save handler**

Replace the `await_import_workaround()` block in `showRuleModal` with a cleaner approach. The save handler should be:

```js
  overlay.querySelector('#rule-save').addEventListener('click', () => {
    const rule = {
      matchField: overlay.querySelector('#rule-field').value,
      matchText: overlay.querySelector('#rule-text').value.trim(),
      category: overlay.querySelector('#rule-category').value,
      allocation: overlay.querySelector('#rule-allocation').value,
      split: overlay.querySelector('#rule-split').checked,
    };
    if (!rule.matchText) { alert('Match text is required'); return; }
    if (rule.category === '__new__') { alert('Please select a valid category'); return; }

    store.addCustomRule(rule);

    // Re-apply rules to uncategorised transactions
    import('./rules-engine.js').then(({ applyAllRules }) => {
      applyAllRules(store.getTransactions(), store.getCustomRules());
      renderTransactions(container, store);
      updateSidebarSavings();
    });

    overlay.remove();
  });
```

- [ ] **Step 3: Commit**

```bash
cd "/Users/valkeen/Budget Tracker"
git add js/transactions.js
git commit -m "feat: add transactions page with inline editing and rule modal"
```

---

### Task 8: Dashboard Page

**Files:**
- Create: `/Users/valkeen/Budget Tracker/js/dashboard.js`

- [ ] **Step 1: Create js/dashboard.js**

```js
import { dataStore } from './datastore.js';
import { formatCurrency, formatCurrencyFull } from './app.js';

let chartInstance = null;

export function renderDashboard(container, store) {
  const transactions = store.getTransactions();
  const savings = store.getSavingsState();
  const months = getUniqueMonths(transactions);
  const currentMonth = months[0] || 'all';

  // Calculate stats for current month
  const monthTxns = currentMonth === 'all' ? transactions : transactions.filter(tx => {
    const key = `${tx.date.getFullYear()}-${String(tx.date.getMonth()+1).padStart(2,'0')}`;
    return key === currentMonth;
  });

  const income = monthTxns.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const jackIncome = monthTxns.filter(t => t.amount > 0 && t.allocation === 'Jack').reduce((s, t) => s + t.amount, 0);
  const courtneyIncome = monthTxns.filter(t => t.amount > 0 && t.allocation === 'Courtney').reduce((s, t) => s + t.amount, 0);
  const sharedExpenses = monthTxns.filter(t => t.amount < 0 && t.split).reduce((s, t) => s + Math.abs(t.amount), 0);
  const accountBalance = transactions.reduce((s, t) => s + t.amount, 0);

  // Category breakdown for expenses
  const categoryTotals = {};
  for (const tx of monthTxns) {
    if (tx.amount >= 0) continue;
    const cat = tx.category || 'Uncategorised';
    categoryTotals[cat] = (categoryTotals[cat] || 0) + Math.abs(tx.amount);
  }
  const sortedCategories = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]);
  const topCategories = sortedCategories.slice(0, 6);

  // Recent transactions (last 6)
  const recent = transactions.slice(0, 6);

  const monthLabel = currentMonth === 'all' ? 'All Time' : formatMonthLabel(currentMonth);

  container.innerHTML = `
    <div class="page-header">
      <div>
        <div class="page-title">Dashboard</div>
        <div class="page-subtitle">${monthLabel}</div>
      </div>
      <div style="display: flex; gap: 8px;">
        <select class="filter-select" id="dash-month">
          <option value="all">All Time</option>
          ${months.map(m => `<option value="${m}" ${m === currentMonth ? 'selected' : ''}>${formatMonthLabel(m)}</option>`).join('')}
        </select>
        <button class="btn btn-primary" onclick="location.hash='#upload'">Upload CSV</button>
      </div>
    </div>

    <div class="hero-card">
      <div>
        <div class="hero-label">Combined Savings</div>
        <div class="hero-amount">${formatCurrency(savings.combined)}</div>
      </div>
      <div class="hero-avatars">
        <div class="hero-avatar">
          <div class="hero-avatar-circle">J</div>
          <div class="hero-avatar-amount">${formatCurrency(savings.jack)}</div>
        </div>
        <div class="hero-avatar">
          <div class="hero-avatar-circle">C</div>
          <div class="hero-avatar-amount">${formatCurrency(savings.courtney)}</div>
        </div>
      </div>
    </div>

    <div class="stats-row">
      <div class="stat-card">
        <div class="stat-label">Income</div>
        <div class="stat-value">${formatCurrency(income)}</div>
        <div class="stat-detail purple">J: ${formatCurrency(jackIncome)} · C: ${formatCurrency(courtneyIncome)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Shared Expenses</div>
        <div class="stat-value">${formatCurrency(sharedExpenses)}</div>
        <div class="stat-detail red">${sortedCategories.slice(0, 3).map(([c]) => c).join(' · ')}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Account Balance</div>
        <div class="stat-value">${formatCurrency(accountBalance)}</div>
        <div class="stat-detail muted">ANZ Offset</div>
      </div>
    </div>

    <div class="bottom-row">
      <div class="card">
        <div class="card-title">Spending by Category</div>
        <div class="chart-container">
          <div class="chart-canvas-wrap"><canvas id="cat-chart"></canvas></div>
          <div class="chart-legend" id="cat-legend"></div>
        </div>
      </div>
      <div class="card">
        <div class="card-title">Recent Transactions</div>
        <ul class="recent-list">
          ${recent.map(tx => `
            <li class="recent-item">
              <span class="recent-desc">${tx.notes || tx.category || truncate(tx.bankDesc, 30)}</span>
              <span class="recent-amount ${tx.amount >= 0 ? 'income' : 'expense'}">${tx.amount >= 0 ? '+' : ''}${formatCurrencyFull(tx.amount)}</span>
            </li>
          `).join('')}
          ${recent.length === 0 ? '<li class="recent-item"><span class="recent-desc" style="color:#94a3b8">No transactions yet — upload a CSV to get started</span></li>' : ''}
        </ul>
      </div>
    </div>
  `;

  // Render donut chart
  const catColors = ['#ef4444', '#a78bfa', '#4ecca3', '#f472b6', '#fbbf24', '#94a3b8', '#818cf8', '#fb923c'];
  if (topCategories.length > 0) {
    const ctx = container.querySelector('#cat-chart').getContext('2d');
    if (chartInstance) chartInstance.destroy();
    chartInstance = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: topCategories.map(([c]) => c),
        datasets: [{
          data: topCategories.map(([, v]) => v),
          backgroundColor: catColors.slice(0, topCategories.length),
          borderWidth: 0,
        }]
      },
      options: {
        cutout: '65%',
        plugins: { legend: { display: false } },
        responsive: true,
        maintainAspectRatio: true,
      }
    });

    container.querySelector('#cat-legend').innerHTML = topCategories.map(([cat, val], i) =>
      `<div><span class="chart-legend-dot" style="background:${catColors[i]}"></span>${cat} ${formatCurrency(val)}</div>`
    ).join('');
  }

  // Month filter
  container.querySelector('#dash-month').addEventListener('change', () => {
    renderDashboard(container, store);
  });
}

function getUniqueMonths(transactions) {
  const set = new Set();
  for (const tx of transactions) {
    set.add(`${tx.date.getFullYear()}-${String(tx.date.getMonth()+1).padStart(2,'0')}`);
  }
  return [...set].sort().reverse();
}

function formatMonthLabel(key) {
  const [y, m] = key.split('-');
  const names = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${names[parseInt(m)-1]} ${y}`;
}

function truncate(str, len) {
  return str.length > len ? str.slice(0, len) + '...' : str;
}
```

- [ ] **Step 2: Commit**

```bash
cd "/Users/valkeen/Budget Tracker"
git add js/dashboard.js
git commit -m "feat: add dashboard page with hero card, stats, chart, and recent transactions"
```

---

### Task 9: Export Page

**Files:**
- Create: `/Users/valkeen/Budget Tracker/js/export.js`

- [ ] **Step 1: Create js/export.js**

Update `index.html` to import export.js, and create the export page module:

```js
import { dataStore } from './datastore.js';
import { writeMasterWorkbook } from './excel-io.js';
import { showToast } from './app.js';

export function renderExport(container, store) {
  const txCount = store.getTransactions().length;
  const ruleCount = store.getCustomRules().length;
  const catCount = store.getCategories().length;

  container.innerHTML = `
    <div class="page-header">
      <div>
        <div class="page-title">Export</div>
        <div class="page-subtitle">Download your master workbook</div>
      </div>
    </div>
    <div class="export-card">
      <div class="export-icon">📥</div>
      <div class="page-title">Export Master Workbook</div>
      <div class="export-summary">
        <strong>${txCount}</strong> transactions · <strong>${ruleCount}</strong> custom rules · <strong>${catCount}</strong> categories<br>
        Includes: Transactions, Rules, Categories, Savings, and Monthly Summary sheets
      </div>
      <button class="btn btn-primary" id="btn-export" ${txCount === 0 ? 'disabled style="opacity:0.5"' : ''}>
        Download .xlsx
      </button>
      ${txCount === 0 ? '<div style="margin-top:12px;font-size:12px;color:#94a3b8;">Upload transactions first before exporting</div>' : ''}
    </div>
  `;

  const btn = container.querySelector('#btn-export');
  if (btn && txCount > 0) {
    btn.addEventListener('click', () => {
      const filename = writeMasterWorkbook();
      showToast(`Exported ${filename}`);
    });
  }
}
```

- [ ] **Step 2: Update index.html import map**

The `app.js` already imports `renderExport` — but we need to make sure the import path is correct. In `app.js`, add the import at the top:

```js
import { renderExport } from './export.js';
```

This should already be in the app.js from Task 1.

- [ ] **Step 3: Commit**

```bash
cd "/Users/valkeen/Budget Tracker"
git add js/export.js
git commit -m "feat: add export page with master workbook download"
```

---

### Task 10: Integration Test — Full Workflow

- [ ] **Step 1: Open the app in browser and test the full flow**

Open `/Users/valkeen/Budget Tracker/index.html` in a browser.

1. Navigate to Upload page
2. Upload `/Users/valkeen/Downloads/ANZ (15).csv`
3. Verify: toast says "X transactions imported", redirects to Transactions page
4. Verify: transactions are listed with auto-detected categories and allocations
5. Verify: Rent (Ray White / TEN01732) → Parkside Rent / Shared / Split ✓
6. Verify: Payments to Jack H Morales → Jack allocation
7. Verify: Payments to Courtney Hurworth → Courtney allocation
8. Verify: PAYMENT FROM COURTNEY → Savings / Courtney
9. Edit a transaction's notes, category, allocation — verify changes stick
10. Click "+ Add Rule" — create rule: Description contains "AMAZON" → Category "Amazon"
11. Navigate to Dashboard — verify hero card shows combined savings, stats show income/expenses, donut chart renders
12. Navigate to Export — click Download — verify .xlsx downloads with correct sheets
13. Reload the page, Upload the exported .xlsx as master workbook — verify all data loads back

- [ ] **Step 2: Fix any issues found during testing**

Address any bugs or rendering issues discovered in step 1.

- [ ] **Step 3: Load 2026 tab data from the existing workbook**

Run a one-time data import: read the 2026 tab from `/Users/valkeen/Downloads/Contributions Court & Jack.xlsx` using a helper script to convert it to the master workbook format, so the dashboard starts with the existing historical data.

- [ ] **Step 4: Final commit**

```bash
cd "/Users/valkeen/Budget Tracker"
git add -A
git commit -m "feat: complete budget tracker v1 — dashboard, transactions, upload, export"
```

---

## Self-Review Checklist

- **Spec coverage:** All 4 pages implemented (Dashboard, Transactions, Upload, Export). Rules engine with built-in + custom rules. Savings calculation. Excel I/O. CSV parser. Duplicate detection. Category management. Split checkbox logic. Monthly filters. ✓
- **Placeholder scan:** No TBD/TODO. All code blocks are complete. ✓
- **Type consistency:** Transaction object shape consistent across csv-parser, datastore, rules-engine, excel-io, transactions page. Fields: `date`, `amount`, `bankDesc`, `payeeFull`, `payeeShort`, `reference`, `notes`, `category`, `allocation`, `split`. ✓
- **One issue found and fixed:** The `showRuleModal` save handler had a broken `await_import_workaround()` call — fixed in Task 7 Step 2. ✓
