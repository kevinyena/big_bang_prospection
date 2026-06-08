const { useState, useEffect, useRef, useCallback } = React;

const SECTORS = {
  FinTech: 'from-emerald-400 to-cyan-400',
  AI: 'from-violet-400 to-fuchsia-400',
  ClimateTech: 'from-green-400 to-teal-400',
  HealthTech: 'from-rose-400 to-pink-400',
  SaaS: 'from-blue-400 to-indigo-400',
  Web3: 'from-amber-400 to-orange-400',
};

const FOUNDERS = [
  { id: 'f1', name: 'Maya Chen', startup: 'NeuralPay', sector: 'FinTech', stage: 'Seed', traction: '$48k MRR · +22% MoM', ask: '$1.5M', pitch: 'AI-native treasury for SMBs. Cutting cash-flow forecasting error by 80%.', avatar: '🦊' },
  { id: 'f2', name: 'Liam Okafor', startup: 'Verdant', sector: 'ClimateTech', stage: 'Pre-seed', traction: '3 pilots · 2 LOIs', ask: '$800k', pitch: 'Carbon capture membranes that are 4x cheaper than incumbents.', avatar: '🌱' },
  { id: 'f3', name: 'Sofia Rossi', startup: 'Synapse', sector: 'AI', stage: 'Seed', traction: '12k WAU · 40% retention', ask: '$2.2M', pitch: 'Autonomous agents for legal due diligence. 10x faster reviews.', avatar: '🧠' },
  { id: 'f4', name: 'Dev Patel', startup: 'Pulse', sector: 'HealthTech', stage: 'Pre-seed', traction: 'FDA pre-sub done', ask: '$1.1M', pitch: 'Continuous cardiac monitoring patch with clinical-grade accuracy.', avatar: '❤️‍🔥' },
];

const INVESTORS = [
  { id: 'i1', name: 'Aria Ventures', startup: 'Aria Ventures', sector: 'AI', stage: 'Seed', traction: '$220M AUM', ask: '$250k–$2M ticket', pitch: 'Thesis-driven seed fund backing AI-native founders. 60+ portfolio cos.', avatar: '💎', tags: ['AI', 'SaaS', 'DevTools'] },
  { id: 'i2', name: 'North Star Capital', startup: 'North Star', sector: 'ClimateTech', stage: 'Pre-seed', traction: '$90M AUM', ask: '$100k–$750k ticket', pitch: 'First check into climate hardware. Hands-on operators turned investors.', avatar: '⭐', tags: ['ClimateTech', 'DeepTech'] },
  { id: 'i3', name: 'Helix Partners', startup: 'Helix', sector: 'FinTech', stage: 'Seed', traction: '$410M AUM', ask: '$500k–$3M ticket', pitch: 'Backing the next generation of financial infrastructure.', avatar: '🔷', tags: ['FinTech', 'Web3'] },
];

