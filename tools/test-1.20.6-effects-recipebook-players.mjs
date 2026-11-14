import{test}from'node:test';import assert from'node:assert/strict';import{readFileSync}from'node:fs';
import{Game}from'../client/js/game/game.js';import{Items}from'../client/js/game/items.js';import{EntityManager}from'../client/js/game/entities.js';import{Interaction}from'../client/js/game/interaction.js';
import{EFFECT_766 as E,effectDuration766,createEffectBlend766,tickEffectBlend766}from'../client/js/game/effects-1.20.6.js';
import{ITEM_DATA_766}from'../client/js/game/item-data-1.20.6.js';import{Reader766,Writer766}from'../client/js/net/configuration-1.20.6.js';import{decodePlayBody766}from'../client/js/net/play-codec-1.20.6.js';import{PLAY_SERVERBOUND_766}from'../client/js/net/protocol-1.20.6-ids.js';
import{Assets}from'../client/js/assets.js';import{ZipFile}from'../lib/zip.js';import{decodePng}from'../client/js/util/png.js';import{Gui}from'../client/js/gui/gui.js';import{Hud}from'../client/js/gui/hud.js';import{RecipeBookGui}from'../client/js/gui/recipebook.js';import{drawModernEffects}from'../client/js/gui/screens/containers.js';import{tickPortal}from'../client/js/game/portal.js';import{initBlocks}from'../client/js/world/blocks.js';
const json=p=>JSON.parse(readFileSync(new URL(p,import.meta.url))),jar=new ZipFile(new URL('../cache/port-1.20.6/client.jar',import.meta.url));
const assets={data:{items:json('../client/data/items.json'),creative:json('../client/data/creative.json'),entities:json('../client/data/entities.json')},lang:JSON.parse(jar.read('assets/minecraft/lang/en_us.json')),translate:Assets.prototype.translate},items=new Items(assets);
initBlocks(json('../client/data/blocks.json'),null);
function gui(){
 const quads=[],texts=[],images=new Map(),g={width:640,height:360,assets:{guiSpriteScaling:new Map()},tex(path){if(!images.has(path)){const bytes=jar.read('assets/minecraft/textures/'+path);assert.ok(bytes,path);images.set(path,{...decodePng(bytes),path});}return images.get(path);},quad:(...q)=>quads.push(q),text:(...t)=>texts.push(t),textWidth:s=>s.length*6,rect(){},tooltip(){},blit:Gui.prototype.blit,sprite:Gui.prototype.sprite};
 return{g,quads,texts};
}
const apply=(game,id,duration=100,amplifier=0,flags=6)=>game.on_entity_effect(decodePlayBody766('entity_effect',new Writer766().varint(1).varint(id).varint(amplifier).varint(duration).u8(flags).build()));

test('native ID zero and regeneration packets retain their exact registry identity through labels and gameplay',()=>{
 assert.equal(E.speed,0);assert.equal(E.nausea,8);assert.equal(E.regeneration,9);
 const game=Object.assign(Object.create(Game.prototype),{entityId:1,player:{x:0,y:64,z:0},effects:new Map(),entities:{addEffect(){}},ticks:0,items,assets,world:{getState:()=>0},screens:{current:null},portalTime:0});
 apply(game,E.regeneration,100,1);tickPortal(game);assert.equal(game.portalTime,0,'regeneration must not cause nausea');
 const wide=gui();drawModernEffects(game,wide.g,{guiLeft:100,guiTop:40,xSize:195},0,0);assert.equal(wide.texts[0][0],'Regeneration II');assert.equal(wide.texts[1][0],'00:05');
 assert.equal(wide.quads[0][0].path,'gui/sprites/container/inventory/effect_background_large.png');assert.equal(wide.quads[1][0].path,'mob_effect/regeneration.png');
 apply(game,E.speed);apply(game,E.jump_boost,100,2);apply(game,E.blindness);apply(game,E.levitation,100,3);
 assert.ok(game.effects.has(0));assert.equal(game.player.jumpBoost,2);assert.equal(game.player.blind,true);assert.equal(game.player.levitation,3);
 game.on_remove_entity_effect(decodePlayBody766('remove_entity_effect',new Writer766().varint(1).varint(E.blindness).build()));assert.equal(game.player.blind,false);
 apply(game,E.nausea,-1);tickPortal(game);assert.ok(game.portalTime>0,'actual infinite nausea must distort');
});

test('HUD effects use native backgrounds/categories and infinite icons never blink out',()=>{
 const game={items,assets,screens:{current:null},effects:new Map([[E.regeneration,{duration:-1,amplifier:0}],[E.bad_omen,{duration:600,ambient:true}]])},s=gui();
 Hud.prototype.renderStatusEffects.call({game},s.g);
 const backgrounds=s.quads.filter(q=>q[0].path.includes('effect_background'));assert.equal(backgrounds.length,2);
 assert.ok(backgrounds.some(q=>q[0].path==='gui/sprites/hud/effect_background.png'&&q[2]===1));assert.ok(backgrounds.some(q=>q[0].path==='gui/sprites/hud/effect_background_ambient.png'&&q[2]===27));
 assert.equal(s.quads.find(q=>q[0].path==='mob_effect/regeneration.png')[9][3],1);
 assert.equal(effectDuration766(-1,k=>assets.translate(k)),'∞');assert.equal(effectDuration766(75000,k=>assets.translate(k)),'01:02:30');
});

