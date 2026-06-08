const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

const api = async (path, opts = {}) => {
  const o = { headers: { 'Content-Type': 'application/json' }, ...opts };
  const t = localStorage.getItem('token');
  if (t) o.headers['Authorization'] = `Bearer ${t}`;
  if (o.body && typeof o.body !== 'string') o.body = JSON.stringify(o.body);
  const r = await fetch(`api/${path}`, o);
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).message || `Erreur ${r.status}`);
  return r.status === 204 ? null : r.json();
};

const euros = n => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n || 0);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const initials = n => (n || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

const STAGES = [
  { key: 'Nouveau', dot: 'indigo' },
  { key: 'Contacté', dot: 'blue' },
  { key: 'Proposition', dot: 'amber' },
  { key: 'Négociation', dot: 'orange' },
  { key: 'Gagné', dot: 'green' },
  { key: 'Perdu', dot: 'red' }
];
const STATUS_MAP = {
  'Nouveau': 'new', 'Contacté': 'contact', 'Proposition': 'prop',
  'Proposition envoyée': 'prop', 'Négociation': 'prop', 'Gagné': 'won', 'Perdu': 'lost'
};
const AV_CLASSES = ['i', 'v', 'g', 'b', 'a', 'r'];
const avClass = s => AV_CLASSES[[...String(s)].reduce((a, c) => a + c.charCodeAt(0), 0) % AV_CLASSES.length];

const SRC_ICON = {
  'Site web': 'fa-solid fa-globe', 'LinkedIn': 'fa-brands fa-linkedin',
  'Recommandation': 'fa-solid fa-user-group', 'Email': 'fa-solid fa-envelope'
};

const state = { user: null, contacts: [], deals: [], tasks: [], filter: 'all', editingId: null, modalCtx: 'contact' };

/* ---------- Toast ---------- */
function toast(msg, type = 'ok') {
  let c = $('#toast-wrap');
  if (!c) {
    c = document.createElement('div');
    c.id = 'toast-wrap';
    c.style.cssText = 'position:fixed;top:20px;right:20px;z-index:200;display:flex;flex-direction:column;gap:10px';
    document.body.appendChild(c);
  }
  const t = document.createElement('div');
  t.style.cssText = `background:var(--surface);border:1px solid var(--line);border-left:4px solid ${type === 'err' ? 'var(--red)' : 'var(--green)'};color:var(--text);padding:13px 18px;border-radius:12px;box-shadow:var(--shadow-lg);font-size:.9rem;font-weight:500;max-width:320px;animation:fade .3s`;
  t.textContent = msg;
  c.appendChild(t);
  setTimeout(() => { t.style.transition = 'opacity .3s'; t.style.opacity = '0'; setTimeout(() => t.remove(), 300); }, 3000);
}

/* ---------- Auth ---------- */
function showApp() { $('#landing').classList.add('hidden'); $('#dashboard').classList.remove('hidden'); }
function showLanding() { $('#dashboard').classList.add('hidden'); $('#landing').classList.remove('hidden'); }

async function openApp() {
  const t = localStorage.getItem('token');
  if (t) {
    try {
      const me = await api('auth/me');
      state.user = me.user || me;
      showApp();
      applyUser();
      loadAll();
      return;
    } catch { localStorage.removeItem('token'); }
  }
  openAuthModal();
}

function applyUser() {
  if (!state.user) return;
  const u = state.user;
  $$('.sb-user strong').forEach(e => e.textContent = u.name || 'Utilisateur');
  const av = $('.sb-user img');
  if (av && u.avatar) av.src = u.avatar;
  const dh = $('#view-dashboard .view-head h1');
  if (dh) dh.textContent = `Bonjour, ${(u.name || '').split(' ')[0] || ''} 👋`;
}

function openAuthModal(mode = 'login') {
  const m = $('#modal');
  m.classList.remove('hidden');
  state.modalCtx = 'auth';
  const card = $('.modal-card', m);
  card.innerHTML = `
    <div class="modal-head"><h3>${mode === 'login' ? 'Connexion' : 'Créer un compte'}</h3><button class="icon-btn" data-action="close-modal"><i class="fa-solid fa-xmark"></i></button></div>
    <div class="modal-body">
      <form id="auth-form">
        <div class="form-grid">
          ${mode === 'register' ? '<label class="field full"><span>Nom complet</span><input name="name" type="text" required placeholder="Julie Renard"></label>' : ''}
          <label class="field full"><span>Email</span><input name="email" type="email" required placeholder="vous@exemple.com"></label>
          <label class="field full"><span>Mot de passe</span><input name="password" type="password" required minlength="4" placeholder="••••••••"></label>
        </div>
        <button class="btn btn-primary btn-block" type="submit" style="margin-top:8px">${mode === 'login' ? 'Se connecter' : "Créer mon compte"}</button>
      </form>
      <p style="text-align:center;margin-top:16px;font-size:.88rem;color:var(--text-2)">
        ${mode === 'login' ? "Pas de compte ?" : "Déjà inscrit ?"}
        <a href="#" id="auth-switch" style="color:var(--indigo);font-weight:600">${mode === 'login' ? "S'inscrire" : "Se connecter"}</a>
      </p>
    </div>`;
  $('#auth-switch').onclick = e => { e.preventDefault(); openAuthModal(mode === 'login' ? 'register' : 'login'); };
  $('#auth-form').onsubmit = async e => {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(e.target));
    try {
      const res = await api(`auth/${mode}`, { method: 'POST', body: fd });
      if (res.token) localStorage.setItem('token', res.token);
      state.user = res.user || res;
      closeModal();
      showApp();
      applyUser();
      loadAll();
      toast(`Bienvenue ${state.user.name || ''} 👋`);
    } catch (err) { toast(err.message, 'err'); }
  };
}

