// ── Constants ──────────────────────────────────────────────
const COLORS = ['#c5f135','#35f1a0','#f1a535','#f13535','#35a8f1','#c535f1','#f135c5','#35f1f1','#ff6b35','#ffffff'];

const CATEGORY_ICONS = {
  Food:'🍜', Transport:'🚌', Shopping:'🛍️', Health:'💊',
  Entertainment:'🎬', Rent:'🏠', Bills:'💡', Insurance:'🛡️',
  Investment:'📈', Education:'📚', Travel:'✈️',
  Salary:'💼', Freelance:'💻', Business:'🏢', Other:'📦',
};

const EXPENSE_CATEGORIES = ['Food','Transport','Shopping','Health','Entertainment','Rent','Bills','Insurance','Investment','Education','Travel','Other'];
const INCOME_CATEGORIES  = ['Salary','Freelance','Business','Other'];

// ── State ──────────────────────────────────────────────────
let currentUser     = null;
let transactions    = [];
let budgets         = {};
let currentType     = 'expense';
let editType        = 'expense';
let viewMonth       = new Date().toISOString().slice(0,7);
let budgetPanelOpen = false;

// ── Storage ────────────────────────────────────────────────
function txKey()    { return `ledger_txns_${currentUser}`; }
function bdKey()    { return `ledger_budgets_${currentUser}`; }
function getUsers() { return JSON.parse(localStorage.getItem('ledger_users') || '{}'); }
function setUsers(u){ localStorage.setItem('ledger_users', JSON.stringify(u)); }

// ── Auth ───────────────────────────────────────────────────
function showTab(tab) {
  document.getElementById('signinPane').style.display = tab === 'signin' ? 'block' : 'none';
  document.getElementById('signupPane').style.display = tab === 'signup' ? 'block' : 'none';
  document.getElementById('tabSignin').classList.toggle('active', tab === 'signin');
  document.getElementById('tabSignup').classList.toggle('active', tab === 'signup');
}

function buildColorRow() {
  document.getElementById('colorRow').innerHTML = COLORS.map((c,i) =>
    `<span class="color-chip${i===0?' selected':''}" style="background:${c}" data-color="${c}" onclick="selectColor(this)"></span>`
  ).join('');
}

function selectColor(el) {
  document.querySelectorAll('.color-chip').forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');
}

function getSelectedColor() {
  const s = document.querySelector('.color-chip.selected');
  return s ? s.dataset.color : COLORS[0];
}

function renderExistingUsers() {
  const users = getUsers();
  const names = Object.keys(users);
  const el = document.getElementById('existingUsers');
  if (!names.length) { el.innerHTML = ''; return; }
  el.innerHTML = `<div class="eu-label">Tap to sign in quickly</div>` +
    names.map(name => {
      const color = users[name].color || COLORS[0];
      return `<div class="user-chip" onclick="quickSignIn('${escapeHtml(name)}')" style="--chip-color:${color}">
        <span class="uc-avatar" style="background:${color};color:#111">${name[0].toUpperCase()}</span>
        <span>${escapeHtml(name)}</span>
      </div>`;
    }).join('');
}

function quickSignIn(username) {
  document.getElementById('siUsername').value = username;
  showTab('signin');
  setTimeout(() => document.getElementById('siPassword').focus(), 60);
}

function doLogin() {
  const username = document.getElementById('siUsername').value.trim();
  const password = document.getElementById('siPassword').value;
  const err = document.getElementById('siError');
  const users = getUsers();
  if (!username) { err.textContent = 'Please enter your username.'; return; }
  if (!password) { err.textContent = 'Please enter your password.'; return; }
  if (!users[username]) { err.textContent = 'Username not found. Create an account first.'; return; }
  if (users[username].password !== password) { err.textContent = 'Wrong password. Try again.'; return; }
  err.textContent = '';
  loadUser(username);
}

