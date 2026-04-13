import { dataStore } from './datastore.js';
import { formatCurrency, formatCurrencyFull } from './utils.js';

// Module-level chart instances to allow destroy before re-create
let chartInstance = null;
let barChartInstance = null;

// Module-level date filter state
let dateFrom = '';
let dateTo = '';
let initialised = false;

// ============================================================
// HELPERS
// ============================================================

function getMonthLabel(yyyymm) {
  const [year, month] = yyyymm.split('-');
  const date = new Date(Number(year), Number(month) - 1, 1);
  return date.toLocaleString('en-US', { month: 'short' }) + ' ' + year;
}

function getMonthKey(dateStr) {
  // dateStr is "YYYY-MM-DD"
  return dateStr.slice(0, 7); // "YYYY-MM"
}

function truncate(str, max) {
  if (!str) return '';
  return str.length > max ? str.slice(0, max) + '…' : str;
}

function getUniqueMonths(transactions) {
  const set = new Set(transactions.map(tx => getMonthKey(tx.date)));
  return Array.from(set).sort().reverse(); // newest first
}

function filterByDateRange(transactions, from, to) {
  return transactions.filter(tx => {
    if (from && tx.date < from) return false;
    if (to && tx.date > to) return false;
    return true;
  });
}

function getDatePresets(transactions) {
  const months = getUniqueMonths(transactions);
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');

  const presets = [
    { label: 'All Time', from: '', to: '' },
    { label: 'YTD', from: '2026-01-01', to: '' },
    { label: 'This Month', from: `${yyyy}-${mm}-01`, to: '' },
  ];

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
  return dateFrom === preset.from && dateTo === preset.to;
}

// ============================================================
// CALCULATIONS
// ============================================================

function calcStats(transactions, allTransactions) {
  // Income (filtered month)
  const income = transactions
    .filter(t => t.amount > 0)
    .reduce((s, t) => s + t.amount, 0);

  const jackIncome = transactions
    .filter(t => t.amount > 0 && t.allocation === 'Jack')
    .reduce((s, t) => s + t.amount, 0);

  const courtneyIncome = transactions
    .filter(t => t.amount > 0 && t.allocation === 'Courtney')
    .reduce((s, t) => s + t.amount, 0);

  // Shared expenses (filtered month)
  const sharedExpenses = transactions
    .filter(t => t.amount < 0 && t.split)
    .reduce((s, t) => s + Math.abs(t.amount), 0);

  // Top 3 shared expense categories
  const sharedCatMap = {};
  transactions
    .filter(t => t.amount < 0 && t.split)
    .forEach(t => {
      const cat = t.category || 'Uncategorised';
      sharedCatMap[cat] = (sharedCatMap[cat] || 0) + Math.abs(t.amount);
    });
  const top3SharedCats = Object.entries(sharedCatMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([cat]) => cat);

  // Account balance (ALL transactions, unfiltered) — not used for display anymore

  // Category totals for donut (filtered month, negative amounts only)
  const catMap = {};
  transactions
    .filter(t => t.amount < 0)
    .forEach(t => {
      const cat = t.category || 'Uncategorised';
      catMap[cat] = (catMap[cat] || 0) + Math.abs(t.amount);
    });
  // Show top categories individually, group the rest as "Other"
  const sorted = Object.entries(catMap).sort((a, b) => b[1] - a[1]);
  let categoryTotals;
  if (sorted.length <= 8) {
    categoryTotals = sorted;
  } else {
    const top = sorted.slice(0, 7);
    const otherTotal = sorted.slice(7).reduce((s, [, v]) => s + v, 0);
    categoryTotals = [...top, ['Other', otherTotal]];
  }

  // Rental income vs expense
  const rentalIncome = transactions
    .filter(t => t.category === 'Rental Income' && t.amount > 0)
    .reduce((s, t) => s + t.amount, 0);

  const rentalExpense = transactions
    .filter(t => t.category === 'Parkside Rent' && t.amount < 0)
    .reduce((s, t) => s + Math.abs(t.amount), 0);

  return {
    income,
    jackIncome,
    courtneyIncome,
    sharedExpenses,
    top3SharedCats,
    categoryTotals,
    rentalIncome,
    rentalExpense,
  };
}

function calcMonthlyBreakdown(allTransactions) {
  // Build last 6 months (rolling window), filling gaps with zeros
  const now = new Date();
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }

  return months.map(month => {
    const [y, mo] = month.split('-');
    const lastDay = new Date(Number(y), Number(mo), 0).getDate();
    const from = `${month}-01`;
    const to = `${month}-${String(lastDay).padStart(2, '0')}`;
    const txns = filterByDateRange(allTransactions, from, to);
    const income = txns.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
    const expenses = txns.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
    const net = income - expenses;
    return { month, label: getMonthLabel(month), income, expenses, net };
  });
}

// ============================================================
// RENDER
// ============================================================

