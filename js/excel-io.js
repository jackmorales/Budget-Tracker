// excel-io.js
// Reads and writes the master Budget workbook using SheetJS (XLSX global from CDN).

import { dataStore } from './datastore.js';
import { applyAllRules } from './rules-engine.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Format a Date object as DD/MM/YYYY */
function formatDate(d) {
  if (!(d instanceof Date) || isNaN(d)) return '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

/** Set column widths on a worksheet.  widths is an array of numbers (chars). */
function setColWidths(ws, widths) {
  ws['!cols'] = widths.map((w) => ({ wch: w }));
}

/** Round to 2 decimal places */
function round2(n) {
  return Math.round(n * 100) / 100;
}

/**
 * Parse a DD/MM/YYYY string into a YYYY-MM-DD ISO date string.
 * Returns '' if parsing fails.
 */
function parseDDMMYYYY(str) {
  if (!str) return '';
  const parts = String(str).split('/');
  if (parts.length !== 3) return '';
  const [dd, mm, yyyy] = parts;
  if (!dd || !mm || !yyyy) return '';
  return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// readMasterWorkbook
// ---------------------------------------------------------------------------

/**
 * Reads an Excel ArrayBuffer and populates the dataStore.
 * @param {ArrayBuffer} arrayBuffer
 */
export function readMasterWorkbook(arrayBuffer) {
  const wb = XLSX.read(arrayBuffer, { type: 'array', cellDates: true });

  // 1. Transactions sheet
  if (wb.SheetNames.includes('Transactions')) {
    const ws = wb.Sheets['Transactions'];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, dateNF: 'dd/mm/yyyy' });
    // Skip header row (index 0)
    const txns = [];
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0) continue;
      // Columns: Date, Bank Description, Amount, Notes, Category, Allocated To, Split (Y/N),
      //          Payee Full, Payee Short, Reference
      const dateStr = parseDDMMYYYY(row[0]);
      if (!dateStr) continue; // skip blank rows
      txns.push({
        date:       dateStr,
        bankDesc:   row[1] || '',
        amount:     parseFloat(row[2]) || 0,
        notes:      row[3] || '',
        category:   row[4] || '',
        allocation: row[5] || '',
        split:      row[6] === 'Y',
        payeeFull:  row[7] || '',
        payeeShort: row[8] || '',
        reference:  row[9] || '',
      });
    }
    dataStore.addTransactions(txns);
  }

  // 2. Rules sheet
  if (wb.SheetNames.includes('Rules')) {
    const ws = wb.Sheets['Rules'];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, dateNF: 'dd/mm/yyyy' });
    // Columns: Match Field, Match Text, Category, Allocation, Split Default
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0) continue;
      dataStore.addCustomRule({
        matchField:    row[0] || '',
        matchText:     row[1] || '',
        category:      row[2] || '',
        allocation:    row[3] || '',
        splitDefault:  row[4] === 'Y',
      });
    }
  }

  // 3. Categories sheet
  if (wb.SheetNames.includes('Categories')) {
    const ws = wb.Sheets['Categories'];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, dateNF: 'dd/mm/yyyy' });
    // Single column: Category
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0) continue;
      const name = row[0];
      if (name && String(name).trim()) {
        dataStore.addCategory(String(name).trim());
      }
    }
  }

  // 4. Savings sheet
  if (wb.SheetNames.includes('Savings')) {
    const ws = wb.Sheets['Savings'];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, dateNF: 'dd/mm/yyyy' });
    // Row 0 = header, Row 1 = config: Start Date, Jack Opening, Courtney Opening
    if (rows.length >= 2) {
      const config = rows[1];
      if (config && config.length >= 3) {
        const startDate = parseDDMMYYYY(config[0]);
        const jackOpening     = parseFloat(config[1]) || 0;
        const courtneyOpening = parseFloat(config[2]) || 0;
        dataStore.setSavingsConfig({
          startDate:        startDate || dataStore.getSavingsConfig().startDate,
          jackOpening,
          courtneyOpening,
        });
      }
    }
  }

  // Re-apply rules to any uncategorised transactions
  applyAllRules(dataStore.getTransactions(), dataStore.getCustomRules());
}

// ---------------------------------------------------------------------------
// Monthly snapshot calculation
// ---------------------------------------------------------------------------

