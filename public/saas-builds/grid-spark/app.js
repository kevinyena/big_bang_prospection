const STORAGE_KEY = 'gridspark_data';

const CATEGORIES = [
  { name: 'Salaire', type: 'income', color: '#00FFA3', icon: 'fa-money-bill-trend-up' },
  { name: 'Freelance', type: 'income', color: '#00F0FF', icon: 'fa-laptop-code' },
  { name: 'Investissement', type: 'income', color: '#7CFFCB', icon: 'fa-chart-line' },
  { name: 'Autre revenu', type: 'income', color: '#5EEAD4', icon: 'fa-circle-plus' },
  { name: 'Alimentation', type: 'expense', color: '#FF2EC4', icon: 'fa-utensils' },
  { name: 'Transport', type: 'expense', color: '#00F0FF', icon: 'fa-car' },
  { name: 'Logement', type: 'expense', color: '#FF3B6B', icon: 'fa-house' },
  { name: 'Loisirs', type: 'expense', color: '#A78BFA', icon: 'fa-gamepad' },
  { name: 'Santé', type: 'expense', color: '#34D399', icon: 'fa-heart-pulse' },
  { name: 'Shopping', type: 'expense', color: '#FBBF24', icon: 'fa-bag-shopping' },
  { name: 'Abonnements', type: 'expense', color: '#F472B6', icon: 'fa-repeat' },
  { name: 'Autre dépense', type: 'expense', color: '#8A8AA0', icon: 'fa-ellipsis' }
];

const CAT_MAP = Object.fromEntries(CATEGORIES.map(c => [c.name, c]));

const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'id-' + Date.now() + '-' + Math.random().toString(16).slice(2));

const fmtCurrency = (v) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(v || 0);
const fmtCurrencyShort = (v) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(v || 0) + ' €';
const fmtDate = (iso) => new Date(iso + 'T00:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
const monthKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
const monthLabel = (d) => d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

/* ---------- Storage Service ---------- */
const Store = {
  read() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { transactions: [], settings: { currency: 'EUR', theme: 'dark' } };
      const data = JSON.parse(raw);
      if (!Array.isArray(data.transactions)) data.transactions = [];
      if (!data.settings) data.settings = { currency: 'EUR', theme: 'dark' };
      return data;
    } catch {
      return { transactions: [], settings: { currency: 'EUR', theme: 'dark' } };
    }
  },
  write(data) { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); },
  all() { return this.read().transactions; },
  getTransactions(month) {
    const tx = this.all();
    return (month ? tx.filter(t => t.date && t.date.startsWith(month)) : tx)
      .sort((a, b) => b.date.localeCompare(a.date));
  },
  addTransaction(d) {
    const data = this.read();
    const t = { id: uid(), type: d.type, amount: +d.amount, category: d.category, description: d.description || '', date: d.date };
    data.transactions.push(t);
    this.write(data);
    return t;
  },
  updateTransaction(id, d) {
    const data = this.read();
    const i = data.transactions.findIndex(t => t.id === id);
    if (i === -1) return null;
    data.transactions[i] = { ...data.transactions[i], type: d.type, amount: +d.amount, category: d.category, description: d.description || '', date: d.date };
    this.write(data);
    return data.transactions[i];
  },
  deleteTransaction(id) {
    const data = this.read();
    data.transactions = data.transactions.filter(t => t.id !== id);
    this.write(data);
  },
  getStats(month) {
    const tx = this.getTransactions(month);
    const income = tx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const expense = tx.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    const balance = income - expense;
    const savings = income > 0 ? (balance / income) * 100 : 0;
    return { income, expense, balance, savings };
  },
  getCategories() { return CATEGORIES; }
};

/* ---------- App State ---------- */
const state = {
  current: new Date(),
  view: 'dashboard',
  editingId: null,
  search: '',
  typeFilter: 'all'
};
const charts = { doughnut: null, line: null, bar: null };

/* ---------- DOM ---------- */
const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));

/* ---------- Toast ---------- */
let toastTimer;
function toast(msg, type = 'success') {
  const el = $('#toast');
  el.textContent = msg;
  el.className = 'toast show ' + type;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.className = 'toast ' + type; }, 2800);
}

