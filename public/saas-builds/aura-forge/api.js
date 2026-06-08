const SECTORS = {
  FinTech: 'from-emerald-400 to-cyan-400',
  AI: 'from-violet-400 to-fuchsia-400',
  ClimateTech: 'from-green-400 to-teal-400',
  HealthTech: 'from-rose-400 to-pink-400',
  SaaS: 'from-blue-400 to-indigo-400',
  Web3: 'from-amber-400 to-orange-400',
};

const FOUNDERS = [
  { id: 'f1', name: 'Maya Chen', startup: 'NeuralPay', sector: 'FinTech', stage: 'Seed', traction: '$48k MRR · +22% MoM', ask: '$1.5M', pitch: 'AI-native treasury for SMBs. Cutting cash-flow forecasting error by 80%.', avatar: '🦊' },
  { id: 'f2', name: 'Liam Okafor', startup: 'Verdant', sector: 'ClimateTech', stage: 'Pre-seed', traction: '3 pilots · 2 LOIs', ask: '$800k', pitch: 'Carbon capture membranes that are 4x cheaper than incumbents.', avatar: '🌱' },
  { id: 'f3', name: 'Sofia Rossi', startup: 'Synapse', sector: 'AI', stage: 'Seed', traction: '12k WAU · 40% retention', ask: '$2.2M', pitch: 'Autonomous agents for legal due diligence. 10x faster reviews.', avatar: '🧠' },
  { id: 'f4', name: 'Dev Patel', startup: 'Pulse', sector: 'HealthTech', stage: 'Pre-seed', traction: 'FDA pre-sub done', ask: '$1.1M', pitch: 'Continuous cardiac monitoring patch with clinical-grade accuracy.', avatar: '❤️‍🔥' },
  { id: 'f5', name: 'Anya Volkov', startup: 'Ledgr', sector: 'Web3', stage: 'Seed', traction: '$3.2M TVL · 9k wallets', ask: '$2M', pitch: 'On-chain treasury management for DAOs and crypto-native teams.', avatar: '🪙' },
  { id: 'f6', name: 'Marcus Lee', startup: 'Forge', sector: 'SaaS', stage: 'Pre-seed', traction: '420 signups · 18% paid', ask: '$900k', pitch: 'Workflow automation that replaces 5 internal tools for ops teams.', avatar: '🛠️' },
];

const INVESTORS = [
  { id: 'i1', name: 'Aria Ventures', startup: 'Aria Ventures', sector: 'AI', stage: 'Seed', traction: '$220M AUM', ask: '$250k–$2M ticket', pitch: 'Thesis-driven seed fund backing AI-native founders. 60+ portfolio cos.', avatar: '💎', tags: ['AI', 'SaaS', 'DevTools'] },
  { id: 'i2', name: 'North Star Capital', startup: 'North Star', sector: 'ClimateTech', stage: 'Pre-seed', traction: '$90M AUM', ask: '$100k–$750k ticket', pitch: 'First check into climate hardware. Hands-on operators turned investors.', avatar: '⭐', tags: ['ClimateTech', 'DeepTech'] },
  { id: 'i3', name: 'Helix Partners', startup: 'Helix', sector: 'FinTech', stage: 'Seed', traction: '$410M AUM', ask: '$500k–$3M ticket', pitch: 'Backing the next generation of financial infrastructure.', avatar: '🔷', tags: ['FinTech', 'Web3'] },
  { id: 'i4', name: 'Quantum Seed', startup: 'Quantum Seed', sector: 'SaaS', stage: 'Pre-seed', traction: '$60M AUM', ask: '$50k–$500k ticket', pitch: 'Pre-seed specialists. We write the first check and roll up our sleeves.', avatar: '⚛️', tags: ['SaaS', 'AI', 'B2B'] },
  { id: 'i5', name: 'Atlas Fund', startup: 'Atlas Fund', sector: 'HealthTech', stage: 'Seed', traction: '$310M AUM', ask: '$300k–$2.5M ticket', pitch: 'Health & bio-focused seed fund with deep clinical networks.', avatar: '🏛️', tags: ['HealthTech', 'BioTech'] },
];

