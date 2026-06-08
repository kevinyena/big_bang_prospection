// Backend Kanban (Node.js ESM) — état en mémoire
const state = {
  seq: 4,
  tasks: [
    { id: 1, title: 'Définir la roadmap produit', description: 'Lister les fonctionnalités du MVP.', priority: 'high',   status: 'todo'  },
    { id: 2, title: 'Maquette du dashboard',       description: 'Wireframes Figma.',                priority: 'medium', status: 'doing' },
    { id: 3, title: 'Configurer le dépôt Git',     description: 'Init repo + CI de base.',           priority: 'low',    status: 'done'  }
  ]
};

const VALID_STATUS = ['todo', 'doing', 'done'];
const VALID_PRIO   = ['low', 'medium', 'high'];

function sanitize(body = {}, existing = {}) {
  const t = { ...existing };
  if (typeof body.title === 'string') t.title = body.title.trim().slice(0, 120);
  if (typeof body.description === 'string') t.description = body.description.trim().slice(0, 500);
  if (VALID_PRIO.includes(body.priority)) t.priority = body.priority;
  if (VALID_STATUS.includes(body.status)) t.status = body.status;
  return t;
}

export default function handler(req, res) {
  const url = req.url.split('?')[0];
  const method = req.method;

  // GET /tasks
  if (url === '/tasks' && method === 'GET') {
    return res.json({ success: true, data: state.tasks });
  }

  // POST /tasks
  if (url === '/tasks' && method === 'POST') {
    const body = req.body || {};
    if (!body.title || !String(body.title).trim()) {
      return res.status(400).json({ success: false, error: 'Le titre est requis' });
    }
    const task = sanitize(body, {
      id: ++state.seq,
      title: '',
      description: '',
      priority: 'medium',
      status: 'todo'
    });
    state.tasks.push(task);
    return res.json({ success: true, data: task });
  }

  // Routes avec id : /tasks/:id
  const match = url.match(/^\/tasks\/(\d+)$/);
  if (match) {
    const id = Number(match[1]);
    const idx = state.tasks.findIndex(t => t.id === id);
    if (idx === -1) return res.status(404).json({ success: false, error: 'Tâche introuvable' });

    if (method === 'PUT') {
      const updated = sanitize(req.body || {}, state.tasks[idx]);
      state.tasks[idx] = updated;
      return res.json({ success: true, data: updated });
    }
    if (method === 'DELETE') {
      const [removed] = state.tasks.splice(idx, 1);
      return res.json({ success: true, data: removed });
    }
  }

  return res.status(404).json({ success: false, error: 'Route non trouvée' });
}