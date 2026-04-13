import { renderDashboard } from './dashboard.js';
import { renderTransactions } from './transactions.js';
import { renderUpload } from './upload.js';
import { renderExport } from './export.js';
import { dataStore } from './datastore.js';
import { renderLogin, logout } from './auth.js';
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
    if (el) el.classList.remove('page--active');
  });

  const activePage = document.getElementById(PAGES[pageKey].divId);
  if (activePage) activePage.classList.add('page--active');

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
// AUTH + INIT
// ============================================================

async function onAuthenticated(user) {
  showToast('Loading your data...');

  try {
    const result = await dataStore.loadFromFirestore(user.uid);
    if (result.transactions > 0) {
      showToast(`Loaded ${result.transactions} transactions`);
    } else {
      showToast('Welcome! Upload a CSV to get started.');
    }
  } catch (err) {
    console.error('Error loading data:', err);
    showToast('Error loading data — check console');
  }

  navigate();
}

// Logout handler
function setupLogout() {
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      dataStore.clear();
      await logout();
    });
  }
}

// ============================================================
// EVENT LISTENERS
// ============================================================

window.addEventListener('hashchange', navigate);

// Modules are deferred — DOMContentLoaded may have already fired.
function init() {
  setupLogout();
  renderLogin(onAuthenticated);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
