const API='api/';
const $=s=>document.querySelector(s);
const money=n=>(n||0).toLocaleString('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:2})+' €';
const initials=s=>(s||'?').trim().split(/\s+/).map(w=>w[0]).slice(0,2).join('').toUpperCase();
const toast=m=>{const t=$('#toast');t.textContent=m;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2400)};

const THEMES=[{n:'Violet',c:'#6c5ce7'},{n:'Cyan',c:'#00b3a4'},{n:'Corail',c:'#e17055'},{n:'Rose',c:'#e84393'},{n:'Bleu',c:'#0984e3'},{n:'Vert',c:'#00b894'}];
let clients=[],invoices=[],items=[],theme=THEMES[0].c;

async function api(path,method='GET',body){
  const o={method,headers:{'Content-Type':'application/json'}};
  if(body)o.body=JSON.stringify(body);
  const r=await fetch(API+path,o);return r.json();
}

async function loadAll(){
  const[c,i]=await Promise.all([api('clients'),api('invoices')]);
  clients=c.data||[];invoices=i.data||[];
  renderDashboard();renderInvoices();renderClients();fillClientSelect();
}

function renderDashboard(){
  const total=invoices.reduce((s,v)=>s+v.grand,0);
  const pending=invoices.filter(v=>v.status==='pending').reduce((s,v)=>s+v.grand,0);
  $('#stTotal').textContent=money(total);
  $('#stCount').textContent=invoices.length;
  $('#stPending').textContent=money(pending);
  $('#stClients').textContent=clients.length;
  const recent=[...invoices].reverse().slice(0,5);
  $('#recentList').innerHTML=recent.length?recent.map(invRow).join(''):'<div class="empty">Aucune facture pour le moment.</div>';
  bindRowActions('#recentList');
}

function invRow(v){
  return `<div class="row-item"><div class="ri-left"><div class="ri-av">${initials(v.client)}</div><div><div class="ri-name">${v.number} · ${v.client}</div><div class="ri-sub">${v.date}</div></div></div><div class="ri-right"><span class="badge ${v.status}">${v.status==='paid'?'Payée':'En attente'}</span><span class="amount">${money(v.grand)}</span><button class="icon-btn toggle" data-id="${v.id}" title="Basculer statut"><i class="fa-solid fa-arrows-rotate"></i></button><button class="icon-btn del" data-id="${v.id}"><i class="fa-solid fa-trash"></i></button></div></div>`;
}

function renderInvoices(){
  $('#invList').innerHTML=invoices.length?[...invoices].reverse().map(invRow).join(''):'<div class="empty">Créez votre première facture.</div>';
  bindRowActions('#invList');
}

function bindRowActions(sel){
  document.querySelectorAll(`${sel} .del`).forEach(b=>b.onclick=async()=>{await api('invoices/'+b.dataset.id,'DELETE');toast('Facture supprimée');loadAll();});
  document.querySelectorAll(`${sel} .toggle`).forEach(b=>b.onclick=async()=>{await api('invoices/'+b.dataset.id+'/toggle','PUT');loadAll();});
}

function renderClients(){
  $('#clientGrid').innerHTML=clients.length?clients.map(c=>`<div class="client-card"><div class="cc-av">${initials(c.name)}</div><h4>${c.name}</h4><p>${c.email||'—'}<br>${c.address||''}</p></div>`).join(''):'<div class="empty">Ajoutez vos clients pour gagner du temps.</div>';
}

function fillClientSelect(){
  const s=$('#selClient');const prev=s.value;
  s.innerHTML='<option value="">— Sélectionner —</option>'+clients.map(c=>`<option value="${c.id}">${c.name}</option>`).join('');
  if(prev)s.value=prev;updatePreview();
}

// THEMES
function buildThemes(){
  $('#swatches').innerHTML=THEMES.map((t,i)=>`<div class="sw ${i===0?'active':''}" style="background:${t.c}" data-c="${t.c}" title="${t.n}"></div>`).join('');
  document.querySelectorAll('.sw').forEach(s=>s.onclick=()=>{document.querySelectorAll('.sw').forEach(x=>x.classList.remove('active'));s.classList.add('active');theme=s.dataset.c;updatePreview();});
}

// ITEM ROWS
function addItem(d='',q=1,p=0){
  items.push({id:Date.now()+Math.random(),d,q,p});renderItems();
}
function renderItems(){
  $('#itemRows').innerHTML=items.map(it=>`<div class="item-row" data-id="${it.id}"><input class="i-d" placeholder="Prestation..." value="${it.d}"><input class="i-q" type="number" min="0" value="${it.q}"><input class="i-p" type="number" min="0" step="0.01" value="${it.p}"><span class="itot">${money(it.q*it.p)}</span><button class="del-row"><i class="fa-solid fa-xmark"></i></button></div>`).join('');
  document.querySelectorAll('.item-row').forEach(row=>{
    const id=row.dataset.id;const it=items.find(x=>x.id==id);
    row.querySelector('.i-d').oninput=e=>{it.d=e.target.value;updatePreview();};
    row.querySelector('.i-q').oninput=e=>{it.q=+e.target.value||0;refreshRow(row,it);};
    row.querySelector('.i-p').oninput=e=>{it.p=+e.target.value||0;refreshRow(row,it);};
    row.querySelector('.del-row').onclick=()=>{items=items.filter(x=>x.id!=id);renderItems();updateTotals();updatePreview();};
  });
  updateTotals();updatePreview();
}
function refreshRow(row,it){row.querySelector('.itot').textContent=money(it.q*it.p);updateTotals();updatePreview();}

