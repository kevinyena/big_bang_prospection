const COLUMNS = [
  { id: 'todo',  label: 'À faire',   cls: 'col-todo'  },
  { id: 'doing', label: 'En cours',  cls: 'col-doing' },
  { id: 'done',  label: 'Terminé',   cls: 'col-done'  }
];

let tasks = [];
let draggedId = null;

const board = document.getElementById('board');
const overlay = document.getElementById('modalOverlay');
const form = document.getElementById('taskForm');
const modalTitle = document.getElementById('modalTitle');

/* ---------- API helpers ---------- */
async function api(path, options = {}) {
  const res = await fetch('api' + path, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  if (!res.ok) throw new Error('Erreur réseau');
  return res.json();
}

async function loadTasks() {
  board.innerHTML = '<div class="loading"><div class="spinner"></div>Chargement du tableau...</div>';
  try {
    const { data } = await api('/tasks');
    tasks = data;
    render();
  } catch (e) {
    board.innerHTML = '<div class="loading">Impossible de charger les tâches.</div>';
  }
}

/* ---------- Render ---------- */
function render() {
  board.innerHTML = '';
  COLUMNS.forEach(col => {
    const colTasks = tasks.filter(t => t.status === col.id);
    const colEl = document.createElement('section');
    colEl.className = `column ${col.cls}`;
    colEl.dataset.status = col.id;
    colEl.innerHTML = `
      <div class="col-head">
        <div class="col-title"><span class="col-dot"></span>${col.label}</div>
        <span class="col-count">${colTasks.length}</span>
      </div>
      <div class="cards"></div>`;
    const cardsWrap = colEl.querySelector('.cards');

    if (colTasks.length === 0) {
      cardsWrap.innerHTML = '<div class="empty">Aucune tâche</div>';
    }
    colTasks.forEach(t => cardsWrap.appendChild(buildCard(t)));

    // Drag & drop targets
    colEl.addEventListener('dragover', e => { e.preventDefault(); colEl.classList.add('drag-over'); });
    colEl.addEventListener('dragleave', () => colEl.classList.remove('drag-over'));
    colEl.addEventListener('drop', e => {
      e.preventDefault();
      colEl.classList.remove('drag-over');
      if (draggedId !== null) moveTask(draggedId, col.id);
    });

    board.appendChild(colEl);
  });
  document.getElementById('totalCount').textContent = tasks.length;
}

function buildCard(t) {
  const card = document.createElement('article');
  card.className = 'card';
  card.draggable = true;
  card.dataset.id = t.id;
  const prioLabel = { low: 'Basse', medium: 'Moyenne', high: 'Haute' }[t.priority];
  card.innerHTML = `
    <span class="card-prio ${t.priority}"></span>
    <h3>${escapeHtml(t.title)}</h3>
    ${t.description ? `<p>${escapeHtml(t.description)}</p>` : ''}
    <div class="card-foot">
      <span class="badge ${t.priority}">${prioLabel}</span>
      <div class="card-actions">
        <button class="icon-btn edit" title="Modifier"><i class="fa-solid fa-pen"></i></button>
        <button class="icon-btn del" title="Supprimer"><i class="fa-solid fa-trash"></i></button>
      </div>
    </div>`;

  card.addEventListener('dragstart', () => { draggedId = t.id; card.classList.add('dragging'); });
  card.addEventListener('dragend', () => card.classList.remove('dragging'));
  card.querySelector('.edit').addEventListener('click', () => openModal(t));
  card.querySelector('.del').addEventListener('click', () => deleteTask(t.id));
  return card;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}

/* ---------- CRUD ---------- */
async function moveTask(id, status) {
  const task = tasks.find(t => t.id === id);
  if (!task || task.status === status) return;
  task.status = status; // optimistic
  render();
  try {
    await api('/tasks/' + id, { method: 'PUT', body: JSON.stringify({ status }) });
  } catch { loadTasks(); }
}

async function deleteTask(id) {
  tasks = tasks.filter(t => t.id !== id); // optimistic
  render();
  toast('Tâche supprimée', 'fa-trash');
  try { await api('/tasks/' + id, { method: 'DELETE' }); } catch { loadTasks(); }
}

async function saveTask(e) {
  e.preventDefault();
  const id = document.getElementById('taskId').value;
  const payload = {
    title: document.getElementById('taskTitle').value.trim(),
    description: document.getElementById('taskDesc').value.trim(),
    priority: document.getElementById('taskPriority').value,
    status: document.getElementById('taskStatus').value
  };
  if (!payload.title) return;
  closeModal();
  try {
    if (id) {
      const { data } = await api('/tasks/' + id, { method: 'PUT', body: JSON.stringify(payload) });
      const i = tasks.findIndex(t => t.id === Number(id));
      if (i > -1) tasks[i] = data;
      toast('Tâche mise à jour', 'fa-check');
    } else {
      const { data } = await api('/tasks', { method: 'POST', body: JSON.stringify(payload) });
      tasks.push(data);
      toast('Tâche créée', 'fa-check');
    }
    render();
  } catch { loadTasks(); }
}

/* ---------- Modal ---------- */
function openModal(task = null) {
  form.reset();
  if (task) {
    modalTitle.textContent = 'Modifier la tâche';
    document.getElementById('taskId').value = task.id;
    document.getElementById('taskTitle').value = task.title;
    document.getElementById('taskDesc').value = task.description || '';
    document.getElementById('taskPriority').value = task.priority;
    document.getElementById('taskStatus').value = task.status;
  } else {
    modalTitle.textContent = 'Nouvelle tâche';
    document.getElementById('taskId').value = '';
  }
  overlay.classList.add('open');
  setTimeout(() => document.getElementById('taskTitle').focus(), 50);
}
function closeModal() { overlay.classList.remove('open'); }

/* ---------- Toast ---------- */
let toastTimer;
function toast(msg, icon = 'fa-check') {
  const el = document.getElementById('toast');
  el.innerHTML = `<i class="fa-solid ${icon}"></i> ${msg}`;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2500);
}

/* ---------- Events ---------- */
document.getElementById('openModalBtn').addEventListener('click', () => openModal());
document.getElementById('closeModalBtn').addEventListener('click', closeModal);
document.getElementById('cancelBtn').addEventListener('click', closeModal);
overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
form.addEventListener('submit', saveTask);

loadTasks();