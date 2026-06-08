const { useState, useEffect } = React;

const Logo = () => (
  <div className="flex items-center gap-2">
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" className="text-accent">
      <path d="M3 12c2-6 4-6 6 0s4 6 6 0 4-6 6 0" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/>
    </svg>
    <span className="text-xl font-display font-bold tracking-tight">apex-flow</span>
  </div>
);

const Nav = () => {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', h); return () => window.removeEventListener('scroll', h);
  }, []);
  const links = ['Fonctionnalités', 'Comment ça marche', 'Tarifs', 'Ressources'];
  return (
    <header className={`fixed top-0 inset-x-0 z-50 transition-all ${scrolled ? 'bg-base/70 backdrop-blur-xl border-b border-line' : ''}`}>
      <div className="max-w-7xl mx-auto px-5 h-16 flex items-center justify-between">
        <Logo />
        <nav className="hidden md:flex items-center gap-1 bg-white/5 border border-line rounded-full px-2 py-1">
          {links.map(l => <a key={l} href="#" className="px-4 py-1.5 text-sm text-muted hover:text-ink rounded-full transition">{l}</a>)}
        </nav>
        <div className="hidden md:flex items-center gap-3">
          <a href="#" className="px-4 py-1.5 text-sm text-ink border border-accent/60 rounded-full hover:bg-accent/10 transition">Se connecter</a>
          <a href="#" className="px-4 py-1.5 text-sm font-medium bg-accent text-base rounded-full hover:bg-accentSoft transition">Commencer gratuitement</a>
        </div>
        <button onClick={() => setOpen(!open)} className="md:hidden text-ink">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d={open ? "M6 6l12 12M6 18L18 6" : "M4 7h16M4 12h16M4 17h16"} strokeLinecap="round"/></svg>
        </button>
      </div>
      {open && (
        <div className="md:hidden bg-base/95 backdrop-blur-xl border-t border-line px-5 py-4 space-y-2">
          {links.map(l => <a key={l} href="#" className="block py-2 text-muted">{l}</a>)}
          <a href="#" className="block mt-2 text-center px-4 py-2 bg-accent text-base rounded-full font-medium">Commencer gratuitement</a>
        </div>
      )}
    </header>
  );
};

const DotField = ({ rows = 14 }) => (
  <div className="grid gap-2 opacity-40 py-10" style={{ gridTemplateColumns: 'repeat(40, minmax(0,1fr))' }}>
    {Array.from({ length: rows * 40 }).map((_, i) => <div key={i} className="w-1.5 h-1.5 rounded-full bg-white/15 justify-self-center" />)}
  </div>
);

const Hero = () => (
  <section className="relative pt-36 pb-16 text-center overflow-hidden">
    <p className="text-muted text-sm mb-5">Coach vocal IA pour l'apprentissage des langues</p>
    <h1 className="font-display font-bold text-5xl sm:text-6xl lg:text-7xl leading-[1.05] tracking-tight max-w-3xl mx-auto px-4">
      Apprends une langue<br/>rien qu'en parlant
    </h1>
    <p className="text-muted mt-6 max-w-md mx-auto px-4 leading-relaxed">
      apex-flow t'écoute, te corrige et te fait progresser à l'oral grâce à un coach vocal IA disponible 24/7. Pas de manuels, juste ta voix.
    </p>
    <div className="flex items-center justify-center gap-3 mt-8">
      <a href="#" className="px-6 py-3 bg-accent text-base font-medium rounded-full hover:bg-accentSoft transition">Parler maintenant</a>
      <a href="#" className="px-6 py-3 border border-line rounded-full text-ink hover:bg-white/5 transition flex items-center gap-2">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg> Voir la démo
      </a>
    </div>
    <div className="mt-16 max-w-md mx-auto px-4">
      <div className="relative h-44 flex items-center justify-center">
        <div className="absolute w-3 h-3 rounded-full bg-accent shadow-[0_0_40px_12px_rgba(255,107,74,0.5)] z-10" />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="absolute rounded-full border border-white/10" style={{ width: 60 + i * 70, height: 60 + i * 70 }} />
        ))}
      </div>
    </div>
  </section>
);

