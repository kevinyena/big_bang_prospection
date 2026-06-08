const { useState, useEffect } = React;

const Arrow = ({ className }) => (
  <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
);

const navItems = ["Platform", "Solutions", "Customers", "Resources", "Pricing"];

const dashboardMock = (light) => (
  <div className={`rounded-xl overflow-hidden shadow-2xl border ${light ? 'bg-white border-border' : 'bg-[#1c1c1c] border-[#2a2a2a]'}`}>
    <div className={`flex items-center justify-between px-4 py-2.5 border-b ${light ? 'border-border' : 'border-[#2a2a2a]'}`}>
      <div className="flex items-center gap-3">
        <span className={`text-sm font-bold tracking-wide ${light ? 'text-ink' : 'text-white'}`}>MEWS</span>
        <div className={`hidden sm:flex items-center gap-2 text-[11px] px-2 py-1 rounded ${light ? 'bg-bg-alt text-text-secondary' : 'bg-[#2a2a2a] text-gray-400'}`}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
          Search within Central Inn
        </div>
      </div>
      <span className="text-[11px] text-text-secondary">Optim...</span>
    </div>
    <div className={`flex items-center gap-3 px-4 py-2 text-[11px] ${light ? 'text-text-secondary' : 'text-gray-400'}`}>
      <span className="flex items-center gap-1">Today <Arrow className="w-3 h-3" /></span>
      <span className={`px-2 py-1 rounded border ${light ? 'border-border' : 'border-[#333]'}`}>Select date</span>
      <span className={`px-2 py-1 rounded border ${light ? 'border-border' : 'border-[#333]'}`}>Select space</span>
    </div>
    <div className="grid grid-cols-6 text-[10px]">
      {["Oct 2","Oct 3","Oct 4","Oct 5","Oct 6","Oct 7"].map((d,i)=>(
        <div key={i} className={`py-1.5 text-center border-b ${light ? 'text-text-secondary border-border' : 'text-gray-500 border-[#2a2a2a]'}`}>{d}</div>
      ))}
    </div>
    {[["101","Maxwell Carter","Ethan Davis"],["102",""],["103","Olivia Bennett","Isabella Hughes"],["104",""],["105",""],["106","Liam Johnson","Ava Martinez"]].map((r,i)=>(
      <div key={i} className={`grid grid-cols-6 items-center px-1 py-1.5 border-b text-[9px] ${light?'border-border':'border-[#2a2a2a]'}`}>
        <div className={`pl-2 ${light?'text-text-secondary':'text-gray-500'}`}>{r[0]}</div>
        {r[1] && <div className="col-span-2 mx-1 px-1.5 py-1 rounded bg-pink/50 text-ink truncate">{r[1]}</div>}
        {r[2] && <div className="col-span-2 mx-1 px-1.5 py-1 rounded bg-lime/60 text-ink truncate">{r[2]}</div>}
      </div>
    ))}
  </div>
);

