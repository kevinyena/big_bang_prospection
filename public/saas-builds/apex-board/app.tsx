const { useState, useEffect } = React;

const Marquee = () => {
  const items = ["★ Founder-AI Email","★ Agents autonomes","★ Tri intelligent","★ Réponses auto","★ Gmail & Outlook","★ Confidentialité"];
  return (
    <div className="w-full bg-brand-pink text-white py-3 overflow-hidden relative z-20 border-y-4 border-black/20 shadow-xl">
      <div className="animate-marquee whitespace-nowrap flex items-center gap-12">
        {[...items, ...items].map((t, i) => (
          <span key={i} className="font-black uppercase tracking-widest text-lg mx-4">{t}</span>
        ))}
      </div>
    </div>
  );
};

const Nav = () => {
  const [open, setOpen] = useState(false);
  const links = [["Fonctionnalités","#features"],["Comment ça marche","#how"],["Tarifs","#pricing"],["FAQ","#faq"]];
  return (
    <header className="fixed left-0 right-0 z-50 flex flex-col font-sans top-9">
      <div className="w-full transition-all duration-300 bg-transparent py-4 md:py-6 bg-gradient-to-b from-brand-blue/80 to-transparent">
        <div className="container mx-auto px-6 flex justify-between items-center">
          <a href="#home" className="block group no-underline select-none">
            <span className="text-2xl md:text-3xl font-black font-display text-white tracking-tight">apex<span className="text-brand-pink">-board</span></span>
          </a>
          <nav className="hidden md:flex items-center gap-8">
            {links.map(([t,h]) => (
              <a key={t} href={h} className="relative text-sm font-bold text-slate-200 hover:text-white transition-colors uppercase tracking-widest group">
                {t}<span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-brand-pink transition-all duration-300 group-hover:w-full"></span>
              </a>
            ))}
            <a href="#pricing" className="relative px-6 py-2 text-white font-bold uppercase tracking-wider group overflow-hidden">
              <span className="relative z-10">Essai gratuit</span>
              <div className="absolute inset-0 border-2 border-brand-pink rounded-sm transform skew-x-[-10deg] group-hover:skew-x-0 transition-transform"></div>
              <div className="absolute inset-0 bg-brand-pink transform translate-x-full group-hover:translate-x-0 transition-transform duration-300 -skew-x-12 opacity-40"></div>
            </a>
          </nav>
          <button onClick={() => setOpen(!open)} className="md:hidden text-white p-2" aria-label="Menu">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 5h16"/><path d="M4 12h16"/><path d="M4 19h16"/></svg>
          </button>
        </div>
        {open && (
          <div className="md:hidden container mx-auto px-6 mt-4 flex flex-col gap-4 bg-brand-dark/95 rounded-lg p-6 border border-white/10">
            {links.map(([t,h]) => <a key={t} href={h} onClick={() => setOpen(false)} className="text-sm font-bold text-slate-200 uppercase tracking-widest">{t}</a>)}
            <a href="#pricing" onClick={() => setOpen(false)} className="px-6 py-2 bg-brand-pink text-white font-bold uppercase tracking-wider text-center rounded-sm">Essai gratuit</a>
          </div>
        )}
      </div>
    </header>
  );
};