function doSignup() {
  const username = document.getElementById('suUsername').value.trim();
  const password = document.getElementById('suPassword').value;
  const color    = getSelectedColor();
  const err = document.getElementById('suError');
  const users = getUsers();
  if (!username || username.length < 2) { err.textContent = 'Username must be at least 2 characters.'; return; }
  if (password.length < 4) { err.textContent = 'Password must be at least 4 characters.'; return; }
  if (users[username]) { err.textContent = 'Username already taken. Pick another.'; return; }
  users[username] = { password, color };
  setUsers(users);
  err.textContent = '';
  loadUser(username);
}

function loadUser(username) {
  currentUser  = username;
  transactions = JSON.parse(localStorage.getItem(txKey()) || '[]');
  budgets      = JSON.parse(localStorage.getItem(bdKey()) || '{}');

  const users = getUsers();
  const color = (users[username] || {}).color || COLORS[0];

  const av = document.getElementById('userAvatar');
  av.textContent      = username[0].toUpperCase();
  av.style.background = color;
  av.style.color      = '#111';
  av.title            = username;

  document.getElementById('headerTagline').textContent = `Hi, ${username}!`;

  const savedTheme = localStorage.getItem(`ledger_theme_${username}`) || 'dark';
  applyTheme(savedTheme);

  document.getElementById('loginPage').style.display = 'none';
  document.getElementById('appPage').style.display   = '';

  document.getElementById('date').value = new Date().toISOString().split('T')[0];
  document.getElementById('currentDate').textContent = new Date().toLocaleDateString('en-IN', {
    weekday:'long', year:'numeric', month:'long', day:'numeric'
  });

  viewMonth = new Date().toISOString().slice(0,7);
  updateViewMonthLabel();
  buildCatScrollers();
  render();
}

function logout() {
  currentUser  = null;
  transactions = [];
  budgets      = {};
  closeSheet();
  document.getElementById('appPage').style.display   = 'none';
  document.getElementById('loginPage').style.display = '';
  document.getElementById('siUsername').value  = '';
  document.getElementById('siPassword').value  = '';
  document.getElementById('siError').textContent = '';
  renderExistingUsers();
}

// ── Theme ──────────────────────────────────────────────────
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  document.getElementById('themeToggle').textContent = theme === 'dark' ? '☀' : '☾';
}

function toggleTheme() {
  const cur  = document.documentElement.getAttribute('data-theme');
  const next = cur === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  if (currentUser) localStorage.setItem(`ledger_theme_${currentUser}`, next);
}

// ── Category Scroller ──────────────────────────────────────
function buildCatScrollers() {
  buildCatScroller('catScroller',     'category',     currentType);
  buildCatScroller('editCatScroller', 'editCategory', 'expense');
}

function buildCatScroller(scrollerId, hiddenId, type) {
  const cats   = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  const hidden = document.getElementById(hiddenId);
  if (!cats.includes(hidden.value)) hidden.value = cats[0];

  document.getElementById(scrollerId).innerHTML = cats.map(cat => `
    <button type="button" class="cat-btn${hidden.value === cat ? ' active' : ''}"
            onclick="selectCat('${scrollerId}','${hiddenId}','${cat}')">
      <span class="cat-emoji">${CATEGORY_ICONS[cat]||'📦'}</span>
      <span class="cat-name">${cat}</span>
    </button>
  `).join('');
}

function selectCat(scrollerId, hiddenId, cat) {
  document.getElementById(hiddenId).value = cat;
  document.querySelectorAll(`#${scrollerId} .cat-btn`).forEach(b => {
    b.classList.toggle('active', b.querySelector('.cat-name').textContent === cat);
  });
}

// ── Month Navigation ───────────────────────────────────────
function changeViewMonth(delta) {
  const [y,m] = viewMonth.split('-').map(Number);
  const d     = new Date(y, m - 1 + delta, 1);
  viewMonth   = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  updateViewMonthLabel();
  render();
}