function Header() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", h); return () => window.removeEventListener("scroll", h);
  }, []);
  return (
    <header className={`sticky top-0 z-50 transition-all ${scrolled ? "bg-white shadow-sm" : "bg-white"}`}>
      <div className="max-w-[1280px] mx-auto flex items-center justify-between px-5 h-16">
        <div className="flex items-center gap-10">
          <span className="text-2xl font-bold tracking-tight text-ink">grid-flow</span>
          <nav className="hidden lg:flex items-center gap-7">
            {navItems.map(n => (
              <button key={n} className="text-[15px] text-text-primary hover:text-text-secondary flex items-center gap-1">
                {n}{(n!=="Pricing") && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6"/></svg>}
              </button>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <button className="hidden md:flex items-center gap-1 text-[14px] text-text-secondary">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20"/></svg>
            EN <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6"/></svg>
          </button>
          <button className="hidden md:flex items-center gap-1 text-[14px] text-text-secondary">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>Search
          </button>
          <button className="hidden md:block text-[14px] text-text-secondary">Contact us</button>
          <button className="hidden md:block text-[14px] text-text-primary font-medium">Log in</button>
          <button className="bg-pink text-ink text-[13px] font-semibold px-5 py-2.5 rounded-full hover:opacity-90 uppercase tracking-wide">Book a demo</button>
          <button className="lg:hidden" onClick={() => setOpen(!open)}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d={open?"M18 6 6 18M6 6l12 12":"M4 6h16M4 12h16M4 18h16"}/></svg>
          </button>
        </div>
      </div>
      {open && (
        <div className="lg:hidden border-t border-border bg-white px-5 py-4 flex flex-col gap-3">
          {navItems.map(n => <button key={n} className="text-left text-[15px] py-1">{n}</button>)}
          <button className="text-left text-[15px] py-1">Log in</button>
        </div>
      )}
    </header>
  );
}

function Hero() {
  return (
    <section className="max-w-[1280px] mx-auto px-5 pt-6 pb-12 grid lg:grid-cols-2 gap-6">
      <div className="bg-ink rounded-xl p-10 flex flex-col justify-end text-white min-h-[420px] relative overflow-hidden">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 mb-4 flex items-center gap-2">
          <span className="w-6 h-6 rounded bg-pink inline-flex items-center justify-center text-ink">▦</span>Hospitality Management System
        </span>
        <h1 className="text-4xl sm:text-5xl font-bold leading-[1.05] tracking-tight mb-5">THE OPERATING SYSTEM FOR MODERN HOTELS</h1>
        <p className="text-[15px] text-gray-300 leading-relaxed mb-7 max-w-md">Power your entire business on one operating system. Whether you're setting rates, taking bookings, processing payments or keeping operations running smoothly, grid-flow brings it all together.</p>
        <button className="bg-pink text-ink text-[13px] font-semibold px-6 py-3 rounded-full w-fit uppercase tracking-wide">Book a demo</button>
      </div>
      <div className="bg-[#9ec8b8] rounded-xl p-8 flex items-center min-h-[420px]">{dashboardMock(true)}</div>
    </section>
  );
}

const logos = ["LEVEN","THE NEIGHBORHOOD","AIRELLES","THE SOCIAL HUB","HOSPITALITY GROUP","BOUNDARY","Locale"];
function Logos() {
  return (
    <section className="max-w-[1280px] mx-auto px-5 py-12 text-center">
      <p className="text-[15px] text-text-secondary mb-8">Join over 15,000 properties from across the world. <a className="text-ink underline font-medium">Meet our customers.</a></p>
      <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-6 opacity-70">
        {logos.map(l => <span key={l} className="text-base font-bold tracking-wide text-ink">{l}</span>)}
      </div>
    </section>
  );
}

const useCards1 = [
  {icon:"🏨",t:"Hotels",d:"Everything your hotel needs to run smoothly",l:"Mews for Hotels"},
  {icon:"👥",t:"Groups & Chains",d:"Run your whole portfolio in one place",l:"Mews for Groups & Chains"},
  {icon:"🛏️",t:"Small Hotels",d:"Deliver standout stays at smaller properties",l:"Mews for Small Hotels"},
];
const useCards2 = [
  {icon:"🏠",t:"Independent Hotels",d:"Create unforgettable stays with full control",l:"Mews for Independent Hotels"},
  {icon:"🗝️",t:"Extended Stays",d:"Simplify long stays for guests and teams",l:"Mews for Extended Stays"},
  {icon:"🛎️",t:"Hostels",d:"Manage private rooms and beds seamlessly",l:"Mews for Hostels"},
  {icon:"🚗",t:"Motels",d:"Keep roadside stays running smoothly",l:"Mews for Motels"},
];
function UseCases() {
  const Card = ({c}) => (
    <div className="bg-bg-alt rounded-xl p-7 hover:bg-[#ececea] transition flex flex-col">
      <div className="text-2xl mb-6">{c.icon}</div>
      <h3 className="text-lg font-semibold mb-2 text-ink">{c.t}</h3>
      <p className="text-[14px] text-text-secondary leading-relaxed mb-6 flex-1">{c.d}</p>
      <a className="text-[12px] font-semibold uppercase tracking-wide text-ink flex items-center justify-between border-t border-border pt-3">{c.l}<Arrow className="w-4 h-4"/></a>
    </div>
  );
  return (
    <section className="max-w-[1280px] mx-auto px-5 py-16">
      <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-10 text-ink">See what grid-flow can<br/>do for you</h2>
      <div className="grid md:grid-cols-3 gap-5 mb-5">{useCards1.map(c=><Card key={c.t} c={c}/>)}</div>
      <div className="grid md:grid-cols-4 gap-5">{useCards2.map(c=><Card key={c.t} c={c}/>)}</div>
    </section>
  );
}

function Products() {
  return (
    <section className="bg-ink text-white py-20">
      <div className="max-w-[1280px] mx-auto px-5">
        <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-12">Smarter operations</h2>
        <div className="grid lg:grid-cols-2 gap-5 mb-5">
          <div className="bg-pink rounded-xl p-8 text-ink">
            <span className="text-[11px] font-semibold uppercase tracking-widest flex items-center gap-2 mb-5">▦ PMS</span>
            <h3 className="text-2xl font-bold mb-3">Run your property your way</h3>
            <p className="text-[14px] mb-5 max-w-md leading-relaxed">Simplify everything from booking to check-out with an award-winning, cloud-native system that's designed for modern hospitality.</p>
            <a className="text-[12px] font-semibold uppercase tracking-wide flex items-center gap-2 mb-6">Property Management System <Arrow className="w-4 h-4"/></a>
            {dashboardMock(true)}
          </div>
          <div className="flex flex-col gap-5">
            <div className="bg-lime rounded-xl p-8 text-ink flex-1 flex items-center justify-center min-h-[200px]">
              <div className="bg-white rounded-2xl shadow-xl w-40 p-3 text-[9px]">
                <div className="font-bold mb-2 text-[11px]">☰ grid-flow</div>
                {["Front Desk","Central Inn","Premier Suite"].map(x=><div key={x} className="flex justify-between border-b border-border py-1.5"><span>{x}</span><span className="text-text-secondary">$ ›</span></div>)}
                <div className="mt-2 font-bold text-base">$35 <span className="text-[8px] font-normal text-text-secondary">View entry</span></div>
              </div>
            </div>
            <div className="bg-[#1c1c1c] rounded-xl p-8 border border-[#2a2a2a]">
              <span className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 mb-4 block">▦ POS</span>
              <h3 className="text-2xl font-bold mb-3">Simplify your F&amp;B operations</h3>
              <p className="text-[14px] text-gray-300 mb-5 leading-relaxed">Run smoother service with a fully integrated POS that's purpose built for hotel restaurants.</p>
              <a className="text-[12px] font-semibold uppercase tracking-wide flex items-center gap-2">Point of Sale <Arrow className="w-4 h-4"/></a>
            </div>
          </div>
        </div>
        <div className="grid lg:grid-cols-2 gap-5">
          <div className="bg-[#1c1c1c] rounded-xl p-8 border border-[#2a2a2a]">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 mb-4 block">▦ PAYMENTS</span>
            <h3 className="text-2xl font-bold mb-3">Automate hotel payment processing</h3>
            <p className="text-[14px] text-gray-300 mb-5 max-w-sm leading-relaxed">Deliver smooth, secure payments, fully embedded to reduce manual work and maximize revenue.</p>
            <a className="text-[12px] font-semibold uppercase tracking-wide flex items-center gap-2 mb-8">Embedded Payments <Arrow className="w-4 h-4"/></a>
            <div className="bg-[#2a2a2a] rounded-lg p-3 flex items-center justify-between text-[12px] w-fit"><span className="flex items-center gap-2"><span className="w-7 h-7 rounded bg-lime text-ink flex items-center justify-center">🍴</span>Central Inn (Restaurant)</span><span className="font-semibold ml-6">+$94.99</span></div>
          </div>
          <div className="bg-[#1c1c1c] rounded-xl p-8 border border-[#2a2a2a]">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 mb-4 block">▦ RMS</span>
            <h3 className="text-2xl font-bold mb-3">Optimize your hotel's revenue with AI</h3>
            <p className="text-[14px] text-gray-300 mb-5 max-w-sm leading-relaxed">Harness the power of data to turn pricing into a competitive advantage and boost your revenue with less manual work.</p>
            <a className="text-[12px] font-semibold uppercase tracking-wide flex items-center gap-2 mb-8">Revenue Management System <Arrow className="w-4 h-4"/></a>
            <div className="bg-white rounded-lg p-4 text-ink text-[10px]">
              <div className="font-bold mb-2">Hotel Sunset · July 2025</div>
              <div className="flex justify-between border-b border-border py-2"><span>RevPAR</span><span className="font-bold text-lg">$118</span></div>
              <div className="flex justify-between py-2 text-text-secondary"><span>Month forecast (vs LY)</span><span className="text-green-600">+9%</span></div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

const testimonials = [
  {q:"The grid-flow team is responsive and invested in our success, even as a small, stand-alone property. They're receptive to feedback and understand the value that experienced hoteliers bring to the product. This two-way communication feels like a real partnership.",n:"Peter Lawrence",r:"Owner",c:"Wythe Hotel",b:"WYTHE HOTEL"},
];
function Testimonials() {
  const [i] = useState(0); const t = testimonials[i];
  return (
    <section className="bg-ink text-white py-24">
      <div className="max-w-3xl mx-auto px-5 text-center">
        <p className="text-2xl sm:text-3xl font-bold leading-snug tracking-tight mb-8"><span className="text-gray-500">“</span>{t.q}<span className="text-gray-500">”</span></p>
        <p className="text-[13px] font-semibold">{t.n}</p>
        <p className="text-[13px] text-gray-400 mb-6">{t.r} · {t.c}</p>
        <button className="border border-gray-600 rounded-full px-5 py-2 text-[11px] font-semibold uppercase tracking-wide mb-6">{t.b}</button>
        <div className="flex justify-center gap-2">{[0,1,2].map(d=><span key={d} className={`w-2 h-2 rounded-full ${d===0?'bg-white':'bg-gray-600'}`}/>)}</div>
      </div>
    </section>
  );
}

function Impact() {
  return (
    <section className="bg-bg-alt py-20">
      <div className="max-w-[1280px] mx-auto px-5">
        <div className="flex justify-between items-start mb-10">
          <div>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4 text-ink">Powering hospitality impact</h2>
            <p className="text-[15px] text-text-secondary max-w-md leading-relaxed">Smarter systems lead to stronger performance. Hoteliers using grid-flow see the difference every day in their revenue, efficiency and guest satisfaction.</p>
          </div>
          <div className="hidden md:flex gap-2">
            <button className="w-10 h-10 rounded-full border border-border flex items-center justify-center rotate-180"><Arrow className="w-4 h-4"/></button>
            <button className="w-10 h-10 rounded-full border border-border flex items-center justify-center"><Arrow className="w-4 h-4"/></button>
          </div>
        </div>
        <div className="grid lg:grid-cols-2 gap-5">
          <div className="bg-lime rounded-xl p-8 text-ink">
            <h3 className="text-xl font-bold mb-4">GuestHouse Hotels transform guest experience with grid-flow</h3>
            <a className="text-[12px] font-semibold uppercase tracking-wide flex items-center gap-2">Read case study <Arrow className="w-4 h-4"/></a>
          </div>
          <div className="bg-white rounded-xl overflow-hidden">
            <img src="https://images.unsplash.com/photo-1566073771259-6a8506099945?w=600&q=80" className="w-full h-full object-cover" alt=""/>
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-5 mt-5">
          <div><p className="text-5xl font-bold text-ink mb-2">45%</p><p className="text-[12px] uppercase tracking-wide text-text-secondary">Increase in direct bookings</p></div>
          <div><p className="text-5xl font-bold text-ink mb-2">45%</p><p className="text-[12px] uppercase tracking-wide text-text-secondary">Increase in RevPAR</p></div>
        </div>
        <div className="bg-ink text-white rounded-full px-8 py-4 mt-12 flex items-center justify-center gap-2 text-[14px]">
          <span className="font-semibold">See your impact.</span> Estimate your RevPAR lift with our return on investment calculator.
          <button className="ml-4 w-9 h-9 rounded-full bg-pink text-ink flex items-center justify-center"><Arrow className="w-4 h-4"/></button>
        </div>
      </div>
    </section>
  );
}

function Integrations() {
  return (
    <section className="max-w-[1280px] mx-auto px-5 py-20">
      <span className="text-[11px] font-semibold uppercase tracking-widest text-text-secondary mb-6 block">Integrations</span>
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4 text-ink">Build your grid-flow</h2>
          <p className="text-[15px] text-text-secondary max-w-md leading-relaxed mb-8">Plug into 1,000+ hospitality apps and create a platform that fits your property like a glove.</p>
          <a className="text-[12px] font-semibold uppercase tracking-wide flex items-center gap-2 text-ink">See all 1000+ integrations <Arrow className="w-4 h-4"/></a>
        </div>
        <div className="text-5xl text-text-secondary">+</div>
      </div>
    </section>
  );
}

function Footer() {
  const cols = {
    Platform:["Property Management System","Payments","Point of Sale","Revenue Management","Marketplace","Open API"],
    Solutions:["Hotels","Hostels","Groups & Chains","Independent Hotels","Extended Stays","Motels"],
    Company:["About","Careers","Press","Contact us","Partners"],
    Resources:["Blog","Guides","Case studies","Events","Academy"],
  };
  return (
    <footer className="bg-ink text-white pt-16 pb-8">
      <div className="max-w-[1280px] mx-auto px-5">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 pb-12 border-b border-[#2a2a2a]">
          <div className="col-span-2 md:col-span-1"><span className="text-2xl font-bold">grid-flow</span></div>
          {Object.entries(cols).map(([k,v])=>(
            <div key={k}>
              <h4 className="text-[12px] font-semibold uppercase tracking-wide text-gray-400 mb-4">{k}</h4>
              <ul className="space-y-2.5">{v.map(x=><li key={x}><a className="text-[13px] text-gray-300 hover:text-white">{x}</a></li>)}</ul>
            </div>
          ))}
        </div>
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 pt-6 text-[12px] text-gray-500">
          <p>© 2025 grid-flow Systems Ltd. All rights reserved.</p>
          <div className="flex gap-5">{["Privacy","Terms","Cookies"].map(x=><a key={x} className="hover:text-white">{x}</a>)}</div>
        </div>
      </div>
    </footer>
  );
}

function CookieBanner() {
  const [show, setShow] = useState(true);
  if (!show) return null;
  return (
    <div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-md w-full p-6 text-[13px] text-text-secondary leading-relaxed">
        <p className="mb-3">This website stores cookies on your computer. These cookies are used to collect information about how you interact with our website and allow us to remember you. We use this information in order to improve and customize your browsing experience and for analytics and metrics about our visitors both on this website and other media.</p>
        <p className="mb-5">If you decline, your information won't be tracked when you visit this website. A single cookie will be used in your browser to remember your preference not to be tracked. To find out more about the cookies we use, see our <a className="text-ink underline">privacy policy</a>. You can also <a className="text-ink underline">manage your cookie settings here.</a></p>
        <div className="flex gap-3">
          <button onClick={()=>setShow(false)} className="flex-1 bg-pink text-ink font-semibold py-2.5 rounded">Accept All Cookies</button>
          <button onClick={()=>setShow(false)} className="flex-1 border border-pink text-ink font-semibold py-2.5 rounded">Reject All Cookies</button>
        </div>
      </div>
    </div>
  );
}

function App() {
  return (
    <div>
      <div className="bg-ink text-white text-[12px] py-2 px-5 flex items-center justify-center gap-2">
        <span className="bg-pink text-ink text-[10px] font-bold px-1.5 py-0.5 rounded">NEW</span>
        Revenue Management for hospitality <Arrow className="w-3 h-3"/>
      </div>
      <Header />
      <Hero />
      <Logos />
      <UseCases />
      <Products />
      <Testimonials />
      <Impact />
      <Integrations />
      <Footer />
      <CookieBanner />
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(React.createElement(App));