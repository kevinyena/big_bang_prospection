const API = {
  async get(path){ const r = await fetch('api/'+path); if(!r.ok) throw new Error(r.status); return r.json(); },
  async post(path,body){ const r = await fetch('api/'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}); if(!r.ok) throw new Error(r.status); return r.json(); },
  async put(path,body){ const r = await fetch('api/'+path,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}); if(!r.ok) throw new Error(r.status); return r.json(); },
  async del(path){ const r = await fetch('api/'+path,{method:'DELETE'}); if(!r.ok) throw new Error(r.status); return r.json().catch(()=>({})); }
};

const DEFAULT_CATS = [
  {name:'Logement',color:'#7c3aed',icon:'house'},
  {name:'Alimentation',color:'#34f5c5',icon:'utensils'},
  {name:'Transport',color:'#00e5ff',icon:'car'},
  {name:'Loisirs',color:'#ff2e97',icon:'gamepad'},
  {name:'Santé',color:'#ffb74d',icon:'heart-pulse'},
  {name:'Shopping',color:'#a78bfa',icon:'bag-shopping'},
  {name:'Factures',color:'#5eead4',icon:'file-invoice'},
  {name:'Salaire',color:'#34f5c5',icon:'sack-dollar'},
  {name:'Freelance',color:'#00e5ff',icon:'laptop-code'},
  {name:'Autre',color:'#787b91',icon:'circle-dot'}
];
const MONTHS_FR = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
const CUR_SYM = {EUR:'€',USD:'$',GBP:'£'};

const state = {
  transactions: [], categories: [], settings: {currency:'EUR',theme:'dark'},
  view: 'overview', period: {month: new Date().getMonth(), year: new Date().getFullYear(), all:false},
  filterType: 'all', filterCat: 'all', sortBy: 'date-desc', search: ''
};
let charts = {};

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

function curSym(){ return CUR_SYM[state.settings.currency] || '€'; }
function fmt(n){ const s = curSym(); const v = Math.abs(n).toLocaleString('fr-FR',{minimumFractionDigits:0,maximumFractionDigits:2}); return (n<0?'-':'')+s+v; }
function fmtDate(d){ const dt = new Date(d); return dt.toLocaleDateString('fr-FR',{day:'2-digit',month:'short',year:'numeric'}); }
function catOf(name){ return state.categories.find(c=>c.name===name) || {name,color:'#787b91',icon:'circle-dot'}; }
function uid(){ return 'id-'+Date.now().toString(36)+Math.random().toString(36).slice(2,8); }

function inPeriod(t){
  if(state.period.all) return true;
  const d = new Date(t.date);
  return d.getMonth()===state.period.month && d.getFullYear()===state.period.year;
}
function periodTx(){ return state.transactions.filter(inPeriod); }

function prevPeriod(){
  let {month,year} = state.period;
  if(month===0){month=11;year--;}else month--;
  return state.transactions.filter(t=>{const d=new Date(t.date);return d.getMonth()===month && d.getFullYear()===year;});
}

/* ---------- DATA LOADING ---------- */
async function loadAll(){
  try{
    const [tx,cats,settings] = await Promise.all([
      API.get('transactions').catch(()=>null),
      API.get('categories').catch(()=>null),
      API.get('settings').catch(()=>null)
    ]);
    state.transactions = Array.isArray(tx)?tx:[];
    state.categories = (Array.isArray(cats)&&cats.length)?cats:[];
    if(settings && typeof settings==='object') state.settings = {...state.settings,...settings};
  }catch(e){ state.transactions=[]; }
  if(!state.categories.length){ await ensureCategories(); }
  if(!state.transactions.length){ await seedData(true); }
}

async function ensureCategories(){
  for(const c of DEFAULT_CATS){
    const payload = {id:uid(),...c};
    try{ const r = await API.post('categories',payload); state.categories.push(r&&r.id?r:payload); }
    catch(e){ state.categories.push(payload); }
  }
}