const db = {
  session: { userId: 'me', role: 'founder', sector: null, amount: null },
  swipes: {},
  matches: [],
  messages: {},
};

const findCard = (id) => [...FOUNDERS, ...INVESTORS].find(c => c.id === id);

const seedMessages = (m) => [
  { from: 'them', t: `Hey! Loved your profile. Let's talk about ${m.startup}.`, ts: Date.now() - 60000 },
];

const send = (res, status, body) => {
  res.status(status).json(body);
};

export default function handler(req, res) {
  const method = req.method;
  const url = (req.url || '').split('?')[0];
  const query = (() => {
    const q = (req.url || '').split('?')[1];
    const out = {};
    if (q) for (const pair of q.split('&')) { const [k, v] = pair.split('='); out[decodeURIComponent(k)] = decodeURIComponent(v || ''); }
    return out;
  })();
  const body = req.body || {};

  const matchMsg = url.match(/^\/api\/matches\/([^/]+)\/messages$/);

  try {
    if (method === 'GET' && url === '/api/profiles') {
      const role = query.role || db.session.role;
      const deck = role === 'founder' ? INVESTORS : FOUNDERS;
      const swiped = db.swipes;
      const filtered = deck.filter(c => !swiped[c.id]);
      return send(res, 200, { profiles: filtered.length ? filtered : deck });
    }

    if (method === 'POST' && url === '/api/swipe') {
      const { targetId, direction } = body;
      if (!targetId || !direction) return send(res, 400, { error: 'targetId and direction required' });
      db.swipes[targetId] = direction;
      let match = false;
      if (direction === 'right' || direction === 'super') {
        match = direction === 'super' ? true : Math.random() > 0.4;
        if (match) {
          const card = findCard(targetId);
          if (card && !db.matches.find(m => m.id === card.id)) {
            db.matches.unshift(card);
            db.messages[card.id] = seedMessages(card);
          }
        }
      }
      return send(res, 200, { match, targetId });
    }

    if (method === 'GET' && url === '/api/matches') {
      return send(res, 200, { matches: db.matches });
    }

    if (matchMsg && method === 'GET') {
      const id = matchMsg[1];
      const card = findCard(id);
      if (!db.messages[id] && card) db.messages[id] = seedMessages(card);
      return send(res, 200, { messages: db.messages[id] || [] });
    }

    if (matchMsg && method === 'POST') {
      const id = matchMsg[1];
      const { text } = body;
      if (!text || !text.trim()) return send(res, 400, { error: 'text required' });
      const card = findCard(id);
      if (!db.messages[id]) db.messages[id] = card ? seedMessages(card) : [];
      const msg = { from: 'me', t: text.trim(), ts: Date.now() };
      db.messages[id].push(msg);
      const replies = ['Sounds great — sending over my calendar link 📅', 'Love it. Can you share the deck?', 'Let\'s set up a call this week.', 'Strong traction. What\'s the round structure?'];
      const reply = { from: 'them', t: replies[Math.floor(Math.random() * replies.length)], ts: Date.now() + 1 };
      db.messages[id].push(reply);
      return send(res, 200, { message: msg, reply, messages: db.messages[id] });
    }

    if (method === 'POST' && url === '/api/profile') {
      const { role, sector, amount } = body;
      if (role) db.session.role = role;
      if (sector !== undefined) db.session.sector = sector;
      if (amount !== undefined) db.session.amount = amount;
      return send(res, 200, { profile: db.session });
    }

    if (method === 'POST' && url === '/api/auth/session') {
      const { role } = body;
      if (role) db.session.role = role;
      return send(res, 200, { session: db.session });
    }

    return send(res, 404, { error: 'Not found', url });
  } catch (e) {
    return send(res, 500, { error: String(e && e.message || e) });
  }
}
