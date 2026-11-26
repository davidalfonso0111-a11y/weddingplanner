/* Belles Creators · Atelier: teamdashboard per afdeling (owner, planner, styliste, decoratie, catering).
   Frontend-demo: de logins en PIN-codes leven alleen in de browser (localStorage) en zijn GEEN echte beveiliging.
   Voor echte accounts is een server met authenticatie nodig. */
(function(){
'use strict';

const SESSION_KEY='bc_atelier_session';
/* Cloud mode (Supabase) when assets/config.js is filled in; otherwise the local demo. */
const CLOUD=window.BCCloud&&window.BCCloud.enabled?window.BCCloud:null;
const ROLE_INFO={
  owner:{label:'Owner',dept:null,home:'o_home',blurb:'Alles in één oogopslag'},
  admin:{label:'Admin',dept:null,home:'o_home',blurb:'Alles in één oogopslag'},
  planner:{label:'Wedding planner',dept:'Planning',home:'p_home',blurb:'Draaiboek, taken & leveranciers'},
  stylist:{label:'Styliste',dept:'Styling',home:'s_home',blurb:'Afspraken & moodboards'},
  decoration:{label:'Decoratie',dept:'Decoratie',home:'d_home',blurb:'Opbouw & inventaris'},
  catering:{label:'Catering',dept:'Catering',home:'c_home',blurb:"Menu's, dieetwensen & proeverijen"}
};
/* Owner and admin both have full access; only the owner is greeted as Belle. */
const isFull=r=>r==='owner'||r==='admin';
const DEPTS=['Planning','Styling','Decoratie','Catering'];
const DEPT_ROLE={Planning:'planner',Styling:'stylist',Decoratie:'decoration',Catering:'catering'};
const DEPT_HOME={Planning:'p_home',Styling:'s_home',Decoratie:'d_home',Catering:'c_home'};
const ACCESS_AREAS=[['weddings','Weddings'],['leads','Leads & klanten'],['calendar','Kalender'],['vendors','Leveranciers']];
const APPT_TYPES=['Pasbeurt','Moodboard','Locatiebezoek','Haar & make-up','Bloemen'];
const SERVICE={seated:'Diner aan tafel',walking:'Walking dinner',buffet:'Buffet'};
const DIETS=[['vegetarisch','Vegetarisch'],['vegan','Vegan'],['halal','Halal'],['glutenvrij','Glutenvrij'],['allergie','Allergieën']];
const PRIO={urgent:'Urgent',high:'Hoog',medium:'Normaal',low:'Laag'};

const I={
  home:'<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  heart:'<path d="M12 21s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 5.5-7 10-7 10z"/>',
  clip:'<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1M9 10h6M9 14h6M9 18h3"/>',
  sparkle:'<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z"/>',
  flower:'<path d="M12 3c2 3 2 6 0 9-2-3-2-6 0-9zM12 12c3-1 6 0 8 2-3 1-6 0-8-2zM12 12c-3-1-6 0-8 2 3 1 6 0 8-2zM12 12v9"/>',
  dish:'<path d="M3 17h18M5 17a7 7 0 0 1 14 0M12 8V6M10 6h4M4 20h16"/>',
  user:'<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>',
  euro:'<path d="M17 6a7 7 0 1 0 0 12M4 10h9M4 14h9"/>',
  key:'<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M17 6l3 3M15 8l2 2"/>',
  folder:'<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  file:'<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>',
  down:'<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
  eye:'<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  check:'<path d="M4 12l5 5L20 6"/>',
  cal:'<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  box:'<path d="M3 7l9-4 9 4v10l-9 4-9-4zM3 7l9 4 9-4M12 11v10"/>',
  truck:'<path d="M3 7h11v9H3zM14 10h4l3 3v3h-7M7 19a2 2 0 1 0 0-.1M17 19a2 2 0 1 0 0-.1"/>',
  palette:'<path d="M12 3a9 9 0 1 0 0 18c1 0 1.5-.8 1.5-1.6 0-1.2-1-1.4-1-2.4 0-1 .8-1.5 1.8-1.5H17a4 4 0 0 0 4-4C21 6.6 17 3 12 3z"/><circle cx="7.5" cy="11" r="1"/><circle cx="10" cy="7.5" r="1"/><circle cx="14.5" cy="7.5" r="1"/>',
  spoon:'<path d="M8 3c2 0 3 2 3 4.5S10 11 8 11 5 10 5 7.5 6 3 8 3zM8 11v10M16 3v18M14 3v5a2 2 0 0 0 4 0V3"/>',
  more:'<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',
  out:'<path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  left:'<path d="M15 5l-7 7 7 7"/>',
  right:'<path d="M9 5l7 7-7 7"/>',
  x:'<path d="M6 6l12 12M18 6L6 18"/>',
  globe:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>'
};
const ic=(n,s=18)=>`<svg aria-hidden="true" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${I[n]||''}</svg>`;

const cs={phase:'boot',err:'',busy:false,pin:'',pin1:'',msg:''};
const st={page:null,detail:null,tab:'overzicht',wid:null,day:null,weekOffset:0,filter:'open',dept:'Alle',apptType:'Alle',sheet:false,login:null,pin:'',pinErr:false};

/* ---------- helpers ---------- */
const pad=n=>String(n).padStart(2,'0');
const iso=d=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
const todayIso=()=>iso(new Date());
const safeId=v=>String(v??'').replace(/[^A-Za-z0-9_-]/g,'');
const uid=p=>p+Date.now().toString(36)+Math.random().toString(36).slice(2,7);
function me(){if(CLOUD){const p=CLOUD.profile;if(!p||cs.phase!=='ready'||!CLOUD.isUnlocked())return null;return DB.accounts.find(a=>a.id===p.id)||{id:p.id,name:p.name,role:p.role,active:true,email:p.email};}let id=null;try{id=localStorage.getItem(SESSION_KEY);}catch(e){}return DB.accounts.find(a=>a.id===id&&a.active)||null;}
function isOwner(){const m=me();return !!m&&isFull(m.role);}
function has(area){const m=me();if(!m)return false;if(isFull(m.role))return true;return !!(DB.access[m.role]||{})[area];}
function wed(id){return DB.weddings.find(w=>w.id===id);}
function wName(id){return wed(id)?.couple||'—';}
function upcoming(){return [...DB.weddings].filter(w=>w.date).sort((a,b)=>a.date.localeCompare(b.date));}
function nextWedding(){const t=todayIso();return upcoming().find(w=>w.date>=t)||upcoming()[0];}
function short(d){if(!d)return {d:'—',m:''};const x=new Date(d+'T12:00:00');return {d:pad(x.getDate()),m:x.toLocaleDateString('nl-BE',{month:'short'}).replace('.','')};}
function longDate(d){const x=new Date(d+'T12:00:00');return x.toLocaleDateString('nl-BE',{weekday:'long',day:'numeric',month:'long',year:'numeric'});}
function greet(){const h=new Date().getHours();return h<12?'Goedemorgen,':h<18?'Goedemiddag,':'Goedenavond,';}
function firstName(){const m=me();return m?(m.role==='owner'?'Belle':m.name.split(' ')[0]):'';}
function initials(n){return String(n||'?').split(/\s+/).map(x=>x[0]||'').join('').slice(0,2).toUpperCase();}
function log(what,w){const m=me();DB.log.unshift({t:new Date().toISOString(),who:m?m.name:'—',what,w:w?wName(w):'—'});if(DB.log.length>300)DB.log.length=300;}
function commit(what,w){if(what)log(what,w);save();render();}
function pct(a,b){return b?Math.round(a/b*100):0;}
function tasks(dept){prepare();return DB.tasks.filter(t=>!dept||dept==='Alle'||t.dept===dept);}
function openTasks(dept){return tasks(dept).filter(t=>t.status!=='completed');}
function decorOf(w){let d=DB.decor.find(x=>x.wedding===w);if(!d){d={wedding:w,setup:'09:00',teardown:'01:00',items:[]};DB.decor.push(d);}return d;}
function cateringOf(w){let c=DB.catering.find(x=>x.wedding===w);if(!c){c={wedding:w,style:'seated',staff:6,kids:0,tasting:'',tastingOk:false,diets:{vegetarisch:0,vegan:0,halal:0,glutenvrij:0,allergie:0},courses:[]};DB.catering.push(c);}return c;}
function boardOf(w){let b=DB.styleBoards.find(x=>x.wedding===w);if(!b){b={wedding:w,theme:'Nog te kiezen',colors:['#fbe9c6','#d8ae6a','#4c2f1e','#25090b']};DB.styleBoards.push(b);}return b;}

/* Merge department tasks into the shared task list once (keeps one source of truth). */
function prepare(){
  if(Array.isArray(DB.deptTasks)&&DB.deptTasks.length){
    for(const t of DB.deptTasks){if(!DB.tasks.some(x=>x.id===t.id))DB.tasks.push({assignee:assigneeFor(t.dept),client:false,...t});}
    DB.deptTasks=[];save();
  }
  for(const t of DB.tasks){if(t.dept==='Finance')t.dept='Planning';}
}
function assigneeFor(dept){const r=DEPT_ROLE[dept];const a=DB.accounts.find(x=>x.role===r&&x.active);return a?a.name.split(' ')[0]:'Team';}

/* Department progress for the owner overview. */
function deptProgress(dept){
  const ts=tasks(dept);let done=ts.filter(t=>t.status==='completed').length,total=ts.length;
  if(dept==='Planning'){done+=DB.milestones.filter(m=>m.done).length;total+=DB.milestones.length;}
  if(dept==='Styling'){done+=DB.appointments.filter(a=>a.done).length+DB.approvals.filter(a=>a.status==='approved').length;total+=DB.appointments.length+DB.approvals.length;}
  if(dept==='Decoratie'){for(const d of DB.decor){done+=d.items.filter(i=>i.done).length;total+=d.items.length;}}
  if(dept==='Catering'){done+=DB.catering.filter(c=>c.tastingOk).length;total+=DB.catering.length;}
  return pct(done,total);
}

/* ---------- UI atoms ---------- */
function sw(on,handler,label){return `<label class="bc-switch"><input type="checkbox" ${on?'checked':''} onchange="${handler}" aria-label="${esc(label)}"><span></span></label>`;}
function chk(on,handler,label){return `<input type="checkbox" class="bc-check" ${on?'checked':''} onchange="${handler}" aria-label="${esc(label)}">`;}
function rng(label,val,min,max,step,handler,suffix=''){const p=pct(val-min,max-min);return `<label class="bc-range"><span class="top"><span class="small muted">${esc(label)}</span><span><span class="val">${esc(val)}</span> <span class="small muted">${esc(suffix)}</span></span></span><input type="range" min="${min}" max="${max}" step="${step}" value="${esc(val)}" style="--p:${p}%" aria-label="${esc(label)}" oninput="BC.rangeLive(this)" onchange="${handler}"></label>`;}
function stepper(val,dec,inc,label){return `<span class="bc-step" role="group" aria-label="${esc(label)}"><button type="button" onclick="${dec}" aria-label="${esc(label)} min">−</button><b>${esc(val)}</b><button type="button" onclick="${inc}" aria-label="${esc(label)} plus">+</button></span>`;}
function seg(options,current,handlerFn){return `<div class="bc-seg" role="group">${options.map(([k,l])=>`<button type="button" class="${k===current?'on':''}" aria-pressed="${k===current}" onclick="${handlerFn}('${safeId(k)}')">${esc(l)}</button>`).join('')}</div>`;}
function chips(options,current,handlerFn){return `<div class="bc-chips">${options.map(([k,l])=>`<button type="button" class="${k===current?'on':''}" aria-pressed="${k===current}" onclick="${handlerFn}('${safeId(k)}')">${esc(l)}</button>`).join('')}</div>`;}
function ring(p,label){return `<div class="bc-ring" style="--p:${p}" role="img" aria-label="${esc(label)} ${p}%"><b>${p}%</b></div>`;}
function bar(p){return `<div class="bc-bar"><i style="width:${Math.max(0,Math.min(100,p))}%"></i></div>`;}
function prioPill(p){return `<span class="bc-pill ${p==='urgent'?'gold':p==='high'?'':'line'}">${esc(PRIO[p]||p)}</span>`;}
function weddingChips(handler='BC.pickW'){const ws=upcoming();if(!st.wid||!wed(st.wid))st.wid=(nextWedding()||{}).id;return chips(ws.map(w=>[w.id,w.couple.split(' ')[0]+(w.couple.includes('&')?' & '+w.couple.split('&')[1].trim().split(' ')[0]:'')]),st.wid,handler);}
function empty(t){return `<p class="small muted" style="padding:10px 0">${esc(t)}</p>`;}
function card(title,body,extra='',cls=''){return `<section class="bc-card ${cls}"><div class="head"><h2>${title}</h2>${extra}</div>${body}</section>`;}
function top(title,actions=''){return `<header class="bc-top"><div class="hello"><span class="script">${esc(greet())}</span><h1>${title}</h1></div><div class="bc-actions">${actions}</div></header>`;}
function taskRow(t,showWedding=true){const done=t.status==='completed';return `<div class="bc-row ${done?'done':''}">${chk(done,`BC.toggleTask('${safeId(t.id)}')`,t.title)}<div class="grow"><span class="t">${esc(t.title)}</span><span class="s">${showWedding?esc(wName(t.wedding))+' · ':''}${esc(t.assignee||'')} · ${fdate(t.deadline)}</span></div>${done?'<span class="bc-pill ok">Klaar</span>':prioPill(t.priority)}</div>`;}

/* ---------- navigation ---------- */
function navFor(){
  const m=me();if(!m)return [];
  const r=m.role,N=[];
  if(isFull(r)){N.push(['o_home','Overzicht','home'],['weddings','Weddings','heart'],['tasks','Taken','check'],['grp','Afdelingen'],['p_home','Planning','clip'],['s_home','Styling','sparkle'],['d_home','Decoratie','flower'],['c_home','Catering','dish'],['grp','Beheer'],['leads','Leads & klanten','user'],['finance','Financiën','euro'],['calendar','Kalender','cal'],['vendors','Leveranciers','truck'],['docs','Documenten','folder'],['maquette','Atelier','palette'],['team','Team & toegang','key'],['activity','Activiteit','clock']);return N;}
  if(r==='planner')N.push(['p_home','Vandaag','home']);
  if(r==='stylist')N.push(['s_home','Mijn planning','cal'],['s_props','Moodboards','palette']);
  if(r==='decoration')N.push(['d_home','Opbouw','flower'],['d_inv','Inventaris','box']);
  if(r==='catering')N.push(['c_home',"Menu's & gasten",'dish'],['c_tast','Proeverijen','spoon']);
  N.push(['tasks','Taken','check']);
  if(has('weddings'))N.push(['weddings','Weddings','heart']);
  if(has('calendar')&&r!=='stylist')N.push(['calendar','Kalender','cal']);
  if(has('calendar')&&r==='stylist')N.push(['calendar','Kalender','clock']);
  if(has('leads'))N.push(['leads','Leads & klanten','user']);
  if(has('vendors'))N.push(['vendors','Leveranciers','truck']);
  return N;
}
function allowed(page){const m=me();if(!m)return false;if(isFull(m.role))return true;if(page==='wedding')return has('weddings');return navFor().some(n=>n[0]===page);}

function shell(content){
  const m=me(),nav=navFor(),items=nav.filter(n=>n[0]!=='grp');
  const navHtml=nav.map(n=>n[0]==='grp'?`<div class="grp">${esc(n[1]).toUpperCase()}</div>`:`<button type="button" class="${st.page===n[0]||(st.page==='wedding'&&n[0]==='weddings')?'on':''}" onclick="BC.go('${n[0]}')">${ic(n[2])}<span>${esc(n[1])}</span></button>`).join('');
  const tabs=items.slice(0,4);
  const tabbar=`<nav class="bc-tabbar" aria-label="Snelmenu">${tabs.map(n=>`<button type="button" class="${st.page===n[0]||(st.page==='wedding'&&n[0]==='weddings')?'on':''}" onclick="BC.go('${n[0]}')">${ic(n[2],22)}<span>${esc(n[1].split(' ')[0])}</span></button>`).join('')}<button type="button" class="${st.sheet?'on':''}" onclick="BC.sheet(true)">${ic('more',22)}<span>Meer</span></button></nav>`;
  const sheet=st.sheet?`<div class="bc-sheet" onclick="if(event.target===this)BC.sheet(false)"><div class="in"><div class="grab"></div><div class="bc-nav">${navHtml}<div class="grp">ACCOUNT</div><button type="button" onclick="BC.logout()">${ic('out')}<span>Afmelden</span></button></div></div></div>`:'';
  return `<div class="bc"><div class="bc-shell">
<aside class="bc-side"><div class="bc-brand"><img src="./assets/img/monogram.png" alt="BC · Created once. Remembered forever."></div><nav class="bc-nav" aria-label="Hoofdmenu">${navHtml}</nav>
<div class="bc-me"><div class="bc-avatar" data-no-translate>${esc(initials(m.name))}</div><div class="grow" style="flex:1;min-width:0;display:flex;flex-direction:column"><span style="font-weight:500;font-size:14px" data-no-translate>${esc(m.name)}</span><span class="small muted">${esc(ROLE_INFO[m.role].label)}</span></div><button type="button" class="bc-icon sm" onclick="BC.logout()" aria-label="Afmelden" title="Afmelden">${ic('out',16)}</button></div></aside>
<main class="bc-main"><div class="bc-mtop"><img src="./assets/img/monogram-mark.png" alt="Belles Creators"><div style="display:flex;align-items:center;gap:10px"><span class="small muted">${esc(ROLE_INFO[m.role].label)}</span><button type="button" class="bc-avatar" style="border:0" onclick="BC.sheet(true)" aria-label="Menu en account">${esc(initials(m.name))}</button></div></div>${content}</main>
</div>${tabbar}${sheet}</div>`;
}

/* ---------- login ---------- */
function loginView(){
  if(CLOUD)return cloudLoginView();
  if(window.BC_SUPABASE&&window.BC_SUPABASE.url)return `<div class="bc"><div class="bc-login"><div class="box"><img class="logo" src="./assets/img/monogram.png" alt="BC · Created once. Remembered forever."><h1 style="font-size:34px">Even geen verbinding</h1><p class="muted">De beveiligde server is niet bereikbaar. Controleer je internet en probeer opnieuw.</p><button type="button" class="bc-btn" onclick="location.reload()">Opnieuw proberen</button></div></div></div>`;
  const accs=DB.accounts.filter(a=>a.active);
  if(!st.login){
    return `<div class="bc"><div class="bc-login"><div class="box">
<img class="logo" src="./assets/img/monogram.png" alt="BC · Created once. Remembered forever.">
<div><span class="script" style="font-size:34px">Bienvenue</span><h1 style="font-size:40px">Welkom in het atelier</h1><p class="muted" style="margin-top:6px">Kies je account om aan te melden.</p></div>
<div class="bc-roles">${accs.map(a=>`<button type="button" onclick="BC.pickAccount('${safeId(a.id)}')"><span class="bc-avatar" data-no-translate>${esc(initials(a.name))}</span><b data-no-translate>${esc(a.name)}</b><span>${esc(ROLE_INFO[a.role]?.label||a.role)}</span></button>`).join('')}</div>
<p class="small muted" style="max-width:420px">Alleen voor het Belles Creators-team. Demo-login: werkt alleen op dit toestel en is nog geen echte beveiliging.</p>
<div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center"><button type="button" class="bc-btn ghost sm" onclick="resetDemo()">Demodata herstellen</button></div>
</div></div></div>`;
  }
  const a=DB.accounts.find(x=>x.id===st.login);
  const dots=[0,1,2,3].map(i=>`<i class="${i<st.pin.length?'on':''}"></i>`).join('');
  const keys=['1','2','3','4','5','6','7','8','9'].map(k=>`<button type="button" onclick="BC.key('${k}')">${k}</button>`).join('');
  return `<div class="bc"><div class="bc-login"><div class="box">
<img src="./assets/img/monogram-mark.png" alt="Belles Creators" style="width:150px;height:auto">
<div><span class="bc-avatar" style="margin:0 auto 10px;width:58px;height:58px;font-size:18px" data-no-translate>${esc(initials(a?.name))}</span><h1 style="font-size:34px" data-no-translate>${esc(a?.name||'')}</h1><p class="muted">${esc(ROLE_INFO[a?.role]?.label||'')} · voer je PIN in</p></div>
<div class="bc-dots ${st.pinErr?'err':''}" aria-live="polite" aria-label="${st.pin.length} van 4 cijfers">${dots}</div>
${st.pinErr?'<p class="small" style="color:#f1d6a0">Onjuiste PIN, probeer opnieuw.</p>':''}
<div class="bc-pad">${keys}<button type="button" class="txt" onclick="BC.pickAccount('')">Terug</button><button type="button" onclick="BC.key('0')">0</button><button type="button" class="txt" onclick="BC.key('del')" aria-label="Wissen">${ic('left',22)}</button></div>
</div></div></div>`;
}

/* ---------- week strip ---------- */
function weekStrip(marks){
  const base=new Date();base.setHours(12,0,0,0);const dow=(base.getDay()+6)%7;base.setDate(base.getDate()-dow+st.weekOffset*7);
  if(!st.day)st.day=todayIso();
  const days=[...Array(7)].map((_,i)=>{const d=new Date(base);d.setDate(base.getDate()+i);return d;});
  const label=days[0].toLocaleDateString('nl-BE',{day:'numeric',month:'short'})+' – '+days[6].toLocaleDateString('nl-BE',{day:'numeric',month:'short'});
  return `<div style="display:flex;flex-direction:column;gap:10px;max-width:560px"><div style="display:flex;justify-content:space-between;align-items:center"><span class="small muted">${esc(label)}</span><span style="display:flex;gap:6px"><button type="button" class="bc-icon sm" onclick="BC.week(-1)" aria-label="Vorige week">${ic('left',16)}</button><button type="button" class="bc-icon sm" onclick="BC.week(1)" aria-label="Volgende week">${ic('right',16)}</button></span></div>
<div class="bc-week">${days.map(d=>{const k=iso(d);return `<button type="button" class="${k===st.day?'on':''} ${marks.has(k)?'has':''}" onclick="BC.pickDay('${k}')" aria-label="${esc(longDate(k))}"><span>${d.toLocaleDateString('nl-BE',{weekday:'short'}).replace('.','').slice(0,2).toUpperCase()}</span><b>${d.getDate()}</b></button>`;}).join('')}</div></div>`;
}

/* ---------- section renderers per wedding ---------- */
function planningSection(w){
  const ms=DB.milestones.filter(m=>m.wedding===w.id),rs=DB.runsheet.filter(r=>r.wedding===w.id).sort((a,b)=>a.time.localeCompare(b.time)),bk=DB.bookings.filter(b=>b.wedding===w.id);
  const msHtml=ms.map(m=>`<div class="bc-row ${m.done?'done':''}"><div class="grow"><span class="t">${esc(m.label)}</span></div>${sw(m.done,`BC.toggleMs('${safeId(m.id)}')`,m.label)}</div>`).join('')||empty('Nog geen mijlpalen.');
  const rsHtml=rs.map(r=>`<div class="bc-row"><div class="bc-date"><b style="font-size:20px">${esc(r.time)}</b></div><div class="grow"><span class="t">${esc(r.title)}</span></div><button type="button" class="bc-icon sm" onclick="BC.delRun('${safeId(r.id)}')" aria-label="Verwijder ${esc(r.title)}">${ic('x',14)}</button></div>`).join('')||empty('Het draaiboek is nog leeg.');
  const bkHtml=bk.map(b=>{const v=DB.vendors.find(x=>x.id===b.vendor);return `<div class="bc-row"><div class="grow"><span class="t">${esc(v?.name||'Leverancier')}</span><span class="s">${esc(v?.category||'')}</span></div><span class="small muted">${b.booked?'Geboekt':'Open'}</span>${sw(b.booked,`BC.toggleBooking('${safeId(b.id)}')`,'Geboekt')}</div>`;}).join('')||empty('Nog geen leveranciers gekoppeld.');
  const done=ms.filter(m=>m.done).length;
  return `<div class="bc-grid wide">
${card('Mijlpalen',`<div style="display:flex;gap:16px;align-items:center">${ring(pct(done,ms.length),'Mijlpalen')}<p class="small muted">${done} van ${ms.length} afgerond. Zet een schakelaar om zodra een stap klaar is.</p></div><div class="bc-list">${msHtml}</div>`)}
${card('Draaiboek trouwdag',`<div class="bc-list">${rsHtml}</div><form class="bc-inline" onsubmit="BC.addRun(event,'${safeId(w.id)}')"><input type="time" name="time" required aria-label="Tijd" style="max-width:130px"><input name="title" required maxlength="80" placeholder="Bv. Openingsdans" aria-label="Onderdeel"><button class="bc-btn sm" type="submit">${ic('plus',16)}Toevoegen</button></form>`)}
${card('Gasten & leveranciers',`${rng('Aantal gasten',w.guests||0,0,400,5,`BC.setGuests('${safeId(w.id)}',this.value)`,'gasten')}<div class="bc-list">${bkHtml}</div><button type="button" class="bc-btn ghost sm" onclick="BC.addBookingModal('${safeId(w.id)}')">${ic('plus',16)}Leverancier koppelen</button>`)}
</div>`;
}
function stylingSection(w){
  const b=boardOf(w.id),ap=DB.appointments.filter(a=>a.wedding===w.id).sort((x,y)=>(x.date+x.time).localeCompare(y.date+y.time)),pr=DB.approvals.filter(a=>a.wedding===w.id);
  const sw8=b.colors.map((c,i)=>`<label class="bc-swatch" style="background:${esc(c)};position:relative;cursor:pointer" title="Kleur ${i+1} aanpassen"><input type="color" value="${esc(c)}" onchange="BC.setColor('${safeId(w.id)}',${i},this.value)" aria-label="Kleur ${i+1}" style="position:absolute;inset:0;opacity:0;cursor:pointer;width:100%;height:100%"></label>`).join('');
  const prHtml=pr.map(p=>`<div class="bc-row" style="flex-wrap:wrap"><div class="grow" style="flex-basis:180px"><span class="t">${esc(p.title)}</span><span class="s">${esc(STATUS[p.status]||p.status)}</span></div>${seg([['pending','Afwachten'],['approved','Goedgekeurd'],['changes_requested','Wijzigen']],p.status,`BC.propStatus.bind(null,'${safeId(p.id)}')`)}</div>`).join('')||empty('Nog geen voorstellen.');
  const apHtml=ap.map(apptRow).join('')||empty('Geen afspraken gepland.');
  return `<div class="bc-grid wide">
${card('Stijl & kleuren',`<p class="script" style="font-size:30px;line-height:1">${esc(b.theme)}</p><div class="bc-swatches">${sw8}</div><p class="small muted">Tik op een kleur om ze aan te passen.</p><form class="bc-inline" onsubmit="BC.setTheme(event,'${safeId(w.id)}')"><input name="theme" maxlength="60" placeholder="Nieuw thema" aria-label="Thema"><button class="bc-btn sm" type="submit">Opslaan</button></form>`,'','rich')}
${card('Voorstellen aan het koppel',`<div class="bc-list">${prHtml}</div><form class="bc-inline" onsubmit="BC.addProp(event,'${safeId(w.id)}')"><input name="title" required maxlength="80" placeholder="Bv. Bloemen ceremonie" aria-label="Nieuw voorstel"><button class="bc-btn sm" type="submit">${ic('plus',16)}Voorstel</button></form>`)}
${card('Afspraken',`<div class="bc-list">${apHtml}</div><button type="button" class="bc-btn ghost sm" onclick="BC.apptModal('${safeId(w.id)}')">${ic('plus',16)}Afspraak inplannen</button>`)}
</div>`;
}
function apptRow(a){const s=short(a.date);return `<div class="bc-row ${a.done?'done':''}"><div class="bc-date"><b>${s.d}</b><span>${esc(s.m)}</span></div><div class="grow"><span class="t">${esc(a.title)}</span><span class="s">${esc(a.time)} · ${esc(a.type)} · ${esc(a.place||'')} · ${esc(wName(a.wedding))}</span></div>${chk(a.done,`BC.toggleAppt('${safeId(a.id)}')`,'Afspraak afgerond')}</div>`;}
function decorSection(w){
  const d=decorOf(w.id),done=d.items.filter(i=>i.done).length;
  const items=d.items.map(i=>`<div class="bc-row ${i.done?'done':''}"><div class="grow"><span class="t">${esc(i.label)}</span></div>${sw(i.done,`BC.toggleDecor('${safeId(w.id)}','${safeId(i.id)}')`,i.label)}</div>`).join('')||empty('Nog niets op de opbouwlijst.');
  return `<div class="bc-grid wide">
${card('Opbouwlijst',`<div style="display:flex;gap:16px;align-items:center">${ring(pct(done,d.items.length),'Opbouw')}<div><p class="t">${done} van ${d.items.length} klaar</p><p class="small muted">${esc(w.venue)} · ${fdate(w.date)}</p></div></div><div class="bc-list">${items}</div><form class="bc-inline" onsubmit="BC.addDecor(event,'${safeId(w.id)}')"><input name="label" required maxlength="80" placeholder="Bv. Kaarsen op de trap" aria-label="Nieuw onderdeel"><button class="bc-btn sm" type="submit">${ic('plus',16)}Toevoegen</button></form>`)}
${card('Timing op de dag',`<div class="bc-inline"><label class="bc-field"><span>Opbouw vanaf</span><input type="time" value="${esc(d.setup)}" onchange="BC.setDecorTime('${safeId(w.id)}','setup',this.value)"></label><label class="bc-field"><span>Afbouw om</span><input type="time" value="${esc(d.teardown)}" onchange="BC.setDecorTime('${safeId(w.id)}','teardown',this.value)"></label></div><p class="small muted">Het draaiboek van de planner:</p><div class="bc-list">${DB.runsheet.filter(r=>r.wedding===w.id).sort((a,b)=>a.time.localeCompare(b.time)).map(r=>`<div class="bc-row"><div class="bc-date"><b style="font-size:20px">${esc(r.time)}</b></div><div class="grow"><span class="t">${esc(r.title)}</span></div></div>`).join('')||empty('Nog geen draaiboek.')}</div>`)}
</div>`;
}
function cateringSection(w){
  const c=cateringOf(w.id),dietTotal=Object.values(c.diets).reduce((s,n)=>s+n,0);
  const diets=DIETS.map(([k,l])=>`<div class="bc-row"><div class="grow"><span class="t">${esc(l)}</span></div>${stepper(c.diets[k]||0,`BC.diet('${safeId(w.id)}','${k}',-1)`,`BC.diet('${safeId(w.id)}','${k}',1)`,l)}</div>`).join('');
  const courses=c.courses.map(x=>`<div class="bc-row"><div class="grow"><span class="s" style="letter-spacing:.14em;text-transform:uppercase">${esc(x.course)}</span><span class="t">${esc(x.dish)}</span></div><button type="button" class="bc-icon sm" onclick="BC.delCourse('${safeId(w.id)}','${safeId(x.id)}')" aria-label="Verwijder gang">${ic('x',14)}</button></div>`).join('')||empty("Nog geen menu.");
  return `<div class="bc-grid wide">
${card('Service',`${seg(Object.entries(SERVICE),c.style,`BC.service.bind(null,'${safeId(w.id)}')`)}<div class="bc-grid tight"><div class="bc-stat"><span class="v gold">${w.guests||0}</span><span class="l">Volwassenen</span></div><div class="bc-stat"><span class="v gold">${c.kids}</span><span class="l">Kindermenu's</span></div></div>${rng('Bediening',c.staff,1,40,1,`BC.staff('${safeId(w.id)}',this.value)`,'medewerkers')}<div class="bc-row"><div class="grow"><span class="t">Kindermenu's</span></div>${stepper(c.kids,`BC.kids('${safeId(w.id)}',-1)`,`BC.kids('${safeId(w.id)}',1)`,"Kindermenu's")}</div>`,'','rich')}
${card('Dieetwensen',`<p class="small muted">${dietTotal} speciale maaltijden</p><div class="bc-list">${diets}</div>`)}
${card('Menu',`<div class="bc-list">${courses}</div><form class="bc-inline" onsubmit="BC.addCourse(event,'${safeId(w.id)}')"><input name="course" required maxlength="40" placeholder="Gang" aria-label="Gang" style="max-width:150px"><input name="dish" required maxlength="100" placeholder="Gerecht" aria-label="Gerecht"><button class="bc-btn sm" type="submit">${ic('plus',16)}</button></form><div class="bc-row"><div class="grow"><span class="t">Proeverij ${c.tasting?fdate(c.tasting):'nog niet gepland'}</span><span class="s">${c.tastingOk?'Bevestigd door het koppel':'Nog niet bevestigd'}</span></div>${sw(c.tastingOk,`BC.tasting('${safeId(w.id)}')`,'Proeverij bevestigd')}</div>`)}
</div>`;
}
function budgetSection(w){
  const inv=DB.invoices.filter(i=>i.wedding===w.id);
  return `<div class="bc-grid wide">${card('Budget',`<div class="bc-grid tight"><div class="bc-stat"><span class="v gold">${eur(w.budget)}</span><span class="l">Budget</span></div><div class="bc-stat"><span class="v gold">${eur(w.spent)}</span><span class="l">Besteed</span></div></div>${bar(pct(w.spent,w.budget))}${rng('Budget',w.budget||0,0,150000,500,`BC.setBudget('${safeId(w.id)}',this.value)`,'EUR')}`)}
${card('Facturen',`<div class="bc-list">${inv.map(invoiceRow).join('')||empty('Geen facturen voor deze wedding.')}</div>`)}</div>`;
}
function invoiceRow(i){return `<div class="bc-row ${i.status==='paid'?'done':''}"><div class="grow"><span class="t">${esc(i.supplier)} · ${eur(i.total)}</span><span class="s">${esc(i.number)} · vervalt ${fdate(i.due)} · ${esc(wName(i.wedding))}</span></div><span class="small muted">${i.status==='paid'?'Betaald':'Open'}</span>${sw(i.status==='paid',`BC.toggleInvoice('${safeId(i.id)}')`,'Betaald')}</div>`;}

/* ---------- pages ---------- */
const P={};
P.o_home=function(){
  const nw=nextWedding(),open=openTasks(),unpaid=DB.invoices.filter(i=>i.status!=='paid'),newLeads=DB.leads.filter(l=>l.status==='new');
  const soon=iso(new Date(Date.now()+7*864e5)),t=todayIso();
  const attention=[
    ...open.filter(x=>['urgent','high'].includes(x.priority)&&x.deadline<=soon).map(x=>({k:x.deadline,h:`<div class="bc-row"><div class="bc-date"><b>${short(x.deadline).d}</b><span>${esc(short(x.deadline).m)}</span></div><div class="grow"><span class="t">${esc(x.title)}</span><span class="s">${esc(x.dept)} · ${esc(wName(x.wedding))}</span></div>${prioPill(x.priority)}</div>`})),
    ...unpaid.map(i=>({k:i.due,h:`<div class="bc-row"><div class="bc-date"><b>${short(i.due).d}</b><span>${esc(short(i.due).m)}</span></div><div class="grow"><span class="t">Factuur ${esc(i.supplier)}</span><span class="s">${eur(i.total)} · ${i.due<t?'vervallen':'te betalen'}</span></div><span class="bc-pill ${i.due<t?'gold':'line'}">Financiën</span></div>`})),
    ...DB.catering.filter(c=>!c.tastingOk&&c.tasting&&c.tasting<=iso(new Date(Date.now()+14*864e5))).map(c=>({k:c.tasting,h:`<div class="bc-row"><div class="bc-date"><b>${short(c.tasting).d}</b><span>${esc(short(c.tasting).m)}</span></div><div class="grow"><span class="t">Proeverij nog niet bevestigd</span><span class="s">Catering · ${esc(wName(c.wedding))}</span></div><span class="bc-pill line">Catering</span></div>`})),
    ...DB.inventory.filter(i=>i.stock-i.reserved<=1).map(i=>({k:'9999',h:`<div class="bc-row"><div class="bc-date"><b>${i.stock-i.reserved}</b><span>vrij</span></div><div class="grow"><span class="t">${esc(i.name)}</span><span class="s">Decoratie · bijna volledig gereserveerd</span></div><span class="bc-pill line">Voorraad</span></div>`}))
  ].sort((a,b)=>a.k.localeCompare(b.k)).slice(0,8);
  const depts=DEPTS.map(d=>{const p=deptProgress(d),o=openTasks(d).length,acc=DB.accounts.find(a=>a.role===DEPT_ROLE[d]&&a.active);return `<button type="button" class="bc-card" style="text-align:left;border:1px solid var(--bc-line);color:inherit" onclick="BC.go('${DEPT_HOME[d]}')"><div style="display:flex;gap:16px;align-items:center">${ring(p,d)}<div style="display:flex;flex-direction:column;gap:2px"><h3>${esc(d)}</h3><span class="small muted" data-no-translate>${esc(acc?acc.name:'Niemand toegewezen')}</span></div></div><span class="small">${o} open ${o===1?'taak':'taken'}</span></button>`;}).join('');
  return top(`Jouw atelier, <span class="gold" style="font-style:italic">${esc(firstName())}</span>`,`<button type="button" class="bc-btn" onclick="BC.weddingModal()">${ic('plus',16)}Nieuwe wedding</button>`)+
  `<section class="bc-hero"><img class="wm" src="./assets/img/monogram-mark.png" alt="" aria-hidden="true"><span class="eyebrow">Eerstvolgende wedding</span><h2>${esc(nw?.couple||'Geen weddings')}</h2><p>${nw?esc(longDate(nw.date))+' · '+esc(nw.venue)+' · '+nw.guests+' gasten':''}</p><div style="display:flex;gap:10px;flex-wrap:wrap"><span class="bc-pill gold">Nog ${nw?daysUntil(nw.date):0} dagen</span>${nw?`<button type="button" class="bc-btn ghost sm" onclick="BC.openWedding('${safeId(nw.id)}')">Open wedding</button>`:''}</div></section>
<div class="bc-grid tight">
<button type="button" class="bc-stat" onclick="BC.go('weddings')"><span class="v gold">${DB.weddings.length}</span><span class="l">Weddings</span></button>
<button type="button" class="bc-stat" onclick="BC.go('tasks')"><span class="v gold">${open.length}</span><span class="l">Open taken</span></button>
<button type="button" class="bc-stat" onclick="BC.go('leads')"><span class="v gold">${newLeads.length}</span><span class="l">Nieuwe leads</span></button>
<button type="button" class="bc-stat" onclick="BC.go('finance')"><span class="v gold">${eur(unpaid.reduce((s,i)=>s+i.total,0)).replace(/,00$/,'')}</span><span class="l">Openstaande facturen</span></button>
</div>
<div class="bc-grid">${depts}</div>
<div class="bc-grid wide">${card('Aandacht nodig',`<div class="bc-list">${attention.map(a=>a.h).join('')||empty('Alles loopt op schema.')}</div>`)}
${card('Laatste activiteit',`<div class="bc-list">${DB.log.slice(0,6).map(l=>`<div class="bc-row"><div class="grow"><span class="t">${esc(l.what)}</span><span class="s"><span data-no-translate>${esc(l.who)}</span> · ${esc(l.w)}</span></div></div>`).join('')||empty('Nog geen activiteit.')}</div>`,`<button type="button" class="bc-btn ghost sm" onclick="BC.go('activity')">Alles</button>`)}</div>`;
};
P.p_home=function(){
  const nw=nextWedding(),mine=openTasks('Planning'),marks=new Set(mine.map(t=>t.deadline));DB.weddings.forEach(w=>marks.add(w.date));
  const dayTasks=tasks('Planning').filter(t=>t.deadline===st.day),dayW=DB.weddings.filter(w=>w.date===st.day);
  const w=wed(st.wid)||nw;
  return top(`Vandaag, <span class="gold" style="font-style:italic">${esc(firstName())}</span>`,`<button type="button" class="bc-btn" onclick="BC.taskModal('Planning')">${ic('plus',16)}Taak</button>`)+
  `<section class="bc-hero"><img class="wm" src="./assets/img/monogram-mark.png" alt="" aria-hidden="true"><span class="eyebrow">Planning</span><h2>${mine.length} open ${mine.length===1?'taak':'taken'}, <span class="gold" style="font-style:italic">${nw?daysUntil(nw.date):0} dagen</span> tot ${esc(nw?.couple||'')}</h2>${weekStrip(marks)}</section>
<div class="bc-grid wide">${card(esc(longDate(st.day)),`<div class="bc-list">${dayW.map(x=>`<div class="bc-row"><span class="bc-pill gold">Trouwdag</span><div class="grow"><span class="t">${esc(x.couple)}</span><span class="s">${esc(x.venue)}</span></div></div>`).join('')}${dayTasks.map(t=>taskRow(t)).join('')||(dayW.length?'':empty('Niets gepland op deze dag.'))}</div>`)}
${card('Mijn open taken',`<div class="bc-list">${mine.sort((a,b)=>a.deadline.localeCompare(b.deadline)).slice(0,6).map(t=>taskRow(t)).join('')||empty('Alles is afgevinkt.')}</div>`,`<button type="button" class="bc-btn ghost sm" onclick="BC.go('tasks')">Alle taken</button>`)}</div>
<div style="display:flex;flex-direction:column;gap:12px"><span class="eyebrow">Wedding</span>${weddingChips()}</div>${w?planningSection(w):''}`;
};
P.s_home=function(){
  const ap=DB.appointments.filter(a=>st.apptType==='Alle'||a.type===st.apptType).sort((x,y)=>(x.date+x.time).localeCompare(y.date+y.time));
  const marks=new Set(DB.appointments.map(a=>a.date)),day=ap.filter(a=>a.date===st.day),next=ap.filter(a=>!a.done&&a.date>=todayIso());
  return top(`Mijn planning, <span class="gold" style="font-style:italic">${esc(firstName())}</span>`,`<button type="button" class="bc-btn" onclick="BC.apptModal('')">${ic('plus',16)}Afspraak</button>`)+
  `<section class="bc-hero"><img class="wm" src="./assets/img/monogram-mark.png" alt="" aria-hidden="true"><span class="eyebrow">Styling</span><h2>${next.length} komende ${next.length===1?'afspraak':'afspraken'}</h2>${weekStrip(marks)}</section>
${chips([['Alle','Alle'],...APPT_TYPES.map(t=>[t,t])],st.apptType,'BC.apptType')}
<div class="bc-grid wide">${card(esc(longDate(st.day)),`<div class="bc-list">${day.map(apptRow).join('')||empty('Geen afspraken op deze dag.')}</div>`)}
${card('Komende afspraken',`<div class="bc-list">${next.slice(0,8).map(apptRow).join('')||empty('Geen komende afspraken.')}</div>`)}
${card('Mijn taken',`<div class="bc-list">${openTasks('Styling').map(t=>taskRow(t)).join('')||empty('Geen open taken.')}</div>`,`<button type="button" class="bc-btn ghost sm" onclick="BC.taskModal('Styling')">${ic('plus',16)}Taak</button>`)}</div>`;
};
P.s_props=function(){const w=wed(st.wid)||nextWedding();return top('Moodboards & <span class="gold" style="font-style:italic">voorstellen</span>')+`${weddingChips()}${w?stylingSection(w):''}`;};
P.d_home=function(){
  const w=wed(st.wid)||nextWedding();
  const list=upcoming().map(x=>{const d=decorOf(x.id),p=pct(d.items.filter(i=>i.done).length,d.items.length);return `<div class="bc-row"><div class="bc-date"><b>${short(x.date).d}</b><span>${esc(short(x.date).m)}</span></div><div class="grow"><span class="t">${esc(x.couple)}</span><span class="s">Opbouw ${esc(d.setup)} · afbouw ${esc(d.teardown)}</span>${bar(p)}</div><span class="small" style="color:var(--bc-gold-hi)">${p}%</span></div>`;}).join('');
  return top(`Opbouw, <span class="gold" style="font-style:italic">${esc(firstName())}</span>`,`<button type="button" class="bc-btn ghost" onclick="BC.go('d_inv')">${ic('box',16)}Inventaris</button><button type="button" class="bc-btn" onclick="BC.taskModal('Decoratie')">${ic('plus',16)}Taak</button>`)+
  `<div class="bc-grid wide">${card('Komende opbouw',`<div class="bc-list">${list}</div>`,'','rich')}${card('Mijn taken',`<div class="bc-list">${openTasks('Decoratie').map(t=>taskRow(t)).join('')||empty('Geen open taken.')}</div>`)}</div>
<div style="display:flex;flex-direction:column;gap:12px"><span class="eyebrow">Wedding</span>${weddingChips()}</div>${w?decorSection(w):''}`;
};
P.d_inv=function(){
  const rows=DB.inventory.map(i=>{const free=i.stock-i.reserved;return `<section class="bc-card"><div class="head"><h3>${esc(i.name)}</h3><span class="bc-pill ${free<=1?'gold':'line'}">${free} ${esc(i.unit)} vrij</span></div>${rng('Gereserveerd',i.reserved,0,i.stock,1,`BC.reserve('${safeId(i.id)}',this.value)`,'van '+i.stock)}<div class="bc-row"><div class="grow"><span class="t">Voorraad</span></div>${stepper(i.stock,`BC.stock('${safeId(i.id)}',-1)`,`BC.stock('${safeId(i.id)}',1)`,'Voorraad '+i.name)}</div></section>`;}).join('');
  return top('Inventaris',`<button type="button" class="bc-btn" onclick="BC.invModal()">${ic('plus',16)}Artikel</button>`)+`<div class="bc-grid">${rows||empty('Nog geen artikels.')}</div>`;
};
P.c_home=function(){
  const w=wed(st.wid)||nextWedding(),tot=DB.catering.reduce((s,c)=>s+(wed(c.wedding)?.guests||0)+c.kids,0);
  return top(`Menu's & gasten, <span class="gold" style="font-style:italic">${esc(firstName())}</span>`,`<button type="button" class="bc-btn ghost" onclick="BC.go('c_tast')">${ic('spoon',16)}Proeverijen</button><button type="button" class="bc-btn" onclick="BC.taskModal('Catering')">${ic('plus',16)}Taak</button>`)+
  `<div class="bc-grid tight"><div class="bc-stat"><span class="v gold">${tot}</span><span class="l">Couverts gepland</span></div><div class="bc-stat"><span class="v gold">${DB.catering.filter(c=>!c.tastingOk).length}</span><span class="l">Proeverijen te bevestigen</span></div><div class="bc-stat"><span class="v gold">${openTasks('Catering').length}</span><span class="l">Open taken</span></div></div>
<div style="display:flex;flex-direction:column;gap:12px"><span class="eyebrow">Wedding</span>${weddingChips()}</div>${w?cateringSection(w):''}
${card('Mijn taken',`<div class="bc-list">${openTasks('Catering').map(t=>taskRow(t)).join('')||empty('Geen open taken.')}</div>`)}`;
};
P.c_tast=function(){
  const rows=upcoming().map(w=>{const c=cateringOf(w.id);return `<div class="bc-row" style="flex-wrap:wrap"><div class="grow" style="flex-basis:200px"><span class="t">${esc(w.couple)}</span><span class="s">Trouwdag ${fdate(w.date)} · ${esc(SERVICE[c.style])}</span></div><input type="date" value="${esc(c.tasting)}" onchange="BC.setTasting('${safeId(w.id)}',this.value)" aria-label="Datum proeverij" style="max-width:180px"><span class="small muted">${c.tastingOk?'Bevestigd':'Open'}</span>${sw(c.tastingOk,`BC.tasting('${safeId(w.id)}')`,'Bevestigd')}</div>`;}).join('');
  return top('Proeverijen')+card('Planning proeverijen',`<div class="bc-list">${rows}</div>`);
};
P.tasks=function(){
  const m=me(),dept=isFull(m.role)?st.dept:ROLE_INFO[m.role].dept;
  let ts=tasks(dept);if(st.filter==='open')ts=ts.filter(t=>t.status!=='completed');if(st.filter==='done')ts=ts.filter(t=>t.status==='completed');
  ts.sort((a,b)=>a.deadline.localeCompare(b.deadline));
  return top('Taken',`<button type="button" class="bc-btn" onclick="BC.taskModal('${dept==='Alle'?'Planning':dept}')">${ic('plus',16)}Nieuwe taak</button>`)+
  `${isFull(m.role)?chips([['Alle','Alle afdelingen'],...DEPTS.map(d=>[d,d])],st.dept,'BC.deptFilter'):''}${seg([['open','Open'],['done','Klaar'],['all','Alles']],st.filter,'BC.taskFilter')}
${card(esc(dept==='Alle'?'Alle afdelingen':dept),`<div class="bc-list">${ts.map(t=>taskRow(t)).join('')||empty('Geen taken in deze lijst.')}</div>`)}`;
};
P.weddings=function(){
  return top('Weddings',isOwner()?`<button type="button" class="bc-btn" onclick="BC.weddingModal()">${ic('plus',16)}Nieuwe wedding</button>`:'')+`<div class="bc-grid">${upcoming().map(w=>`<button type="button" class="bc-card" style="text-align:left;border:1px solid var(--bc-line);color:inherit" onclick="BC.openWedding('${safeId(w.id)}')"><div class="head"><span class="bc-pill">Over ${daysUntil(w.date)} dagen</span><span class="small muted">${esc(w.package)}</span></div><h3 style="font-size:30px">${esc(w.couple)}</h3><p class="small muted">${fdate(w.date)} · ${esc(w.venue)} · ${w.guests} gasten</p>${isOwner()?`<div style="display:flex;align-items:center;gap:12px"><div style="flex:1">${bar(pct(w.spent,w.budget))}</div><span class="small" style="color:#f1d6a0">${pct(w.spent,w.budget)}% budget</span></div>`:''}</button>`).join('')}</div>`;
};
P.wedding=function(){
  const w=wed(st.detail);if(!w)return P.weddings();
  const m=me(),mine=ROLE_INFO[m.role].dept,full=isFull(m.role)||m.role==='planner';
  const tabs=[['overzicht','Overzicht'],...DEPTS.filter(d=>full||d===mine).map(d=>[d,d])];if(isFull(m.role))tabs.push(['budget','Budget']);
  if(!tabs.some(t=>t[0]===st.tab))st.tab='overzicht';
  let body='';
  if(st.tab==='Planning')body=planningSection(w);else if(st.tab==='Styling')body=stylingSection(w);else if(st.tab==='Decoratie')body=decorSection(w);else if(st.tab==='Catering')body=cateringSection(w);else if(st.tab==='budget')body=budgetSection(w);
  else body=`<div class="bc-grid">${DEPTS.map(d=>{const ts=tasks(d).filter(t=>t.wedding===w.id),o=ts.filter(t=>t.status!=='completed');return card(esc(d),`<p class="small muted">${o.length} open van ${ts.length} taken</p><div class="bc-list">${o.slice(0,3).map(t=>taskRow(t,false)).join('')||empty('Niets open.')}</div>`);}).join('')}</div>`;
  return `<div><button type="button" class="bc-btn ghost sm" onclick="BC.go('weddings')">${ic('left',16)}Alle weddings</button></div>
<section class="bc-hero"><img class="wm" src="./assets/img/monogram-mark.png" alt="" aria-hidden="true"><span class="eyebrow">${esc(w.package)} · nog ${daysUntil(w.date)} dagen</span><h2>${esc(w.couple)}</h2><p>${esc(longDate(w.date))} · ${esc(w.venue)} · ${w.guests} gasten · planner ${esc(w.planner)}</p></section>
${seg(tabs,st.tab,'BC.wTab')}${body}`;
};
P.leads=function(){
  const stages=[['new','Nieuw'],['contacted','Gecontacteerd'],['consultation','Kennismaking'],['lost','Verloren']];
  return top('Leads & klanten')+`<div class="bc-grid wide">${DB.leads.map(l=>`<section class="bc-card"><div class="head"><h3>${esc(l.name)}</h3>${l.status==='converted'?'<span class="bc-pill ok">Wedding</span>':''}</div><p class="small muted">${fdate(l.wedding_date)} · ${l.guest_count||'?'} gasten · ${esc(l.email)}</p><p>“${esc(l.message)}”</p>${l.status==='converted'?'':seg(stages,l.status,`BC.leadStatus.bind(null,'${safeId(l.id)}')`)+`<div><button type="button" class="bc-btn sm" onclick="BC.convert('${safeId(l.id)}')">Omzetten naar wedding</button></div>`}</section>`).join('')||empty('Geen leads.')}</div>
${card('Klanten',`<div class="bc-list">${DB.clients.map(c=>`<div class="bc-row"><div class="grow"><span class="t">${esc(c.name)}</span><span class="s">${esc(c.email)}</span></div></div>`).join('')}</div>`)}`;
};
P.finance=function(){
  const unpaid=DB.invoices.filter(i=>i.status!=='paid');
  return top('Financiën',`<button type="button" class="bc-btn ghost" onclick="exportDemo()">Export</button><button type="button" class="bc-btn" onclick="newInvoice()">${ic('plus',16)}Factuur</button>`)+
  `<div class="bc-grid tight"><div class="bc-stat"><span class="v gold">${eur(DB.weddings.reduce((s,w)=>s+(w.budget||0),0)).replace(/,00$/,'')}</span><span class="l">Budget in beheer</span></div><div class="bc-stat"><span class="v gold">${eur(DB.weddings.reduce((s,w)=>s+(w.spent||0),0)).replace(/,00$/,'')}</span><span class="l">Besteed</span></div><div class="bc-stat"><span class="v gold">${eur(unpaid.reduce((s,i)=>s+i.total,0)).replace(/,00$/,'')}</span><span class="l">Openstaand</span></div></div>
${card('Facturen',`<div class="bc-list">${DB.invoices.map(invoiceRow).join('')}</div><p class="small muted">Demo-invoer: geen echte betalingen.</p>`)}`;
};
P.team=function(){
  const roles=Object.keys(DB.access);
  return top('Team & toegang',`<button type="button" class="bc-btn" onclick="BC.memberModal()">${ic('plus',16)}Teamlid</button>`)+
  `<div class="bc-grid wide">${CLOUD?card('Accounts',cloudTeamRows()):card('Accounts',`<div class="bc-list">${DB.accounts.map(a=>`<div class="bc-row"><span class="bc-avatar" data-no-translate>${esc(initials(a.name))}</span><div class="grow"><span class="t" data-no-translate>${esc(a.name)}</span><span class="s">${esc(ROLE_INFO[a.role]?.label||a.role)}</span></div>${isFull(a.role)?`<span class="bc-pill gold">${ROLE_INFO[a.role].label}</span>`:`<button type="button" class="bc-btn ghost sm" onclick="BC.pinModal('${safeId(a.id)}')">PIN</button>${sw(a.active,`BC.toggleAccount('${safeId(a.id)}')`,'Actief')}`}</div>`).join('')}</div><p class="small muted">Demo-accounts in deze browser. Echte logins vragen een beveiligde server.</p>`)}
${card('Wat ziet elke afdeling?',`<div class="bc-list">${roles.map(r=>`<div style="padding:12px 0;border-top:1px solid rgba(230,196,143,.12)"><p class="t" style="margin-bottom:6px">${esc(ROLE_INFO[r].label)}</p>${ACCESS_AREAS.map(([k,l])=>`<div class="bc-row" style="min-height:48px;border:0;padding:4px 0"><div class="grow"><span class="s">${esc(l)}</span></div>${sw(!!DB.access[r][k],`BC.setAccess('${r}','${k}',this.checked)`,ROLE_INFO[r].label+' '+l)}</div>`).join('')}</div>`).join('')}</div>`)}</div>`;
};
/* ---------- owner documents ----------
   Files are kept in this browser's IndexedDB (on this device only); metadata lives in DB.documents.
   Not a secure or shared document store: that needs a backend. */
const DOC_SECTIONS=[['werk','Werkcontracten'],['nda',"NDA's"],['wedding','Wedding agreements'],['policy','Policies getekend door klanten']];
const DOC_MAX=25*1024*1024;
function idb(){return new Promise((res,rej)=>{if(!window.indexedDB){rej(new Error('no idb'));return;}const r=indexedDB.open('bc_atelier_files',1);r.onupgradeneeded=()=>r.result.createObjectStore('files');r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);});}
function idbDo(mode,fn){return idb().then(db=>new Promise((res,rej)=>{const tx=db.transaction('files',mode),st2=tx.objectStore('files'),req=fn(st2);tx.oncomplete=()=>res(req&&req.result);tx.onerror=()=>rej(tx.error);}));}
function fmtSize(n){return n>1048576?(n/1048576).toFixed(1)+' MB':Math.max(1,Math.round(n/1024))+' kB';}
P.docs=function(){
  if(!Array.isArray(DB.documents))DB.documents=[];
  if(!st.docSec)st.docSec='werk';
  if(CLOUD&&!cs.docs){cloudLoadDocs();return top('Documenten','')+empty('Documenten laden…');}
  const DOCS=CLOUD?cs.docs:DB.documents;
  const q=(st.docQ||'').toLowerCase();
  const list=DOCS.filter(d=>d.section===st.docSec&&(!q||(d.title+' '+d.person+' '+d.fileName).toLowerCase().includes(q))).sort((a,b)=>(b.added||'').localeCompare(a.added||''));
  const counts=Object.fromEntries(DOC_SECTIONS.map(([k])=>[k,DOCS.filter(d=>d.section===k).length]));
  const secLabel=DOC_SECTIONS.find(x=>x[0]===st.docSec)[1];
  const rows=list.map(d=>`<div class="bc-row" style="flex-wrap:wrap">${ic('file',22)}<div class="grow" style="flex-basis:200px"><span class="t">${esc(d.title)}</span><span class="s">${esc(d.person||'—')}${d.wedding?' · '+esc(wName(d.wedding)):''} · ${esc(d.fileName)} · ${fmtSize(d.size||0)}${d.date?' · '+fdate(d.date):''}</span></div>
<span class="small muted">${d.signed?'Getekend':'Niet getekend'}</span>${sw(d.signed,`BC.docSigned('${safeId(d.id)}')`,'Getekend')}
<button type="button" class="bc-icon sm" onclick="BC.docOpen('${safeId(d.id)}')" aria-label="Open ${esc(d.title)}">${ic('eye',16)}</button><button type="button" class="bc-icon sm" onclick="BC.docDownload('${safeId(d.id)}')" aria-label="Download ${esc(d.title)}">${ic('down',16)}</button>
${st.docDel===d.id?`<button type="button" class="bc-btn sm" onclick="BC.docDelete('${safeId(d.id)}')">Zeker verwijderen?</button>`:`<button type="button" class="bc-icon sm" onclick="BC.docAskDel('${safeId(d.id)}')" aria-label="Verwijder ${esc(d.title)}">${ic('x',14)}</button>`}</div>`).join('');
  const personOpts=[...DB.accounts.map(a=>a.name),...DB.clients.map(c=>c.name)].filter((v,i,a)=>a.indexOf(v)===i).map(n=>`<option value="${esc(n)}"></option>`).join('');
  return top('Documenten',`<button type="button" class="bc-btn" onclick="document.getElementById('bcDocFile')?.click()">${ic('plus',16)}Uploaden</button>`)+
  `<div class="bc-grid tight">${DOC_SECTIONS.map(([k,l])=>`<button type="button" class="bc-stat" style="${k===st.docSec?'border-color:var(--bc-gold-mid);background:var(--bc-rose)':''}" onclick="BC.docSection('${k}')" aria-pressed="${k===st.docSec}"><span class="v gold">${counts[k]}</span><span class="l">${esc(l)}</span></button>`).join('')}</div>
<div class="bc-grid wide">
${card(esc(secLabel),`<input type="search" placeholder="Zoek op titel of naam" aria-label="Zoeken" value="${esc(st.docQ||'')}" onchange="BC.docSearch(this.value)"><div class="bc-list">${rows||empty('Nog geen documenten in deze map.')}</div>`)}
${card('Document toevoegen',`<form onsubmit="BC.docUpload(event)">
<label class="bc-field"><span>Bestand (pdf, foto, Word · max 25 MB)</span><input id="bcDocFile" type="file" name="file" required accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.heic,.txt"></label>
<label class="bc-field"><span>Map</span><select name="section">${DOC_SECTIONS.map(([k,l])=>`<option value="${k}" ${k===st.docSec?'selected':''}>${esc(l)}</option>`).join('')}</select></label>
<label class="bc-field"><span>Titel</span><input name="title" maxlength="120" placeholder="Bv. Arbeidscontract Anja"></label>
<div class="bc-inline"><label class="bc-field"><span>Persoon of klant</span><input name="person" maxlength="80" list="bcDocPeople"><datalist id="bcDocPeople">${personOpts}</datalist></label><label class="bc-field"><span>Datum getekend</span><input type="date" name="date"></label></div>
<label class="bc-field"><span>Wedding (optioneel)</span><select name="wedding"><option value="">Geen</option>${weddingOptions('')}</select></label>
<label class="bc-row" style="display:flex;border:0;min-height:44px;cursor:pointer"><span class="grow"><span class="t">Al getekend</span></span><span class="bc-switch"><input type="checkbox" name="signed"><span></span></span></label>
<button class="bc-btn" type="submit">${ic('plus',16)}Opslaan in ${esc(secLabel)}</button>
<p class="small muted" style="margin-top:12px">Let op: in deze demo worden bestanden alleen in deze browser op dit toestel bewaard. Ze worden niet gedeeld en er wordt geen back-up van gemaakt.</p></form>`,'','rich')}</div>`;
};

P.activity=function(){return top('Activiteit')+card('Logboek',`<div class="bc-list">${DB.log.slice(0,80).map(l=>`<div class="bc-row"><div class="grow"><span class="t">${esc(l.what)}</span><span class="s"><span data-no-translate>${esc(l.who)}</span> · ${esc(l.w)} · ${esc(new Date(l.t).toLocaleString('nl-BE',{dateStyle:'medium',timeStyle:'short'}))}</span></div></div>`).join('')||empty('Nog geen activiteit.')}</div>`);};
function calEvents(){
  const m=me(),dept=ROLE_INFO[m.role].dept,ev=[];
  DB.weddings.forEach(w=>w.date&&ev.push({d:w.date,t:w.couple,k:'w',full:'Trouwdag '+w.couple}));
  tasks(dept||'Alle').forEach(x=>x.deadline&&ev.push({d:x.deadline,t:x.title,k:'d',task:x,done:x.status==='completed',full:x.title+' · '+x.dept}));
  if(!dept||dept==='Styling')DB.appointments.forEach(a=>ev.push({d:a.date,t:a.time+' '+a.title,k:'a',done:a.done,full:a.time+' · '+a.title+' · '+a.place}));
  if(!dept||dept==='Catering')DB.catering.filter(c=>c.tasting).forEach(c=>ev.push({d:c.tasting,t:'Proeverij',k:'c',done:c.tastingOk,full:'Proeverij '+wName(c.wedding)}));
  return ev;
}
P.calendar=function(){
  const m=me(),t=todayIso();
  if(!st.calMonth)st.calMonth=t.slice(0,7);
  if(!st.calDay)st.calDay=t;
  const [y,mo]=st.calMonth.split('-').map(Number),first=new Date(y,mo-1,1,12),start=new Date(first);start.setDate(1-((first.getDay()+6)%7));
  const ev=calEvents(),byDay={};ev.forEach(e=>{(byDay[e.d]=byDay[e.d]||[]).push(e);});
  const order={w:0,d:1,a:2,c:3};
  const cells=[];for(let i=0;i<42;i++){const d=new Date(start);d.setDate(start.getDate()+i);if(i>=35&&d.getMonth()!==mo-1)break;cells.push(d);}
  const grid=cells.map(d=>{const k=iso(d),list=(byDay[k]||[]).sort((a,b)=>order[a.k]-order[b.k]),wedding=list.some(e=>e.k==='w');
    const chips=list.slice(0,3).map(e=>`<span class="bc-ev ${e.k} ${e.done?'done':''}">${esc(e.t)}</span>`).join('')+(list.length>3?`<span class="more">+${list.length-3} meer</span>`:'');
    const dots=`<span class="dots">${list.slice(0,4).map(e=>`<i class="bc-dot-${e.k}"></i>`).join('')}</span>`;
    return `<button type="button" class="day ${d.getMonth()!==mo-1?'out':''} ${k===t?'today':''} ${k===st.calDay?'sel':''} ${wedding?'wedding':''}" onclick="BC.calPick('${k}')" aria-label="${esc(longDate(k))}, ${list.length} items"><span class="n">${d.getDate()}</span>${chips}${dots}</button>`;}).join('');
  const sel=(byDay[st.calDay]||[]).sort((a,b)=>order[a.k]-order[b.k]);
  const label={w:'Trouwdag',d:'Deadline',a:'Afspraak',c:'Proeverij'};
  const selHtml=sel.map(e=>e.task?taskRow(e.task):`<div class="bc-row"><span class="bc-pill ${e.k==='w'?'gold':'line'}">${label[e.k]}</span><div class="grow"><span class="t">${esc(e.full)}</span></div></div>`).join('')||empty('Nog niets gepland. Voeg hieronder een deadline toe.');
  const depts=isFull(m.role)?DEPTS:[ROLE_INFO[m.role].dept];
  const monthName=first.toLocaleDateString('nl-BE',{month:'long'});
  return top('Kalender',`<button type="button" class="bc-btn" onclick="BC.calPick('${safeId(st.calDay)}');document.getElementById('bcDeadline')?.focus()">${ic('plus',16)}Deadline</button>`)+
  `<section class="bc-card">
<div class="bc-calhead"><div class="month"><span class="script">${esc(monthName.charAt(0).toUpperCase()+monthName.slice(1))}</span><b>${y}</b></div><div style="display:flex;gap:8px;align-items:center"><button type="button" class="bc-btn ghost sm" onclick="BC.calToday()">Vandaag</button><button type="button" class="bc-icon sm" onclick="BC.calMove(-1)" aria-label="Vorige maand">${ic('left',16)}</button><button type="button" class="bc-icon sm" onclick="BC.calMove(1)" aria-label="Volgende maand">${ic('right',16)}</button></div></div>
<div class="bc-legend"><span><i class="bc-dot-w"></i>Trouwdag</span><span><i class="bc-dot-d"></i>Deadline</span>${(!ROLE_INFO[m.role].dept||ROLE_INFO[m.role].dept==='Styling')?'<span><i class="bc-dot-a"></i>Afspraak</span>':''}${(!ROLE_INFO[m.role].dept||ROLE_INFO[m.role].dept==='Catering')?'<span><i class="bc-dot-c"></i>Proeverij</span>':''}</div>
<div class="bc-cal">${['MA','DI','WO','DO','VR','ZA','ZO'].map(d=>`<span class="dow">${d}</span>`).join('')}${grid}</div></section>
<div class="bc-grid wide">${card(esc(longDate(st.calDay)),`<div class="bc-list">${selHtml}</div>`,'','rich')}
${card('Deadline toevoegen',`<form onsubmit="BC.addDeadline(event)"><label class="bc-field"><span>Wat moet er klaar zijn?</span><input id="bcDeadline" name="title" required maxlength="150" placeholder="Bv. Bloemen bevestigen"></label><div class="bc-inline"><label class="bc-field"><span>Datum</span><input type="date" name="deadline" required value="${esc(st.calDay)}"></label><label class="bc-field"><span>Prioriteit</span><select name="priority">${Object.entries(PRIO).map(([k,l])=>`<option value="${k}" ${k==='medium'?'selected':''}>${l}</option>`).join('')}</select></label></div><div class="bc-inline"><label class="bc-field"><span>Wedding</span><select name="wedding">${weddingOptions(st.wid)}</select></label><label class="bc-field"><span>Afdeling</span><select name="dept">${depts.map(d=>`<option>${d}</option>`).join('')}</select></label></div><button class="bc-btn" type="submit">${ic('plus',16)}In de kalender zetten</button></form>`)}</div>`;
};
P.vendors=function(){return top('Leveranciers',`<button type="button" class="bc-btn" onclick="BC.vendorModal()">${ic('plus',16)}Leverancier</button>`)+`<div class="bc-grid">${DB.vendors.map(v=>{const b=DB.bookings.filter(x=>x.vendor===v.id);return `<section class="bc-card"><h3>${esc(v.name)}</h3><p class="small muted">${esc(v.category)} · ${esc(v.city)}</p><div class="bc-list">${b.map(x=>`<div class="bc-row"><div class="grow"><span class="t">${esc(wName(x.wedding))}</span></div><span class="small muted">${x.booked?'Geboekt':'Open'}</span>${sw(x.booked,`BC.toggleBooking('${safeId(x.id)}')`,'Geboekt')}</div>`).join('')||empty('Nog niet gekoppeld.')}</div></section>`;}).join('')}</div>`;};

/* ---------- main render ---------- */
/* Atelier: maquette-studio (owner + admin). Loaded on demand from assets/maquette.js. */
const MQ_VER='20261127a';
function loadMaquette(){
  if(window.BCMaquette)return Promise.resolve();
  if(loadMaquette.p)return loadMaquette.p;
  loadMaquette.p=new Promise((res,rej)=>{
    const l=document.createElement('link');l.rel='stylesheet';l.href='./assets/maquette.css?v='+MQ_VER;document.head.appendChild(l);
    const s=document.createElement('script');s.src='./assets/maquette.js?v='+MQ_VER;s.onload=()=>res();s.onerror=()=>{loadMaquette.p=null;rej(new Error('load'));};document.head.appendChild(s);
  });
  return loadMaquette.p;
}
P.maquette=function(){
  setTimeout(()=>{const h=document.getElementById('mqHost');if(!h||h.dataset.on)return;h.dataset.on='1';
    loadMaquette().then(()=>window.BCMaquette.gallery(h,{cloud:CLOUD,toast,owner:isOwner})).catch(()=>{h.innerHTML=empty('Het atelier kon niet geladen worden. Probeer opnieuw.');});},0);
  return top('Atelier <span class="gold" style="font-style:italic">· maquettes</span>')+`<div id="mqHost">${empty('Atelier laden…')}</div>`;
};

function renderAtelier(){
  prepare();
  const m=me();
  if(!m)return loginView();
  ROLE=m.role;
  if(!st.page||!allowed(st.page))st.page=ROLE_INFO[m.role].home;
  return shell((P[st.page]||P[ROLE_INFO[m.role].home])());
}

/* ---------- modals ---------- */
function weddingOptions(sel){return upcoming().map(w=>`<option value="${safeId(w.id)}" ${w.id===sel?'selected':''} data-no-translate>${esc(w.couple)}</option>`).join('');}
function field(label,input){return `<label class="bc-field"><span>${esc(label)}</span>${input}</label>`;}
function modal(title,form,submit){openModal(`<div class="bc" style="min-height:0;background:none"><h2>${esc(title)}</h2><form onsubmit="${submit}">${form}<div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:6px"><button class="bc-btn" type="submit">Opslaan</button><button type="button" class="bc-btn ghost" onclick="closeModal()">Annuleer</button></div></form></div>`);}
function formData(e){e.preventDefault();return new FormData(e.target);}
const val=(f,k)=>String(f.get(k)||'').trim();
const isDate=v=>/^\d{4}-\d{2}-\d{2}$/.test(v),isTime=v=>/^\d{2}:\d{2}$/.test(v);

/* ---------- intro animation "Gouden glans" (BC logo + slogan) ----------
   Plays ONLY right after a successful login, never before the login screen.
   Any future login method (e-mail + wachtwoord, PIN) must call playIntro() on success too. */
function playIntro(name){
  const old=document.getElementById('bc-intro');if(old)old.remove();
  const words='Created once. Remembered forever.'.split(' ').map((w,i)=>`<span style="animation-delay:${1.5+i*.14}s">${esc(w)}&nbsp;</span>`).join('');
  const el=document.createElement('div');el.id='bc-intro';el.className='v1';el.setAttribute('role','presentation');
  el.innerHTML=`<div class="logo"><img src="./assets/img/monogram-mark.png" alt=""><div class="shine"></div></div><div class="slogan" data-no-translate>${words}</div>`+(name?`<div class="hello" data-no-translate>${esc('Welkom, '+name)}</div>`:'')+`<div class="skip">Tik om verder te gaan</div>`;
  el.style.setProperty('--out','3.9s');
  const close=()=>{if(el.isConnected)el.remove();};
  el.addEventListener('click',close);el.addEventListener('animationend',e=>{if(e.target===el)close();});
  setTimeout(close,4900);
  document.body.appendChild(el);
}

/* ---------- cloud mode (Supabase) ----------
   Login: e-mail + wachtwoord, daarna een eigen PIN; volgende keren ontgrendelen met PIN.
   Na elke geslaagde login of PIN-ontgrendeling speelt de Gouden glans. */
const LOCAL_ONLY=['accounts','documents'];
function introName(p){return String(p?.name||'').split(' ')[0]||'';}
function stripState(){const o={};for(const k of Object.keys(DB))if(!LOCAL_ONLY.includes(k))o[k]=DB[k];return o;}
function blankState(){const b=freshDemo();for(const k of Object.keys(b))if(Array.isArray(b[k]))b[k]=[];return b;}
function mergeState(remote){
  const r=blankState();
  if(remote&&typeof remote==='object'&&!Array.isArray(remote)){
    for(const k of Object.keys(r)){
      if(Array.isArray(r[k])){if(Array.isArray(remote[k]))r[k]=remote[k].filter(x=>x&&typeof x==='object'&&!Array.isArray(x));}
      else if(r[k]&&typeof r[k]==='object'&&remote[k]&&typeof remote[k]==='object'){for(const role of Object.keys(r[k]))if(remote[k][role]&&typeof remote[k][role]==='object')Object.assign(r[k][role],remote[k][role]);}
    }
  }
  return r;
}
async function cloudLoadData(){
  let remote=await CLOUD.loadState();
  if(remote===null){const b=blankState();for(const k of LOCAL_ONLY)delete b[k];await CLOUD.seedState(b);remote=b;}
  const accounts=(await CLOUD.listProfiles()).map(p=>({id:p.id,name:p.name||p.email,email:p.email,role:p.role,active:p.active}));
  DB=mergeState(remote);DB.accounts=accounts;DB.documents=[];cs.docs=null;
}
function cloudBusy(on){cs.busy=on;render();}
function cloudFail(e){cs.busy=false;cs.err=(e&&e.message)||'Er ging iets mis';cs.pin='';render();}
async function cloudEnter(withIntro){
  await cloudLoadData();
  CLOUD.unlock();cs.phase='ready';cs.busy=false;cs.err='';cs.pin='';cs.pin1='';
  const p=CLOUD.profile;st.page=ROLE_INFO[p.role].home;st.day=todayIso();
  if(withIntro){log('Aangemeld');save();}
  render();window.scrollTo(0,0);
  if(withIntro)playIntro(introName(p));
}
async function cloudAfterPassword(){
  if(await CLOUD.hasPin())await cloudEnter(true);
  else{cs.phase='setpin';cs.pin='';cs.pin1='';cs.busy=false;cs.err='';render();}
}
function cloudLock(){CLOUD.lock();cs.phase=CLOUD.profile?'pin':'email';cs.pin='';cs.err='';st.page=null;st.sheet=false;render();window.scrollTo(0,0);}
let pollTimer=null;
function cloudPoll(){clearInterval(pollTimer);pollTimer=setInterval(async()=>{
  if(cs.phase!=='ready'||document.hidden)return;
  try{const v=await CLOUD.remoteVersion();if(v>CLOUD.version&&!document.querySelector('#modal.show')&&!(document.activeElement&&/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName))){await cloudLoadData();render();}}catch(e){}
},20000);}
async function cloudBoot(){
  CLOUD.on(async evt=>{
    if(evt==='recovery'){cs.phase='newpw';cs.err='';render();}
    else if(evt==='signedout'){cs.phase='email';st.page=null;render();}
    else if(evt==='conflict'){try{await cloudLoadData();render();toast('Iemand anders wijzigde net iets: de nieuwste versie is geladen.');}catch(e){}}
    else if(evt==='offline'){toast('Geen verbinding: we proberen opnieuw te bewaren.');}
  });
  try{
    const p=await CLOUD.init();
    if(cs.phase==='newpw'){render();return;}
    if(!p)cs.phase='email';
    else if(CLOUD.isUnlocked()){await cloudEnter(false);cloudPoll();return;}
    else cs.phase=(await CLOUD.hasPin())?'pin':'setpin';
  }catch(e){cs.phase='email';cs.err='Kan de server niet bereiken. Probeer later opnieuw.';}
  render();cloudPoll();
}
function keypad(fn,back){
  const keys=['1','2','3','4','5','6','7','8','9'].map(k=>`<button type="button" onclick="BC.${fn}('${k}')" ${cs.busy?'disabled':''}>${k}</button>`).join('');
  return `<div class="bc-pad">${keys}${back||'<span></span>'}<button type="button" onclick="BC.${fn}('0')" ${cs.busy?'disabled':''}>0</button><button type="button" class="txt" onclick="BC.${fn}('del')" aria-label="Wissen">${ic('left',22)}</button></div>`;
}
function dotsHtml(n){return `<div class="bc-dots ${cs.err?'err':''}" aria-live="polite" aria-label="${n} van 4 cijfers">${[0,1,2,3].map(i=>`<i class="${i<n?'on':''}"></i>`).join('')}</div>`;}
function errHtml(){return cs.err?`<p class="small" role="alert" style="color:#f1d6a0">${esc(cs.err)}</p>`:'';}
function cloudLoginView(){
  const wrap=inner=>`<div class="bc"><div class="bc-login"><div class="box">${inner}</div></div></div>`;
  const p=CLOUD.profile;
  if(cs.phase==='boot')return wrap(`<img class="logo" src="./assets/img/monogram.png" alt="BC · Created once. Remembered forever."><p class="muted">Even geduld…</p>`);
  if(cs.phase==='email')return wrap(`<img class="logo" src="./assets/img/monogram.png" alt="BC · Created once. Remembered forever.">
<div><span class="script" style="font-size:34px">Bienvenue</span><h1 style="font-size:40px">Welkom in het atelier</h1><p class="muted" style="margin-top:6px">Meld je aan met je e-mail en wachtwoord.</p></div>
<form class="bc-auth" onsubmit="BC.cSignIn(event)" style="display:flex;flex-direction:column;gap:12px;width:100%;max-width:360px;text-align:left">
${field('E-mail','<input type="email" name="email" autocomplete="username" required maxlength="120" value="'+esc(cs.email||'')+'">')}
${field('Wachtwoord','<input type="password" name="password" autocomplete="current-password" required maxlength="128">')}
${errHtml()}${cs.msg?`<p class="small muted" role="status">${esc(cs.msg)}</p>`:''}
<button class="bc-btn" type="submit" ${cs.busy?'disabled':''}>${cs.busy?'Bezig…':'Inloggen'}</button>
<button type="button" class="bc-btn ghost sm" onclick="BC.cPhase('forgot')">Wachtwoord vergeten?</button></form>
<p class="small muted" style="max-width:420px">Alleen voor het Belles Creators-team. Een account krijg je van de owner.</p>`);
  if(cs.phase==='forgot')return wrap(`<img src="./assets/img/monogram-mark.png" alt="Belles Creators" style="width:150px;height:auto">
<div><h1 style="font-size:34px">Wachtwoord vergeten</h1><p class="muted">Je krijgt een link om een nieuw wachtwoord te kiezen.</p></div>
<form onsubmit="BC.cForgot(event)" style="display:flex;flex-direction:column;gap:12px;width:100%;max-width:360px;text-align:left">
${field('E-mail','<input type="email" name="email" autocomplete="username" required maxlength="120" value="'+esc(cs.email||'')+'">')}${errHtml()}
<button class="bc-btn" type="submit" ${cs.busy?'disabled':''}>Stuur link</button><button type="button" class="bc-btn ghost sm" onclick="BC.cPhase('email')">Terug</button></form>`);
  if(cs.phase==='newpw')return wrap(`<img src="./assets/img/monogram-mark.png" alt="Belles Creators" style="width:150px;height:auto">
<div><h1 style="font-size:34px">Nieuw wachtwoord</h1><p class="muted">Minstens 10 tekens.</p></div>
<form onsubmit="BC.cNewPw(event)" style="display:flex;flex-direction:column;gap:12px;width:100%;max-width:360px;text-align:left">
${field('Nieuw wachtwoord','<input type="password" name="pw" autocomplete="new-password" required minlength="10" maxlength="128">')}
${field('Herhaal wachtwoord','<input type="password" name="pw2" autocomplete="new-password" required minlength="10" maxlength="128">')}${errHtml()}
<button class="bc-btn" type="submit" ${cs.busy?'disabled':''}>Opslaan en inloggen</button></form>`);
  const head=`<img src="./assets/img/monogram-mark.png" alt="Belles Creators" style="width:150px;height:auto"><div><span class="bc-avatar" style="margin:0 auto 10px;width:58px;height:58px;font-size:18px" data-no-translate>${esc(initials(p?.name))}</span><h1 style="font-size:34px" data-no-translate>${esc(p?.name||'')}</h1>`;
  if(cs.phase==='setpin'){const confirm=!!cs.pin1;return wrap(`${head}<p class="muted">${confirm?'Herhaal je nieuwe PIN':'Kies een PIN van 4 cijfers. Daarmee open je het atelier de volgende keren.'}</p></div>${dotsHtml(cs.pin.length)}${errHtml()}${keypad('cSetKey',`<button type="button" class="txt" onclick="BC.cSwitch()">Afmelden</button>`)}`);}
  return wrap(`${head}<p class="muted">${esc(ROLE_INFO[p?.role]?.label||'')} · voer je PIN in</p></div>${dotsHtml(cs.pin.length)}${errHtml()}${keypad('cKey','')}
<button type="button" class="bc-btn ghost sm" onclick="BC.cSwitch()">Inloggen met e-mail en wachtwoord</button>`);
}
function cloudTeamRows(){
  const meId=CLOUD.profile?.id;
  return `<div class="bc-list">${DB.accounts.map(a=>`<div class="bc-row" style="flex-wrap:wrap"><span class="bc-avatar" data-no-translate>${esc(initials(a.name))}</span><div class="grow" style="flex-basis:160px"><span class="t" data-no-translate>${esc(a.name)}</span><span class="s" data-no-translate>${esc(ROLE_INFO[a.role]?.label||a.role)} · ${esc(a.email||'')}</span></div>${a.id===meId?'<span class="bc-pill gold">Jij</span>':`<button type="button" class="bc-btn ghost sm" onclick="BC.cResetPin('${safeId(a.id)}')">PIN resetten</button>${sw(a.active,`BC.toggleAccount('${safeId(a.id)}')`,'Actief')}`}</div>`).join('')}</div><p class="small muted">Echte accounts op de beveiligde server. Uitgeschakelde accounts kunnen niet meer inloggen. PIN resetten: bij de volgende keer logt die persoon in met e-mail en wachtwoord en kiest een nieuwe PIN.</p>`;
}
async function cloudRefreshTeam(){const list=await CLOUD.listProfiles();DB.accounts=list.map(p=>({id:p.id,name:p.name||p.email,email:p.email,role:p.role,active:p.active}));render();}
async function cloudToggle(id){const a=DB.accounts.find(x=>x.id===id);if(!a)return;try{await CLOUD.setActive(id,!a.active);log('Account '+(!a.active?'geactiveerd':'gedeactiveerd')+': '+a.name);save();await cloudRefreshTeam();}catch(e){toast(e.message);render();}}
function cloudInviteModal(){
  modal('Nieuw teamlid',field('Naam','<input name="name" required maxlength="80">')+field('E-mail','<input type="email" name="email" required maxlength="120">')+field('Afdeling',`<select name="role">${Object.keys(ROLE_INFO).filter(r=>!isFull(r)).map(r=>`<option value="${r}">${ROLE_INFO[r].label}</option>`).join('')}</select>`)+field('Tijdelijk wachtwoord (min. 10 tekens)','<input name="password" required minlength="10" maxlength="128" autocomplete="off">')+'<p class="small muted">Geef dit wachtwoord persoonlijk door. Na de eerste login kiest het teamlid een eigen PIN, en via "Wachtwoord vergeten?" een eigen wachtwoord.</p>','BC.cInvite(event)');
}
function docFromRow(r){return {id:r.id,section:r.section,title:r.title,person:r.person||'',wedding:r.wedding||'',date:r.signed_on||'',signed:!!r.signed,fileName:r.file_name,type:r.mime,size:Number(r.size)||0,added:r.created_at,path:r.file_path};}
async function cloudLoadDocs(){if(cs.docsLoading)return;cs.docsLoading=true;try{cs.docs=(await CLOUD.listDocs()).map(docFromRow);}catch(e){cs.docs=[];toast('Documenten laden lukt niet');}cs.docsLoading=false;render();}
async function cloudUploadDoc(file,meta){toast('Uploaden…');try{const row=await CLOUD.uploadDoc(file,meta);cs.docs=[docFromRow({...row,created_at:new Date().toISOString()}),...(cs.docs||[])];st.docSec=meta.section;log('Document opgeslagen: '+meta.title,meta.wedding||undefined);save();render();toast('Document veilig opgeslagen');}catch(e){toast('Uploaden lukt niet: '+e.message);}}
function cdoc(id){return (cs.docs||[]).find(x=>x.id===id);}
async function cloudOpenDoc(id){const d=cdoc(id);if(!d)return;const win=window.open('','_blank');try{const url=await CLOUD.signedUrl(d.path);if(win)win.location=url;else window.location=url;}catch(e){if(win)win.close();toast('Openen lukt niet');}}
async function cloudDownloadDoc(id){const d=cdoc(id);if(!d)return;try{downloadBlob(await CLOUD.download(d.path),d.fileName);}catch(e){toast('Downloaden lukt niet');}}
async function cloudSignDoc(id){const d=cdoc(id);if(!d||!isOwner())return;const v=!d.signed;try{await CLOUD.updateDoc(id,{signed:v});d.signed=v;log('Document '+(v?'getekend':'niet getekend')+': '+d.title);save();render();}catch(e){toast(e.message);}}
async function cloudDeleteDoc(id){const d=cdoc(id);if(!d)return;st.docDel=null;try{await CLOUD.deleteDoc({id:d.id,file_path:d.path});cs.docs=cs.docs.filter(x=>x.id!==id);log('Document verwijderd: '+d.title);save();render();toast('Verwijderd');}catch(e){toast(e.message);render();}}
const cloudActions={
  cPhase(p){if(!['email','forgot'].includes(p))return;cs.phase=p;cs.err='';cs.msg='';render();},
  async cSignIn(e){e.preventDefault();const f=new FormData(e.target);cs.email=val(f,'email');cs.err='';cs.msg='';cloudBusy(true);try{await CLOUD.signIn(val(f,'email'),String(f.get('password')||''));await cloudAfterPassword();}catch(x){cloudFail(x);}},
  async cForgot(e){e.preventDefault();const f=new FormData(e.target);cs.email=val(f,'email');cloudBusy(true);try{await CLOUD.sendReset(val(f,'email'));cs.busy=false;cs.phase='email';cs.msg='Als dit e-mailadres bij ons bekend is, kreeg je een link in je mailbox.';render();}catch(x){cloudFail(x);}},
  async cNewPw(e){e.preventDefault();const f=new FormData(e.target),a=String(f.get('pw')||''),b=String(f.get('pw2')||'');if(a.length<10){cs.err='Minstens 10 tekens';render();return;}if(a!==b){cs.err='De wachtwoorden zijn niet gelijk';render();return;}cloudBusy(true);try{await CLOUD.updatePassword(a);if(!CLOUD.profile)throw new Error('Dit account is niet (meer) actief.');try{history.replaceState(null,'',location.pathname);}catch(_){}await cloudAfterPassword();}catch(x){cloudFail(x);}},
  async cKey(k){if(cs.busy)return;if(k==='del'){cs.pin=cs.pin.slice(0,-1);cs.err='';render();return;}if(cs.pin.length>=4)return;cs.pin+=k;cs.err='';render();
    if(cs.pin.length<4)return;cloudBusy(true);
    try{const r=await CLOUD.verifyPin(cs.pin);
      if(r==='ok'){await cloudEnter(true);return;}
      cs.busy=false;cs.pin='';
      if(r==='wrong')cs.err='Onjuiste PIN, probeer opnieuw.';
      else if(r==='locked'){await CLOUD.signOut();cs.phase='email';cs.err='5 keer een foute PIN: log opnieuw in met e-mail en wachtwoord.';}
      else{cs.phase='setpin';}
      render();
    }catch(x){cloudFail(x);}},
  async cSetKey(k){if(cs.busy)return;if(k==='del'){cs.pin=cs.pin.slice(0,-1);cs.err='';render();return;}if(cs.pin.length>=4)return;cs.pin+=k;cs.err='';render();
    if(cs.pin.length<4)return;
    if(!cs.pin1){cs.pin1=cs.pin;cs.pin='';render();return;}
    if(cs.pin!==cs.pin1){cs.pin='';cs.pin1='';cs.err='De PIN-codes waren niet gelijk. Kies opnieuw.';render();return;}
    cloudBusy(true);try{await CLOUD.setPin(cs.pin);await cloudEnter(true);}catch(x){cs.pin1='';cloudFail(x);}},
  async cSwitch(){cs.busy=false;await CLOUD.signOut().catch(()=>{});cs.phase='email';cs.pin='';cs.pin1='';cs.err='';render();},
  async cResetPin(id){if(!isOwner())return;const a=DB.accounts.find(x=>x.id===id);try{await CLOUD.resetPin(id);log('PIN gereset: '+(a?a.name:''));save();toast('PIN gereset');}catch(e){toast(e.message);}},
  async cInvite(e){if(!isOwner())return;const f=formData(e),payload={name:val(f,'name'),email:val(f,'email'),role:val(f,'role'),password:String(f.get('password')||'')};
    if(!payload.name||!payload.email||!ROLE_INFO[payload.role]||isFull(payload.role)||payload.password.length<10){toast('Controleer de invoer');return;}
    try{await CLOUD.invite(payload);closeModal();log('Teamlid toegevoegd: '+payload.name);save();await cloudRefreshTeam();toast('Account aangemaakt voor '+payload.name);}catch(x){toast(x.message);}}
};

