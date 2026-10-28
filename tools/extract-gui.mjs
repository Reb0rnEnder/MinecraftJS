// Pinned GUI definitions read from bytecode, without launching Minecraft or downloading mappings.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { ZipFile } from '../lib/zip.js';
import { parseClass } from '../lib/classfile.js';
import { walk } from '../lib/bytecode.js';
import mcassets from '../lib/mcassets.js';
const jar=new ZipFile(await mcassets.locateJar()),classes=jar.list('').filter(p=>p.endsWith('.class')).map(p=>parseClass(jar.read(p)));
const enumClass=classes.find(c=>c.superName==='java/lang/Enum'&&c.strings.includes('options.invertMouse'))||classes.find(c=>c.strings.includes('options.invertMouse')&&c.strings.includes('options.autoSuggestCommands'));
assert.ok(enumClass,'GameSettings.Options');
const string=(c,i)=>{if(![0x12,0x13].includes(i.op))return null;const k=c.constant(i.op===0x12?i.u1:i.u2);return k.type==='string'?k.value:null;};
const optionNames={};let last;
for(const i of walk(enumClass.methods.find(m=>m.name==='<clinit>').code)){const s=string(enumClass,i);if(s?.startsWith('options.')||['key.sneak','key.sprint'].includes(s))last=s;if(i.op===0xb3&&last){const r=enumClass.ref(i.u2);if(r.owner===enumClass.name){optionNames[r.name]=last;last=null;}}}
function optionRefs(c,method){return [...walk(method.code)].filter(i=>i.op===0xb2).map(i=>c.ref(i.u2)).filter(r=>r.owner===enumClass.name).map(r=>optionNames[r.name]);}
function options(key,methodName='<clinit>'){
 const candidates=classes.filter(c=>c.strings.includes(key)&&c.methods.some(m=>m.name===methodName));
 const lists=candidates.map(c=>optionRefs(c,c.methods.find(m=>m.name===methodName)));
 const list=lists.sort((a,b)=>b.length-a.length)[0];assert.ok(list?.length,key);assert.ok(list.every(Boolean),'Unmapped option in '+key);return [...new Set(list)];
}
const binding=classes.find(c=>c.strings.includes('key.categories.movement')&&c.interfaces.includes('java/lang/Comparable'));
const categories=binding?classes.filter(c=>c.name===binding.name||c.name.startsWith(binding.name+'$')):[];
const categoryOrder=[];for(const c of categories)for(const m of c.methods.filter(m=>m.code))for(const i of walk(m.code)){const s=string(c,i);if(s?.startsWith('key.categories.')&&!categoryOrder.includes(s))categoryOrder.push(s);}
const settings=classes.find(c=>c.strings.includes('key.forward')&&c.strings.includes('key.attack')&&c!==binding);
const bindingCategories={};let key;
for(const m of settings.methods.filter(m=>m.name==='<init>'))for(const i of walk(m.code)){const s=string(settings,i);if(s?.startsWith('key.')&&!s.startsWith('key.categories.'))key=s;else if(key&&s?.startsWith('key.categories.')){bindingCategories[key]=s;key=null;}}
const pack=JSON.parse(jar.read('pack.mcmeta'));
let packFormat=pack?.pack.pack_format;
if(!packFormat){
  const c=classes.find(c=>c.strings.includes('resourcePack.incompatible.confirm.title'));
  for(const m of c.methods.filter(m=>m.code)) {const ops=[...walk(m.code)];for(let i=2;i<ops.length;i++)if([0x9f,0xa0].includes(ops[i].op)&&ops[i-1].op>=0x04&&ops[i-1].op<=0x07)packFormat=ops[i-1].op-3;}
  assert.ok(packFormat,'pack-format comparison');
}
packFormat=JSON.parse(jar.read('version.json'))?.pack_version||packFormat;
const data={version:mcassets.MC_VERSION,clientJarSha1:createHash('sha1').update(jar.data).digest('hex'),packFormat,videoOptions:options('options.videoTitle'),controlOptions:options('controls.title',['1.14.4','1.15.2'].includes(mcassets.MC_VERSION)?'init':'<clinit>'),categoryOrder,bindingCategories};
if(['1.14.4','1.15.2'].includes(mcassets.MC_VERSION)){data.mouseOptions=options('options.mouse_settings.title');data.accessibilityOptions=options('options.accessibility.title');}
if(['1.14.4','1.15.2'].includes(mcassets.MC_VERSION)){
 const screen=classes.find(c=>c.strings.includes('controls.title')&&c.strings.includes('controls.resetAll'));
 const init=screen.methods.find(m=>m.name==='init');
 const created=[...walk(init.code)].filter(i=>i.op===0xbb).map(i=>classes.find(c=>c.name===screen.className(i.u2)));
 const layouts=created.filter(Boolean).flatMap(c=>c.methods.filter(m=>m.name==='<init>').map(m=>{
  const constants=[];
  for(const i of walk(m.code)){
   if(i.op===0xb7&&c.ref(i.u2).owner===c.superName)break;
   if(i.op===0x10||i.op===0x11)constants.push(i.value);
  }
  return constants;
 })).filter(c=>c.length===4);
 assert.equal(layouts.length,1,'native ControlList constructor');
 const [extraWidth,listTop,bottomMargin,rowHeight]=layouts[0];
 data.controlsLayout={extraWidth,listTop,bottomMargin,rowHeight};
}
data.chatOptions=options('options.chat.title');
const button=classes.find(c=>c.strings.includes('textures/gui/widgets.png')&&c.cp.some(k=>k?.tag===3&&k.value===16777120))||classes.find(c=>c.strings.includes('gui.narrate.button'));
assert.ok(button,'native button class');
data.buttonText={normal:button.cp.some(k=>k?.tag===3&&k.value===14737632)?14737632:16777215,hover:button.cp.some(k=>k?.tag===3&&k.value===16777120)?16777120:16777215};
assert.ok(data.videoOptions.length>=15 && data.controlOptions.length>=1 && (mcassets.MC_VERSION==='1.8.9'||categoryOrder.length>=5));
const output=fileURLToPath(new URL('../client/js/gui/vanilla-layout.js',import.meta.url));
const text='// Generated by tools/extract-gui.mjs from this version\'s pinned client jar.\nexport const VANILLA_UI = '+JSON.stringify(data,null,2)+';\n';
if(process.argv[2]==='--write')writeFileSync(output,text);else{assert.equal(process.argv[2],'--check');assert.equal(readFileSync(output,'utf8'),text);}
console.log(`${data.version}: pack format ${data.packFormat}, ${data.videoOptions.length} video options, ${Object.keys(data.bindingCategories).length} key bindings`);
