const state={clients:[{id:'c1',name:'Studio Lumen',email:'hello@lumen.io',address:'12 rue des Arts, Paris'},{id:'c2',name:'Nova Tech',email:'contact@nova.tech',address:'8 av. Numérique, Lyon'}],invoices:[],seq:1042};

function id(){return Date.now().toString(36)+Math.random().toString(36).slice(2,6);}

export default function handler(req,res){
  const url=req.url.split('?')[0].replace(/\/$/,'')||'/';
  const m=req.method;

  if(url==='/clients'&&m==='GET')return res.json({success:true,data:state.clients});
  if(url==='/clients'&&m==='POST'){
    const c={id:id(),...req.body};state.clients.push(c);return res.json({success:true,data:c});
  }

  if(url==='/invoices'&&m==='GET')return res.json({success:true,data:state.invoices});
  if(url==='/invoices'&&m==='POST'){
    const inv={id:id(),createdAt:Date.now(),...req.body};state.invoices.push(inv);return res.json({success:true,data:inv});
  }

  if(url==='/next-number'&&m==='GET'){
    state.seq++;const y=new Date().getFullYear();return res.json({success:true,number:`FAC-${y}-${String(state.seq).padStart(4,'0')}`});
  }

  const tog=url.match(/^\/invoices\/([^/]+)\/toggle$/);
  if(tog&&m==='PUT'){
    const inv=state.invoices.find(i=>i.id===tog[1]);
    if(inv){inv.status=inv.status==='paid'?'pending':'paid';return res.json({success:true,data:inv});}
    return res.status(404).json({error:'Introuvable'});
  }

  const del=url.match(/^\/invoices\/([^/]+)$/);
  if(del&&m==='DELETE'){
    state.invoices=state.invoices.filter(i=>i.id!==del[1]);return res.json({success:true});
  }

  res.status(404).json({error:'Route non trouvée'});
}