const Brands = () => (
  <div className="max-w-6xl mx-auto px-5 py-10 border-y border-line">
    <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-4 opacity-40">
      {['lingua','vocalo','parla','fluentic','speakly','idioma','tongo','verba'].map(b => (
        <span key={b} className="text-muted font-display font-semibold text-lg italic">{b}</span>
      ))}
    </div>
  </div>
);

const Steps = () => {
  const steps = [
    { n: '01', t: 'Choisis ta langue', d: 'Espagnol, anglais, japonais… sélectionne ta langue et ton niveau actuel.' },
    { n: '02', t: 'Parle naturellement', d: 'Discute avec ton coach vocal IA comme avec un véritable humain.' },
    { n: '03', t: 'Progresse à l\'oral', d: 'Reçois un feedback instantané sur ta prononciation et ta fluidité.' },
  ];
  return (
    <section className="max-w-6xl mx-auto px-5 py-24">
      <h2 className="font-display font-bold text-4xl sm:text-5xl text-center tracking-tight">Comment ça marche</h2>
      <div className="grid md:grid-cols-3 gap-6 mt-14">
        {steps.map(s => (
          <div key={s.n} className="bg-surface border border-line rounded-2xl p-7">
            <span className="text-accent font-display font-bold text-lg">{s.n}</span>
            <h3 className="font-display font-semibold text-xl mt-3">{s.t}</h3>
            <p className="text-muted mt-2 leading-relaxed">{s.d}</p>
          </div>
        ))}
      </div>
    </section>
  );
};

const icons = {
  mic: "M12 14a3 3 0 003-3V6a3 3 0 00-6 0v5a3 3 0 003 3zm5-3a5 5 0 01-10 0M12 19v3",
  speak: "M3 11l18-5v12L3 14v-3zM11.6 16.8a3 3 0 11-5.8-1.6",
  globe: "M12 2a10 10 0 100 20 10 10 0 000-20zM2 12h20M12 2c3 3 3 17 0 20M12 2c-3 3-3 17 0 20",
  chart: "M3 3v18h18M7 14l3-3 3 3 5-6",
  brain: "M9 3a3 3 0 00-3 3 3 3 0 00-2 5 3 3 0 002 5 3 3 0 006 0V3a3 3 0 00-3 0zM15 3a3 3 0 013 3 3 3 0 012 5 3 3 0 01-2 5 3 3 0 01-6 0",
  clock: "M12 7v5l3 2M12 22a10 10 0 110-20 10 10 0 010 20z"
};

const Features = () => {
  const feats = [
    { i: 'mic', t: 'Conversation vocale en temps réel', d: 'Pratique l\'oral sans peur du jugement, à ton rythme.' },
    { i: 'speak', t: 'Feedback de prononciation', d: 'Correction phonétique précise à chaque phrase que tu prononces.' },
    { i: 'globe', t: '+30 langues', d: 'Du débutant complet jusqu\'au niveau bilingue avancé.' },
    { i: 'chart', t: 'Suivi de progression', d: 'Visualise ta fluidité qui grimpe semaine après semaine.' },
    { i: 'brain', t: 'Scénarios immersifs', d: 'Restaurant, voyage, entretien d\'embauche : entraîne-toi pour la vraie vie.' },
    { i: 'clock', t: '5 min par jour', d: 'Des sessions courtes qui s\'adaptent à ton emploi du temps.' },
  ];
  return (
    <section className="max-w-6xl mx-auto px-5 py-16">
      <div className="grid md:grid-cols-3 gap-5">
        {feats.map(f => (
          <div key={f.t} className="bg-surface border border-line rounded-2xl p-7 hover:border-accent/40 transition">
            <div className="w-11 h-11 rounded-xl bg-accent/15 flex items-center justify-center text-accent">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={icons[f.i]}/></svg>
            </div>
            <h3 className="font-display font-semibold text-lg mt-4">{f.t}</h3>
            <p className="text-muted mt-2 leading-relaxed text-sm">{f.d}</p>
          </div>
        ))}
      </div>
    </section>
  );
};

