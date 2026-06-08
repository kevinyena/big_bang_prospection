const { useState, useEffect, useRef, useCallback } = React;

const STARTUPS = [
  { id: 1, name: 'NeuralFlow', sector: 'AI Infrastructure', tag: 'GPU orchestration for inference at 1/10th the cost', logo: '🧠', ask: '$2.5M', stage: 'Seed', mrr: '$48K', growth: '+22% MoM', team: '7', color: 'from-violet-500 to-fuchsia-500' },
  { id: 2, name: 'GreenCart', sector: 'Climate · Commerce', tag: 'Carbon-neutral checkout for any e-shop in 1 line', logo: '🌱', ask: '$800K', stage: 'Pre-seed', mrr: '$12K', growth: '+41% MoM', team: '4', color: 'from-emerald-500 to-teal-500' },
  { id: 3, name: 'Ledgr', sector: 'Fintech · B2B', tag: 'Real-time treasury & FX for global startups', logo: '💸', ask: '$5M', stage: 'Series A', mrr: '$210K', growth: '+18% MoM', team: '19', color: 'from-orange-500 to-pink-500' },
  { id: 4, name: 'Pulse Health', sector: 'HealthTech', tag: 'AI triage that cuts ER wait times by 60%', logo: '🩺', ask: '$3.2M', stage: 'Seed', mrr: '$76K', growth: '+27% MoM', team: '11', color: 'from-rose-500 to-purple-500' },
  { id: 5, name: 'Looply', sector: 'Creator Economy', tag: 'Turn any podcast into 30 viral clips instantly', logo: '🎬', ask: '$1.2M', stage: 'Pre-seed', mrr: '$31K', growth: '+55% MoM', team: '5', color: 'from-pink-500 to-orange-400' },
];
const VCS = [
  { id: 101, name: 'Aperture Capital', sector: 'Seed · Series A', tag: 'We back technical founders building category leaders', logo: '🔭', ask: '$250K–$5M', stage: 'Lead', mrr: '120 deals', growth: 'B2B SaaS', team: '14', color: 'from-indigo-500 to-violet-500' },
  { id: 102, name: 'Nova Angels', sector: 'Pre-seed', tag: 'Operator angels who roll up sleeves with you', logo: '⭐', ask: '$25K–$250K', stage: 'Angel', mrr: '60 deals', growth: 'Climate · AI', team: '8', color: 'from-amber-500 to-orange-500' },
  { id: 103, name: 'Meridian Ventures', sector: 'Series A–B', tag: 'Global fund for breakout growth-stage teams', logo: '🌐', ask: '$5M–$20M', stage: 'Lead', mrr: '90 deals', growth: 'Fintech', team: '30', color: 'from-fuchsia-500 to-pink-500' },
  { id: 104, name: 'Catalyst Fund', sector: 'Seed', tag: 'Fast term sheets, founder-friendly terms', logo: '⚡', ask: '$500K–$3M', stage: 'Co-lead', mrr: '75 deals', growth: 'DeepTech', team: '10', color: 'from-cyan-500 to-blue-500' },
];

function Logo({ size = 'text-xl' }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-9 w-9 rounded-xl bg-spark-gradient flex items-center justify-center shadow-neon font-black">S</div>
      <span className={`${size} font-extrabold tracking-tight`}>SmartSpark</span>
    </div>
  );
}

function Navbar({ onStart }) {
  return (
    <nav className="sticky top-0 z-50 backdrop-blur-xl bg-charbon-900/80 border-b border-white/10">
      <div className="max-w-7xl mx-auto px-5 h-16 flex items-center justify-between">
        <Logo />
        <div className="hidden md:flex items-center gap-8 text-sm text-white/60 font-medium">
          {['How it works', 'For Founders', 'For Investors', 'Stories'].map(x => <a key={x} className="hover:text-white transition" href="#">{x}</a>)}
        </div>
        <button onClick={onStart} className="px-5 py-2.5 rounded-full bg-spark-gradient text-sm font-bold shadow-neon hover:scale-105 transition">Start Swiping</button>
      </div>
    </nav>
  );
}

