import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {ZipFile} from '../lib/zip.js';
import {Jvm,JObject} from '../lib/jvm.js';
import {LocalPlayer,mcSin} from '../client/js/game/physics.js';
import {initBlocks,findState} from '../client/js/world/blocks.js';
import {waterFog} from '../client/js/render/water-fog.js';
import {WATER_BIOMES} from '../client/js/world/water-biomes.js';
import {SoftwareDevice} from '../client/js/gfx/software.js';
import {mat4} from '../client/js/gfx/math.js';
import {ChatScreen} from '../client/js/gui/screens/chat.js';
const json=n=>JSON.parse(readFileSync(new URL('../client/data/'+n+'.json',import.meta.url)));
initBlocks(json('blocks'),json('blockCollisionShapes'));
const water=findState('water'),air=findState('air');
const world=surface=>({isLoaded:()=>true,getState:(x,y,z)=>y<surface?water:air,getCollisions:()=>[]});
const jar=new ZipFile(new URL('../cache/1.13.2.jar',import.meta.url).pathname);
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} vs ${b}`);

test('walking/sprinting into shallow water keeps the standing pose; deep eye immersion starts swimming',()=>{
 const p=new LocalPlayer();p.setPosition(.5,64,.5);p.onGround=true;p.sprinting=true;
 p.tick(world(65),{forward:true,sprint:true});assert.ok(p.inWater);assert.equal(p.eyesInWater,false);assert.equal(p.swimming,false);near(p.height,1.8);
 p.sprinting=true;p.tick(world(68),{forward:true,sprint:true});assert.ok(p.eyesInWater);assert.ok(p.swimming);near(p.height,.6);
 // The pinned jar deliberately keeps an existing swim pose while the body remains in water.
 let actual;const vm=new Jvm(jar,{intercept:{'aer.bb()Z':()=>1,'aer.ba()Z':()=>1,'aer.an()Z':()=>1,'aer.ar()Z':()=>0,'aer.aW()Z':()=>0,'aer.g(Z)V':([v])=>{actual=!!v;}}});
 vm.invoke('aer','as','()V',new JObject('aer'),[]);assert.equal(actual,true);
 p.setPosition(.5,64.8,.5);p.sprinting=true;p.tick(world(65),{forward:true,sprint:true});assert.equal(p.eyesInWater,false);assert.equal(p.swimming,actual);
 p.tick(world(-100),{});assert.equal(p.swimming,false);near(p.height,1.8);
});

test('swimming upward follows vanilla player travel steering instead of the old forward-vector impulse',()=>{
 for(const pitch of [-90,30]) {
  const p=new LocalPlayer();p.setPosition(.5,64,.5);p.pitch=pitch;p.inWater=true;p.swimming=true;p.sprinting=true;p.jumping=true;p.motionY=.1;
  const look=new JObject('cee');look.fields['cee.c']=mcSin(Math.fround(-Math.fround(pitch)*Math.fround(Math.PI/180)));
  const capabilities=new JObject('aoe');capabilities.fields['aoe.b']=0;
  const player=new JObject('aog');player.fields['aog.bV']=capabilities;player.fields['afa.bg']=1;player.fields['aer.u']=.1;
  let steered;const vm=new Jvm(jar,{intercept:{'aog.bb()Z':()=>1,'aog.aW()Z':()=>0,'aog.aN()Lcee;':()=>look,'afa.a(FFF)V':(_,self)=>{steered=self.fields['aer.u'];},'aog.k(DDD)V':()=>{}}});
  vm.invoke('aog','a','(FFF)V',player,[0,0,1]);
  p.moveEntityWithHeading(world(68),0,1);near(p.motionY,steered*Math.fround(.8));
 }
 const p=new LocalPlayer();p.setPosition(.5,64,.5);p.inWater=true;p.sprinting=false;p.motionY=.04;p.moveEntityWithHeading(world(68),0,0);near(p.motionY,.04*Math.fround(.8)-.005);
});

test('eye adaptation matches the jar curve and decays on surfacing',()=>{
 const p=new LocalPlayer(),vm=new Jvm(jar,{intercept:{'ctj.a(Lwz;)Z':()=>1,'xq.a(FFF)F':([n,min,max])=>Math.fround(Math.max(min,Math.min(max,n)))}});vm.statics.set('ww',{'ww.a':{}});
 for(const ticks of [0,1,50,100,350,600]){const player=new JObject('ctj');player.fields['ctj.cG']=ticks;p.waterVisionTicks=ticks;p.eyesInWater=true;near(p.waterVision(),vm.invoke('ctj','H','()F',player,[]));}
 p.setPosition(.5,64,.5);p.waterVisionTicks=600;p.tick(world(64),{});assert.equal(p.waterVisionTicks,590);assert.equal(p.waterVision(),0);
});

test('water fog uses native biome colours, squared adaptation density and five-second biome changes',()=>{
 assert.ok(Object.keys(WATER_BIOMES).length===73);const first=waterFog({biomeId:1,waterVision:0},null,0);near(first.density,.05);assert.deepEqual(first.color,[5/255,5/255,51/255]);
 near(waterFog({biomeId:1,waterVision:1},null,0).density,.02);near(waterFog({biomeId:6,waterVision:1},null,0).density,.025);
 const changed=waterFog({biomeId:6},first.transition,100);assert.deepEqual(changed.color,first.color);
 const half=waterFog({biomeId:6},changed.transition,2600),last=waterFog({biomeId:6},changed.transition,5100);assert.ok(half.color[0]>first.color[0]);assert.ok(half.color[0]<last.color[0]);assert.deepEqual(last.color,[35/255,35/255,23/255]);
});

test('software renderer implements EXP2 water fog while preserving disabled fog',()=>{
 const soft=Object.create(SoftwareDevice.prototype);soft.tv=new Float32Array(13);soft.mvp=mat4.create();soft.mv=mat4.create();soft.globals={fog:[0,0,.05,3],fogColor:[1,0,0]};
 const vertex=new Float32Array([0,0,10,0,0,1,1,1,1,0,0,0,1,0]);soft._vertices({data:vertex},0,1,'color',[1,1,1,1,0,1],null);
 near(soft.tv[9],1-Math.exp(-.25));soft.globals.fog[3]=2;soft._vertices({data:vertex},0,1,'color',[1,1,1,1,0,1],null);near(soft.tv[9],0);
});

test('suggestion selection follows pointer motion and the hovered row after wheel scrolling',()=>{
 const game={gui:{width:320,height:240},send(){},hud:{chatScroll:0,sentHistory:[],chatComponentAt:()=>null,scrollChat(){}},screens:{close(){}}};
 const screen=new ChatScreen(game,'/');screen.init();screen.onClose();screen.tabMatches=Array.from({length:20},(_,i)=>({match:'option'+i}));screen.tabBase='/';screen.tabReplaceStart=1;screen.tabReplaceEnd=1;
 screen.render({font:{width:s=>s.length*6,trimToWidth:s=>s},rect(){},text(){},tooltip(){}},0,0);
 const {x,y}=screen.tabBox;screen.mouseMove(x+2,y+4*12+2);assert.equal(screen.tabIndex,4);screen.wheel(1);assert.equal(screen.tabOffset,1);assert.equal(screen.tabIndex,5);screen.onClose();
});