/* ---------- Navigation ---------- */
function setView(view) {
  state.view = view;
  $$('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.view === view));
  $$('.view').forEach(v => v.classList.remove('active'));
  $('#view-' + view).classList.add('active');
  closeSidebar();
  if (view === 'transactions') renderTable();
  if (view === 'categories') renderCategories();
}

function openSidebar() { $('#sidebar').classList.add('open'); $('#sidebarOverlay').classList.add('show'); }
function closeSidebar() { $('#sidebar').classList.remove('open'); $('#sidebarOverlay').classList.remove('show'); }

/* ---------- Month ---------- */
function shiftMonth(delta) {
  state.current = new Date(state.current.getFullYear(), state.current.getMonth() + delta, 1);
  refresh();
}
function updateMonthLabel() { $('#monthLabel').textContent = monthLabel(state.current); }

/* ---------- KPIs ---------- */
function renderKpis() {
  const s = Store.getStats(monthKey(state.current));
  $('#kpiBalance').textContent = fmtCurrency(s.balance);
  $('#kpiIncome').textContent = fmtCurrency(s.income);
  $('#kpiExpense').textContent = fmtCurrency(s.expense);
  $('#kpiSavings').textContent = `${s.savings.toFixed(1)} %`;
  $('#kpiBalance').style.color = s.balance >= 0 ? 'var(--cyan)' : 'var(--danger)';
}

/* ---------- Recent ---------- */
function renderRecent() {
  const list = $('#recentList');
  const tx = Store.getTransactions(monthKey(state.current)).slice(0, 6);
  if (!tx.length) { list.innerHTML = `<p class="empty-chart" style="position:static;padding:30px 0">Aucune transaction</p>`; return; }
  list.innerHTML = tx.map(t => {
    const c = CAT_MAP[t.category] || CAT_MAP['Autre dépense'];
    const sign = t.type === 'income' ? '+' : '−';
    return `<li class="recent-item">
      <span class="recent-dot" style="background:${c.color}1f;color:${c.color}"><i class="fa-solid ${c.icon}"></i></span>
      <div class="recent-info"><strong>${escapeHtml(t.description || t.category)}</strong><span>${t.category} · ${fmtDate(t.date)}</span></div>
      <span class="recent-amount ${t.type === 'income' ? 'amt-income' : 'amt-expense'}">${sign}${fmtCurrency(t.amount)}</span>
    </li>`;
  }).join('');
}

/* ---------- Charts ---------- */
const baseFont = { family: "'Inter', sans-serif" };
function chartDefaults() {
  Chart.defaults.color = '#8A8AA0';
  Chart.defaults.font.family = "'Inter', sans-serif";
  Chart.defaults.borderColor = 'rgba(255,255,255,.06)';
}

function tooltipCfg() {
  return {
    backgroundColor: 'rgba(19,19,26,.95)',
    borderColor: 'rgba(255,255,255,.12)',
    borderWidth: 1,
    titleColor: '#EAEAF2',
    bodyColor: '#EAEAF2',
    padding: 12,
    cornerRadius: 10,
    titleFont: { family: "'Space Grotesk', sans-serif", weight: '600' },
    bodyFont: { family: "'JetBrains Mono', monospace" }
  };
}

function renderDoughnut() {
  const tx = Store.getTransactions(monthKey(state.current)).filter(t => t.type === 'expense');
  const totals = {};
  tx.forEach(t => { totals[t.category] = (totals[t.category] || 0) + t.amount; });
  const labels = Object.keys(totals);
  const empty = $('#doughnutEmpty');
  const canvas = $('#categoryDoughnut');
  if (charts.doughnut) { charts.doughnut.destroy(); charts.doughnut = null; }
  if (!labels.length) { empty.hidden = false; canvas.style.display = 'none'; return; }
  empty.hidden = true; canvas.style.display = 'block';
  charts.doughnut = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data: labels.map(l => totals[l]),
        backgroundColor: labels.map(l => (CAT_MAP[l] || {}).color || '#8A8AA0'),
        borderColor: 'rgba(10,10,15,.6)',
        borderWidth: 2,
        hoverOffset: 8
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false, cutout: '64%',
      plugins: {
        legend: { position: 'right', labels: { boxWidth: 12, padding: 14, font: { size: 12 } } },
        tooltip: { ...tooltipCfg(), callbacks: { label: (ctx) => ` ${ctx.label}: ${fmtCurrency(ctx.parsed)}` } }
      },
      animation: { animateScale: true, duration: 700 }
    }
  });
}

