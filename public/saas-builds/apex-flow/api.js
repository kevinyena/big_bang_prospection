// api.js — Backend handler for apex-flow (ESM)
// In-memory state management + Express-style handler.

const db = {
  waitlist: [],
  leads: [],
  contacts: [],
  sessions: [],
  newsletter: [],
  stats: { visits: 0, demoRequests: 0, signups: 0 },
};

const LANGUAGES = [
  { code: 'es', name: 'Espagnol', flag: '🇪🇸', levels: ['Débutant', 'Intermédiaire', 'Avancé'] },
  { code: 'en', name: 'Anglais', flag: '🇬🇧', levels: ['Débutant', 'Intermédiaire', 'Avancé'] },
  { code: 'ja', name: 'Japonais', flag: '🇯🇵', levels: ['Débutant', 'Intermédiaire', 'Avancé'] },
  { code: 'ko', name: 'Coréen', flag: '🇰🇷', levels: ['Débutant', 'Intermédiaire'] },
  { code: 'de', name: 'Allemand', flag: '🇩🇪', levels: ['Débutant', 'Intermédiaire', 'Avancé'] },
  { code: 'it', name: 'Italien', flag: '🇮🇹', levels: ['Débutant', 'Intermédiaire', 'Avancé'] },
  { code: 'pt', name: 'Portugais', flag: '🇵🇹', levels: ['Débutant', 'Intermédiaire'] },
  { code: 'zh', name: 'Mandarin', flag: '🇨🇳', levels: ['Débutant', 'Intermédiaire'] },
];

const PLANS = [
  { id: 'free', name: 'Free', price: 0, currency: 'EUR', period: 'mois', popular: false,
    features: ['1 langue', '10 min / jour', 'Feedback basique'] },
  { id: 'pro', name: 'Pro', price: 12, currency: 'EUR', period: 'mois', popular: true,
    features: ['Toutes les langues', 'Sessions illimitées', 'Feedback avancé', 'Scénarios immersifs'] },
  { id: 'teams', name: 'Teams', price: null, currency: 'EUR', period: 'mois', popular: false,
    features: ['Multi-comptes', 'Tableau de bord admin', 'Support dédié'] },
];

const FAQ = [
  { q: 'Ai-je besoin de connaissances préalables ?', a: "Non. apex-flow s'adapte à ton niveau, même si tu pars de zéro absolu." },
  { q: 'Quelles langues sont disponibles ?', a: "Plus de 30 langues, de l'anglais et l'espagnol au japonais et au coréen." },
  { q: 'Ça marche sur mobile ?', a: 'Oui, apex-flow fonctionne parfaitement sur mobile, tablette et ordinateur.' },
  { q: "Comment l'IA corrige ma prononciation ?", a: 'Elle analyse ta voix phonème par phonème et te propose des corrections ciblées en temps réel.' },
];

const COACH_REPLIES = {
  es: ['¡Hola! ¿Cómo estás hoy?', 'Muy bien, sigue practicando.', '¿Qué hiciste el fin de semana?', '¡Excelente pronunciación!'],
  en: ['Hi there! How are you today?', 'Great, keep practicing!', 'What did you do this weekend?', 'Excellent pronunciation!'],
  ja: ['こんにちは！元気ですか？', 'いいですね、続けましょう。', '週末は何をしましたか？', '発音が上手ですね！'],
  default: ['Bonjour ! Prêt à pratiquer ?', 'Très bien, continue !', 'Raconte-moi ta journée.', 'Belle progression !'],
};

const PHONEME_TIPS = [
  "Insiste davantage sur la voyelle finale.",
  "Adoucis la consonne, elle est trop dure.",
  "L'accent tonique tombe sur la première syllabe.",
  "Roule un peu plus le 'r'.",
  "Allonge légèrement le son pour plus de fluidité.",
];

const json = (res, status, data) => {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
};

