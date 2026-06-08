const $ = (id) => document.getElementById(id);

const THEMES = [
  { name:'violet',  a:'#7c5cff', b:'#22d3ee' },
  { name:'sunset',  a:'#fb7185', b:'#fbbf24' },
  { name:'emerald', a:'#10b981', b:'#34d399' },
  { name:'ocean',   a:'#3b82f6', b:'#06b6d4' },
  { name:'royal',   a:'#8b5cf6', b:'#ec4899' },
  { name:'slate',   a:'#334155', b:'#64748b' },
];

let state = {
  items: [],
  theme: THEMES[0],
};

/* ---------- API helpers ---------- */
async function api(path, opts = {}) {
  const res = await fetch('api' + path, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  return res.json();
}

/* ---------- Toast ---------- */
function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._t);
  t._t = setTimeout(() => t.classList.remove('show'), 2600);
}

/* ---------- Themes ---------- */
function renderThemes() {
  const grid = $('themeGrid');
  grid.innerHTML = '';
  THEMES.forEach((th) => {
    const s = document.createElement('div');
    s.className = 'swatch' + (th.name === state.theme.name ? ' active' : '');
    s.style.background = `linear-gradient(135deg, ${th.a}, ${th.b})`;
    s.title = th.name;
    s.onclick = () => { state.theme = th; applyTheme(); renderThemes(); };
    grid.appendChild(s);
  });
}
function applyTheme() {
  document.documentElement.style.setProperty('--accent', state.theme.a);
  document.documentElement.style.setProperty('--accent2', state.theme.b);
  renderPreview();
}

/* ---------- Items ---------- */
function addItem(data = { desc:'', qty:1, price:0 }) {
  state.items.push({ ...data, id: Date.now() + Math.random() });
  renderItems();
}
function renderItems() {
  const list = $('itemsList');
  list.innerHTML = '';
  if (!state.items.length) {
    list.innerHTML = '<p class="empty">Aucune prestation. Ajoutez une ligne.</p>';
  }
  state.items.forEach((it) => {
    const row = document.createElement('div');
    row.className = 'item-row';
    const total = (parseFloat(it.qty)||0) * (parseFloat(it.price)||0);
    row.innerHTML = `
      <input value="${esc(it.desc)}" placeholder="Création logo..." data-f="desc" />
      <input type="number" value="${it.qty}" min="0" step="0.5" data-f="qty" />
      <input type="number" value="${it.price}" min="0" step="0.01" data-f="price" />
      <div class="line-total">${fmt(total)}</div>
      <button class="del-item"><i class="fa-solid fa-trash"></i></button>`;
    row.querySelectorAll('input').forEach((inp) => {
      inp.oninput = () => {
        it[inp.dataset.f] = inp.value;
        const t = (parseFloat(it.qty)||0)*(parseFloat(it.price)||0);
        row.querySelector('.line-total').textContent = fmt(t);
        renderPreview();
      };
    });
    row.querySelector('.del-item').onclick = () => {
      state.items = state.items.filter((x) => x.id !== it.id);
      renderItems();
    };
    list.appendChild(row);
  });
  renderPreview();
}

