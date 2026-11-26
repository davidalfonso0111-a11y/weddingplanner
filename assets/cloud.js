/* Belles Creators · Atelier cloud layer (Supabase).
   Active only when assets/config.js holds a Supabase URL + anon key and supabase-js is loaded.
   Without it the atelier keeps running as the local demo. All access control is enforced
   server-side by Row Level Security (see supabase/migrations). */
(function(){
'use strict';
const cfg=window.BC_SUPABASE||{};
const lib=window.supabase;
const enabled=!!(cfg.url&&cfg.anonKey&&lib&&typeof lib.createClient==='function');
const UNLOCK_KEY='bc_cloud_unlocked';
let sb=null,profile=null,stateVersion=0,pushTimer=null,pending=null,pushing=false,listeners=[];

function client(){if(!sb)sb=lib.createClient(cfg.url,cfg.anonKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});return sb;}
function emit(evt,detail){for(const fn of listeners){try{fn(evt,detail);}catch(e){console.error(e);}}}
function errText(e){return (e&&(e.message||e.error_description||e.error))||'Er ging iets mis';}

async function loadProfile(){
  const {data:{user}}=await client().auth.getUser();
  if(!user){profile=null;return null;}
  const {data,error}=await client().from('profiles').select('id,name,email,role,active').eq('id',user.id).maybeSingle();
  if(error)throw error;
  profile=data&&data.active?data:null;
  return profile;
}

const api={
  enabled,
  ready:false,
  get profile(){return profile;},
  on(fn){listeners.push(fn);},
  async init(){
    if(!enabled)return null;
    client().auth.onAuthStateChange((event)=>{if(event==='PASSWORD_RECOVERY')emit('recovery');if(event==='SIGNED_OUT'){profile=null;emit('signedout');}});
    try{const {data:{session}}=await client().auth.getSession();if(session)await loadProfile();}catch(e){console.warn('Cloud init',e);profile=null;}
    api.ready=true;return profile;
  },
  isUnlocked(){if(!profile)return false;try{return sessionStorage.getItem(UNLOCK_KEY)===profile.id;}catch(e){return false;}},
  unlock(){if(profile)try{sessionStorage.setItem(UNLOCK_KEY,profile.id);}catch(e){}},
  lock(){try{sessionStorage.removeItem(UNLOCK_KEY);}catch(e){}},
  async signIn(email,password){
    const {error}=await client().auth.signInWithPassword({email,password});
    if(error)throw new Error(error.message==='Invalid login credentials'?'E-mail of wachtwoord klopt niet':errText(error));
    const p=await loadProfile();
    if(!p){await client().auth.signOut();throw new Error('Dit account is niet (meer) actief. Vraag het aan de owner.');}
    return p;
  },
  async signOut(){api.lock();profile=null;await client().auth.signOut();},
  async sendReset(email){const {error}=await client().auth.resetPasswordForEmail(email,{redirectTo:location.origin+location.pathname});if(error)throw new Error(errText(error));},
  async updatePassword(pw){const {error}=await client().auth.updateUser({password:pw});if(error)throw new Error(errText(error));await loadProfile();},
  async hasPin(){const {data,error}=await client().rpc('has_pin');if(error)throw error;return !!data;},
  async setPin(pin){const {error}=await client().rpc('set_pin',{p_pin:pin});if(error)throw new Error(errText(error));},
  async verifyPin(pin){const {data,error}=await client().rpc('verify_pin',{p_pin:pin});if(error)throw new Error(errText(error));return data;},
  /* shared atelier data */
  async loadState(){
    const {data,error}=await client().from('atelier_state').select('data,version').eq('id',1).maybeSingle();
    if(error)throw error;
    if(!data)return null;
    stateVersion=Number(data.version)||0;return data.data;
  },
  async seedState(obj){
    const {error}=await client().from('atelier_state').insert({id:1,data:obj,version:1,updated_by:profile?.id});
    if(error&&error.code!=='23505')throw error;
    stateVersion=1;
  },
  queuePush(obj){pending=obj;clearTimeout(pushTimer);pushTimer=setTimeout(api.flush,700);emit('saving');},
  async flush(){
    if(pushing||!pending||!profile)return;
    pushing=true;const obj=pending;pending=null;
    try{
      const {data,error}=await client().from('atelier_state').update({data:obj,version:stateVersion+1,updated_at:new Date().toISOString(),updated_by:profile.id}).eq('id',1).eq('version',stateVersion).select('version');
      if(error)throw error;
      if(!data||!data.length){emit('conflict');}
      else{stateVersion=Number(data[0].version);emit('saved');}
    }catch(e){console.warn('Cloud save',e);pending=pending||obj;emit('offline');setTimeout(api.flush,5000);}
    finally{pushing=false;if(pending)api.flush();}
  },
  async remoteVersion(){const {data}=await client().from('atelier_state').select('version').eq('id',1).maybeSingle();return data?Number(data.version):0;},
  get version(){return stateVersion;},
  /* team */
  async listProfiles(){const {data,error}=await client().from('profiles').select('id,name,email,role,active').order('created_at');if(error)throw error;return data||[];},
  async setActive(id,active){const {error}=await client().from('profiles').update({active}).eq('id',id);if(error)throw new Error(errText(error));},
  async resetPin(id){const {error}=await client().rpc('reset_pin',{p_user:id});if(error)throw new Error(errText(error));},
  async invite(payload){const {data,error}=await client().functions.invoke('invite-staff',{body:payload});if(error){let msg=errText(error);try{const b=await error.context.json();if(b&&b.error)msg=b.error;}catch(e){}throw new Error(msg);}return data;},
  /* owner documents */
  async listDocs(){const {data,error}=await client().from('documents').select('*').order('created_at',{ascending:false});if(error)throw error;return data||[];},
  async uploadDoc(file,meta){
    const id=crypto.randomUUID(),safe=file.name.replace(/[^\w.\- ]+/g,'_').slice(-120),path=id+'/'+safe;
    const up=await client().storage.from('documents').upload(path,file,{contentType:file.type||'application/octet-stream',upsert:false});
    if(up.error)throw new Error(errText(up.error));
    const row={id,section:meta.section,title:meta.title,person:meta.person||'',wedding:meta.wedding||'',signed:!!meta.signed,signed_on:meta.date||null,file_path:path,file_name:file.name.slice(0,140),mime:file.type||'application/octet-stream',size:file.size};
    const ins=await client().from('documents').insert(row);
    if(ins.error){await client().storage.from('documents').remove([path]);throw new Error(errText(ins.error));}
    return row;
  },
  async signedUrl(path){const {data,error}=await client().storage.from('documents').createSignedUrl(path,60);if(error)throw new Error(errText(error));return data.signedUrl;},
  async download(path){const {data,error}=await client().storage.from('documents').download(path);if(error)throw new Error(errText(error));return data;},
  async updateDoc(id,patch){const {error}=await client().from('documents').update(patch).eq('id',id);if(error)throw new Error(errText(error));},
  async deleteDoc(doc){const r=await client().storage.from('documents').remove([doc.file_path]);if(r.error)throw new Error(errText(r.error));const {error}=await client().from('documents').delete().eq('id',doc.id);if(error)throw new Error(errText(error));}
};
window.BCCloud=api;
})();
