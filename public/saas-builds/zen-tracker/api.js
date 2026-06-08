const profiles = {
  vc: [
    {id:'s1',name:'NeuraFlow',av:'NF',sub:'Pre-seed · IA générative',tag:'Tagline: Copilote no-code pour data teams',chips:['IA','SaaS','B2B'],meta:[['$1.2M','Recherché'],['Pre-seed','Stade'],['+40%/mo','Traction'],['3','Équipe']]},
    {id:'s2',name:'GreenLoop',av:'GL',sub:'Seed · Climate Tech',tag:'Tagline: Recyclage circulaire piloté par IoT',chips:['Climate','Hardware','Impact'],meta:[['$3M','Recherché'],['Seed','Stade'],['12 pilotes','Traction'],['7','Équipe']]},
    {id:'s3',name:'PayRails',av:'PR',sub:'Seed · Fintech',tag:'Tagline: Infrastructure de paiement pour LATAM',chips:['Fintech','Payments','API'],meta:[['$4.5M','Recherché'],['Seed','Stade'],['$2M GMV','Traction'],['9','Équipe']]},
    {id:'s4',name:'MediTwin',av:'MT',sub:'Pre-seed · HealthTech',tag:'Tagline: Jumeau numérique pour essais cliniques',chips:['Health','AI','DeepTech'],meta:[['$2M','Recherché'],['Pre-seed','Stade'],['2 LOI','Traction'],['4','Équipe']]},
    {id:'s5',name:'OrbitOps',av:'OO',sub:'Seed · SpaceTech',tag:'Tagline: Plateforme SaaS de gestion de satellites',chips:['Space','SaaS','DeepTech'],meta:[['$5M','Recherché'],['Seed','Stade'],['3 contrats','Traction'],['11','Équipe']]},
    {id:'s6',name:'LexAI',av:'LA',sub:'Pre-seed · LegalTech',tag:'Tagline: Assistant juridique IA pour PME',chips:['Legal','IA','B2B'],meta:[['$800k','Recherché'],['Pre-seed','Stade'],['+60%/mo','Traction'],['2','Équipe']]}
  ],
  founder: [
    {id:'v1',name:'Atlas Ventures',av:'AV',sub:'Fonds Seed · Europe',tag:'Thèse: B2B SaaS & infra dev-first',chips:['SaaS','DevTools','B2B'],meta:[['$500k-2M','Ticket'],['Seed','Stade'],['Notion, Pennylane','Portfolio'],['48h','Réponse']]},
    {id:'v2',name:'Nova Capital',av:'NC',sub:'Business Angel',tag:'Thèse: Climate & impact à fort levier',chips:['Climate','Impact','Hardware'],meta:[['$50-300k','Ticket'],['Pre-seed','Stade'],['Back Market','Portfolio'],['24h','Réponse']]},
    {id:'v3',name:'Quantum Fund',av:'QF',sub:'Fonds Early · Global',tag:'Thèse: DeepTech & IA fondamentale',chips:['AI','DeepTech','Science'],meta:[['$1-5M','Ticket'],['Seed','Stade'],['Mistral, H','Portfolio'],['72h','Réponse']]},
    {id:'v4',name:'Horizon Angels',av:'HA',sub:'Syndicate · France',tag:'Thèse: Fintech & marketplaces early-stage',chips:['Fintech','Marketplace','B2C'],meta:[['$100-500k','Ticket'],['Pre-seed','Stade'],['Qonto, Spendesk','Portfolio'],['36h','Réponse']]},
    {id:'v5',name:'Verde Partners',av:'VP',sub:'Fonds Impact · EU',tag:'Thèse: HealthTech & longévité',chips:['Health','Bio','Impact'],meta:[['$1-3M','Ticket'],['Seed','Stade'],['Doctolib','Portfolio'],['72h','Réponse']]}
  ]
};

const state = {
  swipes: {},
  matches: [],
  chats: {},
  myProfile: { vc: null, founder: null }
};

const findProfile = id => [...profiles.vc, ...profiles.founder].find(p => p.id === id);

const seedChat = match => {
  if (!state.chats[match.id]) {
    state.chats[match.id] = [
      { id: 'm0', text: 'Bonjour ! Ravi de matcher. Parlons de votre projet 👋', me: false, ts: Date.now() }
    ];
  }
};

const send = (res, code, data) => {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
};

export default function handler(req, res) {
  const method = req.method.toUpperCase();
  const url = new URL(req.url, 'http://localhost');
  const path = url.pathname.replace(/^\/?api\/?/, '').replace(/^\/+|\/+$/g, '');
  const parts = path.split('/').filter(Boolean);
  const body = req.body || {};

  if (method === 'GET' && parts[0] === 'profiles') {
    const role = url.searchParams.get('role') === 'founder' ? 'founder' : 'vc';
    const deck = profiles[role].filter(p => !state.swipes[p.id]);
    return send(res, 200, deck.length ? deck : profiles[role]);
  }

  if (method === 'POST' && parts[0] === 'swipe') {
    const { targetId, direction } = body;
    const target = findProfile(targetId);
    state.swipes[targetId] = direction;
    let isMatch = false;
    if (direction === 'right' && target) {
      isMatch = Math.random() < 0.55;
      if (isMatch && !state.matches.find(m => m.id === target.id)) {
        state.matches.push({ ...target, matchedAt: Date.now() });
        seedChat(target);
      }
    }
    return send(res, 200, { isMatch, targetId, direction });
  }

  if (method === 'GET' && parts[0] === 'matches') {
    return send(res, 200, state.matches);
  }

  if (parts[0] === 'chat' && parts[1]) {
    const matchId = parts[1];
    if (method === 'GET') {
      return send(res, 200, state.chats[matchId] || []);
    }
    if (method === 'POST') {
      const text = (body.text || '').trim();
      if (!text) return send(res, 400, { error: 'Message vide' });
      const msg = { id: 'm' + Date.now(), text, me: true, ts: Date.now() };
      if (!state.chats[matchId]) state.chats[matchId] = [];
      state.chats[matchId].push(msg);
      const replies = [
        'Super, envoyez-moi votre deck et on cale un call cette semaine.',
        'Intéressant ! Quels sont vos KPIs actuels ?',
        'Parfait, je transmets à mon partner. On revient vite vers vous.'
      ];
      const reply = { id: 'r' + Date.now(), text: replies[Math.floor(Math.random() * replies.length)], me: false, ts: Date.now() + 1 };
      state.chats[matchId].push(reply);
      return send(res, 200, { ok: true, message: msg, reply });
    }
  }

  if (method === 'POST' && parts[0] === 'profile') {
    const role = body.role === 'founder' ? 'founder' : 'vc';
    state.myProfile[role] = {
      id: 'me-' + role,
      name: body.name || 'Mon profil',
      av: (body.name || 'ME').slice(0, 2).toUpperCase(),
      sub: body.sub || '',
      tag: body.tag || '',
      chips: Array.isArray(body.chips) ? body.chips : [],
      meta: Array.isArray(body.meta) ? body.meta : []
    };
    return send(res, 200, { ok: true, profile: state.myProfile[role] });
  }

  return send(res, 404, { error: 'Route introuvable', path });
}