function renderLine() {
  const mk = monthKey(state.current);
  const tx = Store.getTransactions(mk).slice().sort((a, b) => a.date.localeCompare(b.date));
  const empty = $('#lineEmpty');
  const canvas = $('#balanceLine');
  if (charts.line) { charts.line.destroy(); charts.line = null; }
  if (!tx.length) { empty.hidden = false; canvas.style.display = 'none'; return; }
  empty.hidden = true; canvas.style.display = 'block';
  const daysInMonth = new Date(state.current.getFullYear(), state.current.getMonth() + 1, 0).getDate();
  const daily = new Array(daysInMonth + 1).fill(0);
  tx.forEach(t => { const d = new Date(t.date + 'T00:00:00').getDate(); daily[d] += t.type === 'income' ? t.amount : -t.amount; });
  let cum = 0; const labels = [], data = [];
  for (let d = 1; d <= daysInMonth; d++) { cum += daily[d]; labels.push(String(d)); data.push(+cum.toFixed(2)); }
  const ctx2d = canvas.getContext('2d');
  const grad = ctx2d.createLinearGradient(0, 0, 0, 300);
  grad.addColorStop(0, 'rgba(0,240,255,.35)');
  grad.addColorStop(1, 'rgba(0,240,255,0)');
  charts.line = new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Solde cumulé', data, borderColor: '#00F0FF', backgroundColor: grad,
        fill: true, tension: .35, pointRadius: 0, pointHoverRadius: 5,
        pointHoverBackgroundColor: '#00F0FF', borderWidth: 2.5
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { intersect: false, mode: 'index' },
      plugins: {
        legend: { display: false },
        tooltip: { ...tooltipCfg(), callbacks: { title: (i) => `Jour ${i[0].label}`, label: (ctx) => ` ${fmtCurrency(ctx.parsed.y)}` } }
      },
      scales: {
        x: { grid: { display: false }, ticks: { maxTicksLimit: 10 } },
        y: { grid: { color: 'rgba(255,255,255,.05)' }, ticks: { callback: (v) => fmtCurrencyShort(v) } }
      },
      animation: { duration: 700 }
    }
  });
}

function renderBar() {
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(state.current.getFullYear(), state.current.getMonth() - i, 1);
    months.push({ key: monthKey(d), label: d.toLocaleDateString('fr-FR', { month: 'short' }) });
  }
  const income = [], expense = [];
  months.forEach(m => {
    const s = Store.getStats(m.key);
    income.push(+s.income.toFixed(2)); expense.push(+s.expense.toFixed(2));
  });
  const canvas = $('#incomeExpenseBar');
  if (charts.bar) { charts.bar.destroy(); charts.bar = null; }
  charts.bar = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: months.map(m => m.label),
      datasets: [
        { label: 'Revenus', data: income, backgroundColor: 'rgba(0,255,163,.7)', hoverBackgroundColor: '#00FFA3', borderRadius: 6, borderSkipped: false },
        { label: 'Dépenses', data: expense, backgroundColor: 'rgba(255,59,107,.7)', hoverBackgroundColor: '#FF3B6B', borderRadius: 6, borderSkipped: false }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { labels: { boxWidth: 12, padding: 14, usePointStyle: true } },
        tooltip: { ...tooltipCfg(), callbacks: { label: (ctx) => ` ${ctx.dataset.label}: ${fmtCurrency(ctx.parsed.y)}` } }
      },
      scales: {
        x: { grid: { display: false } },
        y: { grid: { color: 'rgba(255,255,255,.05)' }, ticks: { callback: (v) => fmtCurrencyShort(v) } }
      },
      animation: { duration: 700 }
    }
  });
}

/* ---------- Transactions table ---------- */
function renderTable() {
  const body = $('#txTableBody');
  const empty = $('#txEmpty');
  let tx = Store.getTransactions(monthKey(state.current));
  if (state.typeFilter !== 'all') tx = tx.filter(t => t.type === state.typeFilter);
  if (state.search) {
    const q = state.search.toLowerCase();
    tx = tx.filter(t => (t.description || '').toLowerCase().includes(q) || t.category.toLowerCase().includes(q));
  }
  if (!tx.length) { body.innerHTML = ''; empty.hidden = false; return; }
  empty.hidden = true;
  body.innerHTML = tx.map(t => {
    const c = CAT_MAP[t.category] || CAT_MAP['Autre dépense'];
    const sign = t.type === 'income' ? '+' : '−';
    return `<tr>
      <td class="mono">${fmtDate(t.date)}</td>
      <td><span class="cat-pill" style="background:${c.color}1a;color:${c.color}"><span class="dot" style="background:${c.color}"></span>${t.category}</span></td>
      <td>${escapeHtml(t.description || '—')}</td>
      <td class="ta-right mono ${t.type === 'income' ? 'amt-income' : 'amt-expense'}">${sign}${fmtCurrency(t.amount)}</td>
      <td class="ta-right"><div class="row-actions">
        <button class="edit" data-edit="${t.id}" aria-label="Éditer"><i class="fa-solid fa-pen"></i></button>
        <button class="del" data-del="${t.id}" aria-label="Supprimer"><i class="fa-solid fa-trash"></i></button>
      </div></td>
    </tr>`;
  }).join('');
  body.querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', () => openModal(b.dataset.edit)));
  body.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => deleteTx(b.dataset.del)));
}

