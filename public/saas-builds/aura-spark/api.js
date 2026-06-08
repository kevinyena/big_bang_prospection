const store = {
  contacts: [],
  signups: [],
  agents: [],
};

const json = (res, code, data) => {
  res.statusCode = code;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(data));
};

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

export default function handler(req, res) {
  const method = (req.method || "GET").toUpperCase();
  const url = (req.url || "/").split("?")[0].replace(/\/+$/, "") || "/";
  const body = req.body && typeof req.body === "object" ? req.body : {};

  if (method === "OPTIONS") return json(res, 204, {});

  try {
    if (url === "/" || url === "/api" || url === "/api/health") {
      return json(res, 200, { ok: true, service: "aura-spark", time: Date.now() });
    }

    if (url === "/api/signup" && method === "POST") {
      const email = (body.email || "").trim();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
        return json(res, 400, { ok: false, error: "Adresse email invalide." });
      if (store.signups.some(s => s.email.toLowerCase() === email.toLowerCase()))
        return json(res, 409, { ok: false, error: "Cet email est déjà inscrit." });
      const rec = { id: uid(), email, plan: body.plan || "trial", createdAt: Date.now() };
      store.signups.push(rec);
      return json(res, 201, {
        ok: true,
        message: "Essai gratuit de 14 jours activé. Vérifiez votre boîte mail.",
        signup: rec,
      });
    }

    if (url === "/api/contact" && method === "POST") {
      const name = (body.name || "").trim();
      const email = (body.email || "").trim();
      const message = (body.message || "").trim();
      if (!name || !email || !message)
        return json(res, 400, { ok: false, error: "Tous les champs sont requis." });
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
        return json(res, 400, { ok: false, error: "Adresse email invalide." });
      const rec = { id: uid(), name, email, message, createdAt: Date.now() };
      store.contacts.push(rec);
      return json(res, 201, { ok: true, message: "Message reçu, notre équipe vous répond sous 24h.", contact: rec });
    }

    if (url === "/api/agent/deploy" && method === "POST") {
      const provider = (body.provider || "gmail").toLowerCase();
      const email = (body.email || "").trim();
      if (!["gmail", "outlook", "imap"].includes(provider))
        return json(res, 400, { ok: false, error: "Fournisseur non supporté." });
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
        return json(res, 400, { ok: false, error: "Adresse email invalide." });
      const rec = {
        id: uid(),
        email,
        provider,
        tone: body.tone || "professionnel",
        autonomy: body.autonomy || "validation",
        status: "active",
        stats: { sorted: 0, replied: 0, summarized: 0, archived: 0 },
        createdAt: Date.now(),
      };
      store.agents.push(rec);
      return json(res, 201, { ok: true, message: "Agent déployé avec succès.", agent: rec });
    }

    if (url === "/api/agent/activity" && method === "GET") {
      const samples = [
        { type: "reply", label: "Réponse envoyée à Sarah", meta: "2s" },
        { type: "summary", label: "Thread résumé", meta: "priorité haute" },
        { type: "archive", label: "3 emails archivés automatiquement", meta: "auto" },
        { type: "sort", label: "12 emails triés par intention", meta: "now" },
        { type: "priority", label: "Email urgent remonté en haut", meta: "client" },
      ];
      const feed = Array.from({ length: 4 }, () => samples[Math.floor(Math.random() * samples.length)]);
      return json(res, 200, { ok: true, feed, activeAgents: store.agents.length });
    }

    if (url === "/api/stats" && method === "GET") {
      return json(res, 200, {
        ok: true,
        stats: {
          emailsHandled: 1284593 + store.agents.length * 137,
          hoursSaved: 48210,
          activeAgents: 9421 + store.agents.length,
          satisfaction: 98.7,
        },
      });
    }

    return json(res, 404, { ok: false, error: "Route introuvable." });
  } catch (e) {
    return json(res, 500, { ok: false, error: "Erreur serveur." });
  }
}
