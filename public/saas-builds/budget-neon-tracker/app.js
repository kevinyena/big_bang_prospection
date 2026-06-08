const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const ce = (t, c, h) => { const e = document.createElement(t); if (c) e.className = c; if (h != null) e.innerHTML = h; return e; };

const state = {
  categories: [], settings: { currency: 'EUR', theme: 'dark', notifications: true },
  txFilter: { type: 'all', category: 'all' }, txSort: { key: 'date', dir: 'desc' },
};

const CURR = { EUR: '€', USD: '$', GBP: '£', CHF: 'CHF', JPY: '¥' };
const cs = () => CURR[state.settings.currency] || '€';
const fmt = (n) => (n < 0 ? '-' : '') + Math.abs(+n || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ' + cs();
const fmt0 = (n) => Math.abs(+n || 0).toLocaleString('fr-FR', { maximumFractionDigits: 0 }) + ' ' + cs();
const fdate = (d) => new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
const NEON = ['#00F0FF', '#FF2E97', '#39FF14', '#FFB627', '#FF4D5E', '#9B5CFF', '#FF7A1A', '#22D3EE'];
const CAT_ICONS = ['fa-bowl-food', 'fa-house', 'fa-gamepad', 'fa-car', 'fa-cart-shopping', 'fa-plane', 'fa-bolt', 'fa-heart-pulse', 'fa-graduation-cap', 'fa-gift', 'fa-wifi', 'fa-shirt'];

async function api(path, opts) {
  try {
    const res = await fetch('api/' + path, {
      headers: { 'Content-Type': 'application/json' },
      ...opts,
      body: opts?.body ? JSON.stringify(opts.body) : undefined,
    });
    if (!res.ok) throw new Error(res.status);
    const ct = res.headers.get('content-type') || '';
    return ct.includes('json') ? await res.json() : null;
  } catch (e) { console.warn('API', path, e.message); return null; }
}

const hex2rgba = (h, a) => {
  const n = parseInt(h.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

function toast(msg, type = 'cyan') {
  let host = $('#toastHost');
  if (!host) { host = ce('div'); host.id = 'toastHost'; host.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:200;display:flex;flex-direction:column;gap:10px'; document.body.appendChild(host); }
  const t = ce('div', '', `<i class="fa-solid fa-${type === 'red' ? 'circle-exclamation' : 'circle-check'}"></i> ${msg}`);
  const col = type === 'red' ? 'var(--red)' : type === 'magenta' ? 'var(--magenta)' : 'var(--cyan)';
  t.style.cssText = `display:flex;align-items:center;gap:10px;padding:13px 18px;border-radius:13px;background:var(--bg-2);border:1px solid var(--border-2);color:var(--txt);font-size:13.5px;font-weight:600;box-shadow:var(--shadow);transform:translateX(120%);transition:.4s cubic-bezier(.22,.61,.36,1)`;
  t.querySelector('i').style.color = col;
  host.appendChild(t);
  requestAnimationFrame(() => t.style.transform = 'none');
  setTimeout(() => { t.style.transform = 'translateX(120%)'; setTimeout(() => t.remove(), 400); }, 3000);
}

const catColor = (id) => { const c = state.categories.find(x => x.id == id); return c?.color || '#00F0FF'; };
const catName = (id) => { const c = state.categories.find(x => x.id == id); return c?.name || 'Autre'; };
const catIcon = (id) => { const c = state.categories.find(x => x.id == id); return c?.icon || 'fa-tag'; };

let charts = [];
const destroyCharts = () => { charts.forEach(c => c.destroy()); charts = []; };

function animateCount(el, target, prefix = '', suffix = '') {
  const dur = 900, start = performance.now();
  const step = (now) => {
    const p = Math.min((now - start) / dur, 1), e = 1 - Math.pow(1 - p, 3);
    el.textContent = prefix + (target * e).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + suffix;
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/* ---------- DASHBOARD ---------- */
async function renderDashboard(view) {
  view.innerHTML = `
    <div class="page-head">
      <div><h1>Dashboard</h1><p>Vue d'ensemble de vos finances ce mois-ci</p></div>
      <div class="seg" id="trendSeg">
        <button class="seg-btn active" data-range="30">30 j</button>
        <button class="seg-btn" data-range="90">90 j</button>
        <button class="seg-btn" data-range="365">1 an</button>
      </div>
    </div>
    <div class="grid stats-grid" id="statsGrid">${[0,1,2].map(()=>'<div class="card stat-card" style="height:130px"></div>').join('')}</div>
    <div class="grid dash-grid">
      <div class="card">
        <div class="card-head"><div><h3>Évolution du solde</h3><div class="sub" id="trendSub">30 derniers jours</div></div></div>
        <div class="chart-wrap"><canvas id="trendChart"></canvas></div>
      </div>
      <div class="card">
        <div class="card-head"><div><h3>Répartition</h3><div class="sub">Dépenses par catégorie</div></div></div>
        <div class="donut-wrap"><canvas id="donutChart"></canvas><div class="donut-center"><div class="label">Total dépensé</div><div class="val" id="donutTotal">—</div></div></div>
        <div class="legend" id="donutLegend"></div>
      </div>
    </div>
    <div class="grid dash-grid" style="margin-top:20px">
      <div class="card">
        <div class="card-head"><div><h3>Budgets du mois</h3><div class="sub">Suivi par catégorie</div></div><a href="#/budgets" class="btn btn-ghost" style="padding:8px 14px">Gérer</a></div>
        <div id="dashBudgets"></div>
      </div>
      <div class="card">
        <div class="card-head"><div><h3>Top dépenses</h3><div class="sub">Vos 3 plus gros postes</div></div></div>
        <div class="insight-list" id="topSpend"></div>
        <div id="comparison" style="margin-top:20px;padding-top:18px;border-top:1px solid var(--border)"></div>
      </div>
    </div>`;

  const [ov, byCat, budgets, comp] = await Promise.all([
    api('stats/overview'), api('stats/by-category?period=month'), api('budgets'), api('stats/comparison'),
  ]);
  const o = ov || { balance: 12480.5, income: 3200, expenses: 1847.3, incomeTrend: 4.2, expenseTrend: -2.8, balanceTrend: 6.1 };
  const sg = $('#statsGrid');
  sg.innerHTML = `
    ${statCard('cyan', 'fa-wallet', 'Solde total', o.balance, o.balanceTrend)}
    ${statCard('green', 'fa-arrow-trend-up', 'Revenus du mois', o.income, o.incomeTrend)}
    ${statCard('magenta', 'fa-arrow-trend-down', 'Dépenses du mois', o.expenses, o.expenseTrend)}`;
  $$('.stat-value', sg).forEach(el => animateCount(el, +el.dataset.v, '', ' ' + cs()));

  await drawTrend(30);
  $$('#trendSeg .seg-btn').forEach(b => b.onclick = async () => {
    $$('#trendSeg .seg-btn').forEach(x => x.classList.remove('active')); b.classList.add('active');
    $('#trendSub').textContent = b.dataset.range === '365' ? '12 derniers mois' : b.dataset.range + ' derniers jours';
    await drawTrend(+b.dataset.range);
  });

  const cats = byCat?.length ? byCat : fallbackByCat();
  drawDonut(cats);

  renderBudgetRows($('#dashBudgets'), (budgets || fallbackBudgets()).slice(0, 4));

  const top = [...cats].sort((a, b) => b.value - a.value).slice(0, 3);
  const maxT = top[0]?.value || 1;
  $('#topSpend').innerHTML = top.map((c, i) => `
    <div class="insight-item">
      <div class="insight-rank ${i === 0 ? 'r1' : ''}">${i + 1}</div>
      <div class="insight-info"><div class="name">${c.name}</div>
        <div class="bar"><div class="bar-fill ok" style="width:${(c.value / maxT * 100)}%;background:linear-gradient(90deg,${c.color},${c.color});box-shadow:0 0 12px ${hex2rgba(c.color, .4)}"></div></div>
      </div>
      <div class="insight-amt">${fmt0(c.value)}</div>
    </div>`).join('') || '<p style="color:var(--txt-3)">Aucune donnée</p>';

  const cp = comp || { current: o.expenses, previous: o.expenses * 1.12 };
  const diff = cp.current - cp.previous, pct = cp.previous ? (diff / cp.previous * 100) : 0, up = diff > 0;
  $('#comparison').innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between">
      <div><div style="color:var(--txt-3);font-size:12px">vs mois précédent</div>
      <div style="font-size:15px;font-weight:700;margin-top:3px">${fmt(cp.current)}</div></div>
      <div class="stat-trend ${up ? 'down' : 'up'}"><i class="fa-solid fa-arrow-${up ? 'up' : 'down'}"></i> ${Math.abs(pct).toFixed(1)}%</div>
    </div>`;
}

function statCard(c, ic, label, val, trend) {
  const up = trend >= 0;
  return `<div class="card stat-card c-${c}">
    <div class="stat-top"><span class="stat-label">${label}</span><span class="stat-ic"><i class="fa-solid ${ic}"></i></span></div>
    <div class="stat-value tabular" data-v="${val}">0</div>
    <div class="stat-trend ${up ? 'up' : 'down'}"><i class="fa-solid fa-arrow-${up ? 'up' : 'down'}"></i> ${Math.abs(trend ?? 0).toFixed(1)}% <span>ce mois</span></div>
  </div>`;
}

async function drawTrend(range) {
  const d = await api('stats/trend?range=' + range);
  const data = d?.length ? d : fallbackTrend(range);
  const ctx = $('#trendChart'); if (!ctx) return;
  const old = charts.find(c => c.canvas === ctx); if (old) { old.destroy(); charts = charts.filter(c => c !== old); }
  const g = ctx.getContext('2d').createLinearGradient(0, 0, 0, 300);
  g.addColorStop(0, hex2rgba('#00F0FF', .35)); g.addColorStop(1, hex2rgba('#00F0FF', 0));
  charts.push(new Chart(ctx, {
    type: 'line',
    data: { labels: data.map(p => p.label), datasets: [{ data: data.map(p => p.value), borderColor: '#00F0FF', backgroundColor: g, fill: true, tension: .4, borderWidth: 2.5, pointRadius: 0, pointHoverRadius: 5, pointHoverBackgroundColor: '#00F0FF', pointHoverBorderColor: '#fff' }] },
    options: chartOpts(true),
  }));
}

function drawDonut(cats) {
  const ctx = $('#donutChart'); if (!ctx) return;
  const total = cats.reduce((s, c) => s + c.value, 0);
  $('#donutTotal').textContent = fmt0(total);
  charts.push(new Chart(ctx, {
    type: 'doughnut',
    data: { labels: cats.map(c => c.name), datasets: [{ data: cats.map(c => c.value), backgroundColor: cats.map(c => c.color), borderColor: 'rgba(10,10,15,.6)', borderWidth: 3, hoverOffset: 8 }] },
    options: { cutout: '72%', plugins: { legend: { display: false }, tooltip: tooltipCfg(v => fmt(v)) }, animation: { animateRotate: true, duration: 900 } },
  }));
  $('#donutLegend').innerHTML = cats.map(c => `
    <div class="legend-item"><span class="legend-dot" style="background:${c.color};color:${c.color}"></span>
      <span class="legend-name">${c.name}</span><span class="legend-val">${fmt0(c.value)}</span></div>`).join('');
}

function chartOpts(money) {
  return {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: tooltipCfg(v => money ? fmt(v) : v) },
    scales: {
      x: { grid: { display: false }, ticks: { color: '#6B6B82', maxTicksLimit: 8, font: { size: 11 } } },
      y: { grid: { color: 'rgba(255,255,255,.05)' }, ticks: { color: '#6B6B82', font: { size: 11 }, callback: v => v >= 1000 ? (v / 1000).toFixed(1) + 'k' : v } },
    },
  };
}
const tooltipCfg = (fn) => ({
  backgroundColor: '#171723', borderColor: 'rgba(255,255,255,.12)', borderWidth: 1, padding: 12,
  titleColor: '#EDEDF2', bodyColor: '#A4A4B8', cornerRadius: 10, displayColors: false,
  callbacks: { label: c => fn(c.parsed.y ?? c.parsed) },
});

/* ---------- TRANSACTIONS ---------- */
async function renderTransactions(view) {
  view.innerHTML = `
    <div class="page-head"><div><h1>Transactions</h1><p>Gérez vos revenus et dépenses</p></div>
      <button class="btn btn-glow-cyan" id="addTx2"><i class="fa-solid fa-plus"></i> Ajouter</button></div>
    <div class="toolbar" id="txToolbar">
      <button class="filter-chip ${state.txFilter.type==='all'?'active':''}" data-type="all"><i class="fa-solid fa-layer-group"></i> Tout</button>
      <button class="filter-chip ${state.txFilter.type==='income'?'active':''}" data-type="income"><i class="fa-solid fa-arrow-up"></i> Revenus</button>
      <button class="filter-chip ${state.txFilter.type==='expense'?'active':''}" data-type="expense"><i class="fa-solid fa-arrow-down"></i> Dépenses</button>
      <select id="catFilter" class="filter-chip" style="appearance:none;padding-right:30px">
        <option value="all">Toutes catégories</option>
        ${state.categories.map(c => `<option value="${c.id}" ${state.txFilter.category==c.id?'selected':''}>${c.name}</option>`).join('')}
      </select>
    </div>
    <div class="card table-card">
      <table class="tx-table">
        <thead><tr>
          ${th('date','Date')}${th('category','Catégorie')}<th>Note</th>${th('type','Type')}${th('amount','Montant')}<th></th>
        </tr></thead>
        <tbody id="txBody"><tr><td colspan="6" style="text-align:center;padding:40px;color:var(--txt-3)">Chargement…</td></tr></tbody>
      </table>
    </div>`;

  $('#addTx2').onclick = () => openTxModal();
  $$('#txToolbar .filter-chip[data-type]').forEach(b => b.onclick = () => { state.txFilter.type = b.dataset.type; loadTx(); $$('#txToolbar .filter-chip[data-type]').forEach(x => x.classList.toggle('active', x === b)); });
  $('#catFilter').onchange = (e) => { state.txFilter.category = e.target.value; loadTx(); };
  $$('.tx-table th[data-sort]').forEach(h => h.onclick = () => {
    const k = h.dataset.sort;
    if (state.txSort.key === k) state.txSort.dir = state.txSort.dir === 'asc' ? 'desc' : 'asc';
    else { state.txSort.key = k; state.txSort.dir = 'desc'; }
    loadTx();
  });
  loadTx();
}
const th = (k, l) => `<th data-sort="${k}">${l}<i class="fa-solid fa-sort"></i></th>`;

async function loadTx() {
  const body = $('#txBody'); if (!body) return;
  const q = [];
  if (state.txFilter.type !== 'all') q.push('type=' + state.txFilter.type);
  if (state.txFilter.category !== 'all') q.push('category=' + state.txFilter.category);
  let tx = await api('transactions' + (q.length ? '?' + q.join('&') : ''));
  if (!tx) tx = fallbackTx().filter(t => (state.txFilter.type === 'all' || t.type === state.txFilter.type) && (state.txFilter.category === 'all' || t.category == state.txFilter.category));
  const { key, dir } = state.txSort, mul = dir === 'asc' ? 1 : -1;
  tx.sort((a, b) => {
    let av = a[key], bv = b[key];
    if (key === 'category') { av = catName(a.category); bv = catName(b.category); }
    if (key === 'amount') return (a.amount - b.amount) * mul;
    if (key === 'date') return (new Date(a.date) - new Date(b.date)) * mul;
    return ('' + av).localeCompare('' + bv) * mul;
  });
  if (!tx.length) { body.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--txt-3)">Aucune transaction</td></tr>'; return; }
  body.innerHTML = tx.map(t => {
    const col = catColor(t.category), inc = t.type === 'income';
    return `<tr data-id="${t.id}">
      <td class="tabular">${fdate(t.date)}</td>
      <td><span class="tx-cat"><span class="pill" style="background:${hex2rgba(col,.14)};color:${col}"><i class="fa-solid ${catIcon(t.category)}"></i></span>${catName(t.category)}</span></td>
      <td class="tx-note">${t.note || '—'}</td>
      <td><span class="badge ${t.type}">${inc ? 'Revenu' : 'Dépense'}</span></td>
      <td class="tx-amount ${t.type} tabular">${inc ? '+' : '-'}${fmt(Math.abs(t.amount))}</td>
      <td><div class="tx-actions">
        <button class="mini-btn edit" title="Modifier"><i class="fa-solid fa-pen"></i></button>
        <button class="mini-btn del" title="Supprimer"><i class="fa-solid fa-trash"></i></button>
      </div></td>
    </tr>`;
  }).join('');
  body.querySelectorAll('tr').forEach(tr => {
    const id = tr.dataset.id;
    tr.querySelector('.edit').onclick = () => openTxModal(tx.find(t => t.id == id));
    tr.querySelector('.del').onclick = async () => {
      if (!confirm('Supprimer cette transaction ?')) return;
      await api('transactions/' + id, { method: 'DELETE' });
      toast('Transaction supprimée', 'magenta'); loadTx();
    };
  });
}

/* ---------- BUDGETS ---------- */
async function renderBudgets(view) {
  view.innerHTML = `
    <div class="page-head"><div><h1>Budgets & Objectifs</h1><p>Maîtrisez vos dépenses et atteignez vos buts</p></div>
      <button class="btn btn-glow-cyan" id="addBudget"><i class="fa-solid fa-plus"></i> Nouveau budget</button></div>
    <div class="card"><div class="card-head"><div><h3>Budgets mensuels</h3><div class="sub">Par catégorie</div></div></div>
      <div id="budgetList"><p style="color:var(--txt-3)">Chargement…</p></div></div>
    <div class="page-head" style="margin-top:28px"><div><h1 style="font-size:19px">Objectifs d'épargne</h1></div></div>
    <div class="grid goals-grid" id="goalsGrid"></div>`;

  const budgets = await api('budgets') || fallbackBudgets();
  renderBudgetRows($('#budgetList'), budgets);
  $('#addBudget').onclick = () => openBudgetModal();

  const goals = fallbackGoals();
  $('#goalsGrid').innerHTML = goals.map(g => {
    const pct = Math.min(100, g.saved / g.target * 100);
    return `<div class="card goal-card">
      <div class="goal-head"><div class="goal-ic"><i class="fa-solid ${g.icon}"></i></div>
        <div><div class="goal-title">${g.name}</div><div class="goal-sub">Échéance ${g.due}</div></div>
        <div class="goal-pct">${pct.toFixed(0)}%</div></div>
      <div class="goal-amt"><b>${fmt0(g.saved)}</b><span>/ ${fmt0(g.target)}</span></div>
      <div class="bar"><div class="bar-fill ok" style="width:0%"></div></div>
    </div>`;
  }).join('');
  setTimeout(() => $$('#goalsGrid .bar-fill').forEach((b, i) => b.style.width = Math.min(100, goals[i].saved / goals[i].target * 100) + '%'), 60);
}

function renderBudgetRows(host, budgets) {
  if (!budgets.length) { host.innerHTML = '<p style="color:var(--txt-3)">Aucun budget défini</p>'; return; }
  host.innerHTML = budgets.map(b => {
    const col = catColor(b.category) || b.color || '#00F0FF';
    const pct = b.limit ? b.spent / b.limit * 100 : 0;
    const cls = pct >= 100 ? 'over' : pct >= 80 ? 'warn' : 'ok';
    return `<div class="budget-row">
      <div class="budget-meta">
        <div class="budget-name"><span class="pill" style="background:${hex2rgba(col,.14)};color:${col}"><i class="fa-solid ${catIcon(b.category) || 'fa-tag'}"></i></span>${b.name || catName(b.category)}</div>
        <div class="budget-fig"><b>${fmt0(b.spent)}</b> / ${fmt0(b.limit)}</div>
      </div>
      <div class="bar"><div class="bar-fill ${cls}" style="width:0%"></div></div>
      ${pct >= 100 ? `<div class="budget-alert"><i class="fa-solid fa-triangle-exclamation"></i> Budget dépassé de ${fmt0(b.spent - b.limit)}</div>` : ''}
    </div>`;
  }).join('');
  setTimeout(() => $$('.bar-fill', host).forEach((bar, i) => bar.style.width = Math.min(100, (budgets[i].limit ? budgets[i].spent / budgets[i].limit * 100 : 0)) + '%'), 60);
}

/* ---------- CATEGORIES ---------- */
async function renderCategories(view) {
  view.innerHTML = `
    <div class="page-head"><div><h1>Catégories</h1><p>Personnalisez vos catégories et leurs couleurs néon</p></div></div>
    <div class="grid cat-grid" id="catGrid"></div>`;
  const grid = $('#catGrid');
  const render = () => {
    grid.innerHTML = state.categories.map(c => `
      <div class="card cat-card" data-id="${c.id}">
        <div class="cat-ic" style="background:${hex2rgba(c.color,.14)};color:${c.color};box-shadow:0 0 18px ${hex2rgba(c.color,.25)}"><i class="fa-solid ${c.icon}"></i></div>
        <div><div class="cat-name">${c.name}</div><div class="cat-stat">${c.count ?? 0} transactions</div></div>
        <div style="display:flex;gap:6px;margin-top:auto">
          <button class="mini-btn edit"><i class="fa-solid fa-pen"></i></button>
          <button class="mini-btn del"><i class="fa-solid fa-trash"></i></button>
        </div>
      </div>`).join('') + `<div class="card cat-card cat-add" id="catAdd"><i class="fa-solid fa-plus"></i><div>Nouvelle catégorie</div></div>`;
    $('#catAdd').onclick = () => openCatModal();
    grid.querySelectorAll('.cat-card[data-id]').forEach(card => {
      const id = card.dataset.id, c = state.categories.find(x => x.id == id);
      card.querySelector('.edit').onclick = (e) => { e.stopPropagation(); openCatModal(c); };
      card.querySelector('.del').onclick = async (e) => {
        e.stopPropagation();
        if (!confirm('Supprimer cette catégorie ?')) return;
        await api('categories/' + id, { method: 'DELETE' });
        state.categories = state.categories.filter(x => x.id != id);
        toast('Catégorie supprimée', 'magenta'); render();
      };
    });
  };
  render();
}

/* ---------- SETTINGS ---------- */
async function renderSettings(view) {
  const s = await api('settings') || state.settings;
  state.settings = { ...state.settings, ...s };
  view.innerHTML = `
    <div class="page-head"><div><h1>Préférences</h1><p>Configurez votre expérience Budget Neon</p></div></div>
    <div class="grid settings-grid">
      <div class="card">
        <div class="card-head"><div><h3>Général</h3></div></div>
        <div class="field" style="margin-bottom:18px"><span>Devise</span>
          <select id="setCurrency">${Object.keys(CURR).map(k => `<option value="${k}" ${state.settings.currency===k?'selected':''}>${k} (${CURR[k]})</option>`).join('')}</select></div>
        <div class="setting-row"><div><div class="label">Notifications</div><div class="desc">Alertes de dépassement de budget</div></div>
          <div class="toggle ${state.settings.notifications?'on':''}" id="setNotif"></div></div>
        <div class="setting-row"><div><div class="label">Mode sombre</div><div class="desc">Thème néon profond</div></div>
          <div class="toggle on" id="setTheme"></div></div>
      </div>
      <div class="card">
        <div class="card-head"><div><h3>Profil</h3></div></div>
        <div class="field" style="margin-bottom:16px"><span>Nom</span><input id="setName" value="Alex Moreau"></div>
        <div class="field" style="margin-bottom:16px"><span>Email</span><input id="setEmail" type="email" value="alex@neon.io"></div>
        <button class="btn btn-glow-cyan btn-block" id="saveSettings"><i class="fa-solid fa-check"></i> Enregistrer</button>
      </div>
    </div>`;
  $('#setNotif').onclick = function () { this.classList.toggle('on'); state.settings.notifications = this.classList.contains('on'); };
  $('#setCurrency').onchange = (e) => { state.settings.currency = e.target.value; };
  $('#saveSettings').onclick = async () => {
    await api('settings', { method: 'PUT', body: { ...state.settings, currency: $('#setCurrency').value, name: $('#setName').value, email: $('#setEmail').value } });
    toast('Préférences enregistrées');
  };
}

/* ---------- MODALS ---------- */
const txModal = $('#txModal');
let editingTx = null, txType = 'expense';

function fillCatSelect(sel, val) {
  sel.innerHTML = state.categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
  if (val != null) sel.value = val;
}

function openTxModal(tx = null) {
  editingTx = tx;
  txType = tx?.type || 'expense';
  $('#txModal .modal-head h3').textContent = tx ? 'Modifier la transaction' : 'Nouvelle transaction';
  $$('#txTypeSeg .seg-btn').forEach(b => b.classList.toggle('active', b.dataset.type === txType));
  fillCatSelect($('#txCategory'), tx?.category);
  $('#txAmount').value = tx ? Math.abs(tx.amount) : '';
  $('#txDate').value = tx ? tx.date.slice(0, 10) : new Date().toISOString().slice(0, 10);
  $('#txNote').value = tx?.note || '';
  txModal.classList.add('open'); txModal.setAttribute('aria-hidden', 'false');
  setTimeout(() => $('#txAmount').focus(), 100);
}
function closeTxModal() { txModal.classList.remove('open'); txModal.setAttribute('aria-hidden', 'true'); }

$$('#txTypeSeg .seg-btn').forEach(b => b.onclick = () => { txType = b.dataset.type; $$('#txTypeSeg .seg-btn').forEach(x => x.classList.toggle('active', x === b)); });
$('#closeTxModal').onclick = closeTxModal;
$('#cancelTx').onclick = closeTxModal;
txModal.onclick = (e) => { if (e.target === txModal) closeTxModal(); };
$('#txForm').onsubmit = async (e) => {
  e.preventDefault();
  const payload = { amount: +$('#txAmount').value, category: $('#txCategory').value, date: $('#txDate').value, type: txType, note: $('#txNote').value };
  if (editingTx) { await api('transactions/' + editingTx.id, { method: 'PUT', body: payload }); toast('Transaction modifiée'); }
  else { await api('transactions', { method: 'POST', body: payload }); toast('Transaction ajoutée'); }
  closeTxModal();
  if (location.hash.includes('transactions')) loadTx();
  else if (location.hash === '#/' || location.hash === '') router();
};

function modalShell(title, bodyHTML) {
  const back = ce('div', 'modal-backdrop'); back.style.zIndex = 110;
  back.innerHTML = `<div class="modal"><div class="modal-head"><h3>${title}</h3><button class="icon-btn close"><i class="fa-solid fa-xmark"></i></button></div><div class="modal-body">${bodyHTML}</div></div>`;
  document.body.appendChild(back);
  requestAnimationFrame(() => back.classList.add('open'));
  const close = () => { back.classList.remove('open'); setTimeout(() => back.remove(), 350); };
  back.querySelector('.close').onclick = close;
  back.onclick = (e) => { if (e.target === back) close(); };
  return { back, close };
}

function openCatModal(cat = null) {
  const color = cat?.color || NEON[0], icon = cat?.icon || CAT_ICONS[0];
  const { back, close } = modalShell(cat ? 'Modifier la catégorie' : 'Nouvelle catégorie', `
    <label class="field"><span>Nom</span><input id="cName" placeholder="Ex. Alimentation" value="${cat?.name || ''}"></label>
    <div class="field"><span>Couleur néon</span><div id="cColors" style="display:flex;gap:10px;flex-wrap:wrap">${NEON.map(c => `<button type="button" class="cdot" data-c="${c}" style="width:34px;height:34px;border-radius:10px;background:${c};box-shadow:0 0 14px ${hex2rgba(c,.5)};border:2px solid ${c===color?'#fff':'transparent'}"></button>`).join('')}</div></div>
    <div class="field"><span>Icône</span><div id="cIcons" style="display:flex;gap:8px;flex-wrap:wrap">${CAT_ICONS.map(ic => `<button type="button" class="cic" data-i="${ic}" style="width:40px;height:40px;border-radius:11px;background:var(--bg-2);border:1px solid ${ic===icon?'var(--cyan)':'var(--border)'};color:${ic===icon?'var(--cyan)':'var(--txt-2)'}"><i class="fa-solid ${ic}"></i></button>`).join('')}</div></div>
    <div class="modal-foot"><button class="btn btn-ghost cancel">Annuler</button><button class="btn btn-glow-cyan save">Enregistrer</button></div>`);
  let sel = { color, icon };
  back.querySelectorAll('.cdot').forEach(d => d.onclick = () => { sel.color = d.dataset.c; back.querySelectorAll('.cdot').forEach(x => x.style.border = '2px solid ' + (x === d ? '#fff' : 'transparent')); });
  back.querySelectorAll('.cic').forEach(d => d.onclick = () => { sel.icon = d.dataset.i; back.querySelectorAll('.cic').forEach(x => { const on = x === d; x.style.borderColor = on ? 'var(--cyan)' : 'var(--border)'; x.style.color = on ? 'var(--cyan)' : 'var(--txt-2)'; }); });
  back.querySelector('.cancel').onclick = close;
  back.querySelector('.save').onclick = async () => {
    const name = back.querySelector('#cName').value.trim();
    if (!name) return toast('Nom requis', 'red');
    const payload = { name, color: sel.color, icon: sel.icon };
    if (cat) { await api('categories/' + cat.id, { method: 'PUT', body: payload }); Object.assign(cat, payload); toast('Catégorie modifiée'); }
    else { const r = await api('categories', { method: 'POST', body: payload }); state.categories.push(r || { id: 'c' + Date.now(), count: 0, ...payload }); toast('Catégorie créée'); }
    close(); renderCategories($('#view'));
  };
}

function openBudgetModal(budget = null) {
  const { back, close } = modalShell('Nouveau budget', `
    <label class="field"><span>Catégorie</span><select id="bCat">${state.categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}</select></label>
    <label class="field"><span>Limite mensuelle</span><div class="amount-input"><em>${cs()}</em><input id="bLimit" type="number" step="0.01" placeholder="0,00" style="font-size:20px"></div></label>
    <div class="modal-foot"><button class="btn btn-ghost cancel">Annuler</button><button class="btn btn-glow-cyan save">Enregistrer</button></div>`);
  back.querySelector('.cancel').onclick = close;
  back.querySelector('.save').onclick = async () => {
    const limit = +back.querySelector('#bLimit').value;
    if (!limit) return toast('Limite requise', 'red');
    await api('budgets', { method: 'POST', body: { category: back.querySelector('#bCat').value, limit } });
    toast('Budget créé'); close(); renderBudgets($('#view'));
  };
}

/* ---------- FALLBACKS ---------- */
function fallbackCategories() {
  return [
    { id: 1, name: 'Alimentation', color: '#00F0FF', icon: 'fa-bowl-food', count: 24 },
    { id: 2, name: 'Loyer', color: '#FF2E97', icon: 'fa-house', count: 1 },
    { id: 3, name: 'Loisirs', color: '#39FF14', icon: 'fa-gamepad', count: 12 },
    { id: 4, name: 'Transport', color: '#FFB627', icon: 'fa-car', count: 9 },
    { id: 5, name: 'Shopping', color: '#9B5CFF', icon: 'fa-cart-shopping', count: 7 },
    { id: 6, name: 'Salaire', color: '#22D3EE', icon: 'fa-briefcase', count: 2 },
  ];
}
function fallbackByCat() {
  return [
    { name: 'Loyer', value: 850, color: '#FF2E97' },
    { name: 'Alimentation', value: 420, color: '#00F0FF' },
    { name: 'Transport', value: 230, color: '#FFB627' },
    { name: 'Loisirs', value: 180, color: '#39FF14' },
    { name: 'Shopping', value: 167.3, color: '#9B5CFF' },
  ];
}
function fallbackBudgets() {
  return [
    { id: 1, category: 1, name: 'Alimentation', spent: 420, limit: 500 },
    { id: 2, category: 2, name: 'Loyer', spent: 850, limit: 850 },
    { id: 3, category: 3, name: 'Loisirs', spent: 180, limit: 150 },
    { id: 4, category: 4, name: 'Transport', spent: 230, limit: 300 },
  ];
}
function fallbackGoals() {
  return [
    { name: 'Vacances été', icon: 'fa-plane', saved: 1450, target: 2500, due: 'Juin 2025' },
    { name: "Fonds d'urgence", icon: 'fa-shield-halved', saved: 4200, target: 6000, due: 'Déc 2025' },
    { name: 'Nouveau PC', icon: 'fa-laptop', saved: 980, target: 1500, due: 'Mars 2025' },
  ];
}
function fallbackTx() {
  const out = [], notes = ['Courses', 'Restaurant', 'Essence', 'Cinéma', 'Abonnement', 'Café', 'Pharmacie', 'Train'];
  for (let i = 0; i < 22; i++) {
    const inc = Math.random() < .18;
    const d = new Date(); d.setDate(d.getDate() - i * 2 - Math.floor(Math.random() * 2));
    out.push({ id: 't' + i, type: inc ? 'income' : 'expense', category: inc ? 6 : 1 + Math.floor(Math.random() * 5), amount: inc ? 1600 : +(8 + Math.random() * 120).toFixed(2), date: d.toISOString(), note: inc ? 'Salaire' : notes[i % notes.length] });
  }
  return out;
}
function fallbackTrend(range) {
  const pts = range === 365 ? 12 : range === 90 ? 13 : 15;
  const out = []; let v = 9000;
  for (let i = 0; i < pts; i++) {
    v += (Math.random() - .35) * 600;
    const d = new Date(); d.setDate(d.getDate() - (pts - i) * (range / pts));
    out.push({ label: range === 365 ? d.toLocaleDateString('fr-FR', { month: 'short' }) : d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }), value: Math.round(v) });
  }
  return out;
}

/* ---------- ROUTER ---------- */
const routes = { '/': renderDashboard, '/transactions': renderTransactions, '/budgets': renderBudgets, '/categories': renderCategories, '/settings': renderSettings };

async function router() {
  destroyCharts();
  let path = location.hash.replace('#', '') || '/';
  if (!routes[path]) path = '/';
  $$('.nav-link').forEach(a => a.classList.toggle('active', a.dataset.route === path));
  closeSidebar();
  const view = $('#view');
  view.style.animation = 'none'; void view.offsetWidth; view.style.animation = '';
  await routes[path](view);
}

/* ---------- SIDEBAR / MOBILE ---------- */
let scrim;
function ensureScrim() { if (!scrim) { scrim = ce('div', 'scrim'); document.body.appendChild(scrim); scrim.onclick = closeSidebar; } return scrim; }
function openSidebar() { $('#sidebar').classList.add('open'); ensureScrim().classList.add('open'); }
function closeSidebar() { $('#sidebar').classList.remove('open'); scrim?.classList.remove('open'); }
$('#menuToggle').onclick = () => $('#sidebar').classList.contains('open') ? closeSidebar() : openSidebar();

$('#addTxTop').onclick = () => openTxModal();

document.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); $('.search input')?.focus(); }
  if (e.key === 'Escape') { closeTxModal(); closeSidebar(); }
});

/* ---------- INIT ---------- */
async function init() {
  const cats = await api('categories');
  state.categories = (cats && cats.length) ? cats : fallbackCategories();
  const s = await api('settings');
  if (s) state.settings = { ...state.settings, ...s };
  window.addEventListener('hashchange', router);
  router();
}
init();