async function seedData(silent){
  const cats = state.categories;
  const expCats = cats.filter(c=>!['Salaire','Freelance'].includes(c.name));
  const incCats = cats.filter(c=>['Salaire','Freelance'].includes(c.name));
  const now = new Date();
  const seeded = [];
  for(let m=5;m>=0;m--){
    const base = new Date(now.getFullYear(), now.getMonth()-m, 1);
    const y=base.getFullYear(), mo=base.getMonth();
    seeded.push(mk('income','Salaire mensuel',(incCats[0]||cats[0]).name, y,mo,2, 2400+Math.random()*300));
    if(Math.random()>.4) seeded.push(mk('income','Mission freelance',(incCats[1]||cats[0]).name, y,mo,15, 300+Math.random()*700));
    const cnt = 6+Math.floor(Math.random()*6);
    for(let i=0;i<cnt;i++){
      const c = expCats[Math.floor(Math.random()*expCats.length)];
      seeded.push(mk('expense', sampleDesc(c.name), c.name, y,mo, 1+Math.floor(Math.random()*27), 10+Math.random()*240));
    }
  }
  for(const t of seeded){
    try{ const r = await API.post('transactions',t); state.transactions.push(r&&r.id?r:t); }
    catch(e){ state.transactions.push(t); }
  }
  if(!silent) toast('Données de démonstration régénérées','success');
}
function mk(type,desc,category,y,mo,day,amount){
  return {id:uid(),type,description:desc,category,date:`${y}-${String(mo+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`,amount:Math.round(amount*100)/100};
}
function sampleDesc(cat){
  const m={Logement:['Loyer','Charges','Assurance habitation'],Alimentation:['Courses hebdo','Restaurant','Boulangerie'],Transport:['Essence','Ticket métro','Péage'],Loisirs:['Cinéma','Concert','Abonnement streaming'],Santé:['Pharmacie','Consultation','Mutuelle'],Shopping:['Vêtements','Électronique','Cadeau'],Factures:['Électricité','Internet','Téléphone'],Autre:['Divers','Frais bancaires']};
  const a=m[cat]||['Dépense'];return a[Math.floor(Math.random()*a.length)];
}

/* ---------- STATS ---------- */
function computeStats(){
  const tx = periodTx();
  const income = tx.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0);
  const expense = tx.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0);
  const balance = state.transactions.reduce((s,t)=>s+(t.type==='income'?t.amount:-t.amount),0);
  const savings = income-expense;
  const prev = prevPeriod();
  const pInc = prev.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0);
  const pExp = prev.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0);
  const pSav = pInc-pExp;
  const pct=(c,p)=>{ if(!p) return c?100:0; return Math.round(((c-p)/Math.abs(p))*100); };
  return {income,expense,balance,savings,
    tIncome:pct(income,pInc),tExpense:pct(expense,pExp),tSavings:pct(savings,pSav),tBalance:pct(balance,balance-savings||balance)};
}

function categoryBreakdown(){
  const tx = periodTx().filter(t=>t.type==='expense');
  const map={};
  tx.forEach(t=>{ map[t.category]=(map[t.category]||0)+t.amount; });
  return Object.entries(map).map(([name,value])=>({name,value,color:catOf(name).color,icon:catOf(name).icon}))
    .sort((a,b)=>b.value-a.value);
}

function monthlyTrend(n=6){
  const now = state.period.all? new Date(): new Date(state.period.year,state.period.month,1);
  const out=[];
  for(let i=n-1;i>=0;i--){
    const d=new Date(now.getFullYear(),now.getMonth()-i,1);
    const tx=state.transactions.filter(t=>{const x=new Date(t.date);return x.getMonth()===d.getMonth()&&x.getFullYear()===d.getFullYear();});
    const inc=tx.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0);
    const exp=tx.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0);
    out.push({label:MONTHS_FR[d.getMonth()].slice(0,3),income:inc,expense:exp,balance:inc-exp});
  }
  let cum=0; out.forEach(o=>{cum+=o.balance;o.cumBalance=cum;});
  return out;
}