const Hero = () => (
  <section id="home" className="relative w-full min-h-screen flex flex-col items-center justify-center overflow-hidden bg-brand-blue pt-24">
    <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff1a_1px,transparent_1px),linear-gradient(to_bottom,#ffffff1a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]"></div>
    <div className="container mx-auto px-6 relative z-20 py-12 flex flex-col items-center text-center">
      <span className="inline-block mb-6 px-4 py-1.5 rounded-full bg-brand-pink/20 border border-brand-pink/40 text-brand-pink font-bold text-xs uppercase tracking-widest">🤖 Vos agents IA email, 24/7</span>
      <h1 className="text-4xl md:text-6xl lg:text-7xl font-black text-white leading-[0.95] tracking-tight mb-6 uppercase max-w-6xl mx-auto drop-shadow-2xl font-display">
        Vos agents IA gèrent<br/>
        <span className="relative inline-block mt-2">
          <span className="relative z-10 text-transparent bg-clip-text bg-gradient-to-r from-brand-pink via-white to-brand-pink animate-pulse">"votre boîte mail"</span>
          <svg aria-hidden="true" className="absolute w-full h-6 -bottom-2 left-0 text-brand-pink z-0" viewBox="0 0 100 10" preserveAspectRatio="none"><path d="M0 5 Q 50 10 100 5" stroke="currentColor" strokeWidth="3" fill="none"/></svg>
        </span><br/>
        <span className="text-2xl md:text-4xl lg:text-5xl text-white/90 block">trient, priorisent<br/>et répondent à votre place.</span>
      </h1>
      <div className="text-xl md:text-2xl text-blue-200 leading-relaxed max-w-3xl mx-auto mb-10 font-hand space-y-2">
        <p className="font-bold text-white">Pas un client mail. Une infrastructure.</p>
        <p>Mes agents, mes règles, mes réponses automatiques.</p>
        <p className="text-white/90">Vous ne croulez plus jamais sous les emails.</p>
      </div>
      <div className="flex flex-col sm:flex-row items-center gap-4 mb-6">
        <a href="#pricing" className="group inline-flex items-center justify-center gap-3 px-8 py-4 bg-brand-pink text-white font-black uppercase tracking-wider text-base md:text-lg hover:bg-[#d060d5] transition-all hover:scale-[1.02] shadow-xl rounded-sm">
          Connecter ma boîte mail
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="group-hover:translate-x-1 transition-transform"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
        </a>
        <a href="#how" className="group inline-flex items-center justify-center gap-3 px-6 py-4 text-white font-bold uppercase tracking-wider text-sm md:text-base border-2 border-white/30 hover:border-brand-pink hover:text-brand-pink transition-all rounded-sm">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 5 19z"/></svg>
          Voir une démo
        </a>
      </div>
      <p className="text-blue-300 font-hand text-sm md:text-base">Essai gratuit 14 jours · Sans carte bancaire · Annulez à tout moment</p>
    </div>
    <Stats />
    <Marquee />
  </section>
);

