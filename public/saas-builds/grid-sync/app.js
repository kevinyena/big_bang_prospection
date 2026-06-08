'use strict';

const app = document.getElementById('app');
const nav = document.getElementById('nav');
const burger = document.getElementById('burger');

const state = {
  barbers: null,
  services: null,
  booking: { barber: null, services: [], date: null, time: null, customer: {} },
};

const euro = n => Number(n).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0 });
const fmtDur = m => { const h = Math.floor(m / 60), mn = m % 60; return h ? `${h}h${mn ? String(mn).padStart(2, '0') : ''}` : `${mn} min`; };
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const qs = (s, r = document) => r.querySelector(s);
const qsa = (s, r = document) => [...r.querySelectorAll(s)];

async function api(path, opts) {
  const res = await fetch('api/' + path, opts);
  if (!res.ok) throw new Error('API ' + res.status);
  return res.json();
}
async function getBarbers() { if (!state.barbers) state.barbers = await api('barbers'); return state.barbers; }
async function getServices() { if (!state.services) state.services = await api('services'); return state.services; }

const loader = () => `<div class="loader"><div class="spin"></div></div>`;

/* ---------- ROUTER ---------- */
const routes = {
  '/': renderLanding,
  '/services': renderServicesPage,
  '/barbers': renderBarbersPage,
  '/booking': renderBooking,
  '/booking/confirmation': renderConfirmation,
};

function parseHash() {
  let h = location.hash.replace(/^#/, '') || '/';
  if (h.startsWith('/barbers/')) return { route: '/barber-detail', param: h.split('/')[2] };
  return { route: h, param: null };
}

async function router() {
  const { route, param } = parseHash();
  window.scrollTo(0, 0);
  qsa('.nav__links a').forEach(a => a.classList.toggle('active', a.getAttribute('href') === '#' + route));
  app.innerHTML = loader();
  try {
    if (route === '/barber-detail') { await renderBarberDetail(param); }
    else { await (routes[route] || renderLanding)(); }
  } catch (e) {
    app.innerHTML = `<div class="phead"><h1>Une erreur est survenue</h1><p>${esc(e.message)}</p></div>`;
  }
  initReveal();
}

window.addEventListener('hashchange', router);
window.addEventListener('load', router);
window.addEventListener('scroll', () => nav.classList.toggle('scrolled', scrollY > 30));
burger.addEventListener('click', () => qs('.nav__links').classList.toggle('open'));
document.addEventListener('click', e => {
  const link = e.target.closest('[data-link]');
  if (link) qs('.nav__links').classList.remove('open');
  const sc = e.target.closest('.js-scroll');
  if (sc) {
    e.preventDefault();
    if (location.hash !== '#/' && location.hash !== '') { location.hash = '/'; setTimeout(() => qs('#contact')?.scrollIntoView({ behavior: 'smooth' }), 400); }
    else qs('#contact')?.scrollIntoView({ behavior: 'smooth' });
  }
});

function initReveal() {
  const io = new IntersectionObserver(es => es.forEach(en => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } }), { threshold: .12 });
  qsa('.reveal').forEach(el => io.observe(el));
}

const ICONS = ['fa-scissors', 'fa-razor', 'fa-spray-can-sparkles', 'fa-soap', 'fa-wand-magic-sparkles', 'fa-mug-hot', 'fa-comb', 'fa-bottle-droplet'];
const icoFor = i => ICONS[i % ICONS.length];

