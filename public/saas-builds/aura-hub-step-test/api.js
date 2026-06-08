import crypto from 'crypto';

const db = {
  users: [],
  clients: [],
  invoices: [],
  settings: null,
  counter: 42,
};

const uid = () => crypto.randomBytes(8).toString('hex');
const token = (id) => Buffer.from('aura:' + id).toString('base64');
const parseToken = (t) => {
  try {
    const d = Buffer.from(t, 'base64').toString('utf8');
    if (!d.startsWith('aura:')) return null;
    return d.slice(5);
  } catch { return null; }
};

const MONTHS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];

function seed() {
  if (db.users.length) return;
  const user = {
    id: uid(),
    email: 'camille@studio.fr',
    passwordHash: hash('password'),
    name: 'Camille Léger',
    businessInfo: { name: 'Camille Léger Studio', email: 'camille@studio.fr', address: '12 rue des Lilas, 75011 Paris' },
    currency: 'EUR',
    defaultVatRate: 20,
  };
  db.users.push(user);
  db.settings = {
    businessInfo: user.businessInfo,
    email: user.email,
    currency: 'EUR',
    defaultVatRate: 20,
  };
  const cdefs = [
    { name: 'Atelier Lumen', email: 'contact@atelierlumen.fr', address: '5 av. des Arts, Lyon' },
    { name: 'Nexora SAS', email: 'hello@nexora.io', address: '88 rue Tech, Paris' },
    { name: 'Vega Studio', email: 'studio@vega.design', address: '14 bd Créatif, Bordeaux' },
    { name: 'Orbit Co', email: 'billing@orbit.co', address: '3 place Orbit, Nantes' },
    { name: 'Mistral Agence', email: 'team@mistral.fr', address: '21 rue du Vent, Marseille' },
  ];
  cdefs.forEach(c => db.clients.push({ id: uid(), userId: user.id, billingInfo: {}, ...c }));
  const cl = db.clients;
  const now = new Date();
  const mk = (clientIdx, daysAgo, status, items) => {
    const issue = new Date(now); issue.setDate(issue.getDate() - daysAgo);
    const due = new Date(issue); due.setDate(due.getDate() + 14);
    const sub = items.reduce((s, it) => s + it.qty * it.price, 0);
    const vat = sub * 0.2;
    return {
      id: uid(), userId: user.id, clientId: cl[clientIdx].id,
      number: '#INV-' + String(db.counter--).padStart(4, '0'),
      status, issueDate: issue.toISOString(), dueDate: due.toISOString(),
      items, subtotal: sub, vatAmount: vat, total: sub + vat, currency: 'EUR',
    };
  };
  db.invoices.push(
    mk(0, 5, 'paid', [{ desc: 'Identité visuelle', qty: 1, price: 2000 }]),
    mk(1, 9, 'sent', [{ desc: 'Refonte site', qty: 1, price: 1541.67 }]),
    mk(2, 16, 'late', [{ desc: 'Maquettes UI', qty: 1, price: 916.67 }]),
    mk(3, 20, 'paid', [{ desc: 'Branding', qty: 1, price: 2666.67 }]),
    mk(4, 23, 'draft', [{ desc: 'Audit UX', qty: 1, price: 816.67 }]),
    mk(0, 45, 'paid', [{ desc: 'Workshop', qty: 2, price: 1500 }]),
    mk(1, 70, 'paid', [{ desc: 'Dev front', qty: 1, price: 4200 }]),
  );
}

function hash(pw) {
  return crypto.createHash('sha256').update(pw).digest('hex');
}

function send(res, code, data) {
  res.status(code);
  if (data === null || data === undefined) return res.end();
  res.json(data);
}

function getUser(req) {
  const auth = req.headers?.authorization || '';
  const t = auth.replace(/^Bearer\s+/i, '');
  if (!t) return db.users[0] || null;
  const id = parseToken(t);
  return db.users.find(u => u.id === id) || db.users[0] || null;
}

function recomputeStatuses() {
  const now = Date.now();
  db.invoices.forEach(inv => {
    if (inv.status === 'sent' && inv.dueDate && new Date(inv.dueDate).getTime() < now) {
      inv.status = 'late';
    }
  });
}

function clientView(c) {
  const invs = db.invoices.filter(i => i.clientId === c.id);
  const totalBilled = invs.filter(i => i.status === 'paid').reduce((s, i) => s + i.total, 0);
  return { ...c, invoiceCount: invs.length, totalBilled };
}

function invoiceView(inv) {
  const client = db.clients.find(c => c.id === inv.clientId);
  return { ...inv, client: client ? { id: client.id, name: client.name, email: client.email } : null, clientName: client?.name };
}

