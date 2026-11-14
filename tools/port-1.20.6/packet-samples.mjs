// Schema-driven wire exercise corpus. Native codec decoding/re-encoding is the
// independent oracle; schema self-consistency alone is never acceptance.
import {Writer766} from '../../client/js/net/configuration-1.20.6.js';
import {writeAnonymousNbt} from '../../client/js/net/nbt-anonymous.js';
// Public test key; no certificate-authentication claim.
export const publicKey=Buffer.from('MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAu3knUKXrX+JUITb6UCDnOLDrotLkI4xlM++TN8KeXIaM6I+oveenZDLjQhpauhrcE9qiFy8pBjwWsAScW3PahcDplqNxSNlj9FTftdd+MCXDdSK6Ey1bTA0YjRZsMrTrqSp3MREifk6+jX8cScEr6h1fn80KytGeNLNUhWDonFsSP5UgtkEF5GameKno/UXF6D+Z+c89ZlQvCE7Mz7ApAoijRg4Ce7Z+RpOcBvBmOZpN8SP3FFvGCTwOWLVAARQBPwLvwNwSvmQ3l2aEb0lKNoOU+/bOOh5AUmZH3+IW+QymMouzRd9waTD8ORW8Sgz/LF0sdtpGwiL0wokgTM2SmQIDAQAB','base64');
const uuid='12345678-1234-4234-8234-123456789abc';
const nbt={t:10,v:{text:{t:8,v:'Packet fixture'}}};
const primitiveNames=new Set(['i8','u8','i16','u16','i32','i64','f32','f64','bool','varint','optvarint','varlong','string','restBuffer','UUID','position','anonymousNbt','anonOptionalNbt','Slot','void','vec3f','vec3f64','vec3i16','vec4f']);
const scope=(value,parent,path)=>({value,parent,path});
function get(current,path){for(const p of String(path).split('/')){if(!p||p==='.')continue;if(p==='..')current=current?.parent;else current=scope(current?.value?.[p],current,(current?.path??'')+'.'+p);}return current?.value;}
function refPath(current,path){for(const p of String(path).split('/')){if(!p||p==='.')continue;if(p==='..')current=current?.parent;else current=scope(current?.value?.[p],current,(current?.path??'')+'.'+p);}return current?.path;}
function chosen(path,mode,name){
 if(['width','height'].includes(name)&&path.includes('recipe'))return 1;
 if(name==='data'&&path.includes('entity_sound'))return 0;
 if(path.includes('.redirectNode=1'))return 1;
 return 0;
}
export function packetSample(schema,name,mode='dense',overrides={}){
 const w=new Writer766().varint(schema.ids[name]),coverage=new Set(),trace=[],types=schema.types,dense=mode==='dense';
 if(['map_chunk','update_light'].includes(name)&&dense){const root='packet_'+name;for(const f of ['skyLightMask','blockLightMask'])overrides[root+'.'+f+'[]']=2n;for(const f of ['emptySkyLightMask','emptyBlockLightMask'])overrides[root+'.'+f+'[]']=0n;for(const f of ['skyLight','blockLight'])overrides[root+'.'+f+'[].length']=2048;}
 if(name==='declare_commands')overrides['packet_declare_commands.nodes.length']=dense?2:1;
 function value(spec,current,path,forced){
  if(typeof spec==='string'){
   if(!primitiveNames.has(spec)){if(!types[spec])throw Error('Missing sample type '+spec);return value(types[spec],current,path,forced);}
   coverage.add('primitive:'+spec);
   const v=forced??overrides[path];
   switch(spec){
    case 'void':return undefined;
    case 'bool':w.bool(v??dense);return v??dense;
    case 'i8':case 'u8':case 'i16':case 'u16':case 'i32':case 'f32':case 'f64':case 'varint':case 'optvarint':{const n=v??chosen(path,mode,path.split('.').at(-1));w[spec==='optvarint'?'varint':spec](n);return n;}
    case 'i64':case 'varlong':{const n=BigInt(v??23);w[spec](n);return n;}
    case 'string':{const text=v??(path.endsWith('.locale')?'en_us':path.endsWith('.argumentName')||name==='player_info'&&path.endsWith('.player=true.name')?'Fixture':'minecraft:fixture');w.string(text);return text;}
    case 'UUID':w.uuid(v??uuid);return v??uuid;
    case 'position':{const p=v??{x:3,y:-1,z:4};w.position(p.x,p.y,p.z);return p;}
    case 'anonymousNbt':writeAnonymousNbt(w,v??nbt);return v??nbt;
    case 'anonOptionalNbt':writeAnonymousNbt(w,dense?(v??nbt):null);return dense?(v??nbt):null;
    case 'Slot':{const s=dense?{id:1,count:1,componentPatch:{added:[],removed:[]}}:null;w.slot(s);return s;}
    case 'restBuffer':w.raw(new Uint8Array());return new Uint8Array();
    case 'vec3f':case 'vec3f64':case 'vec3i16':case 'vec4f':{const count=spec==='vec4f'?4:3,write=spec==='vec3f64'?'f64':spec==='vec3i16'?'i16':'f32',p={};for(const axis of ['x','y','z','w'].slice(0,count)){w[write](0);p[axis]=0;}return p;}
   }
  }
  const[k,a]=spec;coverage.add('constructor:'+k);
  if(k==='container'){
   const out={},s=scope(out,current,path);for(const f of a){const v=value(f.type,s,path+'.'+(f.name??'$anon'));if(f.anon&&v&&typeof v==='object')Object.assign(out,v);else if(v!==undefined)out[f.name]=v;}return out;
  }
  if(k==='array'){
   let n=a.count!==undefined?Number(typeof a.count==='number'?a.count:get(current,a.count)):overrides[path+'.length']??(dense?1:0);
   if(/\.children$/.test(path))n=0;
   if(a.countType)value(a.countType,current,path+'.length',n);
   if(!Number.isInteger(n)||n<0||n>4096)throw Error('Bad sample array count '+path+' '+n);
   return Array.from({length:n},(_,i)=>{
    if(name==='declare_commands'&&path==='packet_declare_commands.nodes'&&i===1){
     const saved=overrides;overrides={};const root=value(a.type,current,path+'[]');overrides=saved;return root;
    }
    return value(a.type,current,path+'[]');
   });
  }
  if(k==='option'){const present=overrides[path+'.present']??dense;trace.push({kind:'option',path,control:path+'.present',keys:[false,true],current:present});w.bool(present);return present?value(a,current,path+'?'):null;}
  if(k==='switch'){const key=String(get(current,a.compareTo));trace.push({kind:'switch',path,control:refPath(current,a.compareTo),keys:Object.keys(a.fields||{}),current:key});const branch=a.fields?.[key]??a.default;coverage.add('switch:'+path+'='+key);if(branch===undefined)throw Error('No sample switch '+path+' '+key);return value(branch,current,path+'='+key);}
  if(k==='mapper'){const keys=Object.keys(a.mappings).sort((a,b)=>Number(a)-Number(b));let raw=overrides[path]??Number(keys[0]);if(typeof raw==='string'&&!/^-?\d+$/.test(raw))raw=Number(keys.find(k=>a.mappings[k]===raw));trace.push({kind:'mapper',path,control:path,keys:keys.map(Number),current:raw});value(a.type,current,path+'.enum',raw);return a.mappings[String(raw)];}
  if(k==='bitfield'){
   const total=a.reduce((sum,f)=>sum+f.size,0);coverage.add('bitfield:'+total);let raw=0n;const out={};
   for(const f of a){let n=overrides[path+'.'+f.name]??(f.name==='unused'||f.name==='command_node_type'||path.endsWith('.flags')&&path.includes('packet_declare_commands')?0:dense?1:0);out[f.name]=n;if(f.name!=='unused'&&f.size<=3)trace.push({kind:'bitfield',path:path+'.'+f.name,control:path+'.'+f.name,keys:Array.from({length:f.name==='command_node_type'?3:2**f.size},(_,i)=>i),current:n});raw=(raw<<BigInt(f.size))|BigInt.asUintN(f.size,BigInt(n));}
   for(let shift=total-8;shift>=0;shift-=8)w.u8(Number((raw>>BigInt(shift))&255n));return out;
  }
  if(k==='bitflags'){const raw=overrides[path]??0;trace.push({kind:'bitflags',path,control:path,keys:[0,...a.flags.map((_,i)=>1<<i),(1<<a.flags.length)-1],current:raw});value(a.type,current,path+'.flags',raw);return {raw,...Object.fromEntries(a.flags.map((n,i)=>[n,!!(raw&(1<<i))]))};}
  if(k==='buffer'){
   const fixed=path.endsWith('.keyBytes')||name==='chat_session_update'&&path.endsWith('.publicKey')?publicKey:null;const n=fixed?.length??(a.count!==undefined?Number(typeof a.count==='number'?a.count:get(current,a.count)):a.countType?(dense?1:0):0);if(a.countType)value(a.countType,current,path+'.length',n);const bytes=fixed??new Uint8Array(n);w.raw(bytes);coverage.add('buffer:'+(a.count!==undefined?'fixed':a.countType?'prefixed':'rest'));return bytes;
  }
  if(k==='pstring')return value('string',current,path,forced);
  if(k==='registryEntryHolder'){
   const encoded=overrides[path+'.holder']??1;
   trace.push({kind:k,path,control:path+'.holder',keys:[0,1],current:encoded});w.varint(encoded);
   return encoded?{[a.baseName]:encoded-1}:{[a.otherwise.name]:value(a.otherwise.type,current,path+'.inline')};
  }
  if(k==='registryEntryHolderSet'){
   const encoded=overrides[path+'.holderSet']??(dense?2:1);
   trace.push({kind:k,path,control:path+'.holderSet',keys:[0,1,2],current:encoded});w.varint(encoded);
   if(!encoded)return {[a.base.name]:value(a.base.type,current,path+'.tag')};
   return {[a.otherwise.name]:Array.from({length:encoded-1},()=>value(a.otherwise.type,current,path+'[]'))};
  }
  if(k==='entityMetadataLoop'){if(dense)value(a.type,current,path+'[]');w.u8(a.endVal);return [];}
  if(k==='topBitSetTerminatedArray'){const fields=a.type[1];value(fields[0].type,current,path+'.marker',0);for(const f of fields.slice(1))value(f.type,current,path+'.'+f.name);return [];}
  throw Error('Unsupported sample constructor '+k);
 }
 const fields=value(types['packet_'+name],null,'packet_'+name);return {label:name+':'+mode,direction:'CLIENTBOUND',name,wire:Buffer.from(w.build()).toString('base64'),fields,trace,overrides,coverage:[...coverage].sort()};
}
