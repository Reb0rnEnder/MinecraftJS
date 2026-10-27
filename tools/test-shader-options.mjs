import{test}from'node:test';import assert from'node:assert/strict';import{readFileSync,existsSync}from'node:fs';
import{parseShaderOptions,validateShaderOptions,applyShaderOptions}from'../client/js/render/shader-options.js';
import{supportedShaderOptions,finalShaderSource,ShaderPackFinal}from'../client/js/render/shader-pack.js';
import{packLighting,lightingFrame}from'../client/js/render/shader-lighting.js';
import{ShaderOptionsScreen}from'../client/js/gui/screens/shaders.js';
const source=`/*\n#define EXAMPLE\n*/\n#define WAVE\n//#define FILTER\n#define SPEED 1.0 //[0.0 1.0 2.0]\nconst float amount = 0.5; //[0.0 0.5 1.0]\n//Undefine//\n#define INTERNAL\n`;
test('shader authoring options parse toggles, choices and constants without exposing internal macros',()=>{
 const options=parseShaderOptions(source);assert.deepEqual(options.map(o=>o.name),['WAVE','FILTER','SPEED','amount']);assert.equal(options[1].default,'false');
 const changed=applyShaderOptions(source,{WAVE:'false',FILTER:'true',SPEED:'2.0',amount:'1.0'});assert.match(changed,/\/\/#define WAVE/);assert.match(changed,/^#define FILTER$/m);assert.match(changed,/#define SPEED 2.0/);assert.match(changed,/amount = 1.0/);
 assert.throws(()=>validateShaderOptions(options,{SPEED:'1.0;discard;'}),/Invalid/);assert.throws(()=>validateShaderOptions(options,{INTERNAL:'true'}),/Invalid/);
});
test('shader setting changes compile before replacing the running pack',()=>{
 const bytes=readFileSync(new URL('fixtures/shader-pack-final-test.zip',import.meta.url));let fail=false,destroyed=0;
 const device={createFinalShaderPass:()=>{if(fail)throw Error('compile');return{destroy(){destroyed++;}};}},pack=new ShaderPackFinal({device,dimension:0});pack.load('good',bytes);fail=true;assert.throws(()=>pack.load('bad',bytes),/compile/);assert.equal(pack.name,'good');assert.equal(destroyed,0);pack.clear();
});
test('native shader options use automatic columns, cycle/reset values, and apply on Done',async()=>{
 const options=Array.from({length:30},(_,i)=>({name:'OPTION'+i,label:'Option '+i,values:i===0?Array.from({length:10},(_,n)=>''+n):['false','true'],default:i===0?'5':'false',toggle:i!==0}));let opened;
 const parent={persist:async()=>{}},game={gui:{width:400,height:240},shaderPack:{options:{},availableOptions:options,load(name,bytes,values){this.options={...values};}},screens:{open:s=>opened=s}};
 const screen=new ShaderOptionsScreen(game,parent);screen.init();assert.equal(screen.pages,1);assert.equal(screen.buttons[0].x,5);assert.equal(screen.buttons[0].y,30);assert.equal(screen.buttons[0].w,90);assert.equal(screen.buttons[1].x,105);
 screen.buttons[0].onChange(1);assert.equal(screen.values.OPTION0,'9');screen.buttons[1].onClick();assert.equal(screen.values.OPTION1,'true');screen.mouseDown(106,31,2,{});assert.equal(screen.values.OPTION1,'false');screen.buttons.find(b=>b.id===102).onClick();assert.deepEqual(screen.values,{});await screen.close();assert.equal(opened,parent);assert.deepEqual(game.shaderPack.options,{});
});

const file=process.env.BSL_SHADER_PACK||new URL('../BSL_v10.1.8.zip',import.meta.url);
test('BSL exposes working stages only and light colours respond to settings, time and dimensions',{skip:!existsSync(file)},()=>{
 const bytes=readFileSync(file),options=supportedShaderOptions(bytes),names=options.map(o=>o.name);for(const key of ['WAVING_GRASS','ANIMATION_SPEED','SHARPEN','BLOCKLIGHT_I','LIGHT_DI'])assert.ok(names.includes(key),key);for(const key of ['SHADOW','REFLECTION','TAA','FSH','NETHER','WAVING_LAVA','WAVING_FIRE','WAVING_LANTERN'])assert.ok(!names.includes(key),key);
 const colors=packLighting(options,{}),noon=lightingFrame(colors,6000),night=lightingFrame(colors,18000);assert.ok(noon.direct.some((v,i)=>v>night.direct[i]));
 const off=lightingFrame(packLighting(options,{BLOCKLIGHT_I:'0.05'}),6000);assert.ok(off.block.every((v,i)=>v<noon.block[i]));for(const d of [-1,1]){const f=lightingFrame(colors,6000,d);assert.equal(f.dimension,d);assert.ok([...f.ambient,...f.direct,...f.block].every(Number.isFinite));}
 assert.match(finalShaderSource(bytes,0,{SHARPEN:'2'}),/#define SHARPEN 2/);
});
