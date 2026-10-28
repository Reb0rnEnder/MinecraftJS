import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {CommandTree} from '../client/js/game/commands.js';import {readCommandTree} from '../client/js/net/command-tree.js';import {Reader} from '../client/js/net/buffer.js';
const fixture=JSON.parse(readFileSync(new URL('./fixtures/commands-native.json',import.meta.url)));
const data=Object.fromEntries(['blocks','items','effects','enchantments','entities','sounds','particles'].map(n=>[n,JSON.parse(readFileSync(new URL('../client/data/'+n+'.json',import.meta.url)))]));
const bytes=Uint8Array.from(Buffer.from(fixture.body,'base64')),reader=new Reader(bytes),packet=readCommandTree(reader),tree=new CommandTree(packet,{assets:{data},tags:{names:()=>[]}});
test(fixture.source.version+': complete native command tree consumes every wire byte',()=>{assert.equal(reader.offset,bytes.length);assert.ok(packet.nodes.length>700);});
for(const row of fixture.cases)test(fixture.source.version+': native Brigadier oracle '+row.input,()=>{
 const parsed=tree.parse(row.input);assert.equal(parsed.cursor,Math.min(row.input.length,row.cursor),'reader cursor');assert.equal(!!parsed.error,row.unread,'unread/error state');
 const ranges=parsed.spans.map(s=>[s.start,s.end]).sort((a,b)=>a[0]-b[0]);assert.deepEqual(ranges,row.ranges.map(([a,b])=>[a,Math.min(row.input.length,b)]).sort((a,b)=>a[0]-b[0]),'parsed argument ranges');
});
