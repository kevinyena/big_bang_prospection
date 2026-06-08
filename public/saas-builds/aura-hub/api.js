// Backend Aura Hub — gestion en mémoire des clients & factures
const state = {
  clients: [
    { name: 'Acme Inc.', email: 'contact@acme.com', address: '5 av. des Champs, Lyon' },
    { name: 'Nova Studio', email: 'hello@nova.io', address: '22 rue Centrale, Bordeaux' },
  ],
  invoices: [],
  seq: 1,
};

export default function handler(req, res) {
  const url = req.url.split('?')[0];
  const method = req.method;

  // --- CLIENTS ---
  if (url === '/clients' && method === 'GET') {
    return res.json({ success: true, data: state.clients });
  }
  if (url === '/clients' && method === 'POST') {
    const c = req.body || {};
    if (!c.name) return res.status(400).json({ success: false, error: 'Nom requis' });
    // mise à jour si déjà existant
    const idx = state.clients.findIndex(x => x.name.toLowerCase() === c.name.toLowerCase());
    if (idx >= 0) state.clients[idx] = { ...state.clients[idx], ...c };
    else state.clients.push({ name: c.name, email: c.email || '', address: c.address || '' });
    return res.json({ success: true, data: state.clients });
  }

  // --- INVOICES ---
  if (url === '/invoices' && method === 'GET') {
    return res.json({ success: true, data: state.invoices });
  }
  if (url === '/invoices' && method === 'POST') {
    const inv = req.body || {};
    const record = {
      id: 'inv_' + (state.seq++) + '_' + Date.now(),
      createdAt: new Date().toISOString(),
      ...inv,
    };
    state.invoices.unshift(record);
    return res.json({ success: true, data: record });
  }

  // --- DELETE invoice /invoices/:id ---
  const delMatch = url.match(/^\/invoices\/(.+)$/);
  if (delMatch && method === 'DELETE') {
    const id = decodeURIComponent(delMatch[1]);
    const before = state.invoices.length;
    state.invoices = state.invoices.filter(i => i.id !== id);
    return res.json({ success: true, removed: before - state.invoices.length });
  }

  return res.status(404).json({ success: false, error: 'Route non trouvée' });
}