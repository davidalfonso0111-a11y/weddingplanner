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
      } else if (key === 'perms' && parsed.perms && typeof parsed.perms === 'object') {
        for (const role of Object.keys(result.perms)) {
          if (parsed.perms[role] && typeof parsed.perms[role] === 'object') Object.assign(result.perms[role], parsed.perms[role]);
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