/* ---------- LANDING ---------- */
async function renderLanding() {
  const [barbers, services] = await Promise.all([getBarbers(), getServices()]);
  const feat = services.slice(0, 3);
  const team = barbers.slice(0, 3);
  app.innerHTML = `
  <section class="hero">
    <div class="hero__bg"><img src="https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=1600&q=80" alt=""></div>
    <div class="wrap hero__inner">
      <div class="hero__copy">
        <span class="eyebrow">Barber & Grooming Studio · Paris 11e</span>
        <h1>L'art du <em>grooming</em>,<br>signé GridSync.</h1>
        <p>Un studio où le geste précis du barbier rencontre une expérience client soignée. Réservez votre rituel en quelques secondes.</p>
        <div class="hero__cta">
          <a href="#/booking" class="btn btn--gold btn--lg" data-link><i class="fa-solid fa-calendar-check"></i> Réserver maintenant</a>
          <a href="#/services" class="btn btn--ghost btn--lg" data-link>Nos prestations</a>
        </div>
        <div class="hero__stats">
          <div class="hero__stat"><b>12k+</b><span>Clients fidèles</span></div>
          <div class="hero__stat"><b>4.9★</b><span>Note moyenne</span></div>
          <div class="hero__stat"><b>${barbers.length}</b><span>Barbers experts</span></div>
        </div>
      </div>
      <div class="hero__card">
        <h4>Réservation express</h4>
        <p class="sub">Les prestations signature du studio</p>
        ${feat.map((s, i) => `<div class="row"><div class="ic"><i class="fa-solid ${icoFor(i)}"></i></div><div><b>${esc(s.name)}</b><span>${fmtDur(s.durationMin)}</span></div><div class="price">${euro(s.price)}</div></div>`).join('')}
        <a href="#/booking" class="btn btn--gold btn--block" data-link style="margin-top:22px">Choisir un créneau</a>
      </div>
    </div>
  </section>

  <div class="marquee"><div class="marquee__track">${Array(2).fill('<span>Coupe homme</span><span>Taille de barbe</span><span>Rasage traditionnel</span><span>Soins du visage</span><span>Coloration</span>').join('')}</div></div>

  <section class="section section--cream">
    <div class="wrap">
      <div class="section__head center reveal"><span class="eyebrow">Le savoir-faire</span><h2>Des prestations pensées comme des rituels</h2><p>Chaque service est exécuté avec des produits premium et une attention au détail qui fait notre réputation.</p></div>
      <div class="grid grid--3">
        ${feat.map((s, i) => `<div class="scard reveal" onclick="location.hash='/services'"><div class="scard__ic"><i class="fa-solid ${icoFor(i)}"></i></div><h3>${esc(s.name)}</h3><p>${esc(s.description || '')}</p><div class="scard__foot"><span class="scard__price">${euro(s.price)}</span><span class="scard__dur"><i class="fa-regular fa-clock"></i>${fmtDur(s.durationMin)}</span></div></div>`).join('')}
      </div>
      <div style="text-align:center;margin-top:46px" class="reveal"><a href="#/services" class="btn btn--dark btn--lg" data-link>Voir tout le catalogue <i class="fa-solid fa-arrow-right"></i></a></div>
    </div>
  </section>

  <section class="section">
    <div class="wrap">
      <div class="section__head reveal"><span class="eyebrow">L'équipe</span><h2>Des mains expertes derrière chaque coupe</h2><p>Une équipe de barbers passionnés, chacun avec sa signature et sa spécialité.</p></div>
      <div class="grid grid--3">
        ${team.map(b => barberCard(b)).join('')}
      </div>
      <div style="text-align:center;margin-top:46px" class="reveal"><a href="#/barbers" class="btn btn--ghost btn--lg" data-link>Rencontrer toute l'équipe</a></div>
    </div>
  </section>

  <section class="section" style="padding-top:0">
    <div class="wrap">
      <div class="section__head center reveal"><span class="eyebrow">Le studio</span><h2>L'ambiance en images</h2></div>
      <div class="gallery">
        <div class="gallery__item wide reveal"><img src="https://images.unsplash.com/photo-1585747860715-2ba37e788b70?auto=format&fit=crop&w=900&q=80" alt=""></div>
        <div class="gallery__item tall reveal"><img src="https://images.unsplash.com/photo-1599351431202-1e0f0137899a?auto=format&fit=crop&w=700&q=80" alt=""></div>
        <div class="gallery__item reveal"><img src="https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?auto=format&fit=crop&w=600&q=80" alt=""></div>
        <div class="gallery__item reveal"><img src="https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=600&q=80" alt=""></div>
        <div class="gallery__item wide reveal"><img src="https://images.unsplash.com/photo-1622286342621-4bd786c2447c?auto=format&fit=crop&w=900&q=80" alt=""></div>
        <div class="gallery__item reveal"><img src="https://images.unsplash.com/photo-1605497788044-5a32c7078486?auto=format&fit=crop&w=600&q=80" alt=""></div>
      </div>
    </div>
  </section>

  <section class="section section--cream">
    <div class="wrap">
      <div class="section__head center reveal"><span class="eyebrow">Témoignages</span><h2>Ce que disent nos clients</h2></div>
      <div class="grid grid--3">
        ${testimonials().map(t => `<div class="tcard reveal" style="background:#fff;border-color:rgba(0,0,0,.06)"><div class="stars">${'★'.repeat(5)}</div><p class="tcard__q" style="color:var(--ink)">"${esc(t.q)}"</p><div class="tcard__by"><img src="${t.img}" alt=""><div><b style="color:var(--ink)">${esc(t.name)}</b><span style="color:var(--mut-d)">${esc(t.role)}</span></div></div></div>`).join('')}
      </div>
    </div>
  </section>

  <section class="section" style="padding:90px 0">
    <div class="ctaband reveal">
      <span class="eyebrow" style="position:relative">Prêt ?</span>
      <h2>Votre prochain rendez-vous vous attend</h2>
      <p>Choisissez votre barber, vos prestations et votre créneau en moins de deux minutes.</p>
      <a href="#/booking" class="btn btn--gold btn--lg" data-link><i class="fa-solid fa-calendar-check"></i> Réserver mon créneau</a>
    </div>
  </section>

  <section class="section section--cream" id="contact">
    <div class="wrap">
      <div class="contact">
        <div class="contact__info reveal">
          <span class="eyebrow">Contact</span>
          <h2 style="font-size:clamp(2rem,4vw,3rem);margin:16px 0 28px">Une question ? Écrivez-nous.</h2>
          <div class="item"><div class="ic"><i class="fa-solid fa-location-dot"></i></div><div><b style="color:var(--ink)">Adresse</b><p>14 rue des Artisans, 75011 Paris</p></div></div>
          <div class="item"><div class="ic"><i class="fa-solid fa-phone"></i></div><div><b style="color:var(--ink)">Téléphone</b><p>01 84 25 60 12</p></div></div>
          <div class="item"><div class="ic"><i class="fa-regular fa-clock"></i></div><div><b style="color:var(--ink)">Horaires</b><p>Lun–Sam · 9h00 – 20h00</p></div></div>
        </div>
        <form class="form reveal" id="contactForm">
          <div class="field"><label>Nom complet</label><input class="input" name="name" placeholder="Jean Dupont" required></div>
          <div class="field"><label>Email</label><input class="input" type="email" name="email" placeholder="jean@email.com" required></div>
          <div class="field"><label>Message</label><textarea class="input" name="message" placeholder="Votre message..." required></textarea></div>
          <button class="btn btn--dark btn--block btn--lg" type="submit">Envoyer le message</button>
          <p id="contactMsg" style="margin-top:14px;font-size:.85rem;color:#5fcf8a;display:none"></p>
        </form>
      </div>
    </div>
  </section>`;

  qs('#contactForm').addEventListener('submit', async e => {
    e.preventDefault();
    const f = e.target, btn = f.querySelector('button');
    const data = Object.fromEntries(new FormData(f));
    btn.disabled = true; btn.textContent = 'Envoi...';
    try { await api('contact', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }); } catch (_) {}
    const m = qs('#contactMsg'); m.style.display = 'block'; m.textContent = '✓ Message envoyé, nous vous répondrons rapidement.';
    f.reset(); btn.disabled = false; btn.textContent = 'Envoyer le message';
  });
}