function updateViewMonthLabel() {
  const [y,m] = viewMonth.split('-').map(Number);
  document.getElementById('viewMonthLabel').textContent =
    new Date(y, m-1, 1).toLocaleDateString('en-IN', { month:'long', year:'numeric' });
}

// ── Income Period ──────────────────────────────────────────
function selectPeriod(el) {
  document.querySelectorAll('#periodPills .period-pill').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  document.getElementById('period').value = el.dataset.p;
}

function selectEditPeriod(el) {
  document.querySelectorAll('#editPeriodPills .period-pill').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  document.getElementById('editPeriod').value = el.dataset.p;
}

const PERIOD_LABELS = { monthly:'Monthly', weekly:'Weekly', yearly:'Yearly', 'one-time':'One-time' };

// ── Transaction Type Toggle ────────────────────────────────
function setType(type) {
  currentType = type;
  document.getElementById('btnExpense').classList.toggle('active', type === 'expense');
  document.getElementById('btnIncome').classList.toggle('active',  type === 'income');
  document.getElementById('category').value = type === 'income' ? 'Salary' : 'Food';
  document.getElementById('periodGroup').style.display = type === 'income' ? 'flex' : 'none';
  buildCatScroller('catScroller', 'category', type);
}

function setEditType(type) {
  editType = type;
  document.getElementById('editBtnExpense').classList.toggle('active', type === 'expense');
  document.getElementById('editBtnIncome').classList.toggle('active',  type === 'income');
  document.getElementById('editPeriodGroup').style.display = type === 'income' ? 'flex' : 'none';
  buildCatScroller('editCatScroller', 'editCategory', type);
}

// ── Mobile Sheet ───────────────────────────────────────────
function toggleSheet() {
  const isOpen = document.getElementById('formPanel').classList.contains('open');
  if (isOpen) closeSheet(); else openSheet();
}

function openSheet() {
  document.getElementById('formPanel').classList.add('open');
  document.getElementById('sheetOverlay').classList.add('visible');
  document.getElementById('fab').innerHTML = '✕';
  document.body.style.overflow = 'hidden';
}

function closeSheet() {
  document.getElementById('formPanel').classList.remove('open');
  document.getElementById('sheetOverlay').classList.remove('visible');
  const fab = document.getElementById('fab');
  if (fab) fab.innerHTML = '+';
  document.body.style.overflow = '';
}

// ── Add Transaction ────────────────────────────────────────
function addTransaction() {
  const desc   = document.getElementById('desc').value.trim();
  const amount = parseFloat(document.getElementById('amount').value);
  const cat    = document.getElementById('category').value;
  const date   = document.getElementById('date').value;
  const notes  = document.getElementById('notes').value.trim();
  const period = currentType === 'income' ? document.getElementById('period').value : null;
  const err    = document.getElementById('formError');

  if (!desc)                  { err.textContent = '⚠ What was this for?'; return; }
  if (!amount || amount <= 0) { err.textContent = '⚠ Enter a valid amount.'; return; }
  if (!date)                  { err.textContent = '⚠ Please pick a date.'; return; }
  err.textContent = '';

  transactions.unshift({ id: Date.now(), type: currentType, desc, amount, category: cat, date, notes, period });
  save();
  render();

  // Keep date + category so next entry for same day/category is instant
  document.getElementById('desc').value   = '';
  document.getElementById('amount').value = '';
  document.getElementById('notes').value  = '';
  document.getElementById('desc').focus();

  // Flash button
  const btn = document.getElementById('addBtn');
  btn.textContent = '✓ Added!';
  btn.style.background = 'var(--income)';
  setTimeout(() => { btn.textContent = '+ Add Transaction'; btn.style.background = ''; }, 1400);

  // Today count
  updateTodayCount(date);

  if (currentType === 'expense') {
    const txMonth = date.slice(0,7);
    const limit   = (budgets[txMonth] || {})[cat];
    if (limit) {
      const spent = transactions
        .filter(t => t.type==='expense' && t.category===cat && t.date.startsWith(txMonth))
        .reduce((s,t) => s + t.amount, 0);
      if (spent > limit) {
        showToast(`⚠ Over ${cat} budget by ${fmt(spent - limit)}`, 'warning');
        return;
      }
    }
  }
  showToast('✓ Added! Pick next category to add more.', 'success');
}

