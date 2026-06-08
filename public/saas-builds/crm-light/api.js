import crypto from 'crypto';

const db = { users: [], contacts: [], deals: [], tasks: [], activities: [], sessions: {} };
let seq = 1;
const uid = () => String(seq++) + crypto.randomBytes(3).toString('hex');

function seed() {
  const u = { id: uid(), name: 'Julie Renard', email: 'julie.renard@gmail.com', password: hash('demo1234'), plan: 'Pro', activity: 'Freelance UX/UI Designer', phone: '+33 6 12 34 56 78', avatar: 'https://i.pravatar.cc/72?img=12' };
  db.users.push(u);
  const seedContacts = [
    { name: 'Studio Nova', company: 'Studio Nova SARL', email: 'contact@studionova.fr', phone: '', source: 'Site web', estimatedValue: 4500, status: 'Nouveau' },
    { name: 'Acme Corp', company: 'Acme Corporation', email: 'hello@acme.com', phone: '', source: 'LinkedIn', estimatedValue: 9800, status: 'Proposition' },
    { name: 'Pixel Lab', company: 'Pixel Lab Studio', email: 'team@pixellab.io', phone: '', source: 'Recommandation', estimatedValue: 6300, status: 'Gagné' },
    { name: 'Marc Dubois', company: 'Dubois Conseil', email: 'marc@dubois-conseil.fr', phone: '', source: 'Email', estimatedValue: 3400, status: 'Contacté' },
    { name: 'Léa Martin', company: 'Indépendante', email: 'lea.martin@gmail.com', phone: '', source: 'Site web', estimatedValue: 1200, status: 'Nouveau' },
    { name: 'Brando', company: 'Brando Agency', email: 'hi@brando.co', phone: '', source: 'LinkedIn', estimatedValue: 7200, status: 'Négociation' },
    { name: 'Cloud9', company: 'Cloud9 Inc', email: 'info@cloud9.com', phone: '', source: 'LinkedIn', estimatedValue: 2100, status: 'Perdu' }
  ];
  for (const c of seedContacts) {
    const ct = { id: uid(), userId: u.id, tags: [], ...c };
    db.contacts.push(ct);
    db.deals.push({ id: uid(), userId: u.id, contactId: ct.id, stage: c.status, value: c.estimatedValue, expectedCloseDate: null });
  }
  const day = o => { const d = new Date(); d.setDate(d.getDate() + o); return d.toISOString().slice(0, 10); };
  const find = n => db.contacts.find(c => c.name === n);
  const seedTasks = [
    { title: 'Relancer Acme Corp sur la proposition', due: -2, contact: 'Acme Corp', completed: false },
    { title: 'Confirmer RDV Cloud9', due: -5, contact: 'Cloud9', completed: false },
    { title: 'Envoyer facture Pixel Lab', due: -1, contact: 'Pixel Lab', completed: false },
    { title: 'Envoyer proposition à Studio Nova', due: 0, contact: 'Studio Nova', completed: false },
    { title: 'Appel découverte Léa Martin', due: 1, contact: 'Léa Martin', completed: false },
    { title: 'Suivi devis Marc Dubois', due: 3, contact: 'Marc Dubois', completed: false },
    { title: 'Relance Brando négociation', due: 4, contact: 'Brando', completed: false },
    { title: 'Email de remerciement Pixel Lab', due: -3, contact: 'Pixel Lab', completed: true }
  ];
  for (const t of seedTasks) {
    const c = find(t.contact);
    db.tasks.push({ id: uid(), userId: u.id, contactId: c ? c.id : null, title: t.title, dueDate: day(t.due), completed: t.completed });
  }
}

function hash(p) { return crypto.createHash('sha256').update(String(p)).digest('hex'); }
function makeToken(userId) { const t = crypto.randomBytes(24).toString('hex'); db.sessions[t] = userId; return t; }
function userFromReq(req) {
  const h = req.headers['authorization'] || req.headers['Authorization'] || '';
  const tok = h.replace(/^Bearer\s+/i, '').trim();
  if (!tok || !db.sessions[tok]) return null;
  return db.users.find(u => u.id === db.sessions[tok]) || null;
}
function publicUser(u) { if (!u) return null; const { password, ...rest } = u; return rest; }

seed();

function send(res, code, body) {
  res.status(code);
  if (body === undefined || body === null) return res.end();
  res.json(body);
}

