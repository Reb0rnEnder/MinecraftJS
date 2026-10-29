// 1.13+ font provider stack. Definitions are layered; provider textures use the
// highest-priority resource, while missing glyphs fall through to lower providers.
import {decodePng} from '../util/png.js';
import {decodeUtf8} from '../util/utf8.js';
import {TRUETYPE_WASM} from '../lib/truetype-wasm.js';
const location=(value,prefix='')=>{const i=value.indexOf(':');return i<0?'minecraft:'+prefix+value:value.slice(0,i+1)+prefix+value.slice(i+1);};
export async function fontBytes(assets,id) {
 const [namespace,...rest]=id.split(':'),path=rest.join(':');
 for(const pack of assets.packs||[]){const name=pack.prefix+'assets/'+namespace+'/'+path;if(pack.zip?.has(name))return pack.zip.read(name);}
 return assets.source.bytes(namespace+'/'+path);
}
function texture(assets,key,image) {
 return assets.textures.get(key)||assets.makeTexture(key,image.width,image.height,image.data,{filter:'nearest'});
}
export function bitmapProvider(assets,def,image,key) {
 const rows=def.chars?.map(row=>Array.from(row));if(!rows?.length||!rows[0]?.length||rows.some(s=>s.length!==rows[0].length))throw new Error('Invalid bitmap character rows');
 const height=def.height??8,ascent=def.ascent;
 if(!Number.isFinite(height)||height<=0||!Number.isFinite(ascent)||ascent>height)throw new Error('Invalid bitmap height/ascent');
 const cw=Math.floor(image.width/rows[0].length),ch=Math.floor(image.height/rows.length),scale=height/ch,glyphs=new Map();
 if(!cw||!ch)throw new Error('Empty bitmap glyph cells');
 for(let row=0;row<rows.length;row++)for(let col=0;col<rows[row].length;col++) {
  const char=rows[row][col];if(char==='\0'||char===' ')continue;
  let ink=0;for(let x=cw-1;x>=0&&!ink;x--)for(let y=0;y<ch;y++)if(image.data[((row*ch+y)*image.width+col*cw+x)*4+3]){ink=x+1;break;}
  glyphs.set(char,{advance:Math.floor(ink*scale+.5)+1,x:0,y:7-ascent,width:cw*scale,height,
   u0:col*cw/image.width,v0:row*ch/image.height,u1:(col+1)*cw/image.width,v1:(row+1)*ch/image.height,
   boldOffset:1,shadowOffset:1,texture:()=>texture(assets,key,image)});
 }
 return {type:'bitmap',get:ch=>glyphs.get(ch)||null};
}
function legacyProvider(assets,def,sizes) {
 const cache=new Map(),images=new Map();
 return {type:'legacy_unicode',get:ch=>{
  if(cache.has(ch))return cache.get(ch);
  const code=ch.codePointAt(0);if(code>0xffff)return null;
  const n=sizes[code],left=n>>4,right=(n&15)+1;
  if(!n||left>=right){cache.set(ch,null);return null;}
  const page=(code>>8).toString(16).padStart(2,'0'),id=location(def.template.replace('%s',page),'textures/');
  const glyph={advance:Math.floor((right-left)/2)+1,x:0,y:0,width:(right-left)/2,height:8,
   u0:((code&15)*16+left)/256,v0:((code>>4)&15)/16,u1:((code&15)*16+right)/256,v1:(((code>>4)&15)+1)/16,boldOffset:.5,shadowOffset:.5,
   texture:()=>{let img=images.get(id);if(img===undefined){images.set(id,null);fontBytes(assets,id).then(b=>{if(b)images.set(id,decodePng(b));}).catch(()=>{});}return img?texture(assets,'font:'+id,img):null;}};
  cache.set(ch,glyph);return glyph;
 }};
}
let wasmModule;
export function trueTypeProvider(assets,def,bytes,key) {
 const size=def.size??11,over=def.oversample??1,shift=def.shift??[0,0];
 if(!(size>0&&size<=256&&over>0&&over<=64)||shift.length!==2||shift.some(n=>!Number.isFinite(n)||Math.abs(n)>1024))throw new Error('Invalid TTF size/oversample/shift');
 // Check sfnt table boundaries before handing resource bytes to the isolated rasterizer.
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 if(bytes.length<12||bytes.length>16*1024*1024)throw new Error('Invalid TTF size');
 const count=view.getUint16(4);if(12+count*16>bytes.length)throw new Error('Invalid TTF directory');
 for(let i=0;i<count;i++){const p=12+i*16,offset=view.getUint32(p+8),length=view.getUint32(p+12);if(offset+length>bytes.length)throw new Error('Invalid TTF table');}
 wasmModule ||=new WebAssembly.Module(Uint8Array.from(atob(TRUETYPE_WASM),c=>c.charCodeAt(0)));
 const instance=new WebAssembly.Instance(wasmModule,{math:{pow:Math.pow,cos:Math.cos,acos:Math.acos,fmod:(a,b)=>a%b}}).exports;
 const pointer=instance.alloc(bytes.length);new Uint8Array(instance.memory.buffer,pointer,bytes.length).set(bytes);
 if(!instance.init(pointer))throw new Error('Invalid TTF');
 const skipped=new Set((Array.isArray(def.skip)?def.skip.join(''):def.skip||'').split('')),cache=new Map();
 let atlas=null,page=0,x=1,y=1,row=0;
 const bake=(glyph,pixels)=>{
  const w=pixels.width,h=pixels.height;
  if(!atlas||x+w+1>atlas.width&&y+row+h+2>atlas.height||w+2>atlas.width||h+2>atlas.height){const side=Math.max(256,2**Math.ceil(Math.log2(Math.max(w,h)+2)));atlas=assets.makeTexture(key+':'+page++,side,side,new Uint8Array(side*side*4),{filter:'nearest'});x=y=1;row=0;}
  if(x+w+1>atlas.width){x=1;y+=row+1;row=0;}
  if(y+h+1>atlas.height){atlas=null;return bake(glyph,pixels);}
  const rgba=new Uint8Array(w*h*4);for(let i=0;i<w*h;i++){rgba[i*4]=rgba[i*4+1]=rgba[i*4+2]=255;rgba[i*4+3]=pixels.alpha[i];}
  assets.device.updateTexture(atlas,rgba,x,y,w,h);
  glyph.u0=x/atlas.width;glyph.v0=y/atlas.height;glyph.u1=(x+w)/atlas.width;glyph.v1=(y+h)/atlas.height;
  const tex=atlas;x+=w+1;row=Math.max(row,h);return tex;
 };
 return {type:'ttf',get:ch=>{
  if(skipped.has(ch))return null;if(cache.has(ch))return cache.get(ch);
  let glyph=null;
  try {
   const pointer=instance.glyph(ch.codePointAt(0),size,over,...shift);
   if(pointer){const m=new Float32Array(instance.memory.buffer,instance.info(),8),width=m[0],height=m[1],alpha=new Uint8Array(instance.memory.buffer,pointer,width*height).slice();
    let tex;glyph={advance:m[4],x:m[2],y:m[3],width:width/over,height:height/over,boldOffset:1,shadowOffset:1,texture:()=>tex||(tex=bake(glyph,{width,height,alpha}))};}
  }catch(error){console.warn('Unable to rasterize TTF glyph',ch,error.message);}
  cache.set(ch,glyph);return glyph;
 }};
}
export class FontSet {
 constructor(assets,providers){this.assets=assets;this.providers=providers;this.normal=new Map();this.unicode=new Map();}
 glyph(ch,unicode=false){
  const cache=unicode?this.unicode:this.normal;if(cache.has(ch))return cache.get(ch);
  let glyph;if(ch===' ')glyph={advance:4,boldOffset:1,shadowOffset:1,texture:()=>null};
  else for(const provider of this.providers){if(unicode&&provider.type!=='legacy_unicode')continue;glyph=provider.get(ch);if(glyph)break;}
  if(!glyph){const data=new Uint8Array(5*8*4);for(let y=0;y<8;y++)for(let x=0;x<5;x++)if(x===0||x===4||y===0||y===7)data.fill(255,(y*5+x)*4,(y*5+x+1)*4);
   glyph={advance:6,x:0,y:0,width:5,height:8,u0:0,v0:0,u1:1,v1:1,boldOffset:1,shadowOffset:1,texture:()=>texture(this.assets,'font:missing',{width:5,height:8,data})};}
  cache.set(ch,glyph);return glyph;
 }
}
export async function loadFontSets(assets) {
 const result={},fonts=new Set(['minecraft:default','minecraft:alt','minecraft:uniform']);
 for(const pack of assets.packs||[])for(const path of pack.zip?.list(pack.prefix+'assets/')||[]){const match=/^([^/]+)\/font\/(.+)\.json$/.exec(path.slice((pack.prefix+'assets/').length));if(match)fonts.add(match[1]+':'+match[2]);}
 for(const id of fonts){
  const [namespace,...parts]=id.split(':'),name=parts.join(':'),path='font/'+name+'.json',definitions=[];
  for(const pack of assets.packs||[])if(pack.zip?.has(pack.prefix+'assets/'+namespace+'/'+path)||namespace==='minecraft'&&pack.has(path))try{const bytes=pack.zip?.read(pack.prefix+'assets/'+namespace+'/'+path)||pack.read(path);definitions.push(JSON.parse(decodeUtf8(bytes)));}catch(e){console.warn('Bad font definition',pack.id,path);}
  const base=['minecraft:default','minecraft:alt','minecraft:uniform'].includes(id)?await assets.source.bytes(namespace+'/'+path):null;if(base)definitions.push(JSON.parse(decodeUtf8(base)));
  const providers=[];
  for(const definition of definitions)for(const def of definition.providers||[])try{
   const key='font:'+id+':'+providers.length;
   if(def.type==='bitmap'){const b=await fontBytes(assets,location(def.file,'textures/'));if(b)providers.push(bitmapProvider(assets,def,decodePng(b),key));}
   else if(def.type==='legacy_unicode'){const b=await fontBytes(assets,location(def.sizes));if(b)providers.push(legacyProvider(assets,def,b));}
   else if(def.type==='ttf'){const b=await fontBytes(assets,location(def.file,'font/'));if(b)providers.push(trueTypeProvider(assets,def,b,key));}
   else console.warn('Unsupported font provider',def.type);
  }catch(e){console.warn('Bad font provider',name,e.message);}
  if(providers.length){result[id]=new FontSet(assets,providers);if(namespace==='minecraft')result[name]=result[id];}
 }
 return result;
}
