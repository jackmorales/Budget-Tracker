// transactions.js
// Transactions page: full table with inline editing, filters, and Add Rule modal.

import { dataStore } from './datastore.js';
import { formatCurrency, formatCurrencyFull, updateSidebarSavings } from './utils.js';

// ============================================================
// MODULE STATE
// ============================================================

let currentFilters = {
  dateFrom: '',
  dateTo: '',
  category: 'all',
  allocation: 'all',
};

// ============================================================
// HELPERS
// ============================================================

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getMonthKey(dateStr) {
  if (!dateStr) return '';
  return dateStr.slice(0, 7); // "YYYY-MM"
}

function getUniqueMonths(transactions) {
  const set = new Set(transactions.map(tx => getMonthKey(tx.date)).filter(Boolean));
  return Array.from(set).sort().reverse(); // newest first
}

function getMonthLabel(yyyymm) {
  const [year, month] = yyyymm.split('-');
  const date = new Date(Number(year), Number(month) - 1, 1);
  return date.toLocaleString('en-AU', { month: 'short' }) + ' ' + year;
}

function formatDateShort(dateStr) {
  if (!dateStr) return '';
  const [, month, day] = dateStr.split('-');
  const date = new Date(Number(dateStr.split('-')[0]), Number(month) - 1, Number(day));
  const mon = date.toLocaleString('en-AU', { month: 'short' });
  return `${Number(day)} ${mon}`;
}

function filterTransactions(transactions) {
  return transactions.filter(tx => {
    if (currentFilters.dateFrom && tx.date < currentFilters.dateFrom) return false;
    if (currentFilters.dateTo && tx.date > currentFilters.dateTo) return false;
    if (currentFilters.category !== 'all' && (tx.category || 'Uncategorised') !== currentFilters.category) return false;
    if (currentFilters.allocation !== 'all') {
      const alloc = tx.allocation || '';
      if (currentFilters.allocation === 'Unallocated') {
        if (alloc) return false;
      } else if (currentFilters.allocation === 'Income') {
        // Show all income transactions (positive amounts) regardless of allocation
        if (tx.amount <= 0 && alloc !== 'Income') return false;
      } else {
        if (alloc !== currentFilters.allocation) return false;
      }
    }
    return true;
  });
}

function getAllocationPillClass(allocation) {
  switch (allocation) {
    case 'Jack':     return 'pill--jack';
    case 'Courtney': return 'pill--courtney';
    case 'Shared':   return 'pill--shared';
    case 'Income':   return 'pill--income';
    default:         return 'pill--other';
  }
}

const CATEGORY_COLORS = {
  'Parkside Rent':  { bg: '#fef3c7', text: '#92400e' },
  'Rental Income':  { bg: '#d1fae5', text: '#065f46' },
  'Insurance':      { bg: '#dbeafe', text: '#1e40af' },
  'Childcare':      { bg: '#fce7f3', text: '#9d174d' },
  'Mia Swimming':   { bg: '#e0e7ff', text: '#3730a3' },
  'Loan Payment':   { bg: '#fee2e2', text: '#991b1b' },
  'Utilities':      { bg: '#cffafe', text: '#155e75' },
  'Bank Fees':      { bg: '#f3f4f6', text: '#374151' },
  'Income':         { bg: '#d1fae5', text: '#065f46' },
  'Savings':        { bg: '#d1fae5', text: '#065f46' },
  'Shopping':       { bg: '#ede9fe', text: '#5b21b6' },
  'Food':           { bg: '#fef9c3', text: '#854d0e' },
  'Fuel':           { bg: '#ffedd5', text: '#9a3412' },
  'Health':         { bg: '#fce7f3', text: '#831843' },
  'Gifts':          { bg: '#fbcfe8', text: '#9d174d' },
  'Uncategorised':  { bg: '#fef3c7', text: '#b45309', border: '#fbbf24' },
};

