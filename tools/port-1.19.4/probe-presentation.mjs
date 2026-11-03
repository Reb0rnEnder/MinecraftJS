import{C as GamePackets}from'../../client/js/net/packets.js';
// Mutating commands are restricted to run-presentation-fixture.mjs's own MOTD.
import net from'node:net';import{once}from'node:events';import assert from'node:assert/strict';import{readFile,writeFile}from'node:fs/promises';import{join}from'node:path';import{VanillaSocket}from'../../client/js/net/tcp.js';import{setPlatform}from'../../client/js/platform/platform.js';import{decodePacket762,C762 as C}from'../../client/js/net/protocol-1.19.4.js';import{Items}from'../../client/js/game/items.js';import{Inventory}from'../../client/js/game/container.js';import{EntityManager}from'../../client/js/game/entities.js';import{ENTITIES_BY_NAME}from'../../client/js/game/entity-types.js';import{bundleContents,bundleContentWeight}from'../../client/js/game/bundle.js';import{root,cache}from'./prepare.mjs';
setPlatform({now:()=>performance.now()});
class Direct extends VanillaSocket{constructor(){super({type:'test-direct'});}async _open(host,port,onPacket,onClose){const tcp=net.createConnection({host,port});tcp.setNoDelay(true);this.stream={write:b=>tcp.write(b),close:()=>tcp.destroy()};tcp.on('data',b=>{try{this.split.feed(new Uint8Array(b),onPacket);}catch(e){this._control({type:'error',message:e.message});this.close();}});tcp.on('close',()=>{onClose?.(null);this.close();});tcp.on('error',e=>{this._control({type:'error',message:e.message});this.close();});await once(tcp,'connect');}}
const host='127.0.0.1',port=25567;
const status=await new Promise((resolve,reject)=>{const s=new Direct(),timer=setTimeout(()=>{s.close();reject(Error('Fixture status timed out'));},5000);s.on('text',text=>{const m=JSON.parse(text);if(m.type==='ping_result'){clearTimeout(timer);s.close();m.status?resolve(m.status):reject(Error(m.error));}});s.sendText(JSON.stringify({type:'ping',host,port,protocol:762}));});assert.equal(status.version.protocol,762);assert.ok(JSON.stringify(status.description).includes('MCJS isolated presentation fixture'),'refuse commands on any other server');
const data={};for(const name of['items','blocks','creative','enchantments'])data[name]=JSON.parse(await readFile(join(root,'client/data/'+name+'.json')));
const socket=new Direct(),report={features:[],paintings:[],bundleSnapshots:[],packets:{},messages:[]},game={assets:{data,translate:k=>k},player:{creative:false},heldSlot:0,gameMode:0,entityRenderer:{remove(){}},send:p=>socket.sendBinary(p)};game.items=new Items(game.assets);game.inventory=new Inventory(game);game.entities=new EntityManager(game);
let failure,joined=false,windowRevision=0;const waiters=new Set(),check=()=>{for(const f of waiters)f();},until=predicate=>new Promise((resolve,reject)=>{const timer=setTimeout(()=>{waiters.delete(f);reject(Error('Fixture timed out: '+predicate));},12000),f=()=>{if(failure){clearTimeout(timer);waiters.delete(f);reject(failure);}else if(predicate()){clearTimeout(timer);waiters.delete(f);resolve();}};waiters.add(f);f();});
socket.on('text',text=>{const m=JSON.parse(text);if(m.type==='error'||m.type==='kicked'){failure=Error(m.message||m.reason);check();}});
socket.on('binary',bytes=>{try{const p=decodePacket762(bytes);report.packets[p.name]=(report.packets[p.name]||0)+1;
 if(p.name==='login'){game.entityId=p.entityId;joined=true;socket.sendBinary(C.settings('en_us',2));}
 if(p.name==='feature_flags')report.features=p.features;
 if(p.name==='keep_alive')socket.sendBinary(C.keepAlive(p.keepAliveId));
 if(p.name==='position')socket.sendBinary(C.teleportConfirm(p.teleportId));
 if(p.name==='system_chat')report.messages.push(p.content);
 if(p.name==='window_items'&&p.windowId===0){game.inventory.stateId=p.stateId;game.inventory.setAll(p.items);game.inventory.cursor=p.carriedItem;windowRevision++;report.bundleSnapshots.push({stateId:p.stateId,carriedWeight:p.carriedItem?bundleContentWeight(p.carriedItem,game.items):null,sourceCount:p.items[37]?.count??0});}
 if(p.name==='set_slot'){if(p.windowId===0){game.inventory.stateId=p.stateId;game.inventory.setSlot(p.slot,p.item);}else if(p.windowId===-1)game.inventory.cursor=p.item;}
 if(p.name==='spawn_entity'&&p.type===ENTITIES_BY_NAME.painting.id)game.entities.spawnObject(p);
 if(p.name==='entity_metadata'&&game.entities.get(p.entityId)){game.entities.setMetadata(p.entityId,p.metadata);const e=game.entities.get(p.entityId);if(e.paintingName==='pointer')report.paintings.push({id:e.id,name:e.paintingName,width:e.width,height:e.height,facing:e.facing,box:e.box});}
 if(p.name==='kick_disconnect')throw Error('Fixture disconnected: '+p.reason);
 check();
 }catch(e){failure=e;check();}});