function logout() {
  localStorage.removeItem('token');
  state.user = null;
  showLanding();
}

/* ---------- Data loading ---------- */
async function loadAll() {
  await Promise.allSettled([loadContacts(), loadDeals(), loadTasks(), loadStats()]);
}

async function loadContacts() {
  try { state.contacts = await api('contacts'); } catch { state.contacts = []; }
  renderContacts();
}

async function loadDeals() {
  try { state.deals = await api('deals'); } catch { state.deals = []; }
  renderPipeline();
}

async function loadTasks() {
  try { state.tasks = await api('tasks'); } catch { state.tasks = []; }
  renderTasks();
  renderTaskMini();
  updateTaskBadge();
}

async function loadStats() {
  try {
    const s = await api('dashboard/stats');
    renderStats(s);
  } catch {}
}

/* ---------- Render: Stats ---------- */
function renderStats(s) {
  const vals = $$('#view-dashboard .kpi-val');
  if (vals.length >= 4) {
    vals[0].textContent = s.activeProspects ?? state.contacts.length;
    vals[1].textContent = (s.conversionRate ?? 0) + '%';
    vals[2].textContent = euros(s.pipelineValue ?? state.deals.reduce((a, d) => a + (+d.value || 0), 0));
    vals[3].textContent = s.overdueTasks ?? state.tasks.filter(isOverdue).length;
  }
  if (s.monthly && s.monthly.length) renderChart(s.monthly);
}

function renderChart(months) {
  const max = Math.max(...months.map(m => m.count), 1);
  $('#view-dashboard .bars').innerHTML = months.map((m, i) =>
    `<div class="bar-col"><div class="bar${i === months.length - 1 ? ' active' : ''}" style="height:${Math.round((m.count / max) * 100)}%"></div><span>${esc(m.label)}</span></div>`
  ).join('');
}