/**
 * Returns an array of monthly snapshot objects, each with:
 *   month (YYYY-MM), jackOpening, jackIncome, jackShared, jackPersonal, jackClosing,
 *   courtneyOpening, courtneyIncome, courtneyShared, courtneyPersonal, courtneyClosing,
 *   combined
 */
function calculateMonthlySnapshots() {
  const cfg = dataStore.getSavingsConfig();
  const startDate = cfg.startDate; // YYYY-MM-DD

  // Gather all transactions on/after startDate, sort ascending
  const txns = dataStore.getTransactions()
    .filter((tx) => tx.date >= startDate)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  if (txns.length === 0) return [];

  // Group by YYYY-MM
  const monthMap = new Map();
  for (const tx of txns) {
    const ym = tx.date.slice(0, 7); // YYYY-MM
    if (!monthMap.has(ym)) monthMap.set(ym, []);
    monthMap.get(ym).push(tx);
  }

  // Sort months
  const months = [...monthMap.keys()].sort();

  let jackBal = cfg.jackOpening;
  let courtneyBal = cfg.courtneyOpening;

  const snapshots = [];

  for (const ym of months) {
    const monthTxns = monthMap.get(ym);
    let jackIncome = 0;
    let jackShared = 0;
    let jackPersonal = 0;
    let courtneyIncome = 0;
    let courtneyShared = 0;
    let courtneyPersonal = 0;

    for (const tx of monthTxns) {
      const { amount, category, allocation, split } = tx;

      if (category === 'Income' || category === 'Savings') {
        if (allocation === 'Jack') {
          jackIncome += amount;
        } else if (allocation === 'Courtney') {
          courtneyIncome += amount;
        }
      } else if (category === 'Rental Income') {
        jackIncome     += amount / 2;
        courtneyIncome += amount / 2;
      } else if (amount < 0) {
        // Expense
        if (split) {
          jackShared     += amount / 2;
          courtneyShared += amount / 2;
        } else if (allocation === 'Jack') {
          jackPersonal += amount;
        } else if (allocation === 'Courtney') {
          courtneyPersonal += amount;
        }
      }
    }

    const jackOpeningSnap     = round2(jackBal);
    const courtneyOpeningSnap = round2(courtneyBal);

    const jackClosing     = round2(jackBal + jackIncome + jackShared + jackPersonal);
    const courtneyClosing = round2(courtneyBal + courtneyIncome + courtneyShared + courtneyPersonal);

    snapshots.push({
      month:             ym,
      jackOpening:       jackOpeningSnap,
      jackIncome:        round2(jackIncome),
      jackShared:        round2(jackShared),
      jackPersonal:      round2(jackPersonal),
      jackClosing,
      courtneyOpening:   courtneyOpeningSnap,
      courtneyIncome:    round2(courtneyIncome),
      courtneyShared:    round2(courtneyShared),
      courtneyPersonal:  round2(courtneyPersonal),
      courtneyClosing,
      combined:          round2(jackClosing + courtneyClosing),
    });

    jackBal     = jackClosing;
    courtneyBal = courtneyClosing;
  }

  return snapshots;
}

// ---------------------------------------------------------------------------
// Monthly summary calculation
// ---------------------------------------------------------------------------

/**
 * Returns a 2D array suitable for sheet_from_array_of_arrays.
 * Header row: ['Month', ...categories]
 * Data rows:  [YYYY-MM, ...totals]
 * Only negative-amount (expense) transactions are counted.
 */
function calculateMonthlySummary() {
  const cfg = dataStore.getSavingsConfig();
  const startDate = cfg.startDate;

  const categories = dataStore.getCategories();

  // Gather expense transactions on/after startDate
  const txns = dataStore.getTransactions()
    .filter((tx) => tx.date >= startDate && tx.amount < 0);

  // Group by month, then accumulate per-category totals
  const monthMap = new Map();
  for (const tx of txns) {
    const ym = tx.date.slice(0, 7);
    if (!monthMap.has(ym)) {
      const row = {};
      for (const c of categories) row[c] = 0;
      monthMap.set(ym, row);
    }
    const cat = tx.category || 'Uncategorised';
    const row = monthMap.get(ym);
    if (cat in row) {
      row[cat] = round2(row[cat] + tx.amount);
    } else {
      row[cat] = round2(tx.amount);
    }
  }

  const months = [...monthMap.keys()].sort();

  const header = ['Month', ...categories];
  const dataRows = months.map((ym) => {
    const row = monthMap.get(ym);
    return [ym, ...categories.map((c) => row[c] || 0)];
  });

  return [header, ...dataRows];
}