test('effect blend state matches six actual native Java scenarios frame by frame',()=>{
 const fixtures=json('./fixtures/item-ux-1.20.6.json');assert.equal(ITEM_DATA_766.effects[E.darkness].blendTicks,22);
 for(const scenario of fixtures.blendSamples){
  const effect={duration:scenario.duration,factor:createEffectBlend766(E.darkness,scenario.duration,scenario.smooth)};
  for(let i=0;i<scenario.frames.length;i++){
   if(i){if(effect.duration>0)effect.duration--;tickEffectBlend766(effect);}
   const expected=scenario.frames[i];assert.equal(effect.factor.factor_current,Math.fround(expected.current));assert.equal(effect.factor.factor_previous_frame,Math.fround(expected.previous));
  }
 }
 const old=createEffectBlend766(E.darkness,100,true);old.factor_current=.5;old.factor_previous_frame=.45;
 assert.deepEqual(createEffectBlend766(E.darkness,100,true,old),old);
 const game=Object.assign(Object.create(Game.prototype),{entityId:1,player:{},effects:new Map(),entities:{addEffect(){}},ticks:0});
 apply(game,E.darkness,100,0,14);assert.equal(game.effects.get(E.darkness).factor.factor_current,0);
 apply(game,E.darkness,100,0,6);assert.equal(game.effects.get(E.darkness).factor.factor_current,1);
});

test('recipe-book buttons, tabs, filters, recipe slots and arrows sample opaque native sprites',()=>{
 const rec={id:'minecraft:fixture',result:{id:1,count:1}},list={craftable:[rec],valid:[rec]},game={items,assets,itemRenderer:{drawItem(){}},send(){},recipeBook:{fresh:new Set()}},r=Object.assign(Object.create(RecipeBookGui.prototype),{game,book:game.recipeBook,state:{open:true,filtering:false},tabs:['search'],tabsVisible:{search:true},tab:'search',page:0,pages:2,left:100,top:30,lists:[list],time:0,search:{render(){}},overlay:null});
 const s=gui();r.render(s.g,211,43,0);
 for(const path of ['recipe_book/tab_selected','recipe_book/filter_disabled_highlighted','recipe_book/slot_craftable','recipe_book/page_forward']){
  const q=s.quads.find(q=>q[0].path==='gui/sprites/'+path+'.png');assert.ok(q,path);assert.ok(q[0].data.some((v,i)=>i%4===3&&v>0),path+' alpha');assert.deepEqual(q.slice(5,9),[0,0,1,1]);
 }
 s.g.blit('gui/container/inventory.png',0,0,178,0,20,18);s.g.blit('gui/container/crafting_table.png',0,0,0,187,20,18);
 assert.equal(s.quads.at(-2)[0].path,'gui/sprites/recipe_book/button.png');assert.equal(s.quads.at(-1)[0].path,'gui/sprites/recipe_book/button_highlighted.png');
});

test('unified player spawns remain pickable and NPC targeting emits the native attack packet',()=>{
 const sent=[],uuid='12345678-1234-4234-8234-123456789abc',game=Object.assign(Object.create(Game.prototype),{assets,items,entityId:1,gameMode:0,player:{x:0,y:0,z:0,onGround:true,fallDistance:0,sneaking:false},effects:new Map(),scoreboard:{players:new Map([[uuid,{name:'NPC'}]])},inventory:{held:()=>null},world:{raycast:()=>null},eyePosition:()=>[0,1.62,0],lookVector:()=>[0,0,1],send:p=>sent.push(p)});
 game.entities=new EntityManager(game);
 game.on_spawn_entity({entityId:42,entityTypeName:'minecraft:player',objectUUID:uuid,wireType:1,type:1,x:0,y:0,z:2,yaw:0,pitch:0,headPitch:25});
 const npc=game.entities.get(42);assert.equal(npc.kind,'player');assert.equal(npc.pickable,true);assert.equal(npc.uuid,uuid);assert.equal(npc.name,'NPC');assert.equal(npc.headYaw,25);
 const interaction=new Interaction(game);interaction.updateTarget();assert.equal(interaction.target?.entity,npc);
 interaction.attackEntity(npc);const p=new Reader766(sent[0]);assert.equal(p.varint(),PLAY_SERVERBOUND_766.use_entity);assert.equal(p.varint(),42);assert.equal(p.varint(),1);assert.equal(p.bool(),false);assert.equal(p.remaining(),0);
});