function getCategoryStyle(category) {
  const c = CATEGORY_COLORS[category] || { bg: '#f3f4f6', text: '#374151' };
  let style = `background:${c.bg};color:${c.text};`;
  if (c.border) style += `border:1px solid ${c.border};`;
  return style;
}

// ============================================================
// ROW RENDERING
// ============================================================

function buildCategoryOptions(categories, selectedCategory) {
  const opts = categories.map(cat => {
    const sel = cat === selectedCategory ? ' selected' : '';
    return `<option value="${escapeHtml(cat)}"${sel}>${escapeHtml(cat)}</option>`;
  });
  opts.push('<option value="__new__">+ New Category</option>');
  return opts.join('');
}

function buildAllocationOptions(selectedAllocation) {
  const options = [
    { value: '', label: 'Assign...' },
    { value: 'Jack', label: 'Jack' },
    { value: 'Courtney', label: 'Courtney' },
    { value: 'Shared', label: 'Shared' },
    { value: 'Income', label: 'Income' },
  ];
  return options.map(o => {
    const sel = o.value === (selectedAllocation || '') ? ' selected' : '';
    return `<option value="${escapeHtml(o.value)}"${sel}>${escapeHtml(o.label)}</option>`;
  }).join('');
}

function buildRow(tx, globalIndex, categories, runningBalance) {
  const needsAttention = !tx.category || tx.category === 'Uncategorised' || !tx.allocation;
  const trClass = needsAttention ? ' class="needs-attention"' : '';

  const dateStr = formatDateShort(tx.date);
  const desc = tx.bankDesc || '';

  const amtClass = tx.amount >= 0 ? 'amount--income' : 'amount--expense';
  const amtPrefix = tx.amount >= 0 ? '+' : '';
  const amtFormatted = amtPrefix + formatCurrencyFull(tx.amount);

  const catStyle = getCategoryStyle(tx.category || 'Uncategorised');

  const splitChecked = tx.split ? ' checked' : '';
  const allocDisabled = tx.split ? ' disabled' : '';
  const allocValue = tx.split ? 'Shared' : tx.allocation;

  const balFormatted = formatCurrency(runningBalance);

  return `
    <tr${trClass} data-global-index="${globalIndex}">
      <td class="col-select">
        <input type="checkbox" class="row-select-checkbox" data-index="${globalIndex}" />
      </td>
      <td class="col-date">${escapeHtml(dateStr)}</td>
      <td class="col-desc">
        <span class="tx-desc-text" title="${escapeHtml(desc)}">${escapeHtml(desc)}</span>
      </td>
      <td class="col-amount ${amtClass}">${escapeHtml(amtFormatted)}</td>
      <td class="col-balance">${escapeHtml(balFormatted)}</td>
      <td class="col-notes">
        <input
          type="text"
          class="notes-input"
          data-index="${globalIndex}"
          data-field="notes"
          value="${escapeHtml(tx.notes || '')}"
          placeholder="+ add note"
        />
      </td>
      <td class="col-category">
        <select class="category-select category-tag" data-index="${globalIndex}" data-field="category" style="${catStyle}">
          ${buildCategoryOptions(categories, tx.category || 'Uncategorised')}
        </select>
      </td>
      <td class="col-allocation">
        <select class="allocation-select ${getAllocationPillClass(allocValue)}" data-index="${globalIndex}" data-field="allocation"${allocDisabled}>
          ${buildAllocationOptions(allocValue)}
        </select>
      </td>
      <td class="col-split">
        <input
          type="checkbox"
          class="split-checkbox"
          data-index="${globalIndex}"
          data-field="split"
          ${splitChecked}
        />
      </td>
    </tr>
  `.trim();
}

// ============================================================
// TABLE RENDER
// ============================================================