function barberCard(b) {
  return `<div class="bcard reveal" onclick="location.hash='/barbers/${b.id}'">
    <div class="bcard__img"><span class="bcard__rate"><i class="fa-solid fa-star"></i>${b.rating}</span><img src="${esc(b.photo)}" alt="${esc(b.name)}"></div>
    <div class="bcard__body"><h3>${esc(b.name)}</h3><div class="spec">${esc((b.specialties || [])[0] || '')}</div><p>${esc((b.bio || '').slice(0, 90))}${(b.bio || '').length > 90 ? '…' : ''}</p>
    <div class="tags">${(b.specialties || []).slice(0, 3).map(s => `<span class="tag">${esc(s)}</span>`).join('')}</div></div></div>`;
}

function testimonials() {
  return [
    { q: "Le meilleur fade que j'ai jamais eu. L'ambiance est incroyable et le café offert un vrai plus.", name: 'Thomas R.', role: 'Client depuis 2 ans', img: 'https://i.pravatar.cc/100?img=12' },
    { q: "Un rasage traditionnel à la serviette chaude qui vaut le déplacement. Service impeccable.", name: 'Karim B.', role: 'Client régulier', img: 'https://i.pravatar.cc/100?img=33' },
    { q: "Réservation en ligne ultra simple, accueil chaleureux et résultat parfait. Je recommande.", name: 'Lucas M.', role: 'Nouveau client', img: 'https://i.pravatar.cc/100?img=68' },
  ];
}

