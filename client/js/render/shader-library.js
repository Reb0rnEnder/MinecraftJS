import {platform} from '../platform/platform.js';
const INDEX='shaderpacks/library',LEGACY='shaderpacks/final-stage';
export class ShaderLibrary {
 constructor(pack){this.pack=pack;this.entries=[];this.selected=null;this.enabled=false;this.revision=0;}
 metadata(){return {entries:this.entries,selected:this.selected,enabled:this.enabled};}
 saveCurrent(){const entry=this.entries.find(e=>e.id===this.selected);if(entry&&this.pack.bytes){entry.options={...this.pack.options};this.enabled=this.pack.enabled;}platform().saveSetting(INDEX,JSON.stringify(this.metadata()));}
 async load(){
  let saved;try{saved=JSON.parse(platform().loadSetting(INDEX)||'null');}catch{}
  if(Array.isArray(saved?.entries)){
   this.entries=saved.entries.filter(e=>e&&typeof e.id==='string'&&e.id.startsWith('shaderpacks/pack/')&&typeof e.name==='string').map(e=>({id:e.id,name:e.name,options:e.options||{}}));this.selected=saved.selected;this.enabled=saved.enabled!==false;
  }else{
   const bytes=await platform().files.get(LEGACY);
   if(bytes?.length){let meta={};try{meta=JSON.parse(platform().loadSetting(LEGACY+'.meta')||'{}');}catch{}
    const entry={id:this.newId(),name:meta.name||'Shader pack',options:meta.options||{}};await platform().files.put(entry.id,bytes);this.entries=[entry];this.selected=entry.id;this.enabled=meta.enabled!==false;this.saveCurrent();
   }
  }
  if(this.selected&&this.enabled)await this.select(this.selected,{enabled:this.enabled});
 }
 newId(){return 'shaderpacks/pack/'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);}
 async add(name,bytes){
  this.saveCurrent();this.pack.load(name,bytes);const entry={id:this.newId(),name,options:{}};await platform().files.put(entry.id,bytes);this.entries.push(entry);this.selected=entry.id;this.enabled=true;this.saveCurrent();return entry;
 }
 async select(id,{enabled=true}={}){
  if(id===null){++this.revision;this.pack.enabled=false;this.enabled=false;this.saveCurrent();return;}
  if(id==='(internal)'){++this.revision;this.saveCurrent();this.pack.clear();this.selected=id;this.enabled=true;this.saveCurrent();return;}
  const entry=this.entries.find(e=>e.id===id);if(!entry)throw Error('Shader pack is no longer in the library');
  this.saveCurrent();const revision=++this.revision,bytes=await platform().files.get(entry.id);if(revision!==this.revision)return;
  if(!bytes?.length)throw Error('The saved shader ZIP is missing; import it again');
  this.pack.load(entry.name,bytes,entry.options,{restore:true});this.pack.enabled=enabled;this.selected=id;this.enabled=enabled;this.saveCurrent();
 }
 async remove(id=this.selected){
  if(!id)return;const entry=this.entries.find(e=>e.id===id);if(!entry)return;
  ++this.revision;await platform().files.delete(id);this.entries=this.entries.filter(e=>e.id!==id);if(this.selected===id){this.selected=null;this.enabled=false;this.pack.clear();}this.saveCurrent();
 }
}