/* ---------- actions (global, used by inline handlers) ---------- */
window.BC={
  docSection(k){if(!DOC_SECTIONS.some(x=>x[0]===k))return;st.docSec=k;st.docDel=null;render();},
  docSearch(v){st.docQ=String(v||'').slice(0,80);render();},
  docAskDel(id){st.docDel=id;render();},
  docUpload(e){e.preventDefault();if(!isOwner())return;const form=e.target,f=new FormData(form),file=f.get('file'),sec=val(f,'section');
    if(!file||!file.size||!DOC_SECTIONS.some(x=>x[0]===sec)){toast('Kies een bestand');return;}
    if(file.size>DOC_MAX){toast('Bestand is groter dan 25 MB');return;}
    const w=val(f,'wedding'),date=val(f,'date'),id=uid('doc');
    if(CLOUD){cloudUploadDoc(file,{section:sec,title:val(f,'title')||file.name.replace(/\.[^.]+$/,''),person:val(f,'person'),wedding:wed(w)?w:'',date:isDate(date)?date:'',signed:!!f.get('signed')});return;}
    const meta={id,section:sec,title:val(f,'title')||file.name.replace(/\.[^.]+$/,''),person:val(f,'person'),wedding:wed(w)?w:'',date:isDate(date)?date:'',signed:!!f.get('signed'),fileName:file.name.slice(0,140),type:file.type||'application/octet-stream',size:file.size,added:new Date().toISOString()};
    idbDo('readwrite',s2=>s2.put(file,id)).then(()=>{DB.documents.push(meta);st.docSec=sec;commit('Document opgeslagen: '+meta.title,meta.wedding||undefined);toast('Document opgeslagen');})
      .catch(()=>toast('Opslaan lukt niet in deze browser'));},
  docGet(id){return idbDo('readonly',s2=>s2.get(id));},
  docOpen(id){if(CLOUD){cloudOpenDoc(id);return;}const d=DB.documents.find(x=>x.id===id);if(!d)return;const win=window.open('','_blank');BC.docGet(id).then(b=>{if(!b){if(win)win.close();toast('Bestand niet gevonden op dit toestel');return;}const url=URL.createObjectURL(b);if(win)win.location=url;else window.location=url;setTimeout(()=>URL.revokeObjectURL(url),60000);}).catch(()=>{if(win)win.close();toast('Openen lukt niet');});},
  docDownload(id){if(CLOUD){cloudDownloadDoc(id);return;}const d=DB.documents.find(x=>x.id===id);if(!d)return;BC.docGet(id).then(b=>{if(!b){toast('Bestand niet gevonden op dit toestel');return;}downloadBlob(b,d.fileName);}).catch(()=>toast('Downloaden lukt niet'));},
  docSigned(id){if(CLOUD){cloudSignDoc(id);return;}const d=DB.documents.find(x=>x.id===id);if(!d||!isOwner())return;d.signed=!d.signed;commit('Document '+(d.signed?'getekend':'niet getekend')+': '+d.title);},
  docDelete(id){if(!isOwner())return;if(CLOUD){cloudDeleteDoc(id);return;}const i=DB.documents.findIndex(x=>x.id===id);if(i<0)return;const d=DB.documents.splice(i,1)[0];st.docDel=null;idbDo('readwrite',s2=>s2.delete(id)).catch(()=>{});commit('Document verwijderd: '+d.title);toast('Verwijderd');},
  calMove(n){const [y,m]=(st.calMonth||todayIso().slice(0,7)).split('-').map(Number);const d=new Date(y,m-1+n,1,12);st.calMonth=d.getFullYear()+'-'+pad(d.getMonth()+1);render();},
  calToday(){st.calMonth=todayIso().slice(0,7);st.calDay=todayIso();render();},
  calPick(d){if(!isDate(d))return;st.calDay=d;st.calMonth=d.slice(0,7);render();},
  addDeadline(e){const f=formData(e),m=me(),title=val(f,'title'),w=val(f,'wedding'),dept=val(f,'dept'),prio=val(f,'priority'),dl=val(f,'deadline');const okDept=isFull(m.role)?DEPTS.includes(dept):dept===ROLE_INFO[m.role].dept;
    if(!title||!wed(w)||!okDept||!PRIO[prio]||!isDate(dl)){toast('Controleer de invoer');return;}
    DB.tasks.push({id:uid('t'),wedding:w,title,dept,assignee:assigneeFor(dept),priority:prio,status:'todo',deadline:dl,client:false});st.calDay=dl;st.calMonth=dl.slice(0,7);commit('Deadline: '+title,w);toast('In de kalender gezet');},
  go(p){st.page=p;st.sheet=false;if(p!=='wedding')st.detail=null;render();window.scrollTo(0,0);},
  sheet(o){st.sheet=!!o;render();},
  openWedding(id){if(!wed(id))return;st.detail=id;st.tab='overzicht';BC.go('wedding');},
  wTab(t){st.tab=t;render();},
  pickW(id){st.wid=id;render();},
  pickDay(d){st.day=d;render();},
  week(n){st.weekOffset+=n;render();},
  apptType(t){st.apptType=APPT_TYPES.includes(t)?t:'Alle';render();},
  deptFilter(d){st.dept=DEPTS.includes(d)?d:'Alle';render();},
  taskFilter(f){st.filter=f;render();},
  rangeLive(el){const min=+el.min,max=+el.max;el.style.setProperty('--p',((el.value-min)/(max-min)*100)+'%');const v=el.closest('.bc-range')?.querySelector('.val');if(v)v.textContent=el.value;},
  /* login */
  pickAccount(id){st.login=id&&DB.accounts.some(a=>a.id===id)?id:null;st.pin='';st.pinErr=false;render();},
  key(k){if(k==='del'){st.pin=st.pin.slice(0,-1);st.pinErr=false;render();return;}if(st.pin.length>=4)return;st.pin+=k;st.pinErr=false;
    if(st.pin.length===4){const a=DB.accounts.find(x=>x.id===st.login);if(a&&a.active&&a.pin===st.pin){try{localStorage.setItem(SESSION_KEY,a.id);}catch(e){}st.login=null;st.pin='';st.page=ROLE_INFO[a.role].home;st.day=todayIso();log('Aangemeld');save();playIntro(a.role==='owner'?'Belle':a.name.split(' ')[0]);}else{st.pin='';st.pinErr=true;}}
    render();},
  logout(){if(CLOUD){cloudLock();return;}try{localStorage.removeItem(SESSION_KEY);}catch(e){}st.page=null;st.sheet=false;st.login=null;render();window.scrollTo(0,0);},
  /* tasks */
  toggleTask(id){const t=DB.tasks.find(x=>x.id===id);if(!t)return;const m=me();if(!isFull(m.role)&&t.dept!==ROLE_INFO[m.role].dept&&m.role!=='planner')return;t.status=t.status==='completed'?'todo':'completed';commit((t.status==='completed'?'Taak afgevinkt: ':'Taak heropend: ')+t.title,t.wedding);},
  taskModal(dept){const m=me(),depts=isFull(m.role)?DEPTS:[ROLE_INFO[m.role].dept];if(!depts.includes(dept))dept=depts[0];
    modal('Nieuwe taak',field('Taak','<input name="title" required maxlength="150">')+field('Wedding',`<select name="wedding">${weddingOptions(st.wid)}</select>`)+field('Afdeling',`<select name="dept">${depts.map(d=>`<option ${d===dept?'selected':''}>${d}</option>`).join('')}</select>`)+field('Prioriteit',`<select name="priority">${Object.entries(PRIO).map(([k,l])=>`<option value="${k}" ${k==='medium'?'selected':''}>${l}</option>`).join('')}</select>`)+field('Deadline','<input type="date" name="deadline" required>'),'BC.addTask(event)');},
  addTask(e){const f=formData(e),m=me(),title=val(f,'title'),w=val(f,'wedding'),dept=val(f,'dept'),prio=val(f,'priority'),dl=val(f,'deadline');const okDept=isFull(m.role)?DEPTS.includes(dept):dept===ROLE_INFO[m.role].dept;
    if(!title||!wed(w)||!okDept||!PRIO[prio]||!isDate(dl)){toast('Controleer de invoer');return;}
    DB.tasks.push({id:uid('t'),wedding:w,title,dept,assignee:assigneeFor(dept),priority:prio,status:'todo',deadline:dl,client:false});closeModal();commit('Nieuwe taak: '+title,w);toast('Taak toegevoegd');},
  /* planning */
  toggleMs(id){const m=DB.milestones.find(x=>x.id===id);if(!m)return;m.done=!m.done;commit('Mijlpaal '+(m.done?'afgerond':'heropend')+': '+m.label,m.wedding);},
  addRun(e,w){const f=formData(e),time=val(f,'time'),title=val(f,'title');if(!wed(w)||!isTime(time)||!title)return;DB.runsheet.push({id:uid('r'),wedding:w,time,title});commit('Draaiboek: '+title,w);},
  delRun(id){const i=DB.runsheet.findIndex(x=>x.id===id);if(i<0)return;const r=DB.runsheet.splice(i,1)[0];commit('Draaiboek verwijderd: '+r.title,r.wedding);},
  setGuests(w,v){const x=wed(w);if(!x)return;x.guests=Math.max(0,Math.min(1000,parseInt(v,10)||0));commit('Gastenaantal: '+x.guests,w);},
  toggleBooking(id){const b=DB.bookings.find(x=>x.id===id);if(!b)return;b.booked=!b.booked;commit('Leverancier '+(b.booked?'geboekt':'vrijgegeven'),b.wedding);},
  addBookingModal(w){const free=DB.vendors.filter(v=>!DB.bookings.some(b=>b.wedding===w&&b.vendor===v.id));if(!free.length){toast('Alle leveranciers zijn al gekoppeld');return;}modal('Leverancier koppelen',field('Leverancier',`<select name="vendor">${free.map(v=>`<option value="${safeId(v.id)}">${esc(v.name)} · ${esc(v.category)}</option>`).join('')}</select>`),`BC.addBooking(event,'${safeId(w)}')`);},
  addBooking(e,w){const f=formData(e),v=val(f,'vendor');if(!wed(w)||!DB.vendors.some(x=>x.id===v))return;DB.bookings.push({id:uid('b'),wedding:w,vendor:v,booked:false});closeModal();commit('Leverancier gekoppeld',w);},
  vendorModal(){modal('Nieuwe leverancier',field('Naam','<input name="name" required maxlength="80">')+field('Categorie','<input name="category" required maxlength="40" placeholder="Bv. DJ, Fotograaf">')+field('Regio','<input name="city" maxlength="40">'),'BC.addVendor(event)');},
  addVendor(e){const f=formData(e),name=val(f,'name');if(!name)return;DB.vendors.push({id:uid('v'),name,category:val(f,'category'),city:val(f,'city')});closeModal();commit('Leverancier toegevoegd: '+name);},
  /* styling */
  toggleAppt(id){const a=DB.appointments.find(x=>x.id===id);if(!a)return;a.done=!a.done;commit('Afspraak '+(a.done?'afgerond':'heropend')+': '+a.title,a.wedding);},
  apptModal(w){modal('Afspraak inplannen',field('Wedding',`<select name="wedding">${weddingOptions(w||st.wid)}</select>`)+field('Soort',`<select name="type">${APPT_TYPES.map(t=>`<option>${t}</option>`).join('')}</select>`)+field('Omschrijving','<input name="title" required maxlength="100">')+`<div class="bc-inline">${field('Datum',`<input type="date" name="date" required value="${esc(st.day||todayIso())}">`)}${field('Uur','<input type="time" name="time" required value="10:00">')}</div>`+field('Locatie','<input name="place" maxlength="60" value="Atelier">'),'BC.addAppt(event)');},
  addAppt(e){const f=formData(e),w=val(f,'wedding'),type=val(f,'type'),title=val(f,'title'),date=val(f,'date'),time=val(f,'time');if(!wed(w)||!APPT_TYPES.includes(type)||!title||!isDate(date)||!isTime(time)){toast('Controleer de invoer');return;}DB.appointments.push({id:uid('ap'),wedding:w,type,title,date,time,place:val(f,'place'),done:false});st.day=date;closeModal();commit('Afspraak: '+title,w);toast('Afspraak ingepland');},
  setColor(w,i,c){if(!/^#[0-9a-fA-F]{6}$/.test(c))return;const b=boardOf(w);b.colors[i]=c;commit('Kleurenpalet aangepast',w);},
  setTheme(e,w){const f=formData(e),t=val(f,'theme');if(!t)return;boardOf(w).theme=t;commit('Thema: '+t,w);},
  addProp(e,w){const f=formData(e),t=val(f,'title');if(!t||!wed(w))return;DB.approvals.push({id:uid('a'),wedding:w,title:t,status:'pending'});commit('Voorstel aangemaakt: '+t,w);},
  propStatus(id,s){const p=DB.approvals.find(x=>x.id===id);if(!p||!['pending','approved','changes_requested'].includes(s))return;p.status=s;commit('Voorstel '+(STATUS[s]||s).toLowerCase()+': '+p.title,p.wedding);},
  /* decoration */
  toggleDecor(w,id){const i=decorOf(w).items.find(x=>x.id===id);if(!i)return;i.done=!i.done;commit('Opbouw '+(i.done?'klaar':'heropend')+': '+i.label,w);},
  addDecor(e,w){const f=formData(e),l=val(f,'label');if(!l||!wed(w))return;decorOf(w).items.push({id:uid('x'),label:l,done:false});commit('Opbouw toegevoegd: '+l,w);},
  setDecorTime(w,k,v){if(!isTime(v)||!['setup','teardown'].includes(k))return;decorOf(w)[k]=v;commit((k==='setup'?'Opbouw':'Afbouw')+' om '+v,w);},
  reserve(id,v){const i=DB.inventory.find(x=>x.id===id);if(!i)return;i.reserved=Math.max(0,Math.min(i.stock,parseInt(v,10)||0));commit('Gereserveerd: '+i.name+' '+i.reserved);},
  stock(id,d){const i=DB.inventory.find(x=>x.id===id);if(!i)return;i.stock=Math.max(0,i.stock+d);i.reserved=Math.min(i.reserved,i.stock);save();render();},
  invModal(){modal('Nieuw artikel',field('Naam','<input name="name" required maxlength="80">')+`<div class="bc-inline">${field('Voorraad','<input type="number" name="stock" min="0" max="9999" value="10" required>')}${field('Eenheid','<input name="unit" maxlength="12" value="stuks">')}</div>`,'BC.addInv(event)');},
  addInv(e){const f=formData(e),n=val(f,'name'),s=parseInt(val(f,'stock'),10);if(!n||!(s>=0))return;DB.inventory.push({id:uid('iv'),name:n,stock:s,reserved:0,unit:val(f,'unit')||'stuks'});closeModal();commit('Artikel toegevoegd: '+n);},
  /* catering */
  service(w,s){if(!SERVICE[s])return;cateringOf(w).style=s;commit('Service: '+SERVICE[s],w);},
  staff(w,v){cateringOf(w).staff=Math.max(1,Math.min(60,parseInt(v,10)||1));commit('Bediening: '+cateringOf(w).staff,w);},
  kids(w,d){const c=cateringOf(w);c.kids=Math.max(0,c.kids+d);save();render();},
  diet(w,k,d){const c=cateringOf(w);if(!(k in c.diets))return;c.diets[k]=Math.max(0,(c.diets[k]||0)+d);save();render();},
  addCourse(e,w){const f=formData(e),c=val(f,'course'),d=val(f,'dish');if(!c||!d||!wed(w))return;cateringOf(w).courses.push({id:uid('c'),course:c,dish:d});commit('Menu: '+d,w);},
  delCourse(w,id){const c=cateringOf(w);c.courses=c.courses.filter(x=>x.id!==id);commit('Gang verwijderd',w);},
  tasting(w){const c=cateringOf(w);c.tastingOk=!c.tastingOk;commit('Proeverij '+(c.tastingOk?'bevestigd':'nog niet bevestigd'),w);},
  setTasting(w,v){if(v&&!isDate(v))return;cateringOf(w).tasting=v;commit('Proeverij gepland '+(v?fdate(v):''),w);},
  /* owner */
  setBudget(w,v){const x=wed(w);if(!x||!isOwner())return;x.budget=Math.max(0,parseInt(v,10)||0);commit('Budget aangepast',w);},
  toggleInvoice(id){if(!isOwner())return;const i=DB.invoices.find(x=>x.id===id);if(!i)return;i.status=i.status==='paid'?'unpaid':'paid';commit('Factuur '+(i.status==='paid'?'betaald':'open')+': '+i.supplier,i.wedding);},
  leadStatus(id,s){const l=DB.leads.find(x=>x.id===id);if(!l||l.status==='converted'||!['new','contacted','consultation','lost'].includes(s))return;l.status=s;commit('Lead: '+l.name+' → '+(STATUS[s]||s));},
  convert(id){const l=DB.leads.find(x=>x.id===id);if(!l||l.status==='converted')return;const cid=uid('c'),wid=uid('w');DB.clients.push({id:cid,name:l.name,email:l.email});
    DB.weddings.push({id:wid,couple:l.name,date:l.wedding_date||'',venue:'Nog te bepalen',guests:l.guest_count||0,package:'Signature',status:'planning',budget:0,spent:0,planner:assigneeFor('Planning'),client_id:cid});
    ['Kennismaking','Locatie vastgelegd','Moodboard goedgekeurd','Gastenlijst compleet','Draaiboek klaar'].forEach((label,i)=>DB.milestones.push({id:uid('ms'),wedding:wid,label,done:i===0}));
    l.status='converted';l.client_id=cid;l.wedding_id=wid;log('Lead omgezet naar wedding',wid);save();toast('Wedding aangemaakt');BC.openWedding(wid);},
  weddingModal(){modal('Nieuwe wedding',field('Koppel','<input name="couple" required maxlength="80" placeholder="Naam & Naam">')+`<div class="bc-inline">${field('Datum','<input type="date" name="date" required>')}${field('Gasten','<input type="number" name="guests" min="0" max="1000" value="100">')}</div>`+field('Locatie','<input name="venue" maxlength="80">')+field('Pakket','<select name="package"><option>Essential</option><option selected>Signature</option><option>Prestige</option></select>'),'BC.addWedding(event)');},
  addWedding(e){if(!isOwner())return;const f=formData(e),c=val(f,'couple'),d=val(f,'date');if(!c||!isDate(d)){toast('Controleer de invoer');return;}const wid=uid('w');
    DB.weddings.push({id:wid,couple:c,date:d,venue:val(f,'venue')||'Nog te bepalen',guests:parseInt(val(f,'guests'),10)||0,package:['Essential','Signature','Prestige'].includes(val(f,'package'))?val(f,'package'):'Signature',status:'planning',budget:0,spent:0,planner:assigneeFor('Planning')});
    ['Kennismaking','Locatie vastgelegd','Moodboard goedgekeurd','Gastenlijst compleet','Draaiboek klaar'].forEach(label=>DB.milestones.push({id:uid('ms'),wedding:wid,label,done:false}));
    closeModal();log('Nieuwe wedding',wid);save();toast('Wedding aangemaakt');BC.openWedding(wid);},
  toggleAccount(id){if(!isOwner())return;if(CLOUD){cloudToggle(id);return;}const a=DB.accounts.find(x=>x.id===id);if(!a||isFull(a.role))return;a.active=!a.active;commit('Account '+(a.active?'geactiveerd':'gedeactiveerd')+': '+a.name);},
  setAccess(r,k,on){if(!isOwner()||!DB.access[r]||!ACCESS_AREAS.some(x=>x[0]===k))return;DB.access[r][k]=on?1:0;commit('Toegang '+ROLE_INFO[r].label+': '+k+' '+(on?'aan':'uit'));},
  pinModal(id){const a=DB.accounts.find(x=>x.id===id);if(!a)return;modal('Nieuwe PIN voor '+a.name,field('PIN (4 cijfers)','<input name="pin" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" required>'),`BC.setPin(event,'${safeId(id)}')`);},
  setPin(e,id){if(!isOwner())return;const f=formData(e),p=val(f,'pin'),a=DB.accounts.find(x=>x.id===id);if(!a||!/^\d{4}$/.test(p)){toast('Gebruik 4 cijfers');return;}a.pin=p;closeModal();commit('PIN gewijzigd: '+a.name);toast('PIN opgeslagen');},
  memberModal(){if(CLOUD){cloudInviteModal();return;}modal('Nieuw teamlid',field('Naam','<input name="name" required maxlength="60">')+field('Afdeling',`<select name="role">${Object.keys(DB.access).map(r=>`<option value="${r}">${ROLE_INFO[r].label}</option>`).join('')}</select>`)+field('PIN (4 cijfers)','<input name="pin" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" required>'),'BC.addMember(event)');},
  addMember(e){if(!isOwner())return;const f=formData(e),n=val(f,'name'),r=val(f,'role'),p=val(f,'pin');if(!n||!DB.access[r]||!/^\d{4}$/.test(p)){toast('Controleer de invoer');return;}DB.accounts.push({id:uid('u'),name:n,role:r,pin:p,active:true});closeModal();commit('Teamlid toegevoegd: '+n);}
};

/* Plug into the existing app: the "admin" screen now renders the Atelier.
   The atelier only exists on the separate staff page (atelier.html, sets window.BC_STAFF).
   The public site and client portal can never switch to it, and the staff page never leaves it. */
Object.assign(window.BC,cloudActions);
window.renderAdmin=renderAtelier;
if(window.BC_STAFF)screen='admin';
const baseGoRoute=window.goRoute;
window.goRoute=function(r){if(window.BC_STAFF||r==='admin')return;baseGoRoute(r);};
const baseRender=window.render;
window.render=function(){document.body.classList.toggle('bc-on',screen==='admin');baseRender();};
/* Cloud: shared data goes to the server instead of this browser. */
if(CLOUD){window.save=function(){if(cs.phase==='ready'&&CLOUD.profile)CLOUD.queuePush(stripState());return true;};cloudBoot();}
})();
