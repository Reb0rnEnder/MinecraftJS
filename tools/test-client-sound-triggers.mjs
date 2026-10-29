import{test}from'node:test';import assert from'node:assert/strict';import{readFileSync}from'node:fs';
import{SoundManager,soundAssetName,soundTypeOf}from'../client/js/audio/sound.js';import{initBlocks,blocksByName}from'../client/js/world/blocks.js';import{Interaction}from'../client/js/game/interaction.js';import{ENTITY_TYPES}from'../client/js/game/entity-types.js';
const read=name=>JSON.parse(readFileSync(new URL('../client/'+name,import.meta.url))),defs=read('assets/minecraft/sounds.json');initBlocks(read('data/blocks.json'),read('data/blockCollisionShapes.json'));
test('all living mob hurt/death and block sound-type references resolve',()=>{
 const sound=Object.create(SoundManager.prototype);
 for(const entity of ENTITY_TYPES.filter(e=>e.mob))for(const size of[1,4])for(const name of sound._mobSounds({entityName:entity.name,size}))assert.ok(defs[soundAssetName(name)],entity.name+': '+name);
 for(const block of Object.values(blocksByName))for(const index of[0,1,2,5,6]){const name=soundTypeOf(block)[index];assert.ok(defs[soundAssetName(name)],block.name+': '+name);}
});
test('composter, lava, torch burnout and portal-frame events play native sounds',()=>{
 const calls=[],sound=Object.assign(Object.create(SoundManager.prototype),{play:(...args)=>calls.push(args)});
 for(const[id,data,name]of[[1500,0,'block.composter.fill'],[1500,1,'block.composter.fill_success'],[1501,0,'block.lava.extinguish'],[1502,0,'block.redstone_torch.burnout'],[1503,0,'block.end_portal_frame.fill'],[3000,0,'block.end_gateway.spawn'],[3001,0,'entity.ender_dragon.growl']]){
  sound.onWorldEvent({effectId:id,data,location:{x:1,y:2,z:3}});const call=calls.at(-1);assert.equal(call[0],name);assert.ok(defs[name]);assert.equal(call[6].category,id===3001?'hostile':'block');assert.deepEqual(call.slice(1,4),id===1500?[1,2,3]:[1.5,2.5,3.5]);
 }
});
test('extinguishing fire uses the fire-extinguish event rather than rocket launch',()=>{
 const sounds=[],fire=blocksByName.fire.defaultState??blocksByName.fire.id<<4,g={world:{getState:()=>fire,setState(){}},sound:{onWorldEvent:event=>sounds.push(event)}};
 const interaction=new Interaction(g);assert.equal(interaction._extinguishFire({x:0,y:64,z:0},1),true);assert.equal(sounds[0].effectId,1009);
});

test('dragon fireball events are conditional and new mob aliases/categories are native',()=>{
 const calls=[],sound=Object.assign(Object.create(SoundManager.prototype),{play:(...args)=>calls.push(args)});
 sound.onWorldEvent({effectId:2006,data:0,location:{x:0,y:0,z:0}});assert.equal(calls.length,0);
 sound.onWorldEvent({effectId:2006,data:1,location:{x:0,y:0,z:0}});assert.equal(calls[0][0],'entity.dragon_fireball.explode');assert.equal(calls[0][6].category,'hostile');
 assert.deepEqual(sound._mobSounds({entityName:'ocelot'}),['entity.ocelot.hurt','entity.ocelot.death']);assert.deepEqual(sound._mobSounds({entityName:'trader_llama'}),['entity.llama.hurt','entity.llama.death']);
 for(const entityName of['pillager','ravager'])assert.equal(sound._mobCategory({entityName,kind:'mob'}),'hostile');
});