function buildTable(filtered, allTransactions, categories) {
  if (filtered.length === 0) {
    return `<div class="recent-empty" style="padding:32px 0;text-align:center;color:#9ca3af;">No transactions match the current filters.</div>`;
  }

  // We need global indices — map filtered back to global
  const globalIndexMap = new Map(allTransactions.map((tx, i) => [tx, i]));

  // Compute running balance for ALL transactions (chronological order)
  // allTransactions is sorted date descending, so reverse for chronological
  const opening = dataStore.getSavingsConfig().offsetOpening || 0;
  const chronological = [...allTransactions].reverse();
  const balanceMap = new Map();
  let bal = opening;
  for (const tx of chronological) {
    bal += tx.amount;
    balanceMap.set(tx, Math.round(bal * 100) / 100);
  }

  const rows = filtered.map(tx => {
    const globalIndex = globalIndexMap.get(tx);
    const runningBalance = balanceMap.get(tx) || 0;
    return buildRow(tx, globalIndex, categories, runningBalance);
  }).join('');

  return `
    <div class="tx-table-wrapper">
      <table class="tx-table">
        <thead>
          <tr>
            <th class="col-select"><input type="checkbox" id="select-all-checkbox" /></th>
            <th class="col-date">Date</th>
            <th class="col-desc">Bank Description</th>
            <th class="col-amount">Amount</th>
            <th class="col-balance">Balance</th>
            <th class="col-notes">Notes</th>
            <th class="col-category">Category</th>
            <th class="col-allocation">Allocated To</th>
            <th class="col-split">Split</th>
          </tr>
        </thead>
        <tbody id="tx-tbody">
          ${rows}
        </tbody>
      </table>
    </div>
  `;
}

// ============================================================
// FILTERS ROW
// ============================================================

function getDatePresets(allTransactions) {
  const months = getUniqueMonths(allTransactions);
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');

  const presets = [
    { label: 'All Time', from: '', to: '' },
    { label: 'YTD', from: '2026-01-01', to: '' },
    { label: 'This Month', from: `${yyyy}-${mm}-01`, to: '' },
  ];

  // Add individual months from data
  for (const m of months) {
    const [y, mo] = m.split('-');
    const lastDay = new Date(Number(y), Number(mo), 0).getDate();
    presets.push({
      label: getMonthLabel(m),
      from: `${m}-01`,
      to: `${m}-${String(lastDay).padStart(2, '0')}`,
    });
  }

  return presets;
}

function isActivePreset(preset) {
  return currentFilters.dateFrom === preset.from && currentFilters.dateTo === preset.to;
}

function buildFiltersRow(allTransactions, categories) {
  const presets = getDatePresets(allTransactions);

  const presetButtons = presets.map((p, i) =>
    `<button class="date-preset-btn${isActivePreset(p) ? ' date-preset-btn--active' : ''}" data-preset="${i}">${p.label}</button>`
  ).join('');

  const categoryOptions = [
    `<option value="all"${currentFilters.category === 'all' ? ' selected' : ''}>All Categories</option>`,
    ...categories.map(cat => {
      const sel = currentFilters.category === cat ? ' selected' : '';
      return `<option value="${escapeHtml(cat)}"${sel}>${escapeHtml(cat)}</option>`;
    }),
  ].join('');

  const allocationValues = [
    { value: 'all', label: 'All' },
    { value: 'Jack', label: 'Jack' },
    { value: 'Courtney', label: 'Courtney' },
    { value: 'Shared', label: 'Shared' },
    { value: 'Income', label: 'Income' },
    { value: 'Unallocated', label: 'Unallocated' },
  ];
  const allocationOptions = allocationValues.map(o => {
    const sel = currentFilters.allocation === o.value ? ' selected' : '';
    return `<option value="${o.value}"${sel}>${o.label}</option>`;
  }).join('');

  const selectStyle = 'padding:6px 10px;border-radius:8px;border:1px solid #e5e7eb;font-size:0.875rem;background:#f9fafb;cursor:pointer;';
  const inputStyle = 'padding:5px 8px;border-radius:8px;border:1px solid #e5e7eb;font-size:0.82rem;background:#f9fafb;cursor:pointer;color:#374151;';

  return `
    <div class="filters-row" id="tx-filters-row" style="display:flex;flex-direction:column;gap:10px;margin-bottom:16px;">
      <div class="date-presets" style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;">
        ${presetButtons}
        <span style="color:#9ca3af;font-size:0.8rem;margin:0 4px;">|</span>
        <input type="date" id="tx-filter-date-from" value="${currentFilters.dateFrom}" style="${inputStyle}" title="From date" />
        <span style="color:#9ca3af;font-size:0.82rem;">to</span>
        <input type="date" id="tx-filter-date-to" value="${currentFilters.dateTo}" style="${inputStyle}" title="To date" />
      </div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;">
        <select class="month-filter" id="tx-filter-category" style="${selectStyle}">
          ${categoryOptions}
        </select>
        <select class="month-filter" id="tx-filter-allocation" style="${selectStyle}">
          ${allocationOptions}
        </select>
      </div>
    </div>
  `;
}