function FloatingCard({ s, style }) {
  return (
    <div style={style} className="absolute w-44 rounded-3xl overflow-hidden border border-white/15 backdrop-blur-md bg-charbon-800/70 shadow-2xl p-4">
      <div className={`h-24 rounded-2xl bg-gradient-to-br ${s.color} flex items-center justify-center text-4xl mb-3`}>{s.logo}</div>
      <p className="font-bold text-sm">{s.name}</p>
      <p className="text-[10px] text-white/50">{s.sector}</p>
      <div className="mt-2 flex gap-1"><span className="text-[9px] px-2 py-0.5 rounded-full bg-white/10">{s.stage}</span><span className="text-[9px] px-2 py-0.5 rounded-full bg-spark-violet/20 text-spark-electric">{s.ask}</span></div>
    </div>
  );
}

function Hero({ onStart }) {
  return (
    <section className="relative overflow-hidden pt-20 pb-28 px-5">
      <div className="absolute -top-40 -left-40 h-96 w-96 rounded-full bg-spark-violet/30 blur-3xl" />
      <div className="absolute top-20 right-0 h-96 w-96 rounded-full bg-spark-magenta/20 blur-3xl" />
      <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-12 items-center relative">
        <div>
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-white/15 bg-white/5 text-xs font-medium text-white/70 mb-6">🔥 Over $420M raised through matches</span>
          <h1 className="text-5xl md:text-7xl font-black leading-[1.05] tracking-tight">Where <span className="bg-spark-gradient bg-clip-text text-transparent">Founders</span> meet <span className="bg-spark-gradient bg-clip-text text-transparent">Capital</span>.</h1>
          <p className="mt-6 text-lg text-white/60 max-w-md">Swipe your way to your next round. SmartSpark connects early-stage founders with the right investors — one match at a time.</p>
          <div className="mt-8 flex flex-wrap gap-4">
            <button onClick={onStart} className="px-8 py-4 rounded-full bg-spark-gradient font-bold shadow-neon hover:scale-105 transition text-lg">Start Swiping →</button>
            <button className="px-8 py-4 rounded-full border border-white/20 bg-white/5 font-bold hover:bg-white/10 transition">Watch demo</button>
          </div>
          <div className="mt-10 flex gap-8">
            {[['12K+', 'Founders'], ['3.4K', 'Investors'], ['8.9K', 'Matches']].map(([n, l]) => (
              <div key={l}><p className="text-2xl font-black">{n}</p><p className="text-xs text-white/40">{l}</p></div>
            ))}
          </div>
        </div>
        <div className="relative h-[460px] hidden md:block">
          <FloatingCard s={STARTUPS[0]} style={{ top: 20, left: 60, transform: 'rotate(-8deg)' }} />
          <FloatingCard s={STARTUPS[2]} style={{ top: 90, left: 200, transform: 'rotate(6deg)', zIndex: 2 }} />
          <FloatingCard s={STARTUPS[4]} style={{ top: 240, left: 120, transform: 'rotate(-3deg)' }} />
        </div>
      </div>
    </section>
  );
}

function Logos() {
  return (
    <section className="py-12 border-y border-white/10">
      <p className="text-center text-xs uppercase tracking-widest text-white/30 mb-6">Trusted by leading funds & accelerators</p>
      <div className="flex flex-wrap justify-center gap-x-12 gap-y-4 text-white/40 font-bold text-lg">
        {['Sequoia', 'a16z', 'Y Combinator', 'Index', 'Accel', 'Lightspeed'].map(x => <span key={x} className="hover:text-white/70 transition">{x}</span>)}
      </div>
    </section>
  );
}

