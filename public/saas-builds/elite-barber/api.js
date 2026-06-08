'use strict';

const services = [
  { id: 1, name: 'Coupe Signature', price: 38, duration: 45, icon: 'fa-scissors', description: 'Coupe sur-mesure, shampoing et coiffage premium adaptés à votre style.' },
  { id: 2, name: 'Taille de Barbe', price: 25, duration: 30, icon: 'fa-user-tie', description: 'Sculpture précise de la barbe, contours nets et huile nourrissante.' },
  { id: 3, name: 'Rasage Traditionnel', price: 32, duration: 40, icon: 'fa-razor', description: 'Rasage au coupe-chou, serviette chaude et soin apaisant à l\'ancienne.' },
  { id: 4, name: 'Coupe + Barbe', price: 55, duration: 70, icon: 'fa-crown', description: 'L\'expérience complète : coupe signature et taille de barbe assorties.' },
  { id: 5, name: 'Soin Capillaire', price: 28, duration: 30, icon: 'fa-spa', description: 'Traitement profond du cuir chevelu, massage et hydratation intense.' },
  { id: 6, name: 'Coloration Homme', price: 45, duration: 50, icon: 'fa-palette', description: 'Coloration discrète ou camouflage des cheveux blancs, résultat naturel.' },
  { id: 7, name: 'Forfait Marié', price: 95, duration: 90, icon: 'fa-ring', description: 'Préparation complète pour le grand jour : coupe, barbe, soins et conseils.' },
  { id: 8, name: 'Coupe Enfant', price: 22, duration: 30, icon: 'fa-child', description: 'Coupe adaptée aux plus jeunes dans une ambiance détendue.' }
];

const barbers = [
  { id: 1, name: 'Marco Belluci', rating: 4.9, specialties: ['Coupe Signature', 'Dégradés'], bio: 'Vingt ans de métier entre Milan et Paris, Marco excelle dans les dégradés précis et les coupes structurées intemporelles.', photo: 'https://images.unsplash.com/photo-1503443207922-dff7d543fd0e?q=80&w=600&auto=format&fit=crop' },
  { id: 2, name: 'Idris Hassan', rating: 5.0, specialties: ['Rasage Traditionnel', 'Barbe'], bio: 'Maître du rasage au coupe-chou, Idris perpétue l\'art du barbier classique avec une rigueur d\'orfèvre.', photo: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=600&auto=format&fit=crop' },
  { id: 3, name: 'Lucas Moreau', rating: 4.8, specialties: ['Coloration', 'Soins'], bio: 'Passionné par les tendances modernes, Lucas marie technique et créativité pour des résultats sur-mesure.', photo: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?q=80&w=600&auto=format&fit=crop' },
  { id: 4, name: 'Antoine Vidal', rating: 4.9, specialties: ['Coupe + Barbe', 'Forfait Marié'], bio: 'Spécialiste des prestations complètes, Antoine sublime chaque client pour les grandes occasions.', photo: 'https://images.unsplash.com/photo-1599566150163-29194dcaad36?q=80&w=600&auto=format&fit=crop' },
  { id: 5, name: 'Samir Khelifi', rating: 4.7, specialties: ['Dégradés', 'Coupe Enfant'], bio: 'Doux et patient, Samir est le favori des familles et le roi du dégradé américain.', photo: 'https://images.unsplash.com/photo-1583864697784-a0efc8379f70?q=80&w=600&auto=format&fit=crop' },
  { id: 6, name: 'Théo Lambert', rating: 4.8, specialties: ['Coupe Signature', 'Soins'], bio: 'Jeune talent récompensé, Théo apporte une touche contemporaine à chaque création.', photo: 'https://images.unsplash.com/photo-1488161628813-04466f872be2?q=80&w=600&auto=format&fit=crop' }
];

const testimonials = [
  { name: 'Julien P.', role: 'Client fidèle', rating: 5, text: 'Une expérience incroyable, du fauteuil au résultat final. Marco est un véritable artiste, je ne vais plus nulle part ailleurs.', avatar: 'https://i.pravatar.cc/100?u=julien' },
  { name: 'Karim B.', role: 'Marié comblé', rating: 5, text: 'Le forfait marié avec Antoine était parfait. Accueil chaleureux, ambiance haut de gamme et résultat impeccable.', avatar: 'https://i.pravatar.cc/100?u=karim' },
  { name: 'Romain T.', role: 'Habitué', rating: 5, text: 'Le rasage traditionnel d\'Idris est un moment de pure détente. La serviette chaude, le coupe-chou... un vrai rituel.', avatar: 'https://i.pravatar.cc/100?u=romain' },
  { name: 'Maxime L.', role: 'Client', rating: 4, text: 'Salon magnifique, équipe au top. Lucas a su me conseiller une coupe qui me correspond parfaitement.', avatar: 'https://i.pravatar.cc/100?u=maxime' },
  { name: 'David M.', role: 'Client fidèle', rating: 5, text: 'Le souci du détail est partout. C\'est plus qu\'un barbier, c\'est une parenthèse de luxe dans la semaine.', avatar: 'https://i.pravatar.cc/100?u=david' }
];

const bookings = new Map();
let seq = 1000;

const pad = n => String(n).padStart(2, '0');

function dayHash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) { h = ((h << 5) - h + str.charCodeAt(i)) | 0; }
  return Math.abs(h);
}

