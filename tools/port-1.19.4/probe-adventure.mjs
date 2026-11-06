import assert from'node:assert/strict';import{readFile,writeFile}from'node:fs/promises';import{join}from'node:path';
import{connectFixture}from'./fixture-client.mjs';import{cache,target}from'./prepare.mjs';
import{initBlocks,blocksByName}from'../../client/js/world/blocks.js';import{Items}from'../../client/js/game/items.js';import{Interaction}from'../../client/js/game/interaction.js';import{RegistryTags}from'../../client/js/game/tags.js';import{C}from'../../client/js/net/packets.js';
const json=async p=>JSON.parse(await readFile(new URL('../../client/data/'+p,import.meta.url)));initBlocks(await json('blocks.json'),await json('blockCollisionShapes.json'));
const map=new Map(),localChanges=[],sounds=[],authoritative=[],assets={data:{items:await json('items.json'),creative:{effects:{}}}},key=p=>`${p.x},${p.y},${p.z}`;
let held=null;const g={gameMode:0,dimension:0,assets,tags:new RegistryTags(),effects:new Map(),inventory:{held:()=>held,getHand:hand=>hand?null:held},player:{x:0,y:65,z:0,onGround:true,sneaking:false,eyeHeight:()=>1.62},world:{getState:(x,y,z)=>map.get(`${x},${y},${z}`)||0,setState:(x,y,z,state)=>{map.set(`${x},${y},${z}`,state);localChanges.push({x,y,z,state});}},sound:{playBlockPlace:(...a)=>sounds.push(['place',...a]),playBlockBreak:(...a)=>sounds.push(['break',...a])},particles:{blockBreak(){}},tutorial:{onHitBlock(){}},tileRenderer:{tiles:new Map()}};g.items=new Items(assets);
const client=await connectFixture((p,state)=>{
 if(p.name==='position')Object.assign(g.player,state.position);
 if(p.name==='game_state_change'&&p.reason===3)g.gameMode=p.value;
 if(p.name==='window_items'&&p.windowId===0)held=p.items[36];
 if(p.name==='set_slot'&&(p.windowId===0&&p.slot===36||p.windowId===-2&&p.slot===0))held=p.item;
 if(p.name==='block_change'){map.set(key(p.location),p.state);authoritative.push({...p.location,state:p.state});}
 if(p.name==='multi_block_change')for(const r of p.records){const a={x:p.chunkX*16+r.x,y:r.y,z:p.chunkZ*16+r.z,state:r.state};map.set(key(a),a.state);authoritative.push(a);}
});
g.send=client.send;const i=new Interaction(g);i._canPlaceBlockOnSide=()=>true;
const t={type:'block',x:0,y:64,z:0,face:1,hit:[.5,65,.5]},marker=name=>client.until(()=>client.state.packets.some(p=>String(p.content??p.message??'').includes(name)));
try{
 const{command,until}=client;command('/gamemode creative');command('/fill -4 64 -4 4 64 4 minecraft:stone');command('/fill -1 65 -1 1 67 1 minecraft:air');command('/tp @s 2.5 65.0 3.5');command('/gamemode adventure');command('/item replace entity @s weapon.mainhand with minecraft:stone 2');await until(()=>g.gameMode===2&&held?.count===2&&g.items.name(held.id)==='stone'&&g.player.x===2.5);map.set('0,64,0',blocksByName.stone.defaultState);map.set('0,65,0',0);
 const denied=i.onPlayerRightClick(t);assert.equal(denied,false);assert.equal(localChanges.length,0);assert.equal(sounds.length,0);command('/execute if block 0 65 0 minecraft:air run say MCJS_ADVENTURE_DENIED');await marker('MCJS_ADVENTURE_DENIED');
 command('/item replace entity @s weapon.mainhand with minecraft:stone{CanPlaceOn:["minecraft:stone"]} 2');await until(()=>held?.nbt?.v?.CanPlaceOn);assert.equal(i.onPlayerRightClick(t),true);assert.equal(sounds.length,1);assert.equal(localChanges.at(-1)?.state,blocksByName.stone.defaultState);await until(()=>authoritative.some(p=>p.x===0&&p.y===65&&p.z===0&&p.state===blocksByName.stone.defaultState));command('/execute if block 0 65 0 minecraft:stone run say MCJS_ADVENTURE_ALLOWED');await marker('MCJS_ADVENTURE_ALLOWED');
 // Native START_DESTROY_BLOCK can instantly destroy with this real efficient tool.
 command('/item replace entity @s weapon.mainhand with minecraft:diamond_pickaxe{Enchantments:[{id:"minecraft:efficiency",lvl:255s}]}');await until(()=>g.items.name(held?.id)==='diamond_pickaxe'&&!held.nbt?.v?.CanDestroy);const before=localChanges.length;assert.equal(i.clickBlock({...t,y:65,hit:[.5,66,.5]},1),false);assert.equal(localChanges.length,before);
 command('/item replace entity @s weapon.mainhand with minecraft:diamond_pickaxe{CanDestroy:["minecraft:stone"],Enchantments:[{id:"minecraft:efficiency",lvl:255s}]}');await until(()=>held?.nbt?.v?.CanDestroy);client.send(C.positionLook(g.player.x,g.player.y,g.player.z,g.player.yaw,g.player.pitch,true));i.clickBlock({...t,y:65,hit:[.5,66,.5]},1);command('/execute if block 0 65 0 minecraft:air run say MCJS_ADVENTURE_BROKEN');await marker('MCJS_ADVENTURE_BROKEN');
 const report={version:'1.19.4',serverJarSha1:target.downloads.server.sha1,deniedPlacement:true,allowedPlacementConfirmed:true,deniedMining:true,allowedMiningConfirmed:true,limitations:'The actual Interaction and received server item NBT are used. Placement geometry preflight is fixed true for this known-valid stone case. No renderer or block-entity NBT acceptance is claimed.'};await writeFile(join(cache,'audit/adventure-server.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}finally{client.close();}