// ── Delete Transaction ─────────────────────────────────────
function deleteTransaction(id) {
  if (!confirm('Delete this transaction?')) return;
  transactions = transactions.filter(t => t.id !== id);
  save(); render();
  showToast('Deleted', 'error');
}

// ── Edit Modal ─────────────────────────────────────────────
function openEditModal(id) {
  const tx = transactions.find(t => t.id === id);
  if (!tx) return;
  document.getElementById('editId').value       = tx.id;
  document.getElementById('editDesc').value     = tx.desc;
  document.getElementById('editAmount').value   = tx.amount;
  document.getElementById('editCategory').value = tx.category;
  document.getElementById('editDate').value     = tx.date;
  document.getElementById('editNotes').value    = tx.notes || '';

  // Period
  const pg = document.getElementById('editPeriodGroup');
  pg.style.display = tx.type === 'income' ? 'flex' : 'none';
  if (tx.type === 'income') {
    const p = tx.period || 'monthly';
    document.getElementById('editPeriod').value = p;
    document.querySelectorAll('#editPeriodPills .period-pill').forEach(b => {
      b.classList.toggle('active', b.dataset.p === p);
    });
  }

  editType = tx.type;
  document.getElementById('editBtnExpense').classList.toggle('active', tx.type === 'expense');
  document.getElementById('editBtnIncome').classList.toggle('active',  tx.type === 'income');
  buildCatScroller('editCatScroller', 'editCategory', tx.type);
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
  const editPeriod = editType === 'income' ? document.getElementById('editPeriod').value : null;
  if (!desc || !amount || amount <= 0 || !date) { showToast('Please fill all required fields.', 'error'); return; }
  const idx = transactions.findIndex(t => t.id === id);
  if (idx !== -1) {
    transactions[idx] = { ...transactions[idx], type: editType, desc, amount, category: cat, date, notes, period: editPeriod };
    save(); render();
    showToast('Updated!', 'success');
  }
  document.getElementById('editModal').style.display = 'none';
}

// ── Save ───────────────────────────────────────────────────
function save()           { localStorage.setItem(txKey(), JSON.stringify(transactions)); }
function saveBudgetData() { localStorage.setItem(bdKey(), JSON.stringify(budgets)); }

// ── Render ─────────────────────────────────────────────────
function render() {
  renderSummary();
  renderTrendChart();
  renderCategoryBars();
  renderTransactions();
  if (budgetPanelOpen) renderBudgetInputs();
}

function fmt(n) {
  return '₹' + Number(n).toLocaleString('en-IN', { minimumFractionDigits:0, maximumFractionDigits:2 });
}