/* ---------- RENDER ---------- */
function animateCount(el,target){
  const start=parseFloat(el.dataset.count||'0'); const dur=700; const t0=performance.now();
  function step(t){ const p=Math.min((t-t0)/dur,1); const e=1-Math.pow(1-p,3); const v=start+(target-start)*e;
    el.textContent=fmt(v); if(p<1)requestAnimationFrame(step); else {el.textContent=fmt(target);el.dataset.count=target;} }
  el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
  requestAnimationFrame(step);
}
function setTrend(id,val){
  const el=$('#'+id); if(!el)return;
  const up=val>=0; el.className='kpi-trend '+(up?'up':'down');
  el.innerHTML=`<i class="fa-solid fa-arrow-trend-${up?'up':'down'}"></i> ${up?'+':''}${val}%`;
}

function renderKPIs(){
  const s=computeStats();
  animateCount($('#kpiBalance'),s.balance);
  animateCount($('#kpiIncome'),s.income);
  animateCount($('#kpiExpense'),s.expense);
  animateCount($('#kpiSavings'),s.savings);
  setTrend('trendBalance',s.tBalance);
  setTrend('trendIncome',s.tIncome);
  setTrend('trendExpense',s.tExpense);
  setTrend('trendSavings',s.tSavings);
}

function chartBase(){
  Chart.defaults.color='#787b91';
  Chart.defaults.font.family="'Inter',sans-serif";
}
function grad(ctx,c1,c2){ const g=ctx.createLinearGradient(0,0,0,300); g.addColorStop(0,c1); g.addColorStop(1,c2); return g; }

function renderTrendChart(){
  const data=monthlyTrend(6); const cv=$('#trendChart'); if(!cv)return;
  if(charts.trend)charts.trend.destroy();
  const ctx=cv.getContext('2d');
  charts.trend=new Chart(ctx,{type:'line',data:{labels:data.map(d=>d.label),datasets:[
    {label:'Solde',data:data.map(d=>d.cumBalance),borderColor:'#00e5ff',backgroundColor:grad(ctx,'rgba(0,229,255,.28)','rgba(0,229,255,0)'),fill:true,tension:.4,borderWidth:2.5,pointRadius:0,pointHoverRadius:5,pointHoverBackgroundColor:'#00e5ff'},
    {label:'Revenus',data:data.map(d=>d.income),borderColor:'#34f5c5',backgroundColor:'transparent',tension:.4,borderWidth:2,pointRadius:0,pointHoverRadius:5},
    {label:'Dépenses',data:data.map(d=>d.expense),borderColor:'#ff2e97',backgroundColor:'transparent',tension:.4,borderWidth:2,pointRadius:0,pointHoverRadius:5}
  ]},options:lineOpts()});
}
function lineOpts(){
  return {responsive:true,maintainAspectRatio:false,interaction:{mode:'index',intersect:false},
    plugins:{legend:{display:false},tooltip:tooltipCfg()},
    scales:{x:{grid:{color:'rgba(255,255,255,.04)'},border:{display:false}},
    y:{grid:{color:'rgba(255,255,255,.05)'},border:{display:false},ticks:{callback:v=>curSym()+v}}}};
}
function tooltipCfg(){
  return {backgroundColor:'rgba(16,16,24,.95)',borderColor:'rgba(255,255,255,.12)',borderWidth:1,padding:12,cornerRadius:12,titleColor:'#f4f5fb',bodyColor:'#b4b6c7',
    callbacks:{label:c=>`${c.dataset.label}: ${fmt(c.parsed.y)}`}};
}