// ---------------------------------------------------------------------------
// writeMasterWorkbook
// ---------------------------------------------------------------------------

/**
 * Generates and triggers download of the master workbook.
 * @returns {string} The filename used.
 */
export function writeMasterWorkbook() {
  const wb = XLSX.utils.book_new();
  const cfg = dataStore.getSavingsConfig();

  // 1. Transactions sheet
  {
    const header = [
      'Date', 'Bank Description', 'Amount', 'Notes',
      'Category', 'Allocated To', 'Split (Y/N)',
      'Payee Full', 'Payee Short', 'Reference',
    ];
    const txns = dataStore.getTransactions();
    const dataRows = txns.map((tx) => [
      formatDate(new Date(tx.date)),
      tx.bankDesc,
      tx.amount,
      tx.notes,
      tx.category,
      tx.allocation,
      tx.split ? 'Y' : 'N',
      tx.payeeFull,
      tx.payeeShort,
      tx.reference,
    ]);
    const wsData = [header, ...dataRows];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    setColWidths(ws, [12, 40, 10, 30, 20, 14, 10, 30, 20, 20]);
    XLSX.utils.book_append_sheet(wb, ws, 'Transactions');
  }

  // 2. Rules sheet
  {
    const header = ['Match Field', 'Match Text', 'Category', 'Allocation', 'Split Default'];
    const rules = dataStore.getCustomRules();
    const dataRows = rules.map((r) => [
      r.matchField,
      r.matchText,
      r.category,
      r.allocation,
      r.splitDefault ? 'Y' : 'N',
    ]);
    const wsData = [header, ...dataRows];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    setColWidths(ws, [14, 30, 20, 14, 14]);
    XLSX.utils.book_append_sheet(wb, ws, 'Rules');
  }

  // 3. Categories sheet
  {
    const header = ['Category'];
    const categories = dataStore.getCategories();
    const dataRows = categories.map((c) => [c]);
    const wsData = [header, ...dataRows];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    setColWidths(ws, [24]);
    XLSX.utils.book_append_sheet(wb, ws, 'Categories');
  }

  // 4. Savings sheet
  {
    const cfgStartDate = cfg.startDate
      ? formatDate(new Date(cfg.startDate))
      : '';

    const configHeader = ['Start Date', 'Jack Opening', 'Courtney Opening'];
    const configRow    = [cfgStartDate, cfg.jackOpening, cfg.courtneyOpening];

    const snapshotHeader = [
      'Month',
      'Jack Opening', 'Jack Income', 'Jack Shared', 'Jack Personal', 'Jack Closing',
      'Courtney Opening', 'Courtney Income', 'Courtney Shared', 'Courtney Personal', 'Courtney Closing',
      'Combined',
    ];

    const snapshots = calculateMonthlySnapshots();
    const snapshotRows = snapshots.map((s) => [
      s.month,
      s.jackOpening, s.jackIncome, s.jackShared, s.jackPersonal, s.jackClosing,
      s.courtneyOpening, s.courtneyIncome, s.courtneyShared, s.courtneyPersonal, s.courtneyClosing,
      s.combined,
    ]);

    // Layout: config header, config row, blank row, snapshot header, snapshot rows
    const wsData = [
      configHeader,
      configRow,
      [],
      snapshotHeader,
      ...snapshotRows,
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    setColWidths(ws, [14, 14, 16, 14, 16, 12, 18, 16, 18, 18, 18, 12]);
    XLSX.utils.book_append_sheet(wb, ws, 'Savings');
  }

  // 5. Summary sheet
  {
    const summaryData = calculateMonthlySummary();
    const ws = XLSX.utils.aoa_to_sheet(summaryData);
    // Dynamic widths: month col 10, each category col 14
    const categories = dataStore.getCategories();
    setColWidths(ws, [10, ...categories.map(() => 14)]);
    XLSX.utils.book_append_sheet(wb, ws, 'Summary');
  }

  // Build filename and trigger download
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm   = String(today.getMonth() + 1).padStart(2, '0');
  const dd   = String(today.getDate()).padStart(2, '0');
  const filename = `CJ_Budget_Master_${yyyy}-${mm}-${dd}.xlsx`;

  XLSX.writeFile(wb, filename);

  return filename;
}