// ============================================================
// ADD RULE MODAL
// ============================================================

function buildAddRuleModal(categories) {
  const matchFieldOptions = [
    { value: 'description', label: 'Description' },
    { value: 'reference', label: 'Reference' },
    { value: 'payee', label: 'Payee' },
  ].map(o => `<option value="${o.value}">${o.label}</option>`).join('');

  const categoryOptions = [
    ...categories.map(cat => `<option value="${escapeHtml(cat)}">${escapeHtml(cat)}</option>`),
    '<option value="__new__">+ New Category</option>',
  ].join('');

  const allocationOptions = [
    { value: '', label: 'None' },
    { value: 'Jack', label: 'Jack' },
    { value: 'Courtney', label: 'Courtney' },
    { value: 'Shared', label: 'Shared' },
  ].map(o => `<option value="${o.value}">${o.label}</option>`).join('');

  const fieldStyle = 'width:100%;padding:7px 10px;border:1px solid #e5e7eb;border-radius:8px;font-size:0.875rem;background:#f9fafb;margin-bottom:12px;box-sizing:border-box;';

  return `
    <div class="modal-overlay" id="add-rule-modal">
      <div class="modal">
        <div class="modal__title">Add Matching Rule</div>
        <div class="modal__body">
          <div>
            <label style="font-size:0.8rem;font-weight:600;color:#374151;display:block;margin-bottom:4px;">Match Field</label>
            <select id="rule-match-field" style="${fieldStyle}">${matchFieldOptions}</select>
          </div>
          <div>
            <label style="font-size:0.8rem;font-weight:600;color:#374151;display:block;margin-bottom:4px;">Match Text</label>
            <input type="text" id="rule-match-text" placeholder="e.g. WOOLWORTHS" style="${fieldStyle}" />
          </div>
          <div>
            <label style="font-size:0.8rem;font-weight:600;color:#374151;display:block;margin-bottom:4px;">Category</label>
            <select id="rule-category" style="${fieldStyle}">${categoryOptions}</select>
          </div>
          <div>
            <label style="font-size:0.8rem;font-weight:600;color:#374151;display:block;margin-bottom:4px;">Allocation</label>
            <select id="rule-allocation" style="${fieldStyle}">${allocationOptions}</select>
          </div>
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
            <input type="checkbox" id="rule-split" class="split-checkbox" />
            <label for="rule-split" style="font-size:0.875rem;color:#374151;cursor:pointer;">Split between Jack &amp; Courtney</label>
          </div>
        </div>
        <div class="modal__actions">
          <button class="btn btn-outline" id="rule-cancel-btn">Cancel</button>
          <button class="btn btn-primary" id="rule-save-btn">Save Rule</button>
        </div>
      </div>
    </div>
  `;
}

// ============================================================
// BULK ACTION BAR
// ============================================================

