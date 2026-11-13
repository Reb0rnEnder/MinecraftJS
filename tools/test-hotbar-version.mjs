import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {hotbarSnapshots,handleHotbarSnapshots} from '../client/js/gui/screens/containers.js';
import {ZipFile} from '../lib/zip.js';
const target=JSON.parse(readFileSync(new URL('./port-1.18.2/target.json',import.meta.url))),items=JSON.parse(readFileSync(new URL('../client/data/items.json',import.meta.url)));
const jar=new ZipFile(new URL('../cache/port-1.18.2/client.jar',import.meta.url)),native=JSON.parse(jar.read('version.json'));
test('saved Creative toolbars use native version identity, retain high item IDs and isolate NBT copies',()=>{
 assert.equal(target.protocol,native.protocol_version);
 const storage=new Map();globalThis.localStorage={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)};
 try{
  const highest=items.reduce((a,b)=>a.id>b.id?a:b),item={id:highest.id,count:1,damage:0,nbt:{t:10,name:'',v:{display:{t:10,v:{Name:{t:8,v:'{"text":"Saved"}'}}}}}};
  const game={inventory:{main:[item,...Array(8).fill(null)]},settings:{keys:{hotbar1:'Digit1',loadToolbarActivator:'KeyX'},keyName:k=>k},hud:{setActionBar(){}},screens:{}};
  handleHotbarSnapshots(game,0,false,true);const saved=JSON.parse([...storage.values()][0]);
  assert.equal(saved.minecraftVersion,target.minecraftVersion);assert.equal(saved.protocol,target.protocol);assert.equal(saved.dataVersion,native.world_version);
  const restored=hotbarSnapshots()[0][0];assert.equal(restored.id,highest.id);assert.deepEqual(restored.nbt,item.nbt);restored.nbt.v.display.v.Name.v='changed';assert.notEqual(hotbarSnapshots()[0][0].nbt.v.display.v.Name.v,'changed');
  assert.equal([...storage.keys()][0],'minecraftjs.hotbars.'+target.minecraftVersion+'.v1');
 }finally{delete globalThis.localStorage;}
});