/* ---------- SERVICES PAGE ---------- */
async function renderServicesPage() {
  const services = await getServices();
  const cats = {};
  services.forEach(s => { (cats[s.category || 'Prestations'] ||= []).push(s); });
  app.innerHTML = `
  <section class="phead"><div class="wrap"><span class="eyebrow" style="justify-content:center">Le catalogue</span><h1>Nos prestations</h1><p>Des soins capillaires et de barbe exécutés dans les règles de l'art, avec des produits d'exception.</p></div></section>
  <section class="section"><div class="wrap">
    ${Object.entries(cats).map(([cat, list]) => `
      <div class="cat reveal">
        <div class="cat__title"><h3>${esc(cat)}</h3><span></span><b>${list.length} prestations</b></div>
        ${list.map(s => `<div class="srow"><div class="srow__main"><h4>${esc(s.name)}</h4><p>${esc(s.description || '')}</p></div><div class="srow__dur"><i class="fa-regular fa-clock"></i>${fmtDur(s.durationMin)}</div><div class="srow__price">${euro(s.price)}</div></div>`).join('')}
      </div>`).join('')}
    <div class="ctaband reveal" style="margin:60px 0 0"><h2>Une envie de changement ?</h2><p>Composez votre rendez-vous sur mesure dès maintenant.</p><a href="#/booking" class="btn btn--gold btn--lg" data-link>Réserver</a></div>
  </div></section>`;
}

/* ---------- BARBERS PAGE ---------- */
async function renderBarbersPage() {
  const barbers = await getBarbers();
  app.innerHTML = `
  <section class="phead"><div class="wrap"><span class="eyebrow" style="justify-content:center">Notre équipe</span><h1>Les artisans du studio</h1><p>Chaque barber porte une signature unique. Découvrez celui qui correspond à votre style.</p></div></section>
  <section class="section"><div class="wrap"><div class="grid grid--3">${barbers.map(b => barberCard(b)).join('')}</div></div></section>`;
}

/* ---------- BARBER DETAIL ---------- */
async function renderBarberDetail(id) {
  let b;
  try { b = await api('barbers/' + id); } catch (_) { b = (await getBarbers()).find(x => String(x.id) === String(id)); }
  if (!b) { app.innerHTML = `<div class="phead"><h1>Barber introuvable</h1></div>`; return; }
  app.innerHTML = `
  <section class="phead" style="padding-bottom:50px"></section>
  <section class="section" style="padding-top:40px"><div class="wrap">
    <div class="contact" style="align-items:start">
      <div class="bcard reveal" style="cursor:default;max-width:420px"><div class="bcard__img" style="aspect-ratio:4/5"><span class="bcard__rate"><i class="fa-solid fa-star"></i>${b.rating}</span><img src="${esc(b.photo)}" alt=""></div></div>
      <div class="reveal">
        <span class="eyebrow">${esc((b.specialties || [])[0] || 'Barber')}</span>
        <h1 style="font-size:clamp(2.4rem,5vw,3.6rem);margin:16px 0">${esc(b.name)}</h1>
        <p style="color:var(--mut);font-size:1.05rem;margin-bottom:26px">${esc(b.bio || '')}</p>
        <div class="tags" style="margin-bottom:30px">${(b.specialties || []).map(s => `<span class="tag">${esc(s)}</span>`).join('')}</div>
        ${b.workingHours ? `<p style="color:var(--mut);margin-bottom:26px"><i class="fa-regular fa-clock" style="color:var(--gold);margin-right:.5rem"></i>${esc(typeof b.workingHours === 'string' ? b.workingHours : 'Lun–Sam · 9h–20h')}</p>` : ''}
        <a href="#/booking" class="btn btn--gold btn--lg" data-link onclick="window.__preBarber=${JSON.stringify(b.id)}"><i class="fa-solid fa-calendar-check"></i> Réserver avec ${esc(b.name.split(' ')[0])}</a>
      </div>
    </div>
  </div></section>`;
  qs('.btn--gold[data-link]').addEventListener('click', () => { state.booking.barber = b; state.bookingStep = 2; });
}

/* ---------- BOOKING ---------- */
function bookingTotals() {
  const total = state.booking.services.reduce((s, x) => s + x.price, 0);
  const dur = state.booking.services.reduce((s, x) => s + x.durationMin, 0);
  return { total, dur };
}

let bookStep = 1;
let calMonth = new Date(); calMonth.setDate(1);
let availCache = {};

