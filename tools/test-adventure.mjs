import{test}from'node:test';import assert from'node:assert/strict';import{readFileSync}from'node:fs';
import{initBlocks,blocksByName,findState,getStateProperties,getBlock}from'../client/js/world/blocks.js';
import{RegistryTags}from'../client/js/game/tags.js';import{parseSnbt}from'../client/js/net/snbt.js';
import{adventurePredicate,matchesAdventurePredicate,matchesAdventureNbt,adventureAllows}from'../client/js/game/adventure.js';
import{Interaction}from'../client/js/game/interaction.js';import{nbt,TAG}from'../client/js/net/nbt.js';
initBlocks(JSON.parse(readFileSync(new URL('../client/data/blocks.json',import.meta.url))),JSON.parse(readFileSync(new URL('../client/data/blockCollisionShapes.json',import.meta.url))));
const native=JSON.parse(readFileSync(new URL('./fixtures/adventure-native-1.19.4.json',import.meta.url))),tags=new RegistryTags({blocks:Object.fromEntries(Object.entries(native.tags).map(([k,v])=>[k,v.map(n=>blocksByName[n.replace('minecraft:','')].id)]))});
function state(text){const[name,props]=text.replace('minecraft:','').split('[');return findState(name,{...getStateProperties(blocksByName[name].defaultState),...Object.fromEntries((props?.slice(0,-1)||'').split(',').filter(Boolean).map(s=>s.split('=')))});}
for(const f of native.cases)test('native block predicate '+f.state+' <- '+JSON.stringify(f.predicate),()=>{
 const s=state(f.state),actual=f.blockEntityNbt?parseSnbt(f.blockEntityNbt):null;assert.equal(matchesAdventurePredicate(f.predicate,getBlock(s),s,tags,actual),f.matched);
});
const item=(key,entries)=>({id:1,count:4,nbt:nbt.compound({[key]:nbt.list(TAG.STRING,entries)})});
function fixture(mode=2){
 const sent=[],sounds=[],changes=[],held=item('CanPlaceOn',[]),ground=blocksByName.stone.defaultState;
 const g={gameMode:mode,entityId:1,player:{sneaking:false,usingItem:false},ticks:0,inventory:{held:()=>held,getHand:()=>held},items:{name:()=> 'stone',isBlockItem:()=>true},tags,world:{getState:()=>ground,setState:(...a)=>changes.push(a)},send:p=>sent.push(p),sound:{playBlockPlace:(...a)=>sounds.push(a),playBlockHit:(...a)=>sounds.push(a)},tutorial:{onHitBlock(){}},tileRenderer:{tiles:new Map()},entities:{all:()=>[]}};
 const i=new Interaction(g);i._canPlaceBlockOnSide=()=>true;i._placedBlock=()=>blocksByName.stone;i._placementPos=()=>({p:{x:0,y:65,z:0}});i._predictPlace=(...a)=>changes.push(a);i._creativeSwordBlocksMining=()=>false;i.relativeHardness=()=>1;i.destroyBlockClient=(...a)=>changes.push(a);i._sendDig=(...a)=>sent.push(a);i._extinguishFire=()=>false;
 const t={type:'block',x:0,y:64,z:0,face:1,hit:[.5,65,.5]};return{g,i,held,t,sent,sounds,changes};
}
test('Adventure cannot begin or continue an unauthorized break, or predict a placement',()=>{
 const f=fixture();assert.equal(f.i.clickBlock(f.t,1),false);assert.equal(f.i.onPlayerDamageBlock(f.t,1),false);assert.deepEqual(f.sent,[]);assert.deepEqual(f.changes,[]);
 assert.equal(f.i.onPlayerRightClick(f.t),false);assert.equal(f.held.count,4);assert.deepEqual(f.sounds,[]);assert.deepEqual(f.changes,[]);assert.equal(f.sent.length,1); // Native Use Item On is still sent.
});
test('native permission lists enable mining and item use without affecting Survival/Creative',()=>{
 let f=fixture();f.held.nbt=item('CanDestroy',['minecraft:stone']).nbt;f.i.clickBlock(f.t,1);assert.equal(f.changes.length,1);
 f=fixture();f.held.nbt=item('CanPlaceOn',['minecraft:stone']).nbt;assert.equal(f.i.onPlayerRightClick(f.t),true);assert.equal(f.held.count,3);assert.equal(f.changes.length,1);assert.equal(f.sounds.length,1);
 for(const mode of[0,1]){f=fixture(mode);assert.equal(f.i.onPlayerRightClick(f.t),true);assert.equal(f.held.count,mode===1?4:3);}
});
test('Adventure still activates containers without placement permission and honors the actual hand',()=>{
 const f=fixture();f.g.world.getState=()=>blocksByName.chest.defaultState;assert.equal(f.i.onPlayerRightClick(f.t),true);assert.equal(f.held.count,4);assert.deepEqual(f.changes,[]);
 f.g.world.getState=()=>blocksByName.stone.defaultState;f.g.inventory.getHand=hand=>hand?item('CanPlaceOn',['stone']):f.held;assert.equal(f.i.onPlayerRightClick(f.t,0),false);assert.equal(f.i.onPlayerRightClick(f.t,1),true);
});
test('permission lists are typed NBT strings; malformed or empty lists cannot grant access',()=>{
 const f=fixture();for(const n of[null,nbt.compound({CanPlaceOn:nbt.string('stone')}),nbt.compound({CanPlaceOn:nbt.list(TAG.INT,[1])}),nbt.compound({CanPlaceOn:nbt.list(TAG.STRING,['missing','stone[foo=undefined]'])})]){f.held.nbt=n;assert.equal(adventureAllows(f.g,f.held,'CanPlaceOn',f.t),false);}
});
test('typed compound/list matching follows native unordered subset rules',()=>{
 assert.equal(matchesAdventureNbt(parseSnbt('{a:[{x:1},{x:1}]}'),parseSnbt('{a:[{y:3,x:1}]}')),true);assert.equal(matchesAdventureNbt(parseSnbt('{a:[]}'),parseSnbt('{a:[1]}')),false);assert.equal(matchesAdventureNbt(parseSnbt('{x:1b}'),parseSnbt('{x:1}')),false);
});