function calc(){const sub=items.reduce((s,i)=>s+i.q*i.p,0);const tax=sub*(+$('#inTax').value||0)/100;return{sub,tax,grand:sub+tax};}
function updateTotals(){const{sub,tax,grand}=calc();$('#tSub').textContent=money(sub);$('#tTax').textContent=money(tax);$('#tGrand').textContent=money(grand);}

function updatePreview(){
  const{sub,tax,grand}=calc();
  const c=clients.find(x=>x.id==$('#selClient').value);
  const rows=items.filter(i=>i.d||i.p).map(i=>`<tr><td>${i.d||'—'}</td><td>${i.q}</td><td>${money(i.p)}</td><td>${money(i.q*i.p)}</td></tr>`).join('')||'<tr><td colspan=4 style="color:#aaa">Aucune ligne</td></tr>';
  $('#invoicePreview').style.setProperty('--acc',theme);
  $('#invoicePreview').innerHTML=`<div class="idoc-head"><div class="idoc-logo">FACTURE</div><div class="meta"><b>${$('#inNumber').value}</b><br>Date : ${$('#inDate').value||'—'}</div></div><div class="idoc-parties"><div><h5>Émetteur</h5><p><b>Votre Studio Freelance</b><br>contact@studio.fr<br>SIRET 000 000 000</p></div><div style="text-align:right"><h5>Facturé à</h5><p><b>${c?c.name:'—'}</b><br>${c?c.email||'':''}<br>${c?c.address||'':''}</p></div></div><table class="idoc-table"><thead><tr><th>Description</th><th>Qté</th><th>Prix U.</th><th>Total</th></tr></thead><tbody>${rows}</tbody></table><div class="idoc-tot"><div><span>Sous-total</span><span>${money(sub)}</span></div><div><span>TVA (${$('#inTax').value}%)</span><span>${money(tax)}</span></div><div class="g"><span>Total TTC</span><span>${money(grand)}</span></div></div>${$('#inNotes').value?`<div class="idoc-notes">${$('#inNotes').value}</div>`:''}`;
}

async function genNumber(){const r=await api('next-number');$('#inNumber').value=r.number;}

function resetEditor(){items=[];addItem('',1,0);$('#inNotes').value='';$('#inTax').value=20;$('#inDate').valueAsDate=new Date();genNumber();}

async function saveInvoice(){
  const c=clients.find(x=>x.id==$('#selClient').value);
  if(!c)return toast('Sélectionnez un client');
  if(!items.some(i=>i.d))return toast('Ajoutez au moins une prestation');
  const{sub,tax,grand}=calc();
  const payload={number:$('#inNumber').value,client:c.name,clientId:c.id,date:$('#inDate').value,tax:+$('#inTax').value,items:items.filter(i=>i.d),notes:$('#inNotes').value,sub,taxAmt:tax,grand,status:'pending'};
  await api('invoices','POST',payload);
  toast('Facture enregistrée ✔');resetEditor();await loadAll();switchView('invoices');
}

function exportPDF(){
  const el=$('#invoicePreview').cloneNode(true);
  el.style.background='#fff';
  html2pdf().set({margin:0,filename:($('#inNumber').value||'facture')+'.pdf',image:{type:'jpeg',quality:.98},html2canvas:{scale:2},jsPDF:{unit:'mm',format:'a4',orientation:'portrait'}}).from(el).save();
  toast('Génération du PDF...');
}

// CLIENT MODAL
function openClient(){$('#clientModal').classList.remove('hidden');}
function closeClient(){$('#clientModal').classList.add('hidden');$('#cName').value=$('#cEmail').value=$('#cAddress').value='';}
async function saveClient(){
  const name=$('#cName').value.trim();if(!name)return toast('Nom requis');
  await api('clients','POST',{name,email:$('#cEmail').value,address:$('#cAddress').value});
  toast('Client ajouté');closeClient();await loadAll();
}

// VIEWS
const TITLES={dashboard:['Tableau de bord',"Vue d'ensemble de votre activité"],create:['Nouvelle facture','Construisez et exportez en quelques clics'],invoices:['Factures','Gérez vos documents émis'],clients:['Clients','Votre carnet de contacts']};
function switchView(v){
  document.querySelectorAll('.view').forEach(x=>x.classList.add('hidden'));
  $('#view-'+v).classList.remove('hidden');
  document.querySelectorAll('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.view===v));
  $('#viewTitle').textContent=TITLES[v][0];$('#viewSub').textContent=TITLES[v][1];
  if(v==='create')updatePreview();
}

// EVENTS
document.querySelectorAll('.nav-item').forEach(b=>b.onclick=()=>switchView(b.dataset.view));
$('#quickInvoice').onclick=()=>{resetEditor();switchView('create');};
$('#quickClient').onclick=openClient;
$('#newClientBtn').onclick=openClient;
$('#cSave').onclick=saveClient;$('#cCancel').onclick=closeClient;
$('#addRow').onclick=()=>addItem();
$('#inTax').oninput=()=>{updateTotals();updatePreview();};
$('#selClient').onchange=updatePreview;
$('#inDate').onchange=updatePreview;
$('#inNotes').oninput=updatePreview;
$('#saveInvoice').onclick=saveInvoice;
$('#pdfBtn').onclick=exportPDF;

buildThemes();resetEditor();loadAll();