// ── Summary ────────────────────────────────────────────────
function renderSummary() {
  const [y,m]     = viewMonth.split('-').map(Number);
  const prevDate  = new Date(y, m-2, 1);
  const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth()+1).padStart(2,'0')}`;

  function totals(mo) {
    const txs    = transactions.filter(t => t.date.startsWith(mo));
    const income = txs.filter(t => t.type==='income' ).reduce((s,t) => s+t.amount, 0);
    const expense= txs.filter(t => t.type==='expense').reduce((s,t) => s+t.amount, 0);
    return { income, expense, balance: income - expense };
  }

  const cur  = totals(viewMonth);
  const prev = totals(prevMonth);

  document.getElementById('totalIncome').textContent  = fmt(cur.income);
  document.getElementById('totalExpense').textContent = fmt(cur.expense);
  const balEl = document.getElementById('totalBalance');
  balEl.textContent = fmt(cur.balance);
  balEl.classList.toggle('negative', cur.balance < 0);

  function changeHtml(curVal, prevVal, lowerIsBetter=false) {
    if (!prevVal) return `<span class="change-neutral">— first month</span>`;
    const pct  = ((curVal - prevVal) / prevVal * 100).toFixed(1);
    const up   = parseFloat(pct) > 0;
    const good = lowerIsBetter ? !up : up;
    const cls  = parseFloat(pct)===0 ? 'change-neutral' : (good ? 'change-good' : 'change-bad');
    return `<span class="${cls}">${up?'↑':'↓'} ${Math.abs(pct)}% vs last month</span>`;
  }

  document.getElementById('incomeChange').innerHTML  = changeHtml(cur.income,  prev.income);
  document.getElementById('expenseChange').innerHTML = changeHtml(cur.expense, prev.expense, true);
  document.getElementById('balanceChange').innerHTML = changeHtml(cur.balance, prev.balance);

  const daysInMonth = new Date(y, m, 0).getDate();
  const today       = new Date();
  const isThisMonth = viewMonth === today.toISOString().slice(0,7);
  const daysElapsed = isThisMonth ? today.getDate() : daysInMonth;
  const avgDaily    = daysElapsed > 0 ? cur.expense / daysElapsed : 0;
  document.getElementById('avgDaily').textContent = fmt(avgDaily);
  document.getElementById('avgDailyLabel').innerHTML =
    `<span class="change-neutral">Over ${daysElapsed} day${daysElapsed!==1?'s':''}</span>`;
}

// ── Trend Chart ────────────────────────────────────────────
function renderTrendChart() {
  const container = document.getElementById('trendChart');
  const [y,m]     = viewMonth.split('-').map(Number);
  const months    = [];
  for (let i=5; i>=0; i--) {
    const d  = new Date(y, m-1-i, 1);
    const mo = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    months.push({
      mo,
      label:   d.toLocaleDateString('en-IN', { month:'short' }),
      expense: transactions.filter(t => t.type==='expense' && t.date.startsWith(mo)).reduce((s,t) => s+t.amount,0),
      income:  transactions.filter(t => t.type==='income'  && t.date.startsWith(mo)).reduce((s,t) => s+t.amount,0),
    });
  }
  const maxVal = Math.max(...months.map(mo => Math.max(mo.expense, mo.income)), 1);
  const W=620, H=160, padL=8, padR=8, padT=16, padB=32;
  const chartH = H - padT - padB;
  const groupW = (W - padL - padR) / months.length;
  const barW   = Math.floor(groupW * 0.3);

  let svg = '';
  [0.25,0.5,0.75,1].forEach(frac => {
    const gy = padT + chartH - frac * chartH;
    svg += `<line x1="${padL}" y1="${gy}" x2="${W-padR}" y2="${gy}" class="grid-line"/>`;
  });
  months.forEach((mo,i) => {
    const cx = padL + i * groupW + groupW / 2;
    const isActive = mo.mo === viewMonth;
    const cls = isActive ? ' bar-active' : '';
    if (mo.income > 0) {
      const bh = (mo.income / maxVal) * chartH;
      svg += `<rect x="${cx+2}" y="${padT+chartH-bh}" width="${barW}" height="${bh}" rx="3" class="bar-income${cls}"/>`;
    }
    if (mo.expense > 0) {
      const bh = (mo.expense / maxVal) * chartH;
      svg += `<rect x="${cx-barW-2}" y="${padT+chartH-bh}" width="${barW}" height="${bh}" rx="3" class="bar-expense${cls}"/>`;
    }
    svg += `<text x="${cx}" y="${H-8}" text-anchor="middle" class="chart-lbl${isActive?' chart-lbl-active':''}">${mo.label}</text>`;
  });
  svg += `<line x1="${padL}" y1="${padT+chartH}" x2="${W-padR}" y2="${padT+chartH}" class="base-line"/>`;
  container.innerHTML = `<svg viewBox="0 0 ${W} ${H}" class="trend-svg">${svg}</svg>`;
}

// ── Category Bars ──────────────────────────────────────────
function renderCategoryBars() {
  const expenses   = transactions.filter(t => t.type==='expense' && t.date.startsWith(viewMonth));
  const budget     = budgets[viewMonth] || {};
  const container  = document.getElementById('categoryBars');
  const byCategory = {};
  expenses.forEach(t => { byCategory[t.category] = (byCategory[t.category]||0) + t.amount; });
  Object.keys(budget).forEach(cat => { if (!byCategory[cat]) byCategory[cat] = 0; });

  if (!Object.keys(byCategory).length) {
    container.innerHTML = '<p class="empty-hint">No expenses this month.</p>';
    return;
  }
  const sorted = Object.entries(byCategory).sort((a,b) => b[1]-a[1]);
  const maxRaw = Math.max(...sorted.map(([,v]) => v), 1);

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
        <div class="bar-label">${CATEGORY_ICONS[cat]||'📦'} ${cat}</div>
        <div class="bar-track"><div class="bar-fill" style="width:${barWidth}%;background:${barColor}"></div></div>
        <div class="bar-amount${overBudget?' over':''}">${fmt(total)}${limit?`<span class="bar-limit-text"> / ${fmt(limit)}</span>`:''}</div>
      </div>
      ${overBudget ? `<div class="over-budget-msg">⚠ Over by ${fmt(total-limit)}</div>` : ''}
    `;
  }).join('');
}

