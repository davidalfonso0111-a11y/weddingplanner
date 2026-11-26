'use strict';
// Demonstration only. No authentication or server-side authorization.
// Never enter real client information in this public prototype.
const STORAGE_KEY = 'belles_creator_demo_v2';
const DEFAULT = {
  leads: [
    {id:'l1',name:'Sophie & Lars Peeters',email:'sophie@example.com',phone:'+32 470 12 34 56',wedding_date:'2027-06-12',guest_count:110,message:'Romantische locatie met tuinsfeer.',status:'new',created:'2026-11-20'},
    {id:'l2',name:'Mila De Smet',email:'mila@example.com',phone:'',wedding_date:'2027-09-04',guest_count:60,message:'Interesse in een kennismakingsgesprek.',status:'contacted',created:'2026-11-18'}
  ],
  clients: [
    {id:'c1',name:'Emma & Tom Verbeke',email:'emma@example.com'},
    {id:'c2',name:'Lotte & Jens Maes',email:'lotte@example.com'},
    {id:'c3',name:'Aisha & Karim El Idrissi',email:'aisha@example.com'}
  ],
  weddings: [
    {id:'w1',couple:'Emma & Tom Verbeke',date:'2027-05-22',venue:'Kasteel Oud-Wijnendale',guests:120,package:'Signature',status:'in_progress',budget:38000,spent:21400,planner:'Anja',client_id:'c1'},
    {id:'w2',couple:'Lotte & Jens Maes',date:'2026-12-19',venue:'Hoeve De Lindehof',guests:75,package:'Essential',status:'planning',budget:18500,spent:16200,planner:'Anja',client_id:'c2'},
    {id:'w3',couple:'Aisha & Karim El Idrissi',date:'2027-08-14',venue:'Loft Brussel',guests:200,package:'Prestige',status:'planning',budget:62000,spent:9800,planner:'Sven',client_id:'c3'}
  ],
  tasks: [
    {id:'t1',wedding:'w1',title:'Venue-contract ondertekenen',dept:'Planning',assignee:'Anja',priority:'high',status:'completed',deadline:'2026-12-05',client:false},
    {id:'t2',wedding:'w1',title:'Moodboard goedkeuren',dept:'Styling',assignee:'Lena',priority:'medium',status:'under_review',deadline:'2026-12-10',client:true},
    {id:'t3',wedding:'w2',title:'Catering-proeverij bevestigen',dept:'Planning',assignee:'Anja',priority:'urgent',status:'waiting',deadline:'2026-11-28',client:true},
    {id:'t4',wedding:'w3',title:'Bloemenofferte vergelijken',dept:'Styling',assignee:'Lena',priority:'medium',status:'in_progress',deadline:'2026-12-15',client:false},
    {id:'t5',wedding:'w2',title:'Factuur drukkerij verwerken',dept:'Finance',assignee:'Joris',priority:'low',status:'todo',deadline:'2026-12-02',client:false},
    {id:'t6',wedding:'w1',title:'Gastenlijst invullen',dept:'Planning',assignee:'Anja',priority:'high',status:'todo',deadline:'2026-12-20',client:true}
  ],
  invoices: [
    {id:'i1',supplier:'Bloemen Van Hove',number:'2026-1187',total:2450,vat:21,status:'unpaid',due:'2026-12-03',wedding:'w3',category:'Flowers'},
    {id:'i2',supplier:'Catering Het Gilde',number:'INV-44021',total:6800,vat:6,status:'paid',due:'2026-11-15',wedding:'w1',category:'Catering'},
    {id:'i3',supplier:'Drukkerij Lijn',number:'DL-903',total:640,vat:21,status:'unpaid',due:'2026-11-30',wedding:'w2',category:'Stationery'}
  ],
  team: [
    {id:'m1',name:'Anja Claes',role:'planner',active:true},
    {id:'m2',name:'Lena Peeters',role:'styling',active:true},
    {id:'m3',name:'Joris Wouters',role:'finance',active:true},
    {id:'m4',name:'Sven Dewit',role:'planner',active:false}
  ],
  perms: {
    owner:{weddings:'all',leads:1,clients:1,tasks:1,planning:1,styling:1,finance:1,team:1,activity:1,settings:1},
    planner:{weddings:'assigned',leads:1,clients:1,tasks:1,planning:1,styling:0,finance:0,team:0,activity:0,settings:0},
    styling:{weddings:'assigned',leads:0,clients:0,tasks:1,planning:0,styling:1,finance:0,team:0,activity:0,settings:0},
    finance:{weddings:'read',leads:0,clients:0,tasks:0,planning:0,styling:0,finance:1,team:0,activity:0,settings:0}
  },
  approvals: [
    {id:'a1',wedding:'w1',title:'Moodboard — Romantische tuin',status:'approved'},
    {id:'a2',wedding:'w1',title:'Tafelstyling — Olijfgroen & ivoor',status:'pending'},
    {id:'a3',wedding:'w1',title:'Bloemenvoorstel bruidsboeket',status:'pending'}
  ],
  messages: [
    {wedding:'w1',who:'Anja',text:'Welkom in jullie persoonlijke weddingomgeving!',me:false},
    {wedding:'w1',who:'Emma & Tom',text:'Dank je! We kijken ernaar uit.',me:true}
  ],
  vendors: [
    {id:'v1',name:'Bloemen Van Hove',category:'Florist',city:'Gent'},
    {id:'v2',name:'Catering Het Gilde',category:'Caterer',city:'Brugge'},
    {id:'v3',name:'Drukkerij Lijn',category:'Stationery',city:'Kortrijk'},
    {id:'v4',name:'Fotostudio Lumen',category:'Photographer',city:'Antwerpen'}
  ],
  accounts: [
    {id:'u1',name:'Eigenaar',role:'owner',pin:'1111',active:true},
    {id:'u2',name:'Anja Claes',role:'planner',pin:'2222',active:true},
    {id:'u3',name:'Lena Peeters',role:'stylist',pin:'3333',active:true},
    {id:'u4',name:'Fatou Diallo',role:'decoration',pin:'4444',active:true},
    {id:'u5',name:'Yasmina Benali',role:'catering',pin:'5555',active:true}
  ],
  access: {
    planner:{weddings:1,leads:1,calendar:1,vendors:1},
    stylist:{weddings:1,leads:0,calendar:1,vendors:0},
    decoration:{weddings:1,leads:0,calendar:1,vendors:1},
    catering:{weddings:1,leads:0,calendar:1,vendors:1}
  },
  deptTasks: [
    {id:'d1',wedding:'w2',dept:'Decoratie',title:'Tafellopers en kandelaars klaarzetten',priority:'high',status:'todo',deadline:'2026-12-17'},
    {id:'d2',wedding:'w1',dept:'Decoratie',title:'Proefopstelling bloemenboog',priority:'medium',status:'todo',deadline:'2027-04-30'},
    {id:'d3',wedding:'w2',dept:'Catering',title:'Definitief menu doorsturen naar keuken',priority:'urgent',status:'todo',deadline:'2026-11-30'},
    {id:'d4',wedding:'w3',dept:'Catering',title:'Halal-leverancier bevestigen',priority:'high',status:'in_progress',deadline:'2027-02-01'}
  ],
  milestones: [
    {id:'ms1',wedding:'w1',label:'Kennismaking',done:true},{id:'ms2',wedding:'w1',label:'Locatie vastgelegd',done:true},{id:'ms3',wedding:'w1',label:'Moodboard goedgekeurd',done:false},{id:'ms4',wedding:'w1',label:'Gastenlijst compleet',done:false},{id:'ms5',wedding:'w1',label:'Draaiboek klaar',done:false},
    {id:'ms6',wedding:'w2',label:'Kennismaking',done:true},{id:'ms7',wedding:'w2',label:'Locatie vastgelegd',done:true},{id:'ms8',wedding:'w2',label:'Moodboard goedgekeurd',done:true},{id:'ms9',wedding:'w2',label:'Gastenlijst compleet',done:true},{id:'ms10',wedding:'w2',label:'Draaiboek klaar',done:false},
    {id:'ms11',wedding:'w3',label:'Kennismaking',done:true},{id:'ms12',wedding:'w3',label:'Locatie vastgelegd',done:true},{id:'ms13',wedding:'w3',label:'Moodboard goedgekeurd',done:false},{id:'ms14',wedding:'w3',label:'Gastenlijst compleet',done:false},{id:'ms15',wedding:'w3',label:'Draaiboek klaar',done:false}
  ],
  runsheet: [
    {id:'r1',wedding:'w2',time:'13:30',title:'Ceremonie in de tuin'},
    {id:'r2',wedding:'w2',time:'14:30',title:'Receptie & fotoshoot'},
    {id:'r3',wedding:'w2',time:'18:00',title:'Diner'},
    {id:'r4',wedding:'w2',time:'21:30',title:'Openingsdans'}
  ],
  bookings: [
    {id:'b1',wedding:'w1',vendor:'v2',booked:true},{id:'b2',wedding:'w1',vendor:'v4',booked:true},{id:'b3',wedding:'w1',vendor:'v1',booked:false},
    {id:'b4',wedding:'w2',vendor:'v2',booked:true},{id:'b5',wedding:'w2',vendor:'v3',booked:true},{id:'b6',wedding:'w2',vendor:'v4',booked:false},
    {id:'b7',wedding:'w3',vendor:'v1',booked:false},{id:'b8',wedding:'w3',vendor:'v4',booked:false}
  ],
  appointments: [
    {id:'ap1',wedding:'w2',date:'2026-11-27',time:'10:00',type:'Pasbeurt',title:'Laatste pasbeurt bruidsjurk',place:'Atelier Gent',done:false},
    {id:'ap2',wedding:'w1',date:'2026-11-27',time:'15:00',type:'Moodboard',title:'Moodboard-sessie Emma & Tom',place:'Online',done:false},
    {id:'ap3',wedding:'w3',date:'2026-11-30',time:'11:00',type:'Locatiebezoek',title:'Lichtcheck Loft Brussel',place:'Loft Brussel',done:false},
    {id:'ap4',wedding:'w2',date:'2026-12-02',time:'14:00',type:'Haar & make-up',title:'Proefkapsel Lotte',place:'Atelier Gent',done:false}
  ],
  styleBoards: [
    {wedding:'w1',theme:'Romantische tuin',colors:['#f3e6d6','#c9a57a','#7d8465','#3a1517']},
    {wedding:'w2',theme:'Winterse elegantie',colors:['#fbe9c6','#d8ae6a','#4c2f1e','#160706']},
    {wedding:'w3',theme:'Gouden loft',colors:['#25090b','#b98a48','#fbe9c6','#ffffff']}
  ],
  decor: [
    {wedding:'w2',setup:'08:00',teardown:'01:30',items:[{id:'x1',label:'Ceremonie-stoelen + linten',done:true},{id:'x2',label:'Bloemenboog',done:false},{id:'x3',label:'Tafelstyling 8 ronde tafels',done:false},{id:'x4',label:'Kaarsen & sfeerverlichting',done:false},{id:'x5',label:'Welkomstbord',done:true}]},
    {wedding:'w1',setup:'07:30',teardown:'02:00',items:[{id:'x6',label:'Tuinceremonie opstelling',done:false},{id:'x7',label:'Lange tafels met lopers',done:false},{id:'x8',label:'Lichtsnoeren',done:false}]},
    {wedding:'w3',setup:'09:00',teardown:'03:00',items:[{id:'x9',label:'Gouden tafelset',done:false},{id:'x10',label:'Lounge-hoek',done:false},{id:'x11',label:'Fotowand',done:false}]}
  ],
  inventory: [
    {id:'iv1',name:'Gouden kandelaars',stock:60,reserved:32,unit:'stuks'},
    {id:'iv2',name:'Fluwelen tafellopers bordeaux',stock:24,reserved:8,unit:'stuks'},
    {id:'iv3',name:'Ronde tafels',stock:20,reserved:8,unit:'stuks'},
    {id:'iv4',name:'Chiavari-stoelen goud',stock:150,reserved:75,unit:'stuks'},
    {id:'iv5',name:'Lichtsnoeren',stock:12,reserved:11,unit:'sets'},
    {id:'iv6',name:'Bloemenboog',stock:2,reserved:1,unit:'stuks'}
  ],
  catering: [
    {wedding:'w2',style:'seated',staff:8,kids:6,tasting:'2026-11-28',tastingOk:false,diets:{vegetarisch:8,vegan:2,halal:12,glutenvrij:3,allergie:4},courses:[{id:'c1',course:'Voorgerecht',dish:'Carpaccio van rund, truffel'},{id:'c2',course:'Hoofdgerecht',dish:'Hoevekip, seizoensgroenten'},{id:'c3',course:'Dessert',dish:'Bruidstaart & mignardises'}]},
    {wedding:'w1',style:'walking',staff:12,kids:10,tasting:'2027-03-14',tastingOk:false,diets:{vegetarisch:14,vegan:3,halal:0,glutenvrij:5,allergie:6},courses:[{id:'c4',course:'Walking dinner',dish:'8 gangen, seizoensgebonden'}]},
    {wedding:'w3',style:'buffet',staff:18,kids:20,tasting:'2027-05-02',tastingOk:false,diets:{vegetarisch:20,vegan:6,halal:200,glutenvrij:8,allergie:9},courses:[{id:'c5',course:'Buffet',dish:'Marokkaans-Belgisch feestbuffet'}]}
  ],
  log: [{t:'2026-11-25T09:12:00',who:'Anja',what:'Venue-contract ondertekend',w:'Emma & Tom'}]
};
function freshDemo(){ return JSON.parse(JSON.stringify(DEFAULT)); }
function load(){
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return freshDemo();
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return freshDemo();
    const result = freshDemo();
    for (const key of Object.keys(result)) {
      if (Array.isArray(result[key])) {
        if (Array.isArray(parsed[key]) && parsed[key].every(item => item && typeof item === 'object' && !Array.isArray(item))) result[key] = parsed[key];
      } else if ((key === 'perms' || key === 'access') && parsed[key] && typeof parsed[key] === 'object') {
        for (const role of Object.keys(result[key])) {
          if (parsed[key][role] && typeof parsed[key][role] === 'object') Object.assign(result[key][role], parsed[key][role]);
        }
      }
    }
    if (!result.weddings.length) result.weddings = freshDemo().weddings;
    return result;
  } catch (error) { return freshDemo(); }
}
let DB = load();
function save(){
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(DB)); return true; }
  catch (error) {
    console.warn('Local demo storage unavailable. Changes remain in memory only.');
    if (typeof toast === 'function') toast('Lokale opslag niet beschikbaar; wijzigingen blijven alleen in deze sessie.');
    return false;
  }
}
function resetDemo(){ DB = freshDemo(); save(); if (typeof render === 'function') render(); if (typeof toast === 'function') toast('Demodata hersteld'); }
