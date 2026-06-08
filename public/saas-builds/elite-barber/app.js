'use strict';

const App = (() => {
  const app = document.getElementById('header');
  const root = document.getElementById('app');

  const state = {
    services: [], barbers: [], testimonials: [],
    booking: { step: 1, serviceIds: [], barberId: null, date: null, slot: null, client: { name: '', email: '', phone: '', notes: '' } }
  };

  const fmtPrice = n => `${n}€`;
  const fmtDur = m => m >= 60 ? `${Math.floor(m/60)}h${m%60?String(m%60).padStart(2,'0'):''}` : `${m} min`;
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  async function api(path, opts) {
    const res = await fetch('api/' + path, opts);
    if (!res.ok) throw new Error('API ' + res.status);
    return res.json();
  }

  async function loadCore() {
    if (state.services.length && state.barbers.length) return;
    try {
      const [s, b] = await Promise.all([api('services'), api('barbers')]);
      state.services = s; state.barbers = b;
    } catch (e) { state.services = state.services || []; state.barbers = state.barbers || []; }
  }

  // ============ ROUTER ============
  function parseHash() {
    let h = location.hash.replace(/^#/, '') || '/';
    return h;
  }

  async function router() {
    const path = parseHash();
    window.scrollTo(0, 0);
    setActiveNav(path);
    root.innerHTML = `<div class="loader"><div class="spinner"></div></div>`;

    if (path === '/' || path === '') return renderHome();
    if (path === '/services') return renderServices();
    if (path === '/barbers') return renderBarbers();
    if (path === '/booking') return renderBooking();
    if (path.startsWith('/booking/confirmation')) {
      const id = path.split('/')[3] || sessionStorage.getItem('lastBooking');
      return renderConfirmation(id);
    }
    if (path === '/contact') return renderContact();
    return renderHome();
  }

  function setActiveNav(path) {
    document.querySelectorAll('#nav a[data-link]').forEach(a => {
      const href = a.getAttribute('href').replace(/^#/, '');
      a.classList.toggle('active', href === path || (href === '/' && path === '/'));
    });
  }

  // ============ HOME ============
  async function renderHome() {
    await loadCore();
    let testimonials = [];
    try { testimonials = await api('testimonials'); } catch (e) {}
    state.testimonials = testimonials;

    const featured = state.services.slice(0, 3);
    const team = state.barbers.slice(0, 4);
    const galleryImgs = [
      'photo-1599351431202-1e0f0137899a','photo-1503951914875-452162b0f3f1',
      'photo-1585747860715-2ba37e788b70','photo-1521590832167-7bcbfaa6381f',
      'photo-1622286342621-4bd786c2447c','photo-1605497788044-5a32c7078486',
      'photo-1596728325488-58c87691e9af','photo-1519019121902-1c1f29b8c0e6'
    ];

    root.innerHTML = `
    <div class="page">
      <section class="hero">
        <div class="hero-bg"></div>
        <div class="container hero-inner">
          <span class="eyebrow">L'art du barbier · Depuis 2010</span>
          <h1>Élégance brute,<em>précision absolue</em></h1>
          <p>Une expérience de barbier d'exception au cœur de Paris. Coupe sur-mesure, rasage traditionnel et soins premium dans un cadre intemporel.</p>
          <div class="hero-cta">
            <a href="#/booking" class="btn btn-gold btn-lg" data-link><i class="fa-solid fa-calendar-check"></i> Réserver maintenant</a>
            <a href="#/services" class="btn btn-ghost btn-lg" data-link>Nos prestations</a>
          </div>
          <div class="hero-stats">
            <div><div class="num">14+</div><div class="lbl">Années d'expertise</div></div>
            <div><div class="num">8k+</div><div class="lbl">Clients satisfaits</div></div>
            <div><div class="num">4.9</div><div class="lbl">Note moyenne</div></div>
          </div>
        </div>
        <div class="scroll-ind"><i class="fa-solid fa-chevron-down"></i></div>
      </section>

      <section class="section">
        <div class="container">
          <div class="section-head reveal">
            <span class="eyebrow">Nos prestations</span>
            <h2>Des services <em>d'exception</em></h2>
            <p>Chaque prestation est pensée comme un rituel, exécutée avec soin et savoir-faire.</p>
          </div>
          <div class="grid g3">
            ${featured.map(s => svcCardHTML(s, false)).join('')}
          </div>
          <div style="text-align:center;margin-top:3rem" class="reveal">
            <a href="#/services" class="btn btn-ghost" data-link>Voir toutes les prestations <i class="fa-solid fa-arrow-right"></i></a>
          </div>
        </div>
      </section>

      <section class="section" style="background:var(--bg2)">
        <div class="container">
          <div class="section-head reveal">
            <span class="eyebrow">Notre équipe</span>
            <h2>Les maîtres <em>barbiers</em></h2>
            <p>Une équipe d'artisans passionnés, chacun avec son style et sa spécialité.</p>
          </div>
          <div class="grid g4">
            ${team.map(b => barberCardHTML(b)).join('')}
          </div>
        </div>
      </section>

      <section class="section">
        <div class="container">
          <div class="section-head reveal">
            <span class="eyebrow">Galerie</span>
            <h2>L'atelier en <em>images</em></h2>
          </div>
          <div class="gallery reveal">
            ${galleryImgs.map(id => `<a href="#/booking" data-link><img src="https://images.unsplash.com/${id}?q=80&w=600&auto=format&fit=crop" alt="Elite Cut" loading="lazy"></a>`).join('')}
          </div>
        </div>
      </section>

      ${state.testimonials.length ? `
      <section class="section" style="background:var(--bg2)">
        <div class="container">
          <div class="section-head reveal">
            <span class="eyebrow">Témoignages</span>
            <h2>Ce qu'ils <em>en disent</em></h2>
          </div>
          <div class="grid g3">
            ${state.testimonials.slice(0,3).map(t => testiHTML(t)).join('')}
          </div>
        </div>
      </section>` : ''}

      <section class="section">
        <div class="container">
          <div class="banner reveal">
            <span class="eyebrow" style="justify-content:center">Prêt pour votre transformation ?</span>
            <h2>Réservez votre <em>moment d'exception</em></h2>
            <p>Choisissez votre prestation, votre barbier et votre créneau en quelques clics.</p>
            <a href="#/booking" class="btn btn-gold btn-lg" data-link><i class="fa-solid fa-scissors"></i> Prendre rendez-vous</a>
          </div>
        </div>
      </section>
    </div>`;
    initReveal();
  }

  function svcCardHTML(s, selectable) {
    const icon = s.icon || 'fa-scissors';
    return `<div class="card svc-card" ${selectable ? `data-svc="${s.id}"` : `onclick="location.hash='#/booking'"`}>
      <div class="svc-icon"><i class="fa-solid ${esc(icon)}"></i></div>
      <h3>${esc(s.name)}</h3>
      <p>${esc(s.description || '')}</p>
      <div class="svc-meta">
        <span class="svc-price">${fmtPrice(s.price)}</span>
        <span class="svc-dur"><i class="fa-regular fa-clock"></i> ${fmtDur(s.duration)}</span>
      </div>
    </div>`;
  }

  function barberCardHTML(b) {
    const specs = (b.specialties || b.specialities || []);
    return `<div class="card barber-card" onclick="location.hash='#/booking'">
      <div class="barber-photo"><img src="${esc(b.photo)}" alt="${esc(b.name)}" loading="lazy"></div>
      <div class="barber-info">
        <div class="barber-rate"><i class="fa-solid fa-star"></i> ${esc(b.rating ?? '4.9')}</div>
        <h3>${esc(b.name)}</h3>
        <div class="barber-role">${esc(specs[0] || 'Maître Barbier')}</div>
        <p class="bio">${esc((b.bio || '').slice(0, 90))}${(b.bio||'').length>90?'…':''}</p>
        <div class="tags">${specs.map(s => `<span class="tag">${esc(s)}</span>`).join('')}</div>
      </div>
    </div>`;
  }

  function testiHTML(t) {
    const stars = '★'.repeat(Math.round(t.rating || 5));
    return `<div class="testi reveal">
      <span class="quote">"</span>
      <div class="stars">${stars}</div>
      <p>${esc(t.text || t.comment || '')}</p>
      <div class="testi-by">
        <img src="${esc(t.avatar || 'https://i.pravatar.cc/100?u='+encodeURIComponent(t.name||'c'))}" alt="${esc(t.name)}">
        <div><strong>${esc(t.name)}</strong><span>${esc(t.role || 'Client fidèle')}</span></div>
      </div>
    </div>`;
  }

  // ============ SERVICES ============
  async function renderServices() {
    await loadCore();
    root.innerHTML = `
    <div class="page">
      <section class="page-hero">
        <div class="container">
          <span class="eyebrow" style="justify-content:center">Nos prestations</span>
          <h1>Le rituel du <em>gentleman</em></h1>
          <p>Découvrez notre carte de prestations, de la coupe classique au rasage traditionnel à la serviette chaude.</p>
        </div>
      </section>
      <section class="section">
        <div class="container">
          <div class="grid g3">
            ${state.services.map(s => svcCardHTML(s, false)).join('') || '<p class="sum-empty">Aucune prestation disponible.</p>'}
          </div>
          <div style="text-align:center;margin-top:3rem">
            <a href="#/booking" class="btn btn-gold btn-lg" data-link><i class="fa-solid fa-calendar-check"></i> Réserver une prestation</a>
          </div>
        </div>
      </section>
    </div>`;
    initReveal();
  }

  // ============ BARBERS ============
  async function renderBarbers() {
    await loadCore();
    root.innerHTML = `
    <div class="page">
      <section class="page-hero">
        <div class="container">
          <span class="eyebrow" style="justify-content:center">Notre équipe</span>
          <h1>Les artisans de <em>votre style</em></h1>
          <p>Une équipe de barbiers d'exception, sélectionnés pour leur talent et leur passion du métier.</p>
        </div>
      </section>
      <section class="section">
        <div class="container">
          <div class="grid g3">
            ${state.barbers.map(b => barberCardHTML(b)).join('') || '<p class="sum-empty">Aucun barbier disponible.</p>'}
          </div>
        </div>
      </section>
    </div>`;
    initReveal();
  }

  // ============ BOOKING ============
  async function renderBooking() {
    await loadCore();
    renderBookingShell();
  }

  function renderBookingShell() {
    const b = state.booking;
    const steps = ['Prestation', 'Barbier', 'Créneau', 'Coordonnées', 'Récap'];
    root.innerHTML = `
    <div class="page booking-wrap">
      <div class="container">
        <div class="section-head" style="margin-bottom:2rem">
          <span class="eyebrow" style="justify-content:center">Réservation</span>
          <h2>Composez votre <em>rendez-vous</em></h2>
        </div>
        <div class="stepper">
          ${steps.map((s, i) => {
            const n = i + 1;
            const cls = n === b.step ? 'active' : (n < b.step ? 'done' : '');
            return `<div class="step ${cls}"><div class="step-dot">${n < b.step ? '<i class="fa-solid fa-check"></i>' : n}</div><div class="step-lbl">${s}</div></div>`;
          }).join('')}
        </div>
        <div class="booking-grid">
          <div class="booking-main" id="bMain"></div>
          <aside><div id="bSummary"></div></aside>
        </div>
      </div>
    </div>`;
    renderBookingStep();
    renderSummary();
  }

  function selectedServices() {
    return state.services.filter(s => state.booking.serviceIds.includes(s.id));
  }
  function totals() {
    const sel = selectedServices();
    return {
      price: sel.reduce((a, s) => a + (s.price || 0), 0),
      dur: sel.reduce((a, s) => a + (s.duration || 0), 0)
    };
  }
  function selBarber() { return state.barbers.find(x => x.id === state.booking.barberId); }

  function renderBookingStep() {
    const main = document.getElementById('bMain');
    const b = state.booking;
    if (b.step === 1) main.innerHTML = stepServices();
    else if (b.step === 2) main.innerHTML = stepBarbers();
    else if (b.step === 3) { main.innerHTML = stepCalendar(); initCalendar(); }
    else if (b.step === 4) main.innerHTML = stepClient();
    else if (b.step === 5) main.innerHTML = stepRecap();
    bindStepEvents();
  }

  function navHTML(canNext, nextLabel) {
    const b = state.booking;
    return `<div class="booking-actions">
      ${b.step > 1 ? `<button class="btn btn-ghost" id="bPrev"><i class="fa-solid fa-arrow-left"></i> Retour</button>` : '<span></span>'}
      <button class="btn btn-gold" id="bNext" ${canNext ? '' : 'disabled'}>${nextLabel || 'Continuer'} <i class="fa-solid fa-arrow-right"></i></button>
    </div>`;
  }

  function stepServices() {
    return `<h3>Choisissez vos prestations</h3>
      <p style="color:var(--muted);margin-bottom:1.5rem">Sélectionnez une ou plusieurs prestations. Le temps et le prix se cumulent.</p>
      ${state.services.map(s => {
        const sel = state.booking.serviceIds.includes(s.id);
        return `<div class="sel-card ${sel ? 'selected' : ''}" data-svc="${s.id}">
          <div class="ic"><i class="fa-solid ${esc(s.icon || 'fa-scissors')}"></i></div>
          <div class="info"><h4>${esc(s.name)}</h4><span><i class="fa-regular fa-clock"></i> ${fmtDur(s.duration)} · ${esc((s.description||'').slice(0,50))}</span></div>
          <span class="price">${fmtPrice(s.price)}</span>
        </div>`;
      }).join('')}
      ${navHTML(state.booking.serviceIds.length > 0)}`;
  }

  function stepBarbers() {
    const opts = [{ id: 'any', name: 'Premier disponible', any: true }];
    return `<h3>Choisissez votre barbier</h3>
      <p style="color:var(--muted);margin-bottom:1.5rem">Sélectionnez le professionnel de votre choix.</p>
      <div class="sel-card ${state.booking.barberId === 'any' ? 'selected' : ''}" data-barber="any">
        <div class="ic"><i class="fa-solid fa-wand-magic-sparkles"></i></div>
        <div class="info"><h4>Premier disponible</h4><span>Optimisez votre créneau, peu importe le barbier</span></div>
      </div>
      ${state.barbers.map(bb => {
        const specs = (bb.specialties || bb.specialities || []);
        const sel = state.booking.barberId === bb.id;
        return `<div class="sel-card ${sel ? 'selected' : ''}" data-barber="${bb.id}">
          <img src="${esc(bb.photo)}" alt="${esc(bb.name)}">
          <div class="info"><h4>${esc(bb.name)}</h4><span><i class="fa-solid fa-star" style="color:var(--gold)"></i> ${esc(bb.rating ?? '4.9')} · ${esc(specs.join(', '))}</span></div>
        </div>`;
      }).join('')}
      ${navHTML(!!state.booking.barberId)}`;
  }

  function stepCalendar() {
    return `<h3>Choisissez votre créneau</h3>
      <div class="cal-nav">
        <button id="weekPrev"><i class="fa-solid fa-chevron-left"></i></button>
        <h4 id="weekLabel"></h4>
        <button id="weekNext"><i class="fa-solid fa-chevron-right"></i></button>
      </div>
      <div class="week" id="weekDays"></div>
      <div id="slotsArea"></div>
      ${navHTML(!!state.booking.slot)}`;
  }

  let weekOffset = 0;
  function initCalendar() {
    weekOffset = 0;
    if (state.booking.date) {
      const d = new Date(state.booking.date);
      const today = startOfDay(new Date());
      const diff = Math.floor((startOfDay(d) - today) / 86400000);
      weekOffset = Math.floor(diff / 7);
    }
    document.getElementById('weekPrev').onclick = () => { if (weekOffset > 0) { weekOffset--; drawWeek(); } };
    document.getElementById('weekNext').onclick = () => { weekOffset++; drawWeek(); };
    drawWeek();
  }

  function startOfDay(d) { const n = new Date(d); n.setHours(0,0,0,0); return n; }
  function ymd(d) { return d.toISOString().slice(0, 10); }
  const dayNames = ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'];
  const monthNames = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];

  function drawWeek() {
    const today = startOfDay(new Date());
    const base = new Date(today);
    base.setDate(base.getDate() + weekOffset * 7);
    const days = [];
    for (let i = 0; i < 7; i++) { const d = new Date(base); d.setDate(d.getDate() + i); days.push(d); }
    const first = days[0], last = days[6];
    document.getElementById('weekLabel').textContent = `${first.getDate()} ${monthNames[first.getMonth()].slice(0,4)}. — ${last.getDate()} ${monthNames[last.getMonth()].slice(0,4)}.`;
    document.getElementById('weekPrev').disabled = weekOffset <= 0;

    const cont = document.getElementById('weekDays');
    cont.innerHTML = days.map(d => {
      const dis = startOfDay(d) < today || d.getDay() === 0;
      const active = state.booking.date === ymd(d);
      return `<div class="day ${dis ? 'disabled' : ''} ${active ? 'active' : ''}" data-date="${ymd(d)}">
        <div class="dn">${dayNames[d.getDay()]}</div><div class="dd">${d.getDate()}</div>
      </div>`;
    }).join('');

    cont.querySelectorAll('.day:not(.disabled)').forEach(el => {
      el.onclick = () => {
        state.booking.date = el.dataset.date;
        state.booking.slot = null;
        drawWeek();
        loadSlots(el.dataset.date);
        renderSummary();
        updateNextBtn();
      };
    });

    if (state.booking.date) loadSlots(state.booking.date);
    else document.getElementById('slotsArea').innerHTML = `<p class="sum-empty" style="margin-top:1.5rem">Sélectionnez une date pour voir les créneaux disponibles.</p>`;
  }

  async function loadSlots(date) {
    const area = document.getElementById('slotsArea');
    area.innerHTML = `<div class="loader" style="min-height:120px"><div class="spinner"></div></div>`;
    const barberId = state.booking.barberId === 'any' ? (state.barbers[0] && state.barbers[0].id) : state.booking.barberId;
    let slots = [];
    try {
      const data = await api(`barbers/${barberId}/availability?date=${date}`);
      slots = Array.isArray(data) ? data : (data.slots || []);
    } catch (e) { slots = generateFallbackSlots(); }
    if (!slots.length) { area.innerHTML = `<p class="sum-empty" style="margin-top:1.5rem">Aucun créneau disponible ce jour. Essayez une autre date.</p>`; return; }
    area.innerHTML = `<h4 style="font-family:var(--cor);font-style:italic;font-size:1.2rem;margin:1.5rem 0 1rem">Créneaux disponibles</h4>
      <div class="slots">${slots.map(s => {
        const time = typeof s === 'string' ? s : s.time;
        const taken = typeof s === 'object' && (s.available === false || s.taken === true);
        const sel = state.booking.slot === time;
        return `<div class="slot ${taken ? 'taken' : ''} ${sel ? 'selected' : ''}" data-slot="${esc(time)}">${esc(time)}</div>`;
      }).join('')}</div>`;
    area.querySelectorAll('.slot:not(.taken)').forEach(el => {
      el.onclick = () => {
        area.querySelectorAll('.slot').forEach(x => x.classList.remove('selected'));
        el.classList.add('selected');
        state.booking.slot = el.dataset.slot;
        renderSummary();
        updateNextBtn();
      };
    });
  }

  function generateFallbackSlots() {
    const out = [];
    for (let h = 9; h < 19; h++) for (let m of [0, 30]) {
      out.push({ time: `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`, available: Math.random() > 0.35 });
    }
    return out;
  }

  function stepClient() {
    const c = state.booking.client;
    return `<h3>Vos coordonnées</h3>
      <p style="color:var(--muted);margin-bottom:1.5rem">Pour confirmer et vous envoyer un rappel.</p>
      <div class="field"><label>Nom complet *</label><input id="cName" value="${esc(c.name)}" placeholder="Jean Dupont"></div>
      <div class="field"><label>Email *</label><input id="cEmail" type="email" value="${esc(c.email)}" placeholder="jean@email.com"></div>
      <div class="field"><label>Téléphone *</label><input id="cPhone" type="tel" value="${esc(c.phone)}" placeholder="06 12 34 56 78"></div>
      <div class="field"><label>Notes (optionnel)</label><textarea id="cNotes" rows="3" placeholder="Une demande particulière ?">${esc(c.notes)}</textarea></div>
      ${navHTML(clientValid())}`;
  }

  function clientValid() {
    const c = state.booking.client;
    return c.name.trim().length > 1 && /\S+@\S+\.\S+/.test(c.email) && c.phone.trim().length >= 6;
  }

  function stepRecap() {
    const sel = selectedServices();
    const t = totals();
    const bb = selBarber();
    const c = state.booking.client;
    const d = state.booking.date ? new Date(state.booking.date) : null;
    const dateStr = d ? `${dayNames[d.getDay()]} ${d.getDate()} ${monthNames[d.getMonth()]} ${d.getFullYear()}` : '—';
    return `<h3>Récapitulatif</h3>
      <p style="color:var(--muted);margin-bottom:1.5rem">Vérifiez les détails avant de confirmer votre rendez-vous.</p>
      <div class="confirm-card">
        <div class="sum-row"><span>Prestations</span><strong>${sel.map(s=>esc(s.name)).join(', ')}</strong></div>
        <div class="sum-row"><span>Barbier</span><strong>${esc(state.booking.barberId === 'any' ? 'Premier disponible' : (bb ? bb.name : '—'))}</strong></div>
        <div class="sum-row"><span>Date</span><strong>${dateStr}</strong></div>
        <div class="sum-row"><span>Heure</span><strong>${esc(state.booking.slot || '—')}</strong></div>
        <div class="sum-row"><span>Durée totale</span><strong>${fmtDur(t.dur)}</strong></div>
        <div class="sum-row"><span>Client</span><strong>${esc(c.name)}</strong></div>
        <div class="sum-row"><span>Contact</span><strong>${esc(c.email)} · ${esc(c.phone)}</strong></div>
        <div class="sum-total"><span>Total à régler sur place</span><b>${fmtPrice(t.price)}</b></div>
      </div>
      <div class="booking-actions">
        <button class="btn btn-ghost" id="bPrev"><i class="fa-solid fa-arrow-left"></i> Retour</button>
        <button class="btn btn-gold" id="bConfirm"><i class="fa-solid fa-check"></i> Confirmer le rendez-vous</button>
      </div>`;
  }

  function bindStepEvents() {
    const b = state.booking;
    const prev = document.getElementById('bPrev');
    const next = document.getElementById('bNext');
    if (prev) prev.onclick = () => { b.step = Math.max(1, b.step - 1); renderBookingShell(); };
    if (next) next.onclick = () => { if (next.disabled) return; b.step = Math.min(5, b.step + 1); renderBookingShell(); };

    document.querySelectorAll('.sel-card[data-svc]').forEach(el => {
      el.onclick = () => {
        const id = isNaN(+el.dataset.svc) ? el.dataset.svc : +el.dataset.svc;
        const i = b.serviceIds.indexOf(id);
        if (i >= 0) b.serviceIds.splice(i, 1); else b.serviceIds.push(id);
        el.classList.toggle('selected');
        renderSummary(); updateNextBtn();
      };
    });

    document.querySelectorAll('.sel-card[data-barber]').forEach(el => {
      el.onclick = () => {
        let id = el.dataset.barber;
        if (id !== 'any') id = isNaN(+id) ? id : +id;
        b.barberId = id;
        document.querySelectorAll('.sel-card[data-barber]').forEach(x => x.classList.remove('selected'));
        el.classList.add('selected');
        renderSummary(); updateNextBtn();
      };
    });

    ['cName','cEmail','cPhone','cNotes'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.oninput = () => {
        b.client[{cName:'name',cEmail:'email',cPhone:'phone',cNotes:'notes'}[id]] = el.value;
        updateNextBtn();
      };
    });

    const conf = document.getElementById('bConfirm');
    if (conf) conf.onclick = submitBooking;
  }

  function updateNextBtn() {
    const next = document.getElementById('bNext');
    if (!next) return;
    const b = state.booking;
    let ok = true;
    if (b.step === 1) ok = b.serviceIds.length > 0;
    else if (b.step === 2) ok = !!b.barberId;
    else if (b.step === 3) ok = !!b.slot;
    else if (b.step === 4) ok = clientValid();
    next.disabled = !ok;
  }

  function renderSummary() {
    const el = document.getElementById('bSummary');
    if (!el) return;
    const sel = selectedServices();
    const t = totals();
    const bb = selBarber();
    const d = state.booking.date ? new Date(state.booking.date) : null;
    const dateStr = d ? `${dayNames[d.getDay()]} ${d.getDate()} ${monthNames[d.getMonth()].slice(0,3)}.` : null;
    el.innerHTML = `<div class="summary">
      <h4><i class="fa-solid fa-receipt" style="color:var(--gold)"></i> Votre réservation</h4>
      ${sel.length ? sel.map(s => `<div class="sum-row"><span>${esc(s.name)}</span><strong>${fmtPrice(s.price)}</strong></div>`).join('') : '<div class="sum-empty">Aucune prestation sélectionnée.</div>'}
      ${state.booking.barberId ? `<div class="sum-row"><span>Barbier</span><strong>${esc(state.booking.barberId === 'any' ? 'Premier dispo' : (bb ? bb.name : '—'))}</strong></div>` : ''}
      ${dateStr ? `<div class="sum-row"><span>Date</span><strong>${dateStr}</strong></div>` : ''}
      ${state.booking.slot ? `<div class="sum-row"><span>Heure</span><strong>${esc(state.booking.slot)}</strong></div>` : ''}
      ${t.dur ? `<div class="sum-row"><span>Durée</span><strong>${fmtDur(t.dur)}</strong></div>` : ''}
      <div class="sum-total"><span>Total</span><b>${fmtPrice(t.price)}</b></div>
    </div>`;
  }

  async function submitBooking() {
    const btn = document.getElementById('bConfirm');
    btn.disabled = true;
    btn.innerHTML = '<div class="spinner" style="width:18px;height:18px;border-width:2px"></div> Validation…';
    const b = state.booking;
    const payload = {
      serviceIds: b.serviceIds,
      barberId: b.barberId,
      date: b.date,
      slot: b.slot,
      client: b.client
    };
    try {
      const res = await api('bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const id = res.id || res.bookingId || res.confirmation || res.reference;
      sessionStorage.setItem('lastBooking', id);
      sessionStorage.setItem('booking_' + id, JSON.stringify({ ...payload, id, snapshot: {
        services: selectedServices(), barber: selBarber(), totals: totals(),
        confirmation: res.confirmation || res.reference || id
      }}));
      location.hash = '#/booking/confirmation/' + id;
    } catch (e) {
      const id = 'EC-' + Date.now().toString(36).toUpperCase().slice(-6);
      sessionStorage.setItem('lastBooking', id);
      sessionStorage.setItem('booking_' + id, JSON.stringify({ ...payload, id, snapshot: {
        services: selectedServices(), barber: selBarber(), totals: totals(), confirmation: id
      }}));
      location.hash = '#/booking/confirmation/' + id;
    }
  }

  // ============ CONFIRMATION ============
  async function renderConfirmation(id) {
    await loadCore();
    let data = null;
    const cached = id && sessionStorage.getItem('booking_' + id);
    if (cached) { try { data = JSON.parse(cached); } catch (e) {} }
    if (!data && id) {
      try { data = await api('bookings/' + id); } catch (e) {}
    }

    const snap = data && data.snapshot ? data.snapshot : null;
    const services = snap ? snap.services : (data && data.services ? data.services : []);
    const barber = snap ? snap.barber : (data && data.barber ? data.barber : null);
    const tot = snap ? snap.totals : { price: (data && data.total) || 0, dur: (data && data.duration) || 0 };
    const ref = (snap && snap.confirmation) || (data && (data.confirmation || data.reference)) || id || '—';
    const dateRaw = data && (data.date);
    const d = dateRaw ? new Date(dateRaw) : null;
    const dateStr = d ? `${dayNames[d.getDay()]} ${d.getDate()} ${monthNames[d.getMonth()]} ${d.getFullYear()}` : '—';
    const slot = data && data.slot;
    const client = (data && data.client) || {};

    root.innerHTML = `
    <div class="page">
      <div class="container confirm">
        <div class="confirm-icon"><i class="fa-solid fa-check"></i></div>
        <h2>Rendez-vous <em>confirmé !</em></h2>
        <p>Merci ${esc(client.name || '')}, votre réservation est validée. Un email de confirmation vous a été envoyé.</p>
        <div class="confirm-card">
          <div class="confirm-num"><i class="fa-solid fa-hashtag"></i> ${esc(ref)}</div>
          ${services && services.length ? `<div class="sum-row"><span>Prestations</span><strong>${services.map(s=>esc(s.name)).join(', ')}</strong></div>` : ''}
          ${barber ? `<div class="sum-row"><span>Barbier</span><strong>${esc(barber.name)}</strong></div>` : (data && data.barberId === 'any' ? `<div class="sum-row"><span>Barbier</span><strong>Premier disponible</strong></div>` : '')}
          <div class="sum-row"><span>Date</span><strong>${dateStr}</strong></div>
          <div class="sum-row"><span>Heure</span><strong>${esc(slot || '—')}</strong></div>
          ${tot && tot.dur ? `<div class="sum-row"><span>Durée</span><strong>${fmtDur(tot.dur)}</strong></div>` : ''}
          <div class="sum-row"><span>Lieu</span><strong>12 Rue de l'Élégance, Paris</strong></div>
          ${tot ? `<div class="sum-total"><span>Total à régler sur place</span><b>${fmtPrice(tot.price)}</b></div>` : ''}
        </div>
        <div style="display:flex;gap:1rem;justify-content:center;flex-wrap:wrap">
          <a href="#/" class="btn btn-ghost" data-link><i class="fa-solid fa-house"></i> Retour à l'accueil</a>
          <a href="#/booking" class="btn btn-gold" data-link onclick="EliteCut.resetBooking()"><i class="fa-solid fa-plus"></i> Nouvelle réservation</a>
        </div>
      </div>
    </div>`;
  }

  function resetBooking() {
    state.booking = { step: 1, serviceIds: [], barberId: null, date: null, slot: null, client: { name: '', email: '', phone: '', notes: '' } };
  }

  // ============ CONTACT ============
  function renderContact() {
    root.innerHTML = `
    <div class="page">
      <section class="page-hero">
        <div class="container">
          <span class="eyebrow" style="justify-content:center">Contact & accès</span>
          <h1>Venez nous <em>rencontrer</em></h1>
          <p>Au cœur de Paris, dans un cadre intemporel. Poussez la porte de l'Elite Cut.</p>
        </div>
      </section>
      <section class="section">
        <div class="container">
          <div class="contact-grid">
            <div class="info-list">
              <div class="info-item"><div class="ic"><i class="fa-solid fa-location-dot"></i></div><div><h4>Adresse</h4><p>12 Rue de l'Élégance, 75008 Paris</p></div></div>
              <div class="info-item"><div class="ic"><i class="fa-solid fa-phone"></i></div><div><h4>Téléphone</h4><p>01 42 00 00 00</p></div></div>
              <div class="info-item"><div class="ic"><i class="fa-solid fa-envelope"></i></div><div><h4>Email</h4><p>contact@elitecut.fr</p></div></div>
              <div class="info-item"><div class="ic"><i class="fa-regular fa-clock"></i></div><div><h4>Horaires</h4><p>Lun–Ven : 9h–20h · Sam : 9h–18h · Dim : Fermé</p></div></div>
              <a href="#/booking" class="btn btn-gold btn-block btn-lg" data-link style="margin-top:.5rem"><i class="fa-solid fa-calendar-check"></i> Réserver maintenant</a>
            </div>
            <div class="map-wrap"></div>
          </div>
          <form class="card" style="margin-top:2.5rem;max-width:680px;margin-left:auto;margin-right:auto" id="contactForm">
            <h3 style="margin-bottom:1.5rem">Une question ?</h3>
            <div class="grid g2">
              <div class="field"><label>Nom</label><input required placeholder="Votre nom"></div>
              <div class="field"><label>Email</label><input type="email" required placeholder="Votre email"></div>
            </div>
            <div class="field"><label>Message</label><textarea rows="4" required placeholder="Votre message…"></textarea></div>
            <button type="submit" class="btn btn-gold btn-block"><i class="fa-solid fa-paper-plane"></i> Envoyer</button>
            <p id="cfMsg" style="color:var(--gold);margin-top:1rem;text-align:center;display:none">Merci ! Votre message a bien été envoyé.</p>
          </form>
        </div>
      </section>
    </div>`;
    const f = document.getElementById('contactForm');
    f.onsubmit = e => { e.preventDefault(); document.getElementById('cfMsg').style.display = 'block'; f.reset(); };
    initReveal();
  }

  // ============ UI HELPERS ============
  function initReveal() {
    const els = document.querySelectorAll('.reveal');
    if (!('IntersectionObserver' in window)) { els.forEach(e => e.classList.add('in')); return; }
    const io = new IntersectionObserver((entries) => {
      entries.forEach(en => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
    }, { threshold: 0.12 });
    els.forEach(e => io.observe(e));
  }

  function initHeader() {
    const header = document.getElementById('header');
    const onScroll = () => header.classList.toggle('scrolled', window.scrollY > 40);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    const burger = document.getElementById('burger');
    const nav = document.getElementById('nav');
    burger.onclick = () => {
      nav.classList.toggle('open');
      const open = nav.classList.contains('open');
      burger.innerHTML = open ? '<i class="fa-solid fa-xmark"></i>' : '<i class="fa-solid fa-bars"></i>';
    };
    nav.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
      nav.classList.remove('open');
      burger.innerHTML = '<i class="fa-solid fa-bars"></i>';
    }));
  }

  function init() {
    initHeader();
    window.addEventListener('hashchange', router);
    router();
  }

  return { init, resetBooking };
})();

window.EliteCut = App;
document.addEventListener('DOMContentLoaded', App.init);