const Badge = ({ sector }) => (
  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-gradient-to-r ${SECTORS[sector] || 'from-violet-400 to-fuchsia-400'} text-black`}>{sector}</span>
);

function Nav({ go, role, setRole }) {
  return (
    <nav className="sticky top-0 z-50 backdrop-blur-xl bg-ink/70 border-b border-white/10">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <button onClick={() => go('landing')} className="flex items-center gap-2 font-bold text-lg tracking-tight">
          <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-aura-violet via-aura-magenta to-aura-cyan grid place-items-center text-sm">⚡</span>
          AuraForge
        </button>
        <div className="hidden md:flex items-center gap-8 text-sm text-white/60">
          <a href="#how" className="hover:text-white transition">How it works</a>
          <a href="#proof" className="hover:text-white transition">Proof</a>
          <button onClick={() => go('swipe')} className="hover:text-white transition">Swipe</button>
          <button onClick={() => go('chat')} className="hover:text-white transition">Matches</button>
        </div>
        <button onClick={() => go('swipe')} className="px-4 py-2 rounded-full bg-white text-black text-sm font-semibold hover:bg-white/90 transition">Start Swiping</button>
      </div>
    </nav>
  );
}

function Landing({ go, role, setRole }) {
  const isF = role === 'founder';
  const stats = [['$2.4B', 'Raised via matches'], ['1,200', 'Matches / month'], ['8,400', 'Active founders'], ['620', 'Funds onboarded']];
  return (
    <div>
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] rounded-full bg-aura-violet/20 blur-[140px]" />
          <div className="absolute top-40 right-0 w-[500px] h-[500px] rounded-full bg-aura-magenta/15 blur-[120px]" />
          <div className="absolute bottom-0 left-0 w-[500px] h-[500px] rounded-full bg-aura-cyan/10 blur-[120px]" />
        </div>
        <div className="max-w-6xl mx-auto px-6 pt-24 pb-20 grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/15 bg-white/5 text-xs text-white/70 mb-6">
              <span className="w-2 h-2 rounded-full bg-aura-cyan animate-pulse" /> Now live in 14 cities
            </div>
            <div className="inline-flex p-1 rounded-full bg-white/5 border border-white/10 mb-7">
              <button onClick={() => setRole('founder')} className={`px-4 py-1.5 rounded-full text-sm font-semibold transition ${isF ? 'bg-white text-black' : 'text-white/60'}`}>Founder</button>
              <button onClick={() => setRole('investor')} className={`px-4 py-1.5 rounded-full text-sm font-semibold transition ${!isF ? 'bg-white text-black' : 'text-white/60'}`}>Investor</button>
            </div>
            <h1 className="text-5xl md:text-7xl font-extrabold tracking-tighter leading-[0.95]">
              Where Capital<br />Meets <span className="bg-gradient-to-r from-aura-violet via-aura-magenta to-aura-cyan bg-clip-text text-transparent">Conviction</span>
            </h1>
            <p className="mt-6 text-lg text-white/60 max-w-md">
              {isF ? 'Swipe through aligned investors. Match, chat, and close your round — no cold emails, no warm-intro lottery.' : 'Discover vetted early-stage founders. Swipe right on conviction, match instantly, and start the conversation.'}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <button onClick={() => go('swipe')} className="px-6 py-3 rounded-full bg-white text-black font-semibold hover:scale-105 transition shadow-glow">Start Swiping →</button>
              <button onClick={() => go('chat')} className="px-6 py-3 rounded-full border border-white/15 bg-white/5 font-semibold hover:bg-white/10 transition">View Matches</button>
            </div>
          </div>
          <div className="relative h-[440px] grid place-items-center">
            {(isF ? INVESTORS : FOUNDERS).slice(0, 3).map((p, i) => (
              <div key={p.id} style={{ transform: `rotate(${(i - 1) * 6}deg) translateY(${i * 8}px)`, zIndex: 3 - i }}
                className="absolute w-72 rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-6 shadow-glow">
                <div className="text-5xl mb-3">{p.avatar}</div>
                <div className="font-bold text-xl">{p.startup}</div>
                <div className="text-white/50 text-sm mb-3">{p.name}</div>
                <Badge sector={p.sector} />
                <p className="mt-4 text-sm text-white/70 line-clamp-2">{p.pitch}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="how" className="max-w-6xl mx-auto px-6 py-24">
        <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight text-center">How it works</h2>
        <p className="text-center text-white/50 mt-3 mb-14">Three steps from profile to term sheet.</p>
        <div className="grid md:grid-cols-3 gap-6">
          {[['👤', 'Build your profile', 'Founders share traction & ask. Investors set their thesis & ticket.'],
            ['🔥', 'Swipe with intent', 'Discover curated cards. Swipe right on alignment, left to pass.'],
            ['💬', 'Match & chat', 'Mutual interest opens a private chat. Start the deal conversation.']].map((s, i) => (
            <div key={i} className="rounded-3xl border border-white/10 bg-white/[0.03] p-8 hover:bg-white/[0.06] transition">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-aura-violet to-aura-magenta grid place-items-center text-2xl mb-5">{s[0]}</div>
              <div className="text-xs text-white/40 font-mono mb-2">STEP {i + 1}</div>
              <h3 className="text-xl font-bold mb-2">{s[1]}</h3>
              <p className="text-white/55 text-sm">{s[2]}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="proof" className="max-w-6xl mx-auto px-6 py-12">
        <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.06] to-transparent p-10">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((s, i) => (
              <div key={i} className="text-center">
                <div className="text-4xl md:text-5xl font-extrabold bg-gradient-to-r from-aura-violet via-aura-magenta to-aura-cyan bg-clip-text text-transparent">{s[0]}</div>
                <div className="text-white/50 text-sm mt-2">{s[1]}</div>
              </div>
            ))}
          </div>
          <div className="mt-10 flex flex-wrap justify-center gap-x-10 gap-y-4 text-white/30 font-bold text-lg">
            {['Aria Ventures', 'North Star', 'Helix Partners', 'Quantum Seed', 'Atlas Fund'].map(l => <span key={l}>{l}</span>)}
          </div>
        </div>
      </section>

      <section className="max-w-4xl mx-auto px-6 py-28 text-center">
        <h2 className="text-4xl md:text-6xl font-extrabold tracking-tighter">Your next round<br />is one swipe away.</h2>
        <button onClick={() => go('swipe')} className="mt-10 px-8 py-4 rounded-full bg-white text-black font-bold text-lg hover:scale-105 transition shadow-glow">Start Swiping →</button>
      </section>

      <footer className="border-t border-white/10 py-10 text-center text-white/40 text-sm">
        <div className="font-bold text-white mb-2">⚡ AuraForge</div>
        © 2025 AuraForge. Where Capital Meets Conviction.
      </footer>
    </div>
  );
}

function SwipeDeck({ go, role, onMatch }) {
  const deck = role === 'founder' ? INVESTORS : FOUNDERS;
  const [idx, setIdx] = useState(0);
  const [drag, setDrag] = useState(0);
  const start = useRef(null);
  const card = deck[idx % deck.length];

  const swipe = (dir) => {
    setDrag(dir === 'right' ? 600 : -600);
    setTimeout(() => {
      if (dir === 'right' && Math.random() > 0.4) onMatch(card);
      setIdx(i => i + 1); setDrag(0);
    }, 280);
  };
  const onDown = e => { start.current = (e.touches ? e.touches[0].clientX : e.clientX); };
  const onMove = e => { if (start.current == null) return; setDrag((e.touches ? e.touches[0].clientX : e.clientX) - start.current); };
  const onUp = () => { if (Math.abs(drag) > 120) swipe(drag > 0 ? 'right' : 'left'); else setDrag(0); start.current = null; };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center px-6 py-10">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-extrabold tracking-tight">Discover {role === 'founder' ? 'Investors' : 'Founders'}</h2>
        <p className="text-white/50 text-sm mt-1">Swipe right to connect · left to pass</p>
      </div>
      <div className="relative w-80 h-[480px]" onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onUp} onTouchMove={onMove} onTouchEnd={onUp}>
        {deck.slice(idx, idx + 3).map((p, i) => i === 0 ? (
          <div key={p.id + idx} onMouseDown={onDown} onTouchStart={onDown}
            style={{ transform: `translateX(${drag}px) rotate(${drag * 0.05}deg)`, transition: start.current == null ? 'transform .3s' : 'none', zIndex: 30 }}
            className="absolute inset-0 rounded-3xl border border-white/10 bg-surface/90 backdrop-blur-xl p-7 shadow-glow cursor-grab active:cursor-grabbing select-none overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-aura-violet/10 to-aura-cyan/5 pointer-events-none" />
            {drag > 60 && <div className="absolute top-8 left-6 px-4 py-1 border-4 border-green-400 text-green-400 font-extrabold rounded-xl -rotate-12 text-2xl">LIKE</div>}
            {drag < -60 && <div className="absolute top-8 right-6 px-4 py-1 border-4 border-rose-500 text-rose-500 font-extrabold rounded-xl rotate-12 text-2xl">NOPE</div>}
            <div className="relative">
              <div className="text-6xl mb-4">{p.avatar}</div>
              <div className="text-2xl font-extrabold">{p.startup}</div>
              <div className="text-white/50 text-sm mb-4">{p.name}</div>
              <div className="flex gap-2 mb-4"><Badge sector={p.sector} /><span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-white/10">{p.stage}</span></div>
              <p className="text-white/70 text-sm mb-5">{p.pitch}</p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between border-t border-white/10 pt-2"><span className="text-white/40">{role === 'founder' ? 'Ticket' : 'Raising'}</span><span className="font-semibold">{p.ask}</span></div>
                <div className="flex justify-between"><span className="text-white/40">Traction</span><span className="font-semibold">{p.traction}</span></div>
              </div>
              {p.tags && <div className="flex flex-wrap gap-2 mt-4">{p.tags.map(t => <span key={t} className="px-2 py-0.5 rounded-md text-xs bg-white/5 text-white/60">{t}</span>)}</div>}
            </div>
          </div>
        ) : (
          <div key={p.id + idx} style={{ transform: `scale(${1 - i * 0.05}) translateY(${i * 14}px)`, zIndex: 30 - i }}
            className="absolute inset-0 rounded-3xl border border-white/10 bg-surface/60" />
        ))}
      </div>
      <div className="flex items-center gap-5 mt-8">
        <button onClick={() => swipe('left')} className="w-16 h-16 rounded-full border border-white/15 bg-white/5 grid place-items-center text-2xl hover:scale-110 hover:border-rose-500 transition">✕</button>
        <button onClick={() => onMatch(card)} className="w-12 h-12 rounded-full bg-gradient-to-br from-aura-cyan to-blue-500 grid place-items-center text-lg hover:scale-110 transition">⭐</button>
        <button onClick={() => swipe('right')} className="w-16 h-16 rounded-full bg-gradient-to-br from-aura-violet to-aura-magenta grid place-items-center text-2xl hover:scale-110 transition shadow-glow">♥</button>
      </div>
    </div>
  );
}

function MatchModal({ card, onChat, onClose }) {
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/70 backdrop-blur-sm p-6" onClick={onClose}>
      <div className="relative text-center max-w-sm w-full rounded-3xl border border-white/10 bg-surface p-10 shadow-glow-pink" onClick={e => e.stopPropagation()}>
        <div className="absolute -top-10 left-0 right-0 text-3xl animate-bounce">🎉✨🎊</div>
        <h2 className="text-4xl font-extrabold bg-gradient-to-r from-aura-violet via-aura-magenta to-aura-cyan bg-clip-text text-transparent">It's a Match!</h2>
        <p className="text-white/60 mt-2 mb-6">You and {card.startup} are interested in each other.</p>
        <div className="text-6xl mb-6">{card.avatar}</div>
        <button onClick={onChat} className="w-full py-3 rounded-full bg-white text-black font-bold hover:scale-105 transition">Send a message</button>
        <button onClick={onClose} className="w-full py-3 mt-3 rounded-full border border-white/15 font-semibold hover:bg-white/5 transition">Keep swiping</button>
      </div>
    </div>
  );
}

function Chat({ matches }) {
  const [active, setActive] = useState(0);
  const [msgs, setMsgs] = useState({});
  const [text, setText] = useState('');
  const [typing, setTyping] = useState(false);
  const m = matches[active];
  const list = (m && msgs[m.id]) || [{ from: 'them', t: `Hey! Loved your profile. Let's talk about ${m ? m.startup : ''}.` }];

  const send = () => {
    if (!text.trim() || !m) return;
    setMsgs(p => ({ ...p, [m.id]: [...(p[m.id] || list), { from: 'me', t: text }] }));
    setText(''); setTyping(true);
    setTimeout(() => {
      setMsgs(p => ({ ...p, [m.id]: [...(p[m.id] || list), { from: 'them', t: 'Sounds great — sending over my calendar link 📅' }] }));
      setTyping(false);
    }, 1400);
  };

  if (!matches.length) return (
    <div className="min-h-[calc(100vh-4rem)] grid place-items-center text-center px-6">
      <div><div className="text-6xl mb-4">💬</div><h2 className="text-2xl font-bold">No matches yet</h2><p className="text-white/50 mt-2">Head to the deck and start swiping.</p></div>
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 h-[calc(100vh-4rem)] grid md:grid-cols-[280px_1fr] gap-4">
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] overflow-y-auto">
        <div className="p-4 font-bold border-b border-white/10">Matches</div>
        {matches.map((x, i) => (
          <button key={x.id} onClick={() => setActive(i)} className={`w-full flex items-center gap-3 p-3 text-left hover:bg-white/5 transition ${i === active ? 'bg-white/10' : ''}`}>
            <span className="w-11 h-11 rounded-full bg-white/5 grid place-items-center text-xl">{x.avatar}</span>
            <div className="min-w-0"><div className="font-semibold truncate">{x.startup}</div><div className="text-xs text-white/40 truncate">{x.sector} · {x.stage}</div></div>
          </button>
        ))}
      </div>
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] flex flex-col">
        <div className="p-4 border-b border-white/10 flex items-center gap-3">
          <span className="w-10 h-10 rounded-full bg-white/5 grid place-items-center text-lg">{m.avatar}</span>
          <div><div className="font-bold">{m.startup}</div><div className="text-xs text-green-400">● online</div></div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {list.map((b, i) => (
            <div key={i} className={`flex ${b.from === 'me' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm ${b.from === 'me' ? 'bg-gradient-to-br from-aura-violet to-aura-magenta text-white rounded-br-sm' : 'bg-white/10 rounded-bl-sm'}`}>{b.t}</div>
            </div>
          ))}
          {typing && <div className="flex gap-1 px-4 py-2.5 bg-white/10 rounded-2xl w-fit"><span className="w-2 h-2 bg-white/50 rounded-full animate-bounce" /><span className="w-2 h-2 bg-white/50 rounded-full animate-bounce" style={{ animationDelay: '.15s' }} /><span className="w-2 h-2 bg-white/50 rounded-full animate-bounce" style={{ animationDelay: '.3s' }} /></div>}
        </div>
        <div className="p-3 border-t border-white/10 flex gap-2">
          <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()} placeholder="Type a message…" className="flex-1 bg-white/5 border border-white/10 rounded-full px-4 py-2.5 text-sm outline-none focus:border-aura-violet" />
          <button onClick={send} className="px-5 rounded-full bg-white text-black font-semibold hover:bg-white/90 transition">Send</button>
        </div>
      </div>
    </div>
  );
}

function App() {
  const [view, setView] = useState('landing');
  const [role, setRole] = useState('founder');
  const [matches, setMatches] = useState([]);
  const [modal, setModal] = useState(null);

  const onMatch = (card) => {
    if (!matches.find(m => m.id === card.id)) setMatches(p => [card, ...p]);
    setModal(card);
  };

  return (
    <div className="min-h-screen">
      <Nav go={setView} role={role} setRole={setRole} />
      {view === 'landing' && <Landing go={setView} role={role} setRole={setRole} />}
      {view === 'swipe' && <SwipeDeck go={setView} role={role} onMatch={onMatch} />}
      {view === 'chat' && <Chat matches={matches} />}
      {modal && <MatchModal card={modal} onChat={() => { setModal(null); setView('chat'); }} onClose={() => setModal(null)} />}
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(React.createElement(App));