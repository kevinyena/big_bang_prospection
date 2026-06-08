const { useState, useEffect, useRef } = React;

const Icon = ({ d, c = "w-6 h-6" }) => (
  <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>
);

const Reveal = ({ children, className = "" }) => {
  const ref = useRef(null);
  const [vis, setVis] = useState(false);
  useEffect(() => {
    const o = new IntersectionObserver(([e]) => e.isIntersecting && setVis(true), { threshold: 0.12 });
    if (ref.current) o.observe(ref.current);
    return () => o.disconnect();
  }, []);
  return <div ref={ref} className={`transition-all duration-700 ease-out ${vis ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"} ${className}`}>{children}</div>;
};

const Nav = () => {
  const [open, setOpen] = useState(false);
  const links = ["Fonctionnalités", "Agents IA", "Tarifs", "FAQ"];
  return (
    <header className="fixed top-0 inset-x-0 z-50 backdrop-blur-md bg-base/70 border-b border-white/5">
      <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
        <a href="#" className="text-2xl font-display italic tracking-tight">aura<span className="not-italic font-sans font-semibold">-spark.</span></a>
        <nav className="hidden md:flex items-center gap-10 text-sm text-secondary">
          {links.map(l => <a key={l} href={`#${l}`} className="hover:text-offwhite transition-colors duration-200">{l}</a>)}
        </nav>
        <div className="hidden md:block">
          <a href="#" className="px-6 py-2.5 rounded-full bg-offwhite text-base text-sm font-medium hover:bg-accent hover:text-white transition-colors duration-200">Commencer gratuitement</a>
        </div>
        <button className="md:hidden" onClick={() => setOpen(!open)}><Icon d={open ? "M6 18 18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"} /></button>
      </div>
      {open && (
        <div className="md:hidden border-t border-white/5 bg-base px-6 py-6 flex flex-col gap-5">
          {links.map(l => <a key={l} href={`#${l}`} onClick={() => setOpen(false)} className="text-secondary hover:text-offwhite">{l}</a>)}
          <a href="#" className="px-6 py-2.5 rounded-full bg-offwhite text-base text-sm font-medium text-center">Commencer gratuitement</a>
        </div>
      )}
    </header>
  );
};

const Hero = () => (
  <section className="relative min-h-screen flex items-center overflow-hidden pt-20">
    <div className="absolute inset-0 -z-10" style={{ background: "radial-gradient(120% 120% at 60% 10%, #FF3B12 0%, #c41e0c 35%, #2a0604 65%, #0a0a0a 100%)" }} />
    <div className="max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-16 items-center w-full py-20">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-white/60 mb-6">🡺 V3.0 / Agents IA Email</p>
        <h1 className="font-display text-5xl md:text-7xl leading-[0.95] tracking-tight mb-8">Vos agents IA gèrent vos <span className="italic">emails</span> à votre place</h1>
        <p className="text-lg text-white/80 max-w-md leading-relaxed mb-10">aura-spark déploie des agents intelligents qui trient, priorisent et répondent directement à vos emails. Reprenez le contrôle de votre boîte de réception.</p>
        <div className="flex flex-wrap items-center gap-6">
          <a href="#" className="px-8 py-4 rounded-full bg-offwhite text-base font-medium hover:bg-black hover:text-white transition-colors duration-300">Déployer mon agent</a>
          <a href="#" className="text-offwhite font-medium hover:text-white/70 transition-colors">Voir une démo →</a>
        </div>
      </div>
      <Reveal>
        <div className="rounded-2xl overflow-hidden border border-white/10 shadow-2xl bg-base/40 backdrop-blur">
          <img src="https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?auto=format&fit=crop&w=900&q=80" alt="inbox" className="w-full h-72 object-cover" />
          <div className="p-6 space-y-4">
            {["Réponse envoyée à Sarah · 2s", "Thread résumé · priorité haute", "3 emails archivés automatiquement"].map((t, i) => (
              <div key={i} className="flex items-center gap-3 text-sm text-white/80"><span className="w-2 h-2 rounded-full bg-accent" />{t}</div>
            ))}
          </div>
        </div>
      </Reveal>
    </div>
  </section>
);

