const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
let role='founder',deck=[],idx=0,matches=[],curMatch=null,lastMatch=null;
const ME='https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120&q=80';
const fmt=t=>{const d=new Date(t);return isNaN(d)?'':d.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})};
const esc=s=>(s||'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const api=(u,o)=>fetch('api/'+u,o).then(r=>r.json());
const MOCK={founder:[
 {id:'i1',name:'Sequoia Edge',img:'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=600&q=80',tag:'VC · $250k–2M tickets',bio:'Backing relentless founders at pre-seed & seed. Thesis: AI, fintech, dev tools.',chips:['AI','Fintech','Seed','Hands-on']},
 {id:'i2',name:'Lumen Ventures',img:'https://images.unsplash.com/photo-1556157382-97eda2d62296?w=600&q=80',tag:'VC · $500k–5M tickets',bio:'Series A specialists. We help you scale GTM and hire your first VP.',chips:['SaaS','B2B','Series A','GTM']},
 {id:'i3',name:'North Star Capital',img:'https://images.unsplash.com/photo-1612831455359-970e23a1e4e9?w=600&q=80',tag:'Angel · $50k–250k',bio:'Operator angels. Ex-founders who exited. Fast decisions, real network.',chips:['Pre-seed','Marketplace','Angel']}],
 investor:[
 {id:'f1',name:'NovaFlow AI',img:'https://images.unsplash.com/photo-1559136555-9303baea8ebd?w=600&q=80',tag:'Seed · Raising $1.5M · SaaS',bio:'AI workflow automation for ops teams. $40k MRR, 18% MoM growth.',chips:['AI','$40k MRR','+18% MoM','12 logos']},
 {id:'f2',name:'Verde Logistics',img:'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=600&q=80',tag:'Pre-seed · Raising $800k · Climate',bio:'Carbon-neutral last-mile delivery. 3 city pilots, LOIs from 2 retailers.',chips:['Climate','LOIs','Pre-seed']},
 {id:'f3',name:'Pulse Health',img:'https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=600&q=80',tag:'Seed · Raising $2M · HealthTech',bio:'Remote patient monitoring. $120k ARR, FDA pathway cleared.',chips:['HealthTech','$120k ARR','FDA']}]};
const MMOCK=[
 {id:'i1',name:'Sequoia Edge',img:'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=600&q=80',last:'Loved the traction. Free to chat Thursday?',online:true},
 {id:'i2',name:'Lumen Ventures',img:'https://images.unsplash.com/photo-1556157382-97eda2d62296?w=600&q=80',last:'Send over the deck when you can 🚀',online:false}];
const MSG={i1:[{me:0,t:'Hey! Your numbers are impressive.',ts:Date.now()-9e5},{me:1,t:'Thanks! Happy to walk you through them.',ts:Date.now()-8e5},{me:0,t:'Loved the traction. Free to chat Thursday?',ts:Date.now()-6e5}],
 i2:[{me:0,t:'Interested in your seed round.',ts:Date.now()-7e5},{me:0,t:'Send over the deck when you can 🚀',ts:Date.now()-5e5}]};

$('#roleToggle').onchange;
$$('#roleToggle button').forEach(b=>b.onclick=()=>{$$('#roleToggle button').forEach(x=>x.classList.remove('active'));b.classList.add('active');role=b.dataset.role});

window.openApp=()=>{$('#appOverlay').classList.add('on');showDeck();loadDeck()};
window.closeApp=()=>$('#appOverlay').classList.remove('on');
window.showDeck=()=>{$('#tabDeck').classList.add('active');$('#tabChat').classList.remove('active');$('#deckWrap').style.display='flex';$('#chatWrap').style.display='none'};
window.showChat=()=>{$('#tabChat').classList.add('active');$('#tabDeck').classList.remove('active');$('#deckWrap').style.display='none';$('#chatWrap').style.display='grid';loadMatches()};

const loadDeck=()=>api('deck?role='+role).then(d=>{deck=Array.isArray(d)&&d.length?d:MOCK[role];idx=0;render()}).catch(()=>{deck=MOCK[role];idx=0;render()});

function render(){const el=$('#deck');if(idx>=deck.length){el.innerHTML='<div class="s-card" style="display:grid;place-items:center;cursor:default"><div style="text-align:center;color:var(--mut);padding:30px"><i class="fa-solid fa-champagne-glasses" style="font-size:40px;color:var(--v)"></i><h3 style="margin:14px 0 6px;color:var(--txt)">You\'re all caught up!</h3><p>Check back later for fresh profiles.</p></div></div>';return}
 el.innerHTML='';for(let i=Math.min(idx+2,deck.length-1);i>=idx;i--){const c=deck[i],n=document.createElement('div');n.className='s-card';n.style.zIndex=10-i;n.style.transform=`scale(${1-(i-idx)*.04}) translateY(${(i-idx)*10}px)`;
 n.innerHTML=`<div class="swipe-tag l">PASS</div><div class="swipe-tag r">LIKE</div><img src="${c.img}" alt=""/><div class="si"><h3>${esc(c.name)}</h3><div class="tag">${esc(c.tag)}</div><p>${esc(c.bio)}</p><div class="chips">${(c.chips||[]).map(x=>`<span>${esc(x)}</span>`).join('')}</div></div>`;
 el.appendChild(n);if(i===idx)drag(n,c)}}

function drag(card,data){let sx,sy,dx=0,dy=0,down=0;const l=card.querySelector('.swipe-tag.l'),r=card.querySelector('.swipe-tag.r');
 const start=e=>{down=1;sx=(e.touches?e.touches[0]:e).clientX;sy=(e.touches?e.touches[0]:e).clientY;card.style.transition='none';card.style.cursor='grabbing'};
 const move=e=>{if(!down)return;const p=e.touches?e.touches[0]:e;dx=p.clientX-sx;dy=p.clientY-sy;card.style.transform=`translate(${dx}px,${dy}px) rotate(${dx*.06}deg)`;r.style.opacity=Math.max(0,dx/100);l.style.opacity=Math.max(0,-dx/100)};
 const end=()=>{if(!down)return;down=0;card.style.transition='transform .35s';card.style.cursor='grab';if(dx>110)fly('right',data);else if(dx<-110)fly('left',data);else{card.style.transform='';l.style.opacity=r.style.opacity=0}dx=dy=0};
 card.addEventListener('mousedown',start);addEventListener('mousemove',move);addEventListener('mouseup',end);
 card.addEventListener('touchstart',start,{passive:1});card.addEventListener('touchmove',move,{passive:1});card.addEventListener('touchend',end)}

window.btnSwipe=dir=>{if(idx>=deck.length)return;const card=$('#deck .s-card:last-child');if(card){card.style.transition='transform .35s';fly(dir,deck[idx])}};

function fly(dir,data){const card=$('#deck .s-card:last-child');if(card){const x=dir==='left'?-700:dir==='right'?700:0,y=dir==='up'?-700:120;card.style.transform=`translate(${x}px,${y}px) rotate(${x*.05}deg)`;card.style.opacity=0}
 const tgt=deck[idx];idx++;setTimeout(render,300);
 api('swipe',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({targetId:data.id,direction:dir})})
  .then(r=>{if(r&&r.match)showMatch(tgt)}).catch(()=>{if(dir!=='left'&&Math.random()>.4)showMatch(tgt)})}

