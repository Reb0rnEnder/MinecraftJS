import {readAnonymousNbt,writeAnonymousNbt} from "./nbt-anonymous.js";

const STYLE_BOOLS=new Set(["bold","italic","underlined","strikethrough","obfuscated"]);
const COMPONENT_TYPES=new Set(["text","translatable","score","selector","nbt","keybind"]);

function node(t,v){return{t,v};}
function wrapperCompound(value){return node(10,{"":value});}
function isWrapper(value){return value?.t===10&&Object.keys(value.v||{}).length===1&&Object.hasOwn(value.v,"");}
function wrapListElement(value){return value.t===10&&!isWrapper(value)?value:wrapperCompound(value);}

function encodeList(values,path){
 const items=values.map((value,index)=>encodeValue(value,path+"["+index+"]"));
 if(!items.length)return node(9,{et:0,items:[]});
 const first=items[0].t;
 if(items.every((item)=>item.t===first)){
  if(first===1)return node(7,Int8Array.from(items.map((item)=>item.v)));
  if(first===3)return node(11,Int32Array.from(items.map((item)=>item.v)));
  if(first===4)return node(12,BigInt64Array.from(items.map((item)=>BigInt(item.v))));
  if(first!==10)return node(9,{et:first,items:items.map((item)=>item.v)});
 }
 const wrapped=items.map(wrapListElement);
 return node(9,{et:10,items:wrapped.map((item)=>item.v)});
}

function encodeValue(value,path="value"){
 if(typeof value==="string")return node(8,value);
 if(typeof value==="boolean")return node(1,value?1:0);
 if(typeof value==="bigint")return node(4,value);
 if(typeof value==="number"){
  if(!Number.isFinite(value))throw Error("Invalid numeric value at "+path);
  return Number.isInteger(value)?node(3,value):node(6,value);
 }
 if(value instanceof Int8Array||value instanceof Uint8Array)return node(7,Int8Array.from(value));
 if(value instanceof Int32Array)return node(11,value);
 if(value instanceof BigInt64Array)return node(12,value);
 if(Array.isArray(value))return encodeList(value,path);
 if(value&&typeof value==="object"){
  const out={};
  for(const [key,child] of Object.entries(value)){if(child!==undefined)out[key]=encodeValue(child,path+"."+key);}
  return node(10,out);
 }
 throw Error("Unsupported NBT value at "+path);
}

function decodeNode(value,unwrap=false){
 if(!value)return null;
 switch(value.t){
  case 1:case 2:case 3:case 5:case 6:return value.v;
  case 4:{const x=BigInt(value.v);return x>=BigInt(Number.MIN_SAFE_INTEGER)&&x<=BigInt(Number.MAX_SAFE_INTEGER)?Number(x):x;}
  case 7:case 11:case 12:return Array.from(value.v);
  case 8:return value.v;
  case 9:return value.v.items.map((item)=>decodeNode(node(value.v.et,item),value.v.et===10));
  case 10:{
   if(unwrap&&isWrapper(value))return decodeNode(value.v[""]);
   const out={};for(const [key,child] of Object.entries(value.v))out[key]=decodeNode(child);return out;
  }
  default:throw Error("Unknown component NBT type "+value.t);
 }
}

