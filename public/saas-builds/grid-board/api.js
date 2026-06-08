const profilesByRole = {
  INVESTOR: [
    { id: 'f1', name: 'Léo · Founder', avatar: 'L', sector: 'Climate · Hardware', stage: 'Pre-seed', ticket: 'Cherche 500K €', bullets: ['MVP déployé, 3 pilotes', 'Équipe technique solide', '12% MoM growth'] },
    { id: 'f2', name: 'Mira · Founder', avatar: 'M', sector: 'Fintech · B2B', stage: 'Seed', ticket: 'Cherche 1.5M €', bullets: ['ARR 320K€ en 8 mois', '2 co-founders ex-Stripe', 'Churn < 2%'] },
    { id: 'f3', name: 'Kai · Founder', avatar: 'K', sector: 'AI · DevTools', stage: 'Pre-seed → Seed', ticket: 'Cherche 800K €', bullets: ['9K devs sur waitlist', 'Open-source traction', 'Marge brute 88%'] },
    { id: 'f4', name: 'Nour · Founder', avatar: 'N', sector: 'Consumer · Mobile', stage: 'Seed', ticket: 'Cherche 1.2M €', bullets: ['200K MAU', 'Croissance organique virale', 'D30 retention 41%'] },
    { id: 'f5', name: 'Théo · Founder', avatar: 'T', sector: 'Healthtech · SaaS', stage: 'Series A', ticket: 'Cherche 4M €', bullets: ['1.2M€ ARR', '14 hôpitaux clients', 'NRR 130%'] }
  ],
  FOUNDER: [
    { id: 'i1', name: 'Sarah Capital', avatar: 'S', sector: 'Fintech · SaaS', stage: 'Pre-seed → Seed', ticket: '250K–800K €', bullets: ['Ex-operator devenue VC', 'Tickets early sur B2B', 'Décision en <2 semaines'] },
    { id: 'i2', name: 'Atlas Ventures', avatar: 'A', sector: 'Deeptech · AI', stage: 'Seed → Series A', ticket: '1M–3M €', bullets: ['Lead sur tours techniques', 'Réseau US + EU', 'Conviction-driven'] },
    { id: 'i3', name: 'Nova Fund', avatar: 'N', sector: 'Consumer · Mobile', stage: 'Seed', ticket: '400K–1.2M €', bullets: ['Focus produits virals', 'Hands-on go-to-market', 'Cheque rapide'] },
    { id: 'i4', name: 'Vertex Partners', avatar: 'V', sector: 'Climate · Hardware', stage: 'Pre-seed → Seed', ticket: '300K–1M €', bullets: ['Thèse impact + retour', 'Support technique fort', 'Patient capital'] },
    { id: 'i5', name: 'Orbit Angels', avatar: 'O', sector: 'Healthtech · SaaS', stage: 'Pre-seed', ticket: '100K–400K €', bullets: ['Collectif de business angels', 'Intros warm garanties', 'Closing rapide'] }
  ]
};

const replies = [
  "Parfait, on cale un call cette semaine ? 🚀",
  "Très intéressant, tu peux m'envoyer le deck ?",
  "J'adore la traction, parlons chiffres 📊",
  "Quel est ton runway actuel ?",
  "On peut se voir en visio jeudi ?",
  "Le marché me plaît, raconte-moi l'équipe 👥",
  "Top, je transmets à mes partners.",
  "Quelle valo tu vises sur ce tour ?"
];

const state = {
  user: { plan: 'free', swipesLeft: 3, role: 'INVESTOR', lastReset: new Date().toDateString() },
  swipes: {},
  matches: [],
  messages: {},
  matchSeq: 1
};

function resetDailyIfNeeded() {
  const today = new Date().toDateString();
  if (state.user.lastReset !== today) {
    state.user.lastReset = today;
    if (state.user.plan !== 'pro') state.user.swipesLeft = 3;
  }
}

function createMatch(profile, role) {
  const id = 'm' + (state.matchSeq++);
  const match = { id, profile, role, createdAt: Date.now() };
  state.matches.unshift(match);
  state.messages[id] = [{ mine: false, text: 'Hello 👋 super contente de matcher !', ts: Date.now() }];
  return match;
}

function send(res, code, body) {
  res.status(code).json(body);
}