function showMatch(t){lastMatch=t;$('#themImg').src=t.img;$('#meImg').src=ME;$('#matchText').textContent=`You and ${t.name} liked each other. Start the conversation!`;
 const c=$('#confetti');c.innerHTML='';const cols=['#8B5CF6','#EC4899','#22D3EE','#34D399','#F43F5E'];
 for(let i=0;i<60;i++){const f=document.createElement('i');f.style.left=Math.random()*100+'%';f.style.background=cols[i%5];f.style.animationDuration=(2+Math.random()*2)+'s';f.style.animationDelay=Math.random()+'s';f.style.borderRadius=Math.random()>.5?'50%':'2px';c.appendChild(f)}
 $('#matchModal').classList.add('on')}
window.closeMatch=()=>$('#matchModal').classList.remove('on');
window.goToChat=()=>{closeMatch();if(lastMatch&&!matches.find(m=>m.id===lastMatch.id))matches.unshift({id:lastMatch.id,name:lastMatch.name,img:lastMatch.img,last:'Say hi 👋',online:true});showChat();setTimeout(()=>openChat(lastMatch.id),60)};

const loadMatches=()=>api('matches').then(d=>{matches=Array.isArray(d)&&d.length?d:(matches.length?matches:MMOCK);renderMatches()}).catch(()=>{matches=matches.length?matches:MMOCK;renderMatches()});

function renderMatches(){$('#matchBadge').textContent=matches.length;const el=$('#chatList');
 if(!matches.length){el.innerHTML='<p style="color:var(--mut);font-size:13px;padding:14px;text-align:center">No matches yet.<br>Keep swiping!</p>';return}
 el.innerHTML=matches.map(m=>`<div class="ci${curMatch===m.id?' active':''}" onclick="openChat('${m.id}')"><img src="${m.img}" alt=""/><div style="flex:1;min-width:0"><b>${esc(m.name)}</b><small>${esc(m.last||'')}</small></div>${m.online?'<span class="dot"></span>':''}</div>`).join('')}

function openChat(id){curMatch=id;const m=matches.find(x=>x.id===id)||MMOCK.find(x=>x.id===id);renderMatches();
 $('#chatMain').innerHTML=`<div class="chat-top"><img src="${m.img}" alt=""/><div><b>${esc(m.name)}</b>${m.online?'<small style="color:var(--g);font-size:12px">● online</small>':''}</div></div><div class="msgs" id="msgs"></div><form class="chat-input" id="cinput"><input id="mInput" placeholder="Type a message..." autocomplete="off"/><button type="submit"><i class="fa-solid fa-paper-plane"></i></button></form>`;
 $('#cinput').onsubmit=e=>{e.preventDefault();send(id)};
 api(`matches/${id}/messages`).then(d=>renderMsgs(Array.isArray(d)&&d.length?d:(MSG[id]||[]))).catch(()=>renderMsgs(MSG[id]||[]))}

function renderMsgs(arr){const el=$('#msgs');el.innerHTML=arr.map(m=>`<div class="msg ${m.me?'me':'them'}">${esc(m.t)}</div>`).join('');el.scrollTop=el.scrollHeight}

function send(id){const i=$('#mInput'),t=i.value.trim();if(!t)return;i.value='';
 const el=$('#msgs');el.insertAdjacentHTML('beforeend',`<div class="msg me">${esc(t)}</div>`);el.scrollTop=el.scrollHeight;
 const m=matches.find(x=>x.id===id);if(m){m.last=t;renderMatches()}
 api(`matches/${id}/messages`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:t})})
  .then(r=>{if(r&&r.reply){el.insertAdjacentHTML('beforeend',`<div class="msg them">${esc(r.reply)}</div>`);el.scrollTop=el.scrollHeight}}).catch(()=>{})}
