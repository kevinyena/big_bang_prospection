const store = {
  leads: [],
  newsletter: [],
  contacts: [],
  demos: [],
};

const json = (res, status, data) => {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
};

const isEmail = (e) => typeof e === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

export default function handler(req, res) {
  const method = (req.method || 'GET').toUpperCase();
  const url = new URL(req.url, 'http://localhost');
  const path = url.pathname.replace(/\/+$/, '') || '/';
  const body = req.body && typeof req.body === 'object' ? req.body : {};

  try {
    if (method === 'GET' && (path === '/' || path === '/api' || path === '/api/health')) {
      return json(res, 200, { ok: true, service: 'apex-board', status: 'healthy', time: new Date().toISOString() });
    }

    if (method === 'GET' && path === '/api/stats') {
      return json(res, 200, {
        stats: [
          { value: '+1M', label: 'emails traités' },
          { value: '8h', label: 'économisées/semaine' },
          { value: '99%', label: 'de tri précis' },
        ],
        live: {
          leads: store.leads.length,
          newsletter: store.newsletter.length,
          demos: store.demos.length,
        },
      });
    }

    if (method === 'GET' && path === '/api/plans') {
      return json(res, 200, {
        plans: [
          { id: 'starter', name: 'Starter', price: '19€', period: '/mois', popular: false, features: ['1 boîte mail connectée', 'Tri intelligent', 'Tableau de bord', 'Support email'] },
          { id: 'pro', name: 'Pro', price: '49€', period: '/mois', popular: true, features: ['Jusqu\'à 5 boîtes mail', 'Réponses automatiques', 'Priorisation avancée', 'Intégrations illimitées', 'Support prioritaire'] },
          { id: 'business', name: 'Business', price: 'Sur devis', period: '', popular: false, features: ['Boîtes illimitées', 'Agents pour équipes', 'SSO & sécurité avancée', 'Account manager dédié', 'SLA garanti'] },
        ],
      });
    }

    if (method === 'GET' && path === '/api/faq') {
      return json(res, 200, {
        faqs: [
          { q: "L'IA peut-elle vraiment répondre seule ?", a: "Oui. Vos agents rédigent et envoient des réponses dans votre ton selon vos règles. Vous pouvez aussi activer une validation manuelle avant envoi." },
          { q: "Mes données sont-elles sécurisées ?", a: "Absolument. Toutes vos données sont chiffrées de bout en bout et ne sont jamais utilisées pour entraîner des modèles tiers." },
          { q: "Quelles messageries sont supportées ?", a: "Gmail, Outlook et toute adresse compatible IMAP. La connexion se fait en un clic via OAuth sécurisé." },
          { q: "Puis-je valider avant envoi ?", a: "Oui. Activez le mode brouillon pour relire et approuver chaque réponse, ou laissez vos agents envoyer automatiquement." },
        ],
      });
    }

    if (method === 'POST' && (path === '/api/signup' || path === '/api/trial' || path === '/api/connect')) {
      const { email, plan, name } = body;
      if (!isEmail(email)) return json(res, 400, { error: 'Adresse email invalide.' });
      const lead = { id: uid(), email, plan: plan || 'pro', name: name || null, createdAt: new Date().toISOString() };
      store.leads.push(lead);
      return json(res, 201, { ok: true, message: 'Votre essai gratuit 14 jours est prêt. Connectez votre boîte mail pour démarrer.', lead });
    }

    if (method === 'POST' && path === '/api/newsletter') {
      const { email } = body;
      if (!isEmail(email)) return json(res, 400, { error: 'Adresse email invalide.' });
      if (store.newsletter.find((n) => n.email === email)) {
        return json(res, 200, { ok: true, message: 'Vous êtes déjà inscrit.' });
      }
      const entry = { id: uid(), email, createdAt: new Date().toISOString() };
      store.newsletter.push(entry);
      return json(res, 201, { ok: true, message: 'Inscription confirmée.', entry });
    }

    if (method === 'POST' && path === '/api/demo') {
      const { email, name, company } = body;
      if (!isEmail(email)) return json(res, 400, { error: 'Adresse email invalide.' });
      const demo = { id: uid(), email, name: name || null, company: company || null, createdAt: new Date().toISOString() };
      store.demos.push(demo);
      return json(res, 201, { ok: true, message: 'Démo réservée. Nous vous contactons sous 24h.', demo });
    }

    if (method === 'POST' && path === '/api/contact') {
      const { email, name, message } = body;
      if (!isEmail(email)) return json(res, 400, { error: 'Adresse email invalide.' });
      if (!message || !String(message).trim()) return json(res, 400, { error: 'Message requis.' });
      const contact = { id: uid(), email, name: name || null, message: String(message).trim(), createdAt: new Date().toISOString() };
      store.contacts.push(contact);
      return json(res, 201, { ok: true, message: 'Message reçu. Merci !', contact });
    }

    return json(res, 404, { error: 'Route introuvable', path, method });
  } catch (err) {
    return json(res, 500, { error: 'Erreur serveur', detail: err && err.message });
  }
}
