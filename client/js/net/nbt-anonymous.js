// Network NBT since 1.20.2 omits the root name. Keep typed payloads intact and
// decode Java modified UTF-8 (including NUL/surrogate pairs), not JSON text.
export function readModifiedUtf(r){
 const b=r.bytesN(r.u16()),out=[];
 for(let i=0;i<b.length;){const c=b[i++];
  if(c<128){out.push(c);continue;}
  if((c&224)===192){if(i>=b.length||(b[i]&192)!==128)throw Error('Invalid modified UTF-8');out.push(((c&31)<<6)|(b[i++]&63));continue;}
  if((c&240)===224){if(i+1>=b.length||(b[i]&192)!==128||(b[i+1]&192)!==128)throw Error('Invalid modified UTF-8');out.push(((c&15)<<12)|((b[i++]&63)<<6)|(b[i++]&63));continue;}
  throw Error('Invalid modified UTF-8');
 }
 let value='';for(let i=0;i<out.length;i+=8192)value+=String.fromCharCode(...out.slice(i,i+8192));return value;
}
export function writeModifiedUtf(w,value){const out=[];for(let i=0;i<value.length;i++){const c=value.charCodeAt(i);if(c>0&&c<128)out.push(c);else if(c<2048)out.push(192|(c>>6),128|(c&63));else out.push(224|(c>>12),128|((c>>6)&63),128|(c&63));}if(out.length>65535)throw Error('NBT string too long');w.u16(out.length).raw(Uint8Array.from(out));return w;}
function count(r,minBytes=1){const n=r.i32();if(n<0||n>1048576||n*minBytes>r.remaining())throw Error('Invalid NBT array/list length');return n;}
function payload(r,t,depth){
 if(depth>512)throw Error('NBT too deep');
 switch(t){
  case 1:return r.i8();case 2:return r.i16();case 3:return r.i32();case 4:return r.i64();case 5:return r.f32();case 6:return r.f64();
  case 7:return Int8Array.from(r.bytesN(count(r)));
  case 8:return readModifiedUtf(r);
  case 9:{const et=r.u8(),n=count(r,et===0?0:1);if(et===0&&n!==0)throw Error('Nonempty end-tag list');const items=[];for(let i=0;i<n;i++)items.push(payload(r,et,depth+1));return{et,items};}
  case 10:{const value={};for(;;){const type=r.u8();if(type===0)break;const name=readModifiedUtf(r);Object.defineProperty(value,name,{value:{t:type,v:payload(r,type,depth+1)},writable:true,enumerable:true,configurable:true});}return value;}
  case 11:{const n=count(r,4),a=new Int32Array(n);for(let i=0;i<n;i++)a[i]=r.i32();return a;}
  case 12:{const n=count(r,8),a=new BigInt64Array(n);for(let i=0;i<n;i++)a[i]=r.i64();return a;}
  default:throw Error('Unknown NBT type '+t);
 }
}
export function readAnonymousNbt(r){const t=r.u8();return t===0?null:{t,name:'',v:payload(r,t,0)};}
