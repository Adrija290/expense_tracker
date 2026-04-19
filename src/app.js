// ── State ──────────────────────────────────────────────
let transactions = JSON.parse(localStorage.getItem('ledger_txns') || '[]');
let budgets      = JSON.parse(localStorage.getItem('ledger_budgets') || '{}');
// budgets shape: { 'YYYY-MM': { Food: 5000, Transport: 2000, ... } }

let currentType    = 'expense';
let viewMonth      = new Date().toISOString().slice(0, 7); // 'YYYY-MM'
let budgetPanelOpen = false;

const CATEGORY_ICONS = {
  Food:          '🍜',
  Transport:     '🚌',
  Shopping:      '🛍️',
  Health:        '💊',
  Entertainment: '🎬',
  Makeup:        '💄',
  Utilities:     '💡',
  Salary:        '💼',
  Other:         '📦',
};

const EXPENSE_CATEGORIES = ['Food', 'Transport', 'Shopping', 'Health', 'Entertainment', 'Makeup', 'Utilities', 'Other'];

// ── Init ───────────────────────────────────────────────
function init() {
  document.getElementById('date').value = new Date().toISOString().split('T')[0];
  document.getElementById('currentDate').textContent = new Date().toLocaleDateString('en-IN', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });
  updateViewMonthLabel();
  render();
}

// ── Month Navigation ───────────────────────────────────
function changeViewMonth(delta) {
  const [y, m] = viewMonth.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  viewMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  updateViewMonthLabel();
  render();
}

