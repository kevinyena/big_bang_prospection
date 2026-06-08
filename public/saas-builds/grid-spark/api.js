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

const CAT_NAMES = new Set(CATEGORIES.map(c => c.name));

const state = {
  transactions: [],
  settings: { currency: 'EUR', theme: 'dark' }
};

const uid = () => (globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : 'id-' + Date.now() + '-' + Math.random().toString(16).slice(2));

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

function filterByMonth(month) {
  return month ? state.transactions.filter(t => t.date && t.date.startsWith(month)) : state.transactions.slice();
}

function sortByDateDesc(arr) {
  return arr.sort((a, b) => b.date.localeCompare(a.date));
}

function computeStats(month) {
  const tx = filterByMonth(month);
  const income = round2(tx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0));
  const expense = round2(tx.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0));
  const balance = round2(income - expense);
  const savings = income > 0 ? round2((balance / income) * 100) : 0;
  return { income, expense, balance, savings };
}

function validateTransaction(d) {
  const errors = [];
  const amount = parseFloat(d?.amount);
  if (!Number.isFinite(amount) || amount <= 0) errors.push('Montant positif requis');
  if (!d?.category || !CAT_NAMES.has(d.category)) errors.push('Catégorie obligatoire et valide');
  if (d?.type !== 'income' && d?.type !== 'expense') errors.push('Type invalide');
  if (!d?.date || Number.isNaN(Date.parse(d.date))) errors.push('Date valide requise');
  return errors;
}

function normalizeTransaction(d) {
  return {
    type: d.type,
    amount: round2(parseFloat(d.amount)),
    category: d.category,
    description: typeof d.description === 'string' ? d.description.trim() : '',
    date: String(d.date).slice(0, 10)
  };
}

function send(res, status, payload) {
  res.status(status).json(payload);
}

export default function handler(req, res) {
  const method = (req.method || 'GET').toUpperCase();
  let pathname = '';
  try {
    pathname = new URL(req.url, 'http://localhost').pathname;
  } catch {
    pathname = (req.url || '').split('?')[0];
  }
  const query = req.query || {};
  const month = typeof query.month === 'string' ? query.month : undefined;

  const parts = pathname.replace(/^\/+|\/+$/g, '').split('/').filter(Boolean);
  const apiIdx = parts.indexOf('api');
  const seg = apiIdx >= 0 ? parts.slice(apiIdx + 1) : parts;
  const resource = seg[0] || '';
  const id = seg[1] || null;

  try {
    if (resource === 'categories' && method === 'GET') {
      return send(res, 200, { categories: CATEGORIES });
    }

    if (resource === 'stats' && method === 'GET') {
      return send(res, 200, computeStats(month));
    }

    if (resource === 'transactions') {
      if (method === 'GET') {
        const tx = sortByDateDesc(filterByMonth(month));
        return send(res, 200, { transactions: tx });
      }

      if (method === 'POST') {
        const body = req.body || {};
        const errors = validateTransaction(body);
        if (errors.length) return send(res, 400, { error: errors[0], errors });
        const tx = { id: uid(), ...normalizeTransaction(body) };
        state.transactions.push(tx);
        return send(res, 201, { transaction: tx });
      }

      if (method === 'PUT') {
        if (!id) return send(res, 400, { error: 'Identifiant requis' });
        const i = state.transactions.findIndex(t => t.id === id);
        if (i === -1) return send(res, 404, { error: 'Transaction introuvable' });
        const body = req.body || {};
        const errors = validateTransaction(body);
        if (errors.length) return send(res, 400, { error: errors[0], errors });
        state.transactions[i] = { ...state.transactions[i], ...normalizeTransaction(body) };
        return send(res, 200, { transaction: state.transactions[i] });
      }

      if (method === 'DELETE') {
        if (!id) return send(res, 400, { error: 'Identifiant requis' });
        const before = state.transactions.length;
        state.transactions = state.transactions.filter(t => t.id !== id);
        if (state.transactions.length === before) return send(res, 404, { error: 'Transaction introuvable' });
        return send(res, 200, { success: true, id });
      }

      return send(res, 405, { error: 'Méthode non autorisée' });
    }

    return send(res, 404, { error: 'Ressource introuvable' });
  } catch (err) {
    return send(res, 500, { error: 'Erreur serveur', detail: String(err?.message || err) });
  }
}
