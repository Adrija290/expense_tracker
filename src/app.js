// ── State ──────────────────────────────────────────────
let transactions = JSON.parse(localStorage.getItem('ledger_txns')    || '[]');
let budgets      = JSON.parse(localStorage.getItem('ledger_budgets') || '{}');

let currentType     = 'expense';
let editType        = 'expense';
let viewMonth       = new Date().toISOString().slice(0, 7);
let budgetPanelOpen = false;

const CATEGORY_ICONS = {
  Food:          '🍜',
  Transport:     '🚌',
  Shopping:      '🛍️',
  Health:        '💊',
  Entertainment: '🎬',
  Rent:          '🏠',
  Bills:         '💡',
  Insurance:     '🛡️',
  Investment:    '📈',
  Education:     '📚',
  Travel:        '✈️',
  Salary:        '💼',
  Freelance:     '💻',
  Business:      '🏢',
  Other:         '📦',
};

const EXPENSE_CATEGORIES = [
  'Food', 'Transport', 'Shopping', 'Health', 'Entertainment',
  'Rent', 'Bills', 'Insurance', 'Investment', 'Education', 'Travel', 'Other'
];

// ── Init ───────────────────────────────────────────────
function init() {
  document.getElementById('date').value = new Date().toISOString().split('T')[0];
  document.getElementById('currentDate').textContent = new Date().toLocaleDateString('en-IN', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });

  const savedTheme = localStorage.getItem('ledger_theme') || 'dark';
  applyTheme(savedTheme);

  updateViewMonthLabel();
  render();

  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      if (document.getElementById('editModal').style.display !== 'none') {
        saveEdit();
      } else {
        addTransaction();
      }
    }
    if (e.key === 'Escape') closeEditModal();
  });
}

// ── Theme ──────────────────────────────────────────────
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  document.getElementById('themeToggle').textContent = theme === 'dark' ? '☀' : '☾';
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const next    = current === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  localStorage.setItem('ledger_theme', next);
}

// ── Month Navigation ───────────────────────────────────
function changeViewMonth(delta) {
  const [y, m] = viewMonth.split('-').map(Number);
  const d      = new Date(y, m - 1 + delta, 1);
  viewMonth    = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
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
  document.getElementById('btnIncome').classList.toggle('active',  type === 'income');
  document.getElementById('category').value = type === 'income' ? 'Salary' : 'Food';
}

function setEditType(type) {
  editType = type;
  document.getElementById('editBtnExpense').classList.toggle('active', type === 'expense');
  document.getElementById('editBtnIncome').classList.toggle('active',  type === 'income');
}

// ── Add Transaction ────────────────────────────────────
function addTransaction() {
  const desc   = document.getElementById('desc').value.trim();
  const amount = parseFloat(document.getElementById('amount').value);
  const cat    = document.getElementById('category').value;
  const date   = document.getElementById('date').value;
  const notes  = document.getElementById('notes').value.trim();
  const err    = document.getElementById('formError');

  if (!desc)                  { err.textContent = 'Please enter a description.'; return; }
  if (!amount || amount <= 0) { err.textContent = 'Please enter a valid amount.'; return; }
  if (!date)                  { err.textContent = 'Please select a date.'; return; }
  err.textContent = '';

  transactions.unshift({ id: Date.now(), type: currentType, desc, amount, category: cat, date, notes });
  save();
  render();

  document.getElementById('desc').value   = '';
  document.getElementById('amount').value = '';
  document.getElementById('notes').value  = '';

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
  if (!confirm('Delete this transaction? This cannot be undone.')) return;
  transactions = transactions.filter(t => t.id !== id);
  save();
  render();
  showToast('Transaction deleted', 'error');
}

// ── Edit Transaction Modal ─────────────────────────────
function openEditModal(id) {
  const tx = transactions.find(t => t.id === id);
  if (!tx) return;

  document.getElementById('editId').value       = tx.id;
  document.getElementById('editDesc').value     = tx.desc;
  document.getElementById('editAmount').value   = tx.amount;
  document.getElementById('editCategory').value = tx.category;
  document.getElementById('editDate').value     = tx.date;
  document.getElementById('editNotes').value    = tx.notes || '';

  editType = tx.type;
  document.getElementById('editBtnExpense').classList.toggle('active', tx.type === 'expense');
  document.getElementById('editBtnIncome').classList.toggle('active',  tx.type === 'income');

  document.getElementById('editModal').style.display = 'flex';
  setTimeout(() => document.getElementById('editDesc').focus(), 60);
}

function closeEditModal(e) {
  if (e && e.target !== document.getElementById('editModal')) return;
  document.getElementById('editModal').style.display = 'none';
}

function saveEdit() {
  const id     = parseInt(document.getElementById('editId').value);
  const desc   = document.getElementById('editDesc').value.trim();
  const amount = parseFloat(document.getElementById('editAmount').value);
  const cat    = document.getElementById('editCategory').value;
  const date   = document.getElementById('editDate').value;
  const notes  = document.getElementById('editNotes').value.trim();

  if (!desc || !amount || amount <= 0 || !date) {
    showToast('Please fill all required fields.', 'error');
    return;
  }

  const idx = transactions.findIndex(t => t.id === id);
  if (idx !== -1) {
    transactions[idx] = { ...transactions[idx], type: editType, desc, amount, category: cat, date, notes };
    save();
    render();
    showToast('Transaction updated', 'success');
  }
  document.getElementById('editModal').style.display = 'none';
}