export function renderDashboard(container, store) {
  // Allow being called with no args (app.js calls with no args, uses module-level dataStore)
  const ds = store || dataStore;
  const pageEl = container || document.getElementById('page-dashboard');
  if (!pageEl) return;

  const allTransactions = ds.getTransactions();
  const presets = getDatePresets(allTransactions);

  // Initialise to current month on first render
  if (!initialised && allTransactions.length > 0) {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    dateFrom = `${yyyy}-${mm}-01`;
    dateTo = '';
    initialised = true;
  }

  const filtered = filterByDateRange(allTransactions, dateFrom, dateTo);
  const stats = calcStats(filtered, allTransactions);
  const savings = ds.getSavingsState();

  // Current filter label for subtitle
  const activePreset = presets.find(p => isActivePreset(p));
  const currentLabel = activePreset ? activePreset.label : (dateFrom || dateTo ? `${dateFrom || '...'} to ${dateTo || '...'}` : 'All Time');

  // ---- Build HTML ----

  // Date preset buttons
  const presetButtons = presets.map((p, i) =>
    `<button class="date-preset-btn${isActivePreset(p) ? ' date-preset-btn--active' : ''}" data-preset="${i}">${p.label}</button>`
  ).join('');

  const inputStyle = 'padding:5px 8px;border-radius:8px;border:1px solid #e5e7eb;font-size:0.82rem;background:#f9fafb;cursor:pointer;color:#374151;';

  const dateFilterHTML = `
    <div class="date-presets" id="dashboard-date-presets" style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;">
      ${presetButtons}
      <span style="color:#9ca3af;font-size:0.8rem;margin:0 4px;">|</span>
      <input type="date" id="dash-filter-date-from" value="${dateFrom}" style="${inputStyle}" title="From date" />
      <span style="color:#9ca3af;font-size:0.82rem;">to</span>
      <input type="date" id="dash-filter-date-to" value="${dateTo}" style="${inputStyle}" title="To date" />
    </div>
  `;

  // Stats row (4 cards)
  const sharedCatDetail = stats.top3SharedCats.length > 0
    ? stats.top3SharedCats.join(' · ')
    : 'No shared expenses';

  const statsHTML = `
    <div class="stats-row">
      <div class="stat-card stat-card--savings">
        <div class="stat-label">Combined Savings</div>
        <div class="stat-value">${formatCurrency(savings.combined)}</div>
        <div class="stat-detail purple">J: ${formatCurrency(savings.jack)} · C: ${formatCurrency(savings.courtney)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Income</div>
        <div class="stat-value">${formatCurrency(stats.income)}</div>
        <div class="stat-detail purple">J: ${formatCurrency(stats.jackIncome)} · C: ${formatCurrency(stats.courtneyIncome)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Shared Expenses</div>
        <div class="stat-value">${formatCurrency(stats.sharedExpenses)}</div>
        <div class="stat-detail red">${sharedCatDetail}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Offset Balance</div>
        <div class="stat-value">${formatCurrency(savings.offsetBalance)}</div>
        <div class="stat-detail muted">ANZ Offset Account</div>
      </div>
    </div>
  `;

  // Chart legend
  const COLORS = ['#ef4444', '#a78bfa', '#4ecca3', '#f472b6', '#fbbf24', '#94a3b8', '#818cf8', '#fb923c'];
  const legendHTML = stats.categoryTotals.map(([cat, amt], i) => `
    <div class="chart-legend-item">
      <span class="chart-legend-dot" style="background:${COLORS[i % COLORS.length]}"></span>
      <span class="chart-legend-label">${cat}</span>
      <span class="chart-legend-value">${formatCurrency(amt)}</span>
    </div>
  `).join('');

  // Rental comparison
  const rentalNet = stats.rentalIncome - stats.rentalExpense;
  const rentalNetClass = rentalNet >= 0 ? 'positive' : 'negative';
  const rentalNetSign = rentalNet >= 0 ? '+' : '';

  // Bottom row
  const bottomHTML = `
    <div class="bottom-row">
      <div class="card">
        <div class="card-title">Spending by Category</div>
        <div class="chart-container">
          <div class="chart-canvas-wrap">
            <canvas id="dashboard-donut-canvas"></canvas>
          </div>
          <div class="chart-legend">${legendHTML}</div>
        </div>
      </div>
      <div class="card">
        <div class="card-title">Rental Cashflows</div>
        <div class="rental-comparison">
          <div class="rental-cards">
            <div class="rental-mini-card rental-mini-card--income">
              <div class="rental-mini-label">Rental Income</div>
              <div class="rental-mini-value">${formatCurrency(stats.rentalIncome)}</div>
            </div>
            <div class="rental-mini-card rental-mini-card--expense">
              <div class="rental-mini-label">Parkside Rent</div>
              <div class="rental-mini-value">-${formatCurrency(stats.rentalExpense)}</div>
            </div>
          </div>
          <div class="rental-net-row">
            <span class="rental-net-label">Net</span>
            <span class="rental-net-value ${rentalNetClass}">${rentalNetSign}${formatCurrency(Math.abs(rentalNet))}</span>
          </div>
        </div>
      </div>
    </div>
  `;

  // Full page
  pageEl.innerHTML = `
    <div class="page-header">
      <div class="page-header-left">
        <h1 class="page-title">Dashboard</h1>
        <p class="page-subtitle">${currentLabel}</p>
      </div>
      <div class="page-header-right">
        <a href="#upload" class="btn btn-primary">Upload CSV</a>
      </div>
    </div>
    ${dateFilterHTML}
    ${statsHTML}
    <div class="card monthly-chart-card">
      <div class="card-title">Monthly Savings & Spending</div>
      <canvas id="dashboard-bar-canvas" height="220"></canvas>
    </div>
    ${bottomHTML}
  `;

  // Date preset buttons
  const presetsEl = pageEl.querySelector('#dashboard-date-presets');
  if (presetsEl) {
    presetsEl.addEventListener('click', e => {
      const btn = e.target.closest('.date-preset-btn');
      if (!btn) return;
      const idx = Number(btn.dataset.preset);
      const preset = presets[idx];
      if (!preset) return;
      dateFrom = preset.from;
      dateTo = preset.to;
      renderDashboard(container, store);
    });
  }

  // Custom date range inputs
  const dashDateFrom = pageEl.querySelector('#dash-filter-date-from');
  const dashDateTo = pageEl.querySelector('#dash-filter-date-to');
  if (dashDateFrom) {
    dashDateFrom.addEventListener('change', e => {
      dateFrom = e.target.value;
      renderDashboard(container, store);
    });
  }
  if (dashDateTo) {
    dashDateTo.addEventListener('change', e => {
      dateTo = e.target.value;
      renderDashboard(container, store);
    });
  }

  // Render charts
  renderDonut(stats.categoryTotals, COLORS);
  const monthlyData = calcMonthlyBreakdown(allTransactions);
  renderBarChart(monthlyData);
}