async function renderBooking() {
  if (state.bookingStep) { bookStep = state.bookingStep; state.bookingStep = null; }
  else if (!state.booking.barber) bookStep = 1;
  await Promise.all([getBarbers(), getServices()]);
  app.innerHTML = `
  <section class="booking"><div class="wrap">
    <div class="stepper" id="stepper"></div>
    <div class="book__layout">
      <div class="book__main" id="bookMain"></div>
      <aside id="bookSummary"></aside>
    </div>
  </div></section>`;
  drawStep();
}

function drawStepper() {
  const steps = [['Barber', 'Votre artisan'], ['Prestations', 'Vos services'], ['Date & Heure', 'Votre créneau'], ['Paiement', 'Finalisation']];
  qs('#stepper').innerHTML = steps.map((s, i) => {
    const n = i + 1, cls = n === bookStep ? 'active' : n < bookStep ? 'done' : '';
    return `<div class="step ${cls}"><div class="step__num">${n < bookStep ? '<i class="fa-solid fa-check"></i>' : n}</div><div class="step__lbl"><b>${s[0]}</b><span>${s[1]}</span></div></div>${i < steps.length - 1 ? '<div class="step__line"></div>' : ''}`;
  }).join('');
}

function drawSummary() {
  const { total, dur } = bookingTotals();
  const b = state.booking;
  qs('#bookSummary').innerHTML = `<div class="summary">
    <h3>Récapitulatif</h3><span>Votre rendez-vous en cours</span>
    ${b.barber ? `<div class="summary__barber"><img src="${esc(b.barber.photo)}" alt=""><div><b>${esc(b.barber.name)}</b><em>${esc((b.barber.specialties || [])[0] || '')}</em></div></div>` : `<div class="summary__line empty">Aucun barber sélectionné</div>`}
    ${b.services.length ? b.services.map(s => `<div class="summary__line"><span>${esc(s.name)}</span><b>${euro(s.price)}</b></div>`).join('') : `<div class="summary__line empty">Aucune prestation</div>`}
    ${b.date ? `<div class="summary__line"><span>Créneau</span><b>${fmtDate(b.date)}${b.time ? ' · ' + b.time : ''}</b></div>` : ''}
    <div class="summary__dur">${dur ? 'Durée totale · ' + fmtDur(dur) : ''}</div>
    <div class="summary__total"><span>Total</span><b>${euro(total)}</b></div>
  </div>`;
}

function fmtDate(d) {
  const dt = new Date(d + 'T00:00:00');
  return dt.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
}

function drawStep() {
  drawStepper(); drawSummary();
  const m = qs('#bookMain'); m.classList.remove('fade-step'); void m.offsetWidth; m.classList.add('fade-step');
  if (bookStep === 1) stepBarber(m);
  else if (bookStep === 2) stepServices(m);
  else if (bookStep === 3) stepDate(m);
  else if (bookStep === 4) stepPayment(m);
}

function navButtons(canNext, nextLabel) {
  return `<div class="book__nav">
    ${bookStep > 1 ? `<button class="btn btn--ghost" id="prevBtn"><i class="fa-solid fa-arrow-left"></i> Retour</button>` : '<span></span>'}
    <button class="btn btn--gold" id="nextBtn" ${canNext ? '' : 'disabled style="opacity:.4;cursor:not-allowed"'}>${nextLabel || 'Continuer'} <i class="fa-solid fa-arrow-right"></i></button>
  </div>`;
}
function bindNav() {
  qs('#prevBtn')?.addEventListener('click', () => { bookStep--; drawStep(); window.scrollTo({ top: 0, behavior: 'smooth' }); });
}

function stepBarber(m) {
  m.innerHTML = `<div class="book__step"><h2>Choisissez votre barber</h2><p>Sélectionnez l'artisan qui réalisera votre prestation.</p>
    <div class="pick">${state.barbers.map(b => `<div class="pick__card ${state.booking.barber?.id === b.id ? 'sel' : ''}" data-id="${b.id}">
      <img src="${esc(b.photo)}" alt=""><div class="b"><h4>${esc(b.name)}</h4><div class="spec">${esc((b.specialties || [])[0] || '')}</div>
      <div class="meta"><span><i class="fa-solid fa-star"></i> ${b.rating}</span><span>Disponible</span></div></div></div>`).join('')}</div>
    ${navButtons(!!state.booking.barber)}</div>`;
  qsa('.pick__card', m).forEach(c => c.addEventListener('click', () => {
    state.booking.barber = state.barbers.find(b => String(b.id) === c.dataset.id);
    state.booking.date = null; state.booking.time = null; availCache = {};
    drawStep();
  }));
  bindNav();
  qs('#nextBtn').addEventListener('click', () => { if (state.booking.barber) { bookStep = 2; drawStep(); } });
}