// ── Persist ────────────────────────────────────────────
function save() {
  localStorage.setItem('ledger_txns', JSON.stringify(transactions));
}
function saveBudgetData() {
  localStorage.setItem('ledger_budgets', JSON.stringify(budgets));
}

// ── Render ─────────────────────────────────────────────
function render() {
  renderSummary();
  renderTrendChart();
  renderCategoryBars();
  renderTransactions();
  if (budgetPanelOpen) renderBudgetInputs();
}

function fmt(n) {
  return '₹' + Number(n).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

// ── Summary with MoM comparison ───────────────────────
function renderSummary() {
  const [y, m] = viewMonth.split('-').map(Number);
  const prevDate  = new Date(y, m - 2, 1);
  const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;

  function totals(mo) {
    const txs     = transactions.filter(t => t.date.startsWith(mo));
    const income  = txs.filter(t => t.type === 'income' ).reduce((s, t) => s + t.amount, 0);
    const expense = txs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    return { income, expense, balance: income - expense };
  }

  const cur  = totals(viewMonth);
  const prev = totals(prevMonth);

  document.getElementById('totalIncome').textContent  = fmt(cur.income);
  document.getElementById('totalExpense').textContent = fmt(cur.expense);

  const balEl = document.getElementById('totalBalance');
  balEl.textContent = fmt(cur.balance);
  balEl.classList.toggle('negative', cur.balance < 0);

  function changeHtml(curVal, prevVal, lowerIsBetter = false) {
    if (!prevVal) return `<span class="change-neutral">— no prior data</span>`;
    const pct  = ((curVal - prevVal) / prevVal * 100).toFixed(1);
    const up   = parseFloat(pct) > 0;
    const good = lowerIsBetter ? !up : up;
    const cls  = parseFloat(pct) === 0 ? 'change-neutral' : (good ? 'change-good' : 'change-bad');
    const arrow = up ? '↑' : '↓';
    return `<span class="${cls}">${arrow} ${Math.abs(pct)}% vs last month</span>`;
  }

  document.getElementById('incomeChange').innerHTML  = changeHtml(cur.income,  prev.income);
  document.getElementById('expenseChange').innerHTML = changeHtml(cur.expense, prev.expense, true);
  document.getElementById('balanceChange').innerHTML = changeHtml(cur.balance, prev.balance);

  const daysInMonth  = new Date(y, m, 0).getDate();
  const today        = new Date();
  const isThisMonth  = viewMonth === today.toISOString().slice(0, 7);
  const daysElapsed  = isThisMonth ? today.getDate() : daysInMonth;
  const avgDaily     = daysElapsed > 0 ? cur.expense / daysElapsed : 0;

  document.getElementById('avgDaily').textContent = fmt(avgDaily);
  document.getElementById('avgDailyLabel').innerHTML =
    `<span class="change-neutral">Over ${daysElapsed} day${daysElapsed !== 1 ? 's' : ''}</span>`;
}

// ── 6-Month Trend Chart (SVG) ─────────────────────────
function renderTrendChart() {
  const container = document.getElementById('trendChart');
  const [y, m]    = viewMonth.split('-').map(Number);

  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d  = new Date(y, m - 1 - i, 1);
    const mo = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    months.push({
      mo,
      label:   d.toLocaleDateString('en-IN', { month: 'short' }),
      expense: transactions.filter(t => t.type === 'expense' && t.date.startsWith(mo)).reduce((s, t) => s + t.amount, 0),
      income:  transactions.filter(t => t.type === 'income'  && t.date.startsWith(mo)).reduce((s, t) => s + t.amount, 0),
    });
  }

  const maxVal  = Math.max(...months.map(mo => Math.max(mo.expense, mo.income)), 1);
  const W = 620, H = 160, padL = 8, padR = 8, padT = 16, padB = 32;
  const chartH  = H - padT - padB;
  const groupW  = (W - padL - padR) / months.length;
  const barW    = Math.floor(groupW * 0.3);

  let svg = '';

  // Gridlines
  [0.25, 0.5, 0.75, 1].forEach(frac => {
    const gy = padT + chartH - frac * chartH;
    svg += `<line x1="${padL}" y1="${gy}" x2="${W - padR}" y2="${gy}" class="grid-line"/>`;
  });

  // Bars + Labels
  months.forEach((mo, i) => {
    const cx       = padL + i * groupW + groupW / 2;
    const isActive = mo.mo === viewMonth;
    const cls      = isActive ? ' bar-active' : '';

    if (mo.income > 0) {
      const bh = (mo.income / maxVal) * chartH;
      svg += `<rect x="${cx + 2}" y="${padT + chartH - bh}" width="${barW}" height="${bh}" rx="3" class="bar-income${cls}"/>`;
    }
    if (mo.expense > 0) {
      const bh = (mo.expense / maxVal) * chartH;
      svg += `<rect x="${cx - barW - 2}" y="${padT + chartH - bh}" width="${barW}" height="${bh}" rx="3" class="bar-expense${cls}"/>`;
    }

    svg += `<text x="${cx}" y="${H - 8}" text-anchor="middle" class="chart-lbl${isActive ? ' chart-lbl-active' : ''}">${mo.label}</text>`;
  });

  // Baseline
  svg += `<line x1="${padL}" y1="${padT + chartH}" x2="${W - padR}" y2="${padT + chartH}" class="base-line"/>`;

  container.innerHTML = `<svg viewBox="0 0 ${W} ${H}" class="trend-svg">${svg}</svg>`;
}