socket.sendText(JSON.stringify({type:'connect',host,port,username:'PresentProbe',protocol:762}));
try{
 await until(()=>joined&&windowRevision>0&&report.features.includes('minecraft:bundle'));
 const command=text=>socket.sendBinary(GamePackets.chat(text));command('/fill -3 3 1 3 8 1 minecraft:stone');command('/summon minecraft:painting 0 4 0 {variant:"minecraft:pointer",facing:2b}');
 await until(()=>report.paintings.length>0);assert.equal(report.paintings[0].width,4);assert.equal(report.paintings[0].height,4);
 command('/item replace entity @s hotbar.0 with minecraft:bundle{Items:[{id:"minecraft:stone",Count:12b}]}');command('/item replace entity @s hotbar.1 with minecraft:stone 64');
 await until(()=>game.inventory.get(36)&&game.items.name(game.inventory.get(36).id)==='bundle'&&bundleContentWeight(game.inventory.get(36),game.items)===12&&game.inventory.get(37)?.count===64);
 game.inventory.click(36,0,0);assert.equal(bundleContentWeight(game.inventory.cursor,game.items),12);
 // A harmless stale-state click asks the native server for an authoritative snapshot.
 let revision=windowRevision;socket.sendBinary(C.windowClick(0,-1,0,game.inventory.stateId+2000,0,[],game.inventory.cursor));await until(()=>windowRevision>revision);
 assert.equal(bundleContentWeight(game.inventory.cursor,game.items),12);assert.equal(game.inventory.get(36),null);
 game.inventory.click(37,1,0);assert.equal(bundleContentWeight(game.inventory.cursor,game.items),64);assert.equal(game.inventory.get(37).count,12);
 revision=windowRevision;socket.sendBinary(C.windowClick(0,-1,0,game.inventory.stateId+2000,0,[],game.inventory.cursor));await until(()=>windowRevision>revision);
 assert.equal(bundleContentWeight(game.inventory.cursor,game.items),64,'native server agrees with predicted bundle contents');assert.equal(bundleContents(game.inventory.cursor,game.items)[0].count,64);assert.equal(game.inventory.get(37).count,12);
 game.inventory.click(38,1,0);revision=windowRevision;socket.sendBinary(C.windowClick(0,-1,0,game.inventory.stateId+2000,0,[],game.inventory.cursor));await until(()=>windowRevision>revision);assert.equal(bundleContentWeight(game.inventory.cursor,game.items),0);assert.equal(game.inventory.get(38).count,64);
 await writeFile(join(cache,'presentation-live-probe.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}finally{socket.close();}