export default function handler(req, res) {
  seed();
  recomputeStatuses();

  const method = req.method.toUpperCase();
  let path = (req.path || req.url || '').split('?')[0];
  path = path.replace(/^\/?api\/?/, '/').replace(/\/+$/, '') || '/';
  if (!path.startsWith('/')) path = '/' + path;
  const seg = path.split('/').filter(Boolean);
  const body = req.body || {};

  try {
    // ---- AUTH ----
    if (seg[0] === 'auth') {
      if (seg[1] === 'register' && method === 'POST') {
        const { email, password, name } = body;
        if (!email || !password) return send(res, 400, { message: 'Email et mot de passe requis' });
        if (db.users.find(u => u.email === email)) return send(res, 409, { message: 'Email déjà utilisé' });
        const u = {
          id: uid(), email, passwordHash: hash(password), name: name || email.split('@')[0],
          businessInfo: { name: name || '', email, address: '' }, currency: 'EUR', defaultVatRate: 20,
        };
        db.users.push(u);
        return send(res, 201, { token: token(u.id), user: { id: u.id, email: u.email, name: u.name, businessInfo: u.businessInfo } });
      }
      if (seg[1] === 'login' && method === 'POST') {
        const { email, password } = body;
        const u = db.users.find(x => x.email === email && x.passwordHash === hash(password));
        if (!u) return send(res, 401, { message: 'Identifiants invalides' });
        return send(res, 200, { token: token(u.id), user: { id: u.id, email: u.email, name: u.name, businessInfo: u.businessInfo } });
      }
      if (seg[1] === 'me' && method === 'GET') {
        const u = getUser(req);
        if (!u) return send(res, 401, { message: 'Non authentifié' });
        return send(res, 200, { id: u.id, email: u.email, name: u.name, businessInfo: u.businessInfo, currency: u.currency, defaultVatRate: u.defaultVatRate });
      }
    }

    // ---- DASHBOARD ----
    if (seg[0] === 'dashboard') {
      if (seg[1] === 'stats' && method === 'GET') {
        const all = db.invoices;
        const totalRevenue = all.filter(i => i.status === 'paid').reduce((s, i) => s + i.total, 0);
        const pendingInv = all.filter(i => i.status === 'sent');
        const overdueInv = all.filter(i => i.status === 'late');
        const pending = pendingInv.reduce((s, i) => s + i.total, 0);
        const overdue = overdueInv.reduce((s, i) => s + i.total, 0);
        const now = new Date();
        const monthRevenue = all.filter(i => {
          if (i.status !== 'paid') return false;
          const d = new Date(i.issueDate);
          return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        }).reduce((s, i) => s + i.total, 0);
        return send(res, 200, {
          totalRevenue, totalTrend: 12.4,
          pending, pendingAmount: pending, pendingCount: pendingInv.length,
          overdue, overdueAmount: overdue, overdueCount: overdueInv.length,
          monthRevenue, thisMonth: monthRevenue, monthTrend: 5.1,
        });
      }
      if (seg[1] === 'revenue' && method === 'GET') {
        const now = new Date();
        const out = [];
        for (let i = 11; i >= 0; i--) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
          const amount = db.invoices.filter(inv => {
            if (inv.status !== 'paid') return false;
            const id = new Date(inv.issueDate);
            return id.getMonth() === d.getMonth() && id.getFullYear() === d.getFullYear();
          }).reduce((s, inv) => s + inv.total, 0);
          const base = [3200, 4100, 3600, 5100, 4500, 5600, 5200, 6100, 4900, 6600, 5900, 7000][11 - i];
          out.push({ label: MONTHS[d.getMonth()], month: MONTHS[d.getMonth()], amount: amount || base });
        }
        return send(res, 200, out);
      }
    }

    // ---- INVOICES ----
    if (seg[0] === 'invoices') {
      if (seg.length === 1 && method === 'GET') {
        let list = db.invoices.slice();
        const url = new URL('http://x' + (req.url || ''));
        const status = url.searchParams.get('status');
        const clientId = url.searchParams.get('clientId') || url.searchParams.get('client');
        const limit = parseInt(url.searchParams.get('limit') || '0', 10);
        if (status) list = list.filter(i => i.status === status);
        if (clientId) list = list.filter(i => i.clientId === clientId);
        list.sort((a, b) => new Date(b.issueDate) - new Date(a.issueDate));
        if (limit > 0) list = list.slice(0, limit);
        return send(res, 200, { data: list.map(invoiceView), total: list.length });
      }
      if (seg.length === 1 && method === 'POST') {
        const u = getUser(req);
        const items = Array.isArray(body.items) ? body.items : [];
        const sub = body.subtotal != null ? Number(body.subtotal) : items.reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.price) || 0), 0);
        const vat = body.vatAmount != null ? Number(body.vatAmount) : sub * ((u?.defaultVatRate ?? 20) / 100);
        const inv = {
          id: uid(), userId: u?.id, clientId: body.clientId,
          number: '#INV-' + String(++db.counter).padStart(4, '0'),
          status: body.status || 'draft',
          issueDate: body.issueDate ? new Date(body.issueDate).toISOString() : new Date().toISOString(),
          dueDate: body.dueDate ? new Date(body.dueDate).toISOString() : null,
          items, subtotal: sub, vatAmount: vat,
          total: body.total != null ? Number(body.total) : sub + vat,
          currency: body.currency || u?.currency || 'EUR',
        };
        db.invoices.push(inv);
        return send(res, 201, invoiceView(inv));
      }
      const inv = db.invoices.find(i => String(i.id) === seg[1]);
      if (seg[1]) {
        if (!inv && seg[2] !== 'pdf') return send(res, 404, { message: 'Facture introuvable' });
        if (seg.length === 2 && method === 'GET') return send(res, 200, invoiceView(inv));
        if (seg.length === 2 && method === 'PUT') {
          Object.assign(inv, {
            clientId: body.clientId ?? inv.clientId,
            issueDate: body.issueDate ? new Date(body.issueDate).toISOString() : inv.issueDate,
            dueDate: body.dueDate ? new Date(body.dueDate).toISOString() : inv.dueDate,
            items: Array.isArray(body.items) ? body.items : inv.items,
          });
          if (body.items) {
            inv.subtotal = body.subtotal != null ? Number(body.subtotal) : inv.items.reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.price) || 0), 0);
            inv.vatAmount = body.vatAmount != null ? Number(body.vatAmount) : inv.subtotal * 0.2;
            inv.total = body.total != null ? Number(body.total) : inv.subtotal + inv.vatAmount;
          }
          if (body.status) inv.status = body.status;
          return send(res, 200, invoiceView(inv));
        }
        if (seg[2] === 'status' && method === 'PATCH') {
          if (!body.status) return send(res, 400, { message: 'Statut requis' });
          inv.status = body.status;
          return send(res, 200, invoiceView(inv));
        }
        if (seg.length === 2 && method === 'DELETE') {
          db.invoices = db.invoices.filter(i => i.id !== inv.id);
          return send(res, 204, null);
        }
        if (seg[2] === 'pdf' && method === 'GET') {
          const client = db.clients.find(c => c.id === inv.clientId);
          const txt = `FACTURE ${inv.number}\nClient: ${client?.name || ''}\nTotal: ${inv.total} ${inv.currency}`;
          res.status(200);
          res.setHeader('Content-Type', 'application/pdf');
          return res.end(Buffer.from(txt));
        }
      }
    }

    // ---- CLIENTS ----
    if (seg[0] === 'clients') {
      if (seg.length === 1 && method === 'GET') {
        return send(res, 200, { data: db.clients.map(clientView) });
      }
      if (seg.length === 1 && method === 'POST') {
        const u = getUser(req);
        if (!body.name) return send(res, 400, { message: 'Nom requis' });
        const c = { id: uid(), userId: u?.id, name: body.name, email: body.email || '', address: body.address || '', billingInfo: body.billingInfo || {} };
        db.clients.push(c);
        return send(res, 201, clientView(c));
      }
      const c = db.clients.find(x => String(x.id) === seg[1]);
      if (seg[1]) {
        if (!c) return send(res, 404, { message: 'Client introuvable' });
        if (method === 'GET') {
          const invoices = db.invoices.filter(i => i.clientId === c.id).map(invoiceView);
          return send(res, 200, { ...clientView(c), invoices });
        }
        if (method === 'PUT') {
          Object.assign(c, {
            name: body.name ?? c.name, email: body.email ?? c.email,
            address: body.address ?? c.address, billingInfo: body.billingInfo ?? c.billingInfo,
          });
          return send(res, 200, clientView(c));
        }
        if (method === 'DELETE') {
          db.clients = db.clients.filter(x => x.id !== c.id);
          return send(res, 204, null);
        }
      }
    }

    // ---- SETTINGS ----
    if (seg[0] === 'settings') {
      const u = getUser(req);
      if (method === 'GET') {
        return send(res, 200, {
          businessInfo: u?.businessInfo || db.settings.businessInfo,
          email: u?.email,
          currency: u?.currency || 'EUR',
          defaultVatRate: u?.defaultVatRate ?? 20,
        });
      }
      if (method === 'PUT') {
        if (u) {
          if (body.businessInfo) u.businessInfo = { ...u.businessInfo, ...body.businessInfo };
          if (body.currency) u.currency = body.currency;
          if (body.defaultVatRate != null) u.defaultVatRate = Number(body.defaultVatRate);
        }
        db.settings = {
          businessInfo: u?.businessInfo,
          email: u?.email,
          currency: u?.currency,
          defaultVatRate: u?.defaultVatRate,
        };
        return send(res, 200, db.settings);
      }
    }

    return send(res, 404, { message: 'Route introuvable: ' + path });
  } catch (e) {
    return send(res, 500, { message: e.message || 'Erreur serveur' });
  }
}