const Showcase = () => (
  <section className="max-w-6xl mx-auto px-5 py-24">
    <div className="grid md:grid-cols-2 gap-12 items-center">
      <div>
        <h2 className="font-display font-bold text-4xl sm:text-5xl tracking-tight leading-tight">Au-delà des cours.<br/>Vers la conversation.</h2>
        <p className="text-muted mt-5 leading-relaxed">Oublie les exercices à trous. apex-flow transforme chaque minute en une vraie discussion vivante, avec un coach qui s'adapte à ton accent et à tes erreurs.</p>
        <a href="#" className="inline-block mt-7 px-6 py-3 bg-accent text-base font-medium rounded-full hover:bg-accentSoft transition">Essayer une conversation</a>
      </div>
      <div className="rounded-2xl overflow-hidden border border-line">
        <img src="https://images.unsplash.com/photo-1543269865-cbf427effbad?auto=format&fit=crop&w=800&q=80" alt="Conversation" className="w-full h-72 object-cover" />
      </div>
    </div>
  </section>
);

const Testimonials = () => {
  const ts = [
    { q: 'En 3 semaines je tiens une vraie conversation en espagnol !', n: 'Camille R.', r: 'Débutante en espagnol', a: 'photo-1494790108377-be9c29b29330' },
    { q: 'Parler à l\'IA m\'a enlevé toute ma peur de l\'oral en anglais.', n: 'Yanis M.', r: 'Étudiant', a: 'photo-1500648767791-00dcc994a43e' },
    { q: 'Le feedback de prononciation est bluffant de précision.', n: 'Sofia L.', r: 'Voyageuse au Japon', a: 'photo-1438761681033-6461ffad8d80' },
  ];
  return (
    <section className="max-w-6xl mx-auto px-5 py-16">
      <h2 className="font-display font-bold text-4xl sm:text-5xl text-center tracking-tight">Ils parlent déjà</h2>
      <div className="grid md:grid-cols-3 gap-5 mt-12">
        {ts.map(t => (
          <div key={t.n} className="bg-surface border border-line rounded-2xl p-7">
            <p className="text-ink leading-relaxed">“{t.q}”</p>
            <div className="flex items-center gap-3 mt-6">
              <img src={`https://images.unsplash.com/${t.a}?auto=format&fit=crop&w=80&q=80`} alt={t.n} className="w-10 h-10 rounded-full object-cover" />
              <div><p className="font-medium text-sm">{t.n}</p><p className="text-faint text-xs">{t.r}</p></div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

const Pricing = () => {
  const plans = [
    { n: 'Free', p: '0€', d: 'Pour découvrir.', pop: false, f: ['1 langue', '10 min / jour', 'Feedback basique'] },
    { n: 'Pro', p: '12€', d: 'Pour progresser vite.', pop: true, f: ['Toutes les langues', 'Sessions illimitées', 'Feedback avancé', 'Scénarios immersifs'] },
    { n: 'Teams', p: 'Sur devis', d: 'Écoles & entreprises.', pop: false, f: ['Multi-comptes', 'Tableau de bord admin', 'Support dédié'] },
  ];
  return (
    <section className="max-w-6xl mx-auto px-5 py-24">
      <h2 className="font-display font-bold text-4xl sm:text-5xl text-center tracking-tight">Des tarifs simples</h2>
      <div className="grid md:grid-cols-3 gap-5 mt-12">
        {plans.map(p => (
          <div key={p.n} className={`rounded-2xl p-8 border ${p.pop ? 'border-accent bg-surface2' : 'border-line bg-surface'}`}>
            {p.pop && <span className="text-xs bg-accent text-base px-3 py-1 rounded-full font-medium">Populaire</span>}
            <h3 className="font-display font-semibold text-xl mt-4">{p.n}</h3>
            <p className="text-muted text-sm mt-1">{p.d}</p>
            <p className="font-display font-bold text-4xl mt-5">{p.p}<span className="text-faint text-base font-normal">{p.p.includes('€') && p.p !== '0€' ? '/mois' : ''}</span></p>
            <ul className="mt-6 space-y-3">
              {p.f.map(f => (
                <li key={f} className="flex items-center gap-2 text-sm text-muted">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FF6B4A" strokeWidth="2.5"><path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round"/></svg>{f}
                </li>
              ))}
            </ul>
            <a href="#" className={`block text-center mt-8 px-5 py-3 rounded-full font-medium transition ${p.pop ? 'bg-accent text-base hover:bg-accentSoft' : 'border border-line text-ink hover:bg-white/5'}`}>Choisir {p.n}</a>
          </div>
        ))}
      </div>
    </section>
  );
};

const FAQ = () => {
  const [open, setOpen] = useState(0);
  const items = [
    { q: 'Ai-je besoin de connaissances préalables ?', a: 'Non. apex-flow s\'adapte à ton niveau, même si tu pars de zéro absolu.' },
    { q: 'Quelles langues sont disponibles ?', a: 'Plus de 30 langues, de l\'anglais et l\'espagnol au japonais et au coréen.' },
    { q: 'Ça marche sur mobile ?', a: 'Oui, apex-flow fonctionne parfaitement sur mobile, tablette et ordinateur.' },
    { q: 'Comment l\'IA corrige ma prononciation ?', a: 'Elle analyse ta voix phonème par phonème et te propose des corrections ciblées en temps réel.' },
  ];
  return (
    <section className="max-w-3xl mx-auto px-5 py-24">
      <h2 className="font-display font-bold text-4xl sm:text-5xl text-center tracking-tight">Questions fréquentes</h2>
      <div className="mt-12 space-y-3">
        {items.map((it, i) => (
          <div key={i} className="bg-surface border border-line rounded-2xl overflow-hidden">
            <button onClick={() => setOpen(open === i ? -1 : i)} className="w-full flex items-center justify-between p-6 text-left">
              <span className="font-medium">{it.q}</span>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`text-accent transition-transform ${open === i ? 'rotate-45' : ''}`}><path d="M12 5v14M5 12h14" strokeLinecap="round"/></svg>
            </button>
            {open === i && <p className="px-6 pb-6 text-muted leading-relaxed">{it.a}</p>}
          </div>
        ))}
      </div>
    </section>
  );
};

const FinalCTA = () => (
  <section className="max-w-5xl mx-auto px-5 py-20">
    <div className="relative rounded-3xl border border-line bg-surface text-center p-16 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,107,74,0.18),transparent_70%)]" />
      <h2 className="relative font-display font-bold text-4xl sm:text-5xl tracking-tight">Ta prochaine langue se parle dès aujourd'hui.</h2>
      <a href="#" className="relative inline-block mt-8 px-7 py-3.5 bg-accent text-base font-medium rounded-full hover:bg-accentSoft transition">Commencer gratuitement</a>
    </div>
  </section>
);

const Footer = () => {
  const cols = {
    Produit: ['Fonctionnalités', 'Tarifs', 'Démo', 'Application mobile'],
    Langues: ['Anglais', 'Espagnol', 'Japonais', 'Toutes les langues'],
    Ressources: ['Blog', 'Guides', 'Centre d\'aide', 'Communauté'],
    Entreprise: ['À propos', 'Carrières', 'Contact'],
    Légal: ['Confidentialité', 'Conditions', 'Cookies'],
  };
  return (
    <footer className="border-t border-line">
      <div className="max-w-7xl mx-auto px-5 py-16">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-8">
          <div className="col-span-2"><Logo /><p className="text-faint text-sm mt-4 max-w-xs">Le coach vocal IA qui te fait parler une nouvelle langue en quelques minutes par jour.</p></div>
          {Object.entries(cols).map(([h, ls]) => (
            <div key={h}>
              <p className="font-medium text-sm mb-3">{h}</p>
              <ul className="space-y-2">{ls.map(l => <li key={l}><a href="#" className="text-faint text-sm hover:text-ink transition">{l}</a></li>)}</ul>
            </div>
          ))}
        </div>
        <div className="mt-12 pt-6 border-t border-line text-faint text-sm">© {new Date().getFullYear()} apex-flow. Tous droits réservés.</div>
      </div>
    </footer>
  );
};

const App = () => (
  <div className="overflow-hidden">
    <Nav />
    <Hero />
    <Brands />
    <DotField rows={6} />
    <Steps />
    <Features />
    <Showcase />
    <Testimonials />
    <Pricing />
    <FAQ />
    <FinalCTA />
    <Footer />
  </div>
);

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(React.createElement(App));