/* ---------- Render: Contacts ---------- */
function renderContacts() {
  const tbody = $('#view-contacts tbody');
  let list = state.contacts;
  if (state.filter !== 'all') {
    list = list.filter(c => {
      const st = c.status || '';
      if (state.filter === 'enc') return ['Contacté', 'Proposition', 'Proposition envoyée', 'Négociation'].includes(st);
      return st === state.filter || st.startsWith(state.filter);
    });
  }
  $('#view-contacts .view-head p').textContent = `${state.contacts.length} prospect${state.contacts.length > 1 ? 's' : ''} au total.`;
  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--text-3)">Aucun prospect. Créez votre premier prospect.</td></tr>`;
    return;
  }
  tbody.innerHTML = list.map(c => `
    <tr data-id="${c.id}">
      <td class="c-name"><span class="avatar ${avClass(c.name)}">${esc(initials(c.name))}</span><div><strong>${esc(c.name)}</strong><span>${esc(c.email || '')}</span></div></td>
      <td>${esc(c.company || '—')}</td>
      <td><span class="src"><i class="${SRC_ICON[c.source] || 'fa-solid fa-globe'}"></i> ${esc(c.source || '—')}</span></td>
      <td><b>${euros(c.estimatedValue)}</b></td>
      <td><span class="status ${STATUS_MAP[c.status] || 'new'}">${esc(c.status || 'Nouveau')}</span></td>
      <td><button class="icon-btn" data-action="del-contact" data-id="${c.id}" title="Supprimer"><i class="fa-solid fa-trash"></i></button></td>
    </tr>`).join('');
}

/* ---------- Render: Pipeline ---------- */
function dealName(d) {
  const c = state.contacts.find(c => c.id === d.contactId);
  return d.name || (c && c.name) || 'Sans nom';
}
function dealCompany(d) {
  const c = state.contacts.find(c => c.id === d.contactId);
  return d.company || (c && c.company) || '';
}

function renderPipeline() {
  const board = $('.kanban');
  board.innerHTML = STAGES.map(s => {
    const cards = state.deals.filter(d => normStage(d.stage) === s.key);
    const total = cards.reduce((a, d) => a + (+d.value || 0), 0);
    return `<div class="k-col" data-stage="${s.key}">
      <div class="k-col-head"><span class="k-dot ${s.dot}"></span>${s.key} <em>${cards.length}</em><b>${euros(total)}</b></div>
      <div class="k-cards">${cards.map(d => cardHtml(d, s.key)).join('')}</div>
    </div>`;
  }).join('');
  bindKanban();
}

function normStage(st) {
  if (!st) return 'Nouveau';
  if (st === 'Proposition envoyée') return 'Proposition';
  return STAGES.find(s => s.key === st) ? st : 'Nouveau';
}

function cardHtml(d, stage) {
  const cls = stage === 'Gagné' ? ' win' : stage === 'Perdu' ? ' lost' : stage === 'Proposition' ? ' hot' : '';
  const tag = stage === 'Gagné' ? '<span class="kc-tag win">Gagné</span>' : stage === 'Perdu' ? '<span class="kc-tag lost">Perdu</span>' : `<span class="kc-tag">${esc(d.tag || stage)}</span>`;
  return `<div class="k-card${cls}" draggable="true" data-id="${d.id}">
    <div class="kc-top"><strong>${esc(dealName(d))}</strong>${tag}</div>
    <span class="kc-company">${esc(dealCompany(d) || '—')}</span>
    <div class="kc-foot"><b>${euros(d.value)}</b><span class="avatar ${avClass(dealName(d))}" style="width:24px;height:24px;border-radius:50%;font-size:.6rem">${esc(initials(dealName(d)))}</span></div>
  </div>`;
}

function bindKanban() {
  let dragged = null;
  $$('.k-card').forEach(card => {
    card.addEventListener('dragstart', () => { dragged = card; card.classList.add('dragging'); });
    card.addEventListener('dragend', () => { card.classList.remove('dragging'); dragged = null; });
  });
  $$('.k-col').forEach(col => {
    col.addEventListener('dragover', e => { e.preventDefault(); col.classList.add('drag-over'); });
    col.addEventListener('dragleave', () => col.classList.remove('drag-over'));
    col.addEventListener('drop', async e => {
      e.preventDefault();
      col.classList.remove('drag-over');
      if (!dragged) return;
      const id = dragged.dataset.id;
      const stage = col.dataset.stage;
      const deal = state.deals.find(d => String(d.id) === String(id));
      if (!deal || normStage(deal.stage) === stage) return;
      deal.stage = stage;
      renderPipeline();
      try {
        await api(`deals/${id}/stage`, { method: 'PUT', body: { stage } });
        toast(`Déplacé vers « ${stage} »`);
        loadStats();
      } catch (err) { toast(err.message, 'err'); loadDeals(); }
    });
  });
}