const validEmail = (e) => typeof e === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
const uid = (p = 'id') => `${p}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

export default function handler(req, res) {
  const method = (req.method || 'GET').toUpperCase();
  let pathname = '/';
  try {
    pathname = new URL(req.url, 'http://localhost').pathname;
  } catch {
    pathname = (req.url || '/').split('?')[0];
  }
  let route = pathname.replace(/^\/api/, '') || '/';
  if (route.length > 1) route = route.replace(/\/+$/, '');
  const body = req.body && typeof req.body === 'object' ? req.body : {};

  try {
    if (method === 'GET') {
      switch (route) {
        case '/':
        case '/health':
          return json(res, 200, { ok: true, service: 'apex-flow', time: new Date().toISOString() });

        case '/config':
          return json(res, 200, {
            brand: 'apex-flow',
            tagline: "Apprends une langue rien qu'en parlant",
            languagesCount: 30,
            plans: PLANS,
            faq: FAQ,
          });

        case '/languages':
          return json(res, 200, { languages: LANGUAGES, total: 30 });

        case '/plans':
          return json(res, 200, { plans: PLANS });

        case '/faq':
          return json(res, 200, { faq: FAQ });

        case '/stats':
          db.stats.visits += 1;
          return json(res, 200, {
            stats: db.stats,
            waitlist: db.waitlist.length,
            sessions: db.sessions.length,
          });

        case '/testimonials':
          return json(res, 200, {
            testimonials: [
              { q: 'En 3 semaines je tiens une vraie conversation en espagnol !', n: 'Camille R.', r: 'Débutante en espagnol' },
              { q: "Parler à l'IA m'a enlevé toute ma peur de l'oral en anglais.", n: 'Yanis M.', r: 'Étudiant' },
              { q: 'Le feedback de prononciation est bluffant de précision.', n: 'Sofia L.', r: 'Voyageuse au Japon' },
            ],
          });

        default:
          return json(res, 404, { error: 'Not found', route });
      }
    }

    if (method === 'POST') {
      switch (route) {
        case '/waitlist':
        case '/signup': {
          const email = (body.email || '').trim().toLowerCase();
          if (!validEmail(email)) return json(res, 400, { error: 'Email invalide.' });
          if (db.waitlist.find((w) => w.email === email))
            return json(res, 409, { error: 'Déjà inscrit.', email });
          const entry = { id: uid('wl'), email, language: body.language || null, createdAt: new Date().toISOString() };
          db.waitlist.push(entry);
          db.stats.signups += 1;
          return json(res, 201, { ok: true, message: 'Bienvenue sur apex-flow !', entry, position: db.waitlist.length });
        }

        case '/newsletter': {
          const email = (body.email || '').trim().toLowerCase();
          if (!validEmail(email)) return json(res, 400, { error: 'Email invalide.' });
          if (!db.newsletter.find((n) => n.email === email))
            db.newsletter.push({ id: uid('nl'), email, createdAt: new Date().toISOString() });
          return json(res, 201, { ok: true, message: 'Inscription confirmée.' });
        }

        case '/contact': {
          const { name, email, message } = body;
          if (!name || !validEmail((email || '').trim().toLowerCase()) || !message)
            return json(res, 400, { error: 'Champs manquants ou email invalide.' });
          const entry = { id: uid('ct'), name, email, message, createdAt: new Date().toISOString() };
          db.contacts.push(entry);
          return json(res, 201, { ok: true, message: 'Message reçu, nous te répondrons vite.', id: entry.id });
        }

        case '/demo': {
          const email = (body.email || '').trim().toLowerCase();
          if (email && !validEmail(email)) return json(res, 400, { error: 'Email invalide.' });
          db.stats.demoRequests += 1;
          const lead = { id: uid('demo'), email: email || null, language: body.language || 'es', createdAt: new Date().toISOString() };
          db.leads.push(lead);
          return json(res, 201, { ok: true, message: 'Démo prête à démarrer.', demoUrl: '/demo/live', lead });
        }

        case '/session/start': {
          const language = body.language || 'es';
          const level = body.level || 'Débutant';
          const lang = LANGUAGES.find((l) => l.code === language) || LANGUAGES[0];
          const session = {
            id: uid('sess'),
            language: lang.code,
            languageName: lang.name,
            level,
            turns: 0,
            startedAt: new Date().toISOString(),
            firstMessage: pick(COACH_REPLIES[lang.code] || COACH_REPLIES.default),
          };
          db.sessions.push(session);
          return json(res, 201, { ok: true, session });
        }

        case '/session/speak': {
          const { sessionId, transcript } = body;
          const session = db.sessions.find((s) => s.id === sessionId);
          if (!session) return json(res, 404, { error: 'Session introuvable.' });
          session.turns += 1;
          const replies = COACH_REPLIES[session.language] || COACH_REPLIES.default;
          const accuracy = Math.min(99, 70 + Math.floor(Math.random() * 30));
          const fluency = Math.min(99, 65 + Math.floor(Math.random() * 35));
          return json(res, 200, {
            ok: true,
            turn: session.turns,
            transcript: transcript || '',
            coachReply: pick(replies),
            feedback: {
              accuracy,
              fluency,
              tip: pick(PHONEME_TIPS),
            },
          });
        }

        case '/session/end': {
          const { sessionId } = body;
          const session = db.sessions.find((s) => s.id === sessionId);
          if (!session) return json(res, 404, { error: 'Session introuvable.' });
          session.endedAt = new Date().toISOString();
          return json(res, 200, {
            ok: true,
            summary: {
              turns: session.turns,
              language: session.languageName,
              level: session.level,
              progress: Math.min(100, session.turns * 5 + 10),
              encouragement: 'Belle session ! Reviens demain pour 5 minutes.',
            },
          });
        }

        case '/checkout': {
          const planId = body.planId || body.plan;
          const plan = PLANS.find((p) => p.id === planId);
          if (!plan) return json(res, 400, { error: 'Plan invalide.' });
          return json(res, 200, {
            ok: true,
            checkout: {
              id: uid('co'),
              plan: plan.name,
              amount: plan.price,
              currency: plan.currency,
              url: `/checkout/${plan.id}`,
            },
          });
        }

        default:
          return json(res, 404, { error: 'Not found', route });
      }
    }

    return json(res, 405, { error: 'Method not allowed', method });
  } catch (err) {
    return json(res, 500, { error: 'Erreur serveur', detail: String(err && err.message || err) });
  }
}