function renderDonut(){
  const data=categoryBreakdown(); const cv=$('#donutChart'); if(!cv)return;
  if(charts.donut)charts.donut.destroy();
  const total=data.reduce((s,d)=>s+d.value,0);
  $('#donutTotal').textContent=fmt(total);
  const ds=data.length?data:[{name:'Aucune',value:1,color:'#2a2a36'}];
  charts.donut=new Chart(cv,{type:'doughnut',data:{labels:ds.map(d=>d.name),datasets:[{data:ds.map(d=>d.value),backgroundColor:ds.map(d=>d.color),borderColor:'rgba(10,10,15,.6)',borderWidth:3,hoverOffset:8}]},
    options:{responsive:true,maintainAspectRatio:false,cutout:'72%',plugins:{legend:{display:false},tooltip:{...tooltipCfg(),callbacks:{label:c=>`${c.label}: ${fmt(c.parsed)} (${total?Math.round(c.parsed/total*100):0}%)`}}}}});
  const leg=$('#catLegend'); leg.innerHTML='';
  data.slice(0,6).forEach(d=>{
    const pct=total?Math.round(d.value/total*100):0;
    const li=document.createElement('li');
    li.innerHTML=`<span class="cat-dot" style="background:${d.color};box-shadow:0 0 8px ${d.color}"></span><span class="cat-name">${d.name}</span><span class="cat-val">${fmt(d.value)}</span><span class="cat-pct">${pct}%</span>`;
    leg.appendChild(li);
  });
  if(!data.length) leg.innerHTML='<li style="color:var(--txt-3)">Aucune dépense sur cette période</li>';
}

function renderBar(){
  const data=monthlyTrend(6); const cv=$('#barChart'); if(!cv)return;
  if(charts.bar)charts.bar.destroy();
  charts.bar=new Chart(cv,{type:'bar',data:{labels:data.map(d=>d.label),datasets:[
    {label:'Revenus',data:data.map(d=>d.income),backgroundColor:'rgba(52,245,197,.7)',borderRadius:6,borderSkipped:false},
    {label:'Dépenses',data:data.map(d=>d.expense),backgroundColor:'rgba(255,46,151,.7)',borderRadius:6,borderSkipped:false}
  ]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:tooltipCfg()},
    scales:{x:{grid:{display:false},border:{display:false}},y:{grid:{color:'rgba(255,255,255,.05)'},border:{display:false},ticks:{callback:v=>curSym()+v}}}}});
}

function renderAnalyticsLine(){
  const data=monthlyTrend(12); const cv=$('#analyticsLine'); if(!cv)return;
  if(charts.aline)charts.aline.destroy();
  const ctx=cv.getContext('2d');
  charts.aline=new Chart(ctx,{type:'line',data:{labels:data.map(d=>d.label),datasets:[
    {label:'Solde cumulé',data:data.map(d=>d.cumBalance),borderColor:'#7c3aed',backgroundColor:grad(ctx,'rgba(124,58,237,.3)','rgba(124,58,237,0)'),fill:true,tension:.4,borderWidth:2.5,pointRadius:0,pointHoverRadius:5}
  ]},options:lineOpts()});
}
function renderTopCats(){
  const data=categoryBreakdown(); const total=data.reduce((s,d)=>s+d.value,0);
  const el=$('#topCats'); el.innerHTML='';
  if(!data.length){el.innerHTML='<li style="color:var(--txt-3)">Aucune donnée</li>';return;}
  data.slice(0,6).forEach(d=>{
    const pct=total?Math.round(d.value/total*100):0;
    const li=document.createElement('li');
    li.innerHTML=`<span class="cat-dot" style="background:${d.color};box-shadow:0 0 8px ${d.color}"></span><span class="cat-name">${d.name}</span><span class="cat-val">${fmt(d.value)}</span><span class="cat-pct">${pct}%</span>`;
    el.appendChild(li);
  });
}

