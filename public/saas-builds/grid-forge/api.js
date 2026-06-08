let transactions = [];
let categories = [];
let settings = { currency: 'EUR', theme: 'dark' };

function uid() { return 'id-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

function send(res, code, data) {
  res.status(code).json(data);
}

export default function handler(req, res) {
  const method = req.method;
  let url = req.url || '';
  url = url.replace(/^\/+/, '').replace(/^api\//, '').split('?')[0].replace(/\/+$/, '');
  const parts = url.split('/').filter(Boolean);
  const resource = parts[0] || '';
  const id = parts[1];
  const body = req.body && typeof req.body === 'object' ? req.body : {};

  if (resource === 'transactions') {
    if (method === 'GET') {
      if (id) {
        const t = transactions.find(x => x.id === id);
        return t ? send(res, 200, t) : send(res, 404, { error: 'not found' });
      }
      return send(res, 200, transactions);
    }
    if (method === 'POST') {
      const t = {
        id: body.id || uid(),
        type: body.type === 'income' ? 'income' : 'expense',
        amount: Math.round((parseFloat(body.amount) || 0) * 100) / 100,
        category: body.category || 'Autre',
        date: body.date || new Date().toISOString().slice(0, 10),
        description: (body.description || '').toString().slice(0, 120)
      };
      transactions.push(t);
      return send(res, 201, t);
    }
    if (method === 'PUT') {
      if (!id) return send(res, 400, { error: 'id required' });
      const i = transactions.findIndex(x => x.id === id);
      if (i === -1) return send(res, 404, { error: 'not found' });
      const cur = transactions[i];
      const upd = {
        ...cur,
        type: body.type === 'income' ? 'income' : (body.type === 'expense' ? 'expense' : cur.type),
        amount: body.amount != null ? Math.round((parseFloat(body.amount) || 0) * 100) / 100 : cur.amount,
        category: body.category != null ? body.category : cur.category,
        date: body.date != null ? body.date : cur.date,
        description: body.description != null ? body.description.toString().slice(0, 120) : cur.description,
        id
      };
      transactions[i] = upd;
      return send(res, 200, upd);
    }
    if (method === 'DELETE') {
      if (!id) return send(res, 400, { error: 'id required' });
      const before = transactions.length;
      transactions = transactions.filter(x => x.id !== id);
      return send(res, 200, { deleted: before !== transactions.length, id });
    }
  }

  if (resource === 'categories') {
    if (method === 'GET') {
      if (id) {
        const c = categories.find(x => x.id === id);
        return c ? send(res, 200, c) : send(res, 404, { error: 'not found' });
      }
      return send(res, 200, categories);
    }
    if (method === 'POST') {
      const c = {
        id: body.id || uid(),
        name: body.name || 'Catégorie',
        color: body.color || '#787b91',
        icon: body.icon || 'circle-dot'
      };
      categories.push(c);
      return send(res, 201, c);
    }
    if (method === 'PUT') {
      if (!id) return send(res, 400, { error: 'id required' });
      const i = categories.findIndex(x => x.id === id);
      if (i === -1) return send(res, 404, { error: 'not found' });
      categories[i] = { ...categories[i], ...body, id };
      return send(res, 200, categories[i]);
    }
    if (method === 'DELETE') {
      if (!id) return send(res, 400, { error: 'id required' });
      const before = categories.length;
      categories = categories.filter(x => x.id !== id);
      return send(res, 200, { deleted: before !== categories.length, id });
    }
  }

  if (resource === 'settings') {
    if (method === 'GET') return send(res, 200, settings);
    if (method === 'PUT' || method === 'POST') {
      settings = { ...settings, ...body };
      return send(res, 200, settings);
    }
  }

  if (resource === 'stats' && method === 'GET') {
    const income = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const expense = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    return send(res, 200, { income, expense, balance: income - expense, savings: income - expense });
  }

  return send(res, 404, { error: 'unknown route', method, url });
}
