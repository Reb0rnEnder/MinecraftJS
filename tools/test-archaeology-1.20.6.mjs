import{test}from'node:test';import assert from'node:assert/strict';import{readFileSync}from'node:fs';
import{potFrame766,potTextures766,buildPot766,itemPotDecorations766}from'../client/js/render/decorated-pot-1.20.6.js';
import{brushArmPose766,applyBrushFrame766,brushDust766,brushTranslation766,startBrushing766,tickBrushing766}from'../client/js/game/brushing-1.20.6.js';
import{savedItem766}from'../client/js/render/saved-item-1.20.6.js';import{mat4}from'../client/js/gfx/math.js';import{Node}from'../client/js/gfx/scene.js';import{setJarModels}from'../client/js/render/entity-models.js';import{setModelDevice}from'../client/js/render/boxmodel.js';import{TileEntityRenderer}from'../client/js/render/tile-renderer.js';import{ItemRenderer}from'../client/js/render/item-renderer.js';import{Items}from'../client/js/game/items.js';import{Interaction}from'../client/js/game/interaction.js';import{initBlocks,blocksByName,findState}from'../client/js/world/blocks.js';import{Game}from'../client/js/game/game.js';import{createItemStack766}from'../client/js/net/item-components-1.20.6.js';import{SoundManager}from'../client/js/audio/sound.js';import{Particles}from'../client/js/render/particles.js';
const read=p=>JSON.parse(readFileSync(new URL('../'+p,import.meta.url))),native=read('tools/fixtures/pots-1.20.6.json'),models=read('cache/port-1.20.6/pots-audit/models.json'),data=Object.fromEntries(['blocks','blockCollisionShapes','items','enchantments'].map(n=>[n,read('client/data/'+n+'.json')]));
initBlocks(data.blocks,data.blockCollisionShapes);setJarModels(models);const device={createMesh:(format,cpu)=>({format,cpu}),destroyMesh(){}};setModelDevice(device);const items=new Items({data,translate:k=>k});
function near(actual,expected,label){assert.equal(actual.length,expected.length);actual.forEach((a,i)=>assert.ok(Math.abs(a-expected[i])<2e-5,`${label}[${i}]: ${a} != ${expected[i]}`));}
test('pot orientation and both wobble styles match all 256 actual native render matrices',()=>{
  for(const row of native.frames)near(potFrame766(row.facing,row.style,row.elapsed,row.partial),row.matrix,JSON.stringify(row));
  assert.deepEqual(native.durations,{NEGATIVE:10,POSITIVE:7});
});
test('brush transforms, emergence positions and dust directions match native methods',()=>{
  for(const row of native.armPoses){const part={rx:row.initial,ry:1};brushArmPose766(part);assert.equal(part.rx,Math.fround(row.rx));assert.equal(part.ry,row.ry);}
  for(const row of native.brushFrames)near(applyBrushFrame766(mat4.create(),row.side,row.ticks,row.partial,row.equip),row.matrix,JSON.stringify(row));
  for(const row of native.dust)near(brushDust766(row.view,row.face),row.delta,'dust');
  for(const row of native.translations)near(brushTranslation766(row.face,row.dusted),row.translation,JSON.stringify(row));
});
test('all pot patterns and brick fallback use native per-face material paths and jar geometry',()=>{
  for(const[key,path]of Object.entries(native.patterns))assert.equal(potTextures766([key]).back,path.replace(/^minecraft:/,'')+'.png');
  assert.equal(potTextures766(['minecraft:stick']).back,'entity/decorated_pot/decorated_pot_side.png');
  assert.equal(models.decoratedPotBase.nativeLayer,'minecraft:decorated_pot_base#main');assert.equal(models.decoratedPotSides.nativeLayer,'minecraft:decorated_pot_sides#main');
  const pot=buildPot766(['minecraft:angler_pottery_sherd','minecraft:archer_pottery_sherd','minecraft:heart_pottery_sherd','minecraft:snort_pottery_sherd']);assert.equal(pot.materials.length,5);let geometry=0;pot.root.traverse(n=>geometry+=n.drawables.length);assert.equal(geometry,7);
  const item=createItemStack766(items.byName.get('decorated_pot').id,1,{added:[{type:'pot_decorations',data:{decorations:[items.byName.get('heart_pottery_sherd').id]}}]});assert.deepEqual(itemPotDecorations766({items},item),['minecraft:heart_pottery_sherd']);
});
function game(name='decorated_pot',properties={facing:'north'}){
  let state=findState(name,properties);const sounds=[],dust=[],sent=[],g={items,device,settings:{mainHand:'right',renderDistance:8},gameMode:0,player:{usingItem:false,sneaking:false,blockInteractionRange:5},renderer:{entityRoot:new Node(),camPos:[0,1,0],boxVisible:()=>true},world:{worldAge:0,getState:()=>state,getSkyLight:()=>15,getBlockLight:()=>3},sound:{play:(...a)=>sounds.push(a)},particles:{digging:(...a)=>dust.push(a)},send:p=>sent.push(p),cooldownFraction:()=>0};
  g.tileRenderer=new TileEntityRenderer(g);return{g,sounds,dust,sent,setState:s=>{state=s;}};
}
test('pot and brushable update packets are routed, pot events retain tick zero and invalid events are ignored',()=>{
  const {g}=game(),calls=[];g.tileRenderer.setTileEntity=(...args)=>calls.push(args);
  for(const id of ['decorated_pot','brushable_block'])Game.prototype.applyBlockEntity.call(g,{t:10,v:{id:{t:8,v:'minecraft:'+id},x:{t:3,v:0},y:{t:3,v:0},z:{t:3,v:0}}});
  assert.deepEqual(calls.map(c=>c[1]),['decorated_pot','brushable_block']);
  const f=game(),r=f.g.tileRenderer,p={blockId:blocksByName.decorated_pot.id,location:{x:0,y:0,z:0},byte1:1,byte2:0};r.onBlockAction(p);const t=r._get(0,0,0);assert.equal(t.wobbleStart,0);assert.equal(t.wobbleStyle,0);r.onBlockAction({...p,byte2:2});assert.equal(t.wobbleStyle,0);r.render(.5);assert.ok(t.potRoot);assert.equal(r.breakingModel(p.location,t.state).root,t.obj);
});
test('inserting into pots consumes the click before block placement without local sound, count or swing',()=>{
  const f=game(),stack=createItemStack766(items.byName.get('stone').id,64);f.g.inventory={getHand:()=>stack,held:()=>stack,offhand:null};const it=new Interaction(f.g);it._canPlaceBlockOnSide=()=>{throw Error('pot insertion must not use placement gate');};const hit={x:0,y:0,z:0,face:1,hit:[.5,1,.5]};assert.equal(it.onPlayerRightClick(hit),'consume');assert.equal(stack.count,64);assert.equal(f.sent.length,1);assert.equal(f.sounds.length,0);it.target={...hit,type:'block'};it.swing=()=>{throw Error('CONSUME must not swing');};it.rightClickMouse();assert.equal(f.sent.length,2);
});
test('brushing strikes every ten ticks, stops on lost target, and never predicts loot, block state or durability',()=>{
  const f=game('suspicious_sand',{dusted:'1'}),held=createItemStack766(items.byName.get('brush').id),hit={type:'block',x:0,y:0,z:0,face:1,hit:[.5,1,.5]};f.g.inventory={getHand:()=>held,held:()=>held,offhand:null};f.g.lookVector=()=>[0,0,1];const it=new Interaction(f.g);it.updateTarget=()=>hit;assert.equal(startBrushing766(it,held,0),'consume');assert.equal(f.g.player.usingItem,true);
  for(let i=1;i<=35;i++){it.useTicks=i;tickBrushing766(it,held);}assert.equal(f.sounds.length,4);assert.ok(f.dust.length>=28&&f.dust.length<=48);assert.equal(f.sounds[0][0],native.brushSounds.suspicious_sand.brush.replace(/^minecraft:/,''));assert.equal(items.damage(held),0);assert.equal(held.count,1);
  it.updateTarget=()=>({type:'entity'});tickBrushing766(it,held);assert.equal(f.g.player.usingItem,false);assert.equal(it.brushItemId,undefined);assert.equal(it.sendUseItem(held),false);assert.equal(f.g.player.usingItem,false);it.brushItemId=held.id;it.finishItemUse();assert.equal(it.brushItemId,undefined,'server completion must clear brush-only state');
});
test('saved modern ItemStacks retain defaults and presentation components; campfires and archaeology render them',()=>{
  const saved={id:'minecraft:diamond',count:1,components:{'minecraft:custom_model_data':7,'minecraft:enchantment_glint_override':true}},stack=savedItem766(items,saved);assert.equal(items.component(stack,'custom_model_data'),7);assert.equal(items.maxStack(stack),64);assert.equal(items.hasEffect(stack),true);assert.equal(stack.savedItem,saved);const enchanted=savedItem766(items,{id:'minecraft:diamond_sword',components:{'minecraft:enchantments':{levels:{'minecraft:sharpness':3}}}});assert.equal(items.enchantLevel(enchanted,'sharpness'),3);assert.equal(items.hasEffect(enchanted),true);assert.equal(savedItem766(items,{id:'minecraft:diamond',count:0}),null);
  for(const name of ['suspicious_sand','campfire']){
    const f=game(name,name==='campfire'?{facing:'north'}:{dusted:'2'}),rendered=[];f.g.assets={};f.g.itemRenderer={objectFor:item=>{rendered.push(item);return{obj:new Node()};},modelFor:()=>({display:{fixed:{}}})};const t=f.g.tileRenderer._ensure(0,0,0,f.g.world.getState());t.data=name==='campfire'?{Items:[{...saved,Slot:0}]}:{item:saved,hit_direction:2};f.g.tileRenderer._build(t);assert.equal(rendered.length,1,name);assert.equal(items.component(rendered[0],'custom_model_data'),7);assert.ok(t.obj.children.length);
  }
});
test('archaeology completion uses the native sound category and block debris, not a generic break sound',()=>{
  const played=[],particles=[],sound=Object.assign(Object.create(SoundManager.prototype),{play:(...a)=>played.push(a),playBlockBreak:()=>{throw Error('incorrect break sound');}}),system=Object.assign(Object.create(Particles.prototype),{blockBreak:(...a)=>particles.push(a)});
  for(const name of ['suspicious_sand','suspicious_gravel']){const p={effectId:3008,location:{x:1,y:2,z:3},data:findState(name,{dusted:'3'})};sound.onWorldEvent(p);system.onWorldEvent(p);assert.equal(played.at(-1)[0],native.brushSounds[name].complete.replace(/^minecraft:/,''));assert.equal(played.at(-1)[6].category,'player');assert.deepEqual(particles.at(-1),[1,2,3,p.data]);}
});