function deleteTx(id) {
  Store.deleteTransaction(id);
  toast('Transaction supprimée', 'success');
  refresh();
}

/* ---------- Categories view ---------- */
function renderCategories() {
  const grid = $('#categoryGrid');
  const allTx = Store.all();
  grid.innerHTML = CATEGORIES.map(c => {
    const count = allTx.filter(t => t.category === c.name).length;
    return `<div class="cat-card">
      <span class="cat-icon" style="background:${c.color}1f;color:${c.color}"><i class="fa-solid ${c.icon}"></i></span>
      <div><strong>${c.name}</strong><span>${c.type === 'income' ? 'Revenu' : 'Dépense'} · ${count} op.</span></div>
    </div>`;
  }).join('');
}

/* ---------- Modal ---------- */
function populateCategorySelect(type) {
  const sel = $('#txCategory');
  const cats = CATEGORIES.filter(c => c.type === type);
  sel.innerHTML = cats.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
}

function openModal(id = null) {
  state.editingId = id;
  const form = $('#transactionForm');
  form.reset();
  clearErrors();
  if (id) {
    const t = Store.all().find(x => x.id === id);
    if (!t) return;
    $('#modalTitle').textContent = 'Modifier la transaction';
    $('#txId').value = t.id;
    form.querySelector(`input[name="type"][value="${t.type}"]`).checked = true;
    populateCategorySelect(t.type);
    $('#txAmount').value = t.amount;
    $('#txCategory').value = t.category;
    $('#txDescription').value = t.description;
    $('#txDate').value = t.date;
  } else {
    $('#modalTitle').textContent = 'Nouvelle transaction';
    $('#txId').value = '';
    form.querySelector('input[name="type"][value="expense"]').checked = true;
    populateCategorySelect('expense');
    const d = new Date();
    const inMonth = monthKey(d) === monthKey(state.current) ? d : state.current;
    $('#txDate').value = `${inMonth.getFullYear()}-${String(inMonth.getMonth() + 1).padStart(2, '0')}-${String(inMonth.getDate ? Math.min(inMonth.getDate(), 28) : 1).padStart(2, '0')}`;
  }
  $('#modalOverlay').classList.add('show');
  $('#modalOverlay').setAttribute('aria-hidden', 'false');
  setTimeout(() => $('#txAmount').focus(), 100);
}

function closeModal() {
  $('#modalOverlay').classList.remove('show');
  $('#modalOverlay').setAttribute('aria-hidden', 'true');
  state.editingId = null;
}

function clearErrors() {
  $$('.field').forEach(f => f.classList.remove('invalid'));
  $('#errAmount').textContent = '';
  $('#errCategory').textContent = '';
  $('#errDate').textContent = '';
}

function validate() {
  clearErrors();
  let ok = true;
  const amount = parseFloat($('#txAmount').value);
  const category = $('#txCategory').value;
  const date = $('#txDate').value;
  if (!amount || amount <= 0 || isNaN(amount)) {
    $('#errAmount').textContent = 'Montant positif requis';
    $('#txAmount').closest('.field').classList.add('invalid'); ok = false;
  }
  if (!category) {
    $('#errCategory').textContent = 'Catégorie obligatoire';
    $('#txCategory').closest('.field').classList.add('invalid'); ok = false;
  }
  if (!date || isNaN(Date.parse(date))) {
    $('#errDate').textContent = 'Date valide requise';
    $('#txDate').closest('.field').classList.add('invalid'); ok = false;
  }
  return ok;
}

