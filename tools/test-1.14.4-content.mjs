import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {C,decodePacket} from '../client/js/net/packets.js';
import {Writer498,Reader498} from '../client/js/net/protocol-1.14.4.js';
import {Game} from '../client/js/game/game.js';
import {Inventory,ContainerWindow} from '../client/js/game/container.js';
import {openContainerScreen} from '../client/js/gui/screens/containers.js';
import {stonecutterRecipes,tradeCost,LOOM_PATTERNS} from '../client/js/game/workstations-1.14.4.js';
import {scaffoldingCollision} from '../client/js/world/scaffolding.js';
import {initBlocks,findState} from '../client/js/world/blocks.js';
import {World} from '../client/js/world/world.js';
import {LocalPlayer} from '../client/js/game/physics.js';
import {TileEntityRenderer} from '../client/js/render/tile-renderer.js';
import {setModelDevice} from '../client/js/render/boxmodel.js';
const data=n=>JSON.parse(readFileSync(new URL('../client/data/'+n+'.json',import.meta.url)));
initBlocks(data('blocks'),data('blockCollisionShapes'));
function fixture(){
 const sent=[],defs=data('items'),byId=new Map(defs.map(d=>[d.id,d]));
 const g={send:b=>sent.push(b),player:{creative:false},gameMode:0,gui:{width:480,height:320},settings:{},assets:{itemsByName:new Map(defs.map(d=>[d.name,d])),translate:k=>k,textures:new Map()},
 items:{def:id=>byId.get(id),name:id=>byId.get(id)?.name,nbt:i=>i?._tag||{},isBlockItem:id=>!!data('blocks').find(b=>b.name===byId.get(id)?.name),maxStack:()=>64,maps:new Map()},screens:{open(s){this.current=s;s.init();}},sound:{playUi(){}},input:{lock(){}},sent};
 g.inventory=new Inventory(g);return g;
}
const stack=(g,name,count=1)=>({id:g.assets.itemsByName.get(name).id,count,nbt:null});
test('native menu routing preserves furnace variants and opens every added workstation with native slots',()=>{
 for(const [id,type,slots] of [[9,'blast_furnace',3],[20,'smoker',3],[14,'grindstone',3],[16,'lectern',1],[17,'loom',4],[18,'villager',3],[21,'cartography',3],[22,'stonecutter',2]]){
  const g=fixture();Game.prototype.on_open_window.call(g,{windowId:4,inventoryType:id,windowTitle:'{"text":"Workstation"}'});
  assert.equal(g.window.type,'minecraft:'+type);assert.equal(g.window.size,slots);assert.ok(g.screens.current.isContainer);
  if(type!=='lectern')assert.equal(g.screens.current.slotPos.length,slots+36);
  if(['blast_furnace','smoker'].includes(type))assert.equal(g.screens.current.tex,'gui/container/'+type+'.png');
 }
});
test('trade-list codec consumes native optional costs, demand, discounts and villager state',()=>{
 const g=fixture(),a=stack(g,'emerald',3),out=stack(g,'bread',6),b=stack(g,'wheat',2);
 const w=new Writer498().varint(0x27).varint(7).u8(2);
 for(const extra of [b,null]){w.slot(a).slot(out).bool(!!extra);if(extra)w.slot(extra);w.bool(false).i32(2).i32(12).i32(5).i32(-1).f32(.2).i32(4);}
 w.varint(2).varint(11).bool(true).bool(true);
 const p=decodePacket(w.build());assert.equal(p.trades.length,2);assert.deepEqual(p.trades[0].b,{...b,damage:0,nbtRaw:null});assert.equal(p.trades[1].b,null);assert.equal(p.experience,11);assert.equal(p.canRestock,true);
 assert.equal(tradeCost(p.trades[0]).count,4);
 for(const [bytes,id,values] of [[C.selectTrade(9),0x21,[9]],[C.menuButton(7,100),8,[7,100]]]){const r=new Reader498(bytes);assert.equal(r.varint(),id);for(const v of values)assert.equal(id===8?r.u8():r.varint(),v);assert.equal(r.remaining(),0);}
});
test('stonecutter recipes follow native result description order and selection sends menu button, not slot click',()=>{
 const g=fixture(),input=stack(g,'stone');g.serverRecipes=['stone_bricks','stone_slab','chiseled_stone_bricks'].map(name=>({type:'minecraft:stonecutting',data:{ingredient:[input],result:stack(g,name)}}));
 assert.deepEqual(stonecutterRecipes(g,input).map(r=>g.items.name(r.data.result.id)),['chiseled_stone_bricks','stone_bricks','stone_slab']);
 const win=new ContainerWindow(g,5,'minecraft:stonecutter','Stonecutter',2);win.setSlot(0,input);openContainerScreen(g,win);
 const s=g.screens.current;s.extraMouseDown(s.guiLeft+70,s.guiTop+16,0);
 assert.deepEqual(g.sent[0],C.menuButton(5,1));
});
test('loom has native ordinal patterns, restricted inputs, template patterns and scrolling',()=>{
 const g=fixture(),win=new ContainerWindow(g,6,'minecraft:loom','Loom',4);
 win.setSlot(0,stack(g,'white_banner'));win.setSlot(1,stack(g,'red_dye'));openContainerScreen(g,win);const s=g.screens.current;
 assert.equal(s.patterns().length,34);assert.equal(LOOM_PATTERNS[35],'glb');assert.equal(win.isValid(1,stack(g,'stone')),false);assert.equal(win.isValid(3,stack(g,'white_banner')),false);
 s.wheel(1);assert.equal(s.row,1);s.extraMouseDown(s.guiLeft+61,s.guiTop+14,0);assert.deepEqual(g.sent[0],C.menuButton(6,5));
 win.setSlot(2,stack(g,'flower_banner_pattern'));assert.deepEqual(s.patterns(),[38]);
});
test('native result clicks consume inputs, take the full result on right click and accept authoritative corrections',()=>{
 const g=fixture(),win=new ContainerWindow(g,4,'minecraft:grindstone','Grindstone',3),sword=stack(g,'iron_sword');
 assert.equal(win.isValid(0,sword),true);assert.equal(win.isValid(0,stack(g,'stone')),false);
 win.setSlot(0,sword);win.setSlot(2,sword);win.click(2,0,0);
 assert.equal(win.get(0),null);assert.equal(win.get(2),null);assert.equal(g.inventory.cursor.id,sword.id);assert.equal(g.sent.length,1);
 win.setSlot(0,sword);assert.equal(win.get(0),sword,'server corrections replace predicted inputs');
 const stone=new ContainerWindow(g,5,'minecraft:stonecutter','Stonecutter',2);g.inventory.cursor=null;
 const input=stack(g,'stone',3),out=stack(g,'stone_slab',2);g.serverRecipes=[{type:'minecraft:stonecutting',data:{ingredient:[input],result:out}}];
 stone.properties[0]=0;stone.setSlot(0,input);stone.setSlot(1,copyStack(out));stone.click(1,1,0);
 assert.equal(g.inventory.cursor.count,2);assert.equal(stone.get(0).count,2);assert.equal(stone.get(1).count,2);
});
const copyStack=it=>({...it});
test('native merchant predicts consumed prices, repeated shift trades, offer uses and XP without waiting for an accepted-click echo',()=>{
 const g=fixture(),win=new ContainerWindow(g,8,'minecraft:villager','Farmer',3);
 const a=stack(g,'emerald',1),out=stack(g,'bread',6),trade={a,out,b:null,uses:0,max:12,xp:2,specialPrice:0,priceMultiplier:0,demand:0};
 win.tradeData={trades:[trade],experience:0};win.setSlot(0,{...a,count:3});win.setSlot(2,copyStack(out));
 win.click(2,1,0);assert.equal(g.inventory.cursor.count,6);assert.equal(win.get(0).count,2);assert.equal(trade.uses,1);assert.equal(win.tradeData.experience,2);
 g.inventory.cursor=null;win.click(2,0,1);assert.equal(win.get(0),null);assert.equal(win.get(2),null);assert.equal(trade.uses,3);assert.equal(win.tradeData.experience,6);
 assert.equal(g.inventory.main.filter(Boolean).reduce((n,it)=>n+it.count,0),12);
});
test('scaffolding collisions depend on feet height, sneaking and bottom state, not static full-block collision',()=>{
 const props={distance:'0',bottom:'false'},m=(y,sneaking=false)=>({sneaking,bb:()=>[.2,y,.2,.8,y+1.8,.8]});
 assert.equal(scaffoldingCollision(props,4,m(5)).length,5);assert.deepEqual(scaffoldingCollision(props,4,m(4.2)),[]);assert.deepEqual(scaffoldingCollision(props,4,m(5,true)),[]);
 assert.deepEqual(scaffoldingCollision({distance:'1',bottom:'true'},4,m(4.2,true)),[[0,0,0,1,.125,1]]);
 const world=new World(),state=findState('scaffolding',props);world.getState=()=>state;
 const out=[];world.collisionBoxes(0,4,0,out,state,m(4.2));assert.equal(out.length,0);
 const pl=new LocalPlayer();pl.setPosition(.5,4.2,.5);assert.ok(pl.isOnLadder(world));
});
test('bell block events reset the native ringing timer, native model and expiry survive build/rebuild',()=>{
 const g=fixture(),state=findState('bell',{attachment:'floor',facing:'north'}),device={createMesh:(_f,data)=>({cpu:data}),destroyMesh(){}};
 g.world={getState:()=>state,worldAge:0};g.renderer={entityRoot:{add(){}}};g.device=device;setModelDevice(device);
 const r=new TileEntityRenderer(g);r.onBlockAction({blockId:669,location:{x:0,y:4,z:0},byte1:1,byte2:2});const t=r.tiles.get('0,4,0');
 assert.equal(t.bellShaking,true);r._build(t);assert.equal(t.bellPart.children.length,1);assert.equal(t.bellPart.texW,32);assert.deepEqual(t.bellPart.boxes[0],{x:-3,y:-6,z:-3,dx:6,dy:7,dz:6,inflate:0,mirror:false,u:0,v:0});
 for(let i=0;i<50;i++)r.tick();assert.equal(t.bellShaking,false);r.onBlockAction({blockId:669,location:{x:0,y:4,z:0},byte1:1,byte2:5});assert.equal(t.bellTime,0);assert.equal(t.bellDirection,5);
});
test('native map codec keeps lock state and validates update rectangles for cartography previews',()=>{
 const empty=new Writer498().varint(0x26).varint(9).i8(2).bool(true).bool(true).varint(0).u8(0);
 const map=decodePacket(empty.build());assert.equal(map.locked,true);assert.equal(map.itemDamage,9);assert.equal(map.columns,0);
 const full=new Writer498().varint(0x26).varint(9).i8(2).bool(true).bool(false).varint(0).u8(2).u8(1).u8(3).u8(4).varint(2).raw(new Uint8Array([1,2]));
 assert.deepEqual([...decodePacket(full.build()).data],[1,2]);
 const bad=new Writer498().varint(0x26).varint(9).i8(2).bool(true).bool(false).varint(0).u8(2).u8(1).u8(127).u8(4).varint(2).raw(new Uint8Array([1,2]));
 assert.throws(()=>decodePacket(bad.build()),/Invalid map rectangle/);
});
test('scaffolding tower supports ascending with jump, descending with sneak and standing on its top',async()=>{
 const {Chunk}=await import('../client/js/world/chunk.js'),w=new World();
 for(let x=-1;x<=1;x++)for(let z=-1;z<=1;z++)w.chunks.set(x+','+z,new Chunk(x,z,true));
 const c=w.getChunk(0,0);c.setState(0,0,0,findState('stone'));
 for(let y=1;y<=6;y++)c.setState(0,y,0,findState('scaffolding',{distance:'0',bottom:'false',waterlogged:'false'}));
 const pl=new LocalPlayer();pl.setPosition(.5,1,.5);for(let i=0;i<30;i++)pl.tick(w,{jump:true});assert.ok(pl.y>4,'jump climbs through internal platforms');
 const up=pl.y;for(let i=0;i<20;i++)pl.tick(w,{sneak:true});assert.ok(pl.y<up-2,'sneak descends instead of freezing ladder velocity');
 pl.setPosition(.5,7,.5);pl.motionY=0;for(let i=0;i<10;i++)pl.tick(w,{});assert.equal(pl.y,7);assert.equal(pl.onGround,true);
});
