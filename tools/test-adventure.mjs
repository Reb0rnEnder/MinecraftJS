import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {initBlocks,blocksByName,findState,getStateProperties} from '../client/js/world/blocks.js';
import {RegistryTags} from '../client/js/game/tags.js';
import {parseSnbt} from '../client/js/net/snbt.js';
import {Reader774,Writer774} from '../client/js/net/configuration-1.21.11.js';
import {createItemStack774} from '../client/js/net/item-components-1.21.11.js';
import {ITEM_DEFAULTS_774} from '../client/js/net/item-components-1.21.11-defaults.js';
import {adventureAllows} from '../client/js/game/adventure.js';
import {Interaction} from '../client/js/game/interaction.js';
const read=p=>JSON.parse(readFileSync(new URL('../'+p,import.meta.url))),native=read('tools/fixtures/adventure-1.21.11.json');
initBlocks(read('client/data/blocks.json'),read('client/data/blockCollisionShapes.json'));
const tags=new RegistryTags(),stoneItem=ITEM_DEFAULTS_774.items.findIndex(i=>i.name==='minecraft:stone');
for(const row of native.samples)test('native component permission '+row.label,()=>{
 const bytes=new Uint8Array(Buffer.from(row.wire,'base64')),r=new Reader774(bytes),item=r.slot();assert.equal(r.remaining(),0,'consume native stack completely');assert.deepEqual(new Writer774().slot(item).build(),bytes,'exact native stack re-encoding');
 const block=blocksByName[row.block.replace('minecraft:','')],state=findState(block.name,{...getStateProperties(block.defaultState),...row.state}),nbt=row.actualNbt?parseSnbt(row.actualNbt):null;
 const g={world:{getState:()=>state},tags,tileRenderer:{tiles:nbt?new Map([['0,64,0',{state,nbt}]]):new Map()}};
 assert.equal(adventureAllows(g,item,row.component==='can_break'?'CanDestroy':'CanPlaceOn',{x:0,y:64,z:0}),row.matched);
});
const permission=(type,block=blocksByName.stone.id)=>({type,data:{predicates:[{blockSet:{blockIds:[block]},properties:null,nbt:null}],showTooltip:true}});
const patch=(item,added=[],removed=[])=>Object.assign(item,createItemStack774(item.id,item.count,{added,removed}));
function fixture(mode=2){
 const sent=[],sounds=[],changes=[],held=createItemStack774(stoneItem,4),ground=blocksByName.stone.defaultState;
 const g={gameMode:mode,entityId:1,player:{sneaking:false,usingItem:false},ticks:0,inventory:{held:()=>held,getHand:()=>held},items:{name:()=> 'stone',isBlockItem:()=>true},tags,world:{getState:()=>ground,setState:(...a)=>changes.push(a)},send:p=>sent.push(p),sound:{playBlockPlace:(...a)=>sounds.push(a),playBlockHit:(...a)=>sounds.push(a)},tutorial:{onHitBlock(){}},tileRenderer:{tiles:new Map()},entities:{all:()=>[]}};
 const i=new Interaction(g);i._canPlaceBlockOnSide=()=>true;i._placedBlock=()=>blocksByName.stone;i._placementPos=()=>({p:{x:0,y:65,z:0}});i._predictPlace=(...a)=>changes.push(a);i._creativeSwordBlocksMining=()=>false;i.relativeHardness=()=>1;i.destroyBlockClient=(...a)=>changes.push(a);i._sendDig=(...a)=>sent.push(a);i._extinguishFire=()=>false;
 const t={type:'block',x:0,y:64,z:0,face:1,hit:[.5,65,.5]};return {g,i,held,t,sent,sounds,changes};
}
test('Adventure denies unauthorized break continuation and item use prediction',()=>{
 const f=fixture();assert.equal(f.i.clickBlock(f.t,1),false);assert.equal(f.i.onPlayerDamageBlock(f.t,1),false);assert.deepEqual(f.sent,[]);assert.deepEqual(f.changes,[]);
 assert.equal(f.i.onPlayerRightClick(f.t),false);assert.equal(f.held.count,4);assert.deepEqual(f.sounds,[]);assert.deepEqual(f.changes,[]);assert.equal(f.sent.length,1);
});
test('native components grant mining and placement; Survival/Creative retain their behavior',()=>{
 let f=fixture();patch(f.held,[permission('can_break')]);f.i.clickBlock(f.t,1);assert.equal(f.changes.length,1);
 f=fixture();patch(f.held,[permission('can_place_on')]);assert.equal(f.i.onPlayerRightClick(f.t),true);assert.equal(f.held.count,3);assert.equal(f.changes.length,1);assert.equal(f.sounds.length,1);
 for(const mode of [0,1]){f=fixture(mode);assert.equal(f.i.onPlayerRightClick(f.t),true);assert.equal(f.held.count,mode===1?4:3);}
});
test('Adventure can activate containers without placement permission and checks the actual hand',()=>{
 const f=fixture();f.g.world.getState=()=>blocksByName.chest.defaultState;assert.equal(f.i.onPlayerRightClick(f.t),true);assert.equal(f.held.count,4);
 f.g.world.getState=()=>blocksByName.stone.defaultState;f.g.inventory.getHand=hand=>hand?createItemStack774(stoneItem,1,{added:[permission('can_place_on')]}):f.held;
 assert.equal(f.i.onPlayerRightClick(f.t,0),false);assert.equal(f.i.onPlayerRightClick(f.t,1),true);
});
test('legacy NBT cannot grant modern permissions, and removed patches take effect',()=>{
 const {g,held,t}=fixture();held.nbt=parseSnbt('{CanDestroy:["minecraft:stone"],CanPlaceOn:["minecraft:stone"]}');assert.equal(adventureAllows(g,held,'CanDestroy',t),false);assert.equal(adventureAllows(g,held,'CanPlaceOn',t),false);
 patch(held,[permission('can_break')]);assert.equal(adventureAllows(g,held,'CanDestroy',t),true);patch(held,[],['can_break']);assert.equal(adventureAllows(g,held,'CanDestroy',t),false);
});
test('tags use the live server registry and do not retain a cached answer across transfers',()=>{
 const f=fixture();patch(f.held,[{type:'can_break',data:{predicates:[{blockSet:{name:'custom:allowed'},properties:null,nbt:null}],showTooltip:false}}]);
 f.g.tags=new RegistryTags({blocks:{'custom:allowed':[blocksByName.stone.id]}});assert.equal(adventureAllows(f.g,f.held,'CanDestroy',f.t),true);f.g.tags.replace({blocks:{'custom:allowed':[]}});assert.equal(adventureAllows(f.g,f.held,'CanDestroy',f.t),false);
});