function submitForm(e) {
  e.preventDefault();
  if (!validate()) return;
  const data = {
    type: document.querySelector('input[name="type"]:checked').value,
    amount: parseFloat($('#txAmount').value),
    category: $('#txCategory').value,
    description: $('#txDescription').value.trim(),
    date: $('#txDate').value
  };
  const id = $('#txId').value;
  if (id) { Store.updateTransaction(id, data); toast('Transaction mise à jour', 'success'); }
  else { Store.addTransaction(data); toast('Transaction ajoutée', 'success'); }
  closeModal();
  const txMonth = data.date.slice(0, 7);
  if (txMonth !== monthKey(state.current)) {
    state.current = new Date(+data.date.slice(0, 4), +data.date.slice(5, 7) - 1, 1);
  }
  refresh();
}

/* ---------- Utils ---------- */
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* ---------- Refresh ---------- */
function refresh() {
  updateMonthLabel();
  renderKpis();
  renderRecent();
  renderDoughnut();
  renderLine();
  renderBar();
  if (state.view === 'transactions') renderTable();
  if (state.view === 'categories') renderCategories();
}

/* ---------- Events ---------- */
function bindEvents() {
  $$('.nav-item').forEach(n => n.addEventListener('click', (e) => { e.preventDefault(); setView(n.dataset.view); }));
  $('#prevMonth').addEventListener('click', () => shiftMonth(-1));
  $('#nextMonth').addEventListener('click', () => shiftMonth(1));
  $('#addTransactionBtn').addEventListener('click', () => openModal());
  $('#closeModal').addEventListener('click', closeModal);
  $('#cancelModal').addEventListener('click', closeModal);
  $('#modalOverlay').addEventListener('click', (e) => { if (e.target === $('#modalOverlay')) closeModal(); });
  $('#transactionForm').addEventListener('submit', submitForm);
  document.querySelectorAll('input[name="type"]').forEach(r => r.addEventListener('change', (e) => {
    const cur = $('#txCategory').value;
    populateCategorySelect(e.target.value);
  }));
  $('#menuToggle').addEventListener('click', openSidebar);
  $('#sidebarOverlay').addEventListener('click', closeSidebar);
  $('#searchInput').addEventListener('input', (e) => { state.search = e.target.value; renderTable(); });
  $('#typeFilter').addEventListener('change', (e) => { state.typeFilter = e.target.value; renderTable(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && $('#modalOverlay').classList.contains('show')) closeModal(); });
  window.addEventListener('resize', () => { Object.values(charts).forEach(c => c && c.resize()); });
}

/* ---------- Seed demo ---------- */
function seedIfEmpty() {
  if (Store.all().length) return;
  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth();
  const mk = (mo, day) => { const d = new Date(y, mo, day); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  const demo = [
    { type: 'income', amount: 2600, category: 'Salaire', description: 'Salaire mensuel', date: mk(m, 2) },
    { type: 'income', amount: 450, category: 'Freelance', description: 'Mission web', date: mk(m, 14) },
    { type: 'expense', amount: 820, category: 'Logement', description: 'Loyer', date: mk(m, 3) },
    { type: 'expense', amount: 215.4, category: 'Alimentation', description: 'Courses', date: mk(m, 6) },
    { type: 'expense', amount: 64.9, category: 'Transport', description: 'Carburant', date: mk(m, 8) },
    { type: 'expense', amount: 39.99, category: 'Abonnements', description: 'Streaming', date: mk(m, 10) },
    { type: 'expense', amount: 120, category: 'Loisirs', description: 'Sortie cinéma', date: mk(m, 16) },
    { type: 'expense', amount: 88, category: 'Shopping', description: 'Vêtements', date: mk(m, 20) },
    { type: 'income', amount: 2600, category: 'Salaire', description: 'Salaire mensuel', date: mk(m - 1, 2) },
    { type: 'expense', amount: 820, category: 'Logement', description: 'Loyer', date: mk(m - 1, 3) },
    { type: 'expense', amount: 310, category: 'Alimentation', description: 'Courses', date: mk(m - 1, 12) },
    { type: 'income', amount: 2550, category: 'Salaire', description: 'Salaire mensuel', date: mk(m - 2, 2) },
    { type: 'expense', amount: 790, category: 'Logement', description: 'Loyer', date: mk(m - 2, 3) }
  ];
  const data = Store.read();
  demo.forEach(d => data.transactions.push({ id: uid(), ...d }));
  Store.write(data);
}

/* ---------- Init ---------- */
function init() {
  chartDefaults();
  seedIfEmpty();
  populateCategorySelect('expense');
  bindEvents();
  refresh();
}

document.addEventListener('DOMContentLoaded', init);
