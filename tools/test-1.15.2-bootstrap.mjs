import{test}from'node:test';import assert from'node:assert/strict';import{readFileSync,existsSync}from'node:fs';import{join}from'node:path';
import{cache,target,verify}from'./port-1.15.2/prepare.mjs';
import{protocolChanges}from'./port-1.15.2/reports.mjs';
import{CLIENTBOUND_578,SERVERBOUND_578}from'../client/js/net/protocol-1.15.2-ids.js';
import{PROTOCOL_VERSION}from'../client/js/net/packets.js';
const baseline=JSON.parse(readFileSync(new URL('./port-1.15.2/baseline.json',import.meta.url))),prepared=existsSync(join(cache,'verified-inputs.json'));
const json=name=>JSON.parse(readFileSync(join(cache,name)));
test('staged target pins native 1.15.2 while active runtime remains explicitly 1.14.4',()=>{
 assert.equal(target.minecraftVersion,'1.15.2');assert.equal(target.protocol,578);assert.equal(PROTOCOL_VERSION,498);assert.equal(target.runtimeBaseline,'1.14.4');
 for(const source of [target.metadata,target.assetIndex,...Object.values(target.downloads),...Object.values(target.minecraftData.inputs)]){assert.match(source.sha1,/^[a-f0-9]{40}$/);assert.match(source.url,/^https:\/\//);}
 assert.equal(baseline.sources.client,target.downloads.client.sha1);assert.equal(baseline.sources.server,target.downloads.server.sha1);assert.equal(baseline.sources.minecraftDataRevision,target.minecraftData.revision);assert.throws(()=>verify(Buffer.from('corruption'),target.downloads.client.sha1,'test'),/mismatch/);
});
test('staged packet mapping has complete unique IDs and covers the moved digging acknowledgement',()=>{
 for(const table of[CLIENTBOUND_578,SERVERBOUND_578])assert.equal(new Set(Object.values(table)).size,Object.keys(table).length);
 assert.equal(Object.keys(CLIENTBOUND_578).length,93);assert.equal(Object.keys(SERVERBOUND_578).length,46);assert.equal(CLIENTBOUND_578.acknowledge_player_digging,8);assert.equal(CLIENTBOUND_578.login,0x26);assert.equal(CLIENTBOUND_578.map_chunk,0x22);
});
test('verified native reports record contiguous state IDs and new bee/honey content',{skip:!prepared},()=>{
 const blocks=json('generated/reports/blocks.json'),registries=json('generated/reports/registries.json'),ids=[];
 for(const [name,b]of Object.entries(blocks)){assert.equal(b.states.filter(s=>s.default).length,1,name);for(const s of b.states)ids.push(s.id);}
 ids.sort((a,b)=>a-b);assert.ok(ids.every((id,i)=>id===i));assert.equal(ids.length,11337);assert.equal(Object.keys(blocks).length,680);assert.equal(baseline.blocks,680);
 for(const name of['honey_block','honeycomb_block','bee_nest','beehive'])assert.ok(blocks['minecraft:'+name],name);
 assert.ok(registries['minecraft:entity_type'].entries['minecraft:bee']);assert.equal(Object.keys(registries['minecraft:item'].entries).length,884);assert.equal(baseline.resources.recipes,768);assert.equal(baseline.resources.packMetadata.pack.pack_format,5);assert.equal(baseline.resources.beeTextures.length,5);
});
test('protocol comparison reproduces the committed changed layouts and never assumes a global ID offset',{skip:!prepared},()=>{
 const before=json('protocol-1.14.4.json'),after=json('protocol-1.15.2.json');for(const d of['toClient','toServer'])assert.deepEqual(protocolChanges(before,after,d),baseline.protocolChanges[d]);
 assert.deepEqual(baseline.protocolChanges.toServer.moved,[]);assert.deepEqual(baseline.protocolChanges.toServer.changed,[]);
 assert.deepEqual(baseline.protocolChanges.toClient.changed,['spawn_entity_living','named_entity_spawn','game_state_change','map_chunk','world_particles','login','respawn']);
 const mappings=after.play.toClient.types.packet[1][0].type[1].mappings;for(const[id,name]of Object.entries(mappings))assert.equal(CLIENTBOUND_578[name],Number(id));
 const fields=name=>after.play.toClient.types['packet_'+name][1];assert.equal(fields('world_particles').find(f=>f.name==='x').type,'f64');assert.ok(fields('login').some(f=>f.name==='hashedSeed'));assert.ok(fields('login').some(f=>f.name==='enableRespawnScreen'));assert.ok(!fields('spawn_entity_living').some(f=>f.name==='metadata'));assert.ok(fields('map_chunk').some(f=>f.name==='biomes'));
});
