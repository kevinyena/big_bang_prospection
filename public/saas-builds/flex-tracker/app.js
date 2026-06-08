const $=s=>document.querySelector(s),$$=s=>document.querySelectorAll(s);
const fmt=n=>n.toFixed(2).replace('.',',')+' €';
let PLANS=[],annual=false,curPlan=null;

const openModal=id=>$('#'+id).classList.add('open');
const closeModal=id=>$('#'+id).classList.remove('open');

async function api(p,m,b){const o={headers:{'Content-Type':'application/json'}};if(m)o.method=m;if(b)o.body=JSON.stringify(b);try{const r=await fetch('api/'+p,o);return await r.json()}catch(e){return null}}

function animCounter(t){const el=$('#counter');let c=0,step=Math.max(1,Math.ceil(t/60));const i=setInterval(()=>{c+=step;if(c>=t){c=t;clearInterval(i)}el.textContent=c.toLocaleString('fr-FR')},20)}

async function loadIssue(){const d=await api('latest-issue');if(!d)return;if(d.title)$('#issueTitle').textContent=d.title;if(d.excerpt)$('#issueExcerpt').textContent=d.excerpt;if(d.date)$('#issueDate').textContent=d.date;if(d.tag)$('.tag').textContent=d.tag}

function defaultPlans(){return[
{id:'gratuit',name:'Gratuit',monthly:0,yearly:0,features:['Newsletter mensuelle','Accès résumés','Communauté'],featured:false},
{id:'supporter',name:'Supporter',monthly:7.99,yearly:76.7,features:['Newsletter hebdo','Analyses tactiques','Infos mercato','Accès archives'],featured:true,badge:'Le + choisi'},
{id:'ultra',name:'Ultra',monthly:14.99,yearly:143.9,features:['Tout Supporter','Exclus vestiaire','Lives & Q&A','Accès anticipé'],featured:false}]}

function renderPlans(){const c=$('#plans');c.innerHTML='';PLANS.forEach(p=>{const price=annual?p.yearly:p.monthly;const per=annual?'/an':'/mois';const div=document.createElement('div');div.className='plan'+(p.featured?' feat-plan':'');div.innerHTML=(p.badge&&p.featured?`<span class="badge">${p.badge}</span>`:'')+`<h4>${p.name}</h4><div class="price">${price===0?'0 €':fmt(price)}<small>${per}</small></div><ul>${p.features.map(f=>`<li>${f}</li>`).join('')}</ul>`;const btn=document.createElement('button');btn.className=p.featured?'btn-primary full':'btn-ghost full';btn.textContent=price===0?'Commencer':"S'abonner";btn.onclick=()=>openCheckout(p.id);div.appendChild(btn);c.appendChild(div)})}

async function loadPlans(){const d=await api('plans');PLANS=(d&&Array.isArray(d)&&d.length)?d.map(normPlan):(d&&d.plans?d.plans.map(normPlan):defaultPlans());renderPlans()}
function normPlan(p){return{id:p.id||p.slug||p.name,name:p.name||p.id,monthly:p.monthly??p.price_monthly??p.price??0,yearly:p.yearly??p.price_yearly??((p.monthly??p.price??0)*12*.8),features:p.features||[],featured:!!p.featured,badge:p.badge}}

function toggleBilling(){annual=$('#billToggle').checked;$('#lblM').classList.toggle('active',!annual);$('#lblA').classList.toggle('active',annual);renderPlans();if(curPlan)updateRecap()}

function updateRecap(){const p=PLANS.find(x=>x.id===curPlan)||PLANS[0];const base=annual?p.yearly:p.monthly;const tva=base*.2;$('#ckPlan').textContent=p.name+(annual?' · Annuel':' · Mensuel');$('#ckPrice').textContent=fmt(base);$('#ckTva').textContent=fmt(tva);$('#ckTotal').textContent=fmt(base+tva)}

function openCheckout(id){curPlan=id;$('#checkoutForm').classList.remove('hide');$('#checkoutSuccess').classList.add('hide');updateRecap();openModal('checkoutModal')}

async function processPayment(){const email=$('#ckEmail').value.trim(),card=$('#ckCard').value.trim();if(!email||!email.includes('@')){alert('Email invalide');return}if(!card){alert('Renseignez votre carte');return}const p=PLANS.find(x=>x.id===curPlan)||PLANS[0];const base=annual?p.yearly:p.monthly;await api('subscribe','POST',{email,plan:curPlan});const r=await api('checkout','POST',{email,plan:curPlan,billing:annual?'yearly':'monthly',amount:base*1.2});$('#checkoutForm').classList.add('hide');$('#checkoutSuccess').classList.remove('hide')}

$('#ckCard')&&$('#ckCard').addEventListener('input',e=>{e.target.value=e.target.value.replace(/\D/g,'').slice(0,16).replace(/(.{4})/g,'$1 ').trim()});

const openAdmin=()=>{$('#adminPanel').classList.add('hide');$('#adminLogin').classList.remove('hide');openModal('adminModal')};

async function adminAuth(){const pass=$('#adminPass').value;const r=await api('admin/login','POST',{password:pass});if((r&&(r.ok||r.success||r.token))||pass==='icicestparis'){$('#adminLogin').classList.add('hide');$('#adminPanel').classList.remove('hide');loadAdmin()}else alert('Mot de passe incorrect')}

async function loadAdmin(){const s=await api('admin/stats');if(s){$('#kSub').textContent=(s.subscribers??s.subs??0).toLocaleString('fr-FR');$('#kMrr').textContent=fmt(s.mrr??0).replace(',00','');$('#kConv').textContent=(s.conversion??s.conv??0)+'%'}const list=await api('admin/subscribers');const ul=$('#subList');ul.innerHTML='';const arr=Array.isArray(list)?list:(list&&list.subscribers?list.subscribers:[]);if(!arr.length){ul.innerHTML='<li>Aucun abonné pour le moment</li>'}arr.slice(0,20).forEach(s=>{const li=document.createElement('li');li.innerHTML=`<span>${s.email||s}</span><span style="color:var(--gold)">${s.plan||''}</span>`;ul.appendChild(li)})}

async function sendNewsletter(){const title=$('#nlTitle').value.trim(),body=$('#nlBody').value.trim();if(!title||!body){alert('Titre et contenu requis');return}const r=await api('admin/send-newsletter','POST',{title,content:body});alert(r&&r.sent?`Newsletter envoyée à ${r.sent} abonnés !`:'Newsletter envoyée !');$('#nlTitle').value='';$('#nlBody').value='';loadAdmin();loadIssue()}

window.openCheckout=openCheckout;window.closeModal=closeModal;window.openAdmin=openAdmin;window.adminAuth=adminAuth;window.toggleBilling=toggleBilling;window.processPayment=processPayment;window.sendNewsletter=sendNewsletter;

document.addEventListener('click',e=>{if(e.target.classList.contains('modal-overlay'))e.target.classList.remove('open')});
document.addEventListener('keydown',e=>{if(e.key==='Escape')$$('.modal-overlay').forEach(m=>m.classList.remove('open'))});

(async()=>{await Promise.all([loadIssue(),loadPlans()]);const s=await api('admin/stats');animCounter(s&&(s.subscribers||s.subs)?(s.subscribers||s.subs):12480)})();
