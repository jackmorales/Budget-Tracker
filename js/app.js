import { renderDashboard } from './dashboard.js';
import { renderTransactions } from './transactions.js';
import { renderUpload } from './upload.js';
import { renderExport } from './export.js';
import { dataStore } from './datastore.js';
import { showToast, updateSidebarSavings, formatCurrency, formatCurrencyFull } from './utils.js';

export { showToast, updateSidebarSavings, formatCurrency, formatCurrencyFull } from './utils.js';

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
    if (el) el.style.display = 'none';
  });

  const activePage = document.getElementById(PAGES[pageKey].divId);
  if (activePage) activePage.style.display = '';

  // Update nav active state
  document.querySelectorAll('.nav-link').forEach(link => {
    link.classList.toggle('active', link.dataset.page === pageKey);
  });

  // Render the page with container and store
  PAGES[pageKey].render(activePage, dataStore);

  // Update sidebar savings
  updateSidebarSavings();
}

// ============================================================
// EVENT LISTENERS
// ============================================================

window.addEventListener('hashchange', navigate);
document.addEventListener('DOMContentLoaded', navigate);
