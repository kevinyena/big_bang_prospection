(() => {
  'use strict';

  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];

  const state = {
    route: 'dashboard',
    invoices: [],
    clients: [],
    stats: null,
    revenue: [],
    settings: null,
    filter: 'Toutes',
    items: [{ desc: 'Conception UI', qty: 1, price: 1200 }],
  };

  const STATUS_MAP = {
    draft: { label: 'Brouillon', cls: 'status--draft' },
    sent: { label: 'Envoyée', cls: 'status--sent' },
    paid: { label: 'Payée', cls: 'status--paid' },
    late: { label: 'En retard', cls: 'status--late' },
  };
  const STATUS_FR = {
    'Toutes': null, 'Brouillon': 'draft', 'Envoyée': 'sent', 'Payée': 'paid', 'En retard': 'late',
  };

  let currency = 'EUR';
  let vatRate = 20;
  const CUR_SYM = { EUR: '€', USD: '$', GBP: '£' };

  const fmtMoney = (n) => {
    const v = Number(n) || 0;
    return new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Math.round(v)) + ' ' + (CUR_SYM[currency] || '€');
  };
  const fmtMoney2 = (n) => {
    const v = Number(n) || 0;
    return new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v) + ' ' + (CUR_SYM[currency] || '€');
  };
  const fmtDate = (d) => {
    if (!d) return '—';
    const dt = new Date(d);
    if (isNaN(dt)) return '—';
    return dt.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
  };
  const initials = (name = '') => name.trim().split(/\s+/).slice(0, 2).map(w => w[0] || '').join('').toUpperCase() || '?';
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  async function api(path, opts = {}) {
    const o = { headers: { 'Content-Type': 'application/json' }, ...opts };
    const token = localStorage.getItem('aura_token');
    if (token) o.headers.Authorization = 'Bearer ' + token;
    const res = await fetch('api/' + path.replace(/^\//, ''), o);
    if (!res.ok) {
      let msg = 'Erreur ' + res.status;
      try { const j = await res.json(); msg = j.message || j.error || msg; } catch {}
      throw new Error(msg);
    }
    if (res.status === 204) return null;
    const ct = res.headers.get('content-type') || '';
    return ct.includes('application/json') ? res.json() : res.blob();
  }

  function toast(msg, type = 'success') {
    const wrap = $('#toastWrap');
    const el = document.createElement('div');
    el.className = 'toast toast--' + type;
    el.innerHTML = `<i class="fa-solid ${type === 'success' ? 'fa-circle-check' : 'fa-circle-exclamation'}"></i><span>${esc(msg)}</span>`;
    wrap.appendChild(el);
    setTimeout(() => {
      el.style.transition = 'opacity .3s, transform .3s';
      el.style.opacity = '0';
      el.style.transform = 'translateX(120%)';
      setTimeout(() => el.remove(), 320);
    }, 3200);
  }

  /* ---------- Routing ---------- */
  function parseRoute() {
    const h = location.hash.replace(/^#\/?/, '');
    const seg = h.split('/')[0] || '';
    const map = { '': 'dashboard', invoices: 'invoices', clients: 'clients', settings: 'settings' };
    return map[seg] || 'dashboard';
  }

  function setRoute() {
    state.route = parseRoute();
    $$('.view').forEach(v => v.classList.toggle('is-hidden', v.dataset.view !== state.route));
    $$('.nav-item, .bottom-nav__item').forEach(a => a.classList.toggle('is-active', a.dataset.route === state.route));
    closeSidebar();
    loadView(state.route);
  }

  function loadView(r) {
    if (r === 'dashboard') loadDashboard();
    else if (r === 'invoices') loadInvoices();
    else if (r === 'clients') loadClients();
    else if (r === 'settings') loadSettings();
  }

  /* ---------- Dashboard ---------- */
  async function loadDashboard() {
    const view = $('[data-view="dashboard"]');
    try {
      const [stats, revenue, invRes, me] = await Promise.allSettled([
        api('dashboard/stats'),
        api('dashboard/revenue'),
        api('invoices?limit=5'),
        api('auth/me'),
      ]);
      if (me.status === 'fulfilled' && me.value) {
        const name = me.value.businessInfo?.name || me.value.name || 'Camille';
        const t = $('.view--dashboard .page-title');
        if (t) t.innerHTML = `Bonjour, ${esc(name.split(' ')[0])} 👋`;
      }
      if (stats.status === 'fulfilled' && stats.value) renderKpis(stats.value);
      if (revenue.status === 'fulfilled' && revenue.value) renderChart(revenue.value);
      if (invRes.status === 'fulfilled' && invRes.value) {
        const list = invRes.value.data || invRes.value.invoices || invRes.value || [];
        renderRecent(list.slice(0, 5));
      }
    } catch (e) { /* garde le statique en fallback */ }
  }

  function renderKpis(s) {
    const cards = $$('.view--dashboard .kpi');
    const vals = [
      { v: fmtMoney(s.totalRevenue ?? s.total ?? 0), t: s.totalTrend },
      { v: fmtMoney(s.pending ?? s.pendingAmount ?? 0), t: null, c: (s.pendingCount ?? 0) + ' factures' },
      { v: fmtMoney(s.overdue ?? s.overdueAmount ?? 0), t: null, c: (s.overdueCount ?? 0) + ' factures' },
      { v: fmtMoney(s.monthRevenue ?? s.thisMonth ?? 0), t: s.monthTrend },
    ];
    cards.forEach((card, i) => {
      const valEl = $('.kpi__value', card);
      if (valEl && vals[i]) valEl.textContent = vals[i].v;
      const trendEl = $('.kpi__trend', card);
      if (trendEl && vals[i]) {
        if (vals[i].c != null) trendEl.textContent = vals[i].c;
        else if (vals[i].t != null) {
          const up = vals[i].t >= 0;
          trendEl.className = 'kpi__trend ' + (up ? 'up' : 'down');
          trendEl.innerHTML = `<i class="fa-solid fa-arrow-trend-${up ? 'up' : 'down'}"></i> ${up ? '+' : ''}${Number(vals[i].t).toFixed(1)}%`;
        }
      }
    });
  }

  function renderChart(data) {
    const arr = Array.isArray(data) ? data : (data.data || []);
    if (!arr.length) return;
    const bars = $('#revenueChart .chart__bars');
    if (!bars) return;
    const max = Math.max(...arr.map(d => Number(d.amount ?? d.value ?? d.revenue ?? 0)), 1);
    bars.innerHTML = arr.map((d, i) => {
      const amt = Number(d.amount ?? d.value ?? d.revenue ?? 0);
      const h = Math.max(6, Math.round((amt / max) * 100));
      const label = d.label || d.month || '';
      const cur = i === arr.length - 1 ? ' is-current' : '';
      return `<div class="bar${cur}" style="--h:${h}%;--i:${i}" title="${esc(label)}: ${fmtMoney(amt)}"><span>${esc(label)}</span></div>`;
    }).join('');
  }

  function renderRecent(list) {
    const ul = $('.recent-list');
    if (!ul) return;
    if (!list.length) {
      ul.innerHTML = `<li class="recent-item" style="justify-content:center;color:var(--text-3)">Aucune facture récente</li>`;
      return;
    }
    ul.innerHTML = list.map(inv => {
      const cn = inv.client?.name || inv.clientName || 'Client';
      const st = STATUS_MAP[inv.status] || STATUS_MAP.draft;
      return `<li class="recent-item" data-id="${esc(inv.id)}">
        <span class="avatar avatar--sm">${initials(cn)}</span>
        <div class="recent-item__meta">
          <span class="recent-item__name">${esc(cn)}</span>
          <span class="recent-item__sub">${esc(inv.number || '#')}</span>
        </div>
        <span class="amount tabular">${fmtMoney(inv.total)}</span>
        <span class="status ${st.cls}">${st.label}</span>
      </li>`;
    }).join('');
  }

  /* ---------- Invoices ---------- */
  async function loadInvoices() {
    const tbody = $('[data-view="invoices"] .table tbody');
    if (!tbody) return;
    tbody.innerHTML = skeletonRows(5, 7);
    try {
      const st = STATUS_FR[state.filter];
      const q = st ? `?status=${st}` : '';
      const res = await api('invoices' + q);
      const list = res.data || res.invoices || res || [];
      state.invoices = list;
      renderInvoiceTable(list);
    } catch (e) {
      tbody.innerHTML = emptyRow(7, 'Impossible de charger les factures');
    }
  }

  function renderInvoiceTable(list) {
    const tbody = $('[data-view="invoices"] .table tbody');
    if (!tbody) return;
    if (!list.length) { tbody.innerHTML = emptyRow(7, 'Aucune facture'); return; }
    tbody.innerHTML = list.map(inv => {
      const cn = inv.client?.name || inv.clientName || 'Client';
      const st = STATUS_MAP[inv.status] || STATUS_MAP.draft;
      return `<tr data-id="${esc(inv.id)}">
        <td class="tabular">${esc(inv.number || '#')}</td>
        <td>${esc(cn)}</td>
        <td>${fmtDate(inv.issueDate)}</td>
        <td>${fmtDate(inv.dueDate)}</td>
        <td class="ta-right tabular">${fmtMoney(inv.total)}</td>
        <td><span class="status ${st.cls}">${st.label}</span></td>
        <td><button class="icon-btn icon-btn--sm" aria-label="Options" data-menu="${esc(inv.id)}"><i class="fa-solid fa-ellipsis"></i></button></td>
      </tr>`;
    }).join('');
  }

  function bindFilters() {
    $$('.chip--filter').forEach(chip => {
      chip.addEventListener('click', () => {
        $$('.chip--filter').forEach(c => c.classList.remove('is-active'));
        chip.classList.add('is-active');
        state.filter = chip.textContent.trim();
        loadInvoices();
      });
    });
  }

  async function invoiceMenu(id) {
    const inv = state.invoices.find(i => String(i.id) === String(id));
    if (!inv) return;
    const next = inv.status === 'paid' ? 'sent' : 'paid';
    const action = next === 'paid' ? 'Marquer payée' : 'Marquer envoyée';
    if (confirm(`${action} la facture ${inv.number} ?\n(Annuler pour la supprimer)`)) {
      try {
        await api(`invoices/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status: next }) });
        toast('Statut mis à jour');
        loadInvoices();
      } catch (e) { toast(e.message, 'error'); }
    } else {
      if (confirm('Supprimer définitivement cette facture ?')) {
        try {
          await api('invoices/' + id, { method: 'DELETE' });
          toast('Facture supprimée');
          loadInvoices();
        } catch (e) { toast(e.message, 'error'); }
      }
    }
  }

  /* ---------- Clients ---------- */
  async function loadClients() {
    const grid = $('.client-grid');
    if (!grid) return;
    grid.innerHTML = skeletonCards(4);
    try {
      const res = await api('clients');
      const list = res.data || res.clients || res || [];
      state.clients = list;
      renderClients(list);
      fillClientSelect();
    } catch (e) {
      grid.innerHTML = `<p style="color:var(--text-3)">Impossible de charger les clients.</p>`;
    }
  }

  function renderClients(list) {
    const grid = $('.client-grid');
    if (!grid) return;
    if (!list.length) { grid.innerHTML = `<p style="color:var(--text-3)">Aucun client pour le moment.</p>`; return; }
    grid.innerHTML = list.map(c => `<article class="card client-card" data-id="${esc(c.id)}">
      <span class="avatar avatar--lg">${initials(c.name)}</span>
      <h3 class="client-card__name">${esc(c.name)}</h3>
      <p class="client-card__email">${esc(c.email || '')}</p>
      <div class="client-card__stats">
        <span><strong class="tabular">${c.invoiceCount ?? c.invoices?.length ?? 0}</strong> factures</span>
        <span><strong class="tabular">${fmtMoney(c.totalBilled ?? c.total ?? 0)}</strong> total</span>
      </div>
    </article>`).join('');
  }

  function fillClientSelect() {
    const sel = $('#invClient');
    if (!sel || !state.clients.length) return;
    sel.innerHTML = state.clients.map(c => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('');
  }

  async function newClient() {
    const name = prompt('Nom du client :');
    if (!name) return;
    const email = prompt('Email du client :') || '';
    try {
      await api('clients', { method: 'POST', body: JSON.stringify({ name, email }) });
      toast('Client créé');
      loadClients();
    } catch (e) { toast(e.message, 'error'); }
  }

  /* ---------- Settings ---------- */
  async function loadSettings() {
    try {
      const s = await api('settings');
      state.settings = s;
      const bi = s.businessInfo || s;
      if ($('#bizName')) $('#bizName').value = bi.name || '';
      if ($('#bizEmail')) $('#bizEmail').value = bi.email || s.email || '';
      if ($('#bizAddr')) $('#bizAddr').value = bi.address || '';
      if ($('#currency')) $('#currency').value = s.currency || 'EUR';
      if ($('#vat')) $('#vat').value = s.defaultVatRate ?? s.vatRate ?? 20;
      currency = s.currency || 'EUR';
      vatRate = Number(s.defaultVatRate ?? s.vatRate ?? 20);
    } catch (e) { /* fallback statique */ }
  }

  async function saveSettings(e) {
    e.preventDefault();
    const payload = {
      businessInfo: {
        name: $('#bizName').value.trim(),
        email: $('#bizEmail').value.trim(),
        address: $('#bizAddr').value.trim(),
      },
      currency: $('#currency').value,
      defaultVatRate: Number($('#vat').value) || 0,
    };
    try {
      await api('settings', { method: 'PUT', body: JSON.stringify(payload) });
      currency = payload.currency;
      vatRate = payload.defaultVatRate;
      toast('Paramètres enregistrés');
    } catch (err) { toast(err.message, 'error'); }
  }

  /* ---------- Slide-over invoice ---------- */
  function openSlideover() {
    if (state.clients.length) fillClientSelect();
    else loadClients();
    const today = new Date().toISOString().slice(0, 10);
    const due = new Date(Date.now() + 14 * 864e5).toISOString().slice(0, 10);
    if ($('#invIssue') && !$('#invIssue').value) $('#invIssue').value = today;
    if ($('#invDue') && !$('#invDue').value) $('#invDue').value = due;
    renderItems();
    $('#overlay').hidden = false;
    $('#invoiceSlideover').classList.add('is-open');
    $('#invoiceSlideover').setAttribute('aria-hidden', 'false');
  }
  function closeSlideover() {
    $('#invoiceSlideover').classList.remove('is-open');
    $('#invoiceSlideover').setAttribute('aria-hidden', 'true');
    $('#overlay').hidden = true;
  }

  function renderItems() {
    const list = $('#itemsList');
    if (!list) return;
    list.innerHTML = state.items.map((it, i) => `<div class="item-row" data-i="${i}">
      <input type="text" placeholder="Description" class="item-desc" value="${esc(it.desc)}" />
      <input type="number" placeholder="Qté" class="item-qty tabular" value="${it.qty}" min="0" />
      <input type="number" placeholder="Prix" class="item-price tabular" value="${it.price}" min="0" />
    </div>`).join('');
    computeTotals();
  }

  function syncItemsFromDOM() {
    state.items = $$('#itemsList .item-row').map(row => ({
      desc: $('.item-desc', row).value,
      qty: Number($('.item-qty', row).value) || 0,
      price: Number($('.item-price', row).value) || 0,
    }));
  }

  function computeTotals() {
    const sub = state.items.reduce((s, it) => s + it.qty * it.price, 0);
    const vat = sub * (vatRate / 100);
    if ($('#subtotal')) $('#subtotal').textContent = fmtMoney2(sub);
    if ($('#vatAmount')) $('#vatAmount').textContent = fmtMoney2(vat);
    if ($('#total')) $('#total').textContent = fmtMoney2(sub + vat);
    const vatLabel = $('.totals__row:nth-child(2) span:first-child');
    if (vatLabel) vatLabel.textContent = `TVA (${vatRate}%)`;
  }

  async function submitInvoice(status) {
    syncItemsFromDOM();
    const clientId = $('#invClient').value;
    if (!clientId) { toast('Sélectionnez un client', 'error'); return; }
    if (!state.items.length || state.items.every(i => !i.desc)) { toast('Ajoutez au moins une ligne', 'error'); return; }
    const sub = state.items.reduce((s, it) => s + it.qty * it.price, 0);
    const vat = sub * (vatRate / 100);
    const payload = {
      clientId,
      status,
      issueDate: $('#invIssue').value,
      dueDate: $('#invDue').value,
      items: state.items.filter(i => i.desc),
      subtotal: sub,
      vatAmount: vat,
      total: sub + vat,
      currency,
    };
    try {
      await api('invoices', { method: 'POST', body: JSON.stringify(payload) });
      toast(status === 'draft' ? 'Brouillon enregistré' : 'Facture créée & envoyée');
      closeSlideover();
      state.items = [{ desc: '', qty: 1, price: 0 }];
      if (state.route === 'invoices') loadInvoices();
      else if (state.route === 'dashboard') loadDashboard();
    } catch (e) { toast(e.message, 'error'); }
  }

  /* ---------- Helpers UI ---------- */
  function skeletonRows(rows, cols) {
    let html = '';
    for (let r = 0; r < rows; r++) {
      html += '<tr>';
      for (let c = 0; c < cols; c++) html += `<td><span style="display:block;height:14px;border-radius:6px;background:var(--surface-2);animation:pulse 1.4s infinite"></span></td>`;
      html += '</tr>';
    }
    return html;
  }
  function skeletonCards(n) {
    let h = '';
    for (let i = 0; i < n; i++) h += `<article class="card client-card"><span class="avatar avatar--lg" style="background:var(--surface-2)"></span><h3 class="client-card__name" style="width:80px;height:14px;background:var(--surface-2);border-radius:6px"></h3></article>`;
    return h;
  }
  function emptyRow(cols, msg) {
    return `<tr><td colspan="${cols}" style="text-align:center;padding:48px;color:var(--text-3)"><i class="fa-solid fa-inbox" style="font-size:1.6rem;display:block;margin-bottom:8px"></i>${esc(msg)}</td></tr>`;
  }

  function toggleSidebar() { $('#sidebar').classList.toggle('is-open'); }
  function closeSidebar() { $('#sidebar').classList.remove('is-open'); }

  function toggleTheme() {
    const cur = document.body.dataset.theme === 'dark' ? 'light' : 'dark';
    document.body.dataset.theme = cur;
    localStorage.setItem('aura_theme', cur);
    const btn = $('#themeToggle');
    btn.querySelector('i').className = cur === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
    btn.querySelector('span').textContent = cur === 'dark' ? 'Mode clair' : 'Mode sombre';
  }

  let searchTimer;
  function onSearch(e) {
    clearTimeout(searchTimer);
    const q = e.target.value.toLowerCase().trim();
    searchTimer = setTimeout(() => {
      if (state.route === 'invoices') {
        const filtered = !q ? state.invoices : state.invoices.filter(i =>
          (i.number || '').toLowerCase().includes(q) ||
          (i.client?.name || i.clientName || '').toLowerCase().includes(q));
        renderInvoiceTable(filtered);
      } else if (state.route === 'clients') {
        const filtered = !q ? state.clients : state.clients.filter(c =>
          (c.name || '').toLowerCase().includes(q) || (c.email || '').toLowerCase().includes(q));
        renderClients(filtered);
      }
    }, 220);
  }

  /* ---------- Bindings ---------- */
  function bind() {
    window.addEventListener('hashchange', setRoute);

    $('#menuToggle')?.addEventListener('click', toggleSidebar);
    $('#themeToggle')?.addEventListener('click', toggleTheme);
    $('#globalSearch')?.addEventListener('input', onSearch);

    $('#newInvoiceBtn')?.addEventListener('click', openSlideover);
    $('#closeSlideover')?.addEventListener('click', closeSlideover);
    $('#overlay')?.addEventListener('click', closeSlideover);
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSlideover(); });

    document.addEventListener('click', e => {
      const newInv = e.target.closest('[data-action="new-invoice"]');
      if (newInv) { e.preventDefault(); openSlideover(); return; }
      const clientNew = e.target.closest('[data-view="clients"] .btn--primary');
      if (clientNew) { e.preventDefault(); newClient(); return; }
      const menu = e.target.closest('[data-menu]');
      if (menu) { invoiceMenu(menu.dataset.menu); return; }
      const row = e.target.closest('[data-view="invoices"] tbody tr[data-id]');
      if (row && !e.target.closest('button')) { location.hash = '#/invoices/' + row.dataset.id; }
    });

    $('#addItem')?.addEventListener('click', () => {
      syncItemsFromDOM();
      state.items.push({ desc: '', qty: 1, price: 0 });
      renderItems();
    });
    $('#itemsList')?.addEventListener('input', () => { syncItemsFromDOM(); computeTotals(); });

    $('#saveInvoice')?.addEventListener('click', e => { e.preventDefault(); submitInvoice('sent'); });
    $('#saveDraft')?.addEventListener('click', e => { e.preventDefault(); submitInvoice('draft'); });
    $('#invoiceForm')?.addEventListener('submit', e => { e.preventDefault(); submitInvoice('sent'); });

    $('#settingsForm')?.addEventListener('submit', saveSettings);
    $('.settings-card .btn--ghost')?.addEventListener('click', () => loadSettings());

    bindFilters();
  }

  function initTheme() {
    const saved = localStorage.getItem('aura_theme');
    if (saved) {
      document.body.dataset.theme = saved;
      if (saved === 'dark') {
        $('#themeToggle').querySelector('i').className = 'fa-solid fa-sun';
        $('#themeToggle').querySelector('span').textContent = 'Mode clair';
      }
    }
  }

  function init() {
    initTheme();
    bind();
    setRoute();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