function buildBulkActionBar(categories) {
  const catOptions = categories.map(cat =>
    `<option value="${escapeHtml(cat)}">${escapeHtml(cat)}</option>`
  ).join('');

  const allocOptions = [
    { value: 'Jack', label: 'Jack' },
    { value: 'Courtney', label: 'Courtney' },
    { value: 'Shared', label: 'Shared' },
    { value: 'Income', label: 'Income' },
  ].map(o => `<option value="${o.value}">${o.label}</option>`).join('');

  return `
    <div class="bulk-bar bulk-bar--hidden" id="bulk-action-bar">
      <span class="bulk-bar__count" id="bulk-count">0 selected</span>
      <select class="bulk-bar__select" id="bulk-category">
        <option value="">Set Category...</option>
        ${catOptions}
      </select>
      <select class="bulk-bar__select" id="bulk-allocation">
        <option value="">Set Allocation...</option>
        ${allocOptions}
      </select>
      <label class="bulk-bar__split-label">
        <input type="checkbox" id="bulk-split" class="split-checkbox" />
        Split
      </label>
      <button class="btn btn-primary bulk-bar__apply" id="bulk-apply-btn">Apply</button>
      <button class="bulk-bar__clear" id="bulk-clear-btn">Clear</button>
    </div>
  `;
}

// ============================================================
// EVENT WIRING
// ============================================================