function renderRecent(){
  const tx=[...periodTx()].sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,6);
  const el=$('#recentList'); el.innerHTML='';
  if(!tx.length){el.innerHTML='<li style="padding:24px;text-align:center;color:var(--txt-3)">Aucune activité</li>';return;}
  tx.forEach(t=>{
    const c=catOf(t.category);
    const li=document.createElement('li'); li.className='recent-item';
    li.innerHTML=`<span class="ri-icon" style="background:${c.color}22;color:${c.color}"><i class="fa-solid fa-${c.icon}"></i></span>
      <div class="ri-body"><p class="ri-title">${esc(t.description||c.name)}</p><p class="ri-cat">${c.name} · ${fmtDate(t.date)}</p></div>
      <span class="ri-amt ${t.type}">${t.type==='income'?'+':'-'}${fmt(t.amount)}</span>`;
    el.appendChild(li);
  });
}

function renderTable(){
  let tx=periodTx();
  if(state.filterType!=='all') tx=tx.filter(t=>t.type===state.filterType);
  if(state.filterCat!=='all') tx=tx.filter(t=>t.category===state.filterCat);
  if(state.search){ const q=state.search.toLowerCase(); tx=tx.filter(t=>(t.description||'').toLowerCase().includes(q)||t.category.toLowerCase().includes(q)); }
  const [key,dir]=state.sortBy.split('-');
  tx=[...tx].sort((a,b)=>{ let r; if(key==='date')r=new Date(a.date)-new Date(b.date); else r=a.amount-b.amount; return dir==='asc'?r:-r; });
  const body=$('#txTableBody'); body.innerHTML='';
  $('#txEmpty').hidden=tx.length>0;
  tx.forEach(t=>{
    const c=catOf(t.category);
    const tr=document.createElement('tr');
    tr.innerHTML=`<td><div class="tx-cell"><span class="ri-icon" style="background:${c.color}22;color:${c.color}"><i class="fa-solid fa-${c.icon}"></i></span><span class="tx-name">${esc(t.description||c.name)}</span></div></td>
      <td><span class="badge" style="background:${c.color}1f;color:${c.color}"><span class="cat-dot" style="background:${c.color}"></span>${c.name}</span></td>
      <td>${fmtDate(t.date)}</td>
      <td class="ta-r"><span class="tx-amt ${t.type}">${t.type==='income'?'+':'-'}${fmt(t.amount)}</span></td>
      <td><div class="row-actions"><button class="act-btn" data-edit="${t.id}"><i class="fa-solid fa-pen"></i></button><button class="act-btn del" data-del="${t.id}"><i class="fa-solid fa-trash"></i></button></div></td>`;
    body.appendChild(tr);
  });
}

function renderCategoriesView(){
  const grid=$('#catGrid'); grid.innerHTML='';
  const tx=periodTx().filter(t=>t.type==='expense');
  const totals={}; tx.forEach(t=>totals[t.category]=(totals[t.category]||0)+t.amount);
  const max=Math.max(1,...Object.values(totals));
  state.categories.forEach(c=>{
    const amt=totals[c.name]||0;
    const card=document.createElement('article'); card.className='glass cat-card';
    card.innerHTML=`<div class="cc-icon" style="background:${c.color}22;color:${c.color}"><i class="fa-solid fa-${c.icon}"></i></div>
      <h4>${c.name}</h4><p class="cc-amt">${fmt(amt)} ce mois</p>
      <div class="cc-bar"><span style="width:${Math.round(amt/max*100)}%;background:linear-gradient(90deg,${c.color},transparent)"></span></div>`;
    grid.appendChild(card);
  });
}

function renderCatFilter(){
  const sel=$('#catFilter');
  sel.innerHTML='<option value="all">Toutes catégories</option>'+state.categories.map(c=>`<option value="${c.name}">${c.name}</option>`).join('');
  sel.value=state.filterCat;
}
function renderFormCats(){
  const sel=$('#txCategory');
  const type=$('input[name=type]:checked').value;
  const incNames=['Salaire','Freelance'];
  const list=type==='income'?state.categories.filter(c=>incNames.includes(c.name)):state.categories.filter(c=>!incNames.includes(c.name));
  const pool=list.length?list:state.categories;
  sel.innerHTML=pool.map(c=>`<option value="${c.name}">${c.name}</option>`).join('');
}