/* ---------- Totals ---------- */
function computeTotals() {
  const sub = state.items.reduce((s,i)=> s + (parseFloat(i.qty)||0)*(parseFloat(i.price)||0), 0);
  const discPct = parseFloat($('invDiscount').value)||0;
  const taxPct = parseFloat($('invTax').value)||0;
  const discount = sub * discPct/100;
  const base = sub - discount;
  const tax = base * taxPct/100;
  return { sub, discount, discPct, tax, taxPct, grand: base + tax };
}
let CUR = '€';
function fmt(n){ return (n||0).toLocaleString('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:2}) + ' ' + CUR; }
function esc(s){ return String(s||'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

/* ---------- Preview ---------- */
function renderPreview() {
  CUR = $('invCurrency').value;
  const t = computeTotals();
  $('invBand').style.background = `linear-gradient(90deg, ${state.theme.a}, ${state.theme.b})`;
  $('pvLogo').style.background = state.theme.a;
  const fn = $('fromName').value || 'Votre société';
  $('pvLogo').textContent = fn.charAt(0).toUpperCase();
  $('pvFromName').textContent = fn;
  $('pvFromEmail').textContent = $('fromEmail').value;
  $('pvFromAddress').textContent = $('fromAddress').value;
  $('pvToName').textContent = $('toName').value || 'Client';
  $('pvToEmail').textContent = $('toEmail').value;
  $('pvToAddress').textContent = $('toAddress').value;
  $('pvNumber').textContent = $('invNumber').value || 'INV-001';
  $('pvDate').textContent = $('invDate').value || '—';
  $('pvDue').textContent = $('invDue').value || '—';

  const body = $('pvItems');
  body.innerHTML = '';
  state.items.forEach((it) => {
    const lt = (parseFloat(it.qty)||0)*(parseFloat(it.price)||0);
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${esc(it.desc)||'—'}</td><td>${it.qty}</td><td>${fmt(parseFloat(it.price)||0)}</td><td>${fmt(lt)}</td>`;
    body.appendChild(tr);
  });

  $('pvSubtotal').textContent = fmt(t.sub);
  $('pvDiscount').textContent = '-' + fmt(t.discount);
  $('pvDiscountRow').style.display = t.discount > 0 ? 'flex' : 'none';
  $('pvTaxLabel').textContent = `TVA (${t.taxPct}%)`;
  $('pvTax').textContent = fmt(t.tax);
  $('pvGrand').textContent = fmt(t.grand);
  const notes = $('invNotes').value;
  $('pvNotes').textContent = notes;
  $('pvNotes').style.display = notes ? 'block' : 'none';
}

/* ---------- Clients ---------- */
async function loadClients() {
  const r = await api('/clients');
  const sel = $('clientSelect');
  sel.innerHTML = '<option value="">— Charger un client —</option>';
  (r.data||[]).forEach((c,i) => {
    const o = document.createElement('option');
    o.value = i; o.textContent = c.name;
    sel.appendChild(o);
  });
  sel._data = r.data || [];
  $('statClients').textContent = (r.data||[]).length;
}
$('clientSelect') && ($('clientSelect').onchange = (e) => {
  const c = e.target._data?.[e.target.value];
  if (c) { $('toName').value=c.name; $('toEmail').value=c.email||''; $('toAddress').value=c.address||''; renderPreview(); toast('Client chargé'); }
});

/* ---------- Invoices history ---------- */
async function loadInvoices() {
  const r = await api('/invoices');
  const list = $('historyList');
  list.innerHTML = '';
  const invs = r.data || [];
  if (!invs.length) list.innerHTML = '<p class="empty">Aucune facture sauvegardée.</p>';
  let total = 0;
  invs.forEach((inv) => {
    total += inv.grand || 0;
    const div = document.createElement('div');
    div.className = 'history-item';
    div.innerHTML = `
      <div class="hi-main">
        <div class="hi-num">${esc(inv.number)}</div>
        <div class="hi-sub">${esc(inv.client)} · ${inv.date||''}</div>
      </div>
      <div class="hi-amt">${(inv.grand||0).toLocaleString('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:2})} ${inv.currency||'€'}</div>
      <button class="hi-del"><i class="fa-solid fa-xmark"></i></button>`;
    div.querySelector('.hi-main').onclick = () => loadInvoiceIntoForm(inv);
    div.querySelector('.hi-del').onclick = async () => {
      await api('/invoices/' + inv.id, { method:'DELETE' });
      loadInvoices(); toast('Facture supprimée');
    };
    list.appendChild(div);
  });
  $('statCount').textContent = invs.length;
  $('statTotal').textContent = total.toLocaleString('fr-FR',{maximumFractionDigits:0}) + ' €';
}
function loadInvoiceIntoForm(inv) {
  $('fromName').value=inv.fromName||''; $('fromEmail').value=inv.fromEmail||''; $('fromAddress').value=inv.fromAddress||'';
  $('toName').value=inv.client||''; $('toEmail').value=inv.toEmail||''; $('toAddress').value=inv.toAddress||'';
  $('invNumber').value=inv.number||''; $('invDate').value=inv.date||''; $('invDue').value=inv.due||'';
  $('invTax').value=inv.taxPct ?? 20; $('invDiscount').value=inv.discPct ?? 0; $('invCurrency').value=inv.currency||'€';
  $('invNotes').value=inv.notes||'';
  const th = THEMES.find(t=>t.name===inv.theme); if(th){state.theme=th; applyTheme(); renderThemes();}
  state.items = (inv.items||[]).map(i=>({...i,id:Date.now()+Math.random()}));
  renderItems();
  toast('Facture chargée');
  window.scrollTo({top:0,behavior:'smooth'});
}

/* ---------- Actions ---------- */
$('addItemBtn').onclick = () => addItem();
['invTax','invDiscount','invCurrency','invNumber','invDate','invDue','invNotes',
 'fromName','fromEmail','fromAddress','toName','toEmail','toAddress'].forEach(id => {
  $(id).addEventListener('input', renderPreview);
});

$('saveClientBtn').onclick = async () => {
  const name = $('toName').value.trim();
  if (!name) return toast('Renseignez le nom du client');
  await api('/clients', { method:'POST', body:{ name, email:$('toEmail').value, address:$('toAddress').value } });
  loadClients(); toast('Client enregistré ✓');
};

$('saveInvoiceBtn').onclick = async () => {
  const t = computeTotals();
  const payload = {
    number: $('invNumber').value || 'INV-001',
    client: $('toName').value || 'Client',
    toEmail:$('toEmail').value, toAddress:$('toAddress').value,
    fromName:$('fromName').value, fromEmail:$('fromEmail').value, fromAddress:$('fromAddress').value,
    date:$('invDate').value, due:$('invDue').value,
    taxPct:t.taxPct, discPct:t.discPct, currency:CUR,
    notes:$('invNotes').value, theme:state.theme.name,
    items: state.items.map(({desc,qty,price})=>({desc,qty,price})),
    grand: t.grand,
  };
  await api('/invoices', { method:'POST', body:payload });
  loadInvoices(); toast('Facture sauvegardée ✓');
};

$('newInvoiceBtn').onclick = () => {
  ['toName','toEmail','toAddress','invNotes'].forEach(id=>$(id).value='');
  state.items = [];
  const next = 'INV-' + String(parseInt(($('statCount').textContent||0))+1).padStart(3,'0');
  $('invNumber').value = next;
  $('invDate').value = new Date().toISOString().slice(0,10);
  renderItems(); toast('Nouvelle facture');
};

$('exportPdfBtn').onclick = async () => {
  toast('Génération du PDF...');
  const node = $('invoicePaper');
  const canvas = await html2canvas(node, { scale:2, backgroundColor:'#ffffff' });
  const img = canvas.toDataURL('image/png');
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF('p','mm','a4');
  const w = 210, h = canvas.height * w / canvas.width;
  pdf.addImage(img, 'PNG', 0, 0, w, Math.min(h,297));
  pdf.save(($('invNumber').value || 'facture') + '.pdf');
  toast('PDF exporté ✓');
};

/* ---------- Init ---------- */
async function init() {
  $('invDate').value = new Date().toISOString().slice(0,10);
  $('invDue').value = new Date(Date.now()+30*864e5).toISOString().slice(0,10);
  $('invNumber').value = 'INV-001';
  renderThemes();
  applyTheme();
  addItem({ desc:'Conception identité visuelle', qty:1, price:800 });
  addItem({ desc:'Maquettes UI (par page)', qty:5, price:150 });
  await loadClients();
  await loadInvoices();
  renderPreview();
}
init();