export default function handler(req, res) {
  const method = req.method.toUpperCase();
  const rawUrl = req.url || '';
  const path = rawUrl.replace(/^\/+/, '').replace(/^api\/?/, '').split('?')[0].replace(/\/+$/, '');
  const q = (rawUrl.split('?')[1] || '');
  const query = Object.fromEntries(new URLSearchParams(q));
  const parts = path.split('/').filter(Boolean);
  const body = req.body || {};

  try {
    // ---- AUTH ----
    if (parts[0] === 'auth') {
      if (parts[1] === 'register' && method === 'POST') {
        const { name, email, password } = body;
        if (!email || !password) return send(res, 400, { message: 'Email et mot de passe requis' });
        if (db.users.find(u => u.email.toLowerCase() === String(email).toLowerCase()))
          return send(res, 409, { message: 'Cet email est déjà utilisé' });
        const u = { id: uid(), name: name || 'Utilisateur', email, password: hash(password), plan: 'Free', activity: '', phone: '', avatar: '' };
        db.users.push(u);
        return send(res, 201, { token: makeToken(u.id), user: publicUser(u) });
      }
      if (parts[1] === 'login' && method === 'POST') {
        const { email, password } = body;
        const u = db.users.find(x => x.email.toLowerCase() === String(email || '').toLowerCase());
        if (!u || u.password !== hash(password || '')) return send(res, 401, { message: 'Identifiants invalides' });
        return send(res, 200, { token: makeToken(u.id), user: publicUser(u) });
      }
      if (parts[1] === 'me' && method === 'GET') {
        const u = userFromReq(req);
        if (!u) return send(res, 401, { message: 'Non authentifié' });
        return send(res, 200, { user: publicUser(u) });
      }
      if (parts[1] === 'me' && method === 'PUT') {
        const u = userFromReq(req);
        if (!u) return send(res, 401, { message: 'Non authentifié' });
        ['name', 'email', 'activity', 'phone', 'avatar'].forEach(k => { if (body[k] !== undefined) u[k] = body[k]; });
        return send(res, 200, { user: publicUser(u) });
      }
      return send(res, 404, { message: 'Route auth introuvable' });
    }

    const user = userFromReq(req);
    if (!user) return send(res, 401, { message: 'Non authentifié' });
    const mine = arr => arr.filter(x => x.userId === user.id);

    // ---- DASHBOARD ----
    if (parts[0] === 'dashboard' && parts[1] === 'stats' && method === 'GET') {
      const contacts = mine(db.contacts);
      const deals = mine(db.deals);
      const tasks = mine(db.tasks);
      const norm = s => s === 'Proposition envoyée' ? 'Proposition' : s;
      const won = deals.filter(d => norm(d.stage) === 'Gagné').length;
      const lost = deals.filter(d => norm(d.stage) === 'Perdu').length;
      const closed = won + lost;
      const active = contacts.filter(c => !['Gagné', 'Perdu'].includes(norm(c.status)));
      const pipelineValue = deals.filter(d => !['Gagné', 'Perdu'].includes(norm(d.stage))).reduce((a, d) => a + (+d.value || 0), 0);
      const today = new Date(new Date().toDateString());
      const overdue = tasks.filter(t => !t.completed && t.dueDate && new Date(t.dueDate) < today).length;
      const months = [];
      const now = new Date();
      const labels = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        months.push({ label: labels[d.getMonth()], count: 0 });
      }
      const base = Math.max(active.length, 1);
      months.forEach((m, i) => { m.count = Math.round(base * (0.4 + i * 0.12)); });
      months[months.length - 1].count = Math.max(active.length, months[months.length - 1].count);
      return send(res, 200, {
        activeProspects: active.length,
        conversionRate: closed ? Math.round((won / closed) * 100) : 0,
        pipelineValue,
        overdueTasks: overdue,
        monthly: months
      });
    }

    // ---- CONTACTS ----
    if (parts[0] === 'contacts') {
      if (parts.length === 1 && method === 'GET') {
        let list = mine(db.contacts);
        if (query.status) list = list.filter(c => c.status === query.status);
        if (query.q) { const s = query.q.toLowerCase(); list = list.filter(c => (c.name + c.company + c.email).toLowerCase().includes(s)); }
        return send(res, 200, list);
      }
      if (parts.length === 1 && method === 'POST') {
        const c = {
          id: uid(), userId: user.id,
          name: body.name || 'Sans nom', company: body.company || '', email: body.email || '',
          phone: body.phone || '', source: body.source || 'Site web',
          estimatedValue: Number(body.estimatedValue) || 0, status: body.status || 'Nouveau',
          tags: Array.isArray(body.tags) ? body.tags : []
        };
        db.contacts.push(c);
        return send(res, 201, c);
      }
      const id = parts[1];
      const c = db.contacts.find(x => x.id === id && x.userId === user.id);
      // activities sub-resource
      if (parts[2] === 'activities') {
        if (!c) return send(res, 404, { message: 'Contact introuvable' });
        if (method === 'GET') {
          return send(res, 200, db.activities.filter(a => a.contactId === id).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
        }
        if (method === 'POST') {
          const a = { id: uid(), contactId: id, type: body.type || 'note', content: body.content || '', createdAt: new Date().toISOString() };
          db.activities.push(a);
          return send(res, 201, a);
        }
      }
      if (!c) return send(res, 404, { message: 'Contact introuvable' });
      if (method === 'GET') return send(res, 200, c);
      if (method === 'PUT') {
        ['name', 'company', 'email', 'phone', 'source', 'status'].forEach(k => { if (body[k] !== undefined) c[k] = body[k]; });
        if (body.estimatedValue !== undefined) c.estimatedValue = Number(body.estimatedValue) || 0;
        if (body.tags !== undefined) c.tags = Array.isArray(body.tags) ? body.tags : c.tags;
        const d = db.deals.find(d => d.contactId === c.id);
        if (d && body.status !== undefined) d.stage = body.status;
        return send(res, 200, c);
      }
      if (method === 'DELETE') {
        db.contacts = db.contacts.filter(x => x.id !== id);
        db.deals = db.deals.filter(d => d.contactId !== id);
        db.tasks = db.tasks.filter(t => t.contactId !== id);
        db.activities = db.activities.filter(a => a.contactId !== id);
        return send(res, 204);
      }
    }

    // ---- DEALS ----
    if (parts[0] === 'deals') {
      if (parts.length === 1 && method === 'GET') return send(res, 200, mine(db.deals));
      if (parts.length === 1 && method === 'POST') {
        const c = db.contacts.find(x => x.id === body.contactId && x.userId === user.id);
        const d = {
          id: uid(), userId: user.id,
          contactId: body.contactId || (c && c.id) || null,
          stage: body.stage || 'Nouveau',
          value: Number(body.value) || (c ? c.estimatedValue : 0),
          expectedCloseDate: body.expectedCloseDate || null,
          name: body.name, company: body.company, tag: body.tag
        };
        db.deals.push(d);
        return send(res, 201, d);
      }
      const id = parts[1];
      const d = db.deals.find(x => x.id === id && x.userId === user.id);
      if (!d) return send(res, 404, { message: 'Deal introuvable' });
      if (parts[2] === 'stage' && method === 'PUT') {
        d.stage = body.stage || d.stage;
        const c = db.contacts.find(c => c.id === d.contactId);
        if (c) c.status = d.stage;
        return send(res, 200, d);
      }
      if (method === 'PUT') {
        if (body.stage !== undefined) d.stage = body.stage;
        if (body.value !== undefined) d.value = Number(body.value) || 0;
        if (body.expectedCloseDate !== undefined) d.expectedCloseDate = body.expectedCloseDate;
        return send(res, 200, d);
      }
      if (method === 'DELETE') { db.deals = db.deals.filter(x => x.id !== id); return send(res, 204); }
    }

    // ---- TASKS ----
    if (parts[0] === 'tasks') {
      if (parts.length === 1 && method === 'GET') {
        let list = mine(db.tasks);
        const today = new Date(new Date().toDateString());
        if (query.filter === 'overdue') list = list.filter(t => !t.completed && t.dueDate && new Date(t.dueDate) < today);
        else if (query.filter === 'upcoming') list = list.filter(t => !t.completed && (!t.dueDate || new Date(t.dueDate) >= today));
        return send(res, 200, list);
      }
      if (parts.length === 1 && method === 'POST') {
        const t = {
          id: uid(), userId: user.id,
          contactId: body.contactId || null,
          title: body.title || 'Relance',
          dueDate: body.dueDate || null,
          completed: !!body.completed
        };
        db.tasks.push(t);
        return send(res, 201, t);
      }
      const id = parts[1];
      const t = db.tasks.find(x => x.id === id && x.userId === user.id);
      if (!t) return send(res, 404, { message: 'Tâche introuvable' });
      if (method === 'PUT') {
        if (body.title !== undefined) t.title = body.title;
        if (body.dueDate !== undefined) t.dueDate = body.dueDate;
        if (body.completed !== undefined) t.completed = !!body.completed;
        if (body.contactId !== undefined) t.contactId = body.contactId || null;
        return send(res, 200, t);
      }
      if (method === 'DELETE') { db.tasks = db.tasks.filter(x => x.id !== id); return send(res, 204); }
    }

    return send(res, 404, { message: 'Route introuvable' });
  } catch (err) {
    return send(res, 500, { message: err.message || 'Erreur serveur' });
  }
}