// ── Budget Panel ───────────────────────────────────────────
function toggleBudgetPanel() {
  budgetPanelOpen = !budgetPanelOpen;
  document.getElementById('budgetInputsPanel').style.display = budgetPanelOpen ? 'block' : 'none';
  const btn = document.getElementById('setLimitsBtn');
  btn.textContent = budgetPanelOpen ? '✕ Close' : '⊕ Set Budgets';
  btn.classList.toggle('active', budgetPanelOpen);
  if (budgetPanelOpen) renderBudgetInputs();
}

function renderBudgetInputs() {
  const budget     = budgets[viewMonth] || {};
  const expenses   = transactions.filter(t => t.type==='expense' && t.date.startsWith(viewMonth));
  const byCategory = {};
  expenses.forEach(t => { byCategory[t.category] = (byCategory[t.category]||0) + t.amount; });
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
          <input type="number" class="budget-input" data-cat="${cat}" value="${limit}" placeholder="No limit" min="0" step="100"/>
        </div>
      </div>`;
  }).join('');
}

function saveLimits() {
  if (!budgets[viewMonth]) budgets[viewMonth] = {};
  document.querySelectorAll('.budget-input').forEach(input => {
    const cat = input.dataset.cat;
    const val = parseFloat(input.value);
    if (!isNaN(val) && val > 0) budgets[viewMonth][cat] = val;
    else delete budgets[viewMonth][cat];
  });
  if (!Object.keys(budgets[viewMonth]).length) delete budgets[viewMonth];
  saveBudgetData();
  renderCategoryBars();
  const btn = document.querySelector('.save-limits-btn');
  const orig = btn.textContent;
  btn.textContent = '✓ Saved!';
  setTimeout(() => { btn.textContent = orig; }, 2000);
}

// ── Transaction List ───────────────────────────────────────
function renderTransactions() {
  const filterCat  = document.getElementById('filterCategory').value;
  const filterType = document.getElementById('filterType').value;
  const search     = (document.getElementById('searchInput').value || '').trim().toLowerCase();

  let filtered = transactions.filter(t => t.date.startsWith(viewMonth));
  if (filterCat  !== 'all') filtered = filtered.filter(t => t.category === filterCat);
  if (filterType !== 'all') filtered = filtered.filter(t => t.type     === filterType);
  if (search) filtered = filtered.filter(t =>
    t.desc.toLowerCase().includes(search) ||
    t.category.toLowerCase().includes(search) ||
    (t.notes && t.notes.toLowerCase().includes(search))
  );

  const list = document.getElementById('txList');
  if (!filtered.length) {
    list.innerHTML = `<div class="empty-state"><span class="empty-icon">📭</span><p>No transactions yet.<br/>Tap <strong>+ Add</strong> to get started!</p></div>`;
    return;
  }

  list.innerHTML = filtered.map(t => {
    const sign    = t.type === 'expense' ? '-' : '+';
    const dateStr = new Date(t.date + 'T00:00:00').toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' });
    return `
      <div class="tx-item">
        <div class="tx-icon">${CATEGORY_ICONS[t.category]||'📦'}</div>
        <div class="tx-info">
          <div class="tx-desc">${escapeHtml(t.desc)}</div>
          <div class="tx-meta">
            <span>${dateStr}</span>
            <span class="tx-tag">${t.category}</span>
            ${t.type === 'income' && t.period ? `<span class="tx-period">${PERIOD_LABELS[t.period]||t.period}</span>` : ''}
            ${t.notes ? `<span class="tx-notes">📝 ${escapeHtml(t.notes)}</span>` : ''}
          </div>
        </div>
        <div class="tx-right">
          <div class="tx-amount ${t.type}">${sign}${fmt(t.amount)}</div>
          <div class="tx-btns">
            <button class="edit-btn"   onclick="openEditModal(${t.id})" title="Edit">✎</button>
            <button class="delete-btn" onclick="deleteTransaction(${t.id})" title="Delete">✕</button>
          </div>
        </div>
      </div>`;
  }).join('');
}

// ── Today Count ────────────────────────────────────────────
function updateTodayCount(date) {
  const count = transactions.filter(t => t.date === date).length;
  const el = document.getElementById('todayCount');
  if (el) el.textContent = count > 1 ? `${count} entries on ${formatDate(date)}` : '';
}

function formatDate(d) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day:'numeric', month:'short' });
}

// ── Export ─────────────────────────────────────────────────
function exportCSV() {
  const filterCat  = document.getElementById('filterCategory').value;
  const filterType = document.getElementById('filterType').value;
  let data = transactions.filter(t => t.date.startsWith(viewMonth));
  if (filterCat  !== 'all') data = data.filter(t => t.category === filterCat);
  if (filterType !== 'all') data = data.filter(t => t.type     === filterType);
  if (!data.length) { showToast('Nothing to export', 'error'); return; }
  const headers = ['Date','Description','Category','Type','Amount (₹)','Notes'];
  const rows    = data.map(t => [
    t.date, `"${t.desc.replace(/"/g,'""')}"`, t.category, t.type,
    t.type==='expense' ? -t.amount : t.amount,
    `"${(t.notes||'').replace(/"/g,'""')}"`,
  ]);
  const csv  = [headers,...rows].map(r => r.join(',')).join('\n');
  const blob = new Blob([csv], { type:'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = `ledger_${viewMonth}_${currentUser}.csv`; a.click();
  URL.revokeObjectURL(url);
  showToast('Exported!', 'success');
}

function printReport() { window.print(); }

// ── Toast ──────────────────────────────────────────────────
function showToast(msg, type='success') {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.className   = `toast ${type} show`;
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => { toast.className = 'toast'; }, 3200);
}

function escapeHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Init ───────────────────────────────────────────────────
function init() {
  buildColorRow();
  renderExistingUsers();
  showTab('signin');

  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      if (document.getElementById('editModal').style.display !== 'none') saveEdit();
      else if (currentUser) addTransaction();
    }
    if (e.key === 'Escape') {
      closeEditModal();
      closeSheet();
    }
  });
}

init();
