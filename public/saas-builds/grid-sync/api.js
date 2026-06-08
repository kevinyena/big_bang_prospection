'use strict';

const barbers = [
  { id: 'b1', name: 'Marco Léonardi', photo: 'https://images.unsplash.com/photo-1622286342621-4bd786c2447c?auto=format&fit=crop&w=700&q=80', specialties: ['Fade & Dégradés', 'Coupe classique', 'Styling'], rating: 4.9, bio: "Quinze ans de métier et une obsession pour le fade parfait. Marco a affûté sa technique entre Milan et Paris, mêlant rigueur italienne et fantaisie contemporaine.", workingHours: 'Lun–Sam · 9h–20h' },
  { id: 'b2', name: 'Idriss Benali', photo: 'https://images.unsplash.com/photo-1605497788044-5a32c7078486?auto=format&fit=crop&w=700&q=80', specialties: ['Rasage traditionnel', 'Taille de barbe', 'Soins du visage'], rating: 4.8, bio: "Maître du rasage à l'ancienne, à la serviette chaude et au coupe-chou. Idriss transforme chaque rasage en un rituel apaisant et soigné.", workingHours: 'Mar–Sam · 10h–20h' },
  { id: 'b3', name: 'Théo Marchand', photo: 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=700&q=80', specialties: ['Coupe moderne', 'Coloration', 'Textures bouclées'], rating: 4.9, bio: "Spécialiste des coupes tendance et des colorations subtiles. Théo écoute, conseille et sublime chaque type de cheveu avec précision.", workingHours: 'Lun–Ven · 9h–19h' },
  { id: 'b4', name: 'Samuel Okoro', photo: 'https://images.unsplash.com/photo-1599351431202-1e0f0137899a?auto=format&fit=crop&w=700&q=80', specialties: ['Skin fade', 'Lignes & contours', 'Barbe sculptée'], rating: 5.0, bio: "Précision chirurgicale et sens du détail. Samuel est reconnu pour ses contours nets et ses skin fades millimétrés.", workingHours: 'Lun–Sam · 11h–20h' },
];

const services = [
  { id: 's1', name: 'Coupe Homme Signature', category: 'Coupes', price: 38, durationMin: 45, description: "Consultation, shampooing, coupe sur mesure et coiffage avec produits premium." },
  { id: 's2', name: 'Coupe Express', category: 'Coupes', price: 25, durationMin: 30, description: "Une coupe nette et rapide pour entretenir votre style." },
  { id: 's3', name: 'Skin Fade Premium', category: 'Coupes', price: 45, durationMin: 50, description: "Dégradé ultra net jusqu'à la peau, finitions au rasoir." },
  { id: 's4', name: 'Coupe Enfant', category: 'Coupes', price: 22, durationMin: 30, description: "Une coupe adaptée aux plus jeunes, dans une ambiance détendue." },
  { id: 's5', name: 'Taille de Barbe', category: 'Barbe', price: 25, durationMin: 30, description: "Mise en forme, contours dessinés et huile nourrissante." },
  { id: 's6', name: 'Rasage Traditionnel', category: 'Barbe', price: 35, durationMin: 40, description: "Rasage au coupe-chou, serviette chaude et soin apaisant." },
  { id: 's7', name: 'Barbe Sculptée', category: 'Barbe', price: 30, durationMin: 35, description: "Sculpture précise de la barbe avec lignes et contours définis." },
  { id: 's8', name: 'Soin du Visage', category: 'Soins', price: 40, durationMin: 40, description: "Gommage, masque purifiant et massage relaxant du visage." },
  { id: 's9', name: 'Coloration', category: 'Soins', price: 50, durationMin: 60, description: "Coloration sur mesure ou couverture des cheveux blancs." },
  { id: 's10', name: 'Rituel Complet', category: 'Forfaits', price: 75, durationMin: 90, description: "Coupe signature + taille de barbe + soin du visage. L'expérience GridSync complète." },
  { id: 's11', name: 'Coupe + Barbe', category: 'Forfaits', price: 55, durationMin: 70, description: "Le duo incontournable : coupe signature et taille de barbe." },
];

const bookings = new Map();
const contacts = [];

function pad(n) { return String(n).padStart(2, '0'); }

function genReference() {
  const c = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 6; i++) s += c[Math.floor(Math.random() * c.length)];
  return 'GS-' + s;
}