function stepServices(m) {
  const cats = {};
  state.services.forEach(s => { (cats[s.category || 'Prestations'] ||= []).push(s); });
  const has = id => state.booking.services.some(x => x.id === id);
  m.innerHTML = `<div class="book__step"><h2>Sélectionnez vos prestations</h2><p>Cumulez plusieurs services, le total se met à jour automatiquement.</p>
    ${Object.entries(cats).map(([cat, list]) => `<div class="cat" style="margin-bottom:28px"><div class="cat__title"><h3 style="font-size:1.3rem">${esc(cat)}</h3><span></span></div>
      ${list.map(s => `<div class="checkrow ${has(s.id) ? 'sel' : ''}" data-id="${s.id}"><div class="checkbox"><i class="fa-solid fa-check"></i></div>
        <div class="checkrow__main"><b>${esc(s.name)}</b><span>${esc(s.description || '')}</span></div>
        <div class="checkrow__dur"><i class="fa-regular fa-clock" style="color:var(--gold)"></i> ${fmtDur(s.durationMin)}</div>
        <div class="checkrow__price">${euro(s.price)}</div></div>`).join('')}</div>`).join('')}
    ${navButtons(state.booking.services.length > 0)}</div>`;
  qsa('.checkrow', m).forEach(r => r.addEventListener('click', () => {
    const s = state.services.find(x => String(x.id) === r.dataset.id);
    const i = state.booking.services.findIndex(x => x.id === s.id);
    if (i >= 0) state.booking.services.splice(i, 1); else state.booking.services.push(s);
    r.classList.toggle('sel');
    drawSummary();
    qs('#nextBtn').disabled = state.booking.services.length === 0;
    qs('#nextBtn').style.cssText = state.booking.services.length ? '' : 'opacity:.4;cursor:not-allowed';
  }));
  bindNav();
  qs('#nextBtn').addEventListener('click', () => { if (state.booking.services.length) { bookStep = 3; drawStep(); } });
}

async function stepDate(m) {
  m.innerHTML = `<div class="book__step"><h2>Date & Heure</h2><p>Choisissez un jour disponible puis un créneau horaire.</p>
    <div id="calBox"></div><div id="slotsBox"></div>${navButtons(!!(state.booking.date && state.booking.time))}</div>`;
  drawCalendar();
  bindNav();
  qs('#nextBtn').addEventListener('click', () => { if (state.booking.date && state.booking.time) { bookStep = 4; drawStep(); } });
  if (state.booking.date) loadSlots(state.booking.date);
}

