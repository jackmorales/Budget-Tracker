import { dataStore } from './datastore.js';
import { writeMasterWorkbook } from './excel-io.js';
import { showToast } from './utils.js';

export function renderExport(container, store) {
  const ds = store || dataStore;

  const transactions = ds.getTransactions();
  const rules = ds.getCustomRules();
  const categories = ds.getCategories();

  const txCount = transactions.length;
  const ruleCount = rules.length;
  const catCount = categories.length;

  const hasTransactions = txCount > 0;

  container.innerHTML = `
    <div class="page-header">
      <h1>Export</h1>
      <p class="page-subtitle">Download your master workbook</p>
    </div>

    <div class="export-card-wrapper">
      <div class="export-card">
        <div class="export-icon">📥</div>
        <h2>Export Master Workbook</h2>
        <p class="export-summary">${txCount} transactions · ${ruleCount} custom rules · ${catCount} categories</p>
        <p class="export-description">Includes: Transactions, Rules, Categories, Savings, and Monthly Summary sheets</p>
        <button
          class="btn-primary export-btn"
          ${hasTransactions ? '' : 'disabled'}
          style="${hasTransactions ? '' : 'opacity: 0.5; cursor: not-allowed;'}"
        >
          Download Workbook
        </button>
        ${!hasTransactions ? '<p class="export-helper-text">Upload transactions first before exporting</p>' : ''}
      </div>
    </div>
  `;

  if (hasTransactions) {
    container.querySelector('.export-btn').addEventListener('click', () => {
      const filename = writeMasterWorkbook();
      showToast('Exported ' + filename);
    });
  }
}
