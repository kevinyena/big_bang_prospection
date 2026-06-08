const $=s=>document.querySelector(s),$$=s=>document.querySelectorAll(s);
let role='vc',deck=[],idx=0,curMatch=null;
const seed={vc:[
 {id:'s1',name:'NeuraFlow',av:'NF',sub:'Pre-seed · IA générative',tag:'Tagline: Copilote no-code pour data teams',chips:['IA','SaaS','B2B'],meta:[['$1.2M','Recherché'],['Pre-seed','Stade'],['+40%/mo','Traction'],['3','Équipe']]},
 {id:'s2',name:'GreenLoop',av:'GL',sub:'Seed · Climate Tech',tag:'Tagline: Recyclage circulaire piloté par IoT',chips:['Climate','Hardware','Impact'],meta:[['$3M','Recherché'],['Seed','Stade'],['12 pilotes','Traction'],['7','Équipe']]},
 {id:'s3',name:'PayRails',av:'PR',sub:'Seed · Fintech',tag:'Tagline: Infrastructure de paiement pour LATAM',chips:['Fintech','Payments','API'],meta:[['$4.5M','Recherché'],['Seed','Stade'],['$2M GMV','Traction'],['9','Équipe']]},
 {id:'s4',name:'MediTwin',av:'MT',sub:'Pre-seed · HealthTech',tag:'Tagline: Jumeau numérique pour essais cliniques',chips:['Health','AI','DeepTech'],meta:[['$2M','Recherché'],['Pre-seed','Stade'],['2 LOI','Traction'],['4','Équipe']]}],
 founder:[
 {id:'v1',name:'Atlas Ventures',av:'AV',sub:'Fonds Seed · Europe',tag:'Thèse: B2B SaaS & infra dev-first',chips:['SaaS','DevTools','B2B'],meta:[['$500k-2M','Ticket'],['Seed','Stade'],['Notion, Pennylane','Portfolio'],['48h','Réponse']]},
 {id:'v2',name:'Nova Capital',av:'NC',sub:'Business Angel',tag:'Thèse: Climate & impact à fort levier',chips:['Climate','Impact','Hardware'],meta:[['$50-300k','Ticket'],['Pre-seed','Stade'],['Back Market','Portfolio'],['24h','Réponse']]},
 {id:'v3',name:'Quantum Fund',av:'QF',sub:'Fonds Early · Global',tag:'Thèse: DeepTech & IA fondamentale',chips:['AI','DeepTech','Science'],meta:[['$1-5M','Ticket'],['Seed','Stade'],['Mistral, H','Portfolio'],['72h','Réponse']]}]};
const setRole=r=>{role=r;$$('.role-toggle button').forEach(b=>b.classList.toggle('active',b.dataset.role===r))};
const openApp=async()=>{$('#app').classList.add('on');idx=0;await loadDeck();render()};
const closeApp=()=>$('#app').classList.remove('on');
const closeMatch=()=>$('#match').classList.remove('on');
const api=(u,o)=>fetch('api/'+u,o).then(r=>r.json());
async function loadDeck(){try{const d=await api('profiles?role='+role);deck=Array.isArray(d)&&d.length?d:seed[role]}catch{deck=seed[role]}}
function render(){const d=$('#deck');d.innerHTML='';const slice=deck.slice(idx,idx+3).reverse();
 slice.forEach((p,i)=>{const real=slice.length-1-i;const c=document.createElement('div');c.className='swipe-card';
  c.style.transform=`scale(${1-real*.04}) translateY(${real*-12}px)`;c.style.zIndex=10-real;
  c.innerHTML=`<div class="badge like">LIKE</div><div class="badge nope">NOPE</div>
   <div class="top"><div class="av">${p.av||p.name[0]}</div><div><h3>${p.name}</h3><div class="sub">${p.sub||''}</div></div></div>
   <p style="color:#fff;font-weight:500">${p.tag||''}</p>
   <div class="chips">${(p.chips||[]).map(x=>`<span class="chip">${x}</span>`).join('')}</div>
   <div class="meta">${(p.meta||[]).map(m=>`<div><b>${m[0]}</b><span>${m[1]}</span></div>`).join('')}</div>`;
  if(real===0)drag(c,p);d.appendChild(c)})}
