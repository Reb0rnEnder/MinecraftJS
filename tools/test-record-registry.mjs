import {test}from'node:test';import assert from'node:assert/strict';import{readFileSync}from'node:fs';
import{SoundManager}from'../client/js/audio/sound.js';
const definitions=JSON.parse(readFileSync(new URL('../client/data/items.json',import.meta.url)));
test('flattened jukebox records resolve native item IDs, including Pigstep when present',async()=>{
 const records=definitions.filter(d=>d.name.startsWith('music_disc_')),played=[];
 const sound=Object.assign(Object.create(SoundManager.prototype),{game:{items:{name:id=>definitions.find(d=>d.id===id)?.name||'unknown'},hud:{setActionBar(){}}},play:async name=>{played.push(name);return {voice:{stop(){}}};}});
 assert.ok(records.length>=12);
 for(const item of records)await sound.playRecord(item.id,0,0,0);
 assert.deepEqual(played,records.map(d=>'music_disc.'+d.name.slice(11)));await sound.playRecord(0,0,0,0);assert.equal(sound.record,null);
});

test('native conversion and workstation world events select the correct sound and category',()=>{
 const played=[],sound=Object.assign(Object.create(SoundManager.prototype),{play:(...args)=>played.push(args)});
 const events=[[1039, "entity.phantom.bite", "hostile"], [1040, "entity.zombie.converted_to_drowned", "neutral"], [1041, "entity.husk.converted_to_zombie", "neutral"], [1042, "block.grindstone.use", "block"], [1043, "item.book.page_turn", "block"], [1044, "block.smithing_table.use", "block"]];
 for(const [effectId,name,category]of events){sound.onWorldEvent({effectId,location:{x:1,y:2,z:3},data:0});const call=played.at(-1);assert.equal(call[0],name);assert.deepEqual(call.slice(1,4),[1.5,2.5,3.5]);assert.equal(call[6].category,category);}
});