// ============================================================
// DONUT CHART
// ============================================================

function renderDonut(categoryTotals, colors) {
  const canvas = document.getElementById('dashboard-donut-canvas');
  if (!canvas) return;

  // Destroy previous instance
  if (chartInstance) {
    chartInstance.destroy();
    chartInstance = null;
  }

  if (categoryTotals.length === 0) return;

  const ctx = canvas.getContext('2d');
  const categoryNames = categoryTotals.map(([cat]) => cat);
  const categoryValues = categoryTotals.map(([, amt]) => amt);

  chartInstance = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: categoryNames,
      datasets: [{
        data: categoryValues,
        backgroundColor: colors.slice(0, categoryValues.length),
        borderWidth: 0,
      }],
    },
    options: {
      cutout: '65%',
      plugins: { legend: { display: false } },
      responsive: true,
      maintainAspectRatio: true,
    },
  });
}

// ============================================================
// STACKED BAR CHART
// ============================================================

function renderBarChart(monthlyData) {
  const canvas = document.getElementById('dashboard-bar-canvas');
  if (!canvas) return;

  if (barChartInstance) {
    barChartInstance.destroy();
    barChartInstance = null;
  }

  if (monthlyData.length === 0) return;

  const ctx = canvas.getContext('2d');
  const labels = monthlyData.map(d => d.label);
  const incomeData = monthlyData.map(d => d.income);
  const expenseData = monthlyData.map(d => d.expenses);
  const netData = monthlyData.map(d => d.net);

  barChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Income',
          data: incomeData,
          backgroundColor: '#10b981',
          borderRadius: 4,
        },
        {
          label: 'Expenses',
          data: expenseData,
          backgroundColor: '#ef4444',
          borderRadius: 4,
        },
        {
          label: 'Net Savings',
          data: netData,
          type: 'line',
          borderColor: '#7c3aed',
          backgroundColor: 'rgba(124,58,237,0.1)',
          borderWidth: 2,
          pointBackgroundColor: '#7c3aed',
          pointRadius: 4,
          fill: true,
          tension: 0.3,
          yAxisID: 'y',
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false,
      },
      plugins: {
        legend: {
          position: 'top',
          labels: {
            usePointStyle: true,
            pointStyle: 'circle',
            padding: 16,
            font: { size: 12 },
          },
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              const val = context.parsed.y;
              let formatted;
              if (context.dataset.label === 'Expenses') {
                formatted = `-$${val.toLocaleString('en-AU', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
              } else {
                const prefix = val < 0 ? '-$' : '$';
                formatted = `${prefix}${Math.abs(val).toLocaleString('en-AU', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
              }
              return ` ${context.dataset.label}: ${formatted}`;
            },
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
        },
        y: {
          beginAtZero: true,
          ticks: {
            callback: (val) => '$' + val.toLocaleString('en-AU', { maximumFractionDigits: 0 }),
          },
          grid: { color: '#f3f4f6' },
        },
      },
    },
  });
}