function Features() {
  const items = [
    { i: '🎯', t: 'Smart matching', d: 'Our algorithm surfaces investors aligned with your stage, sector & geography.' },
    { i: '💬', t: 'Secure chat', d: 'Once it’s mutual, a private encrypted channel opens to talk terms.' },
    { i: '⚡', t: 'Move fast', d: 'No more cold emails. Founders close intros 5x faster on SmartSpark.' },
  ];
  return (
    <section className="py-28 px-5">
      <div className="max-w-6xl mx-auto text-center">
        <h2 className="text-4xl md:text-5xl font-black">Fundraising, reinvented.</h2>
        <p className="mt-4 text-white/50 max-w-xl mx-auto">A swipe-first experience that makes finding the right partner feel effortless.</p>
        <div className="mt-16 grid md:grid-cols-3 gap-6">
          {items.map(x => (
            <div key={x.t} className="p-8 rounded-3xl border border-white/10 bg-charbon-800/50 backdrop-blur hover:border-spark-violet/40 hover:shadow-neon transition text-left">
              <div className="h-14 w-14 rounded-2xl bg-spark-gradient flex items-center justify-center text-2xl mb-5">{x.i}</div>
              <h3 className="text-xl font-bold mb-2">{x.t}</h3>
              <p className="text-white/50 text-sm">{x.d}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Testimonials() {
  const t = [
    { q: 'Matched with our lead investor in 48 hours. Closed our seed two weeks later.', n: 'Maya R.', r: 'CEO, NeuralFlow', a: '👩‍💻' },
    { q: 'I see more quality dealflow here than from my entire network combined.', n: 'David K.', r: 'Partner, Aperture', a: '🧑‍💼' },
    { q: 'The swipe format is dangerously addictive — and it actually works.', n: 'Leo T.', r: 'Founder, Looply', a: '🧑‍🎤' },
  ];
  return (
    <section className="py-28 px-5 bg-charbon-800/40">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-4xl md:text-5xl font-black text-center mb-16">Loved by both sides of the table.</h2>
        <div className="grid md:grid-cols-3 gap-6">
          {t.map(x => (
            <div key={x.n} className="p-8 rounded-3xl border border-white/10 bg-charbon-900/60 backdrop-blur">
              <p className="text-lg font-medium leading-relaxed">“{x.q}”</p>
              <div className="mt-6 flex items-center gap-3">
                <div className="h-11 w-11 rounded-full bg-spark-gradient flex items-center justify-center text-xl">{x.a}</div>
                <div><p className="font-bold text-sm">{x.n}</p><p className="text-xs text-white/40">{x.r}</p></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCTA({ onStart }) {
  return (
    <section className="py-28 px-5">
      <div className="max-w-4xl mx-auto rounded-[2.5rem] bg-spark-gradient p-12 md:p-16 text-center shadow-neon-pink relative overflow-hidden">
        <div className="absolute inset-0 bg-black/10" />
        <div className="relative">
          <h2 className="text-4xl md:text-6xl font-black">Your next round is one swipe away.</h2>
          <p className="mt-4 text-white/80 text-lg">Join thousands of founders and investors finding their perfect match.</p>
          <button onClick={onStart} className="mt-8 px-10 py-4 rounded-full bg-white text-charbon font-black text-lg hover:scale-105 transition shadow-xl">Start Swiping for free</button>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-white/10 py-12 px-5">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between gap-8">
        <div className="max-w-xs"><Logo /><p className="mt-4 text-sm text-white/40">Where founders meet capital — one match at a time.</p></div>
        <div className="flex gap-16 text-sm">
          {[['Product', ['Swipe', 'Matches', 'Pricing']], ['Company', ['About', 'Careers', 'Press']], ['Legal', ['Privacy', 'Terms']]].map(([h, l]) => (
            <div key={h}><p className="font-bold mb-3">{h}</p>{l.map(x => <p key={x} className="text-white/40 mb-2 hover:text-white transition cursor-pointer">{x}</p>)}</div>
          ))}
        </div>
      </div>
      <p className="text-center text-xs text-white/30 mt-10">© 2024 SmartSpark. All rights reserved.</p>
    </footer>
  );
}

function SwipeCard({ s, onSwipe, top }) {
  const [drag, setDrag] = useState({ x: 0, y: 0 });
  const [start, setStart] = useState(null);
  const ref = useRef(null);
  const down = e => { if (!top) return; const p = e.touches ? e.touches[0] : e; setStart({ x: p.clientX, y: p.clientY }); };
  const move = e => { if (!start) return; const p = e.touches ? e.touches[0] : e; setDrag({ x: p.clientX - start.x, y: p.clientY - start.y }); };
  const up = () => {
    if (!start) return;
    if (drag.x > 120) onSwipe('right');
    else if (drag.x < -120) onSwipe('left');
    else setDrag({ x: 0, y: 0 });
    setStart(null);
  };
  const rot = drag.x / 18;
  const like = Math.min(Math.max(drag.x / 120, 0), 1);
  const pass = Math.min(Math.max(-drag.x / 120, 0), 1);
  return (
    <div ref={ref} onMouseDown={down} onMouseMove={move} onMouseUp={up} onMouseLeave={up}
      onTouchStart={down} onTouchMove={move} onTouchEnd={up}
      style={{ transform: `translate(${drag.x}px,${drag.y}px) rotate(${rot}deg)`, transition: start ? 'none' : 'transform .4s cubic-bezier(.18,.89,.32,1.28)', zIndex: top ? 30 : 20 }}
      className={`absolute inset-0 rounded-[2rem] overflow-hidden border border-white/15 bg-charbon-800 shadow-2xl select-none ${top ? 'cursor-grab active:cursor-grabbing' : 'scale-95 translate-y-3'}`}>
      <div className={`h-2/5 bg-gradient-to-br ${s.color} flex items-center justify-center text-7xl relative`}>
        {s.logo}
        <span style={{ opacity: like }} className="absolute top-5 left-5 px-4 py-2 rounded-xl border-4 border-spark-like text-spark-like font-black text-2xl -rotate-12">LIKE</span>
        <span style={{ opacity: pass }} className="absolute top-5 right-5 px-4 py-2 rounded-xl border-4 border-spark-pass text-spark-pass font-black text-2xl rotate-12">PASS</span>
      </div>
      <div className="p-6">
        <div className="flex items-center justify-between">
          <h3 className="text-2xl font-black">{s.name}</h3>
          <span className="px-3 py-1 rounded-full bg-spark-violet/20 text-spark-electric text-xs font-bold">{s.stage}</span>
        </div>
        <p className="text-sm text-white/40 mt-0.5">{s.sector}</p>
        <p className="mt-4 text-white/70">{s.tag}</p>
        <div className="mt-6 grid grid-cols-3 gap-3 text-center">
          {[['Ask', s.ask], ['MRR', s.mrr], ['Growth', s.growth]].map(([l, v]) => (
            <div key={l} className="rounded-2xl bg-white/5 py-3 border border-white/10"><p className="font-bold text-sm">{v}</p><p className="text-[10px] text-white/40">{l}</p></div>
          ))}
        </div>
        <p className="mt-4 text-xs text-white/40">👥 Team of {s.team}</p>
      </div>
    </div>
  );
}

function MatchModal({ s, onClose, onChat }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-md px-6">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {Array.from({ length: 24 }).map((_, i) => (
          <span key={i} className="absolute text-2xl animate-bounce" style={{ left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%`, animationDelay: `${Math.random()}s` }}>{['🎉', '✨', '💜', '🔥'][i % 4]}</span>
        ))}
      </div>
      <div className="relative text-center max-w-sm">
        <h2 className="text-6xl font-black bg-spark-gradient bg-clip-text text-transparent">It's a Match!</h2>
        <p className="text-white/60 mt-3">You and {s.name} liked each other.</p>
        <div className="my-8 flex justify-center gap-4">
          <div className="h-24 w-24 rounded-full bg-spark-gradient flex items-center justify-center text-4xl shadow-neon">🚀</div>
          <div className={`h-24 w-24 rounded-full bg-gradient-to-br ${s.color} flex items-center justify-center text-4xl`}>{s.logo}</div>
        </div>
        <button onClick={onChat} className="w-full py-4 rounded-full bg-spark-gradient font-bold shadow-neon mb-3">Send a message</button>
        <button onClick={onClose} className="w-full py-4 rounded-full border border-white/20 font-bold">Keep swiping</button>
      </div>
    </div>
  );
}

function Chat({ matches, onClose }) {
  const [active, setActive] = useState(matches[0]?.id || null);
  const [msgs, setMsgs] = useState({});
  const [text, setText] = useState('');
  const cur = matches.find(m => m.id === active);
  const list = msgs[active] || [{ from: 'them', t: `Hey 👋 loved your profile — tell me more about ${cur?.name || 'it'}!` }];
  const send = () => {
    if (!text.trim()) return;
    setMsgs(p => ({ ...p, [active]: [...(p[active] || list), { from: 'me', t: text }] }));
    setText('');
    setTimeout(() => setMsgs(p => ({ ...p, [active]: [...(p[active] || []), { from: 'them', t: "Sounds great — let's set up a call this week 📅" }] })), 900);
  };
  return (
    <div className="fixed inset-0 z-[60] bg-charbon-900 flex flex-col md:flex-row">
      <div className="md:w-80 border-r border-white/10 flex flex-col">
        <div className="h-16 flex items-center justify-between px-5 border-b border-white/10">
          <h3 className="font-black text-lg">Matches</h3>
          <button onClick={onClose} className="text-white/50 hover:text-white text-xl">✕</button>
        </div>
        <div className="overflow-y-auto flex-1">
          {matches.length === 0 && <p className="p-6 text-white/40 text-sm">No matches yet — go swipe!</p>}
          {matches.map(m => (
            <button key={m.id} onClick={() => setActive(m.id)} className={`w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-white/5 transition ${active === m.id ? 'bg-white/5' : ''}`}>
              <div className={`h-12 w-12 rounded-full bg-gradient-to-br ${m.color} flex items-center justify-center text-xl relative`}>{m.logo}<span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-spark-like border-2 border-charbon-900" /></div>
              <div className="flex-1 min-w-0"><p className="font-bold text-sm truncate">{m.name}</p><p className="text-xs text-white/40 truncate">{m.tag}</p></div>
            </button>
          ))}
        </div>
      </div>
      {cur ? (
        <div className="flex-1 flex flex-col">
          <div className="h-16 flex items-center gap-3 px-5 border-b border-white/10">
            <div className={`h-10 w-10 rounded-full bg-gradient-to-br ${cur.color} flex items-center justify-center`}>{cur.logo}</div>
            <div><p className="font-bold text-sm">{cur.name}</p><p className="text-xs text-spark-like">● Online</p></div>
          </div>
          <div className="flex-1 overflow-y-auto p-5 space-y-3">
            {list.map((m, i) => (
              <div key={i} className={`flex ${m.from === 'me' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm ${m.from === 'me' ? 'bg-spark-gradient rounded-br-sm' : 'bg-white/10 rounded-bl-sm'}`}>{m.t}</div>
              </div>
            ))}
          </div>
          <div className="p-4 border-t border-white/10 flex gap-2">
            <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()} placeholder="Type a message…" className="flex-1 bg-white/5 border border-white/10 rounded-full px-5 py-3 text-sm outline-none focus:border-spark-violet" />
            <button onClick={send} className="px-6 rounded-full bg-spark-gradient font-bold">➤</button>
          </div>
        </div>
      ) : <div className="flex-1 flex items-center justify-center text-white/30">Select a match to chat</div>}
    </div>
  );
}

function Deck({ onBack }) {
  const [role, setRole] = useState('investor');
  const [idx, setIdx] = useState(0);
  const [matches, setMatches] = useState([]);
  const [matchPop, setMatchPop] = useState(null);
  const [showChat, setShowChat] = useState(false);
  const deck = role === 'investor' ? STARTUPS : VCS;
  const card = deck[idx];
  const swipe = dir => {
    if (dir === 'right' && card && Math.random() > 0.35) {
      if (!matches.find(m => m.id === card.id)) setMatches(p => [...p, card]);
      setMatchPop(card);
    }
    setIdx(i => i + 1);
  };
  const reset = () => setIdx(0);
  return (
    <div className="min-h-screen flex flex-col">
      <div className="sticky top-0 z-40 backdrop-blur-xl bg-charbon-900/80 border-b border-white/10 h-16 flex items-center justify-between px-5">
        <button onClick={onBack} className="text-white/60 hover:text-white text-sm font-medium">← Home</button>
        <Logo size="text-base" />
        <button onClick={() => setShowChat(true)} className="relative px-4 py-2 rounded-full bg-white/5 border border-white/10 text-sm font-bold hover:bg-white/10 transition">
          💬 {matches.length > 0 && <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-spark-magenta text-[10px] flex items-center justify-center">{matches.length}</span>}
        </button>
      </div>
      <div className="flex justify-center pt-6">
        <div className="inline-flex p-1 rounded-full bg-white/5 border border-white/10">
          {[['investor', '💰 Investor'], ['founder', '🚀 Founder']].map(([k, l]) => (
            <button key={k} onClick={() => { setRole(k); setIdx(0); }} className={`px-5 py-2 rounded-full text-sm font-bold transition ${role === k ? 'bg-spark-gradient shadow-neon' : 'text-white/50'}`}>{l}</button>
          ))}
        </div>
      </div>
      <p className="text-center text-xs text-white/40 mt-3">{role === 'investor' ? 'Swiping startups looking for capital' : 'Swiping investors ready to fund you'}</p>
      <div className="flex-1 flex flex-col items-center justify-center px-5 py-6">
        <div className="relative w-full max-w-sm h-[560px]">
          {card ? deck.slice(idx, idx + 2).reverse().map((s, i, arr) => (
            <SwipeCard key={s.id} s={s} top={i === arr.length - 1} onSwipe={swipe} />
          )) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center rounded-[2rem] border border-white/10 bg-charbon-800">
              <p className="text-5xl mb-4">🎉</p>
              <p className="font-bold text-xl">You're all caught up!</p>
              <p className="text-white/40 text-sm mt-2 mb-6">Check back later for fresh profiles.</p>
              <button onClick={reset} className="px-6 py-3 rounded-full bg-spark-gradient font-bold">Reset deck</button>
            </div>
          )}
        </div>
        {card && (
          <div className="flex items-center gap-6 mt-8">
            <button onClick={() => swipe('left')} className="h-16 w-16 rounded-full bg-charbon-800 border border-spark-pass/40 flex items-center justify-center text-2xl text-spark-pass hover:scale-110 transition shadow-lg">✕</button>
            <button onClick={() => swipe('right')} className="h-20 w-20 rounded-full bg-spark-gradient flex items-center justify-center text-3xl hover:scale-110 transition shadow-neon-pink">♥</button>
            <button onClick={() => swipe('right')} className="h-16 w-16 rounded-full bg-charbon-800 border border-spark-electric/40 flex items-center justify-center text-2xl text-spark-electric hover:scale-110 transition shadow-lg">⭐</button>
          </div>
        )}
      </div>
      {matchPop && <MatchModal s={matchPop} onClose={() => setMatchPop(null)} onChat={() => { setMatchPop(null); setShowChat(true); }} />}
      {showChat && <Chat matches={matches} onClose={() => setShowChat(false)} />}
    </div>
  );
}

function App() {
  const [view, setView] = useState('landing');
  if (view === 'deck') return <Deck onBack={() => setView('landing')} />;
  return (
    <div>
      <Navbar onStart={() => setView('deck')} />
      <Hero onStart={() => setView('deck')} />
      <Logos />
      <Features />
      <Testimonials />
      <FinalCTA onStart={() => setView('deck')} />
      <Footer />
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(React.createElement(App));
