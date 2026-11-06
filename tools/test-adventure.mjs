import{test}from'node:test';import assert from'node:assert/strict';import{readFileSync}from'node:fs';
import{initBlocks,blocksByName}from'../client/js/world/blocks.js';import{adventureAllows}from'../client/js/game/adventure.js';import{Interaction}from'../client/js/game/interaction.js';import{nbt,TAG}from'../client/js/net/nbt.js';
initBlocks(JSON.parse(readFileSync(new URL('../client/data/blocks.json',import.meta.url))),JSON.parse(readFileSync(new URL('../client/data/blockCollisionShapes.json',import.meta.url))));
const state=b=>b.id<<4,item=(key,entries)=>({id:1,count:4,damage:0,nbt:nbt.compound({[key]:nbt.list(TAG.STRING,entries)})});
function fixture(mode=2){
 const sent=[],sounds=[],changes=[],held=item('CanPlaceOn',[]),g={gameMode:mode,entityId:1,player:{sneaking:false,usingItem:false},ticks:0,inventory:{held:()=>held,getHand:()=>held},items:{name:()=> 'stone'},world:{getState:()=>state(blocksByName.stone),setState:(...a)=>changes.push(a)},send:p=>sent.push(p),sound:{playBlockPlace:(...a)=>sounds.push(a),playBlockHit:(...a)=>sounds.push(a)},tutorial:{onHitBlock(){}},entities:{all:()=>[]}};
 const i=new Interaction(g);i._canPlaceBlockOnSide=()=>true;i._placedBlock=()=>blocksByName.stone;i._placementPos=()=>({p:{x:0,y:65,z:0}});i._predictPlace=(...a)=>changes.push(a);i._creativeSwordBlocksMining=()=>false;i.relativeHardness=()=>1;i.destroyBlockClient=(...a)=>changes.push(a);i._sendDig=(...a)=>sent.push(a);i._extinguishFire=()=>false;
 const t={type:'block',x:0,y:64,z:0,face:1,hit:[.5,65,.5]};return{g,i,held,t,sent,sounds,changes};
}
for(const name of['stone','minecraft:stone','1'])test('legacy block-name permission '+name,()=>{const f=fixture();f.held.nbt=item('CanPlaceOn',[name]).nbt;assert.equal(adventureAllows(f.g,f.held,'CanPlaceOn',f.t),true);});
test('legacy lists do not gain newer predicates/tags/NBT or state syntax',()=>{const f=fixture();for(const name of['#minecraft:stone','stone[]','stone{}','stone[variant=granite]','stone suffix','minecraft:missing']){f.held.nbt=item('CanPlaceOn',[name]).nbt;assert.equal(adventureAllows(f.g,f.held,'CanPlaceOn',f.t),false,name);}f.g.world.getState=()=>state(blocksByName.stone)|5;f.held.nbt=item('CanPlaceOn',['stone']).nbt;assert.equal(adventureAllows(f.g,f.held,'CanPlaceOn',f.t),true);});
test('Adventure cannot mine or locally place without the required permission',()=>{const f=fixture();assert.equal(f.i.clickBlock(f.t,1),false);assert.equal(f.i.onPlayerDamageBlock(f.t,1),false);assert.deepEqual(f.sent,[]);assert.equal(f.i.onPlayerRightClick(f.t),false);assert.equal(f.sent.length,1);assert.equal(f.held.count,4);assert.deepEqual(f.changes,[]);assert.deepEqual(f.sounds,[]);});
test('matching legacy permissions enable break/place and preserve Creative stack restoration',()=>{
 let f=fixture();f.held.nbt=item('CanDestroy',['stone']).nbt;f.i.clickBlock(f.t,1);assert.equal(f.changes.length,1);
 f=fixture();f.held.nbt=item('CanPlaceOn',['stone']).nbt;assert.equal(f.i.onPlayerRightClick(f.t),true);assert.equal(f.held.count,3);assert.equal(f.sounds.length,1);
 for(const mode of[0,1]){f=fixture(mode);assert.equal(f.i.onPlayerRightClick(f.t),true);assert.equal(f.held.count,mode===1?4:3);}
});
test('Adventure container activation remains available',()=>{const f=fixture();f.g.world.getState=()=>state(blocksByName.chest);assert.equal(f.i.onPlayerRightClick(f.t),true);assert.equal(f.held.count,4);assert.deepEqual(f.changes,[]);});
test('1.8.9 keeps native spawn-egg success and firework client failure',()=>{const f=fixture();f.i._placedBlock=()=>null;for(const id of[383,401]){f.held.id=id;assert.equal(f.i._onItemUse(f.t,f.held),id===383);}});
test('malformed permission data does not grant access',()=>{const f=fixture();for(const tag of[null,nbt.compound({CanPlaceOn:nbt.string('stone')}),nbt.compound({CanPlaceOn:nbt.list(TAG.INT,[1])})]){f.held.nbt=tag;assert.equal(adventureAllows(f.g,f.held,'CanPlaceOn',f.t),false);}});
