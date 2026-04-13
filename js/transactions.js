// transactions.js
// Transactions page: full table with inline editing, filters, and Add Rule modal.

import { dataStore } from './datastore.js';
import { formatCurrencyFull, updateSidebarSavings } from './utils.js';

// ============================================================
// MODULE STATE
// ============================================================

let currentFilters = {
  month: 'all',
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
    if (currentFilters.month !== 'all' && getMonthKey(tx.date) !== currentFilters.month) return false;
    if (currentFilters.category !== 'all' && (tx.category || 'Uncategorised') !== currentFilters.category) return false;
    if (currentFilters.allocation !== 'all') {
      const alloc = tx.allocation || '';
      if (currentFilters.allocation === 'Unallocated') {
        if (alloc) return false;
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

function buildRow(tx, globalIndex, categories) {
  const needsAttention = !tx.category || tx.category === 'Uncategorised' || !tx.allocation;
  const trClass = needsAttention ? ' class="needs-attention"' : '';

  const dateStr = formatDateShort(tx.date);
  const desc = tx.bankDesc || '';

  const amtClass = tx.amount >= 0 ? 'amount--income' : 'amount--expense';
  const amtPrefix = tx.amount >= 0 ? '+' : '';
  const amtFormatted = amtPrefix + formatCurrencyFull(tx.amount);

  const catBorderStyle = (!tx.category || tx.category === 'Uncategorised')
    ? ' style="border-color: #fbbf24;"'
    : '';

  const splitChecked = tx.split ? ' checked' : '';

  return `
    <tr${trClass}>
      <td class="col-date">${escapeHtml(dateStr)}</td>
      <td class="col-desc">
        <span class="tx-desc-text" title="${escapeHtml(desc)}">${escapeHtml(desc)}</span>
      </td>
      <td class="col-amount ${amtClass}">${escapeHtml(amtFormatted)}</td>
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
        <select class="category-select" data-index="${globalIndex}" data-field="category"${catBorderStyle}>
          ${buildCategoryOptions(categories, tx.category || 'Uncategorised')}
        </select>
      </td>
      <td class="col-allocation">
        <select class="allocation-select ${getAllocationPillClass(tx.allocation)}" data-index="${globalIndex}" data-field="allocation">
          ${buildAllocationOptions(tx.allocation)}
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

  const rows = filtered.map(tx => {
    const globalIndex = globalIndexMap.get(tx);
    return buildRow(tx, globalIndex, categories);
  }).join('');

  return `
    <div class="tx-table-wrapper">
      <table class="tx-table">
        <thead>
          <tr>
            <th class="col-date">Date</th>
            <th class="col-desc">Bank Description</th>
            <th class="col-amount">Amount</th>
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

function buildFiltersRow(allTransactions, categories) {
  const months = getUniqueMonths(allTransactions);

  const monthOptions = [
    `<option value="all"${currentFilters.month === 'all' ? ' selected' : ''}>All Months</option>`,
    ...months.map(m => {
      const sel = currentFilters.month === m ? ' selected' : '';
      return `<option value="${m}"${sel}>${getMonthLabel(m)}</option>`;
    }),
  ].join('');

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

  return `
    <div class="filters-row" id="tx-filters-row" style="display:flex;gap:10px;margin-bottom:16px;flex-wrap:wrap;">
      <select class="month-filter" id="tx-filter-month" style="padding:6px 10px;border-radius:8px;border:1px solid #e5e7eb;font-size:0.875rem;background:#f9fafb;cursor:pointer;">
        ${monthOptions}
      </select>
      <select class="month-filter" id="tx-filter-category" style="padding:6px 10px;border-radius:8px;border:1px solid #e5e7eb;font-size:0.875rem;background:#f9fafb;cursor:pointer;">
        ${categoryOptions}
      </select>
      <select class="month-filter" id="tx-filter-allocation" style="padding:6px 10px;border-radius:8px;border:1px solid #e5e7eb;font-size:0.875rem;background:#f9fafb;cursor:pointer;">
        ${allocationOptions}
      </select>
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
// EVENT WIRING
// ============================================================

function wireEvents(pageEl, rerenderFn) {
  const ds = dataStore;

  // Filter changes
  const filterMonth = pageEl.querySelector('#tx-filter-month');
  const filterCat   = pageEl.querySelector('#tx-filter-category');
  const filterAlloc = pageEl.querySelector('#tx-filter-allocation');

  if (filterMonth) {
    filterMonth.addEventListener('change', e => {
      currentFilters.month = e.target.value;
      rerenderFn();
    });
  }
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

  // Table body — event delegation
  const tbody = pageEl.querySelector('#tx-tbody');
  if (tbody) {
    // input event for notes
    tbody.addEventListener('input', e => {
      const el = e.target;
      if (el.dataset.field !== 'notes') return;
      const index = Number(el.dataset.index);
      ds.updateTransaction(index, { notes: el.value });
      updateSidebarSavings();
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
          } else {
            // Revert select
            const tx = ds.getTransactions()[index];
            el.value = tx.category || 'Uncategorised';
            return;
          }
        }
        ds.updateTransaction(index, { category: newCat });
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

        ds.updateTransaction(index, updates);
        updateSidebarSavings();
        rerenderFn();
        return;
      }

      if (field === 'split') {
        ds.updateTransaction(index, { split: el.checked });
        updateSidebarSavings();
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