function wireEvents(pageEl, rerenderFn) {
  const ds = dataStore;

  // --- Bulk selection ---
  const bulkBar = pageEl.querySelector('#bulk-action-bar');
  const bulkCount = pageEl.querySelector('#bulk-count');
  const selectAllCb = pageEl.querySelector('#select-all-checkbox');

  function getSelectedIndices() {
    const checkboxes = pageEl.querySelectorAll('.row-select-checkbox:checked');
    return Array.from(checkboxes).map(cb => Number(cb.dataset.index));
  }

  function updateBulkBar() {
    const count = getSelectedIndices().length;
    if (count > 0) {
      bulkBar.classList.remove('bulk-bar--hidden');
      bulkCount.textContent = `${count} selected`;
    } else {
      bulkBar.classList.add('bulk-bar--hidden');
    }
  }

  if (selectAllCb) {
    selectAllCb.addEventListener('change', () => {
      const checkboxes = pageEl.querySelectorAll('.row-select-checkbox');
      checkboxes.forEach(cb => { cb.checked = selectAllCb.checked; });
      updateBulkBar();
    });
  }

  // Row checkbox changes (event delegation)
  const tbody = pageEl.querySelector('#tx-tbody');
  if (tbody) {
    tbody.addEventListener('change', e => {
      if (e.target.classList.contains('row-select-checkbox')) {
        updateBulkBar();
        // Update select-all state
        if (selectAllCb) {
          const all = pageEl.querySelectorAll('.row-select-checkbox');
          const checked = pageEl.querySelectorAll('.row-select-checkbox:checked');
          selectAllCb.checked = all.length > 0 && all.length === checked.length;
        }
      }
    });
  }

  // Bulk apply
  const bulkApplyBtn = pageEl.querySelector('#bulk-apply-btn');
  if (bulkApplyBtn) {
    bulkApplyBtn.addEventListener('click', async () => {
      const indices = getSelectedIndices();
      if (indices.length === 0) return;

      const catSelect = pageEl.querySelector('#bulk-category');
      const allocSelect = pageEl.querySelector('#bulk-allocation');
      const splitCb = pageEl.querySelector('#bulk-split');

      const newCat = catSelect.value;
      const newAlloc = allocSelect.value;
      const newSplit = splitCb.checked;

      const updatedTxns = [];
      for (const idx of indices) {
        const updates = {};
        if (newCat) updates.category = newCat;
        if (newAlloc) {
          updates.allocation = newAlloc;
          if (newAlloc === 'Shared') updates.split = true;
        }
        if (newSplit) {
          updates.split = true;
          updates.allocation = 'Shared';
        }
        if (Object.keys(updates).length > 0) {
          const updated = ds.updateTransaction(idx, updates);
          if (updated) updatedTxns.push(updated);
        }
      }

      // Persist all updated transactions
      if (updatedTxns.length > 0) {
        ds.saveTransactions(updatedTxns).catch(console.error);
      }

      updateSidebarSavings();
      rerenderFn();
    });
  }

  // Bulk clear
  const bulkClearBtn = pageEl.querySelector('#bulk-clear-btn');
  if (bulkClearBtn) {
    bulkClearBtn.addEventListener('click', () => {
      const checkboxes = pageEl.querySelectorAll('.row-select-checkbox');
      checkboxes.forEach(cb => { cb.checked = false; });
      if (selectAllCb) selectAllCb.checked = false;
      updateBulkBar();
    });
  }

  // Filter changes — date presets
  const presetsContainer = pageEl.querySelector('.date-presets');
  if (presetsContainer) {
    const allTransactions = ds.getTransactions();
    const presets = getDatePresets(allTransactions);

    presetsContainer.addEventListener('click', e => {
      const btn = e.target.closest('.date-preset-btn');
      if (!btn) return;
      const idx = Number(btn.dataset.preset);
      const preset = presets[idx];
      if (!preset) return;
      currentFilters.dateFrom = preset.from;
      currentFilters.dateTo = preset.to;
      rerenderFn();
    });
  }

  // Custom date range inputs
  const dateFromInput = pageEl.querySelector('#tx-filter-date-from');
  const dateToInput = pageEl.querySelector('#tx-filter-date-to');
  if (dateFromInput) {
    dateFromInput.addEventListener('change', e => {
      currentFilters.dateFrom = e.target.value;
      rerenderFn();
    });
  }
  if (dateToInput) {
    dateToInput.addEventListener('change', e => {
      currentFilters.dateTo = e.target.value;
      rerenderFn();
    });
  }

  const filterCat   = pageEl.querySelector('#tx-filter-category');
  const filterAlloc = pageEl.querySelector('#tx-filter-allocation');
  if (filterCat) {
    filterCat.addEventListener('change', e => {
      currentFilters.category = e.target.value;
      rerenderFn();
    });
  }
  if (filterAlloc) {
    filterAlloc.addEventListener('change', e => {
      currentFilters.allocation = e.target.value;
      rerenderFn();
    });
  }

  // Table body — event delegation (reuse tbody from above)
  if (tbody) {
    // input event for notes — debounced save
    let notesTimer = null;
    tbody.addEventListener('input', e => {
      const el = e.target;
      if (el.dataset.field !== 'notes') return;
      const index = Number(el.dataset.index);
      const updated = ds.updateTransaction(index, { notes: el.value });
      updateSidebarSavings();
      // Debounce Firestore save
      clearTimeout(notesTimer);
      notesTimer = setTimeout(() => {
        if (updated) ds.saveTransaction(updated).catch(console.error);
      }, 800);
    });

    // change event for selects + checkboxes
    tbody.addEventListener('change', e => {
      const el = e.target;
      const index = Number(el.dataset.index);
      const field = el.dataset.field;
      if (!field) return;

      if (field === 'category') {
        let newCat = el.value;
        if (newCat === '__new__') {
          const name = prompt('Enter new category name:');
          if (name && name.trim()) {
            newCat = name.trim();
            ds.addCategory(newCat);
            ds.saveConfig().catch(console.error);
          } else {
            const tx = ds.getTransactions()[index];
            el.value = tx.category || 'Uncategorised';
            return;
          }
        }
        const updatedTx = ds.updateTransaction(index, { category: newCat });
        if (updatedTx) ds.saveTransaction(updatedTx).catch(console.error);
        // Update tag color inline
        const style = getCategoryStyle(newCat);
        el.setAttribute('style', style);
        updateSidebarSavings();
        rerenderFn();
        return;
      }

      if (field === 'allocation') {
        const newAlloc = el.value;
        const updates = { allocation: newAlloc };

        // Auto-check/uncheck split based on allocation
        if (newAlloc === 'Shared') {
          updates.split = true;
        } else if (newAlloc === 'Jack' || newAlloc === 'Courtney') {
          updates.split = false;
        }

        const updatedAlloc = ds.updateTransaction(index, updates);
        if (updatedAlloc) ds.saveTransaction(updatedAlloc).catch(console.error);
        updateSidebarSavings();
        rerenderFn();
        return;
      }

      if (field === 'split') {
        const updates = { split: el.checked };
        if (el.checked) {
          updates.allocation = 'Shared';
        }
        const updatedSplit = ds.updateTransaction(index, updates);
        if (updatedSplit) ds.saveTransaction(updatedSplit).catch(console.error);
        updateSidebarSavings();
        rerenderFn();
        return;
      }
    });
  }

  // "+ Add Rule" button
  const addRuleBtn = pageEl.querySelector('#tx-add-rule-btn');
  const modal = pageEl.querySelector('#add-rule-modal');

  if (addRuleBtn && modal) {
    addRuleBtn.addEventListener('click', () => {
      modal.classList.add('modal-overlay--visible');
    });
  }

  // Modal cancel
  const cancelBtn = pageEl.querySelector('#rule-cancel-btn');
  if (cancelBtn && modal) {
    cancelBtn.addEventListener('click', () => {
      modal.classList.remove('modal-overlay--visible');
    });
  }

  // Close modal on overlay click
  if (modal) {
    modal.addEventListener('click', e => {
      if (e.target === modal) {
        modal.classList.remove('modal-overlay--visible');
      }
    });
  }

  // Modal save
  const saveBtn = pageEl.querySelector('#rule-save-btn');
  if (saveBtn && modal) {
    saveBtn.addEventListener('click', async () => {
      const matchField = pageEl.querySelector('#rule-match-field').value;
      const matchText  = pageEl.querySelector('#rule-match-text').value.trim();
      let category     = pageEl.querySelector('#rule-category').value;
      const allocation = pageEl.querySelector('#rule-allocation').value;
      const split      = pageEl.querySelector('#rule-split').checked;

      if (!matchText) {
        alert('Please enter match text.');
        return;
      }

      // Handle "+ New Category" in rule modal
      if (category === '__new__') {
        const name = prompt('Enter new category name:');
        if (name && name.trim()) {
          category = name.trim();
          ds.addCategory(category);
        } else {
          return;
        }
      }

      // Add rule
      ds.addCustomRule({ matchField, matchText, category, allocation, split });

      // Re-apply rules to uncategorised transactions
      try {
        const { applyAllRules } = await import('./rules-engine.js');
        applyAllRules(ds.getTransactions(), ds.getCustomRules());
      } catch (err) {
        console.warn('Could not apply rules:', err);
      }

      // Save config (rules) and updated transactions to Firestore
      ds.saveConfig().catch(console.error);
      const allTx = ds.getTransactions();
      ds.saveTransactions(allTx).catch(console.error);

      updateSidebarSavings();
      modal.classList.remove('modal-overlay--visible');
      rerenderFn();
    });
  }
}