function seededRandom(seed) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
  return () => { h += 0x6D2B79F5; let t = h; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

function buildSlots(barberId, date) {
  const dt = new Date(date + 'T00:00:00');
  const dow = dt.getDay();
  if (dow === 0) return [];
  const start = 9, end = 20;
  const rand = seededRandom(barberId + '|' + date);
  const slots = [];
  for (let h = start; h < end; h++) {
    for (const min of [0, 30]) {
      const time = `${pad(h)}:${pad(min)}`;
      const r = rand();
      const available = r > 0.38;
      slots.push({ time, available });
    }
  }
  const today = new Date(); today.setHours(0, 0, 0, 0);
  if (dt.getTime() === today.getTime()) {
    const now = new Date();
    return slots.map(s => {
      const [hh, mm] = s.time.split(':').map(Number);
      if (hh < now.getHours() || (hh === now.getHours() && mm <= now.getMinutes())) return { ...s, available: false };
      return s;
    });
  }
  return slots;
}

function send(res, code, data) {
  res.status(code).json(data);
}

export default function handler(req, res) {
  const method = req.method;
  const rawUrl = req.url || '';
  const [pathPart, queryPart] = rawUrl.split('?');
  const path = pathPart.replace(/^\/+/, '').replace(/^api\/?/, '').replace(/\/+$/, '');
  const query = new URLSearchParams(queryPart || '');
  const seg = path.split('/').filter(Boolean);
  const body = req.body || {};

  try {
    if (method === 'GET' && seg[0] === 'barbers' && !seg[1]) return send(res, 200, barbers);

    if (method === 'GET' && seg[0] === 'barbers' && seg[1]) {
      const b = barbers.find(x => x.id === seg[1]);
      if (!b) return send(res, 404, { error: 'Barber introuvable' });
      return send(res, 200, b);
    }

    if (method === 'GET' && seg[0] === 'services') return send(res, 200, services);

    if (method === 'GET' && seg[0] === 'availability') {
      const barberId = query.get('barberId');
      const date = query.get('date');
      if (!barberId || !date) return send(res, 400, { error: 'barberId et date requis' });
      if (!barbers.find(x => x.id === barberId)) return send(res, 404, { error: 'Barber introuvable' });
      const slots = buildSlots(barberId, date);
      return send(res, 200, { barberId, date, slots });
    }

    if (method === 'POST' && seg[0] === 'bookings') {
      const { barberId, serviceIds, slot, customer, total } = body;
      if (!barberId || !Array.isArray(serviceIds) || !serviceIds.length || !slot || !slot.date || !slot.time || !customer || !customer.name || !customer.email) {
        return send(res, 400, { error: 'Données de réservation incomplètes' });
      }
      const barber = barbers.find(x => x.id === barberId);
      if (!barber) return send(res, 404, { error: 'Barber introuvable' });
      const picked = services.filter(s => serviceIds.includes(s.id));
      if (!picked.length) return send(res, 400, { error: 'Prestations invalides' });
      const computedTotal = picked.reduce((s, x) => s + x.price, 0);
      const duration = picked.reduce((s, x) => s + x.durationMin, 0);
      let reference;
      do { reference = genReference(); } while (bookings.has(reference));
      const booking = {
        reference, barberId, barber,
        serviceIds, services: picked,
        slot, customer,
        total: typeof total === 'number' ? total : computedTotal,
        duration, status: 'pending',
        createdAt: new Date().toISOString(),
      };
      bookings.set(reference, booking);
      return send(res, 201, { reference, id: reference, ...booking });
    }

    if (method === 'POST' && seg[0] === 'payments' && seg[1] === 'simulate') {
      const { reference, amount, card } = body;
      const booking = reference ? bookings.get(reference) : null;
      const digits = String(card || '').replace(/\D/g, '');
      if (digits.length < 16) return send(res, 402, { status: 'failed', error: 'Carte invalide' });
      const transactionId = 'TXN-' + Date.now().toString(36).toUpperCase() + Math.floor(Math.random() * 1000);
      if (booking) booking.status = 'confirmed';
      return send(res, 200, {
        status: 'success',
        reference: booking ? booking.reference : reference,
        transactionId,
        amount: amount ?? (booking ? booking.total : 0),
        paidAt: new Date().toISOString(),
      });
    }

    if (method === 'GET' && seg[0] === 'bookings' && seg[1]) {
      const booking = bookings.get(seg[1]);
      if (!booking) return send(res, 404, { error: 'Réservation introuvable' });
      return send(res, 200, booking);
    }

    if (method === 'POST' && seg[0] === 'contact') {
      const { name, email, message } = body;
      if (!name || !email || !message) return send(res, 400, { error: 'Champs requis manquants' });
      const entry = { id: 'C-' + Date.now().toString(36), name, email, message, createdAt: new Date().toISOString() };
      contacts.push(entry);
      return send(res, 201, { ok: true, message: 'Message reçu' });
    }

    return send(res, 404, { error: 'Route introuvable', path });
  } catch (e) {
    return send(res, 500, { error: 'Erreur serveur', detail: String(e && e.message || e) });
  }
}
