const $=s=>document.querySelector(s),$$=s=>document.querySelectorAll(s);
const overlay=$('#overlay'),deck=$('#deck');
let profiles=[],idx=0,free=3,plan='free',myRole='INVESTOR',curMatch=null,matches=[];

const mock=[
{n:'Sarah Capital',a:'S',s:'Fintech · SaaS',st:'Pre-seed → Seed',t:'250K–800K €',b:['Ex-operator devenue VC','Tickets early sur B2B','Décision en <2 semaines']},
{n:'Atlas Ventures',a:'A',s:'Deeptech · AI',st:'Seed → Series A',t:'1M–3M €',b:['Lead sur tours techniques','Réseau US + EU','Conviction-driven']},
{n:'Léo · Founder',a:'L',s:'Climate · Hardware',st:'Pre-seed',t:'Cherche 500K €',b:['MVP déployé, 3 pilotes','Équipe technique solide','12% MoM growth']},
{n:'Nova Fund',a:'N',s:'Consumer · Mobile',st:'Seed',t:'400K–1.2M €',b:['Focus produits virals','Hands-on go-to-market','Cheque rapide']}
];

const api=(u,o)=>fetch('api/'+u,o).then(r=>r.ok?r.json():Promise.reject(r));

const loadProfiles=()=>api('profiles?role='+myRole).then(d=>{profiles=(d&&d.length)?d.map(norm):mock;}).catch(()=>profiles=mock);
const norm=p=>({n:p.name||p.n,a:(p.avatar||p.name||'?')[0].toUpperCase(),s:p.sector||p.s||'',st:p.stage||p.st||'',t:p.ticket||p.t||'',b:p.bullets||p.b||[],id:p.id});

const loadStatus=()=>api('me').then(d=>{if(d){plan=d.plan||'free';free=d.swipesLeft!=null?d.swipesLeft:(plan==='pro'?Infinity:3);}}).catch(()=>{});
const loadMatches=()=>api('matches').then(d=>{matches=d||[];}).catch(()=>matches=[]);

function render(){
  deck.innerHTML='';
  if(idx>=profiles.length){
    deck.innerHTML='<div class="swipe-card" style="align-items:center;justify-content:center;text-align:center"><div class="accent" style="font-size:1.8rem">deck vide ✦</div><p style="color:rgba(255,255,255,.6)">Reviens demain pour de nouveaux profils</p></div>';
    updCounter();return;
  }
  for(let i=Math.min(idx+2,profiles.length-1);i>=idx;i--){
    const p=profiles[i],c=document.createElement('div');
    c.className='swipe-card';
    c.style.transform=`scale(${1-(i-idx)*.04}) translateY(${(i-idx)*-10}px)`;
    c.style.zIndex=10-(i-idx);
    c.innerHTML=`<span class="badge nice">NICE!</span><span class="badge nope">NOPE</span><div class="avatar">${p.a}</div><h3>${p.n}</h3><div class="stage">${p.st}</div><p style="color:rgba(255,255,255,.6);font-size:.85rem">${p.s} · ${p.t}</p><ul>${p.b.map(x=>'<li>'+x+'</li>').join('')}</ul>`;
    deck.appendChild(c);
    if(i===idx)drag(c);
  }
  updCounter();
}

const updCounter=()=>$('#counter').textContent=plan==='pro'?'swipes illimités · plan Pro ✦':`${Math.max(0,free)} swipes restants · plan Free`;

function drag(c){
  let sx=0,dx=0,down=false;
  const start=x=>{down=true;sx=x;c.style.transition='none';};
  const move=x=>{if(!down)return;dx=x-sx;c.style.transform=`translateX(${dx}px) rotate(${dx*.06}deg)`;c.querySelector('.nice').style.opacity=dx>0?Math.min(1,dx/100):0;c.querySelector('.nope').style.opacity=dx<0?Math.min(1,-dx/100):0;};
  const end=()=>{if(!down)return;down=false;c.style.transition='transform .4s,opacity .4s';if(Math.abs(dx)>110)swipe(dx>0);else{c.style.transform='';c.querySelector('.nice').style.opacity=0;c.querySelector('.nope').style.opacity=0;}dx=0;};
  c.addEventListener('mousedown',e=>start(e.clientX));
  window.addEventListener('mousemove',e=>move(e.clientX));
  window.addEventListener('mouseup',end);
  c.addEventListener('touchstart',e=>start(e.touches[0].clientX),{passive:1});
  c.addEventListener('touchmove',e=>move(e.touches[0].clientX),{passive:1});
  c.addEventListener('touchend',end);
}