function normalizeComponent(value,path="component"){
 if(typeof value==="string")return value;
 if(Array.isArray(value)){
  if(!value.length)throw Error("Empty text component list at "+path);
  return value.map((child,index)=>normalizeComponent(child,path+"["+index+"]"));
 }
 if(!value||typeof value!=="object")throw Error("Invalid text component at "+path);
 const out={...value};
 if(out.type!==undefined&&(!COMPONENT_TYPES.has(out.type)||typeof out.type!=="string"))throw Error("Invalid text component type at "+path);
 for(const key of STYLE_BOOLS){
  if(out[key]===0||out[key]===1)out[key]=!!out[key];
  if(out[key]!==undefined&&typeof out[key]!=="boolean")throw Error("Invalid "+key+" style at "+path);
 }
 if(out.color!==undefined&&typeof out.color!=="string")throw Error("Invalid color style at "+path);
 if(out.font!==undefined&&typeof out.font!=="string")throw Error("Invalid font style at "+path);
 if(out.insertion!==undefined&&typeof out.insertion!=="string")throw Error("Invalid insertion style at "+path);
 if(out.text!==undefined&&typeof out.text!=="string")throw Error("Invalid text component payload at "+path);
 if(out.translate!==undefined&&typeof out.translate!=="string")throw Error("Invalid translation key at "+path);
 if(out.fallback!==undefined&&typeof out.fallback!=="string")throw Error("Invalid translation fallback at "+path);
 if(out.selector!==undefined&&typeof out.selector!=="string")throw Error("Invalid selector component at "+path);
 if(out.keybind!==undefined&&typeof out.keybind!=="string")throw Error("Invalid keybind component at "+path);
 if(out.nbt!==undefined&&typeof out.nbt!=="string")throw Error("Invalid NBT component path at "+path);
 if(out.with!==undefined){
  if(!Array.isArray(out.with))throw Error("Invalid translation arguments at "+path);
  out.with=out.with.map((child,index)=>normalizeComponent(child,path+".with["+index+"]"));
 }
 if(out.extra!==undefined){
  if(!Array.isArray(out.extra)||!out.extra.length)throw Error("Invalid extra component list at "+path);
  out.extra=out.extra.map((child,index)=>normalizeComponent(child,path+".extra["+index+"]"));
 }
 if(out.separator!==undefined)out.separator=normalizeComponent(out.separator,path+".separator");
 if(out.clickEvent!==undefined){
  if(!out.clickEvent||typeof out.clickEvent!=="object"||typeof out.clickEvent.action!=="string"||typeof out.clickEvent.value!=="string")throw Error("Invalid click event at "+path);
 }
 if(out.hoverEvent!==undefined){
  if(!out.hoverEvent||typeof out.hoverEvent!=="object"||typeof out.hoverEvent.action!=="string")throw Error("Invalid hover event at "+path);
  out.hoverEvent={...out.hoverEvent};
  if(out.hoverEvent.action==="show_text"){
   const key=out.hoverEvent.contents!==undefined?"contents":"value";
   if(out.hoverEvent[key]===undefined)throw Error("Missing show_text contents at "+path);
   out.hoverEvent[key]=normalizeComponent(out.hoverEvent[key],path+".hoverEvent."+key);
  }else if(out.hoverEvent.action==="show_entity"&&out.hoverEvent.contents?.name!==undefined){
   out.hoverEvent.contents={...out.hoverEvent.contents,name:normalizeComponent(out.hoverEvent.contents.name,path+".hoverEvent.contents.name")};
  }
 }
 const content=["text","translate","score","selector","nbt","keybind"].filter((key)=>out[key]!==undefined);
 if(content.length!==1)throw Error("Text component must have exactly one content field at "+path);
 return out;
}

function appendExtra(base,extra){
 const normalized=normalizeComponent(base);
 const additions=extra.map((child,index)=>normalizeComponent(child,"component.extra["+index+"]"));
 if(typeof normalized==="string")return{text:normalized,extra:additions};
 return{...normalized,extra:[...(normalized.extra||[]),...additions]};
}

function wireComponent(value){
 const normalized=normalizeComponent(value);
 if(Array.isArray(normalized))return appendExtra(normalized[0],normalized.slice(1));
 if(normalized&&typeof normalized==="object"){
  const keys=Object.keys(normalized);
  if(keys.length===1&&keys[0]==="text")return normalized.text;
 }
 return normalized;
}

export function componentFromNbt(value){return normalizeComponent(decodeNode(value));}
export function componentToNbt(component){return encodeValue(wireComponent(component),"component");}
export function readComponentNbt(r){const value=readAnonymousNbt(r);if(!value)throw Error("Missing text component");return componentFromNbt(value);}
export function writeComponentNbt(w,component){return writeAnonymousNbt(w,componentToNbt(component));}

