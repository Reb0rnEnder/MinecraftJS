import {test} from 'node:test';
import assert from 'node:assert/strict';
import {crc32} from 'node:zlib';
import {ServerPacks766} from '../client/js/game/serverpacks-1.20.6.js';
import {VanillaSocket766} from '../client/js/net/tcp-1.20.6.js';
import {Reader766} from '../client/js/net/configuration-1.20.6.js';

const uuid='12345678-1234-4234-8234-123456789abc',other='aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
function zip(entries){
  const local=[],central=[];let offset=0;
  for(const [name,text] of Object.entries(entries)){
    const filename=Buffer.from(name),bytes=Buffer.from(text),crc=crc32(bytes),header=Buffer.alloc(30),record=Buffer.alloc(46);
    header.writeUInt32LE(0x04034b50);header.writeUInt16LE(20,4);header.writeUInt32LE(crc,14);header.writeUInt32LE(bytes.length,18);header.writeUInt32LE(bytes.length,22);header.writeUInt16LE(filename.length,26);
    record.writeUInt32LE(0x02014b50);record.writeUInt16LE(20,4);record.writeUInt16LE(20,6);record.writeUInt32LE(crc,16);record.writeUInt32LE(bytes.length,20);record.writeUInt32LE(bytes.length,24);record.writeUInt16LE(filename.length,28);record.writeUInt32LE(offset,42);
    local.push(header,filename,bytes);central.push(record,filename);offset+=header.length+filename.length+bytes.length;
  }
  const directory=Buffer.concat(central),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(Object.keys(entries).length,8);end.writeUInt16LE(Object.keys(entries).length,10);end.writeUInt32LE(directory.length,12);end.writeUInt32LE(offset,16);
  return new Uint8Array(Buffer.concat([...local,directory,end]));
}
const valid=()=>zip({'pack.mcmeta':'{"pack":{"pack_format":32,"description":"fixture"}}','assets/minecraft/test.txt':'test'});
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return{promise,resolve,reject}};
function fixture(mode='enabled'){
  const user={id:'user'},entry={host:'fixture',port:25565,resourceMode:mode},statuses=[],reloads=[],pending=new Map();
  const game={conn:{},serverAddress:entry,settings:{servers:[entry],save(){}},assets:{packs:[user],serverPacks:[],serverPack:null},
    screens:{current:null,open(screen){this.current=screen}},async reloadResources(){reloads.push([...this.assets.packs])},disconnect(){this.conn=null}};
  const packs=new ServerPacks766(game);packs._downloadBytes=record=>{const task=deferred();pending.set(record.url,task);return task.promise};
  const push=(id=uuid,url='https://fixture/a',forced=false)=>packs.push({uuid:id,url,hash:'',forced},status=>statuses.push([id,status]));
  return{game,packs,push,pending,statuses,reloads,user};
}

test('parallel native pack pushes activate in server order and pop restores lower-priority/user packs',async()=>{
  const f=fixture(),a=f.push(),b=f.push(other,'https://fixture/b');
  f.pending.get(b.url).resolve(valid());await b.task;await f.packs.reloadPromise;assert.deepEqual(f.game.assets.packs,[f.user]);
  f.pending.get(a.url).resolve(valid());await f.packs.whenIdle();
  assert.deepEqual(f.game.assets.serverPacks.map(pack=>pack.id),['server/'+other+'/2','server/'+uuid+'/1']);
  assert.deepEqual(f.statuses,[[uuid,3],[other,3],[other,4],[uuid,4],[other,0],[uuid,0]]);
  await f.packs.pop(other);assert.equal(f.game.assets.serverPacks.length,1);assert.equal(f.game.assets.serverPacks[0].read('test.txt')[0],116);
  f.packs.clear();await f.packs.whenIdle();assert.deepEqual(f.game.assets.packs,[f.user]);assert.equal(f.statuses.length,6,'server pop is not a client decline');
});

test('replacing a UUID and removing pending packs cannot resurrect stale downloads',async()=>{
  const f=fixture(),old=f.push(),replacement=f.push(uuid,'https://fixture/new');
  f.pending.get(replacement.url).resolve(valid());await replacement.task;await f.packs.whenIdle();
  f.pending.get(old.url).resolve(valid());await old.task;assert.equal(f.game.assets.serverPacks[0].id,'server/'+uuid+'/2');
  const pending=f.push(other,'https://fixture/late');await f.packs.pop(other);f.pending.get(pending.url).resolve(valid());await pending.task;await f.packs.whenIdle();
  assert.equal(f.game.assets.serverPacks.length,1);assert.deepEqual(f.statuses.filter(([id])=>id===other),[[other,3]]);
});

test('failed pack batches report native failure/discard statuses and keep active resources',async()=>{
  const f=fixture(),a=f.push(),b=f.push(other,'https://fixture/b');
  f.pending.get(a.url).reject(Error('download failed'));await a.task;
  f.pending.get(b.url).resolve(valid());await b.task;await f.packs.whenIdle();
  assert.deepEqual(f.statuses,[[uuid,3],[other,3],[uuid,2],[other,7]]);assert.deepEqual(f.game.assets.packs,[f.user]);
});

test('invalid metadata/reload failure reports FAILED_RELOAD and rolls resources back',async()=>{
  for(const malformed of [true,false]){
    const f=fixture(),a=f.push();let calls=0;
    if(!malformed)f.game.reloadResources=async()=>{if(++calls===1)throw Error('reload failed')};
    f.pending.get(a.url).resolve(malformed?zip({'pack.mcmeta':'invalid'}):valid());await a.task;await f.packs.whenIdle();
    assert.deepEqual(f.statuses,[[uuid,3],[uuid,4],[uuid,6]]);assert.deepEqual(f.game.assets.packs,[f.user]);
  }
});

test('native URL validation and aggregated forced-pack prompts use target results',()=>{
  let f=fixture();f.push(uuid,'file:///secret.zip');assert.deepEqual(f.statuses,[[uuid,5]]);
  f=fixture('prompt');f.push();f.push(other,'https://fixture/b',true);f.game.screens.current.callback(false);
  assert.deepEqual(f.statuses,[[uuid,1],[other,1]]);assert.equal(f.game.conn,null);
});

test('asynchronous pack status replies use whichever native phase currently owns the connection',()=>{
  const socket=new VanillaSocket766({}),sent=[];socket._send=bytes=>sent.push(bytes);
  for(const [phase,opcode] of [['configuration',6],['play',43]]){
    socket.state=phase;socket.sendResourcePackStatus(uuid,4);const r=new Reader766(sent.at(-1));assert.equal(r.varint(),opcode);assert.equal(r.uuid(),uuid);assert.equal(r.varint(),4);assert.equal(r.remaining(),0);
  }
});