export default function handler(req, res) {
  resetDailyIfNeeded();
  const url = (req.url || '').replace(/^\/+/, '').replace(/^api\/?/, '');
  const [pathPart, queryPart] = url.split('?');
  const segments = pathPart.split('/').filter(Boolean);
  const query = {};
  if (queryPart) queryPart.split('&').forEach(kv => { const [k, v] = kv.split('='); query[decodeURIComponent(k)] = decodeURIComponent(v || ''); });
  const method = (req.method || 'GET').toUpperCase();
  const body = req.body || {};

  // GET /me
  if (segments[0] === 'me' && segments.length === 1) {
    if (method === 'GET') return send(res, 200, { plan: state.user.plan, swipesLeft: state.user.plan === 'pro' ? null : Math.max(0, state.user.swipesLeft), role: state.user.role });
    if (method === 'POST') {
      if (body.plan) state.user.plan = body.plan === 'pro' ? 'pro' : 'free';
      if (body.role) state.user.role = body.role;
      if (state.user.plan === 'pro') state.user.swipesLeft = Infinity;
      return send(res, 200, { plan: state.user.plan, swipesLeft: state.user.plan === 'pro' ? null : Math.max(0, state.user.swipesLeft), role: state.user.role });
    }
  }

  // GET /profiles?role=INVESTOR
  if (segments[0] === 'profiles' && segments.length === 1 && method === 'GET') {
    const role = (query.role === 'FOUNDER' || query.role === 'INVESTOR') ? query.role : state.user.role;
    state.user.role = role;
    const list = (profilesByRole[role] || []).filter(p => !state.swipes[p.id]);
    return send(res, 200, list);
  }

  // POST /swipe
  if (segments[0] === 'swipe' && segments.length === 1 && method === 'POST') {
    const { profileId, direction, role } = body;
    const r = (role === 'FOUNDER' || role === 'INVESTOR') ? role : state.user.role;
    if (state.user.plan !== 'pro') {
      if (state.user.swipesLeft <= 0) return send(res, 403, { error: 'no_swipes_left', swipesLeft: 0 });
      state.user.swipesLeft = Math.max(0, state.user.swipesLeft - 1);
    }
    if (profileId) state.swipes[profileId] = direction;
    let match = null;
    if (direction === 'like') {
      const profile = (profilesByRole[r] || []).find(p => p.id === profileId)
        || { id: profileId || ('p' + Date.now()), name: 'Profil', avatar: '?', sector: '', stage: '', ticket: '', bullets: [] };
      const isMatch = Math.random() > 0.45;
      if (isMatch) {
        const m = createMatch(profile, r);
        match = { id: m.id, profile: m.profile };
      }
    }
    return send(res, 200, { ok: true, match, swipesLeft: state.user.plan === 'pro' ? null : Math.max(0, state.user.swipesLeft) });
  }

  // /matches ...
  if (segments[0] === 'matches') {
    if (segments.length === 1 && method === 'GET') {
      return send(res, 200, state.matches.map(m => ({ id: m.id, name: m.profile.name, avatar: m.profile.avatar, sector: m.profile.sector, stage: m.profile.stage })));
    }
    const matchId = segments[1];
    const match = state.matches.find(m => m.id === matchId);

    // GET/POST /matches/:id/messages
    if (segments[2] === 'messages') {
      if (!match) return send(res, 404, { error: 'match_not_found' });
      if (method === 'GET') {
        return send(res, 200, (state.messages[matchId] || []).map(m => ({ mine: m.mine, text: m.text })));
      }
      if (method === 'POST') {
        const text = (body.text || '').toString().slice(0, 1000).trim();
        if (!text) return send(res, 400, { error: 'empty_message' });
        state.messages[matchId] = state.messages[matchId] || [];
        state.messages[matchId].push({ mine: true, text, ts: Date.now() });
        const reply = replies[Math.floor(Math.random() * replies.length)];
        state.messages[matchId].push({ mine: false, text: reply, ts: Date.now() + 1 });
        return send(res, 200, { ok: true, reply });
      }
    }

    // GET /matches/:id
    if (segments.length === 2 && method === 'GET') {
      if (!match) return send(res, 404, { error: 'match_not_found' });
      return send(res, 200, { id: match.id, profile: match.profile });
    }
  }

  return send(res, 404, { error: 'not_found', path: pathPart });
}
