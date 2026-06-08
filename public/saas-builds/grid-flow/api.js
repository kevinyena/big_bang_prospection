const demos = [];
let demoSeq = 1;

const integrations = [
  { name: "Booking.com", category: "Channel Manager" },
  { name: "Expedia", category: "Channel Manager" },
  { name: "Airbnb", category: "Channel Manager" },
  { name: "Stripe", category: "Payments" },
  { name: "Adyen", category: "Payments" },
  { name: "Salto", category: "Door Locks" },
  { name: "Mailchimp", category: "Marketing" },
  { name: "QuickBooks", category: "Accounting" },
  { name: "Xero", category: "Accounting" },
  { name: "TrustYou", category: "Reputation" },
  { name: "Revinate", category: "CRM" },
  { name: "Duve", category: "Guest Experience" },
];

const testimonials = [
  {
    q: "The grid-flow team is responsive and invested in our success, even as a small, stand-alone property. They're receptive to feedback and understand the value that experienced hoteliers bring to the product. This two-way communication feels like a real partnership.",
    n: "Peter Lawrence", r: "Owner", c: "Wythe Hotel", b: "WYTHE HOTEL",
  },
  {
    q: "Since switching to grid-flow, our front desk operations have transformed completely. Automated check-ins free up our staff to focus on what really matters: creating memorable guest experiences.",
    n: "Sophie Martin", r: "General Manager", c: "Central Inn", b: "CENTRAL INN",
  },
  {
    q: "The reporting and revenue management tools gave us insights we never had before. We've grown our RevPAR by double digits in under a year thanks to smarter pricing decisions.",
    n: "David Chen", r: "Revenue Director", c: "The Social Hub", b: "THE SOCIAL HUB",
  },
];

const stats = [
  { value: "45%", label: "Increase in direct bookings" },
  { value: "45%", label: "Increase in RevPAR" },
  { value: "15,000+", label: "Properties worldwide" },
  { value: "1,000+", label: "Marketplace integrations" },
];

const newsletterSubs = [];

function send(res, status, data) {
  res.status(status).json(data);
}

export default function handler(req, res) {
  const url = (req.url || "").split("?")[0].replace(/\/$/, "") || "/";
  const method = (req.method || "GET").toUpperCase();
  const body = req.body || {};

  try {
    if (url === "/" || url === "/api" || url === "/api/health") {
      return send(res, 200, { ok: true, service: "grid-flow", time: new Date().toISOString() });
    }

    if (url === "/api/content" && method === "GET") {
      return send(res, 200, { testimonials, stats, integrations });
    }

    if (url === "/api/testimonials" && method === "GET") {
      return send(res, 200, { testimonials });
    }

    if (url === "/api/stats" && method === "GET") {
      return send(res, 200, { stats });
    }

    if (url === "/api/integrations" && method === "GET") {
      return send(res, 200, { total: 1000, items: integrations });
    }

    if (url === "/api/demo" && method === "POST") {
      const { name, email, company, message } = body;
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return send(res, 400, { ok: false, error: "A valid email is required." });
      }
      const demo = {
        id: demoSeq++,
        name: (name || "").trim(),
        email: email.trim(),
        company: (company || "").trim(),
        message: (message || "").trim(),
        createdAt: new Date().toISOString(),
      };
      demos.push(demo);
      return send(res, 201, { ok: true, message: "Thanks! Our team will be in touch to book your demo.", demo });
    }

    if (url === "/api/demo" && method === "GET") {
      return send(res, 200, { count: demos.length, demos });
    }

    if (url === "/api/roi" && method === "POST") {
      const rooms = Number(body.rooms) || 0;
      const adr = Number(body.adr) || 0;
      const occupancy = Math.min(Math.max(Number(body.occupancy) || 0, 0), 100);
      if (rooms <= 0 || adr <= 0) {
        return send(res, 400, { ok: false, error: "Provide a positive number of rooms and ADR." });
      }
      const currentRevPar = adr * (occupancy / 100);
      const lift = 0.09;
      const projectedRevPar = currentRevPar * (1 + lift);
      const annualUplift = (projectedRevPar - currentRevPar) * rooms * 365;
      return send(res, 200, {
        ok: true,
        currentRevPar: Math.round(currentRevPar * 100) / 100,
        projectedRevPar: Math.round(projectedRevPar * 100) / 100,
        liftPercent: lift * 100,
        annualUplift: Math.round(annualUplift),
      });
    }

    if (url === "/api/newsletter" && method === "POST") {
      const { email } = body;
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return send(res, 400, { ok: false, error: "A valid email is required." });
      }
      if (!newsletterSubs.includes(email.toLowerCase())) {
        newsletterSubs.push(email.toLowerCase());
      }
      return send(res, 201, { ok: true, message: "You're subscribed." });
    }

    return send(res, 404, { ok: false, error: "Not found", path: url });
  } catch (err) {
    return send(res, 500, { ok: false, error: "Internal server error", detail: String(err && err.message || err) });
  }
}