const Logos = () => (
  <section className="py-16 border-y border-white/5">
    <div className="max-w-7xl mx-auto px-6 text-center">
      <p className="text-xs uppercase tracking-[0.25em] text-secondary mb-10">Ils ont libéré leur boîte mail</p>
      <div className="flex flex-wrap justify-center items-center gap-x-14 gap-y-8 opacity-50">
        {["Northwind", "Lumio", "Acme Co", "Brightly", "Vertex", "Onyx"].map(n => <span key={n} className="text-xl font-display italic">{n}</span>)}
      </div>
    </div>
  </section>
);

const About = () => (
  <section className="py-32" id="Agents IA">
    <div className="max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-20 items-center">
      <Reveal>
        <img src="https://images.unsplash.com/photo-1551434678-e076c223a692?auto=format&fit=crop&w=900&q=80" alt="team" className="rounded-2xl w-full h-[460px] object-cover border border-white/10" />
      </Reveal>
      <Reveal>
        <p className="text-xs uppercase tracking-[0.3em] text-accent mb-6">Notre mission</p>
        <h2 className="font-display text-4xl md:text-5xl leading-tight tracking-tight mb-8">Zéro email manqué, une autonomie totale de l'IA</h2>
        <p className="text-secondary leading-relaxed mb-6">aura-spark a été pensé pour les professionnels submergés. Nos agents apprennent votre ton, comprennent le contexte de chaque conversation et agissent avec discernement — sans jamais vous laisser de côté.</p>
        <p className="text-secondary leading-relaxed">Concentrez-vous sur l'essentiel pendant que vos agents traitent le bruit. Vous gardez le contrôle, l'IA fait le travail.</p>
      </Reveal>
    </div>
  </section>
);

