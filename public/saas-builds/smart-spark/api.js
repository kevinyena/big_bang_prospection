const STARTUPS = [
  { id: 1, name: 'NeuralFlow', sector: 'AI Infrastructure', tag: 'GPU orchestration for inference at 1/10th the cost', logo: '🧠', ask: '$2.5M', stage: 'Seed', mrr: '$48K', growth: '+22% MoM', team: '7', color: 'from-violet-500 to-fuchsia-500' },
  { id: 2, name: 'GreenCart', sector: 'Climate · Commerce', tag: 'Carbon-neutral checkout for any e-shop in 1 line', logo: '🌱', ask: '$800K', stage: 'Pre-seed', mrr: '$12K', growth: '+41% MoM', team: '4', color: 'from-emerald-500 to-teal-500' },
  { id: 3, name: 'Ledgr', sector: 'Fintech · B2B', tag: 'Real-time treasury & FX for global startups', logo: '💸', ask: '$5M', stage: 'Series A', mrr: '$210K', growth: '+18% MoM', team: '19', color: 'from-orange-500 to-pink-500' },
  { id: 4, name: 'Pulse Health', sector: 'HealthTech', tag: 'AI triage that cuts ER wait times by 60%', logo: '🩺', ask: '$3.2M', stage: 'Seed', mrr: '$76K', growth: '+27% MoM', team: '11', color: 'from-rose-500 to-purple-500' },
  { id: 5, name: 'Looply', sector: 'Creator Economy', tag: 'Turn any podcast into 30 viral clips instantly', logo: '🎬', ask: '$1.2M', stage: 'Pre-seed', mrr: '$31K', growth: '+55% MoM', team: '5', color: 'from-pink-500 to-orange-400' },
  { id: 6, name: 'Forgewright', sector: 'DevTools', tag: 'CI/CD that ships your monorepo 4x faster', logo: '🔧', ask: '$1.8M', stage: 'Seed', mrr: '$54K', growth: '+33% MoM', team: '6', color: 'from-cyan-500 to-blue-500' },
  { id: 7, name: 'Harvestly', sector: 'AgriTech', tag: 'Satellite yield prediction for smallholder farms', logo: '🌾', ask: '$900K', stage: 'Pre-seed', mrr: '$9K', growth: '+62% MoM', team: '3', color: 'from-lime-500 to-emerald-500' },
];

const VCS = [
  { id: 101, name: 'Aperture Capital', sector: 'Seed · Series A', tag: 'We back technical founders building category leaders', logo: '🔭', ask: '$250K–$5M', stage: 'Lead', mrr: '120 deals', growth: 'B2B SaaS', team: '14', color: 'from-indigo-500 to-violet-500' },
  { id: 102, name: 'Nova Angels', sector: 'Pre-seed', tag: 'Operator angels who roll up sleeves with you', logo: '⭐', ask: '$25K–$250K', stage: 'Angel', mrr: '60 deals', growth: 'Climate · AI', team: '8', color: 'from-amber-500 to-orange-500' },
  { id: 103, name: 'Meridian Ventures', sector: 'Series A–B', tag: 'Global fund for breakout growth-stage teams', logo: '🌐', ask: '$5M–$20M', stage: 'Lead', mrr: '90 deals', growth: 'Fintech', team: '30', color: 'from-fuchsia-500 to-pink-500' },
  { id: 104, name: 'Catalyst Fund', sector: 'Seed', tag: 'Fast term sheets, founder-friendly terms', logo: '⚡', ask: '$500K–$3M', stage: 'Co-lead', mrr: '75 deals', growth: 'DeepTech', team: '10', color: 'from-cyan-500 to-blue-500' },
  { id: 105, name: 'Horizon Partners', sector: 'Seed · Series A', tag: 'Patient capital for mission-driven founders', logo: '🏔️', ask: '$300K–$4M', stage: 'Lead', mrr: '85 deals', growth: 'HealthTech', team: '12', color: 'from-teal-500 to-emerald-500' },
];

const ME = {
  investor: { id: 'me', name: 'You', role: 'investor', logo: '🚀' },
  founder: { id: 'me', name: 'You', role: 'founder', logo: '🚀' },
};