function renderAll(){
  renderKPIs(); renderTrendChart(); renderDonut(); renderBar(); renderRecent();
  renderTable(); renderAnalyticsLine(); renderTopCats(); renderCategoriesView();
}

/* ---------- VIEW SWITCH ---------- */
const TITLES={overview:['Overview',"Votre santé financière en un coup d'œil"],transactions:['Transactions','Gérez vos mouvements'],analytics:['Analytics','Analyse approfondie'],categories:['Categories','Répartition par catégorie'],settings:['Settings','Préférences de l\'application']};
function switchView(v){
  state.view=v;
  $$('.nav-item').forEach(n=>n.classList.toggle('active',n.dataset.view===v));
  $$('.view').forEach(s=>s.classList.toggle('active',s.id==='view-'+v));
  const t=TITLES[v]||[v,'']; $('#pageTitle').textContent=t[0]; $('#pageSub').textContent=t[1];
  $('#sidebar').classList.remove('open'); $('#overlay').classList.remove('show');
}

/* ---------- PERIOD ---------- */
function updateMonthLabel(){
  $('#currentMonth').textContent=state.period.all?'Tous les mois':`${MONTHS_FR[state.period.month]} ${state.period.year}`;
  $('#allMonthsBtn').classList.toggle('active',state.period.all);
}
function shiftMonth(dir){
  state.period.all=false;
  let {month,year}=state.period;
  month+=dir; if(month>11){month=0;year++;}if(month<0){month=11;year--;}
  state.period.month=month;state.period.year=year;
  updateMonthLabel(); renderAll();
}

/* ---------- PANEL ---------- */
function openPanel(tx){
  $('#curSymbol').textContent=curSym();
  $('#txForm').reset(); $('#errAmount').textContent='';
  if(tx){
    $('#panelTitle').textContent='Modifier la transaction';
    $('#txId').value=tx.id;
    $$('input[name=type]').forEach(r=>r.checked=r.value===tx.type);
    renderFormCats();
    $('#txAmount').value=tx.amount; $('#txCategory').value=tx.category;
    $('#txDate').value=tx.date; $('#txDesc').value=tx.description||'';
  }else{
    $('#panelTitle').textContent='Nouvelle transaction';
    $('#txId').value='';
    $$('input[name=type]')[0].checked=true;
    renderFormCats();
    $('#txDate').value=new Date().toISOString().slice(0,10);
  }
  $('#overlay').classList.add('show'); $('#txPanel').classList.add('open'); $('#txPanel').setAttribute('aria-hidden','false');
}
function closePanel(){
  $('#overlay').classList.remove('show'); $('#txPanel').classList.remove('open'); $('#txPanel').setAttribute('aria-hidden','true');
}

async function submitTx(e){
  e.preventDefault();
  const amount=parseFloat($('#txAmount').value);
  if(!amount||amount<=0){ $('#errAmount').textContent='Montant invalide'; return; }
  const payload={
    type:$('input[name=type]:checked').value,
    amount:Math.round(amount*100)/100,
    category:$('#txCategory').value,
    date:$('#txDate').value,
    description:$('#txDesc').value.trim()
  };
  const id=$('#txId').value;
  try{
    if(id){
      let r=await API.put('transactions/'+id,payload).catch(()=>null);
      const i=state.transactions.findIndex(t=>t.id===id);
      if(i>-1) state.transactions[i]={...state.transactions[i],...(r&&r.id?r:payload),id};
      toast('Transaction mise à jour','success');
    }else{
      const np={id:uid(),...payload};
      let r=await API.post('transactions',np).catch(()=>null);
      state.transactions.push(r&&r.id?r:np);
      toast('Transaction ajoutée','success');
    }
  }catch(err){ toast('Erreur lors de l\'enregistrement','error'); return; }
  closePanel(); renderCatFilter(); renderAll();
}