function drag(c,p){let sx=0,sy=0,dx=0,dy=0,down=false;
 const start=e=>{down=true;sx=(e.touches?e.touches[0]:e).clientX;sy=(e.touches?e.touches[0]:e).clientY;c.style.transition='none'};
 const move=e=>{if(!down)return;const x=(e.touches?e.touches[0]:e).clientX,y=(e.touches?e.touches[0]:e).clientY;
  dx=x-sx;dy=y-sy;c.style.transform=`translate(${dx}px,${dy}px) rotate(${dx/18}deg)`;
  c.querySelector('.badge.like').style.opacity=dx>0?Math.min(dx/100,1):0;
  c.querySelector('.badge.nope').style.opacity=dx<0?Math.min(-dx/100,1):0};
 const end=()=>{if(!down)return;down=false;c.style.transition='.4s';
  if(Math.abs(dx)>110)fly(dx>0?'right':'left');
  else{c.style.transform='';c.querySelectorAll('.badge').forEach(b=>b.style.opacity=0)}};
 c.addEventListener('mousedown',start);addEventListener('mousemove',move);addEventListener('mouseup',end);
 c.addEventListener('touchstart',start,{passive:1});c.addEventListener('touchmove',move,{passive:1});c.addEventListener('touchend',end)}
function fly(dir){const c=$('#deck').lastChild;if(!c)return;const p=deck[idx];
 c.style.transition='.5s';c.style.transform=`translate(${dir==='right'?1200:-1200}px,80px) rotate(${dir==='right'?40:-40}deg)`;
 c.style.opacity=0;setTimeout(()=>{idx++;render();if(dir==='right')doSwipe(p)},350)}
const swipe=dir=>fly(dir);
async function doSwipe(p){let m=false;try{const r=await api('swipe',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({targetId:p.id,direction:'right'})});m=r.isMatch}catch{m=Math.random()<.5}
 if(m)showMatch(p)}
function showMatch(p){curMatch=p;$('#matchTxt').textContent=`Vous et ${p.name} vous êtes likés. Lancez la conversation !`;
 $('#msgs').innerHTML='';$('#match').classList.add('on');confetti();loadChat(p)}
async function loadChat(p){const box=$('#msgs');try{const ms=await api('chat/'+p.id);if(Array.isArray(ms)&&ms.length){box.innerHTML=ms.map(m=>`<div class="msg ${m.me?'me':'them'}">${m.text}</div>`).join('');return}}catch{}
 addMsg(`Bonjour ! Ravi de matcher. Parlons de votre projet 👋`,'them')}
function addMsg(t,who){const m=document.createElement('div');m.className='msg '+who;m.textContent=t;$('#msgs').appendChild(m);$('#msgs').scrollTop=1e9}
async function sendMsg(){const i=$('#msgIn'),t=i.value.trim();if(!t)return;addMsg(t,'me');i.value='';
 try{await api('chat/'+(curMatch?.id||''),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:t})})}catch{}
 setTimeout(()=>addMsg('Super, envoyez-moi votre deck et on cale un call cette semaine.','them'),900)}
$('#msgIn').addEventListener('keydown',e=>{if(e.key==='Enter')sendMsg()});
addEventListener('keydown',e=>{if(!$('#app').classList.contains('on'))return;if(e.key==='ArrowRight')swipe('right');if(e.key==='ArrowLeft')swipe('left')});
function confetti(){const w=$('#confetti');w.innerHTML='';const cs=['#ff2d78','#9b4dff','#22e0a0','#ffd23f'];
 for(let i=0;i<60;i++){const f=document.createElement('i');f.style.left=Math.random()*100+'%';f.style.top=-10+'px';
  f.style.background=cs[i%cs.length];f.style.animationDelay=Math.random()*2+'s';f.style.animationDuration=2+Math.random()*2+'s';w.appendChild(f)}}
function heroDeck(){const h=$('#heroDeck');if(!h)return;const ps=seed.vc;
 ps.slice(0,3).forEach((p,i)=>{const c=document.createElement('div');c.className='swipe-card';
  c.style.transform=`scale(${1-i*.05}) translateY(${i*14}px) rotate(${i*-2}deg)`;c.style.zIndex=3-i;c.style.maxWidth='340px';c.style.margin='0 auto';c.style.position=i?'absolute':'relative';c.style.inset=i?'0':'';
  c.innerHTML=`<div class="top"><div class="av">${p.av}</div><div><h3>${p.name}</h3><div class="sub">${p.sub}</div></div></div>
   <p style="color:#fff">${p.tag}</p><div class="chips">${p.chips.map(x=>`<span class="chip">${x}</span>`).join('')}</div>
   <div class="meta">${p.meta.map(m=>`<div><b>${m[0]}</b><span>${m[1]}</span></div>`).join('')}</div>`;h.appendChild(c)})}
heroDeck();