/* ---------- Render: Tasks ---------- */
function isOverdue(t) {
  if (t.completed || !t.dueDate) return false;
  return new Date(t.dueDate) < new Date(new Date().toDateString());
}
function fmtDue(t) {
  if (!t.dueDate) return '';
  const d = new Date(t.dueDate), now = new Date();
  const days = Math.round((d - new Date(now.toDateString())) / 86400000);
  if (t.completed) return 'Terminé';
  if (days < 0) return `Échéance dépassée · ${Math.abs(days)} j`;
  if (days === 0) return "Aujourd'hui";
  if (days === 1) return 'Demain';
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'short' });
}
function taskPerson(t) {
  const c = state.contacts.find(c => c.id === t.contactId);
  return c ? c.name : (t.person || '');
}

function renderTasks() {
  const overdue = state.tasks.filter(isOverdue);
  const upcoming = state.tasks.filter(t => !isOverdue(t));
  const cols = $$('#view-tasks .panel');
  if (cols[0]) {
    $('.count-pill', cols[0]).textContent = overdue.length;
    $('.task-list', cols[0]).innerHTML = overdue.length
      ? overdue.map(t => taskHtml(t, true)).join('')
      : emptyTasks('Aucune relance en retard 🎉');
  }
  if (cols[1]) {
    $('.count-pill', cols[1]).textContent = upcoming.length;
    $('.task-list', cols[1]).innerHTML = upcoming.length
      ? upcoming.map(t => taskHtml(t, false)).join('')
      : emptyTasks('Rien de prévu.');
  }
}
function emptyTasks(m) { return `<li style="padding:24px;text-align:center;color:var(--text-3);font-size:.88rem">${m}</li>`; }

function taskHtml(t, over) {
  const ico = t.completed ? 'fa-solid fa-check' : over ? 'fa-regular fa-calendar' : 'fa-regular fa-clock';
  return `<li class="task${over ? ' overdue' : ''}${t.completed ? ' done' : ''}" data-id="${t.id}">
    <input type="checkbox" data-action="toggle-task" ${t.completed ? 'checked' : ''}>
    <div class="task-body"><strong>${esc(t.title)}</strong><span><i class="${ico}"></i> ${esc(fmtDue(t))}</span></div>
    ${taskPerson(t) ? `<span class="task-pers">${esc(taskPerson(t))}</span>` : ''}
  </li>`;
}

function renderTaskMini() {
  const ul = $('#view-dashboard .task-mini');
  if (!ul) return;
  const pending = [...state.tasks].filter(t => !t.completed).sort((a, b) => new Date(a.dueDate || 0) - new Date(b.dueDate || 0)).slice(0, 5);
  if (!pending.length) { ul.innerHTML = `<li style="padding:14px;color:var(--text-3);font-size:.88rem">Aucune relance prévue.</li>`; return; }
  ul.innerHTML = pending.map(t => {
    const over = isOverdue(t);
    return `<li><span class="tm-check${over ? ' overdue' : ''}"><i class="${over ? 'fa-solid fa-exclamation' : 'fa-regular fa-circle'}"></i></span>
      <div><strong>${esc(t.title)}</strong><span>${esc(fmtDue(t))}</span></div>
      ${over ? '<b class="late">Retard</b>' : ''}</li>`;
  }).join('');
}

function updateTaskBadge() {
  const b = $('.sb-badge');
  const n = state.tasks.filter(t => !t.completed).length;
  if (b) { b.textContent = n; b.style.display = n ? '' : 'none'; }
}

async function toggleTask(li) {
  const id = li.dataset.id;
  const t = state.tasks.find(t => String(t.id) === String(id));
  if (!t) return;
  t.completed = !t.completed;
  renderTasks(); renderTaskMini(); updateTaskBadge();
  try { await api(`tasks/${id}`, { method: 'PUT', body: { completed: t.completed } }); loadStats(); }
  catch (err) { toast(err.message, 'err'); t.completed = !t.completed; renderTasks(); }
}