// ============================================================
// MAIN RENDER
// ============================================================

export function renderTransactions(container, store) {
  const ds = store || dataStore;
  const pageEl = container || document.getElementById('page-transactions');
  if (!pageEl) return;

  const allTransactions = ds.getTransactions();
  const categories = ds.getCategories();
  const filtered = filterTransactions(allTransactions);
  const count = filtered.length;

  const filtersHTML   = buildFiltersRow(allTransactions, categories);
  const tableHTML     = buildTable(filtered, allTransactions, categories);
  const modalHTML     = buildAddRuleModal(categories);

  const bulkBarHTML = buildBulkActionBar(categories);

  pageEl.innerHTML = `
    <div class="page-header">
      <div class="page-header-left">
        <h1 class="page-title">Transactions</h1>
        <p class="page-subtitle">${count} transaction${count !== 1 ? 's' : ''}</p>
      </div>
      <div class="page-header-right">
        <button class="btn btn-primary" id="tx-add-rule-btn">+ Add Rule</button>
      </div>
    </div>
    ${bulkBarHTML}
    ${filtersHTML}
    ${tableHTML}
    ${modalHTML}
  `;

  // Re-render function scoped to this page element
  function rerender() {
    renderTransactions(pageEl, ds);
  }

  wireEvents(pageEl, rerender);
}
