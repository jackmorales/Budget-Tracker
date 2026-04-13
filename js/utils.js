import { dataStore } from './datastore.js';

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