/* ---------- Modals: Contact ---------- */
function openContactModal() {
  state.modalCtx = 'contact';
  state.editingId = null;
  const m = $('#modal');
  $('.modal-card', m).innerHTML = `
    <div class="modal-head"><h3>Nouveau prospect</h3><button class="icon-btn" data-action="close-modal"><i class="fa-solid fa-xmark"></i></button></div>
    <div class="modal-body">
      <form id="contact-form"><div class="form-grid">
        <label class="field"><span>Nom</span><input name="name" type="text" required placeholder="Ex : Jean Dupont"></label>
        <label class="field"><span>Entreprise</span><input name="company" type="text" placeholder="Ex : Dupont SARL"></label>
        <label class="field"><span>Email</span><input name="email" type="email" placeholder="jean@exemple.com"></label>
        <label class="field"><span>Téléphone</span><input name="phone" type="tel" placeholder="+33 6 …"></label>
        <label class="field"><span>Source</span><select name="source"><option>Site web</option><option>LinkedIn</option><option>Recommandation</option><option>Email</option></select></label>
        <label class="field"><span>Valeur estimée (€)</span><input name="estimatedValue" type="number" placeholder="5000"></label>
        <label class="field full"><span>Étape</span><select name="status"><option>Nouveau</option><option>Contacté</option><option>Proposition</option><option>Négociation</option></select></label>
      </div></form>
    </div>
    <div class="modal-foot"><button class="btn btn-ghost" data-action="close-modal">Annuler</button><button class="btn btn-primary" type="submit" form="contact-form"><i class="fa-solid fa-check"></i> Créer le prospect</button></div>`;
  m.classList.remove('hidden');
  $('#contact-form').onsubmit = submitContact;
}

async function submitContact(e) {
  e.preventDefault();
  const fd = Object.fromEntries(new FormData(e.target));
  fd.estimatedValue = Number(fd.estimatedValue) || 0;
  try {
    const c = await api('contacts', { method: 'POST', body: fd });
    state.contacts.unshift(c.id ? c : { ...fd, id: Date.now() });
    try {
      const deal = await api('deals', { method: 'POST', body: { contactId: (c && c.id), stage: fd.status, value: fd.estimatedValue } });
      state.deals.push(deal);
    } catch {}
    closeModal();
    renderContacts(); renderPipeline(); loadStats();
    toast('Prospect créé ✅');
  } catch (err) { toast(err.message, 'err'); }
}

async function delContact(id) {
  if (!confirm('Supprimer ce prospect ?')) return;
  try {
    await api(`contacts/${id}`, { method: 'DELETE' });
    state.contacts = state.contacts.filter(c => String(c.id) !== String(id));
    state.deals = state.deals.filter(d => String(d.contactId) !== String(id));
    renderContacts(); renderPipeline(); loadStats();
    toast('Prospect supprimé');
  } catch (err) { toast(err.message, 'err'); }
}

/* ---------- Task modal ---------- */
function openTaskModal() {
  state.modalCtx = 'task';
  const m = $('#modal');
  const opts = state.contacts.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('');
  $('.modal-card', m).innerHTML = `
    <div class="modal-head"><h3>Nouvelle relance</h3><button class="icon-btn" data-action="close-modal"><i class="fa-solid fa-xmark"></i></button></div>
    <div class="modal-body"><form id="task-form"><div class="form-grid">
      <label class="field full"><span>Titre</span><input name="title" type="text" required placeholder="Relancer …"></label>
      <label class="field"><span>Échéance</span><input name="dueDate" type="date" required></label>
      <label class="field"><span>Prospect</span><select name="contactId"><option value="">—</option>${opts}</select></label>
    </div></form></div>
    <div class="modal-foot"><button class="btn btn-ghost" data-action="close-modal">Annuler</button><button class="btn btn-primary" type="submit" form="task-form"><i class="fa-solid fa-check"></i> Créer</button></div>`;
  m.classList.remove('hidden');
  $('#task-form').onsubmit = async e => {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(e.target));
    if (!fd.contactId) delete fd.contactId;
    try {
      const t = await api('tasks', { method: 'POST', body: { ...fd, completed: false } });
      state.tasks.push(t.id ? t : { ...fd, id: Date.now(), completed: false });
      closeModal();
      renderTasks(); renderTaskMini(); updateTaskBadge(); loadStats();
      toast('Relance créée ✅');
    } catch (err) { toast(err.message, 'err'); }
  };
}