const Stats = () => {
  const stats = [["+1M","emails traités"],["8h","économisées/semaine"],["99%","de tri précis"]];
  return (
    <div className="w-full bg-brand-dark/80 border-t border-white/5 py-6 relative z-20 mt-auto">
      <div className="container mx-auto px-6">
        <div className="flex flex-wrap items-center justify-center gap-8 md:gap-16">
          {stats.map(([n,l]) => (
            <div key={l} className="flex items-center gap-3 text-center">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-brand-pink"><path d="m22 7-8.5 8.5-5-5L2 17"/><path d="M16 7h6v6"/></svg>
              <div><p className="text-white font-black font-display text-xl leading-none">{n}</p><p className="text-blue-400 font-hand text-xs">{l}</p></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const Features = () => {
  const feats = [
    ["🧠","Tri intelligent","Les agents IA classent automatiquement vos emails par priorité et catégorie."],
    ["✍️","Réponses automatiques","L'IA rédige et envoie des réponses directement, dans votre ton."],
    ["📌","Priorisation","Les emails urgents remontent en haut, le bruit est filtré."],
    ["🔗","Intégrations","Gmail, Outlook, IMAP : connexion en 1 clic."],
    ["🛡️","Confidentialité","Vos données restent chiffrées et privées."],
    ["📊","Tableau de bord","Suivez l'activité de vos agents en temps réel."],
  ];
  return (
    <section id="features" className="py-24 md:py-32 bg-brand-blue relative">
      <div className="container mx-auto px-6">
        <div className="text-center mb-16">
          <span className="text-brand-pink font-bold uppercase tracking-widest text-sm">Fonctionnalités</span>
          <h2 className="text-3xl md:text-5xl font-black font-display text-white uppercase mt-4 leading-tight">Une infrastructure email<br/>pilotée par l'IA.</h2>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {feats.map(([icon,t,d]) => (
            <div key={t} className="bg-brand-dark/60 border border-white/10 rounded-xl p-8 hover:border-brand-pink/50 transition-all hover:-translate-y-1 group">
              <div className="text-4xl mb-4">{icon}</div>
              <h3 className="text-xl font-black font-display text-white uppercase mb-3 group-hover:text-brand-pink transition-colors">{t}</h3>
              <p className="text-blue-200 leading-relaxed">{d}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

const How = () => {
  const steps = [
    ["01","Connectez votre boîte mail","Liez Gmail, Outlook ou n'importe quelle adresse IMAP en un seul clic, sans configuration technique.","https://images.unsplash.com/photo-1596526131083-e8c633c948d2?auto=format&fit=crop&w=800&q=80"],
    ["02","Configurez vos agents IA","Définissez les règles de tri, le ton de vos réponses et les catégories prioritaires de vos agents.","https://images.unsplash.com/photo-1677442136019-21780ecad995?auto=format&fit=crop&w=800&q=80"],
    ["03","Laissez-les travailler","Vos agents trient, priorisent et répondent à votre place pendant que vous vous concentrez sur l'essentiel.","https://images.unsplash.com/photo-1551434678-e076c223a692?auto=format&fit=crop&w=800&q=80"],
  ];
  return (
    <section id="how" className="py-24 md:py-32 bg-brand-deep relative">
      <div className="container mx-auto px-6">
        <div className="text-center mb-16">
          <span className="text-brand-pink font-bold uppercase tracking-widest text-sm">Comment ça marche</span>
          <h2 className="text-3xl md:text-5xl font-black font-display text-white uppercase mt-4">Opérationnel en 3 étapes.</h2>
        </div>
        <div className="space-y-16">
          {steps.map(([n,t,d,img], i) => (
            <div key={n} className={`flex flex-col ${i%2 ? 'md:flex-row-reverse' : 'md:flex-row'} items-center gap-10`}>
              <div className="md:w-1/2">
                <span className="text-6xl font-black font-display text-brand-pink/40">{n}</span>
                <h3 className="text-2xl md:text-3xl font-black font-display text-white uppercase mt-2 mb-4">{t}</h3>
                <p className="text-blue-200 text-lg leading-relaxed">{d}</p>
              </div>
              <div className="md:w-1/2">
                <img src={img} alt={t} className="rounded-2xl border border-white/10 w-full h-72 object-cover shadow-2xl"/>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

const Testimonials = () => {
  const tts = [
    ["apex-board répond à 70% de mes emails clients tout seul. Je récupère des heures chaque jour.","Camille Roussel","Fondatrice, NovaShop","https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&q=80"],
    ["Le tri intelligent a transformé ma boîte. Plus de bruit, juste l'essentiel en haut.","Thomas Lemoine","Commercial, B2B SaaS","https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80"],
    ["Mon équipe support traite deux fois plus de tickets grâce aux agents IA.","Sofia Martinez","Head of Support, Flowdesk","https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=200&q=80"],
  ];
  return (
    <section className="py-24 md:py-32 bg-brand-blue">
      <div className="container mx-auto px-6">
        <div className="text-center mb-16">
          <span className="text-brand-pink font-bold uppercase tracking-widest text-sm">Témoignages</span>
          <h2 className="text-3xl md:text-5xl font-black font-display text-white uppercase mt-4">Ils ont repris le contrôle.</h2>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {tts.map(([q,n,r,img]) => (
            <div key={n} className="bg-brand-dark/60 border border-white/10 rounded-xl p-8">
              <p className="text-blue-100 text-lg font-hand leading-relaxed mb-6">"{q}"</p>
              <div className="flex items-center gap-4">
                <img src={img} alt={n} className="w-12 h-12 rounded-full object-cover"/>
                <div><p className="text-white font-bold">{n}</p><p className="text-blue-400 text-sm">{r}</p></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

const Pricing = () => {
  const plans = [
    ["Starter","19€","/mois",["1 boîte mail connectée","Tri intelligent","Tableau de bord","Support email"],false],
    ["Pro","49€","/mois",["Jusqu'à 5 boîtes mail","Réponses automatiques","Priorisation avancée","Intégrations illimitées","Support prioritaire"],true],
    ["Business","Sur devis","",["Boîtes illimitées","Agents pour équipes","SSO & sécurité avancée","Account manager dédié","SLA garanti"],false],
  ];
  return (
    <section id="pricing" className="py-24 md:py-32 bg-brand-deep">
      <div className="container mx-auto px-6">
        <div className="text-center mb-16">
          <span className="text-brand-pink font-bold uppercase tracking-widest text-sm">Tarifs</span>
          <h2 className="text-3xl md:text-5xl font-black font-display text-white uppercase mt-4">Choisissez votre plan.</h2>
        </div>
        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto items-stretch">
          {plans.map(([name,price,per,feats,pop]) => (
            <div key={name} className={`rounded-2xl p-8 flex flex-col ${pop ? 'bg-brand-pink/10 border-2 border-brand-pink scale-105 shadow-2xl' : 'bg-brand-dark/60 border border-white/10'}`}>
              {pop && <span className="self-start mb-4 px-3 py-1 bg-brand-pink text-white text-xs font-bold uppercase tracking-widest rounded-full">Populaire</span>}
              <h3 className="text-2xl font-black font-display text-white uppercase">{name}</h3>
              <div className="my-4"><span className="text-4xl font-black text-white">{price}</span><span className="text-blue-300">{per}</span></div>
              <ul className="space-y-3 mb-8 flex-1">
                {feats.map(f => (
                  <li key={f} className="flex items-center gap-3 text-blue-100">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="text-brand-pink shrink-0"><path d="M20 6 9 17l-5-5"/></svg>{f}
                  </li>
                ))}
              </ul>
              <a href="#" className={`text-center px-6 py-3 font-bold uppercase tracking-wider rounded-sm transition-all ${pop ? 'bg-brand-pink text-white hover:bg-[#d060d5]' : 'border-2 border-white/30 text-white hover:border-brand-pink hover:text-brand-pink'}`}>Démarrer</a>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

const FAQ = () => {
  const [open, setOpen] = useState(0);
  const faqs = [
    ["L'IA peut-elle vraiment répondre seule ?","Oui. Vos agents rédigent et envoient des réponses dans votre ton selon vos règles. Vous pouvez aussi activer une validation manuelle avant envoi."],
    ["Mes données sont-elles sécurisées ?","Absolument. Toutes vos données sont chiffrées de bout en bout et ne sont jamais utilisées pour entraîner des modèles tiers."],
    ["Quelles messageries sont supportées ?","Gmail, Outlook et toute adresse compatible IMAP. La connexion se fait en un clic via OAuth sécurisé."],
    ["Puis-je valider avant envoi ?","Oui. Activez le mode brouillon pour relire et approuver chaque réponse, ou laissez vos agents envoyer automatiquement."],
  ];
  return (
    <section id="faq" className="py-24 md:py-32 bg-brand-blue">
      <div className="container mx-auto px-6 max-w-3xl">
        <div className="text-center mb-16">
          <span className="text-brand-pink font-bold uppercase tracking-widest text-sm">FAQ</span>
          <h2 className="text-3xl md:text-5xl font-black font-display text-white uppercase mt-4">Questions fréquentes.</h2>
        </div>
        <div className="space-y-4">
          {faqs.map(([q,a], i) => (
            <div key={i} className="bg-brand-dark/60 border border-white/10 rounded-xl overflow-hidden">
              <button onClick={() => setOpen(open===i?-1:i)} className="w-full flex justify-between items-center p-6 text-left">
                <span className="text-white font-bold text-lg">{q}</span>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className={`text-brand-pink transition-transform ${open===i?'rotate-45':''}`}><path d="M12 5v14"/><path d="M5 12h14"/></svg>
              </button>
              {open===i && <div className="px-6 pb-6 text-blue-200 leading-relaxed">{a}</div>}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

const FinalCTA = () => (
  <section className="py-24 md:py-32 bg-brand-deep relative overflow-hidden">
    <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_50%_at_50%_50%,#E879F933,transparent)]"></div>
    <div className="container mx-auto px-6 relative z-10 text-center">
      <h2 className="text-3xl md:text-6xl font-black font-display text-white uppercase max-w-4xl mx-auto leading-tight mb-8">Reprenez le contrôle<br/>de votre boîte mail.</h2>
      <a href="#pricing" className="inline-flex items-center gap-3 px-10 py-5 bg-brand-pink text-white font-black uppercase tracking-wider text-lg hover:bg-[#d060d5] transition-all hover:scale-[1.02] shadow-xl rounded-sm">
        Démarrer gratuitement
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
      </a>
    </div>
  </section>
);

const Footer = () => (
  <footer className="bg-brand-dark border-t border-white/10 py-16">
    <div className="container mx-auto px-6">
      <div className="grid md:grid-cols-4 gap-10 mb-12">
        <div>
          <span className="text-2xl font-black font-display text-white">apex<span className="text-brand-pink">-board</span></span>
          <p className="text-blue-300 font-hand text-lg mt-3">Vos agents IA pour l'email.</p>
        </div>
        {[["Produit",["Fonctionnalités","Tarifs","Intégrations","Sécurité"]],["Ressources",["Blog","Documentation","Guides","API"]],["Légal",["Mentions légales","Confidentialité","CGU","Cookies"]]].map(([t,ls]) => (
          <div key={t}>
            <h4 className="text-white font-bold uppercase tracking-widest text-sm mb-4">{t}</h4>
            <ul className="space-y-2">{ls.map(l => <li key={l}><a href="#" className="text-blue-300 hover:text-brand-pink transition-colors">{l}</a></li>)}</ul>
          </div>
        ))}
      </div>
      <div className="flex flex-col md:flex-row justify-between items-center pt-8 border-t border-white/10 gap-4">
        <p className="text-blue-400 text-sm">© 2024 apex-board. Tous droits réservés.</p>
        <div className="flex gap-4">
          {["M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 16.2.3 12.6 1 8c2 2.5 5 3.5 8 3.5C7.5 8.8 9.6 5 13 5c1.5 0 3 .6 4 1.7 1.3-.3 2.5-.8 3.5-1.5z","M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4v-7a6 6 0 0 1 6-6z M2 9h4v12H2z M4 6a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"].map((d,i) => (
            <a key={i} href="#" className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-blue-300 hover:text-brand-pink hover:border-brand-pink transition-colors">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={d}/></svg>
            </a>
          ))}
        </div>
      </div>
    </div>
  </footer>
);

const Banner = () => (
  <div className="fixed top-0 left-0 right-0 z-[60] w-full text-white text-xs md:text-sm shadow-lg bg-brand-pink">
    <div className="max-w-7xl mx-auto px-3 py-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-center">
      <span className="font-semibold">🎯 Offre de lancement : -50%</span>
      <span className="opacity-90">— votre essai gratuit démarre maintenant</span>
      <span className="opacity-70 hidden sm:inline">· Sans carte bancaire</span>
    </div>
  </div>
);

const App = () => (
  <div className="min-h-screen bg-brand-blue text-white overflow-x-hidden selection:bg-brand-pink selection:text-white font-sans">
    <Banner />
    <Nav />
    <main>
      <Hero />
      <Features />
      <How />
      <Testimonials />
      <Pricing />
      <FAQ />
      <FinalCTA />
    </main>
    <Footer />
  </div>
);

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(React.createElement(App));