const state = {
  profile: { name: 'You', type: 'investor', logo: '🚀', bio: '', sector: '', stage: '' },
  swipes: {},
  matches: [],
  messages: {},
  msgSeq: 1000,
};

const REPLIES = [
  "Sounds great — let's set up a call this week 📅",
  "Love the traction. Can you share your deck?",
  "Interesting — what's your current runway?",
  "Let's talk terms. When are you raising by?",
  "Impressive numbers 🔥 happy to dig deeper.",
];

function findProfile(id) {
  const n = Number(id);
  return STARTUPS.find(s => s.id === n) || VCS.find(v => v.id === n) || null;
}

function ensureMatch(target) {
  if (!state.matches.find(m => m.id === target.id)) {
    state.matches.push(target);
    state.messages[target.id] = [
      { id: ++state.msgSeq, from: 'them', t: `Hey 👋 loved your profile — tell me more about ${target.name}!`, ts: Date.now() },
    ];
  }
}

function send(res, code, data) {
  res.status(code).json(data);
}

export default function handler(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const path = url.pathname.replace(/\/+$/, '') || '/';
  const method = (req.method || 'GET').toUpperCase();
  const body = req.body || {};

  try {
    if (path === '/api/deck' && method === 'GET') {
      const role = url.searchParams.get('role') === 'founder' ? 'founder' : 'investor';
      const deck = role === 'investor' ? STARTUPS : VCS;
      const swiped = state.swipes[role] || {};
      const list = deck.filter(p => !swiped[p.id]);
      return send(res, 200, { role, deck: list, total: deck.length });
    }

    if (path === '/api/swipe' && method === 'POST') {
      const { targetId, direction, role } = body;
      const r = role === 'founder' ? 'founder' : 'investor';
      const target = findProfile(targetId);
      if (!target) return send(res, 404, { error: 'Profile not found' });
      state.swipes[r] = state.swipes[r] || {};
      state.swipes[r][target.id] = direction;
      let match = false;
      if (direction === 'right') {
        match = Math.random() > 0.35;
        if (match) ensureMatch(target);
      }
      return send(res, 200, { match, targetId: target.id, matchProfile: match ? target : null });
    }

    if (path === '/api/matches' && method === 'GET') {
      const enriched = state.matches.map(m => {
        const msgs = state.messages[m.id] || [];
        const last = msgs[msgs.length - 1];
        return { ...m, lastMessage: last ? last.t : null, online: true };
      });
      return send(res, 200, { matches: enriched });
    }

    const msgMatch = path.match(/^\/api\/matches\/([^/]+)\/messages$/);
    if (msgMatch) {
      const id = Number(msgMatch[1]);
      const match = state.matches.find(m => m.id === id);
      if (!match) return send(res, 404, { error: 'Match not found' });

      if (method === 'GET') {
        return send(res, 200, { matchId: id, messages: state.messages[id] || [] });
      }

      if (method === 'POST') {
        const text = (body.text || '').trim();
        if (!text) return send(res, 400, { error: 'Empty message' });
        state.messages[id] = state.messages[id] || [];
        const mine = { id: ++state.msgSeq, from: 'me', t: text, ts: Date.now() };
        state.messages[id].push(mine);
        const reply = { id: ++state.msgSeq, from: 'them', t: REPLIES[Math.floor(Math.random() * REPLIES.length)], ts: Date.now() + 800 };
        state.messages[id].push(reply);
        return send(res, 200, { sent: mine, reply, messages: state.messages[id] });
      }
    }

    if (path === '/api/profile' && method === 'POST') {
      const { name, type, logo, bio, sector, stage } = body;
      if (name !== undefined) state.profile.name = String(name);
      if (type !== undefined) state.profile.type = type === 'founder' ? 'founder' : 'investor';
      if (logo !== undefined) state.profile.logo = String(logo);
      if (bio !== undefined) state.profile.bio = String(bio);
      if (sector !== undefined) state.profile.sector = String(sector);
      if (stage !== undefined) state.profile.stage = String(stage);
      return send(res, 200, { profile: state.profile });
    }

    if (path === '/api/profile' && method === 'GET') {
      return send(res, 200, { profile: state.profile });
    }

    return send(res, 404, { error: 'Not found', path });
  } catch (e) {
    return send(res, 500, { error: 'Server error', message: String(e && e.message || e) });
  }
}
