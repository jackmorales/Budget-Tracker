import { dataStore } from './datastore.js';
import { parseANZCSV } from './csv-parser.js';
import { readMasterWorkbook } from './excel-io.js';
import { applyAllRules } from './rules-engine.js';
import { updateSidebarSavings } from './utils.js';

export function renderUpload(container, store) {
  container.innerHTML = `
    <div class="page-header">
      <h1>Upload</h1>
      <p class="subtitle">Import your financial data to get started</p>
    </div>
    <div class="upload-zones">
      <label class="upload-zone" id="zone-master" for="input-master">
        <div class="upload-icon">📊</div>
        <div class="upload-title">Master Workbook</div>
        <div class="upload-desc">Upload your existing .xlsx master file to load transactions, rules, and savings</div>
        <input type="file" id="input-master" accept=".xlsx,.xls">
      </label>
      <label class="upload-zone" id="zone-csv" for="input-csv">
        <div class="upload-icon">📄</div>
        <div class="upload-title">ANZ CSV</div>
        <div class="upload-desc">Upload a new bank statement CSV to append transactions</div>
        <input type="file" id="input-csv" accept=".csv">
      </label>
    </div>
    <div id="upload-result"></div>
  `;

  const zoneMaster = container.querySelector('#zone-master');
  const zoneCSV = container.querySelector('#zone-csv');
  const inputMaster = container.querySelector('#input-master');
  const inputCSV = container.querySelector('#input-csv');
  const resultEl = container.querySelector('#upload-result');

  function showResult(message, isError) {
    resultEl.className = 'upload-result ' + (isError ? 'error' : 'success');
    resultEl.textContent = message;
  }

  // --- Master Workbook ---
  inputMaster.addEventListener('change', async () => {
    const file = inputMaster.files[0];
    if (!file) return;
    try {
      const buffer = await file.arrayBuffer();
      dataStore.clear();
      const result = await readMasterWorkbook(buffer);
      updateSidebarSavings();
      const txCount = result.transactions ? result.transactions.length : 0;
      const ruleCount = result.customRules ? result.customRules.length : 0;
      showResult(
        `Master workbook loaded: ${txCount} transaction${txCount !== 1 ? 's' : ''} and ${ruleCount} custom rule${ruleCount !== 1 ? 's' : ''} imported.`,
        false
      );
    } catch (err) {
      showResult('Error loading master workbook: ' + err.message, true);
    }
    inputMaster.value = '';
  });

  setupDragDrop(zoneMaster, async (file) => {
    try {
      const buffer = await file.arrayBuffer();
      dataStore.clear();
      const result = await readMasterWorkbook(buffer);
      updateSidebarSavings();
      const txCount = result.transactions ? result.transactions.length : 0;
      const ruleCount = result.customRules ? result.customRules.length : 0;
      showResult(
        `Master workbook loaded: ${txCount} transaction${txCount !== 1 ? 's' : ''} and ${ruleCount} custom rule${ruleCount !== 1 ? 's' : ''} imported.`,
        false
      );
    } catch (err) {
      showResult('Error loading master workbook: ' + err.message, true);
    }
  });

  // --- ANZ CSV ---
  inputCSV.addEventListener('change', async () => {
    const file = inputCSV.files[0];
    if (!file) return;
    await handleCSV(file);
    inputCSV.value = '';
  });

  setupDragDrop(zoneCSV, handleCSV);

  async function handleCSV(file) {
    try {
      showResult('Importing...', false);
      const text = await file.text();
      const transactions = parseANZCSV(text);
      const customRules = dataStore.getCustomRules();
      applyAllRules(transactions, customRules);

      const { added, skipped, newlyAdded } = dataStore.addTransactions(transactions);

      // Persist new transactions and config (categories, rules) to Firestore
      if (newlyAdded && newlyAdded.length > 0) {
        showResult(`Saving ${added} transactions to cloud...`, false);
        await dataStore.saveTransactions(newlyAdded);
      }
      await dataStore.saveConfig();

      updateSidebarSavings();
      showResult(
        `${added} new transaction${added !== 1 ? 's' : ''} added, ${skipped} duplicate${skipped !== 1 ? 's' : ''} skipped.`,
        false
      );
      setTimeout(() => {
        window.location.hash = '#transactions';
      }, 1000);
    } catch (err) {
      showResult('Error importing CSV: ' + err.message, true);
    }
  }

  function setupDragDrop(zone, handler) {
    zone.addEventListener('dragover', (e) => {
      e.preventDefault();
      zone.classList.add('drag-over');
    });
    zone.addEventListener('dragleave', () => {
      zone.classList.remove('drag-over');
    });
    zone.addEventListener('drop', (e) => {
      e.preventDefault();
      zone.classList.remove('drag-over');
      const file = e.dataTransfer.files[0];
      if (file) handler(file);
    });
  }
}