function generateSlots(barberId, date) {
  const d = new Date(date + 'T00:00:00');
  const dow = d.getDay();
  if (dow === 0) return [];
  const endHour = dow === 6 ? 18 : 20;
  const slots = [];
  const seed = dayHash(`${barberId}-${date}`);
  let i = 0;
  for (let h = 9; h < endHour; h++) {
    for (const m of [0, 30]) {
      const time = `${pad(h)}:${pad(m)}`;
      const r = ((seed >> (i % 24)) ^ (seed * (i + 3))) % 100;
      const available = (r % 100) > 38;
      slots.push({ time, available });
      i++;
    }
  }
  return slots;
}

function genReference() {
  seq++;
  const rnd = Math.random().toString(36).slice(2, 5).toUpperCase();
  return `EC-${seq.toString(36).toUpperCase()}${rnd}`;
}

function send(res, status, data) {
  res.status(status).json(data);
}

function getPath(req) {
  let p = req.path || req.url || '';
  p = p.split('?')[0];
  p = p.replace(/^\/?(api\/)?/, '');
  p = p.replace(/\/+$/, '');
  return p;
}

export default function handler(req, res) {
  const method = (req.method || 'GET').toUpperCase();
  const path = getPath(req);
  const parts = path.split('/').filter(Boolean);

  try {
    if (method === 'GET' && path === 'services') return send(res, 200, services);

    if (method === 'GET' && path === 'barbers') return send(res, 200, barbers);

    if (method === 'GET' && path === 'testimonials') return send(res, 200, testimonials);

    if (method === 'GET' && parts[0] === 'barbers' && parts[2] === 'availability') {
      const id = isNaN(+parts[1]) ? parts[1] : +parts[1];
      const barber = barbers.find(b => b.id === id);
      if (!barber) return send(res, 404, { error: 'Barbier introuvable' });
      const date = (req.query && req.query.date) || new Date().toISOString().slice(0, 10);
      const slots = generateSlots(id, date);
      return send(res, 200, { barberId: id, date, slots });
    }

    if (method === 'GET' && parts[0] === 'barbers' && parts.length === 2) {
      const id = isNaN(+parts[1]) ? parts[1] : +parts[1];
      const barber = barbers.find(b => b.id === id);
      if (!barber) return send(res, 404, { error: 'Barbier introuvable' });
      return send(res, 200, barber);
    }

    if (method === 'GET' && parts[0] === 'services' && parts.length === 2) {
      const id = isNaN(+parts[1]) ? parts[1] : +parts[1];
      const svc = services.find(s => s.id === id);
      if (!svc) return send(res, 404, { error: 'Prestation introuvable' });
      return send(res, 200, svc);
    }

    if (method === 'POST' && path === 'bookings') {
      const body = req.body || {};
      const { serviceIds = [], barberId, date, slot, client = {} } = body;
      if (!serviceIds.length || !date || !slot || !client.name) {
        return send(res, 400, { error: 'Données de réservation incomplètes' });
      }
      const selServices = services.filter(s => serviceIds.includes(s.id));
      const price = selServices.reduce((a, s) => a + (s.price || 0), 0);
      const duration = selServices.reduce((a, s) => a + (s.duration || 0), 0);
      let barber = null;
      if (barberId === 'any') barber = barbers[0];
      else barber = barbers.find(b => b.id === barberId) || null;

      const ref = genReference();
      const record = {
        id: ref,
        confirmation: ref,
        reference: ref,
        serviceIds,
        barberId,
        date,
        slot,
        client,
        total: price,
        duration,
        services: selServices,
        barber,
        createdAt: new Date().toISOString(),
        snapshot: {
          services: selServices,
          barber,
          totals: { price, dur: duration },
          confirmation: ref
        }
      };
      bookings.set(ref, record);
      return send(res, 201, record);
    }

    if (method === 'GET' && parts[0] === 'bookings' && parts.length === 2) {
      const id = parts[1];
      const record = bookings.get(id);
      if (!record) return send(res, 404, { error: 'Réservation introuvable' });
      return send(res, 200, record);
    }

    return send(res, 404, { error: 'Route introuvable', path });
  } catch (e) {
    return send(res, 500, { error: 'Erreur serveur', message: e.message });
  }
}