// ── Category Bars ─────────────────────────────────────
function renderCategoryBars() {
  const expenses  = transactions.filter(t => t.type === 'expense' && t.date.startsWith(viewMonth));
  const budget    = budgets[viewMonth] || {};
  const container = document.getElementById('categoryBars');

  const byCategory = {};
  expenses.forEach(t => { byCategory[t.category] = (byCategory[t.category] || 0) + t.amount; });
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
      barWidth  = Math.min(pct, 100).toFixed(1);
      barColor  = pct > 100 ? 'var(--danger)' : pct > 80 ? 'var(--warning)' : 'var(--income)';
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
  const budget     = budgets[viewMonth] || {};
  const expenses   = transactions.filter(t => t.type === 'expense' && t.date.startsWith(viewMonth));
  const byCategory = {};
  expenses.forEach(t => { byCategory[t.category] = (byCategory[t.category] || 0) + t.amount; });

  document.getElementById('budgetInputsGrid').innerHTML = EXPENSE_CATEGORIES.map(cat => {
    const spent = byCategory[cat] || 0;
    const limit = budget[cat]     || '';
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

  if (!Object.keys(budgets[viewMonth]).length) delete budgets[viewMonth];
  saveBudgetData();
  renderCategoryBars();

  const btn = document.querySelector('.save-limits-btn');
  const orig = btn.textContent;
  btn.textContent = '✓ Saved!';
  setTimeout(() => { btn.textContent = orig; }, 2000);
}

// ── Transaction List ───────────────────────────────────
function renderTransactions() {
  const filterCat  = document.getElementById('filterCategory').value;
  const filterType = document.getElementById('filterType').value;
  const search     = (document.getElementById('searchInput').value || '').trim().toLowerCase();

  let filtered = transactions.filter(t => t.date.startsWith(viewMonth));
  if (filterCat  !== 'all') filtered = filtered.filter(t => t.category === filterCat);
  if (filterType !== 'all') filtered = filtered.filter(t => t.type     === filterType);
  if (search) {
    filtered = filtered.filter(t =>
      t.desc.toLowerCase().includes(search) ||
      t.category.toLowerCase().includes(search) ||
      (t.notes && t.notes.toLowerCase().includes(search))
    );
  }

  const list = document.getElementById('txList');

  if (!filtered.length) {
    list.innerHTML = `
      <div class="empty-state">
        <span class="empty-icon">⬡</span>
        <p>No transactions found.<br/>Try adjusting filters or search.</p>
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
            ${t.notes ? `<span class="tx-notes" title="${escapeHtml(t.notes)}">📝 ${escapeHtml(t.notes)}</span>` : ''}
          </div>
        </div>
        <div class="tx-right">
          <div class="tx-amount ${t.type}">${sign}${fmt(t.amount)}</div>
          <div class="tx-btns">
            <button class="edit-btn"   onclick="openEditModal(${t.id})"    title="Edit">✎</button>
            <button class="delete-btn" onclick="deleteTransaction(${t.id})" title="Delete">✕</button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// ── Export CSV ─────────────────────────────────────────
function exportCSV() {
  const filterCat  = document.getElementById('filterCategory').value;
  const filterType = document.getElementById('filterType').value;

  let data = transactions.filter(t => t.date.startsWith(viewMonth));
  if (filterCat  !== 'all') data = data.filter(t => t.category === filterCat);
  if (filterType !== 'all') data = data.filter(t => t.type     === filterType);

  if (!data.length) { showToast('No transactions to export', 'error'); return; }

  const headers = ['Date', 'Description', 'Category', 'Type', 'Amount (₹)', 'Notes'];
  const rows    = data.map(t => [
    t.date,
    `"${t.desc.replace(/"/g, '""')}"`,
    t.category,
    t.type,
    t.type === 'expense' ? -t.amount : t.amount,
    `"${(t.notes || '').replace(/"/g, '""')}"`,
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

// ── Print Report ───────────────────────────────────────
function printReport() {
  window.print();
}

// ── Toast ──────────────────────────────────────────────
function showToast(msg, type = 'success') {
  const toast   = document.getElementById('toast');
  toast.textContent = msg;
  toast.className   = `toast ${type} show`;
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => { toast.className = 'toast'; }, 3200);
}

function escapeHtml(str) {
  return str
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;');
}

// ── Start ──────────────────────────────────────────────
init();
