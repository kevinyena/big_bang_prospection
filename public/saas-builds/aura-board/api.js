const ME = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120&q=80';

const DECKS = {
  founder: [
    { id: 'i1', name: 'Sequoia Edge', img: 'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=600&q=80', tag: 'VC · $250k–2M tickets', bio: 'Backing relentless founders at pre-seed & seed. Thesis: AI, fintech, dev tools.', chips: ['AI', 'Fintech', 'Seed', 'Hands-on'] },
    { id: 'i2', name: 'Lumen Ventures', img: 'https://images.unsplash.com/photo-1556157382-97eda2d62296?w=600&q=80', tag: 'VC · $500k–5M tickets', bio: 'Series A specialists. We help you scale GTM and hire your first VP.', chips: ['SaaS', 'B2B', 'Series A', 'GTM'] },
    { id: 'i3', name: 'North Star Capital', img: 'https://images.unsplash.com/photo-1612831455359-970e23a1e4e9?w=600&q=80', tag: 'Angel · $50k–250k', bio: 'Operator angels. Ex-founders who exited. Fast decisions, real network.', chips: ['Pre-seed', 'Marketplace', 'Angel'] },
    { id: 'i4', name: 'Helix Partners', img: 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=600&q=80', tag: 'VC · $1M–8M tickets', bio: 'Deep-tech & frontier. Patient capital for category-defining companies.', chips: ['Deep-tech', 'Climate', 'Series A'] },
    { id: 'i5', name: 'Catalyst Fund', img: 'https://images.unsplash.com/photo-1565728744382-61accd4aa148?w=600&q=80', tag: 'VC · $200k–1.5M', bio: 'Consumer & marketplace obsessed. We move fast and back conviction.', chips: ['Consumer', 'Marketplace', 'Seed'] },
    { id: 'i6', name: 'Quanta Capital', img: 'https://images.unsplash.com/photo-1559526324-4b87b5e36e44?w=600&q=80', tag: 'VC · $500k–3M', bio: 'Fintech & infra. Former operators who built unicorns. Real introductions.', chips: ['Fintech', 'Infra', 'Hands-on'] }
  ],
  investor: [
    { id: 'f1', name: 'NovaFlow AI', img: 'https://images.unsplash.com/photo-1559136555-9303baea8ebd?w=600&q=80', tag: 'Seed · Raising $1.5M · SaaS', bio: 'AI workflow automation for ops teams. $40k MRR, 18% MoM growth.', chips: ['AI', '$40k MRR', '+18% MoM', '12 logos'] },
    { id: 'f2', name: 'Verde Logistics', img: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=600&q=80', tag: 'Pre-seed · Raising $800k · Climate', bio: 'Carbon-neutral last-mile delivery. 3 city pilots, LOIs from 2 retailers.', chips: ['Climate', 'LOIs', 'Pre-seed'] },
    { id: 'f3', name: 'Pulse Health', img: 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=600&q=80', tag: 'Seed · Raising $2M · HealthTech', bio: 'Remote patient monitoring. $120k ARR, FDA pathway cleared.', chips: ['HealthTech', '$120k ARR', 'FDA'] },
    { id: 'f4', name: 'Cobalt Pay', img: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=600&q=80', tag: 'Seed · Raising $3M · Fintech', bio: 'Embedded payments for B2B marketplaces. $80k MRR, 9% MoM.', chips: ['Fintech', '$80k MRR', 'B2B'] },
    { id: 'f5', name: 'Atlas Robotics', img: 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=600&q=80', tag: 'Pre-seed · Raising $1.2M · Deep-tech', bio: 'Autonomous warehouse robots. 2 paid pilots, 40% cost reduction proven.', chips: ['Deep-tech', 'Robotics', 'Pilots'] },
    { id: 'f6', name: 'Bloom Social', img: 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=600&q=80', tag: 'Seed · Raising $1.8M · Consumer', bio: 'Creator commerce platform. 60k MAU, 22% MoM, $30k MRR.', chips: ['Consumer', '60k MAU', '$30k MRR'] }
  ]
};

const MATCH_NAMES = {
  i1: { name: 'Sequoia Edge', img: 'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=600&q=80' },
  i2: { name: 'Lumen Ventures', img: 'https://images.unsplash.com/photo-1556157382-97eda2d62296?w=600&q=80' },
  i3: { name: 'North Star Capital', img: 'https://images.unsplash.com/photo-1612831455359-970e23a1e4e9?w=600&q=80' },
  i4: { name: 'Helix Partners', img: 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=600&q=80' },
  i5: { name: 'Catalyst Fund', img: 'https://images.unsplash.com/photo-1565728744382-61accd4aa148?w=600&q=80' },
  i6: { name: 'Quanta Capital', img: 'https://images.unsplash.com/photo-1559526324-4b87b5e36e44?w=600&q=80' },
  f1: { name: 'NovaFlow AI', img: 'https://images.unsplash.com/photo-1559136555-9303baea8ebd?w=600&q=80' },
  f2: { name: 'Verde Logistics', img: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=600&q=80' },
  f3: { name: 'Pulse Health', img: 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=600&q=80' },
  f4: { name: 'Cobalt Pay', img: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=600&q=80' },
  f5: { name: 'Atlas Robotics', img: 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=600&q=80' },
  f6: { name: 'Bloom Social', img: 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=600&q=80' }
};

const REPLIES = [
  "Love this. Can you share your deck and cap table?",
  "Impressive traction — what's your current burn?",
  "This fits our thesis perfectly. Free for a call this week?",
  "How are you thinking about your go-to-market expansion?",
  "Great numbers. Who else is on the round so far?",
  "Let's set up an intro call. Does Thursday work?",
  "I'd like to dig into your unit economics. Send details?",
  "Strong founder energy. What's the use of funds?"
];

const state = {
  profile: {
    role: 'founder',
    name: 'Your Startup',
    img: ME,
    tagline: 'Building the future',
    sector: 'SaaS',
    ticket: 'Raising $1M',
    bio: 'Tell investors why you matter.',
    chips: ['Early-stage']
  },
  likes: { founder: new Set(), investor: new Set() },
  passes: new Set(),
  // pre-seeded incoming likes so mutual matches trigger
  incomingLikes: new Set(['i1', 'i2', 'f1', 'f2', 'f4']),
  matches: [
    { id: 'i1', name: 'Sequoia Edge', img: MATCH_NAMES.i1.img, last: 'Loved the traction. Free to chat Thursday?', online: true, ts: Date.now() - 6e5 },
    { id: 'i2', name: 'Lumen Ventures', img: MATCH_NAMES.i2.img, last: 'Send over the deck when you can 🚀', online: false, ts: Date.now() - 5e5 }
  ],
  messages: {
    i1: [
      { me: 0, t: 'Hey! Your numbers are impressive.', ts: Date.now() - 9e5 },
      { me: 1, t: 'Thanks! Happy to walk you through them.', ts: Date.now() - 8e5 },
      { me: 0, t: 'Loved the traction. Free to chat Thursday?', ts: Date.now() - 6e5 }
    ],
    i2: [
      { me: 0, t: 'Interested in your seed round.', ts: Date.now() - 7e5 },
      { me: 0, t: 'Send over the deck when you can 🚀', ts: Date.now() - 5e5 }
    ]
  }
};

const send = (res, code, data) => { res.statusCode = code; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(data)); };

export default function handler(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const parts = url.pathname.replace(/^\/?(api\/)?/, '').split('/').filter(Boolean);
  const method = req.method.toUpperCase();
  const body = req.body || {};

  // GET /deck
  if (parts[0] === 'deck' && method === 'GET') {
    const role = url.searchParams.get('role') === 'investor' ? 'investor' : 'founder';
    const swiped = new Set([...state.likes[role], ...state.passes]);
    return send(res, 200, DECKS[role].filter(c => !swiped.has(c.id)));
  }

  // POST /swipe
  if (parts[0] === 'swipe' && method === 'POST') {
    const { targetId, direction } = body;
    if (!targetId) return send(res, 400, { error: 'targetId required' });
    if (direction === 'left') {
      state.passes.add(targetId);
      return send(res, 200, { match: false });
    }
    const role = state.profile.role;
    state.likes[role].add(targetId);
    const isMatch = state.incomingLikes.has(targetId);
    if (isMatch && !state.matches.find(m => m.id === targetId)) {
      const info = MATCH_NAMES[targetId] || { name: 'New Match', img: ME };
      state.matches.unshift({ id: targetId, name: info.name, img: info.img, last: 'Say hi 👋', online: true, ts: Date.now() });
      state.messages[targetId] = state.messages[targetId] || [];
    }
    return send(res, 200, { match: isMatch });
  }

  // /matches and /matches/:id/messages
  if (parts[0] === 'matches') {
    if (parts.length === 1 && method === 'GET') {
      return send(res, 200, state.matches);
    }
    const id = parts[1];
    if (parts[2] === 'messages') {
      if (method === 'GET') {
        return send(res, 200, state.messages[id] || []);
      }
      if (method === 'POST') {
        const text = (body.text || '').trim();
        if (!text) return send(res, 400, { error: 'text required' });
        state.messages[id] = state.messages[id] || [];
        state.messages[id].push({ me: 1, t: text, ts: Date.now() });
        const m = state.matches.find(x => x.id === id);
        if (m) { m.last = text; m.ts = Date.now(); }
        let reply = null;
        if (Math.random() > 0.25) {
          reply = REPLIES[Math.floor(Math.random() * REPLIES.length)];
          state.messages[id].push({ me: 0, t: reply, ts: Date.now() + 1 });
          if (m) m.last = reply;
        }
        return send(res, 200, { ok: true, reply });
      }
    }
  }

  // /profile
  if (parts[0] === 'profile') {
    if (method === 'GET') return send(res, 200, state.profile);
    if (method === 'PUT' || method === 'POST') {
      state.profile = { ...state.profile, ...body };
      if (state.profile.role !== 'founder' && state.profile.role !== 'investor') state.profile.role = 'founder';
      return send(res, 200, state.profile);
    }
  }

  return send(res, 404, { error: 'Not found' });
}
