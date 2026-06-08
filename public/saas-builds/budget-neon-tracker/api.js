let categories = [
  { id: 1, name: 'Alimentation', color: '#00F0FF', icon: 'fa-bowl-food' },
  { id: 2, name: 'Loyer', color: '#FF2E97', icon: 'fa-house' },
  { id: 3, name: 'Loisirs', color: '#39FF14', icon: 'fa-gamepad' },
  { id: 4, name: 'Transport', color: '#FFB627', icon: 'fa-car' },
  { id: 5, name: 'Shopping', color: '#9B5CFF', icon: 'fa-cart-shopping' },
  { id: 6, name: 'Salaire', color: '#22D3EE', icon: 'fa-briefcase' },
];

let transactions = [];
let budgets = [
  { id: 1, category: 1, limit: 500 },
  { id: 2, category: 2, limit: 850 },
  { id: 3, category: 3, limit: 150 },
  { id: 4, category: 4, limit: 300 },
];
let settings = { currency: 'EUR', theme: 'dark', notifications: true, name: 'Alex Moreau', email: 'alex@neon.io' };

let txSeq = 1, catSeq = 7, budSeq = 5;

const NEON = ['#00F0FF', '#FF2E97', '#39FF14', '#FFB627', '#FF4D5E', '#9B5CFF', '#FF7A1A', '#22D3EE'];

(function seed() {
  const notes = ['Courses', 'Restaurant', 'Essence', 'Cinéma', 'Abonnement', 'Café', 'Pharmacie', 'Train', 'Supermarché', 'Métro'];
  const now = new Date();
  for (let i = 0; i < 60; i++) {
    const inc = Math.random() < 0.16;
    const d = new Date(now);
    d.setDate(d.getDate() - Math.floor(Math.random() * 75));
    const cat = inc ? 6 : 1 + Math.floor(Math.random() * 5);
    transactions.push({
      id: txSeq++,
      type: inc ? 'income' : 'expense',
      category: cat,
      amount: inc ? 1600 : +(8 + Math.random() * 140).toFixed(2),
      date: d.toISOString(),
      note: inc ? 'Salaire' : notes[Math.floor(Math.random() * notes.length)],
    });
  }
  for (let m = 1; m <= 2; m++) {
    const d = new Date(now.getFullYear(), now.getMonth(), 1);
    transactions.push({ id: txSeq++, type: 'income', category: 6, amount: 3200, date: d.toISOString(), note: 'Salaire' });
  }
})();

const json = (res, data, code = 200) => { res.statusCode = code; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(data)); };
const noContent = (res) => { res.statusCode = 204; res.end(); };
const sameMonth = (d, ref) => { const x = new Date(d); return x.getFullYear() === ref.getFullYear() && x.getMonth() === ref.getMonth(); };
const catName = (id) => categories.find(c => c.id == id)?.name || 'Autre';
const catColor = (id) => categories.find(c => c.id == id)?.color || '#00F0FF';

function spentForCategory(catId, ref = new Date()) {
  return transactions
    .filter(t => t.type === 'expense' && t.category == catId && sameMonth(t.date, ref))
    .reduce((s, t) => s + Math.abs(t.amount), 0);
}

function monthExpenses(ref) {
  return transactions.filter(t => t.type === 'expense' && sameMonth(t.date, ref)).reduce((s, t) => s + Math.abs(t.amount), 0);
}
function monthIncome(ref) {
  return transactions.filter(t => t.type === 'income' && sameMonth(t.date, ref)).reduce((s, t) => s + Math.abs(t.amount), 0);
}

