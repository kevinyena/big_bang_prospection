const ADMIN_PASSWORD = 'icicestparis';

const state = {
  plans: [
    { id: 'gratuit', name: 'Gratuit', monthly: 0, yearly: 0, features: ['Newsletter mensuelle', 'Accès résumés', 'Communauté'], featured: false },
    { id: 'supporter', name: 'Supporter', monthly: 7.99, yearly: 76.7, features: ['Newsletter hebdo', 'Analyses tactiques', 'Infos mercato', 'Accès archives'], featured: true, badge: 'Le + choisi' },
    { id: 'ultra', name: 'Ultra', monthly: 14.99, yearly: 143.9, features: ['Tout Supporter', 'Exclus vestiaire', 'Lives & Q&A', 'Accès anticipé'], featured: false }
  ],
  latestIssue: {
    title: "Le pressing parisien : la mécanique d'Enrique décortiquée",
    excerpt: "Comment le PSG a transformé sa récupération haute en arme létale. Données, heatmaps et témoignages exclusifs.",
    date: '12 juin',
    tag: 'Analyse · Édition #142',
    edition: 142
  },
  subscribers: [
    { email: 'titi.parisien@gmail.com', plan: 'ultra', billing: 'yearly', createdAt: Date.now() - 864e5 * 9 },
    { email: 'kop.virage@outlook.fr', plan: 'supporter', billing: 'monthly', createdAt: Date.now() - 864e5 * 6 },
    { email: 'marquinhos.fan@yahoo.fr', plan: 'supporter', billing: 'yearly', createdAt: Date.now() - 864e5 * 4 },
    { email: 'bleu.rouge@proton.me', plan: 'gratuit', billing: 'monthly', createdAt: Date.now() - 864e5 * 3 },
    { email: 'parc.princes@gmail.com', plan: 'ultra', billing: 'monthly', createdAt: Date.now() - 864e5 * 1 }
  ],
  visits: 18420,
  newsletters: []
};

const json = (res, code, data) => { res.statusCode = code; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(data)); };
const planById = id => state.plans.find(p => p.id === id);

function computeMrr() {
  return state.subscribers.reduce((sum, s) => {
    const p = planById(s.plan);
    if (!p) return sum;
    return sum + (s.billing === 'yearly' ? p.yearly / 12 : p.monthly);
  }, 0);
}

export default function handler(req, res) {
  const url = (req.url || '').replace(/^\/?(api\/)?/, '');
  const path = url.split('?')[0].replace(/\/$/, '');
  const method = (req.method || 'GET').toUpperCase();
  const body = req.body || {};

  if (method === 'GET' && path === 'latest-issue') return json(res, 200, state.latestIssue);

  if (method === 'GET' && path === 'plans') return json(res, 200, state.plans);

  if (method === 'POST' && path === 'subscribe') {
    const email = (body.email || '').trim().toLowerCase();
    const plan = body.plan || 'supporter';
    if (!email || !email.includes('@')) return json(res, 400, { ok: false, error: 'Email invalide' });
    if (!planById(plan)) return json(res, 400, { ok: false, error: 'Plan inconnu' });
    let sub = state.subscribers.find(s => s.email === email);
    if (sub) { sub.plan = plan; }
    else { sub = { email, plan, billing: 'monthly', createdAt: Date.now() }; state.subscribers.push(sub); }
    return json(res, 200, { ok: true, subscriber: sub });
  }

  if (method === 'POST' && path === 'checkout') {
    const email = (body.email || '').trim().toLowerCase();
    const plan = body.plan || 'supporter';
    const billing = body.billing === 'yearly' ? 'yearly' : 'monthly';
    if (!email || !email.includes('@')) return json(res, 400, { ok: false, error: 'Email invalide' });
    const p = planById(plan);
    if (!p) return json(res, 400, { ok: false, error: 'Plan inconnu' });
    let sub = state.subscribers.find(s => s.email === email);
    if (sub) { sub.plan = plan; sub.billing = billing; sub.active = true; }
    else { sub = { email, plan, billing, active: true, createdAt: Date.now() }; state.subscribers.push(sub); }
    const base = billing === 'yearly' ? p.yearly : p.monthly;
    const amount = body.amount ?? base * 1.2;
    return json(res, 200, { ok: true, success: true, transactionId: 'tx_' + Math.random().toString(36).slice(2, 12), amount, plan, billing });
  }

  if (method === 'POST' && path === 'admin/login') {
    if ((body.password || '') === ADMIN_PASSWORD)
      return json(res, 200, { ok: true, success: true, token: 'sess_' + Date.now().toString(36) });
    return json(res, 401, { ok: false, error: 'Mot de passe incorrect' });
  }

  if (method === 'GET' && path === 'admin/stats') {
    const subs = state.subscribers.length;
    const mrr = computeMrr();
    const conversion = state.visits ? +((subs / state.visits) * 100).toFixed(1) : 0;
    return json(res, 200, { subscribers: subs, mrr: +mrr.toFixed(2), conversion, visits: state.visits, newsletters: state.newsletters.length });
  }

  if (method === 'GET' && path === 'admin/subscribers') {
    const list = [...state.subscribers].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
      .map(s => ({ email: s.email, plan: planById(s.plan)?.name || s.plan }));
    return json(res, 200, { subscribers: list });
  }

  if (method === 'POST' && path === 'admin/send-newsletter') {
    const title = (body.title || '').trim();
    const content = (body.content || '').trim();
    if (!title || !content) return json(res, 400, { ok: false, error: 'Titre et contenu requis' });
    state.latestIssue.edition = (state.latestIssue.edition || 142) + 1;
    state.latestIssue.title = title;
    state.latestIssue.excerpt = content.slice(0, 160) + (content.length > 160 ? '…' : '');
    state.latestIssue.tag = 'Newsletter · Édition #' + state.latestIssue.edition;
    state.latestIssue.date = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
    const sent = state.subscribers.length;
    state.newsletters.push({ title, content, sentAt: Date.now(), recipients: sent });
    return json(res, 200, { ok: true, sent });
  }

  return json(res, 404, { ok: false, error: 'Not found' });
}