const Features = () => {
  const items = [
    ["Tri intelligent", "Chaque email est classé par intention, urgence et expéditeur, automatiquement.", "M3 6h18M7 12h10M11 18h2"],
    ["Réponses automatiques", "Vos agents rédigent et envoient des réponses pertinentes dans votre style.", "m22 2-7 20-4-9-9-4Z"],
    ["Résumés de threads", "Des fils interminables condensés en quelques lignes lisibles.", "M4 6h16M4 10h16M4 14h10M4 18h7"],
    ["Priorisation contextuelle", "L'IA détecte ce qui compte vraiment et le remonte en haut.", "M12 2 15 9l7 .5-5.5 4.5L18 21l-6-4-6 4 1.5-7L2 9.5 9 9Z"],
    ["Multi-comptes", "Gmail, Outlook, IMAP — tous vos comptes réunis et orchestrés.", "M16 11a4 4 0 1 0-8 0M2 20a8 8 0 0 1 16 0"],
    ["Confidentialité & RGPD", "Chiffrement de bout en bout et conformité européenne par défaut.", "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"]
  ];
  return (
    <section className="py-32 border-t border-white/5" id="Fonctionnalités">
      <div className="max-w-7xl mx-auto px-6">
        <Reveal><h2 className="font-display text-4xl md:text-5xl tracking-tight mb-16 max-w-2xl">Tout ce dont vos emails ont besoin, en autonomie</h2></Reveal>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 border-l border-t border-white/10">
          {items.map(([t, d, p], i) => (
            <Reveal key={i}>
              <div className="p-10 border-r border-b border-white/10 group hover:bg-white/[0.03] transition-colors duration-300 h-full">
                <div className="w-12 h-12 rounded-full border border-white/15 flex items-center justify-center mb-6 text-accent group-hover:bg-accent group-hover:text-white transition-colors"><Icon d={p} c="w-5 h-5" /></div>
                <h3 className="text-xl font-medium mb-3">{t}</h3>
                <p className="text-secondary text-sm leading-relaxed">{d}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
};

const Process = () => {
  const steps = [
    ["01", "Connectez votre boîte", "Liez Gmail, Outlook ou tout compte IMAP en quelques secondes."],
    ["02", "Configurez vos agents", "Définissez le ton, les règles et le périmètre de chaque agent."],
    ["03", "L'IA répond pour vous", "Vos agents trient, résument et répondent en continu."],
    ["04", "Validez d'un clic", "Gardez la main : approuvez ou laissez l'IA agir seule."]
  ];
  return (
    <section className="py-32 border-t border-white/5">
      <div className="max-w-7xl mx-auto px-6">
        <Reveal><h2 className="font-display text-4xl md:text-5xl tracking-tight mb-16">Comment ça marche</h2></Reveal>
        <div className="grid md:grid-cols-4 gap-px bg-white/10">
          {steps.map(([n, t, d], i) => (
            <Reveal key={i}>
              <div className="bg-base p-8 h-full">
                <div className="text-5xl font-display italic text-accent mb-6">{n}</div>
                <h3 className="text-lg font-medium mb-3">{t}</h3>
                <p className="text-secondary text-sm leading-relaxed">{d}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
};

const Testimonials = () => {
  const data = [
    ["J'ai récupéré 2 heures par jour. Mon agent répond mieux que moi avant mon café.", "Camille R.", "Fondatrice, Studio Lumio", "photo-1494790108377-be9c29b29330"],
    ["aura-spark a vidé une boîte de 4000 mails non lus en une semaine. Magique.", "Thomas V.", "Head of Ops, Vertex", "photo-1500648767791-00dcc994a43e"],
    ["L'IA comprend le contexte mieux que je ne l'espérais. Zéro email important manqué.", "Inès M.", "Consultante indépendante", "photo-1438761681033-6461ffad8d80"]
  ];
  return (
    <section className="py-32 border-t border-white/5">
      <div className="max-w-7xl mx-auto px-6">
        <Reveal><h2 className="font-display text-4xl md:text-5xl tracking-tight mb-16">Des heures gagnées, chaque jour</h2></Reveal>
        <div className="grid md:grid-cols-3 gap-8">
          {data.map(([q, n, r, img], i) => (
            <Reveal key={i}>
              <div className="border border-white/10 rounded-2xl p-8 h-full hover:bg-white/[0.03] transition-colors">
                <p className="text-lg leading-relaxed mb-8">"{q}"</p>
                <div className="flex items-center gap-4">
                  <img src={`https://images.unsplash.com/${img}?auto=format&fit=crop&w=100&q=80`} alt={n} className="w-12 h-12 rounded-full object-cover" />
                  <div><p className="font-medium text-sm">{n}</p><p className="text-secondary text-xs">{r}</p></div>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
};

const Pricing = () => {
  const plans = [
    ["Solo", "9€", "Pour un compte unique", ["1 boîte mail", "Tri & résumés IA", "100 réponses / mois"], false],
    ["Pro", "29€", "Pour les pros exigeants", ["5 boîtes mail", "Réponses illimitées", "Priorisation avancée", "Support prioritaire"], true],
    ["Équipe", "79€", "Pour les équipes", ["Comptes illimités", "Agents partagés", "RGPD & audit", "Onboarding dédié"], false]
  ];
  return (
    <section className="py-32 border-t border-white/5" id="Tarifs">
      <div className="max-w-7xl mx-auto px-6">
        <Reveal><h2 className="font-display text-4xl md:text-5xl tracking-tight mb-16">Tarifs simples, sans surprise</h2></Reveal>
        <div className="grid md:grid-cols-3 gap-8">
          {plans.map(([n, p, s, f, hot], i) => (
            <Reveal key={i}>
              <div className={`rounded-2xl p-8 h-full border ${hot ? "border-accent bg-white/[0.04]" : "border-white/10"}`}>
                <p className="text-sm uppercase tracking-widest text-secondary mb-4">{n}</p>
                <div className="flex items-end gap-2 mb-2"><span className="text-5xl font-display">{p}</span><span className="text-secondary mb-1">/mois</span></div>
                <p className="text-secondary text-sm mb-8">{s}</p>
                <ul className="space-y-3 mb-8">
                  {f.map(x => <li key={x} className="flex items-center gap-3 text-sm"><Icon d="m5 12 5 5L20 7" c="w-4 h-4 text-accent" />{x}</li>)}
                </ul>
                <a href="#" className={`block text-center py-3 rounded-full text-sm font-medium transition-colors ${hot ? "bg-accent text-white hover:bg-white hover:text-base" : "bg-offwhite text-base hover:bg-accent hover:text-white"}`}>Choisir {n}</a>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
};

const FAQ = () => {
  const [active, setActive] = useState(0);
  const qa = [
    ["Mes emails sont-ils en sécurité ?", "Oui. aura-spark chiffre toutes les données de bout en bout et est entièrement conforme RGPD. Vos emails ne sont jamais utilisés pour entraîner des modèles tiers."],
    ["L'IA peut-elle répondre sans mon approbation ?", "Vous décidez. Chaque agent peut fonctionner en mode validation manuelle ou en autonomie complète selon vos règles."],
    ["Avec quels fournisseurs êtes-vous compatibles ?", "Gmail, Outlook, et tout compte via IMAP/SMTP. L'intégration prend moins d'une minute."],
    ["L'agent apprend-il mon style d'écriture ?", "Absolument. L'agent analyse vos échanges passés pour reproduire votre ton, votre signature et vos formulations."],
    ["Puis-je essayer gratuitement ?", "Oui, un essai gratuit de 14 jours est disponible sans carte bancaire."]
  ];
  return (
    <section className="py-32 border-t border-white/5" id="FAQ">
      <div className="max-w-3xl mx-auto px-6">
        <Reveal><h2 className="font-display text-4xl md:text-5xl tracking-tight mb-16">Questions fréquentes</h2></Reveal>
        <div className="divide-y divide-white/10 border-t border-b border-white/10">
          {qa.map(([q, a], i) => (
            <div key={i} className="py-2">
              <button onClick={() => setActive(active === i ? -1 : i)} className="w-full flex items-center justify-between py-5 text-left">
                <span className="text-lg font-medium">{q}</span>
                <Icon d="m6 9 6 6 6-6" c={`w-5 h-5 transition-transform duration-300 ${active === i ? "rotate-180 text-accent" : ""}`} />
              </button>
              <div className={`overflow-hidden transition-all duration-300 ${active === i ? "max-h-40" : "max-h-0"}`}>
                <p className="text-secondary leading-relaxed pb-5">{a}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

const CTA = () => (
  <section className="py-32 border-t border-white/5">
    <div className="max-w-7xl mx-auto px-6 text-center">
      <Reveal>
        <h2 className="font-display text-5xl md:text-7xl tracking-tight mb-10 leading-[0.95]">Prêt à ne plus jamais <span className="italic">subir</span> vos emails ?</h2>
        <a href="#" className="inline-block px-10 py-4 rounded-full bg-offwhite text-base font-medium hover:bg-accent hover:text-white transition-colors duration-300">Déployer mon agent</a>
      </Reveal>
    </div>
  </section>
);

const Footer = () => (
  <footer className="border-t border-white/5 pt-20">
    <div className="max-w-7xl mx-auto px-6 grid md:grid-cols-4 gap-12 pb-16">
      <div>
        <p className="text-2xl font-display italic mb-4">aura<span className="not-italic font-sans font-semibold">-spark.</span></p>
        <p className="text-secondary text-sm leading-relaxed">Des agents IA qui gèrent vos emails à votre place.</p>
      </div>
      {[["Produit", ["Fonctionnalités", "Agents IA", "Tarifs", "Sécurité"]], ["Entreprise", ["À propos", "Blog", "Carrières", "Contact"]], ["Légal", ["Mentions légales", "Confidentialité", "RGPD", "CGU"]]].map(([t, l]) => (
        <div key={t}>
          <p className="text-sm font-medium mb-5">{t}</p>
          <ul className="space-y-3">{l.map(x => <li key={x}><a href="#" className="text-secondary text-sm hover:text-offwhite transition-colors">{x}</a></li>)}</ul>
        </div>
      ))}
    </div>
    <div className="border-t border-white/5">
      <div className="max-w-7xl mx-auto px-6 py-8 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-secondary">
        <p>© 2026 aura-spark. Tous droits réservés.</p>
        <div className="flex gap-6"><a href="#" className="hover:text-offwhite">Behance</a><a href="#" className="hover:text-offwhite">LinkedIn</a><a href="#" className="hover:text-offwhite">GitHub</a></div>
      </div>
    </div>
  </footer>
);

const App = () => (
  <div className="bg-base text-offwhite">
    <Nav />
    <Hero />
    <Logos />
    <About />
    <Features />
    <Process />
    <Testimonials />
    <Pricing />
    <FAQ />
    <CTA />
    <Footer />
  </div>
);

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(React.createElement(App));