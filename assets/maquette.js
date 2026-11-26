/* Belles Creators · Atelier — maquette-studio (owner only).
   A page-based design editor for wedding maquettes / wedding books (16:9 pages, 960×540):
   text, photos (paste, drop, crop), shapes, checklists, and raster tools on photos and
   paint layers: brush, eraser, shade, blend (smudge/blur), fill bucket, lasso cut-out.
   Saves to Supabase (table `maquettes`, private bucket `maquettes`) in cloud mode,
   or to IndexedDB in the local demo. */
(function(){
'use strict';
const W=960,H=540,VER=1,MAX_IMG=2400,UNDO_MAX=40;
const INK='#3b2c25',GOLD='#b7935c',MUTED='#8a7464',CREAM='#f7f1ea',ROSE='#ecd5d8',DARK='#1d1715',LIGHT='#f3e9dc';
const SWATCHES=['#ffffff','#f7f1ea','#efe4d6','#ecd5d8','#e8c9cc','#f2d2bd','#f1e1a8','#cfe3d8','#cfdcea','#ddd3ea','#e6c48f','#b7935c','#9a7052','#6e4b33','#8a7464','#3b2c25','#7a1f2b','#4a0f17','#2d0809','#1d1715','#000000'];
const FONTS=['Cormorant','Playfair Display','Libre Caslon Text','Cinzel','Pinyon Script','Great Vibes','Jost','Montserrat'];
const BLENDS=[['normal','Normaal'],['multiply','Vermenigvuldigen'],['screen','Bleken'],['overlay','Overlay'],['soft-light','Zacht licht'],['hard-light','Hard licht'],['darken','Donkerder'],['lighten','Lichter'],['color','Kleur'],['luminosity','Helderheid']];
const PAINT_MODES=[['source-over','Normaal'],['multiply','Vermenigvuldigen'],['screen','Bleken'],['overlay','Overlay'],['soft-light','Zacht licht'],['color','Inkleuren (kleur)'],['hue','Tint']];
const MONTHS=['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];

const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid=()=>Math.random().toString(36).slice(2,9)+Date.now().toString(36).slice(-4);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const num=(v,d)=>{const n=parseFloat(v);return isFinite(n)?n:d;};
const col=c=>/^#[0-9a-f]{3,8}$/i.test(c||'')||/^rgba?\([\d.,\s%]+\)$/.test(c||'')?c:'transparent';
const fontOf=f=>FONTS.includes(f)?f:'Cormorant';
const safeRef=r=>typeof r==='string'&&/^(sb:|idb:|data:image\/(png|jpeg|webp);|\.\/assets\/img\/[\w.-]+$)/.test(r)?r:null;
const fixed=(v,n=2)=>Math.round(v*10**n)/10**n;

let host={cloud:null,toast:t=>console.log(t),owner:()=>true};
const toast=t=>{try{host.toast(t);}catch(e){}};

/* ================= storage ================= */
const LocalStore={
  db:null,
  open(){if(this.db)return Promise.resolve(this.db);return new Promise((res,rej)=>{const r=indexedDB.open('bc_maquettes',1);r.onupgradeneeded=()=>{const d=r.result;d.createObjectStore('maq',{keyPath:'id'});d.createObjectStore('img');};r.onsuccess=()=>{this.db=r.result;res(this.db);};r.onerror=()=>rej(r.error);});},
  async tx(name,mode,fn){const d=await this.open();return new Promise((res,rej)=>{const t=d.transaction(name,mode);const r=fn(t.objectStore(name));t.oncomplete=()=>res(r&&'result' in r?r.result:undefined);t.onerror=()=>rej(t.error);});},
  async list(){const all=await this.tx('maq','readonly',s=>s.getAll())||[];return all.map(m=>({id:m.id,title:m.title,couple:m.couple,wedding_date:m.wedding_date,place:m.place,updated_at:m.updated_at,cover:(m.data.pages||[])[0]})).sort((a,b)=>String(b.updated_at).localeCompare(a.updated_at));},
  get(id){return this.tx('maq','readonly',s=>s.get(id));},
  async create(row){const m={...row,id:(crypto.randomUUID?crypto.randomUUID():uid()),version:1,updated_at:new Date().toISOString()};await this.tx('maq','readwrite',s=>s.put(m));return m;},
  async save(id,patch,version){const m=await this.get(id);if(!m)throw new Error('Maquette niet gevonden');if(m.version!==version)return null;Object.assign(m,patch,{version:version+1,updated_at:new Date().toISOString()});await this.tx('maq','readwrite',s=>s.put(m));return m.version;},
  async remove(id){await this.tx('img','readwrite',s=>s.delete(IDBKeyRange.bound(id+'/',id+'/￿')));await this.tx('maq','readwrite',s=>s.delete(id));},
  async putImage(mid,blob,ext){const key=mid+'/'+uid()+'.'+ext;await this.tx('img','readwrite',s=>s.put(blob,key));return 'idb:'+key;},
  getImage(ref){return this.tx('img','readonly',s=>s.get(ref.slice(4)));}
};
const CloudStore={
  list:()=>host.cloud.listMaquettes(),
  get:id=>host.cloud.getMaquette(id),
  create:row=>host.cloud.createMaquette(row),
  save:(id,patch,v)=>host.cloud.saveMaquette(id,patch,v),
  remove:id=>host.cloud.deleteMaquette(id),
  async putImage(mid,blob,ext){return 'sb:'+await host.cloud.uploadMaquetteImage(mid,blob,ext);},
  getImage:ref=>host.cloud.downloadMaquetteImage(ref.slice(3))
};
const store=()=>host.cloud?CloudStore:LocalStore;

/* image refs → object URLs */
const urlCache=new Map(),loading=new Map();
function refURL(ref){ref=safeRef(ref);if(!ref)return null;if(/^(data:|\.\/)/.test(ref))return ref;return urlCache.get(ref)||null;}
function ensureURL(ref){
  ref=safeRef(ref);if(!ref)return Promise.resolve(null);
  const u=refURL(ref);if(u)return Promise.resolve(u);
  if(loading.has(ref))return loading.get(ref);
  const p=Promise.resolve().then(()=>store().getImage(ref)).then(b=>{if(!b)return null;const x=URL.createObjectURL(b);urlCache.set(ref,x);return x;}).catch(()=>null).finally(()=>loading.delete(ref));
  loading.set(ref,p);return p;
}
function hydrate(root){root.querySelectorAll('img[data-ref]').forEach(img=>{const r=img.dataset.ref,u=refURL(r);if(u){if(img.getAttribute('src')!==u)img.src=u;}else ensureURL(r).then(x=>{if(x&&img.dataset.ref===r)img.src=x;});});}
function loadImg(src){return new Promise((res,rej)=>{const i=new Image();i.onload=()=>res(i);i.onerror=rej;i.src=src;});}

/* ================= tokens ================= */
function initials(c){const p=String(c||'').split('&').map(s=>s.trim()).filter(Boolean);return p.length>1?p.map(s=>s[0].toUpperCase()).join('&'):(p[0]||'').slice(0,1).toUpperCase();}
function fdate(iso,long){if(!iso||!/^\d{4}-\d{2}-\d{2}$/.test(iso))return long?'DATE À DÉFINIR':'00.00.0000';const [y,m,d]=iso.split('-');return long?`${+d} ${MONTHS[+m-1].toUpperCase()} ${y}`:`${d}.${m}.${y}`;}
function tok(s,c){return String(s??'').replace(/\{(couple|COUPLE|initials|date|datelong|place|PLACE|nr|total)\}/g,(_,k)=>({couple:c.couple||'Prénom & Prénom',COUPLE:(c.couple||'Prénom & Prénom').toUpperCase(),initials:initials(c.couple)||'A&B',date:fdate(c.date),datelong:fdate(c.date,true),place:c.place||'Lieu',PLACE:(c.place||'Lieu').toUpperCase(),nr:String(c.nr||''),total:String(c.total||'')}[k]));}

/* ================= templates (after the example wedding book) ================= */
const t=(x,y,w,h,text,o)=>Object.assign({type:'text',x,y,w,h,text,font:'Cormorant',size:13,color:INK,align:'left',bold:false,italic:false,ls:0,lh:1.35,upper:false,va:'top'},o);
const cap=(x,y,w,text,o)=>t(x,y,w,14,text,Object.assign({font:'Jost',size:7.5,ls:.28,upper:true,color:GOLD},o));
const rect=(x,y,w,h,fill,o)=>Object.assign({type:'shape',kind:'rect',x,y,w,h,fill,fill2:null,angle:180,radius:0,sw:0,stroke:GOLD},o);
const oval=(x,y,w,h,fill,o)=>rect(x,y,w,h,fill,Object.assign({kind:'ellipse'},o));
const ph=(x,y,w,h,o)=>Object.assign({type:'image',x,y,w,h,src:null,shape:'rect',radius:0,crop:{x:0,y:0,w:1,h:1},f:{},sw:0,stroke:'#ffffff'},o);
const chk=(x,y,w,h,items,o)=>Object.assign({type:'check',x,y,w,h,items:items.map(s=>({t:s,done:false})),style:'card',font:'Jost',size:9.5,color:INK,accent:GOLD},o);
const head=(title,sub)=>[t(40,32,880,38,title,{size:26}),cap(40,74,880,sub)];
const foot=(dark)=>[rect(40,506,880,.8,GOLD,{op:.6}),t(40,515,700,12,'BELLES CREATORS   |   {COUPLE}   |   {date}',{font:'Jost',size:6.5,ls:.3,color:dark?'#bfa58a':MUTED}),t(820,515,100,12,'{nr}',{font:'Jost',size:7,color:dark?'#bfa58a':MUTED,align:'right'})];
const caption=(text)=>[rect(0,490,960,50,'rgba(20,12,10,0.78)',{fill2:'rgba(20,12,10,0.35)',angle:0}),t(24,505,912,20,text,{size:13.5,color:LIGHT})];
const tag=(x,y,text,align)=>t(x,y,300,60,text,{font:'Cinzel',size:13,color:LIGHT,ls:.06,lh:1.25,align:align||'left',shadow:.4});

const TEMPLATES=[
 ['cover','Cover',ROSE,()=>[cap(0,118,960,'WEDDING MAQUETTE',{align:'center',size:8.5,color:INK,ls:.32}),rect(440,142,80,.8,GOLD),t(0,160,960,64,'{couple}',{size:46,italic:true,align:'center'}),cap(0,236,960,'DESTINATION WEDDING',{align:'center',color:MUTED}),t(0,286,960,26,'{datelong}',{size:18,align:'center',ls:.04}),cap(0,318,960,'{PLACE}',{align:'center',color:MUTED}),t(0,418,960,26,'Une destination. Une histoire. Une expérience.',{italic:true,size:16,align:'center'})]],
 ['sommaire','Sommaire',CREAM,()=>{const L=['Wedding Identity','Save the Date','Wedding Film','Destination & Hotel','Welcome','Planning du Jour','Cérémonie & Vin d’Honneur','Bridal Party','L’Entrée de la Cérémonie','L’Expérience de la Cérémonie','Le Kiss','Wedding Transportation','Nos Prestataires','Wedding Day Photoshoot','La Soirée','L’Expérience du Service','Evening Styling','Décoration de la Soirée','Décoration des Tables','La Première Danse','Le Wedding Cake','Choisissez Votre Thème','Vos Choix'];const out=[cap(0,40,960,'LE WEDDING BOOK',{align:'center'}),t(0,56,960,44,'Sommaire',{italic:true,size:32,align:'center'})];L.forEach((s,i)=>{const c=Math.floor(i/8),r=i%8,x=70+c*290,y=128+r*36;out.push(t(x,y+2,30,14,String(i+1).padStart(2,'0'),{font:'Jost',size:8,color:GOLD}),t(x+40,y,230,18,s,{size:13}));});out.push(cap(0,450,960,'{COUPLE} • {date} • {PLACE}',{align:'center',color:MUTED}),rect(40,506,880,.8,GOLD,{op:.6}));return out;}],
 ['identity','Wedding identity',CREAM,()=>{const lab=['Stationery','Signage','Tables','Dance Floor','Cake','Projections'],out=[...head('Wedding Identity | {initials}','VOTRE MONOGRAMME DEVIENT LA SIGNATURE VISUELLE DU MARIAGE'),t(40,118,880,60,'Une fois choisi, le monogramme {initials} pourra vivre partout où cela reste élégant et cohérent : invitations, site du mariage, welcome signage, plan de table, menus et marque places, piste de danse, wedding cake, projections, photos et détails décoratifs.',{size:13.5,lh:1.45})];lab.forEach((s,i)=>{const x=105+i*135;out.push(oval(x,225,80,80,i%2?'#ebc7cc':'#f3e6d6',{sw:1,stroke:'#d8b98a'}),cap(x-30,320,140,s,{align:'center',color:MUTED,upper:false,ls:.05,size:8.5}));});out.push(t(0,400,960,22,'Le monogramme est votre signature visuelle. Le thème choisi plus tard sera le fil rouge de votre histoire.',{italic:true,size:13,align:'center',color:MUTED}),...foot());return out;}],
 ['mood','Moodboard (15 foto’s)',DARK,()=>{const out=[];for(let r=0;r<3;r++)for(let c=0;c<5;c++)out.push(ph(c*192+(c?1:0),r*163+(r?1:0),c===4?192:191,162));out.push(...caption('SAVE THE DATE | {date} | Styling, poses, lumière et détails'));return out;}],
 ['collage','Collage 1 groot + 4',DARK,()=>[ph(0,0,560,490),ph(563,0,197,243),ph(763,0,197,243),ph(563,246,197,244),ph(763,246,197,244),tag(24,20,'OPTION 1\nTHE GOLDEN DREAM'),...caption('Evening Décor | Option 1 • The Golden Dream')]],
 ['quad','Collage 2 × 2',DARK,()=>[ph(0,0,478,243),ph(482,0,478,243),ph(0,247,478,243),ph(482,247,478,243),tag(20,18,'OPTIE 1\nTHE ROYAL FLOW'),tag(500,18,'OPTIE 2\nTHE ART OF LOVE'),...caption('Le Kiss | Ceremony Kiss • Daylight Vision')]],
 ['triple','Drie staande foto’s',DARK,()=>[ph(0,0,318,490),ph(321,0,318,490),ph(642,0,318,490),...caption('Bridal Party | Different Shades. Same Love.')]],
 ['full','Volle foto',DARK,()=>[ph(0,0,960,540),...caption('WELCOME | {PLACE}')]],
 ['threecol','Drie kolommen',CREAM,()=>{const out=[...head('Save the Date | Le premier rendez-vous','{datelong} • PHOTOGRAPHIE & VIDÉO')];[['Objectif','Créer les images qui annonceront le mariage et nourriront la communication du couple.'],['The Blue Room','Ice blue, crème, argent, miroirs, projections, sculpture et énergie éditoriale.'],['After Dark','Black tie, robe statement noire, lumière dramatique, bougies et portraits intemporels.']].forEach(([h,b],i)=>{const x=40+i*300;out.push(t(x,122,270,22,h,{size:16}),t(x,150,270,80,b,{font:'Jost',size:10,color:MUTED,lh:1.55}));});out.push(t(0,410,960,22,'Les looks présentés ici peuvent être montrés ensemble.',{italic:true,size:13,align:'center',color:MUTED}),...foot());return out;}],
 ['scenario','Scenario (8 stappen)',CREAM,()=>{const S=[['The Argument','« Jij luistert nooit naar wat ik zeg! »'],['Dorian, innocent','« Kom, we mogen niet te laat zijn. »'],['Outside | The Car','Il lui ouvre la porte.'],['On the Road','Le ton devient complice et cinématographique.'],['Radio Moment','À l’écran : « A Special Message For You. »'],['The Surprise','La grande annonce de la destination.'],['Happiness','Rires, émotion, célébration à deux.'],['Destination Ahead','{PLACE}. {date}. « A Destination for a Lifetime. »']];const out=[...head('Wedding Film | Le scénario','UNE HISTOIRE CINÉMATOGRAPHIQUE, LÉGÈRE ET PERSONNELLE')];S.forEach(([h,b],i)=>{const x=i%2?500:40,y=120+Math.floor(i/2)*94;out.push(t(x,y+2,40,16,String(i+1).padStart(2,'0'),{font:'Jost',size:9,color:GOLD}),t(x+50,y-2,380,20,h,{size:15}),t(x+50,y+20,380,44,b,{font:'Jost',size:9.5,color:MUTED,lh:1.5}));});out.push(...foot());return out;}],
 ['info','Foto + feiten',CREAM,()=>[...head('Destination & Hotel | {PLACE}','NOTRE BASE • {COUPLE} • INVITÉS • PRESTATAIRES'),ph(40,110,380,375),t(460,122,460,30,'87 chambres',{size:22}),t(460,166,460,22,'6 catégories de chambres',{size:15}),t(460,192,460,40,'Guest Room • Premium Room • Premium Terrace • Corner Room • Junior Suite',{font:'Jost',size:9.5,color:MUTED,lh:1.5}),t(460,250,460,22,'Inclus dans l’offre',{size:15}),t(460,276,460,30,'Petit déjeuner • TVA • Internet • Accès spa & fitness',{font:'Jost',size:9.5,color:MUTED}),t(460,330,460,60,'Les tarifs proposés vont de 120 € à 180 € selon la catégorie et l’occupation.',{font:'Jost',size:9.5,color:MUTED,lh:1.55}),...foot()]],
 ['planning','Planning van de dag',CREAM,()=>{const L=[['07:30','Photo & content pendant les préparatifs'],['12:30','Arrivée des invités'],['12:45','Arrivée / entrée du marié'],['13:00','Arrivée / entrée de la mariée'],['14:00','Vin d’honneur'],['14:40','Champagne tower'],['14:50','Speeches'],['15:00','Photoshoot du couple'],['16:00','Fin du vin d’honneur'],['21:30','Transition du couple'],['23:00','Deuxième entrée'],['02:00','Fin de la soirée']];const out=[...head('Le Planning du Jour | {date}','UNE JOURNÉE PENSÉE COMME UNE EXPÉRIENCE CONTINUE'),rect(53.5,128,.8,262,GOLD,{op:.4}),rect(503.5,128,.8,262,GOLD,{op:.4})];L.forEach(([h,s],i)=>{const x=i<6?50:500,y=122+(i%6)*52;out.push(oval(x,y+4,8,8,GOLD),t(x+22,y+1,70,16,h,{font:'Jost',size:9,color:GOLD}),t(x+100,y,320,18,s,{size:13.5}));});out.push(...foot());return out;}],
 ['swatches','Kleurenpalet',CREAM,()=>{const C=[['#e8c9cc','Blush'],['#cfe3d8','Mint'],['#cfdcea','Powder Blue'],['#ddd3ea','Lavender'],['#f1e1a8','Butter'],['#f2d2bd','Peach']],out=[t(0,78,960,44,'CÉRÉMONIE',{size:32,align:'center',ls:.08}),cap(0,124,960,'& VIN D’HONNEUR',{align:'center',size:9}),cap(0,168,960,'PASTEL TONES • ALL WHITE FLORALS • DAYLIGHT ELEGANCE',{align:'center',color:MUTED})];C.forEach(([c,n],i)=>{const x=225+i*90;out.push(rect(x,222,66,66,c,{radius:14}),cap(x-17,300,100,n,{align:'center',color:MUTED,upper:false,ls:.05,size:8.5}));});out.push(t(0,380,960,26,'Les personnes apportent la couleur. Le décor reste blanc.',{italic:true,size:16,align:'center'}),...foot());return out;}],
 ['photolist','Foto + lijst',CREAM,()=>[...head('Floral Direction | All White','LA COULEUR VIENT DES PERSONNES. LE DÉCOR RESTE BLANC.'),ph(40,110,400,375),t(480,140,420,190,'White orchids\nWhite roses\nWhite hydrangeas\nSculptural florals\nGlass & crystal details\nCandlelight',{size:16,lh:1.6}),t(480,390,420,44,'Le contraste recherché : décor entièrement blanc + invités pastel.',{italic:true,size:12.5,color:GOLD}),...foot()]],
 ['cards','Programma-kaarten (9)',CREAM,()=>{const L=[['14:00','Ouverture du vin d’honneur'],['Live','4 violonistes + 2 saxophonistes'],['Food','Buffet congolais & africain'],['Drinks','Service par les serveurs'],['Memory','Audio guestbook & Save the Date'],['14:40','Champagne tower par {couple}'],['14:50','Speeches'],['15:00','Le couple part pour le photoshoot'],['16:00','Fin du vin d’honneur']];const out=[...head('Vin d’Honneur | Welcome • Experience • Memory','14:00 À 16:00 • LA CÉRÉMONIE SE TRANSFORME EN EXPÉRIENCE')];L.forEach(([a,b],i)=>{const x=40+(i%3)*298,y=108+Math.floor(i/3)*124;out.push(rect(x,y,282,108,i%2?'#efe4d6':'#ffffff',{radius:12,sw:.8,stroke:'#e2cfb4'}),t(x+16,y+14,250,14,a,{font:'Jost',size:8,color:GOLD,ls:.1}),t(x+16,y+36,250,60,b,{size:14}));});out.push(...foot());return out;}],
 ['partners','Leveranciers',CREAM,()=>{const L=[['Beauty','Hair & make-up\nBridal styling'],['Entertainment','DJ • Live band\nViolon & saxophone'],['Food & Service','Traiteur\nWedding cake'],['Photo, Video & Content','Photographe\nVidéaste • Content creator'],['Stationery','Invitations\nSignage & menus'],['Venue & Hotel','Salle de fête\nHôtel des invités']];const out=[...head('Nos Prestataires | Wedding Partners','LES ÉQUIPES QUI CONSTRUISENT L’EXPÉRIENCE')];L.forEach(([a,b],i)=>{const x=40+(i%3)*298,y=108+Math.floor(i/3)*130;out.push(rect(x,y,282,114,'#ffffff',{radius:12,sw:.8,stroke:'#e2cfb4'}),t(x+16,y+14,250,20,a,{size:15}),t(x+16,y+42,250,60,b,{font:'Jost',size:9.5,color:MUTED,lh:1.55}));});out.push(rect(40,368,282,100,'#efe4d6',{radius:12}),t(56,382,250,20,'À confirmer',{size:15}),t(56,408,250,50,'Options en attente\nValidation après la présentation',{font:'Jost',size:9.5,color:MUTED,lh:1.55}),...foot());return out;}],
 ['darktitle','Donkere titelpagina',DARK,()=>[cap(0,168,960,'LA SOIRÉE',{align:'center',size:9}),t(0,186,960,64,'Salle de Fête',{italic:true,size:42,align:'center',color:LIGHT}),rect(400,262,160,.8,GOLD),cap(0,280,960,'GALA • GLAMOUR • BLING • ÉLÉGANCE',{align:'center',color:'#d9c7b5'}),t(0,328,960,28,'Une transformation du jour vers la nuit.',{italic:true,size:18,align:'center',color:LIGHT}),t(0,366,960,16,'Champagne • Gold • Crystal • Warm Candlelight',{font:'Jost',size:9,align:'center',color:'#bfa58a',ls:.05}),...foot(true)]],
 ['twocol','Twee kolommen',CREAM,()=>[...head('L’Expérience du Service','LA DOUBLE EXPÉRIENCE CULINAIRE'),t(40,124,410,24,'Cuisine occidentale',{size:18}),cap(40,156,410,'SERVICE À TABLE'),t(40,180,410,20,'Service à table',{italic:true,size:14}),t(40,208,410,80,'Les plats occidentaux sont servis directement aux invités par les serveurs.',{font:'Jost',size:10,color:MUTED,lh:1.55}),rect(480,124,.8,280,GOLD,{op:.5}),t(510,124,410,24,'Cuisine africaine & congolaise',{size:18}),cap(510,156,410,'LA PIÈCE MAÎTRESSE'),t(510,180,410,20,'Buffet • self service',{italic:true,size:14}),t(510,208,410,80,'Les invités se servent librement au buffet et découvrent les saveurs africaines et congolaises.',{font:'Jost',size:10,color:MUTED,lh:1.55}),t(0,430,960,16,'Drinks & water service throughout the evening.',{font:'Jost',size:9,align:'center',color:MUTED}),...foot()]],
 ['themes','Thema’s kiezen (4)',CREAM,()=>{const C=[['#e8c9cc','Same Love. Bigger Dreams.','Deux cultures, une même célébration, une histoire plus grande que nous.'],['#cfe3d8','From Our Roots to Forever','Nos racines, notre histoire, notre futur ensemble.'],['#cfdcea','Written in the Stars','Une rencontre qui semblait écrite d’avance.'],['#ddd3ea','A Love Beyond Borders','Un amour qui traverse les frontières, les langues et les cultures.']];const out=[...head('Choisissez Votre Thème | {couple}','QUATRE DIRECTIONS • UNE SIGNATURE À CHOISIR')];C.forEach(([c,h,b],i)=>{const x=40+i*225;out.push(rect(x,110,205,330,c,{radius:6}),t(x+18,128,170,14,String(i+1).padStart(2,'0'),{font:'Jost',size:8,color:INK}),t(x+18,154,170,64,h,{size:18,lh:1.2}),t(x+18,236,170,90,b,{font:'Jost',size:9.5,color:'#5b4a40',lh:1.55}));});out.push(...foot());return out;}],
 ['choices','Vos choix (afvinklijst)',CREAM,()=>{const L=['Monogramme {initials}','Concept cérémonie','Kiss effect','Wedding car','Evening decor','Table styling','First dance effect','Cake direction','Wedding theme'];const out=[...head('Vos Choix | {couple}','LA PAGE DE DÉCISION À COMPLÉTER ENSEMBLE PENDANT LA PRÉSENTATION')];L.forEach((s,i)=>out.push(chk(40+(i%3)*298,112+Math.floor(i/3)*92,282,58,[s])));out.push(t(0,420,960,20,'Les choix seront confirmés après la présentation et intégrés dans le planning final.',{italic:true,size:12,align:'center',color:MUTED}),...foot());return out;}],
 ['checklist','Checklist (lijst)',CREAM,()=>[...head('Checklist | {couple}','À FAIRE AVANT LE GRAND JOUR'),chk(40,112,420,360,['Choisir le monogramme','Valider la salle','Confirmer le traiteur','Essayage robe','Playlist première danse','Plan de table'],{style:'plain',size:13,font:'Cormorant'}),ph(500,112,420,360),...foot()]],
 ['closing','Slotpagina',DARK,()=>[t(0,196,960,60,'{couple}',{italic:true,size:40,align:'center',color:LIGHT}),cap(0,262,960,'{datelong}',{align:'center'}),cap(0,282,960,'{PLACE}',{align:'center',color:'#bfa58a'}),rect(420,320,120,.8,GOLD),t(0,338,960,28,'Votre histoire. Vos choix. Votre célébration.',{italic:true,size:16,align:'center',color:LIGHT})]],
 ['blank','Lege pagina (licht)',CREAM,()=>[...foot()]],
 ['blankdark','Lege pagina (donker)',DARK,()=>[]]
];
const BOOK=['cover','sommaire','identity','mood','threecol','mood','scenario','info','collage','planning','swatches','photolist','full','quad','cards','partners','darktitle','collage','twocol','triple','themes','choices','closing'];
function makePage(key){const tp=TEMPLATES.find(x=>x[0]===key)||TEMPLATES.find(x=>x[0]==='blank');return {id:uid(),bg:tp[2],els:tp[3]().map(e=>Object.assign({id:uid(),rot:0,op:1},e))};}

/* ================= rendering ================= */
function boxStyle(el){
  let s=`left:${fixed(el.x)}px;top:${fixed(el.y)}px;width:${fixed(el.w)}px;height:${fixed(el.h)}px;`;
  if(el.rot)s+=`transform:rotate(${fixed(el.rot)}deg);`;
  if((el.op??1)!==1)s+=`opacity:${clamp(num(el.op,1),0,1)};`;
  if(el.blend&&el.blend!=='normal'&&BLENDS.some(b=>b[0]===el.blend))s+=`mix-blend-mode:${el.blend};`;
  if(el.shadow>0){const k=clamp(num(el.shadow,0),0,1);s+=`filter:drop-shadow(0 ${fixed(k*10)}px ${fixed(k*22)}px rgba(20,8,6,${fixed(.15+k*.45)}));`;}
  return s;
}
function fillCSS(el){return el.fill2?`linear-gradient(${num(el.angle,180)}deg,${col(el.fill)},${col(el.fill2)})`:col(el.fill);}
function imgFilter(f){f=f||{};const p=[];if(num(f.b,1)!==1)p.push(`brightness(${num(f.b,1)})`);if(num(f.c,1)!==1)p.push(`contrast(${num(f.c,1)})`);if(num(f.s,1)!==1)p.push(`saturate(${num(f.s,1)})`);if(num(f.se,0))p.push(`sepia(${num(f.se,0)})`);if(num(f.g,0))p.push(`grayscale(${num(f.g,0)})`);if(num(f.hue,0))p.push(`hue-rotate(${num(f.hue,0)}deg)`);if(num(f.bl,0))p.push(`blur(${num(f.bl,0)}px)`);return p.join(' ');}
function shapeRadius(el){if(el.type==='image'){if(el.shape==='circle')return '50%';if(el.shape==='arch')return `${el.w/2}px ${el.w/2}px 0 0`;}return el.kind==='ellipse'?'50%':num(el.radius,0)+'px';}
function elHTML(el,c,live){
  if(el.hidden)return '';
  let inner='',cls='';
  if(el.type==='text'){
    const jc=el.va==='middle'?'center':el.va==='bottom'?'flex-end':'flex-start';
    inner=`<div class="tx" style="justify-content:${jc};font-family:'${fontOf(el.font)}';font-size:${num(el.size,13)}px;color:${col(el.color)};text-align:${['left','center','right','justify'].includes(el.align)?el.align:'left'};font-weight:${el.bold?600:400};font-style:${el.italic?'italic':'normal'};letter-spacing:${num(el.ls,0)}em;line-height:${num(el.lh,1.35)};${el.upper?'text-transform:uppercase;':''}"><span>${esc(tok(el.text,c))}</span></div>`;
  }else if(el.type==='shape'){
    inner=`<div class="sh" style="background:${fillCSS(el)};border-radius:${shapeRadius(el)};${el.sw>0?`border:${num(el.sw,0)}px solid ${col(el.stroke)};`:''}"></div>`;
  }else if(el.type==='image'){
    const ref=safeRef(el.src),cr=el.crop||{x:0,y:0,w:1,h:1};
    const frame=`border-radius:${shapeRadius(el)};${el.sw>0?`box-shadow:inset 0 0 0 ${num(el.sw,0)}px ${col(el.stroke)};`:''}`;
    if(!ref){cls=' mq-empty';inner=`<div class="ph" style="${frame}"><span>${live?'Dubbelklik, sleep of plak een foto':''}</span></div>`;}
    else inner=`<div class="im" style="${frame}"><img data-ref="${esc(ref)}" alt="" draggable="false" style="width:${fixed(100/cr.w,3)}%;height:${fixed(100/cr.h,3)}%;left:${fixed(-cr.x/cr.w*100,3)}%;top:${fixed(-cr.y/cr.h*100,3)}%;filter:${imgFilter(el.f)}"></div>${el.sw>0?`<div class="fr" style="${frame}"></div>`:''}`;
  }else if(el.type==='paint'){
    const ref=safeRef(el.src);inner=ref?`<img class="pt" data-ref="${esc(ref)}" alt="" draggable="false">`:'';
  }else if(el.type==='check'){
    inner=`<div class="ck ${el.style==='plain'?'ck-plain':'ck-card'}" style="font-family:'${fontOf(el.font)}';font-size:${num(el.size,10)}px;color:${col(el.color)};--ac:${col(el.accent)}">${(el.items||[]).map((it,i)=>`<div class="ck-row${it.done?' on':''}"><span class="t">${esc(tok(it.t,c))}</span><span class="c" data-chk="${i}"></span></div>`).join('')}</div>`;
  }
  return `<div class="mq-el mq-${el.type}${cls}" data-id="${esc(el.id)}" style="${boxStyle(el)}">${inner}</div>`;
}
function pageInner(pg,c,live){return pg.els.map(e=>elHTML(e,c,live)).join('');}
function pageHTML(pg,c){return `<div class="mq-page" style="background:${col(pg.bg)}">${pageInner(pg,c)}</div>`;}
function thumbHTML(pg,c,w){const s=w/W;return `<div class="mq-thumb" style="width:${w}px;height:${fixed(H*s)}px"><div class="mq-page" style="background:${col(pg.bg)};transform:scale(${s})">${pageInner(pg,c)}</div></div>`;}

/* ================= editor state ================= */
let M=null,pi=0,sel=null,tool='select',root=null,stage=null,S=1,drag=null,undoS=[],redoS=[],dirty=false,saveTimer=null,saving=false,saveAgain=false,clip=null,editing=null,panId=null,tab='design',lasso=null,thumbTimer=null,propsUndoAt=0,present=null,mobPanel=null;
const opts={color:'#b7935c',size:28,hard:.55,opacity:1,mode:'source-over',lock:false,shade:'dark',shadeColor:'#2a1610',strength:.55,blend:'smudge',tol:40};
const page=()=>M.pages[pi];
const ctxFor=i=>({couple:M.couple,date:M.date,place:M.place,nr:i+1,total:M.pages.length});
const selEl=()=>sel?page().els.find(e=>e.id===sel)||null:null;
function cloneEl(e){const o={};for(const k in e){if(k[0]==='_')continue;const v=e[k];o[k]=v&&typeof v==='object'?JSON.parse(JSON.stringify(v)):v;}return o;}
const clonePages=ps=>ps.map(p=>({id:p.id,bg:p.bg,els:p.els.map(cloneEl)}));
function pushUndo(){undoS.push({pages:clonePages(M.pages),pi});if(undoS.length>UNDO_MAX)undoS.shift();redoS=[];}
function restore(from,to){if(!from.length)return;to.push({pages:clonePages(M.pages),pi});const s=from.pop();M.pages=s.pages;pi=clamp(s.pi,0,M.pages.length-1);sel=null;panId=null;markDirty();renderAll();}
function markDirty(){dirty=true;setStatus('Wijzigingen…');clearTimeout(saveTimer);saveTimer=setTimeout(save,2000);clearTimeout(thumbTimer);thumbTimer=setTimeout(renderPages,500);}
function setStatus(s){const e=root&&root.querySelector('.mq-status');if(e)e.textContent=s;}

/* ================= save / load ================= */
async function blobFromData(d){return (await fetch(d)).blob();}
async function uploadPending(){
  for(const p of M.pages)for(const e of p.els){
    if(typeof e.src==='string'&&e.src.startsWith('data:')){
      const src=e.src,b=await blobFromData(src),ext=b.type==='image/jpeg'?'jpg':'png';
      const ref=await store().putImage(M.id,b,ext);urlCache.set(ref,URL.createObjectURL(b));
      if(e.src===src)e.src=ref;
    }
  }
}
function cleanData(){return {v:VER,pages:M.pages.map(p=>({id:p.id,bg:p.bg,els:p.els.map(cloneEl).map(e=>{if(typeof e.src==='string'&&e.src.startsWith('data:'))e.src=null;return e;})}))};}
async function save(){
  if(!M)return;
  if(saving){saveAgain=true;return;}
  clearTimeout(saveTimer);saving=true;setStatus('Opslaan…');
  try{
    await uploadPending();
    const hasData=M.pages.some(p=>p.els.some(e=>typeof e.src==='string'&&e.src.startsWith('data:')));
    const nv=await store().save(M.id,{title:M.title.slice(0,140),couple:M.couple.slice(0,140),wedding_date:M.date||null,place:M.place.slice(0,140),data:cleanData()},M.version);
    if(nv==null){setStatus('Niet opgeslagen: elders gewijzigd');toast('Deze maquette is ondertussen ergens anders aangepast. Sluit en open hem opnieuw.');}
    else{M.version=nv;if(!hasData){dirty=false;setStatus('Opgeslagen');}else saveAgain=true;}
  }catch(e){console.warn('Maquette save',e);setStatus('Niet opgeslagen');toast('Opslaan lukt niet: '+(e.message||e));clearTimeout(saveTimer);saveTimer=setTimeout(save,8000);}
  saving=false;
  if(saveAgain){saveAgain=false;save();}
}

/* ================= images ================= */
async function prepImage(blob){
  const bmp=await createImageBitmap(blob);
  let w=bmp.width,h=bmp.height;const big=Math.max(w,h)>MAX_IMG,okType=/^image\/(jpeg|png|webp)$/.test(blob.type);
  if(!big&&okType&&blob.size<12e6){const r={blob,w,h,ext:blob.type==='image/jpeg'?'jpg':blob.type==='image/webp'?'webp':'png'};bmp.close&&bmp.close();return r;}
  const k=Math.min(1,MAX_IMG/Math.max(w,h));w=Math.round(w*k);h=Math.round(h*k);
  const cv=document.createElement('canvas');cv.width=w;cv.height=h;cv.getContext('2d').drawImage(bmp,0,0,w,h);bmp.close&&bmp.close();
  const png=blob.type==='image/png'||blob.type==='image/gif'||blob.type==='image/webp';
  const out=await new Promise(r=>cv.toBlob(r,png?'image/png':'image/jpeg',.9));
  return {blob:out,w,h,ext:png?'png':'jpg'};
}
function coverCrop(bw,bh,nw,nh){const ba=bw/bh,ia=nw/nh;return ia>ba?{x:(1-ba/ia)/2,y:0,w:ba/ia,h:1}:{x:0,y:(1-ia/ba)/2,w:1,h:ia/ba};}
async function addImage(blob,at,into){
  if(!blob||!/^image\//.test(blob.type)){toast('Alleen afbeeldingen');return;}
  setStatus('Foto uploaden…');
  let r,ref;
  try{r=await prepImage(blob);ref=await store().putImage(M.id,r.blob,r.ext);urlCache.set(ref,URL.createObjectURL(r.blob));}
  catch(e){console.warn(e);toast('Foto toevoegen lukt niet: '+(e.message||e));setStatus('');return;}
  pushUndo();
  if(into&&into.type==='image'){into.src=ref;into.nat={w:r.w,h:r.h};into.crop=coverCrop(into.w,into.h,r.w,r.h);sel=into.id;}
  else{
    const k=Math.min(560/r.w,400/r.h,1)||1,w=r.w*k,h=r.h*k,p=at||{x:W/2,y:H/2};
    const el={id:uid(),type:'image',x:p.x-w/2,y:p.y-h/2,w,h,rot:0,op:1,src:ref,nat:{w:r.w,h:r.h},crop:{x:0,y:0,w:1,h:1},shape:'rect',radius:0,f:{},sw:0,stroke:'#ffffff'};
    page().els.push(el);sel=el.id;
  }
  setTool('select');markDirty();renderAll();
}
let filePickTarget=null;
function pickFile(into){filePickTarget=into||null;root.querySelector('.mq-file').click();}

/* ================= raster (paint layers + photos) ================= */
async function rasterOf(el){
  if(el._cv)return el._cv;
  if(el._cvp)return el._cvp;
  el._cvp=(async()=>{
    const cv=document.createElement('canvas');
    if(el.type==='paint'){
      cv.width=Math.round(el.nat?.w||el.w*2);cv.height=Math.round(el.nat?.h||el.h*2);
      const u=await ensureURL(el.src);if(u){const i=await loadImg(u);cv.getContext('2d').drawImage(i,0,0,cv.width,cv.height);}
    }else{
      const u=await ensureURL(el.src);if(!u)throw new Error('Geen foto');
      const i=await loadImg(u),cr=el.crop||{x:0,y:0,w:1,h:1};
      const sx=cr.x*i.naturalWidth,sy=cr.y*i.naturalHeight,sw=cr.w*i.naturalWidth,sh=cr.h*i.naturalHeight,k=Math.min(1,MAX_IMG/Math.max(sw,sh));
      cv.width=Math.max(1,Math.round(sw*k));cv.height=Math.max(1,Math.round(sh*k));
      cv.getContext('2d').drawImage(i,sx,sy,sw,sh,0,0,cv.width,cv.height);
    }
    el._cv=cv;el._cvp=null;return cv;
  })();
  try{return await el._cvp;}catch(e){el._cvp=null;throw e;}
}
function toCv(el,p){const l=local(el,p);return {x:l.x*el._cv.width/el.w,y:l.y*el._cv.height/el.h};}
function newPaintLayer(){const el={id:uid(),type:'paint',x:0,y:0,w:W,h:H,rot:0,op:1,src:null,nat:{w:W*2,h:H*2}};page().els.push(el);return el;}
function rasterTarget(){const e=selEl();if(e&&!e.locked&&((e.type==='image'&&safeRef(e.src))||e.type==='paint'))return e;return null;}
function showLive(el){const n=stage.querySelector(`.mq-el[data-id="${el.id}"]`);if(!n)return;n.innerHTML='';const c=el._cv;c.className='live';n.appendChild(c);if(el.type==='image'){c.style.borderRadius=shapeRadius(el);c.style.filter=imgFilter(el.f);}}
function commitRaster(el){
  const cv=el._cv;if(!cv)return;cv.className='';cv.style.cssText='';
  el.src=cv.toDataURL('image/png');
  if(el.type==='image'){el.crop={x:0,y:0,w:1,h:1};el.nat={w:cv.width,h:cv.height};}else el.nat={w:cv.width,h:cv.height};
  markDirty();
}
const mk=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;};
function dab(c,x,y,r,color,hard){
  const g=c.createRadialGradient(x,y,Math.max(0,r*hard*.98),x,y,r);
  g.addColorStop(0,color);g.addColorStop(1,color.replace(/^#([0-9a-f]{6})$/i,(m,h)=>`rgba(${parseInt(h.slice(0,2),16)},${parseInt(h.slice(2,4),16)},${parseInt(h.slice(4,6),16)},0)`));
  c.fillStyle=g;c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fill();
}
function strokeColor(){if(tool==='eraser')return '#000000';if(tool==='shade')return opts.shade==='dark'?opts.shadeColor:'#fff6ea';return /^#[0-9a-f]{6}$/i.test(opts.color)?opts.color:'#000000';}
function beginStroke(el,p){
  const cv=el._cv,base=mk(cv.width,cv.height);base.getContext('2d').drawImage(cv,0,0);
  const kx=cv.width/el.w,r=Math.max(.5,opts.size/2*kx),q=toCv(el,p);
  drag={kind:'stroke',el,base,sc:mk(cv.width,cv.height),r,last:q,raf:0};
  if(tool==='smudge'){const d=Math.ceil(r*2);drag.buf=mk(d,d);drag.tmp=mk(d,d);drag.mask=mk(d,d);const mc=drag.mask.getContext('2d');dab(mc,d/2,d/2,r,'#000000',opts.hard);drag.buf.getContext('2d').drawImage(cv,q.x-d/2,q.y-d/2,d,d,0,0,d,d);}
  showLive(el);strokeTo(p,true);
}
function strokeTo(p,first){
  const d=drag,el=d.el,q=toCv(el,p),step=Math.max(1,d.r*(tool==='smudge'?.15:.22));
  const dx=q.x-d.last.x,dy=q.y-d.last.y,dist=Math.hypot(dx,dy),n=first?1:Math.max(1,Math.floor(dist/step));
  if(!first&&dist<step*.5)return;
  if(tool==='smudge'){
    const cv=el._cv,c=cv.getContext('2d'),D=d.buf.width;
    for(let i=1;i<=n;i++){
      const x=d.last.x+dx*i/n,y=d.last.y+dy*i/n,tc=d.tmp.getContext('2d');
      tc.globalCompositeOperation='copy';
      if(opts.blend==='blur'){tc.filter=`blur(${Math.max(1,d.r/5)}px)`;tc.drawImage(cv,x-D/2,y-D/2,D,D,0,0,D,D);tc.filter='none';}
      else tc.drawImage(d.buf,0,0);
      tc.globalCompositeOperation='destination-in';tc.drawImage(d.mask,0,0);
      c.save();c.globalAlpha=opts.strength;c.drawImage(d.tmp,x-D/2,y-D/2);c.restore();
      const bc=d.buf.getContext('2d');bc.save();bc.globalAlpha=1-opts.strength*.35;bc.globalCompositeOperation='source-over';bc.drawImage(cv,x-D/2,y-D/2,D,D,0,0,D,D);bc.restore();
    }
  }else{
    const sc=d.sc.getContext('2d'),color=strokeColor();
    for(let i=first?0:1;i<=n;i++)dab(sc,d.last.x+dx*i/n,d.last.y+dy*i/n,d.r,color,opts.hard);
    if(!d.raf)d.raf=requestAnimationFrame(()=>{d.raf=0;compose(d);});
  }
  d.last=q;
}
function compose(d){
  const c=d.el._cv.getContext('2d'),w=d.el._cv.width,h=d.el._cv.height;
  c.save();c.globalCompositeOperation='source-over';c.globalAlpha=1;c.clearRect(0,0,w,h);c.drawImage(d.base,0,0);
  c.globalAlpha=tool==='shade'?opts.strength:opts.opacity;
  c.globalCompositeOperation=tool==='eraser'?'destination-out':tool==='shade'?(opts.shade==='dark'?'multiply':'screen'):opts.mode;
  c.drawImage(d.sc,0,0);
  if(tool==='shade'||(tool==='brush'&&(opts.lock||!['source-over'].includes(opts.mode)))){c.globalAlpha=1;c.globalCompositeOperation='destination-in';c.drawImage(d.base,0,0);}
  c.restore();
}
function endStroke(d){if(d.raf){cancelAnimationFrame(d.raf);compose(d);}if(tool!=='smudge')compose(d);commitRaster(d.el);renderStage();}
function floodFill(el,p){
  const cv=el._cv,c=cv.getContext('2d'),q=toCv(el,p),x0=Math.floor(q.x),y0=Math.floor(q.y),w=cv.width,h=cv.height;
  if(x0<0||y0<0||x0>=w||y0>=h)return false;
  const img=c.getImageData(0,0,w,h),D=img.data,i0=(y0*w+x0)*4,t0=[D[i0],D[i0+1],D[i0+2],D[i0+3]],tol=opts.tol*4;
  const hex=/^#[0-9a-f]{6}$/i.test(opts.color)?opts.color:'#000000',fc=[parseInt(hex.slice(1,3),16),parseInt(hex.slice(3,5),16),parseInt(hex.slice(5,7),16)],a=opts.opacity;
  const seen=new Uint8Array(w*h),stack=[x0,y0];
  const match=i=>Math.abs(D[i]-t0[0])+Math.abs(D[i+1]-t0[1])+Math.abs(D[i+2]-t0[2])+Math.abs(D[i+3]-t0[3])<=tol;
  while(stack.length){
    const y=stack.pop(),x=stack.pop();let l=x;
    while(l>=0&&!seen[y*w+l]&&match((y*w+l)*4))l--;
    l++;let up=false,dn=false;
    for(let xx=l;xx<w;xx++){
      const k=y*w+xx;if(seen[k]||!match(k*4))break;seen[k]=1;
      const i=k*4;D[i]=D[i]*(1-a)+fc[0]*a;D[i+1]=D[i+1]*(1-a)+fc[1]*a;D[i+2]=D[i+2]*(1-a)+fc[2]*a;D[i+3]=Math.max(D[i+3],255*a);
      if(y>0){const u=k-w;if(!seen[u]&&match(u*4)){if(!up){stack.push(xx,y-1);up=true;}}else up=false;}
      if(y<h-1){const v=k+w;if(!seen[v]&&match(v*4)){if(!dn){stack.push(xx,y+1);dn=true;}}else dn=false;}
    }
  }
  c.putImageData(img,0,0);return true;
}
function lassoAction(kind){
  const L=lasso;lasso=null;if(!L||L.pts.length<3){renderStage();return;}
  const el=page().els.find(e=>e.id===L.id);if(!el||!el._cv){renderStage();return;}
  const cv=el._cv,c=cv.getContext('2d'),pts=L.pts.map(p=>toCv(el,p));
  const path=()=>{c.beginPath();pts.forEach((p,i)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));c.closePath();};
  pushUndo();
  if(kind==='cut'||kind==='copy'){
    let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;pts.forEach(p=>{x0=Math.min(x0,p.x);y0=Math.min(y0,p.y);x1=Math.max(x1,p.x);y1=Math.max(y1,p.y);});
    x0=clamp(Math.floor(x0),0,cv.width);y0=clamp(Math.floor(y0),0,cv.height);x1=clamp(Math.ceil(x1),0,cv.width);y1=clamp(Math.ceil(y1),0,cv.height);
    if(x1-x0<2||y1-y0<2){renderStage();return;}
    const out=mk(x1-x0,y1-y0),oc=out.getContext('2d');oc.beginPath();pts.forEach((p,i)=>i?oc.lineTo(p.x-x0,p.y-y0):oc.moveTo(p.x-x0,p.y-y0));oc.closePath();oc.clip();oc.drawImage(cv,-x0,-y0);
    if(kind==='cut'){c.save();c.globalCompositeOperation='destination-out';path();c.fill();c.restore();commitRaster(el);}
    const sx=el.w/cv.width,sy=el.h/cv.height,lw=(x1-x0)*sx,lh=(y1-y0)*sy,lcx=(x0+x1)/2*sx,lcy=(y0+y1)/2*sy;
    const a=(el.rot||0)*Math.PI/180,ox=lcx-el.w/2,oy=lcy-el.h/2,cx=el.x+el.w/2+ox*Math.cos(a)-oy*Math.sin(a)+(kind==='copy'?12:0),cy=el.y+el.h/2+ox*Math.sin(a)+oy*Math.cos(a)+(kind==='copy'?12:0);
    const ne={id:uid(),type:'image',x:cx-lw/2,y:cy-lh/2,w:lw,h:lh,rot:el.rot||0,op:1,src:out.toDataURL('image/png'),nat:{w:out.width,h:out.height},crop:{x:0,y:0,w:1,h:1},shape:'rect',radius:0,f:el.type==='image'?JSON.parse(JSON.stringify(el.f||{})):{},sw:0,stroke:'#ffffff'};
    const idx=page().els.indexOf(el);page().els.splice(idx+1,0,ne);sel=ne.id;setTool('select');
  }else{
    c.save();c.globalCompositeOperation=kind==='erase'?'destination-out':'destination-in';path();c.fillStyle='#000';c.fill();c.restore();commitRaster(el);
  }
  markDirty();renderAll();
}

/* ================= geometry ================= */
function local(el,p){const cx=el.x+el.w/2,cy=el.y+el.h/2,a=-(el.rot||0)*Math.PI/180,dx=p.x-cx,dy=p.y-cy;return {x:dx*Math.cos(a)-dy*Math.sin(a)+el.w/2,y:dx*Math.sin(a)+dy*Math.cos(a)+el.h/2};}
function inside(el,p,pad=0){const l=local(el,p);return l.x>=-pad&&l.y>=-pad&&l.x<=el.w+pad&&l.y<=el.h+pad;}
function hit(p){
  const els=page().els;
  for(let i=els.length-1;i>=0;i--){
    const e=els[i];if(e.hidden||e.locked||!inside(e,p,Math.max(0,4-Math.min(e.w,e.h)/2)))continue;
    if(e.type==='paint'&&e.id!==sel){if(!e._cv)continue;const q=toCv(e,p);try{if(e._cv.getContext('2d').getImageData(Math.floor(q.x),Math.floor(q.y),1,1).data[3]<12)continue;}catch(_){continue;}}
    return e;
  }
  return null;
}
function pt(ev){const r=stage.getBoundingClientRect();return {x:(ev.clientX-r.left)/S,y:(ev.clientY-r.top)/S};}

/* ================= UI ================= */
const IC={
  select:'<path d="M5 3l14 8-6 1.5L10 19z"/>',text:'<path d="M5 6V4h14v2M12 4v16M9 20h6"/>',brush:'<path d="M14 4l6 6-8 8H6v-6z"/><path d="M4 20c2 0 3-1 3-3"/>',
  eraser:'<path d="M8 20h12M4 15l9-9 6 6-7 7H8z"/>',shade:'<circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor"/>',smudge:'<path d="M8 21v-6a2 2 0 0 1 4 0V8a2 2 0 0 1 4 0v8M12 13V5a2 2 0 0 0-4 0v10"/>',
  fill:'<path d="M5 12l7-7 7 7-7 7z"/><path d="M19 14s2 2.5 2 4a2 2 0 0 1-4 0c0-1.5 2-4 2-4z"/>',lasso:'<path d="M12 4c5 0 8 2.5 8 5.5S16 15 12 15s-8-2.5-8-5.5S7 4 12 4z" stroke-dasharray="3 2"/><path d="M6 13c-1 2 0 4 2 4s2 3 0 4"/>',
  pick:'<path d="M15 4l5 5-2 2-1-1-8 8H6v-3l8-8-1-1z"/>',rect:'<rect x="4" y="6" width="16" height="12" rx="1"/>',ellipse:'<circle cx="12" cy="12" r="8"/>',
  image:'<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="M21 16l-5-5-8 8"/>',frame:'<rect x="4" y="4" width="16" height="16" rx="2" stroke-dasharray="3 2"/><path d="M9 12h6M12 9v6"/>',
  check:'<rect x="4" y="5" width="5" height="5" rx="1"/><path d="M12 7.5h8M12 16.5h8"/><circle cx="6.5" cy="16.5" r="2.5"/>',line:'<path d="M4 18L20 6"/>',logo:'<path d="M12 3l2.5 6 6.5.5-5 4 1.5 6.5-5.5-3.5L6.5 20 8 13.5 3 9.5 9.5 9z"/>',
  undo:'<path d="M9 14L4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/>',redo:'<path d="M15 14l5-5-5-5"/><path d="M20 9H9a5 5 0 0 0 0 10h3"/>',
  back:'<path d="M15 5l-7 7 7 7"/>',play:'<path d="M7 4l13 8-13 8z"/>',pdf:'<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',plus:'<path d="M12 5v14M5 12h14"/>',
  up:'<path d="M12 19V5M6 11l6-6 6 6"/>',down:'<path d="M12 5v14M6 13l6 6 6-6"/>',copy:'<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
  trash:'<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',eye:'<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',eyeoff:'<path d="M3 3l18 18M10.6 6.1A10 10 0 0 1 22 12s-1.2 2.4-3.5 4.4M6.5 7.6C3.6 9.4 2 12 2 12s3.5 7 10 7c1.6 0 3-.4 4.3-1"/>',
  lock:'<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',unlock:'<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 7.5-2"/>',
  x:'<path d="M6 6l12 12M18 6L6 18"/>',pages:'<rect x="4" y="3" width="12" height="15" rx="1.5"/><path d="M8 21h11V7"/>',sliders:'<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
  crop:'<path d="M6 2v14a2 2 0 0 0 2 2h14M2 6h14a2 2 0 0 1 2 2v14"/>'
};
const ic=(n,s=18)=>`<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${IC[n]||''}</svg>`;
const TOOLS=[['select','Selecteren en verplaatsen','V'],['text','Tekst','T'],['brush','Penseel / inkleuren','B'],['eraser','Gum (wegvegen)','E'],['shade','Schaduw & licht','S'],['smudge','Blenden / vervagen','U'],['fill','Emmer (vlak inkleuren)','G'],['lasso','Uitknippen (lasso)','L'],['pick','Pipet (kleur kiezen)','I'],['rect','Rechthoek','R'],['ellipse','Cirkel','O']];
const RASTER_TOOLS=['brush','eraser','shade','smudge','fill','lasso'];

function buildEditor(){
  root=document.createElement('div');root.className='mq-ed';
  root.innerHTML=`<header class="mq-hd">
<button type="button" class="mq-b" data-a="close" title="Terug naar het atelier">${ic('back')}<span>Atelier</span></button>
<input class="mq-title" aria-label="Naam van de maquette" maxlength="140">
<span class="mq-status" aria-live="polite"></span><div class="sp"></div>
<button type="button" class="mq-b icon" data-a="undo" title="Ongedaan maken (Ctrl+Z)">${ic('undo')}</button><button type="button" class="mq-b icon" data-a="redo" title="Opnieuw (Ctrl+Shift+Z)">${ic('redo')}</button>
<button type="button" class="mq-b icon mob" data-a="m-pages" title="Pagina's">${ic('pages')}</button><button type="button" class="mq-b icon mob" data-a="m-props" title="Ontwerp">${ic('sliders')}</button>
<button type="button" class="mq-b" data-a="present" title="Presenteren">${ic('play',16)}<span>Presenteren</span></button>
<button type="button" class="mq-b" data-a="export" title="Opslaan als PDF">${ic('pdf',16)}<span>PDF</span></button>
<button type="button" class="mq-b gold" data-a="save">Opslaan</button></header>
<div class="mq-opts"></div>
<div class="mq-body">
<nav class="mq-tools" aria-label="Gereedschap">${TOOLS.map(([k,l,s])=>`<button type="button" data-tool="${k}" title="${l} (${s})" aria-label="${l}">${ic(k==='select'?'select':k)}</button>`).join('')}<span class="sep"></span>
<button type="button" data-a="add-image" title="Foto toevoegen (of plak met Ctrl+V / sleep erin)" aria-label="Foto toevoegen">${ic('image')}</button>
<button type="button" data-a="add-frame" title="Fotovak" aria-label="Fotovak">${ic('frame')}</button>
<button type="button" data-a="add-check" title="Afvinklijst" aria-label="Afvinklijst">${ic('check')}</button>
<button type="button" data-a="add-line" title="Lijn" aria-label="Lijn">${ic('line')}</button>
<button type="button" data-a="add-logo" title="BC-logo" aria-label="BC-logo">${ic('logo')}</button></nav>
<aside class="mq-pages"></aside>
<main class="mq-view"><div class="mq-wrap"><div class="mq-stage"></div></div><div class="mq-pop" hidden></div></main>
<aside class="mq-props"><div class="mq-tabs"><button type="button" data-tab="design">Ontwerp</button><button type="button" data-tab="layers">Lagen</button></div><div class="mq-pbody"></div></aside>
</div><input type="file" class="mq-file" accept="image/*" multiple hidden><div class="mq-modal" hidden></div>`;
  document.body.appendChild(root);document.body.classList.add('mq-open');
  stage=root.querySelector('.mq-stage');
  root.querySelector('.mq-title').value=M.title;
  bindEditor();
}
function renderAll(){renderStage();renderPages();renderProps();renderOpts();renderToolbar();}
function fit(){
  const v=root.querySelector('.mq-view'),wrap=root.querySelector('.mq-wrap');
  const pad=window.innerWidth<700?16:44;S=Math.max(.15,Math.min((v.clientWidth-pad)/W,(v.clientHeight-pad)/H));
  wrap.style.width=W*S+'px';wrap.style.height=H*S+'px';stage.style.transform=`scale(${S})`;stage.style.setProperty('--inv',1/S);
}
function renderStage(){
  if(!root)return;
  const pg=page();stage.style.background=col(pg.bg);
  stage.innerHTML=pageInner(pg,ctxFor(pi),true)+selHTML()+lassoHTML()+'<div class="mq-guide v" hidden></div><div class="mq-guide h" hidden></div>';
  hydrate(stage);
  pg.els.forEach(e=>{if(e.type==='paint'&&!e._cv&&safeRef(e.src))rasterOf(e).catch(()=>{});});
  if(editing){const n=stage.querySelector(`.mq-el[data-id="${editing}"] .tx span`);if(n)startEditNode(n,page().els.find(e=>e.id===editing));}
  stage.classList.toggle('crosshair',RASTER_TOOLS.includes(tool)||tool==='pick'||tool==='rect'||tool==='ellipse');
  stage.classList.toggle('texting',tool==='text');
}
function selHTML(){
  const el=selEl();if(!el||el.hidden)return '';
  const hs=el.locked?'':['nw','n','ne','e','se','s','sw','w'].filter(h=>!(el.type==='image'&&!safeRef(el.src)&&false)).map(h=>`<span class="hd ${h}" data-h="${h}"></span>`).join('')+'<span class="rot" data-h="rot"></span>';
  return `<div class="mq-sel${el.locked?' locked':''}${panId===el.id?' pan':''}" style="left:${el.x}px;top:${el.y}px;width:${el.w}px;height:${el.h}px;transform:rotate(${el.rot||0}deg)">${hs}</div>`;
}
function lassoHTML(){if(!lasso||!lasso.pts.length)return '';return `<svg class="mq-lasso" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><polyline points="${lasso.pts.map(p=>fixed(p.x,1)+','+fixed(p.y,1)).join(' ')}"${lasso.done?' class="done"':''}/></svg>`;}
function refreshEl(el){
  const n=stage.querySelector(`.mq-el[data-id="${el.id}"]`);
  if(n){const tmp=document.createElement('div');tmp.innerHTML=elHTML(el,ctxFor(pi),true);const nn=tmp.firstElementChild;if(nn){n.replaceWith(nn);hydrate(nn);}else n.remove();}
  const s=stage.querySelector('.mq-sel');if(s){s.outerHTML=selHTML()||'<i hidden></i>';}
}
function renderPages(){
  if(!root)return;
  const box=root.querySelector('.mq-pages');
  box.innerHTML=`<div class="mq-plist">${M.pages.map((p,i)=>`<div class="mq-pg${i===pi?' on':''}" data-page="${i}"><span class="n">${i+1}</span>${thumbHTML(p,ctxFor(i),150)}<div class="pa"><button type="button" data-pa="up" title="Naar voren">${ic('up',13)}</button><button type="button" data-pa="down" title="Naar achteren">${ic('down',13)}</button><button type="button" data-pa="dup" title="Dupliceren">${ic('copy',13)}</button><button type="button" data-pa="del" title="Verwijderen">${ic('trash',13)}</button></div></div>`).join('')}</div><button type="button" class="mq-b gold wide" data-a="add-page">${ic('plus',16)}<span>Pagina</span></button>`;
  hydrate(box);
  const on=box.querySelector('.mq-pg.on');if(on&&on.scrollIntoView&&!box.dataset.noscroll)on.scrollIntoView({block:'nearest'});
}
function renderToolbar(){root.querySelectorAll('[data-tool]').forEach(b=>b.classList.toggle('on',b.dataset.tool===tool));}
function swatchRow(key,cur){return `<div class="sw">${SWATCHES.map(c=>`<button type="button" class="${String(cur).toLowerCase()===c?'on':''}" style="background:${c}" data-sw="${c}" data-k="${key}" title="${c}"></button>`).join('')}<label class="cpick" title="Eigen kleur"><input type="color" data-k="${key}" value="${/^#[0-9a-f]{6}$/i.test(cur)?cur:'#b7935c'}"></label></div>`;}
function rng(label,key,val,min,max,step,unit=''){return `<label class="rg"><span>${label}<b>${fixed(val,2)}${unit}</b></span><input type="range" data-k="${key}" min="${min}" max="${max}" step="${step}" value="${val}"></label>`;}
function renderOpts(){
  const o=root.querySelector('.mq-opts');
  if(!RASTER_TOOLS.includes(tool)&&tool!=='pick'){o.innerHTML='';o.hidden=true;fitSoon();return;}
  o.hidden=false;let h='';
  const T=TOOLS.find(x=>x[0]===tool)[1];
  h+=`<strong>${T}</strong>`;
  if(['brush','fill','pick'].includes(tool))h+=`<div class="grp">${swatchRow('o.color',opts.color)}</div>`;
  if(['brush','eraser','shade','smudge'].includes(tool))h+=rng('Grootte','o.size',opts.size,1,200,1)+rng('Hardheid','o.hard',opts.hard,0,1,.05);
  if(['brush','eraser','fill'].includes(tool))h+=rng('Dekking','o.opacity',opts.opacity,.05,1,.05);
  if(tool==='brush')h+=`<label class="sel"><span>Mengen</span><select data-k="o.mode">${PAINT_MODES.map(([k,l])=>`<option value="${k}"${opts.mode===k?' selected':''}>${l}</option>`).join('')}</select></label><label class="tg"><input type="checkbox" data-k="o.lock"${opts.lock?' checked':''}> Binnen de lijnen</label>`;
  if(tool==='shade')h+=`<div class="seg"><button type="button" data-o="shade:dark" class="${opts.shade==='dark'?'on':''}">Schaduw</button><button type="button" data-o="shade:light" class="${opts.shade==='light'?'on':''}">Licht</button></div>${opts.shade==='dark'?`<label class="cpick sm" title="Schaduwkleur"><input type="color" data-k="o.shadeColor" value="${opts.shadeColor}"></label>`:''}`+rng('Sterkte','o.strength',opts.strength,.05,1,.05);
  if(tool==='smudge')h+=`<div class="seg"><button type="button" data-o="blend:smudge" class="${opts.blend==='smudge'?'on':''}">Uitsmeren</button><button type="button" data-o="blend:blur" class="${opts.blend==='blur'?'on':''}">Vervagen</button></div>`+rng('Sterkte','o.strength',opts.strength,.05,1,.05);
  if(tool==='fill')h+=rng('Tolerantie','o.tol',opts.tol,0,160,1);
  if(tool==='lasso')h+=`<span class="hint">Teken rond een stuk van een foto of tekenlaag en kies daarna wat je ermee doet.</span>`;
  if(tool==='pick')h+=`<span class="hint">Klik op een foto of tekenlaag om de kleur over te nemen.</span>`;
  if(RASTER_TOOLS.includes(tool)){const tg=rasterTarget();h+=`<span class="hint tgt">${tg?(tg.type==='paint'?'Werkt op: tekenlaag':'Werkt op: geselecteerde foto'):(tool==='brush'?'Werkt op: nieuwe tekenlaag':'Selecteer eerst een foto of tekenlaag')}</span>`;}
  o.innerHTML=h;fitSoon();
}
let fitT=0;function fitSoon(){cancelAnimationFrame(fitT);fitT=requestAnimationFrame(()=>{if(root)fit();});}
function layerName(e){if(e.type==='text')return (e.text||'Tekst').replace(/\s+/g,' ').slice(0,28)||'Tekst';return {image:safeRef(e.src)?'Foto':'Fotovak',paint:'Tekenlaag',shape:e.kind==='ellipse'?'Cirkel':'Vorm',check:'Afvinklijst'}[e.type]||e.type;}
function renderProps(){
  if(!root)return;
  root.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('on',b.dataset.tab===tab));
  const pb=root.querySelector('.mq-pbody');
  if(tab==='layers'){
    const els=page().els;
    pb.innerHTML=`<div class="mq-layers">${els.slice().reverse().map(e=>`<div class="ly${e.id===sel?' on':''}" data-ly="${esc(e.id)}"><span class="nm">${esc(layerName(e))}</span><button type="button" data-la="vis" title="${e.hidden?'Tonen':'Verbergen'}">${ic(e.hidden?'eyeoff':'eye',14)}</button><button type="button" data-la="lock" title="${e.locked?'Ontgrendelen':'Vergrendelen'}">${ic(e.locked?'lock':'unlock',14)}</button><button type="button" data-la="up" title="Naar voren">${ic('up',14)}</button><button type="button" data-la="down" title="Naar achteren">${ic('down',14)}</button></div>`).join('')||'<p class="muted">Nog geen lagen op deze pagina.</p>'}</div>`;
    return;
  }
  const el=selEl();
  if(!el){
    pb.innerHTML=`<h4>Pagina ${pi+1}</h4><div class="lbl">Achtergrond</div>${swatchRow('p.bg',page().bg)}
<h4>Maquette</h4><label class="fld"><span>Koppel</span><input data-k="m.couple" value="${esc(M.couple)}" maxlength="140" placeholder="Maya & Dorian"></label><label class="fld"><span>Datum</span><input type="date" data-k="m.date" value="${esc(M.date||'')}"></label><label class="fld"><span>Plaats</span><input data-k="m.place" value="${esc(M.place)}" maxlength="140" placeholder="Pristina, Kosovo"></label>
<p class="muted small">Koppel, datum en plaats vullen zich overal in de maquette automatisch in. In teksten kun je {couple}, {initials}, {date}, {datelong}, {place} en {nr} gebruiken.</p>
<h4>Sneltoetsen</h4><p class="muted small">V selecteren · T tekst · B penseel · E gum · S schaduw · U blenden · G emmer · L uitknippen · I pipet · R/O vormen · Ctrl+C/X/V knippen & plakken · Ctrl+D dupliceren · Ctrl+Z ongedaan · Delete verwijderen · [ ] penseelgrootte.</p>`;
    return;
  }
  let h=`<h4>${esc(layerName(el))}</h4>`;
  if(el.type==='text'){
    h+=`<label class="fld"><span>Tekst</span><textarea data-k="e.text" rows="3">${esc(el.text)}</textarea></label>
<label class="fld"><span>Lettertype</span><select data-k="e.font">${FONTS.map(f=>`<option${f===el.font?' selected':''} style="font-family:'${f}'">${f}</option>`).join('')}</select></label>
<div class="two">${rng('Grootte','e.size',el.size,5,120,.5)}${rng('Letterafstand','e.ls',el.ls||0,-.05,.6,.01,'em')}</div>${rng('Regelhoogte','e.lh',el.lh||1.35,.8,2.5,.05)}
<div class="seg wide"><button type="button" data-t="bold" class="${el.bold?'on':''}"><b>B</b></button><button type="button" data-t="italic" class="${el.italic?'on':''}"><i>I</i></button><button type="button" data-t="upper" class="${el.upper?'on':''}">AA</button><button type="button" data-set="align:left" class="${el.align==='left'?'on':''}">≡ L</button><button type="button" data-set="align:center" class="${el.align==='center'?'on':''}">≡ M</button><button type="button" data-set="align:right" class="${el.align==='right'?'on':''}">≡ R</button></div>
<div class="lbl">Kleur</div>${swatchRow('e.color',el.color)}`;
  }
  if(el.type==='shape'){
    h+=`<div class="lbl">Vulling</div>${swatchRow('e.fill',el.fill)}<label class="tg"><input type="checkbox" data-t2="grad"${el.fill2?' checked':''}> Verloop (kleurovergang)</label>${el.fill2?`<div class="lbl">Tweede kleur</div>${swatchRow('e.fill2',el.fill2)}${rng('Richting','e.angle',el.angle??180,0,360,5,'°')}`:''}
${el.kind!=='ellipse'?rng('Afgeronde hoeken','e.radius',el.radius||0,0,200,1):''}${rng('Rand','e.sw',el.sw||0,0,20,.2)}${el.sw>0?swatchRow('e.stroke',el.stroke):''}`;
  }
  if(el.type==='image'){
    const has=!!safeRef(el.src),f=el.f||{};
    h+=`<div class="btns"><button type="button" class="mq-b" data-a="replace">${ic('image',15)}<span>${has?'Vervangen':'Foto kiezen'}</span></button>${has?`<button type="button" class="mq-b${panId===el.id?' gold':''}" data-a="pan">${ic('crop',15)}<span>${panId===el.id?'Klaar':'Verschuiven'}</span></button>`:''}</div>
${has?rng('Inzoomen','x.zoom',fixed(zoomOf(el),2),1,5,.05,'×')+'<p class="muted small">Bijsnijden: sleep een zijkant. Schalen: sleep een hoek. Dubbelklik om de foto in het kader te verschuiven.</p>':''}
<div class="lbl">Vorm</div><div class="seg wide">${[['rect','Recht'],['round','Afgerond'],['circle','Rond'],['arch','Boog']].map(([k,l])=>`<button type="button" data-set="shape:${k}" class="${(el.shape||'rect')===k?'on':''}">${l}</button>`).join('')}</div>${el.shape==='round'?rng('Hoeken','e.radius',el.radius||0,0,200,1):''}
${rng('Kader','e.sw',el.sw||0,0,30,.5)}${el.sw>0?swatchRow('e.stroke',el.stroke):''}
${has?`<div class="lbl">Filters</div>${rng('Helderheid','f.b',num(f.b,1),.2,2,.02)}${rng('Contrast','f.c',num(f.c,1),.2,2,.02)}${rng('Verzadiging','f.s',num(f.s,1),0,2.5,.02)}${rng('Warmte','f.se',num(f.se,0),0,1,.02)}${rng('Zwart-wit','f.g',num(f.g,0),0,1,.02)}${rng('Tint','f.hue',num(f.hue,0),-180,180,1,'°')}${rng('Vervaging','f.bl',num(f.bl,0),0,12,.2,'px')}<button type="button" class="mq-b sm" data-a="resetf">Filters resetten</button>`:''}`;
  }
  if(el.type==='paint')h+=`<p class="muted small">Teken met penseel, gum, schaduw of blenden op deze laag.</p><button type="button" class="mq-b sm" data-a="clearpaint">Laag leegmaken</button>`;
  if(el.type==='check'){
    h+=`<label class="fld"><span>Punten (één per regel)</span><textarea data-k="x.items" rows="5">${esc((el.items||[]).map(i=>i.t).join('\n'))}</textarea></label>
<div class="seg wide"><button type="button" data-set="style:card" class="${el.style!=='plain'?'on':''}">Kaartjes</button><button type="button" data-set="style:plain" class="${el.style==='plain'?'on':''}">Lijst</button></div>
<label class="fld"><span>Lettertype</span><select data-k="e.font">${FONTS.map(f=>`<option${f===el.font?' selected':''}>${f}</option>`).join('')}</select></label>${rng('Grootte','e.size',el.size,6,40,.5)}
<div class="lbl">Tekstkleur</div>${swatchRow('e.color',el.color)}<div class="lbl">Vinkje</div>${swatchRow('e.accent',el.accent)}<p class="muted small">Klik op een rondje om af te vinken, ook tijdens het presenteren.</p>`;
  }
  h+=`<div class="lbl">Algemeen</div>${rng('Doorzichtigheid','e.op',el.op??1,0,1,.01)}${rng('Schaduw','e.shadow',el.shadow||0,0,1,.02)}${rng('Draaiing','e.rot',fixed(el.rot||0,1),-180,180,1,'°')}
<label class="fld"><span>Overvloeien (blenden met wat eronder ligt)</span><select data-k="e.blend">${BLENDS.map(([k,l])=>`<option value="${k}"${(el.blend||'normal')===k?' selected':''}>${l}</option>`).join('')}</select></label>
<div class="xywh">${['x','y','w','h'].map(k=>`<label><span>${{x:'X',y:'Y',w:'B',h:'H'}[k]}</span><input type="number" step="1" data-k="g.${k}" value="${Math.round(el[k])}"></label>`).join('')}</div>
<div class="btns"><button type="button" class="mq-b sm" data-a="front" title="Naar voren">${ic('up',14)}<span>Voren</span></button><button type="button" class="mq-b sm" data-a="back" title="Naar achteren">${ic('down',14)}<span>Achter</span></button><button type="button" class="mq-b sm" data-a="dup">${ic('copy',14)}<span>Kopie</span></button><button type="button" class="mq-b sm" data-a="lock">${ic(el.locked?'lock':'unlock',14)}<span>${el.locked?'Los':'Vast'}</span></button><button type="button" class="mq-b sm danger" data-a="del">${ic('trash',14)}<span>Weg</span></button></div>`;
  pb.innerHTML=h;
}
function zoomOf(el){if(!el.nat)return 1;const cv=coverCrop(el.w,el.h,el.nat.w,el.nat.h);return clamp(cv.w/(el.crop?.w||1),1,5);}
function setZoom(el,z){if(!el.nat)return;const cv=coverCrop(el.w,el.h,el.nat.w,el.nat.h),c=el.crop||cv,cx=c.x+c.w/2,cy=c.y+c.h/2,w=cv.w/z,h=cv.h/z;el.crop={x:clamp(cx-w/2,0,1-w),y:clamp(cy-h/2,0,1-h),w,h};}

/* ================= property changes ================= */
function propsUndo(){const n=Date.now();if(n-propsUndoAt>900)pushUndo();propsUndoAt=n;}
function setProp(k,v,input){
  const [ns,key]=k.split('.');
  if(ns==='o'){opts[key]=input&&input.type==='checkbox'?input.checked:(typeof opts[key]==='number'?num(v,opts[key]):v);if(input&&input.type==='range'){const b=input.closest('.rg')?.querySelector('b');if(b)b.textContent=fixed(opts[key],2);}else renderOpts();return;}
  if(ns==='m'){M[key]=String(v);markDirty();renderStage();return;}
  if(ns==='p'){propsUndo();page().bg=v;markDirty();renderStage();renderProps();return;}
  const el=selEl();if(!el)return;propsUndo();
  if(ns==='e'){const numeric=['size','ls','lh','op','shadow','rot','radius','sw','angle'].includes(key);el[key]=numeric?num(v,0):v;}
  else if(ns==='f'){el.f=el.f||{};el.f[key]=num(v,0);}
  else if(ns==='g'){const n=num(v,el[key]);if((key==='w'||key==='h')&&n<2)return;if(el.type==='image'&&el.nat&&(key==='w'||key==='h')){const r=el.h/el.w;if(key==='w'){el.w=n;el.h=n*r;}else{el.h=n;el.w=n/r;}}else el[key]=n;}
  else if(ns==='x'){if(key==='zoom')setZoom(el,num(v,1));if(key==='items'){const old=el.items||[];el.items=String(v).split('\n').filter((s,i,a)=>s.trim()||i<a.length-1).map((s,i)=>({t:s,done:!!(old[i]&&old[i].done)}));}}
  if(input&&input.type==='range'){const b=input.closest('.rg')?.querySelector('b');if(b)b.textContent=fixed(num(v,0),2)+(b.textContent.match(/[a-z°×]+$/)||[''])[0];}
  markDirty();refreshEl(el);
  if(input&&(input.tagName==='SELECT'||input.dataset.sw||input.type==='color'))renderProps();
}

/* ================= actions ================= */
function setTool(t){
  if(editing)stopEdit();
  tool=t;if(t!=='lasso'&&lasso){lasso=null;hidePop();}
  if(panId&&t!=='select')panId=null;
  const tg=rasterTarget();if(tg&&RASTER_TOOLS.includes(t))rasterOf(tg).catch(()=>{});
  renderToolbar();renderOpts();renderStage();
}
function select(id){if(editing&&editing!==id)stopEdit();sel=id;if(panId&&panId!==id)panId=null;renderStage();renderProps();if(RASTER_TOOLS.includes(tool))renderOpts();const tg=rasterTarget();if(tg&&RASTER_TOOLS.includes(tool))rasterOf(tg).catch(()=>{});}
function addEl(el){pushUndo();el.id=uid();el.rot=el.rot||0;el.op=el.op??1;page().els.push(el);sel=el.id;setTool('select');markDirty();renderAll();return el;}
function delSel(){const el=selEl();if(!el)return;pushUndo();page().els=page().els.filter(e=>e!==el);sel=null;markDirty();renderAll();}
function dupSel(off=14){const el=selEl();if(!el)return;pushUndo();const c=cloneEl(el);c.id=uid();c.x+=off;c.y+=off;c.locked=false;page().els.push(c);sel=c.id;markDirty();renderAll();}
function order(dir){const els=page().els,el=selEl();if(!el)return;const i=els.indexOf(el);pushUndo();els.splice(i,1);
  if(dir==='front')els.push(el);else if(dir==='back')els.unshift(el);else if(dir==='up')els.splice(Math.min(els.length,i+1),0,el);else els.splice(Math.max(0,i-1),0,el);markDirty();renderAll();}
function insertLogo(){loadImg('./assets/img/monogram-mark.png').then(i=>{const k=160/i.naturalWidth;addEl({type:'image',x:W/2-80,y:H/2-i.naturalHeight*k/2,w:160,h:i.naturalHeight*k,src:'./assets/img/monogram-mark.png',nat:{w:i.naturalWidth,h:i.naturalHeight},crop:{x:0,y:0,w:1,h:1},shape:'rect',radius:0,f:{},sw:0,stroke:'#ffffff'});}).catch(()=>toast('Logo niet gevonden'));}
function copySel(cut){const el=selEl();if(!el)return false;clip=cloneEl(el);if(cut)delSel();toast(cut?'Geknipt':'Gekopieerd');return true;}
function pasteClip(){if(!clip)return;pushUndo();const c=cloneEl(clip);c.id=uid();c.x+=14;c.y+=14;clip=cloneEl(c);page().els.push(c);sel=c.id;markDirty();renderAll();}
function gotoPage(i){if(editing)stopEdit();pi=clamp(i,0,M.pages.length-1);sel=null;panId=null;lasso=null;hidePop();renderAll();}
function pageAction(i,a){
  const ps=M.pages;pushUndo();
  if(a==='up'&&i>0){[ps[i-1],ps[i]]=[ps[i],ps[i-1]];pi=i-1;}
  else if(a==='down'&&i<ps.length-1){[ps[i+1],ps[i]]=[ps[i],ps[i+1]];pi=i+1;}
  else if(a==='dup'){const c=clonePages([ps[i]])[0];c.id=uid();c.els.forEach(e=>e.id=uid());ps.splice(i+1,0,c);pi=i+1;}
  else if(a==='del'){if(ps.length<2){undoS.pop();toast('Een maquette heeft minstens één pagina');return;}ps.splice(i,1);pi=Math.min(pi,ps.length-1);}
  else {undoS.pop();return;}
  sel=null;markDirty();renderAll();
}
function openTemplates(){
  const m=root.querySelector('.mq-modal');const c=ctxFor(pi+1);
  m.innerHTML=`<div class="in"><div class="mh"><h3>Pagina toevoegen</h3><button type="button" class="mq-b icon" data-a="close-modal" aria-label="Sluiten">${ic('x')}</button></div><p class="muted small">Sjablonen in de stijl van het Wedding Book. Alles is daarna aan te passen.</p><div class="tg-grid">${TEMPLATES.map(([k,name])=>{const pg={bg:TEMPLATES.find(x=>x[0]===k)[2],els:TEMPLATES.find(x=>x[0]===k)[3]().map(e=>Object.assign({id:'p',rot:0,op:1},e))};return `<button type="button" class="tpl" data-tpl="${k}">${thumbHTML(pg,c,200)}<span>${esc(name)}</span></button>`;}).join('')}</div></div>`;
  m.hidden=false;
}
function closeModal(){const m=root.querySelector('.mq-modal');m.hidden=true;m.innerHTML='';}
function showPop(html,pos){const p=root.querySelector('.mq-pop');p.innerHTML=html;p.hidden=false;const v=root.querySelector('.mq-view').getBoundingClientRect(),r=stage.getBoundingClientRect();p.style.left=clamp(r.left-v.left+pos.x*S,10,v.width-280)+'px';p.style.top=clamp(r.top-v.top+pos.y*S+12,10,v.height-60)+'px';}
function hidePop(){const p=root&&root.querySelector('.mq-pop');if(p){p.hidden=true;p.innerHTML='';}}

/* text editing */
function startEdit(el){
  if(el.locked)return;editing=el.id;sel=el.id;renderStage();renderProps();
}
function startEditNode(n,el){
  if(!el)return;n.textContent=el.text;
  try{n.contentEditable='plaintext-only';}catch(e){n.contentEditable='true';}
  if(n.contentEditable!=='plaintext-only')n.contentEditable='true';
  n.classList.add('editing');n.focus();
  const r=document.createRange();r.selectNodeContents(n);const s=getSelection();s.removeAllRanges();s.addRange(r);
  n.addEventListener('blur',()=>{if(editing===el.id)stopEdit();},{once:true});
}
function stopEdit(){
  const id=editing;editing=null;if(!id)return;
  const el=page().els.find(e=>e.id===id),n=stage.querySelector(`.mq-el[data-id="${id}"] .tx span`);
  if(el&&n){const v=n.innerText.replace(/\n$/,'');if(v!==el.text){pushUndo();el.text=v;markDirty();}}
  renderStage();renderProps();
}

/* ================= pointer handling ================= */
async function onDown(ev){
  if(ev.button!==0&&ev.pointerType==='mouse')return;
  if(ev.target.closest('[contenteditable]'))return;
  if(editing)stopEdit();
  hidePop();
  const p=pt(ev),hd=ev.target.closest('[data-h]'),el=selEl();
  ev.preventDefault();
  if(tool==='select'){
    if(hd&&el&&!el.locked){startTransform(el,hd.dataset.h,p,ev);return;}
    const chkN=ev.target.closest('[data-chk]');
    const h=hit(p);
    if(chkN&&h&&h.type==='check'){const i=+chkN.dataset.chk;pushUndo();h.items[i].done=!h.items[i].done;markDirty();sel=h.id;renderStage();renderProps();return;}
    if(panId&&el&&el.id===panId&&inside(el,p)){drag={kind:'pan',el,p0:p,c0:{...el.crop},k:el.w/(el.crop.w*el.nat.w)};pushUndo();capture(ev);return;}
    if(h){if(sel!==h.id)select(h.id);drag={kind:'move',el:h,p0:p,o:{x:h.x,y:h.y},moved:false};capture(ev);return;}
    if(panId){panId=null;}
    select(null);return;
  }
  if(tool==='text'){const e=addEl({type:'text',x:p.x-10,y:p.y-14,w:320,h:44,text:'Uw tekst',font:'Cormorant',size:24,color:INK,align:'left',bold:false,italic:false,ls:0,lh:1.3,upper:false,va:'top'});startEdit(e);return;}
  if(tool==='rect'||tool==='ellipse'){pushUndo();const e={id:uid(),type:'shape',kind:tool,x:p.x,y:p.y,w:1,h:1,rot:0,op:1,fill:opts.color||GOLD,fill2:null,angle:180,radius:0,sw:0,stroke:GOLD};page().els.push(e);sel=e.id;drag={kind:'create',el:e,p0:p};capture(ev);renderStage();return;}
  if(tool==='pick'){
    if(window.EyeDropper){try{const r=await new window.EyeDropper().open();opts.color=r.sRGBHex;renderOpts();toast('Kleur gekozen: '+r.sRGBHex);}catch(e){}return;}
    const h=hit(p)||el;if(h&&(h.type==='image'||h.type==='paint')&&safeRef(h.src)){try{await rasterOf(h);const q=toCv(h,p),d=h._cv.getContext('2d').getImageData(Math.floor(q.x),Math.floor(q.y),1,1).data;opts.color='#'+[d[0],d[1],d[2]].map(v=>v.toString(16).padStart(2,'0')).join('');renderOpts();toast('Kleur gekozen: '+opts.color);}catch(e){}}
    return;
  }
  if(RASTER_TOOLS.includes(tool)){
    let tg=rasterTarget();
    if(!tg&&tool==='brush'){pushUndo();tg=newPaintLayer();sel=tg.id;renderStage();renderProps();renderOpts();}
    else if(!tg){const h=hit(p);if(h&&!h.locked&&((h.type==='image'&&safeRef(h.src))||h.type==='paint')){tg=h;select(h.id);}}
    if(!tg){toast('Selecteer eerst een foto of tekenlaag');return;}
    if(!inside(tg,p,tool==='lasso'?2000:0)&&tool!=='brush'&&tool!=='eraser'&&tool!=='shade'&&tool!=='smudge'){return;}
    const down={id:ev.pointerId,up:false};const upW=()=>{down.up=true;};window.addEventListener('pointerup',upW,{once:true});
    try{await rasterOf(tg);}catch(e){toast('Deze foto kan niet bewerkt worden');return;}
    if(tool==='fill'){pushUndo();if(floodFill(tg,p))commitRaster(tg);else undoS.pop();renderStage();return;}
    if(tool==='lasso'){lasso={id:tg.id,pts:[p],done:false};drag={kind:'lasso'};capture(ev);renderStage();return;}
    if(down.up)return;
    pushUndo();
    beginStroke(tg,p);capture(ev);
  }
}
function capture(ev){try{ev.target.setPointerCapture(ev.pointerId);}catch(e){}}
function startTransform(el,h,p,ev){
  pushUndo();
  drag={kind:h==='rot'?'rotate':'resize',h,el,p0:p,o:{x:el.x,y:el.y,w:el.w,h:el.h,rot:el.rot||0,crop:el.crop?{...el.crop}:null}};
  capture(ev);
}
function snap(el){
  const gv=stage.querySelector('.mq-guide.v'),gh=stage.querySelector('.mq-guide.h');let sv=false,sh=false;
  const cx=el.x+el.w/2,cy=el.y+el.h/2,th=5;
  if(Math.abs(cx-W/2)<th){el.x=W/2-el.w/2;sv=true;}else if(Math.abs(el.x)<th)el.x=0;else if(Math.abs(el.x+el.w-W)<th)el.x=W-el.w;
  if(Math.abs(cy-H/2)<th){el.y=H/2-el.h/2;sh=true;}else if(Math.abs(el.y)<th)el.y=0;else if(Math.abs(el.y+el.h-H)<th)el.y=H-el.h;
  if(gv)gv.hidden=!sv;if(gh)gh.hidden=!sh;
}
function onMove(ev){
  if(!drag)return;
  const p=pt(ev),d=drag;
  if(d.kind==='stroke'){const evs=ev.getCoalescedEvents?ev.getCoalescedEvents():[ev];for(const e of (evs.length?evs:[ev]))strokeTo(pt(e));return;}
  if(d.kind==='lasso'){lasso.pts.push(p);const s=stage.querySelector('.mq-lasso polyline');if(s)s.setAttribute('points',lasso.pts.map(q=>fixed(q.x,1)+','+fixed(q.y,1)).join(' '));else{stage.insertAdjacentHTML('beforeend',lassoHTML());}return;}
  if(d.kind==='move'){
    const dx=p.x-d.p0.x,dy=p.y-d.p0.y;if(!d.moved&&Math.hypot(dx,dy)<2/S)return;
    if(!d.moved){d.moved=true;pushUndo();}
    d.el.x=d.o.x+dx;d.el.y=d.o.y+dy;if(!ev.altKey&&!d.el.rot)snap(d.el);refreshEl(d.el);return;
  }
  if(d.kind==='pan'){const el=d.el,c=el.crop;c.x=clamp(d.c0.x-(p.x-d.p0.x)/(d.k*el.nat.w),0,1-c.w);c.y=clamp(d.c0.y-(p.y-d.p0.y)/(d.k*el.nat.h),0,1-c.h);refreshEl(el);return;}
  if(d.kind==='create'){const e=d.el;let w=p.x-d.p0.x,h=p.y-d.p0.y;if(ev.shiftKey){const m=Math.max(Math.abs(w),Math.abs(h));w=Math.sign(w||1)*m;h=Math.sign(h||1)*m;}e.x=Math.min(d.p0.x,d.p0.x+w);e.y=Math.min(d.p0.y,d.p0.y+h);e.w=Math.max(1,Math.abs(w));e.h=Math.max(1,Math.abs(h));refreshEl(e);return;}
  if(d.kind==='rotate'){const e=d.el,cx=d.o.x+d.o.w/2,cy=d.o.y+d.o.h/2;let a=Math.atan2(p.y-cy,p.x-cx)*180/Math.PI+90;if(a>180)a-=360;const sn=ev.shiftKey?15:0;if(sn)a=Math.round(a/sn)*sn;else for(const s of [-180,-90,0,90,180])if(Math.abs(a-s)<3)a=s;e.rot=fixed(a,1);refreshEl(e);return;}
  if(d.kind==='resize'){
    const e=d.el,o=d.o,h=d.h,ref={x:o.x,y:o.y,w:o.w,h:o.h,rot:o.rot},l0=local(ref,p);
    let L=0,T=0,R=o.w,B=o.h;
    if(h.includes('e'))R=l0.x;if(h.includes('w'))L=l0.x;if(h.includes('s'))B=l0.y;if(h.includes('n'))T=l0.y;
    const isImg=e.type==='image'&&safeRef(e.src)&&e.nat&&o.crop,corner=h.length===2,keep=corner&&(isImg||e.type==='paint'||ev.shiftKey);
    if(isImg&&!corner){
      const k=o.w/(o.crop.w*e.nat.w),nw=k*e.nat.w,nh=k*e.nat.h;
      L=Math.max(L,-o.crop.x*nw);R=Math.min(R,(1-o.crop.x)*nw);T=Math.max(T,-o.crop.y*nh);B=Math.min(B,(1-o.crop.y)*nh);
      if(R-L<8){if(h.includes('w'))L=R-8;else R=L+8;}if(B-T<8){if(h.includes('n'))T=B-8;else B=T+8;}
      e.crop={x:o.crop.x+L/nw,y:o.crop.y+T/nh,w:(R-L)/nw,h:(B-T)/nh};
    }else{
      if(R-L<6){if(h.includes('w'))L=R-6;else R=L+6;}if(B-T<4){if(h.includes('n'))T=B-4;else B=T+4;}
      if(keep){const ratio=o.w/o.h;let w=R-L,hh=B-T;if(w/hh>ratio)w=hh*ratio;else hh=w/ratio;if(h.includes('w'))L=R-w;else R=L+w;if(h.includes('n'))T=B-hh;else B=T+hh;}
    }
    const nw=R-L,nh=B-T,a=o.rot*Math.PI/180,ox=(L+R)/2-o.w/2,oy=(T+B)/2-o.h/2,cx=o.x+o.w/2+ox*Math.cos(a)-oy*Math.sin(a),cy=o.y+o.h/2+ox*Math.sin(a)+oy*Math.cos(a);
    e.w=nw;e.h=nh;e.x=cx-nw/2;e.y=cy-nh/2;refreshEl(e);return;
  }
}
function onUp(ev){
  const d=drag;if(!d)return;drag=null;
  stage.querySelectorAll('.mq-guide').forEach(g=>g.hidden=true);
  if(d.kind==='stroke'){endStroke(d);return;}
  if(d.kind==='lasso'){lasso.done=true;renderStage();if(lasso.pts.length<3){lasso=null;renderStage();return;}const last=lasso.pts[lasso.pts.length-1];
    showPop(`<button type="button" data-l="cut">Uitknippen naar nieuwe laag</button><button type="button" data-l="copy">Kopiëren naar nieuwe laag</button><button type="button" data-l="erase">Selectie wegvegen</button><button type="button" data-l="keep">Alleen selectie houden</button><button type="button" data-l="cancel">Annuleren</button>`,last);return;}
  if(d.kind==='create'){const e=d.el;if(e.w<6&&e.h<6){e.w=180;e.h=tool==='ellipse'?180:110;e.x=d.p0.x-e.w/2;e.y=d.p0.y-e.h/2;}setTool('select');markDirty();renderAll();return;}
  if(d.kind==='move'&&!d.moved)return;
  markDirty();renderStage();renderProps();
}
function onDbl(ev){
  if(tool!=='select')return;
  const p=pt(ev),h=hit(p);if(!h)return;
  if(h.type==='text')startEdit(h);
  else if(h.type==='image'){if(!safeRef(h.src))pickFile(h);else{panId=panId===h.id?null:h.id;sel=h.id;renderStage();renderProps();}}
  else if(h.type==='check'){sel=h.id;tab='design';renderAll();const ta=root.querySelector('[data-k="x.items"]');if(ta)ta.focus();}
}

/* ================= bindings ================= */
function onKey(ev){
  if(!root||present)return;
  const tg=ev.target,typing=tg&&(tg.isContentEditable||/^(INPUT|TEXTAREA|SELECT)$/.test(tg.tagName));
  if(ev.key==='Escape'){if(editing){stopEdit();return;}if(!root.querySelector('.mq-modal').hidden){closeModal();return;}if(lasso){lasso=null;hidePop();renderStage();return;}if(panId){panId=null;renderStage();renderProps();return;}select(null);return;}
  if(typing)return;
  const mod=ev.ctrlKey||ev.metaKey,k=ev.key.toLowerCase();
  if(mod&&k==='z'){ev.preventDefault();ev.shiftKey?restore(redoS,undoS):restore(undoS,redoS);return;}
  if(mod&&k==='y'){ev.preventDefault();restore(redoS,undoS);return;}
  if(mod&&k==='s'){ev.preventDefault();save();return;}
  if(mod&&k==='c'){if(copySel(false))ev.preventDefault();return;}
  if(mod&&k==='x'){if(copySel(true))ev.preventDefault();return;}
  if(mod&&k==='d'){ev.preventDefault();dupSel();return;}
  if(mod)return;
  const el=selEl();
  if((ev.key==='Delete'||ev.key==='Backspace')&&el){ev.preventDefault();delSel();return;}
  if(ev.key.startsWith('Arrow')&&el&&!el.locked){ev.preventDefault();const s=ev.shiftKey?10:1;if(!onKey.t||Date.now()-onKey.t>700)pushUndo();onKey.t=Date.now();if(ev.key==='ArrowLeft')el.x-=s;if(ev.key==='ArrowRight')el.x+=s;if(ev.key==='ArrowUp')el.y-=s;if(ev.key==='ArrowDown')el.y+=s;markDirty();refreshEl(el);return;}
  if(ev.key==='['||ev.key===']'){opts.size=clamp(opts.size+(ev.key===']'?4:-4),1,200);renderOpts();return;}
  const t=TOOLS.find(x=>x[2].toLowerCase()===k);if(t){setTool(t[0]);return;}
  if(ev.key==='PageDown')gotoPage(pi+1);if(ev.key==='PageUp')gotoPage(pi-1);
}
function onPaste(ev){
  if(!root||present)return;const tg=ev.target;if(tg&&(tg.isContentEditable||/^(INPUT|TEXTAREA)$/.test(tg.tagName)))return;
  const files=[...(ev.clipboardData?.items||[])].filter(i=>i.kind==='file'&&/^image\//.test(i.type)).map(i=>i.getAsFile()).filter(Boolean);
  if(files.length){ev.preventDefault();const el=selEl();addImage(files[0],null,el&&el.type==='image'?el:null);return;}
  if(clip){ev.preventDefault();pasteClip();}
}
function onResize(){if(root)fit();if(present)renderPresent();}
function onBeforeUnload(ev){if(dirty){ev.preventDefault();ev.returnValue='';}}
function bindEditor(){
  const v=root.querySelector('.mq-view');
  v.addEventListener('pointerdown',ev=>{if(ev.target.closest('.mq-pop'))return;if(ev.target.closest('.mq-wrap')||ev.target===v)onDown(ev);});
  v.addEventListener('pointermove',onMove);v.addEventListener('pointerup',onUp);v.addEventListener('pointercancel',onUp);
  v.addEventListener('dblclick',onDbl);
  v.addEventListener('dragover',ev=>{ev.preventDefault();});
  v.addEventListener('drop',ev=>{ev.preventDefault();const f=[...(ev.dataTransfer?.files||[])].filter(x=>/^image\//.test(x.type));if(!f.length)return;const p=pt(ev),h=hit(p);let at=p;f.forEach((file,i)=>{addImage(file,{x:at.x+i*20,y:at.y+i*20},i===0&&h&&h.type==='image'?h:null);});});
  root.addEventListener('click',ev=>{
    const b=ev.target.closest('button');if(!b||!root.contains(b))return;
    if(b.dataset.tool){setTool(b.dataset.tool);return;}
    if(b.dataset.tab){tab=b.dataset.tab;renderProps();return;}
    if(b.dataset.sw){setProp(b.dataset.k,b.dataset.sw,b);if(b.dataset.k.startsWith('o.'))renderOpts();return;}
    if(b.dataset.o){const [k,v2]=b.dataset.o.split(':');opts[k]=v2;renderOpts();return;}
    if(b.dataset.t){const el=selEl();if(el){pushUndo();el[b.dataset.t]=!el[b.dataset.t];markDirty();refreshEl(el);renderProps();}return;}
    if(b.dataset.set){const el=selEl();const [k,v2]=b.dataset.set.split(':');if(el){pushUndo();el[k]=v2;if(k==='shape'&&v2==='round'&&!el.radius)el.radius=16;markDirty();refreshEl(el);renderProps();}return;}
    if(b.dataset.pa){ev.stopPropagation();pageAction(+b.closest('[data-page]').dataset.page,b.dataset.pa);return;}
    if(b.dataset.tpl){closeModal();pushUndo();M.pages.splice(pi+1,0,makePage(b.dataset.tpl));pi++;sel=null;markDirty();renderAll();return;}
    if(b.dataset.l){const k=b.dataset.l;hidePop();if(k==='cancel'){lasso=null;renderStage();return;}lassoAction(k);return;}
    if(b.dataset.la){const id=b.closest('[data-ly]').dataset.ly,el=page().els.find(e=>e.id===id);if(!el)return;ev.stopPropagation();if(b.dataset.la==='vis'){pushUndo();el.hidden=!el.hidden;if(el.hidden&&sel===id)sel=null;}else if(b.dataset.la==='lock'){pushUndo();el.locked=!el.locked;}else{sel=id;order(b.dataset.la);return;}markDirty();renderStage();renderProps();return;}
    const a=b.dataset.a;if(!a)return;
    ({close:closeEditor,undo:()=>restore(undoS,redoS),redo:()=>restore(redoS,undoS),save,present:()=>startPresent(pi),export:exportPDF,
      'm-pages':()=>{mobPanel=mobPanel==='pages'?null:'pages';root.dataset.mob=mobPanel||'';},'m-props':()=>{mobPanel=mobPanel==='props'?null:'props';root.dataset.mob=mobPanel||'';},
      'add-image':()=>pickFile(null),'add-frame':()=>addEl(ph(W/2-150,H/2-110,300,220)),'add-check':()=>addEl(chk(W/2-150,H/2-60,300,120,['Eerste keuze','Tweede keuze'],{style:'plain',size:13,font:'Cormorant'})),
      'add-line':()=>addEl(rect(W/2-150,H/2,300,1,GOLD)),'add-logo':insertLogo,'add-page':openTemplates,'close-modal':closeModal,
      replace:()=>pickFile(selEl()),pan:()=>{const el=selEl();panId=panId===el.id?null:el.id;renderStage();renderProps();},
      resetf:()=>{const el=selEl();pushUndo();el.f={};markDirty();refreshEl(el);renderProps();},
      clearpaint:()=>{const el=selEl();pushUndo();el.src=null;el._cv=null;markDirty();renderStage();},
      front:()=>order('front'),back:()=>order('back'),dup:()=>dupSel(),lock:()=>{const el=selEl();pushUndo();el.locked=!el.locked;markDirty();renderStage();renderProps();},del:delSel
    }[a]||(()=>{}))();
  });
  root.querySelector('.mq-pages').addEventListener('click',ev=>{if(ev.target.closest('button'))return;const pg=ev.target.closest('[data-page]');if(pg){root.querySelector('.mq-pages').dataset.noscroll='1';gotoPage(+pg.dataset.page);delete root.querySelector('.mq-pages').dataset.noscroll;if(mobPanel==='pages'){mobPanel=null;root.dataset.mob='';}}});
  root.querySelector('.mq-props').addEventListener('click',ev=>{const ly=ev.target.closest('[data-ly]');if(ly&&!ev.target.closest('button'))select(ly.dataset.ly===sel?null:ly.dataset.ly);});
  const onInput=ev=>{const k=ev.target.dataset.k;if(!k)return;setProp(k,ev.target.value,ev.target);};
  root.addEventListener('input',ev=>{if(ev.target.type==='checkbox')return;if(ev.target.tagName==='SELECT')return;onInput(ev);});
  root.addEventListener('change',ev=>{const t2=ev.target;if(t2.dataset.t2==='grad'){const el=selEl();pushUndo();el.fill2=t2.checked?(el.fill==='#ffffff'?GOLD:'#ffffff'):null;markDirty();refreshEl(el);renderProps();return;}if(t2.type==='checkbox'||t2.tagName==='SELECT')onInput(ev);else if(t2.type==='color'&&t2.dataset.k&&!t2.dataset.k.startsWith('o.'))renderProps();});
  root.querySelector('.mq-title').addEventListener('input',ev=>{M.title=ev.target.value||'Maquette';markDirty();});
  root.querySelector('.mq-file').addEventListener('change',async ev=>{const files=[...ev.target.files];ev.target.value='';const into=filePickTarget;filePickTarget=null;for(let i=0;i<files.length;i++)await addImage(files[i],i?{x:W/2+i*20,y:H/2+i*20}:null,i===0?into:null);});
  root.querySelector('.mq-modal').addEventListener('click',ev=>{if(ev.target.classList.contains('mq-modal'))closeModal();});
  window.addEventListener('keydown',onKey);window.addEventListener('paste',onPaste);window.addEventListener('resize',onResize);window.addEventListener('beforeunload',onBeforeUnload);
}
async function closeEditor(){
  if(editing)stopEdit();
  if(dirty){setStatus('Opslaan…');await save();if(dirty&&!confirm('Niet alles is opgeslagen. Toch sluiten?'))return;}
  window.removeEventListener('keydown',onKey);window.removeEventListener('paste',onPaste);window.removeEventListener('resize',onResize);window.removeEventListener('beforeunload',onBeforeUnload);
  root.remove();root=null;stage=null;M=null;undoS=[];redoS=[];sel=null;document.body.classList.remove('mq-open');
  if(galleryEl&&document.body.contains(galleryEl))loadGallery();
}

/* ================= present & export ================= */
function startPresent(i){
  if(editing)stopEdit();
  present={i,el:document.createElement('div')};present.el.className='mq-show';
  present.el.innerHTML='<div class="stg"></div><div class="nav"><button type="button" data-p="prev" aria-label="Vorige">‹</button><span></span><button type="button" data-p="next" aria-label="Volgende">›</button><button type="button" data-p="close" aria-label="Sluiten">✕</button></div>';
  document.body.appendChild(present.el);
  present.el.addEventListener('click',ev=>{
    const c=ev.target.closest('[data-chk]');
    if(c){const id=c.closest('.mq-el').dataset.id,el=M.pages[present.i].els.find(e=>e.id===id);if(el){const k=+c.dataset.chk;el.items[k].done=!el.items[k].done;markDirty();renderPresent();}return;}
    const b=ev.target.closest('[data-p]');if(b){if(b.dataset.p==='close')stopPresent();else go(b.dataset.p==='next'?1:-1);return;}
    if(ev.target.closest('.stg'))go(1);
  });
  present.key=ev=>{if(ev.key==='Escape')stopPresent();else if(['ArrowRight','PageDown',' '].includes(ev.key)){ev.preventDefault();go(1);}else if(['ArrowLeft','PageUp'].includes(ev.key))go(-1);};
  window.addEventListener('keydown',present.key);
  const go=d=>{present.i=clamp(present.i+d,0,M.pages.length-1);renderPresent();};
  try{present.el.requestFullscreen&&present.el.requestFullscreen().catch(()=>{});}catch(e){}
  renderPresent();
}
function renderPresent(){
  if(!present)return;const s=Math.min(innerWidth/W,innerHeight/H),pg=M.pages[present.i];
  const stg=present.el.querySelector('.stg');stg.style.cssText=`width:${W}px;height:${H}px;transform:translate(-50%,-50%) scale(${s});background:${col(pg.bg)}`;
  stg.innerHTML=pageInner(pg,ctxFor(present.i));hydrate(stg);present.el.querySelector('.nav span').textContent=`${present.i+1} / ${M.pages.length}`;
}
function stopPresent(){if(!present)return;window.removeEventListener('keydown',present.key);if(document.fullscreenElement)document.exitFullscreen().catch(()=>{});present.el.remove();const i=present.i;present=null;gotoPage(i);}
async function exportPDF(){
  if(editing)stopEdit();
  setStatus('PDF voorbereiden…');
  const refs=new Set();M.pages.forEach(p=>p.els.forEach(e=>{if(!e.hidden&&safeRef(e.src))refs.add(e.src);}));
  await Promise.all([...refs].map(ensureURL));
  const box=document.createElement('div');box.id='mqPrint';
  box.innerHTML=M.pages.map((p,i)=>`<div class="mq-printpage">${pageHTML(p,ctxFor(i))}</div>`).join('');
  document.body.appendChild(box);hydrate(box);
  await Promise.all([...box.querySelectorAll('img')].map(i=>i.decode?i.decode().catch(()=>{}):null));
  if(document.fonts&&document.fonts.ready)await document.fonts.ready;
  document.body.classList.add('mq-printing');setStatus(dirty?'Wijzigingen…':'Opgeslagen');
  const done=()=>{document.body.classList.remove('mq-printing');box.remove();window.removeEventListener('afterprint',done);};
  window.addEventListener('afterprint',done);
  setTimeout(()=>{window.print();setTimeout(()=>{if(document.body.contains(box)&&!matchMedia('print').matches)done();},1500);},60);
}

/* ================= open / gallery ================= */
function loadFonts(){
  if(document.getElementById('mqFonts'))return;
  const l=document.createElement('link');l.id='mqFonts';l.rel='stylesheet';
  l.href='https://fonts.googleapis.com/css2?family=Cinzel:wght@400;500&family=Cormorant:ital,wght@0,400;0,500;0,600;1,400;1,500&family=Great+Vibes&family=Libre+Caslon+Text:ital@0;1&family=Montserrat:wght@300;400;500&family=Playfair+Display:ital,wght@0,400;0,500;1,400&display=swap';
  document.head.appendChild(l);
}
function normalize(row){
  const d=row.data&&Array.isArray(row.data.pages)?row.data:{pages:[]};
  const pages=d.pages.filter(p=>p&&Array.isArray(p.els)).map(p=>({id:p.id||uid(),bg:p.bg||CREAM,els:p.els.filter(e=>e&&e.type).map(e=>Object.assign({},e,{id:e.id||uid()}))}));
  if(!pages.length)pages.push(makePage('blank'));
  return {id:row.id,title:row.title||'Maquette',couple:row.couple||'',date:row.wedding_date||'',place:row.place||'',version:Number(row.version)||1,pages};
}
async function openEditor(id){
  if(!host.owner()){toast('Alleen voor de owner');return;}
  loadFonts();
  let row;try{row=await store().get(id);}catch(e){toast('Openen lukt niet: '+(e.message||e));return;}
  if(!row){toast('Maquette niet gevonden');return;}
  M=normalize(row);pi=0;sel=null;tool='select';undoS=[];redoS=[];dirty=false;editing=null;panId=null;lasso=null;tab='design';
  buildEditor();fit();renderAll();setStatus('Opgeslagen');
}
let galleryEl=null,galleryList=null,galleryErr='',creating=false,confirmDel=null;
function gallery(el,h){host=Object.assign(host,h||{});galleryEl=el;loadFonts();renderGallery();loadGallery();}
async function loadGallery(){try{galleryList=await store().list();galleryErr='';}catch(e){galleryErr=e.message||String(e);galleryList=galleryList||[];}renderGallery();}
function renderGallery(){
  const g=galleryEl;if(!g||!document.body.contains(g))return;
  const list=galleryList;
  const form=creating?`<section class="bc-card mq-new"><div class="head"><h2>Nieuwe maquette</h2></div><form data-mq="create">
<div class="mq-fgrid"><label class="bc-field"><span>Naam</span><input name="title" required maxlength="140" placeholder="Wedding maquette Maya & Dorian"></label>
<label class="bc-field"><span>Koppel</span><input name="couple" maxlength="140" placeholder="Maya & Dorian"></label>
<label class="bc-field"><span>Datum</span><input type="date" name="date"></label>
<label class="bc-field"><span>Plaats</span><input name="place" maxlength="140" placeholder="Pristina, Kosovo"></label></div>
<div class="mq-start"><label><input type="radio" name="start" value="book" checked> <span><b>Volledig Wedding Book</b><small>23 pagina’s in de stijl van het voorbeeld: cover, sommaire, moodboards, planning, thema’s, vos choix…</small></span></label>
<label><input type="radio" name="start" value="blank"> <span><b>Leeg beginnen</b><small>Eén cover en een lege pagina.</small></span></label></div>
<div style="display:flex;gap:10px;flex-wrap:wrap"><button class="bc-btn" type="submit">Maken en openen</button><button class="bc-btn ghost" type="button" data-mq="cancel">Annuleren</button></div></form></section>`:'';
  const cards=list?list.map(m=>`<article class="mq-card"><button type="button" class="cv" data-mq="open" data-id="${esc(m.id)}" aria-label="Open ${esc(m.title)}">${m.cover?thumbHTML(normPage(m.cover),{couple:m.couple,date:m.wedding_date,place:m.place,nr:1,total:1},320):''}</button>
<div class="meta"><h3>${esc(m.title)}</h3><span class="small muted">${esc(m.couple||'')}${m.wedding_date?' · '+esc(fdate(m.wedding_date)):''}${m.place?' · '+esc(m.place):''}</span><span class="small muted">Laatst bewerkt ${esc(new Date(m.updated_at).toLocaleString('nl-BE',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}))}</span></div>
<div class="act"><button type="button" class="bc-btn sm" data-mq="open" data-id="${esc(m.id)}">Openen</button><button type="button" class="bc-btn ghost sm" data-mq="del" data-id="${esc(m.id)}">${confirmDel===m.id?'Zeker verwijderen?':'Verwijderen'}</button></div></article>`).join(''):'';
  g.innerHTML=`<div class="mq-gal"><div class="mq-intro"><p class="muted">Jouw creatieve ruimte: ontwerp hier wedding maquettes voor je koppels, met foto’s, kleuren, tekst en afvinklijsten. Alleen zichtbaar voor de owner.</p>${creating?'':'<button type="button" class="bc-btn" data-mq="new">+ Nieuwe maquette</button>'}</div>
${galleryErr?`<p class="small" style="color:#f3b2a8">Laden lukt niet: ${esc(galleryErr)}${/maquettes|relation|schema/i.test(galleryErr)?' — is het SQL-bestand voor het atelier al uitgevoerd?':''}</p>`:''}
${form}${list===null?'<p class="small muted">Maquettes laden…</p>':list.length?`<div class="mq-cards">${cards}</div>`:(creating?'':'<section class="bc-card"><p class="muted">Nog geen maquettes. Start met “Nieuwe maquette”; het volledige Wedding Book-sjabloon staat dan meteen klaar.</p></section>')}</div>`;
  hydrate(g);
  if(!g.dataset.bound){g.dataset.bound='1';
    g.addEventListener('click',async ev=>{
      const b=ev.target.closest('[data-mq]');if(!b)return;const a=b.dataset.mq;
      if(a==='new'){creating=true;renderGallery();const i=g.querySelector('input[name=title]');if(i)i.focus();}
      if(a==='cancel'){creating=false;renderGallery();}
      if(a==='open')openEditor(b.dataset.id);
      if(a==='del'){const id=b.dataset.id;if(confirmDel!==id){confirmDel=id;renderGallery();setTimeout(()=>{if(confirmDel===id){confirmDel=null;renderGallery();}},4000);return;}confirmDel=null;try{await store().remove(id);toast('Maquette verwijderd');}catch(e){toast('Verwijderen lukt niet: '+(e.message||e));}loadGallery();}
    });
    g.addEventListener('submit',async ev=>{
      if(ev.target.dataset.mq!=='create')return;ev.preventDefault();
      if(!host.owner()){toast('Alleen voor de owner');return;}
      const f=new FormData(ev.target),get=k=>String(f.get(k)||'').trim().slice(0,140);
      const pages=(f.get('start')==='blank'?['cover','blank']:BOOK).map(makePage);
      const btn=ev.target.querySelector('[type=submit]');btn.disabled=true;
      try{const row=await store().create({title:get('title')||'Maquette',couple:get('couple'),wedding_date:/^\d{4}-\d{2}-\d{2}$/.test(get('date'))?get('date'):null,place:get('place'),data:{v:VER,pages}});creating=false;await loadGallery();openEditor(row.id);}
      catch(e){btn.disabled=false;toast('Aanmaken lukt niet: '+(e.message||e));}
    });
  }
}
function normPage(p){return {bg:p&&p.bg||CREAM,els:(p&&Array.isArray(p.els)?p.els:[]).filter(e=>e&&e.type)};}

window.BCMaquette={gallery,open:openEditor,_templates:TEMPLATES};
})();
