import { renderDashboard } from './dashboard.js';
import { renderTransactions } from './transactions.js';
import { renderUpload } from './upload.js';
import { renderExport } from './export.js';
import { dataStore } from './datastore.js';

// ============================================================
// ROUTER
// ============================================================

const PAGES = {
  dashboard:    { divId: 'page-dashboard',    render: renderDashboard },
  transactions: { divId: 'page-transactions', render: renderTransactions },
  upload:       { divId: 'page-upload',       render: renderUpload },
  export:       { divId: 'page-export',       render: renderExport },
};

export function navigate() {
  const hash = location.hash.replace('#', '') || 'dashboard';
  const pageKey = PAGES[hash] ? hash : 'dashboard';

  // Hide all pages, show active
  Object.values(PAGES).forEach(({ divId }) => {
    const el = document.getElementById(divId);
    if (el) el.classList.remove('page--active');
  });

  const activePage = document.getElementById(PAGES[pageKey].divId);
  if (activePage) activePage.classList.add('page--active');

  // Update nav active state
  document.querySelectorAll('.nav-link').forEach(link => {
    link.classList.toggle('active', link.dataset.page === pageKey);
  });

  // Render the page
  PAGES[pageKey].render();

  // Update sidebar savings
  updateSidebarSavings();
}

// ============================================================
// TOAST
// ============================================================

let toastTimer = null;

export function showToast(message) {
  const toast = document.getElementById('toast');
  if (!toast) return;

  toast.textContent = message;
  toast.classList.add('toast--visible');

  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove('toast--visible');
  }, 3000);
}

// ============================================================
// SIDEBAR SAVINGS
// ============================================================

export function updateSidebarSavings() {
  const state = dataStore.getSavingsState();

  const jackEl = document.getElementById('sidebar-jack-savings');
  const courtneyEl = document.getElementById('sidebar-courtney-savings');

  if (jackEl) jackEl.textContent = formatCurrency(state.jack ?? 0);
  if (courtneyEl) courtneyEl.textContent = formatCurrency(state.courtney ?? 0);
}

// ============================================================
// FORMATTING UTILITIES
// ============================================================

export function formatCurrency(n) {
  const num = Number(n) || 0;
  const abs = Math.abs(Math.round(num));
  const formatted = abs.toLocaleString('en-US');
  return num < 0 ? `-$${formatted}` : `$${formatted}`;
}

export function formatCurrencyFull(n) {
  const num = Number(n) || 0;
  const abs = Math.abs(num).toFixed(2);
  const [integer, decimal] = abs.split('.');
  const formattedInteger = Number(integer).toLocaleString('en-US');
  return num < 0 ? `-$${formattedInteger}.${decimal}` : `$${formattedInteger}.${decimal}`;
}

// ============================================================
// EVENT LISTENERS
// ============================================================

window.addEventListener('hashchange', navigate);
document.addEventListener('DOMContentLoaded', navigate);