async function deleteTx(id){
  if(!confirm('Supprimer cette transaction ?')) return;
  try{ await API.del('transactions/'+id).catch(()=>{}); }catch(e){}
  state.transactions=state.transactions.filter(t=>t.id!==id);
  renderAll(); toast('Transaction supprimée','success');
}

/* ---------- TOAST ---------- */
let toastT;
function toast(msg,type='success'){
  const el=$('#toast'); el.textContent=msg; el.className='toast show '+type;
  clearTimeout(toastT); toastT=setTimeout(()=>el.classList.remove('show'),2600);
}

function esc(s){ return String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

/* ---------- EVENTS ---------- */
function bind(){
  $$('.nav-item').forEach(n=>n.addEventListener('click',e=>{e.preventDefault();switchView(n.dataset.view);}));
  $$('[data-view]').forEach(b=>{ if(!b.classList.contains('nav-item')) b.addEventListener('click',e=>{e.preventDefault();switchView(b.dataset.view);}); });

  $('#prevMonth').onclick=()=>shiftMonth(-1);
  $('#nextMonth').onclick=()=>shiftMonth(1);
  $('#allMonthsBtn').onclick=()=>{ state.period.all=!state.period.all; updateMonthLabel(); renderAll(); };

  $('#addTxBtn').onclick=()=>openPanel(null);
  $('#closePanel').onclick=closePanel;
  $('#cancelTx').onclick=closePanel;
  $('#overlay').onclick=()=>{closePanel();$('#sidebar').classList.remove('open');$('#overlay').classList.remove('show');};
  $('#txForm').addEventListener('submit',submitTx);
  $$('input[name=type]').forEach(r=>r.addEventListener('change',renderFormCats));
  $('#txAmount').addEventListener('input',()=>$('#errAmount').textContent='');

  $('#menuToggle').onclick=()=>{$('#sidebar').classList.add('open');$('#overlay').classList.add('show');};

  $('#typeFilter').addEventListener('click',e=>{
    const p=e.target.closest('.pill'); if(!p)return;
    $$('#typeFilter .pill').forEach(x=>x.classList.remove('active')); p.classList.add('active');
    state.filterType=p.dataset.type; renderTable();
  });
  $('#catFilter').addEventListener('change',e=>{state.filterCat=e.target.value;renderTable();});
  $('#sortBy').addEventListener('change',e=>{state.sortBy=e.target.value;renderTable();});
  $('#globalSearch').addEventListener('input',e=>{state.search=e.target.value;if(state.view!=='transactions')switchView('transactions');renderTable();});

  $('#txTableBody').addEventListener('click',e=>{
    const ed=e.target.closest('[data-edit]'); const dl=e.target.closest('[data-del]');
    if(ed){ const t=state.transactions.find(x=>x.id===ed.dataset.edit); if(t)openPanel(t); }
    if(dl){ deleteTx(dl.dataset.del); }
  });

  $('#currencySelect').addEventListener('change',async e=>{
    state.settings.currency=e.target.value;
    try{ await API.put('settings',state.settings).catch(()=>{}); }catch(err){}
    $('#curSymbol').textContent=curSym(); renderAll(); toast('Devise mise à jour','success');
  });
  $('#seedBtn').onclick=async()=>{ await seedData(false); renderCatFilter(); renderAll(); };
  $('#wipeBtn').onclick=async()=>{
    if(!confirm('Effacer définitivement toutes vos données ?'))return;
    for(const t of [...state.transactions]){ try{await API.del('transactions/'+t.id).catch(()=>{});}catch(e){} }
    state.transactions=[]; renderCatFilter(); renderAll(); toast('Données effacées','success');
  };

  document.addEventListener('keydown',e=>{ if(e.key==='Escape'){closePanel();} });
}

/* ---------- INIT ---------- */
async function init(){
  chartBase(); bind();
  await loadAll();
  $('#currencySelect').value=state.settings.currency;
  $('#curSymbol').textContent=curSym();
  renderCatFilter();
  updateMonthLabel();
  renderAll();
}
init();
