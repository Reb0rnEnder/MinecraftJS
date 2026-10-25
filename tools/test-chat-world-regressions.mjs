import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import mcassets from '../lib/mcassets.js';
import {Assets} from '../client/js/assets.js';
import {Items} from '../client/js/game/items.js';
import {chatToPlain,chatSegments,setTranslator} from '../client/js/gui/chat.js';
import {Hud} from '../client/js/gui/hud.js';
import {ChatScreen} from '../client/js/gui/screens/chat.js';
import {tickFallingBlock} from '../client/js/game/falling-block.js';
import {World} from '../client/js/world/world.js';
import {Chunk} from '../client/js/world/chunk.js';
import {initBlocks,blocksByName} from '../client/js/world/blocks.js';
import {Interaction} from '../client/js/game/interaction.js';
import {Mesher} from '../client/js/render/mesher.js';
const data=Object.fromEntries(['items','blocks','creative','blockCollisionShapes','foods','materials','effects','enchantments'].map(n=>[n,JSON.parse(readFileSync(new URL('../client/data/'+n+'.json',import.meta.url)))]));
initBlocks(data.blocks,data.blockCollisionShapes);
const native=mcassets.MC_VERSION==='1.13.2',state=name=>native?blocksByName[name].defaultState:blocksByName[name].id<<4;
const assets={data,lang:{},translate:Assets.prototype.translate,itemsById:new Map([...data.blocks,...data.items].map(d=>[d.id,d])),itemsByName:new Map([...data.blocks,...data.items].map(d=>[d.name,d]))};
setTranslator((key,args)=>assets.translate(key,args));

test('unknown translation keys substitute server-provided %s and indexed arguments, preserving hover components',()=>{
 const raw={translate:'%s',with:[{text:'Welcome to the server',hoverEvent:{action:'show_text',value:'Description'}}]};
 assert.equal(chatToPlain(JSON.stringify(raw)),'Welcome to the server');assert.equal(chatSegments(raw).find(c=>c.hover).hover.value,'Description');
 assert.equal(assets.translate('%2$s %% %1$s',['first','second']),'second % first');assert.equal(assets.translate('unknown.key'),'unknown.key');
});

test('expired chat stays in history and renders again when a chat screen with a minified class name opens',()=>{
 const drawn=[],font={width:s=>s.replace(/§./g,'').length*6,wrap:s=>[s],draw:s=>drawn.push(s)};
 const g={gui:{width:320,height:240,font,pushMatrix(){},popMatrix(){},translate(){},scaleBy(){},rect(){}},settings:{chatWidth:1,chatScale:1},screens:{current:null}};
 const hud=g.hud=new Hud(g);hud.addChat('old message',null);hud.updateCounter=300;hud.renderChat(g.gui);assert.equal(drawn.length,0);assert.equal(hud.chat.length,1);
 class x extends ChatScreen{}g.screens.current=new x(g,'');assert.equal(hud.chatOpen(),true);hud.renderChat(g.gui);assert.deepEqual(drawn,['old message']);assert.equal(hud.chatLines.length,1);
});

if(blocksByName.grass_path)test('path top faces use bright adjacent skylight immediately after chunk loading',()=>{
 const w=new World(),c=new Chunk(0,0,true);w.chunks.set(World.key(0,0),c);c.setState(8,64,8,state('grass_path'));c.setSkyLight(8,64,8,0);c.setSkyLight(8,65,8,15);
 const m=Object.create(Mesher.prototype);m.world={getState:(x,y,z)=>w.getState(x,y,z),getLight:(x,y,z)=>(w.getSkyLight(x,y,z)<<4)|w.getBlockLight(x,y,z)};
 assert.equal(w.opacity(state('grass_path')),15);
 assert.equal(m.lightAt(8,64,8)>>4,15);assert.equal(w.getState(8,64,8),state('grass_path'));
});

test('falling sand removes its source, collides at the floor and does not obstruct its synchronized landing block',()=>{
 const w=new World(),c=new Chunk(0,0,true);w.chunks.set(World.key(0,0),c);c.setState(8,63,8,state('stone'));c.setState(8,67,8,state('sand'));
 const e={kind:'falling',blockState:state('sand'),x:8.5,y:67,z:8.5,width:Math.fround(.98),height:Math.fround(.98),motionX:0,motionY:0,motionZ:0};
 tickFallingBlock(e,w);assert.equal(w.getState(8,67,8),0);for(let i=0;i<45;i++)tickFallingBlock(e,w);assert.equal(e.y,64);assert.equal(e.onGround,true);assert.equal(w.getState(8,64,8),0,'landing blocks remain server-authoritative');
 w.setState(8,64,8,state('sand'));tickFallingBlock(e,w);assert.equal(e.y,64);assert.equal(e.fallingSettled,true);
 const g={world:w,items:new Items(assets),entities:{all:()=>[e]},player:{bb:()=>[30,64,30,31,66,31]}};
 const interaction=Object.create(Interaction.prototype);interaction.game=g;Object.defineProperty(interaction,'player',{value:g.player});
 const held={id:g.items.byName.get('stone').id,count:64,damage:0};const target={x:8,y:64,z:8,face:1,hit:[8.5,65,8.5]};
 assert.equal(interaction._canPlaceBlockOnSide(target,held),true,'a redundant falling entity must not block placement above landed sand');
});

if(blocksByName.grass_path)test('path lighting keeps the exposed top bright while blocking direct skylight below',()=>{
 const w=new World(),c=new Chunk(0,0,true);w.chunks.set(World.key(0,0),c);
 for(let x=0;x<16;x++)for(let z=0;z<16;z++)for(let y=60;y<70;y++)c.setSkyLight(x,y,z,15);
 w.setState(8,64,8,state('grass_path'));
 assert.equal(w.getSkyLight(8,64,8),0);assert.equal(c.heightMap[(8<<4)|8],65);
 assert.ok(w.getSkyLight(8,63,8)<15,'direct sunlight must not pass through the path');
 assert.equal(w.getSkyLight(8,65,8),15);
});