test('built-in pot item orientation matches native default and centering remains outside its explicit matrix',()=>{
 const game={items},r=Object.assign(Object.create(ItemRenderer.prototype),{game});r.modelFor=()=>({path:'item/decorated_pot'});const a=createItemStack766(items.byName.get('decorated_pot').id),b=createItemStack766(a.id,1,{added:[{type:'pot_decorations',data:{decorations:[items.byName.get('heart_pottery_sherd').id]}}]});assert.notEqual(r.iconKey(a),r.iconKey(b));
 const builtin=r._builtinObject(a,{itemName:'decorated_pot'},true);assert.equal(builtin.matrix,null);near(builtin.children[0].matrix,potFrame766(native.itemFacing),"item facing");r.meshFor=()=>({builtin,model:{}});const obj=r.objectFor(a,null).obj;assert.equal(obj.children[0].position.x,-.5);assert.equal(obj.children[0].position.y,-.5);assert.equal(obj.children[0].position.z,-.5);
});

test('pot entity-solid materials cull inward faces and sample native block-position light',()=>{
 const {g}=game();g.world.getSkyLight=(x,y,z)=>x===0&&y===0&&z===0?2:15;g.world.getBlockLight=(x,y,z)=>x===0&&y===0&&z===0?1:14;g.tileRenderer._ensure(0,0,0,g.world.getState());g.tileRenderer.render(.5);const t=g.tileRenderer._get(0,0,0);for(const material of t.materials){assert.equal(material.state.cull,true);assert.equal(material.params.p[8],2);assert.equal(material.params.p[9],1);}
});