export default function handler(req, res) {
  const method = req.method.toUpperCase();
  const url = new URL(req.url, 'http://localhost');
  let path = url.pathname.replace(/^\/?(api\/)?/, '').replace(/\/$/, '');
  const seg = path.split('/');
  const q = url.searchParams;
  const body = req.body || {};

  try {
    // TRANSACTIONS
    if (seg[0] === 'transactions') {
      if (!seg[1]) {
        if (method === 'GET') {
          let list = [...transactions];
          const type = q.get('type'), cat = q.get('category'), period = q.get('period');
          if (type && type !== 'all') list = list.filter(t => t.type === type);
          if (cat && cat !== 'all') list = list.filter(t => t.category == cat);
          if (period === 'month') list = list.filter(t => sameMonth(t.date, new Date()));
          list.sort((a, b) => new Date(b.date) - new Date(a.date));
          return json(res, list);
        }
        if (method === 'POST') {
          const tx = {
            id: txSeq++,
            type: body.type === 'income' ? 'income' : 'expense',
            category: body.category,
            amount: Math.abs(+body.amount) || 0,
            date: body.date ? new Date(body.date).toISOString() : new Date().toISOString(),
            note: body.note || '',
          };
          transactions.push(tx);
          return json(res, tx, 201);
        }
      } else {
        const id = seg[1];
        const tx = transactions.find(t => t.id == id);
        if (!tx) return json(res, { error: 'not found' }, 404);
        if (method === 'PUT') {
          if (body.type) tx.type = body.type === 'income' ? 'income' : 'expense';
          if (body.category != null) tx.category = body.category;
          if (body.amount != null) tx.amount = Math.abs(+body.amount) || 0;
          if (body.date) tx.date = new Date(body.date).toISOString();
          if (body.note != null) tx.note = body.note;
          return json(res, tx);
        }
        if (method === 'DELETE') {
          transactions = transactions.filter(t => t.id != id);
          return noContent(res);
        }
      }
    }

    // CATEGORIES
    if (seg[0] === 'categories') {
      if (!seg[1]) {
        if (method === 'GET') {
          const out = categories.map(c => ({ ...c, count: transactions.filter(t => t.category == c.id).length }));
          return json(res, out);
        }
        if (method === 'POST') {
          const c = {
            id: catSeq++,
            name: body.name || 'Catégorie',
            color: body.color || NEON[(catSeq) % NEON.length],
            icon: body.icon || 'fa-tag',
          };
          categories.push(c);
          return json(res, { ...c, count: 0 }, 201);
        }
      } else {
        const id = seg[1];
        const c = categories.find(x => x.id == id);
        if (!c) return json(res, { error: 'not found' }, 404);
        if (method === 'PUT') {
          if (body.name != null) c.name = body.name;
          if (body.color != null) c.color = body.color;
          if (body.icon != null) c.icon = body.icon;
          return json(res, { ...c, count: transactions.filter(t => t.category == c.id).length });
        }
        if (method === 'DELETE') {
          categories = categories.filter(x => x.id != id);
          budgets = budgets.filter(b => b.category != id);
          return noContent(res);
        }
      }
    }

    // BUDGETS
    if (seg[0] === 'budgets') {
      if (!seg[1]) {
        if (method === 'GET') {
          const out = budgets.map(b => ({
            id: b.id,
            category: b.category,
            name: catName(b.category),
            color: catColor(b.category),
            limit: b.limit,
            spent: +spentForCategory(b.category).toFixed(2),
          }));
          return json(res, out);
        }
        if (method === 'POST') {
          const existing = budgets.find(b => b.category == body.category);
          if (existing) {
            existing.limit = +body.limit || 0;
            return json(res, { ...existing, name: catName(existing.category), color: catColor(existing.category), spent: +spentForCategory(existing.category).toFixed(2) }, 200);
          }
          const b = { id: budSeq++, category: body.category, limit: +body.limit || 0 };
          budgets.push(b);
          return json(res, { ...b, name: catName(b.category), color: catColor(b.category), spent: +spentForCategory(b.category).toFixed(2) }, 201);
        }
      } else {
        const id = seg[1];
        const b = budgets.find(x => x.id == id);
        if (!b) return json(res, { error: 'not found' }, 404);
        if (method === 'PUT') {
          if (body.category != null) b.category = body.category;
          if (body.limit != null) b.limit = +body.limit || 0;
          return json(res, { ...b, name: catName(b.category), color: catColor(b.category), spent: +spentForCategory(b.category).toFixed(2) });
        }
      }
    }

    // STATS
    if (seg[0] === 'stats') {
      const now = new Date();
      const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);

      if (seg[1] === 'overview' && method === 'GET') {
        const balance = transactions.reduce((s, t) => s + (t.type === 'income' ? Math.abs(t.amount) : -Math.abs(t.amount)), 0);
        const income = monthIncome(now), expenses = monthExpenses(now);
        const pIncome = monthIncome(prev), pExpenses = monthExpenses(prev);
        const trend = (cur, p) => p ? +((cur - p) / p * 100).toFixed(1) : 0;
        return json(res, {
          balance: +balance.toFixed(2),
          income: +income.toFixed(2),
          expenses: +expenses.toFixed(2),
          balanceTrend: trend(income - expenses, pIncome - pExpenses),
          incomeTrend: trend(income, pIncome),
          expenseTrend: trend(expenses, pExpenses),
        });
      }

      if (seg[1] === 'trend' && method === 'GET') {
        const range = +q.get('range') || 30;
        const out = [];
        if (range === 365) {
          for (let i = 11; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
            const bal = transactions.filter(t => new Date(t.date) < end).reduce((s, t) => s + (t.type === 'income' ? Math.abs(t.amount) : -Math.abs(t.amount)), 0);
            out.push({ label: d.toLocaleDateString('fr-FR', { month: 'short' }), value: +bal.toFixed(2) });
          }
        } else {
          const pts = range === 90 ? 13 : 15;
          const step = range / pts;
          for (let i = pts; i >= 0; i--) {
            const d = new Date(now); d.setDate(d.getDate() - Math.round(i * step));
            const bal = transactions.filter(t => new Date(t.date) <= d).reduce((s, t) => s + (t.type === 'income' ? Math.abs(t.amount) : -Math.abs(t.amount)), 0);
            out.push({ label: d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }), value: +bal.toFixed(2) });
          }
        }
        return json(res, out);
      }

      if (seg[1] === 'by-category' && method === 'GET') {
        const period = q.get('period') || 'month';
        const ref = period === 'month' ? now : null;
        const map = {};
        transactions.filter(t => t.type === 'expense' && (!ref || sameMonth(t.date, ref))).forEach(t => {
          map[t.category] = (map[t.category] || 0) + Math.abs(t.amount);
        });
        const out = Object.keys(map).map(cid => ({
          name: catName(cid),
          value: +map[cid].toFixed(2),
          color: catColor(cid),
        })).sort((a, b) => b.value - a.value);
        return json(res, out);
      }

      if (seg[1] === 'comparison' && method === 'GET') {
        return json(res, {
          current: +monthExpenses(now).toFixed(2),
          previous: +monthExpenses(prev).toFixed(2),
        });
      }
    }

    // SETTINGS
    if (seg[0] === 'settings') {
      if (method === 'GET') return json(res, settings);
      if (method === 'PUT') {
        settings = { ...settings, ...body };
        return json(res, settings);
      }
    }

    return json(res, { error: 'Not found' }, 404);
  } catch (e) {
    return json(res, { error: e.message }, 500);
  }
}