function closeModal() { $('#modal').classList.add('hidden'); }

/* ---------- Navigation ---------- */
function setView(id) {
  $$('.view').forEach(v => v.classList.toggle('active', v.id === id));
  $$('.sb-link').forEach(l => l.classList.toggle('active', l.dataset.view === id));
  if (window.innerWidth <= 768) $('.sidebar').classList.remove('open');
}

/* ---------- Theme ---------- */
function toggleTheme() {
  const cur = document.documentElement.getAttribute('data-theme');
  const next = cur === 'dark' ? '' : 'dark';
  if (next) document.documentElement.setAttribute('data-theme', next);
  else document.documentElement.removeAttribute('data-theme');
  localStorage.setItem('theme', next);
  $$('[data-action="toggle-theme"] i').forEach(i => i.className = next === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon');
}

/* ---------- Search ---------- */
function bindSearch() {
  const inp = $('.search input');
  if (!inp) return;
  inp.addEventListener('input', () => {
    const q = inp.value.toLowerCase().trim();
    $$('#view-contacts tbody tr').forEach(tr => {
      tr.style.display = !q || tr.textContent.toLowerCase().includes(q) ? '' : 'none';
    });
    if (q && !$('#view-contacts').classList.contains('active')) setView('view-contacts');
  });
}

/* ---------- Settings save ---------- */
async function saveProfile() {
  const inputs = $$('#view-settings .form-grid input');
  const body = { name: inputs[0]?.value, email: inputs[1]?.value, activity: inputs[2]?.value, phone: inputs[3]?.value };
  try {
    await api('auth/me', { method: 'PUT', body });
    state.user = { ...state.user, ...body };
    applyUser();
    toast('Profil enregistré ✅');
  } catch (err) { toast(err.message, 'err'); }
}

/* ---------- Events ---------- */
document.addEventListener('click', e => {
  const a = e.target.closest('[data-action]');
  if (a) {
    const act = a.dataset.action;
    if (act === 'open-app') { e.preventDefault(); openApp(); }
    else if (act === 'logout') logout();
    else if (act === 'new-contact') openContactModal();
    else if (act === 'close-modal') closeModal();
    else if (act === 'toggle-theme') toggleTheme();
    else if (act === 'toggle-sidebar') $('.sidebar').classList.toggle('open');
    else if (act === 'toggle-burger') $('.sidebar')?.classList.toggle('open');
    else if (act === 'del-contact') delContact(a.dataset.id);
  }
  const link = e.target.closest('.sb-link, [data-view]');
  if (link && link.dataset.view) { e.preventDefault(); setView(link.dataset.view); }
  const chip = e.target.closest('.filters .chip');
  if (chip) {
    $$('.filters .chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    const map = { 'Tous': 'all', 'Nouveau': 'Nouveau', 'En cours': 'enc', 'Gagné': 'Gagné', 'Perdu': 'Perdu' };
    state.filter = map[chip.textContent.trim()] || 'all';
    renderContacts();
  }
  const newTask = e.target.closest('#view-tasks .view-head .btn');
  if (newTask) openTaskModal();
  const saveBtn = e.target.closest('#view-settings .panel .btn-primary');
  if (saveBtn) saveProfile();
});

document.addEventListener('change', e => {
  if (e.target.matches('[data-action="toggle-task"]')) {
    const li = e.target.closest('.task');
    if (li) toggleTask(li);
  }
});

/* ---------- Init ---------- */
(function init() {
  const th = localStorage.getItem('theme');
  if (th === 'dark') { document.documentElement.setAttribute('data-theme', 'dark'); $$('[data-action="toggle-theme"] i').forEach(i => i.className = 'fa-solid fa-sun'); }
  bindSearch();
  if (localStorage.getItem('token')) openApp();
})();