function updateViewMonthLabel() {
  const [y, m] = viewMonth.split('-').map(Number);
  document.getElementById('viewMonthLabel').textContent =
    new Date(y, m - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}

// ── Set Transaction Type ───────────────────────────────
function setType(type) {
  currentType = type;
  document.getElementById('btnExpense').classList.toggle('active', type === 'expense');
  document.getElementById('btnIncome').classList.toggle('active', type === 'income');
  document.getElementById('category').value = type === 'income' ? 'Salary' : 'Food';
}

// ── Add Transaction ────────────────────────────────────
function addTransaction() {
  const desc   = document.getElementById('desc').value.trim();
  const amount = parseFloat(document.getElementById('amount').value);
  const cat    = document.getElementById('category').value;
  const date   = document.getElementById('date').value;
  const err    = document.getElementById('formError');

  if (!desc)                   { err.textContent = 'Please enter a description.'; return; }
  if (!amount || amount <= 0)  { err.textContent = 'Please enter a valid amount.'; return; }
  if (!date)                   { err.textContent = 'Please select a date.'; return; }

  err.textContent = '';

  transactions.unshift({ id: Date.now(), type: currentType, desc, amount, category: cat, date });
  save();
  render();

  document.getElementById('desc').value   = '';
  document.getElementById('amount').value = '';

  // Check if this expense just crossed the budget limit
  if (currentType === 'expense') {
    const txMonth = date.slice(0, 7);
    const limit   = (budgets[txMonth] || {})[cat];
    if (limit) {
      const spent = transactions
        .filter(t => t.type === 'expense' && t.category === cat && t.date.startsWith(txMonth))
        .reduce((s, t) => s + t.amount, 0);
      if (spent > limit) {
        showToast(`⚠ Over ${cat} budget by ${fmt(spent - limit)}`, 'warning');
        return;
      }
    }
  }
  showToast('Transaction added', 'success');
}

// ── Delete Transaction ─────────────────────────────────
function deleteTransaction(id) {
  transactions = transactions.filter(t => t.id !== id);
  save();
  render();
  showToast('Deleted', 'error');
}

// ── Persist ────────────────────────────────────────────
function save() {
  localStorage.setItem('ledger_txns',    JSON.stringify(transactions));
}
function saveBudgetData() {
  localStorage.setItem('ledger_budgets', JSON.stringify(budgets));
}

// ── Render ─────────────────────────────────────────────
function render() {
  renderSummary();
  renderCategoryBars();
  renderTransactions();
  if (budgetPanelOpen) renderBudgetInputs();
}

function fmt(n) {
  return '₹' + Number(n).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

// ── Summary (all-time totals) ──────────────────────────
function renderSummary() {
  const income  = transactions.filter(t => t.type === 'income' ).reduce((s, t) => s + t.amount, 0);
  const expense = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const balance = income - expense;

  document.getElementById('totalIncome').textContent  = fmt(income);
  document.getElementById('totalExpense').textContent = fmt(expense);

  const balEl = document.getElementById('totalBalance');
  balEl.textContent = fmt(balance);
  balEl.classList.toggle('negative', balance < 0);
}

// ── Category Bars (for viewMonth, with budget limits) ──
function renderCategoryBars() {
  const expenses  = transactions.filter(t => t.type === 'expense' && t.date.startsWith(viewMonth));
  const budget    = budgets[viewMonth] || {};
  const container = document.getElementById('categoryBars');

  const byCategory = {};
  expenses.forEach(t => { byCategory[t.category] = (byCategory[t.category] || 0) + t.amount; });

  // Include categories that have a budget set but ₹0 spent
  Object.keys(budget).forEach(cat => { if (!byCategory[cat]) byCategory[cat] = 0; });

  if (!Object.keys(byCategory).length) {
    container.innerHTML = '<p class="empty-hint">No expenses this month.</p>';
    return;
  }

  const sorted = Object.entries(byCategory).sort((a, b) => b[1] - a[1]);
  const maxRaw = Math.max(...sorted.map(([, v]) => v), 1);

  container.innerHTML = sorted.map(([cat, total]) => {
    const limit      = budget[cat] || 0;
    const overBudget = limit > 0 && total > limit;
    let barWidth, barColor;

    if (limit > 0) {
      const pct = (total / limit) * 100;
      barWidth   = Math.min(pct, 100).toFixed(1);
      barColor   = pct > 100 ? 'var(--danger)' : pct > 80 ? 'var(--warning)' : 'var(--income)';
    } else {
      barWidth = ((total / maxRaw) * 100).toFixed(1);
      barColor = 'var(--accent)';
    }

    return `
      <div class="bar-row">
        <div class="bar-label">${CATEGORY_ICONS[cat] || '📦'} ${cat}</div>
        <div class="bar-track">
          <div class="bar-fill" style="width:${barWidth}%;background:${barColor}"></div>
        </div>
        <div class="bar-amount${overBudget ? ' over' : ''}">
          ${fmt(total)}${limit ? `<span class="bar-limit-text"> / ${fmt(limit)}</span>` : ''}
        </div>
      </div>
      ${overBudget ? `<div class="over-budget-msg">⚠ Over by ${fmt(total - limit)}</div>` : ''}
    `;
  }).join('');
}

// ── Budget Panel ───────────────────────────────────────
function toggleBudgetPanel() {
  budgetPanelOpen = !budgetPanelOpen;
  document.getElementById('budgetInputsPanel').style.display = budgetPanelOpen ? 'block' : 'none';
  const btn = document.getElementById('setLimitsBtn');
  btn.textContent = budgetPanelOpen ? '✕ Close' : '⊕ Set Limits';
  btn.classList.toggle('active', budgetPanelOpen);
  if (budgetPanelOpen) renderBudgetInputs();
}

function renderBudgetInputs() {
  const budget    = budgets[viewMonth] || {};
  const expenses  = transactions.filter(t => t.type === 'expense' && t.date.startsWith(viewMonth));
  const byCategory = {};
  expenses.forEach(t => { byCategory[t.category] = (byCategory[t.category] || 0) + t.amount; });

  document.getElementById('budgetInputsGrid').innerHTML = EXPENSE_CATEGORIES.map(cat => {
    const spent = byCategory[cat] || 0;
    const limit = budget[cat]    || '';
    return `
      <div class="budget-input-row">
        <span class="budget-cat-icon">${CATEGORY_ICONS[cat]}</span>
        <span class="budget-cat-name">${cat}</span>
        <span class="budget-cat-spent">Spent: ${fmt(spent)}</span>
        <div class="budget-input-wrap">
          <span class="budget-rupee">₹</span>
          <input type="number" class="budget-input" data-cat="${cat}"
                 value="${limit}" placeholder="No limit" min="0" step="100" />
        </div>
      </div>
    `;
  }).join('');
}

function saveLimits() {
  if (!budgets[viewMonth]) budgets[viewMonth] = {};

  document.querySelectorAll('.budget-input').forEach(input => {
    const cat = input.dataset.cat;
    const val = parseFloat(input.value);
    if (!isNaN(val) && val > 0) {
      budgets[viewMonth][cat] = val;
    } else {
      delete budgets[viewMonth][cat];
    }
  });

  // Clean up empty month objects
  if (!Object.keys(budgets[viewMonth]).length) delete budgets[viewMonth];

  saveBudgetData();
  renderCategoryBars();

  const btn = document.querySelector('.save-limits-btn');
  const orig = btn.textContent;
  btn.textContent = '✓ Saved!';
  btn.style.color = 'var(--income)';
  setTimeout(() => { btn.textContent = orig; btn.style.color = ''; }, 2000);
}

// ── Transaction List (filtered by viewMonth) ───────────
function renderTransactions() {
  const filterCat  = document.getElementById('filterCategory').value;
  const filterType = document.getElementById('filterType').value;

  let filtered = transactions.filter(t => t.date.startsWith(viewMonth));
  if (filterCat  !== 'all') filtered = filtered.filter(t => t.category === filterCat);
  if (filterType !== 'all') filtered = filtered.filter(t => t.type     === filterType);

  const list = document.getElementById('txList');

  if (!filtered.length) {
    list.innerHTML = `
      <div class="empty-state">
        <span class="empty-icon">⬡</span>
        <p>No transactions found.<br/>Try adjusting filters.</p>
      </div>`;
    return;
  }

  list.innerHTML = filtered.map(t => {
    const sign    = t.type === 'expense' ? '-' : '+';
    const dateStr = new Date(t.date + 'T00:00:00').toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric'
    });
    return `
      <div class="tx-item" id="tx-${t.id}">
        <div class="tx-icon">${CATEGORY_ICONS[t.category] || '📦'}</div>
        <div class="tx-info">
          <div class="tx-desc">${escapeHtml(t.desc)}</div>
          <div class="tx-meta">
            <span>${dateStr}</span>
            <span class="tx-tag">${t.category}</span>
          </div>
        </div>
        <div class="tx-right">
          <div class="tx-amount ${t.type}">${sign}${fmt(t.amount)}</div>
          <button class="delete-btn" onclick="deleteTransaction(${t.id})" title="Delete">✕</button>
        </div>
      </div>
    `;
  }).join('');
}

// ── Export to CSV ──────────────────────────────────────
function exportCSV() {
  const filterCat  = document.getElementById('filterCategory').value;
  const filterType = document.getElementById('filterType').value;

  let data = transactions.filter(t => t.date.startsWith(viewMonth));
  if (filterCat  !== 'all') data = data.filter(t => t.category === filterCat);
  if (filterType !== 'all') data = data.filter(t => t.type     === filterType);

  if (!data.length) { showToast('No transactions to export', 'error'); return; }

  const headers = ['Date', 'Description', 'Category', 'Type', 'Amount (₹)'];
  const rows    = data.map(t => [
    t.date,
    `"${t.desc.replace(/"/g, '""')}"`,
    t.category,
    t.type,
    t.type === 'expense' ? -t.amount : t.amount,
  ]);

  const csv  = [headers, ...rows].map(r => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `ledger_${viewMonth}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('CSV exported!', 'success');
}

// ── Toast ──────────────────────────────────────────────
function showToast(msg, type = 'success') {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.className   = `toast ${type} show`;
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => { toast.className = 'toast'; }, 3000);
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Start ──────────────────────────────────────────────
init();
