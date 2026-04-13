import { dataStore } from './datastore.js';
import { formatCurrency, formatCurrencyFull } from './utils.js';

// Module-level chart instances to allow destroy before re-create
let chartInstance = null;
let barChartInstance = null;

// Module-level selected month state
let selectedMonth = null;
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

function filterByMonth(transactions, month) {
  if (!month || month === 'all') return transactions;
  return transactions.filter(tx => getMonthKey(tx.date) === month);
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
    const txns = filterByMonth(allTransactions, month);
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
  const months = getUniqueMonths(allTransactions);

  // Initialise selectedMonth on first render or when it becomes stale
  if (!initialised || (months.length > 0 && selectedMonth !== 'all' && !months.includes(selectedMonth))) {
    selectedMonth = months.length > 0 ? months[0] : 'all';
    initialised = true;
  } else if (months.length === 0) {
    selectedMonth = 'all';
  }

  const filtered = filterByMonth(allTransactions, selectedMonth);
  const stats = calcStats(filtered, allTransactions);
  const savings = ds.getSavingsState();

  // Current month label for subtitle
  const currentMonthLabel = selectedMonth === 'all' ? 'All Time' : getMonthLabel(selectedMonth);

  // ---- Build HTML ----

  // Month dropdown options
  const monthOptions = [
    `<option value="all"${selectedMonth === 'all' ? ' selected' : ''}>All Time</option>`,
    ...months.map(m => `<option value="${m}"${selectedMonth === m ? ' selected' : ''}>${getMonthLabel(m)}</option>`),
  ].join('');

  // Hero card
  const heroHTML = `
    <div class="hero-card">
      <div class="hero-label">Combined Savings</div>
      <div class="hero-amount">${formatCurrencyFull(savings.combined)}</div>
      <div class="hero-avatars">
        <div class="hero-avatar">
          <div class="hero-avatar-circle">J</div>
          <div class="hero-avatar-amount">${formatCurrency(savings.jack)}</div>
        </div>
        <div class="hero-avatar">
          <div class="hero-avatar-circle">C</div>
          <div class="hero-avatar-amount">${formatCurrency(savings.courtney)}</div>
        </div>
      </div>
    </div>
  `;

  // Stats row
  const sharedCatDetail = stats.top3SharedCats.length > 0
    ? stats.top3SharedCats.join(' · ')
    : 'No shared expenses';

  const statsHTML = `
    <div class="stats-row">
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
        <div class="card-title">Rental Income vs Expense</div>
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
        <p class="page-subtitle">${currentMonthLabel}</p>
      </div>
      <div class="page-header-right">
        <select class="month-filter" id="dashboard-month-filter">
          ${monthOptions}
        </select>
        <a href="#upload" class="btn btn-primary">Upload CSV</a>
      </div>
    </div>
    ${heroHTML}
    ${statsHTML}
    <div class="card monthly-chart-card">
      <div class="card-title">Monthly Savings & Spending</div>
      <canvas id="dashboard-bar-canvas" height="220"></canvas>
    </div>
    ${bottomHTML}
  `;

  // Month filter change handler
  const filterEl = pageEl.querySelector('#dashboard-month-filter');
  if (filterEl) {
    filterEl.addEventListener('change', (e) => {
      selectedMonth = e.target.value;
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