function drawCalendar() {
  const dows = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
  const y = calMonth.getFullYear(), mo = calMonth.getMonth();
  const first = new Date(y, mo, 1);
  let startDow = (first.getDay() + 6) % 7;
  const days = new Date(y, mo + 1, 0).getDate();
  const today = new Date(); today.setHours(0, 0, 0, 0);
  let cells = '';
  for (let i = 0; i < startDow; i++) cells += `<div class="cal__day empty"></div>`;
  for (let d = 1; d <= days; d++) {
    const dt = new Date(y, mo, d);
    const iso = `${y}-${String(mo + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const off = dt < today || dt.getDay() === 0;
    const cls = [off ? 'off' : '', dt.getTime() === today.getTime() ? 'today' : '', state.booking.date === iso ? 'sel' : ''].join(' ');
    cells += `<div class="cal__day ${cls}" ${off ? '' : `data-date="${iso}"`}>${d}</div>`;
  }
  qs('#calBox').innerHTML = `<div class="cal"><div class="cal__head"><b>${calMonth.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}</b>
    <div class="cal__nav"><button id="prevM"><i class="fa-solid fa-chevron-left"></i></button><button id="nextM"><i class="fa-solid fa-chevron-right"></i></button></div></div>
    <div class="cal__grid">${dows.map(d => `<div class="cal__dow">${d}</div>`).join('')}${cells}</div></div>`;
  qs('#prevM').addEventListener('click', () => { calMonth.setMonth(calMonth.getMonth() - 1); drawCalendar(); });
  qs('#nextM').addEventListener('click', () => { calMonth.setMonth(calMonth.getMonth() + 1); drawCalendar(); });
  qsa('.cal__day[data-date]').forEach(c => c.addEventListener('click', () => {
    state.booking.date = c.dataset.date; state.booking.time = null;
    drawCalendar(); drawSummary(); loadSlots(c.dataset.date);
    qs('#nextBtn').disabled = true; qs('#nextBtn').style.cssText = 'opacity:.4;cursor:not-allowed';
  }));
}

async function loadSlots(date) {
  const box = qs('#slotsBox'); if (!box) return;
  box.innerHTML = loader();
  const key = state.booking.barber.id + '|' + date;
  let slots = availCache[key];
  if (!slots) {
    try {
      const r = await api(`availability?barberId=${encodeURIComponent(state.booking.barber.id)}&date=${date}`);
      slots = Array.isArray(r) ? r : (r.slots || []);
    } catch (_) {
      slots = ['09:00', '09:30', '10:00', '11:00', '11:30', '14:00', '14:30', '15:30', '16:00', '17:00', '18:00'].map((time, i) => ({ time, available: i % 4 !== 2 }));
    }
    slots = slots.map(s => typeof s === 'string' ? { time: s, available: true } : s);
    availCache[key] = slots;
  }
  box.innerHTML = `<h3 style="font-size:1.15rem;margin:6px 0 18px;font-family:var(--ff);font-weight:600">Créneaux du ${fmtDate(date)}</h3>
    <div class="slots">${slots.map(s => `<div class="slot ${s.available === false ? 'off' : ''} ${state.booking.time === s.time ? 'sel' : ''}" ${s.available === false ? '' : `data-time="${s.time}"`}>${s.time}</div>`).join('')}</div>`;
  qsa('.slot[data-time]', box).forEach(el => el.addEventListener('click', () => {
    state.booking.time = el.dataset.time;
    qsa('.slot', box).forEach(x => x.classList.remove('sel')); el.classList.add('sel');
    drawSummary();
    qs('#nextBtn').disabled = false; qs('#nextBtn').style.cssText = '';
  }));
}

function stepPayment(m) {
  const { total } = bookingTotals();
  const c = state.booking.customer;
  m.innerHTML = `<div class="book__step"><h2>Coordonnées & Paiement</h2><p>Renseignez vos informations puis réglez en toute sécurité (paiement simulé).</p>
    <form id="payForm">
      <div class="grid-cols-2">
        <div class="field"><label>Nom complet</label><input class="input" name="name" value="${esc(c.name || '')}" placeholder="Jean Dupont" required></div>
        <div class="field"><label>Téléphone</label><input class="input" name="phone" value="${esc(c.phone || '')}" placeholder="06 12 34 56 78" required></div>
      </div>
      <div class="field"><label>Email</label><input class="input" type="email" name="email" value="${esc(c.email || '')}" placeholder="jean@email.com" required></div>
      <div class="pay__card">
        <div class="pay__chip"></div>
        <div class="pay__num" id="cardPreview">•••• •••• •••• ••••</div>
        <div class="pay__row"><div><span>Titulaire</span><b id="holderPreview">VOTRE NOM</b></div><div><span>Expire</span><b id="expPreview">MM/AA</b></div></div>
      </div>
      <div class="field"><label>Numéro de carte</label><input class="input" name="card" inputmode="numeric" maxlength="19" placeholder="4242 4242 4242 4242" required></div>
      <div class="grid-cols-2">
        <div class="field"><label>Expiration</label><input class="input" name="exp" maxlength="5" placeholder="MM/AA" required></div>
        <div class="field"><label>CVC</label><input class="input" name="cvc" inputmode="numeric" maxlength="4" placeholder="123" required></div>
      </div>
      <button class="btn btn--gold btn--block btn--lg" type="submit" id="payBtn"><i class="fa-solid fa-lock"></i> Payer ${euro(total)}</button>
      <p id="payErr" style="margin-top:12px;color:#e07a7a;font-size:.85rem;display:none"></p>
    </form>
    <div class="book__nav" style="margin-top:24px"><button class="btn btn--ghost" id="prevBtn"><i class="fa-solid fa-arrow-left"></i> Retour</button><span></span></div>
  </div>`;
  bindNav();
  const f = qs('#payForm');
  const cardInput = f.card, expInput = f.exp;
  cardInput.addEventListener('input', () => {
    let v = cardInput.value.replace(/\D/g, '').slice(0, 16);
    cardInput.value = v.replace(/(.{4})/g, '$1 ').trim();
    qs('#cardPreview').textContent = (v.padEnd(16, '•').match(/.{1,4}/g) || []).join(' ');
  });
  f.name.addEventListener('input', () => qs('#holderPreview').textContent = (f.name.value || 'VOTRE NOM').toUpperCase());
  expInput.addEventListener('input', () => {
    let v = expInput.value.replace(/\D/g, '').slice(0, 4);
    if (v.length >= 3) v = v.slice(0, 2) + '/' + v.slice(2);
    expInput.value = v; qs('#expPreview').textContent = v || 'MM/AA';
  });
  f.addEventListener('submit', async e => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(f));
    if (data.card.replace(/\s/g, '').length < 16) return showErr('Numéro de carte invalide.');
    state.booking.customer = { name: data.name, email: data.email, phone: data.phone };
    const btn = qs('#payBtn'); btn.disabled = true; btn.innerHTML = '<div class="spin" style="width:20px;height:20px;border-width:2px"></div> Traitement...';
    try {
      const payload = {
        barberId: state.booking.barber.id,
        serviceIds: state.booking.services.map(s => s.id),
        slot: { date: state.booking.date, time: state.booking.time },
        customer: state.booking.customer,
        total: bookingTotals().total,
      };
      const booking = await api('bookings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const ref = booking.reference || booking.id;
      const pay = await api('payments/simulate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reference: ref, amount: payload.total, card: data.card }) });
      if (pay.status && pay.status !== 'success' && pay.status !== 'paid' && pay.status !== 'ok') throw new Error('Paiement refusé.');
      state.lastBooking = { ...payload, reference: ref || pay.reference, barber: state.booking.barber, services: state.booking.services, status: 'confirmed', paymentRef: pay.reference || pay.transactionId };
      location.hash = '/booking/confirmation';
    } catch (err) {
      btn.disabled = false; btn.innerHTML = `<i class="fa-solid fa-lock"></i> Payer ${euro(bookingTotals().total)}`;
      showErr(err.message || 'Une erreur est survenue.');
    }
  });
  function showErr(t) { const p = qs('#payErr'); p.style.display = 'block'; p.textContent = t; }
}

/* ---------- CONFIRMATION ---------- */
async function renderConfirmation() {
  let bk = state.lastBooking;
  if (!bk) {
    app.innerHTML = `<section class="booking"><div class="wrap confirm"><div class="confirm__check" style="background:rgba(255,255,255,.05)"><i class="fa-regular fa-circle-question"></i></div><h1>Aucune réservation</h1><p>Commencez par réserver un créneau.</p><a href="#/booking" class="btn btn--gold btn--lg" data-link>Réserver</a></div></section>`;
    return;
  }
  const { total, dur } = { total: bk.total, dur: bk.services.reduce((s, x) => s + x.durationMin, 0) };
  app.innerHTML = `<section class="booking"><div class="wrap"><div class="confirm">
    <div class="confirm__check"><i class="fa-solid fa-check"></i></div>
    <h1>Réservation confirmée !</h1>
    <p>Merci ${esc(bk.customer.name.split(' ')[0])}, votre rendez-vous est réservé. Un email de confirmation vous a été envoyé.</p>
    <div class="ticket">
      <div class="ticket__ref"><div><span>Référence</span><b>${esc(bk.reference)}</b></div><span class="badge"><i class="fa-solid fa-circle-check"></i> Payé</span></div>
      <div class="ticket__row"><span>Barber</span><b>${esc(bk.barber.name)}</b></div>
      ${bk.services.map(s => `<div class="ticket__row"><span>${esc(s.name)}</span><b>${euro(s.price)}</b></div>`).join('')}
      <div class="ticket__row"><span>Date</span><b>${fmtDate(bk.slot.date)} · ${esc(bk.slot.time)}</b></div>
      <div class="ticket__row"><span>Durée estimée</span><b>${fmtDur(dur)}</b></div>
      <div class="ticket__row" style="border-top:1px dashed var(--glass-b);margin-top:14px;padding-top:18px"><span>Total payé</span><b style="font-family:var(--ff-d);font-size:1.3rem;color:var(--gold)">${euro(total)}</b></div>
    </div>
    <div style="display:flex;gap:14px;justify-content:center;flex-wrap:wrap">
      <a href="#/" class="btn btn--ghost btn--lg" data-link>Retour à l'accueil</a>
      <a href="#/booking" class="btn btn--gold btn--lg" data-link id="newBk">Nouvelle réservation</a>
    </div>
  </div></div></section>`;
  qs('#newBk').addEventListener('click', () => { state.booking = { barber: null, services: [], date: null, time: null, customer: {} }; state.lastBooking = null; bookStep = 1; });
}