function swipe(like){
  if(plan!=='pro'&&free<=0){alert('Plus de swipes ! Passe Pro pour swiper sans limite.');return;}
  const top=deck.lastChild;if(!top||!top.querySelector('.avatar'))return;
  const p=profiles[idx];
  top.querySelector(like?'.nice':'.nope').style.opacity=1;
  top.style.transform=`translateX(${like?600:-600}px) rotate(${like?25:-25}deg)`;
  top.style.opacity=0;
  if(plan!=='pro')free--;
  api('swipe',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({profileId:p.id,direction:like?'like':'pass',role:myRole})})
    .then(r=>{if(like&&r&&r.match)showMatch(r.match,p);})
    .catch(()=>{if(like&&Math.random()>.4)showMatch(null,p);});
  setTimeout(()=>{idx++;if(idx<profiles.length||idx>=profiles.length)render();},400);
}

function showMatch(m,p){
  curMatch=m||{id:'local-'+idx,profile:p};
  $('#deckView').style.display='none';
  const mv=$('#matchView');mv.classList.add('show');
  $('#matchAv').textContent=p.a;
  const msgs=$('#msgs');msgs.innerHTML='<div class="bubble them">Hello 👋 super contente de matcher !</div>';
  if(curMatch.id&&!String(curMatch.id).startsWith('local'))loadMessages(curMatch.id);
}

const loadMessages=id=>api('matches/'+id+'/messages').then(d=>{
  const msgs=$('#msgs');if(d&&d.length){msgs.innerHTML=d.map(m=>`<div class="bubble ${m.mine?'me':'them'}">${esc(m.text)}</div>`).join('');msgs.scrollTop=msgs.scrollHeight;}
}).catch(()=>{});

const esc=s=>(s+'').replace(/[<>&]/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;'}[c]));

function backDeck(){$('#matchView').classList.remove('show');$('#deckView').style.display='block';render();}

function send(){
  const i=$('#chatInput');if(!i.value.trim())return;
  const txt=i.value.trim(),m=$('#msgs');
  m.innerHTML+=`<div class="bubble me">${esc(txt)}</div>`;i.value='';m.scrollTop=m.scrollHeight;
  if(curMatch&&!String(curMatch.id).startsWith('local'))
    api('matches/'+curMatch.id+'/messages',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:txt})})
      .then(r=>{if(r&&r.reply){m.innerHTML+=`<div class="bubble them">${esc(r.reply)}</div>`;m.scrollTop=m.scrollHeight;}}).catch(()=>autoReply(m));
  else autoReply(m);
}
const autoReply=m=>setTimeout(()=>{m.innerHTML+='<div class="bubble them">Parfait, on cale un call cette semaine ? 🚀</div>';m.scrollTop=m.scrollHeight;},800);

function openDeck(){overlay.classList.add('show');$('#matchView').classList.remove('show');$('#deckView').style.display='block';idx=0;Promise.all([loadStatus(),loadProfiles(),loadMatches()]).then(render);}
const closeDeck=()=>overlay.classList.remove('show');
function role(el){$$('.tag').forEach(t=>t.classList.remove('on'));el.classList.add('on');myRole=el.textContent.trim();}

window.openDeck=openDeck;window.closeDeck=closeDeck;window.swipe=swipe;window.backDeck=backDeck;window.send=send;window.role=role;

document.addEventListener('keydown',e=>{if(!overlay.classList.contains('show'))return;if(e.key==='Escape')closeDeck();if($('#deckView').style.display!=='none'){if(e.key==='ArrowRight')swipe(true);if(e.key==='ArrowLeft')swipe(false);}});
