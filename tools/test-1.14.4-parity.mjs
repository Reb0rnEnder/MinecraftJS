import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {Items} from '../client/js/game/items.js';
import {Interaction} from '../client/js/game/interaction.js';
import {LocalPlayer} from '../client/js/game/physics.js';
import {World} from '../client/js/world/world.js';
import {Chunk} from '../client/js/world/chunk.js';
import {initBlocks,findState,blocksByName,getStateProperties} from '../client/js/world/blocks.js';
import {Reader498,Writer498,decodePacket498} from '../client/js/net/protocol-1.14.4.js';
import {C} from '../client/js/net/packets.js';
import {ItemRenderer} from '../client/js/render/item-renderer.js';
import {TileEntityRenderer} from '../client/js/render/tile-renderer.js';
import {Node} from '../client/js/gfx/scene.js';
import {setJarModels} from '../client/js/render/entity-models.js';
import {setModelDevice} from '../client/js/render/boxmodel.js';
import {loadParticleSprites,particleSprite} from '../client/js/render/particle-sprites.js';
import {Particles} from '../client/js/render/particles.js';
import {TextEditor,textLines} from '../client/js/gui/text-editor.js';
import {Screen} from '../client/js/gui/screens/manager.js';
import {Button} from '../client/js/gui/widgets.js';
import {setPlatform} from '../client/js/platform/platform.js';
import {signTextColor} from '../client/js/game/signs-1.14.4.js';
import {SoundManager,soundTypeOf} from '../client/js/audio/sound.js';
import {VANILLA_UI} from '../client/js/gui/vanilla-layout.js';
import {effectTexture} from '../client/js/gui/effect-icons.js';
import {EntityRenderer} from '../client/js/render/entity-renderer.js';
import {PANDA_VARIANTS} from '../client/js/game/panda-variants-1.14.4.js';
import {EntityManager} from '../client/js/game/entities.js';
import {Game} from '../client/js/game/game.js';
import {nbt} from '../client/js/net/nbt.js';
import {CreativeScreen} from '../client/js/gui/screens/containers.js';
import {TitleScreen} from '../client/js/gui/screens/menus.js';
import {JigsawScreen} from '../client/js/gui/screens/jigsaw.js';
const data=n=>JSON.parse(readFileSync(new URL('../client/data/'+n+'.json',import.meta.url)));
const require=createRequire(import.meta.url),{ZipFile}=require('../lib/zip.js'),jar=new ZipFile(new URL('../cache/port-1.14.4/client.jar',import.meta.url));
initBlocks(data('blocks'),data('blockCollisionShapes'));
const {extractModels,assertCompleteModels}=require('../lib/modelextract.js');setJarModels(assertCompleteModels(extractModels(jar)));
function fixture(){const assets={data:{items:data('items'),creative:data('creative'),enchantments:data('enchantments'),particles:data('particles')},translate:k=>k};
 const items=new Items(assets),sent=[],player=new LocalPlayer(),g={assets,items,player,food:10,gameMode:0,settings:{keys:{}},input:{isDown:k=>k==='use'},inventory:{main:[],offhand:null,held:()=>g.inventory.main[0]||null,getHand:hand=>hand?g.inventory.offhand:g.inventory.held()},send:p=>sent.push(p),cooldownFraction:()=>0,sound:{playAtPlayer(){}},particles:{},screens:{current:null},world:{getState:()=>0},sent};player.creative=false;return g;}
const stack=(g,name,tag)=>({id:g.items.byName.get(name).id,count:1,nbt:null,...(tag?{_renderTag:tag}:{})});

test('native crossbow charge remains active past use duration and release sends the correct native digging action',()=>{
 const g=fixture(),bow=stack(g,'crossbow');g.inventory.main=[bow,stack(g,'arrow')];g.interaction=new Interaction(g);
 for(const k of ['updateEquip','updateTarget','sendClickBlockToController','updateSwing','_tickCooldown'])g.interaction[k]=()=>{};
 assert.equal(g.interaction.sendUseItem(bow),true);assert.equal(g.player.usingItem,true);
 for(let i=0;i<40;i++)g.interaction.tick([]);
 assert.equal(g.player.usingItem,true);assert.equal(g.interaction.useTicks,40);g.interaction.stopUsingItem();
 const r=new Reader498(g.sent.at(-1));assert.equal(r.varint(),0x1a);assert.equal(r.varint(),5);assert.equal(g.player.usingItem,false);
 const quick=stack(g,'crossbow',{Enchantments:[{id:'minecraft:quick_charge',lvl:3}],Charged:1,ChargedProjectiles:[{id:'minecraft:firework_rocket'}]});
 assert.equal(g.items.crossbowChargeDuration(quick),10);g.inventory.main[0]=quick;
 assert.equal(g.interaction.sendUseItem(quick),true);assert.equal(g.player.usingItem,false);
 const pv=ItemRenderer.prototype._predicates.call({game:g},quick);assert.equal(pv.charged,1);assert.equal(pv.firework,1);assert.equal(pv.pulling,0);
 g.inventory.main=[bow];assert.equal(g.interaction.sendUseItem(bow),false,'survival cannot charge without ammunition');
});

test('new foods eat, golden carrots need hunger, chorus fruit remains always edible, and native enchantment clues resolve',()=>{
 const g=fixture(),it=new Interaction(g);
 for(const name of ['sweet_berries','suspicious_stew']){const s=stack(g,name);assert.equal(g.items.isFood(s),true);assert.equal(g.items.useDuration(s),32);assert.equal(it.sendUseItem(s),true);}
 g.food=20;g.player.usingItem=false;assert.equal(it.sendUseItem(stack(g,'golden_carrot')),false);assert.equal(it.sendUseItem(stack(g,'chorus_fruit')),true);
 assert.equal(g.items.enchantmentName(32,1),'enchantment.minecraft.multishot');assert.equal(g.items.enchantmentName(35,1),'enchantment.minecraft.mending');
 for(const i of g.assets.data.items.filter(i=>i.name.endsWith('_spawn_egg')))assert.ok(g.items.eggInfo({id:i.id}),i.name);
 assert.equal(effectTexture(g,31),'mob_effect/bad_omen.png');assert.equal(effectTexture(g,32),'mob_effect/hero_of_the_village.png');
 const lore=g.items.tooltip(stack(g,'stone',{display:{Lore:['{"text":"native lore"}']},CustomModelData:12}));assert.ok(lore.some(s=>s.includes('native lore')&&!s.includes('{')));
 assert.equal(ItemRenderer.prototype._predicates.call({game:g},stack(g,'stone',{CustomModelData:12})).custom_model_data,12);
});

test('forced fitting poses use native 1.5/0.6 dimensions, preserve feet center and stand back up only with clearance',()=>{
 const w=new World();w.chunks.set('0,0',new Chunk(0,0,true));const p=new LocalPlayer();p.setPosition(2.5,1,2.5);
 w.getChunk(0,0).setState(2,0,2,findState('stone'));w.getChunk(0,0).setState(2,2,2,findState('stone_slab',{type:'top',waterlogged:'false'}));
 p.updateSize(w);assert.equal(p.pose,'sneaking');assert.equal(p.height,Math.fround(1.5));assert.equal(p.eyeHeight(),Math.fround(1.27));
 w.getChunk(0,0).setState(2,2,2,0);w.getChunk(0,0).setState(2,1,2,findState('oak_trapdoor',{half:'top',open:'false',facing:'north',powered:'false',waterlogged:'false'}));
 p.updateSize(w);assert.equal(p.pose,'swimming');assert.equal(p.height,Math.fround(.6));assert.equal(p.eyeHeight(),Math.fround(.4));assert.equal(p.swimming,false,'forced crawling does not enable sprint-swimming acceleration');
 assert.deepEqual([p.x,p.y,p.z],[2.5,1,2.5]);w.getChunk(0,0).setState(2,1,2,0);p.updateSize(w);assert.equal(p.pose,'standing');assert.equal(p.height,Math.fround(1.8));
});

test('native sign routing and colors survive partial NBT; campfire food models build without a graphics context',()=>{
 const g=fixture(),text=[],device={createMesh:(_f,data)=>({data}),destroyMesh(){}};g.device=device;setModelDevice(device);g.renderer={entityRoot:new Node()};g.gui={font:{width:s=>s.length*6,layout:(s,x,y,color)=>{text.push({s,color});return {quads:[]};}}};
 const r=new TileEntityRenderer(g);let state=blocksByName.spruce_wall_sign.defaultState;g.world.getState=()=>state;
 r.setTileEntity({x:0,y:0,z:0},9,{Text1:'{"text":"hello"}',Color:'red'});const t=r._get(0,0,0);r._build(t);
 assert.equal(t.type,'sign');assert.equal(t.mat.tex,'entity/signs/spruce.png');assert.ok(text.some(x=>x.s==='hello'&&x.color===signTextColor('red')));
 state=blocksByName.campfire.defaultState;const shown=[];g.itemRenderer={objectFor:(item)=>{shown.push(g.items.nbt(item));return {obj:new Node()};},modelFor:()=>({display:{fixed:{scale:[1,1,1]}}})};
 r.clear();r.setTileEntity({x:0,y:0,z:0},13,{Items:[{id:'minecraft:beef',Count:1,Slot:0,tag:{CustomModelData:9}}]});r._build(r._get(0,0,0));assert.deepEqual(shown,[{CustomModelData:9}]);
});

test('new instruments read synchronized state, and native sound types cover bamboo/scaffolding/crops',()=>{
 const played=[],state=findState('note_block',{instrument:'banjo',note:'12',powered:'false'});
 SoundManager.prototype.onBlockAction.call({game:{world:{getState:()=>state},particles:{}},play:(...a)=>played.push(a)},{blockId:blocksByName.note_block.id,location:{x:1,y:2,z:3},byte1:0,byte2:0});
 assert.equal(played[0][0],'block.note_block.banjo');assert.equal(played[0][5],1);
 for(const [block,event] of [['bamboo','block.bamboo.step'],['scaffolding','block.scaffolding.step'],['wheat','block.crop.break']])assert.ok(soundTypeOf(blocksByName[block]).includes(event),block);
});

test('native edit-book and entity-attached sound packets round-trip all fields including the off hand',()=>{
 const g=fixture(),item=stack(g,'writable_book');const r=new Reader498(C.editBook(item,true,1));assert.equal(r.varint(),12);assert.equal(r.slot().id,item.id);assert.equal(r.bool(),true);assert.equal(r.varint(),1);assert.equal(r.remaining(),0);
 const p=decodePacket498(new Writer498().varint(80).varint(2).varint(6).varint(99).f32(.5).f32(1.25).build());assert.equal(p.entityId,99);assert.equal(p.soundCategory,6);assert.equal(p.pitch,1.25);
 const e=decodePacket498(new Writer498().varint(89).varint(1).u8(31).u8(0).varint(100).u8(5).build());assert.equal(e.name,'entity_effect');assert.equal(e.showIcon,true);assert.equal(e.ambient,true);assert.equal(e.hideParticles,true);
});

test('native particle sprite lists select individual frames and resource packs can replace a sprite set',async()=>{
 const assets={data:{particleSprites:data('particleSprites')},packs:[],readResourceBytes:async location=>jar.read('assets/'+location.replace(':','/')),device:{createTexture:x=>x,destroyTexture(){}}};
 await loadParticleSprites(assets);const first=particleSprite(assets,{sprite:'smoke',age:0,maxAge:8}),last=particleSprite(assets,{sprite:'smoke',age:8,maxAge:8});assert.notDeepEqual(first,last);
 assets.packs=[{list:()=>['particles/smoke.json'],read:()=>new TextEncoder().encode('{"textures":["minecraft:flame"]}')}];await loadParticleSprites(assets);assert.deepEqual(assets.particleSprites.smoke,['minecraft:flame']);
 assert.deepEqual(particleSprite(assets,{sprite:'smoke',age:4,maxAge:8}),assets.particleAtlas.uv('minecraft:flame'));
});

test('book editing supports multiline paste, selection, replacement and cursor movement across Unicode codepoints',()=>{
 let value='abc\ndef',clip='';setPlatform({setClipboard:s=>{clip=s;}});const edit=new TextEditor(()=>value,s=>{value=s;});edit.key({ctrl:true,code:'KeyA'});edit.replace('hello\nworld');assert.equal(value,'hello\nworld');
 edit.move(5);edit.key({shift:true,code:'Home'},textLines(value,{width:s=>s.length*6},114));edit.key({ctrl:true,code:'KeyC'});assert.equal(clip,'hello');edit.replace('first');assert.equal(value,'first\nworld');
 edit.move(value.length);edit.replace('😀');edit.key({code:'ArrowLeft'});assert.equal(edit.cursor,value.length-2);edit.key({code:'Delete'});assert.equal(value,'first\nworld');
});

test('native option arrays exclude VBO; keyboard focus traverses buttons in both directions and activates without a mouse',()=>{
 assert.equal(VANILLA_UI.version,'1.14.4');assert.equal(VANILLA_UI.videoOptions.includes('options.vbo'),false);assert.deepEqual(VANILLA_UI.controlOptions,['options.autoJump']);assert.equal(VANILLA_UI.accessibilityOptions.length,6);
 let pressed=0;const s=new Screen({settings:{narrator:0},sound:{playUi(){}}});s.buttons=[new Button(0,0,0,20,20,'a',()=>{pressed++;}),new Button(1,0,24,20,20,'b',()=>{pressed+=10;})];s.key({code:'Tab'});s.key({code:'Enter'});s.key({code:'Tab',shift:true});s.key({code:'Space'});assert.equal(pressed,11);
});

test('chunk block-entity dispatch retains sign colors, campfire contents and the native jigsaw field spelling',()=>{
 const calls=[],g={tileRenderer:{setTileEntity:(...a)=>calls.push(a)},jigsawBlocks:new Map()};
 const root=(id,fields)=>({t:10,v:{id:nbt.string('minecraft:'+id),x:nbt.int(1),y:nbt.int(64),z:nbt.int(2),...fields}});
 Game.prototype.applyBlockEntity.call(g,root('sign',{Color:nbt.string('blue'),Text1:nbt.string('{"text":"colored"}')}));assert.equal(calls[0][1],9);assert.equal(calls[0][2].Color,'blue');
 Game.prototype.applyBlockEntity.call(g,root('campfire',{Items:nbt.list(10,[{id:nbt.string('minecraft:beef'),Count:nbt.byte(1),Slot:nbt.byte(0)}])}));assert.equal(calls[1][1],13);assert.equal(calls[1][2].Items[0].id,'minecraft:beef');
 Game.prototype.applyBlockEntity.call(g,root('jigsaw',{attachement_type:nbt.string('minecraft:test')}));assert.equal(g.jigsawBlocks.get('1,64,2').attachement_type,'minecraft:test');
 const r=new Reader498(C.updateJigsaw({x:1,y:64,z:2},'minecraft:test','minecraft:empty','minecraft:air'));assert.equal(r.varint(),39);assert.deepEqual(r.position(),{x:1,y:64,z:2});assert.equal(r.string(),'minecraft:test');assert.equal(r.string(),'minecraft:empty');assert.equal(r.string(),'minecraft:air');assert.equal(r.remaining(),0);
 const ui=new JigsawScreen({gui:{width:400,height:300}}, {x:0,y:0,z:0});ui.init();ui.fields[0].setText('INVALID pool');assert.equal(ui.done.enabled,false);ui.fields[0].setText('minecraft:test');assert.equal(ui.done.enabled,true);
});

test('technical editor packets use protocol-498 IDs, native enums and flag bits',()=>{
 const pos={x:-11,y:64,z:17},r=new Reader498(C.updateCommandBlock(pos,'say native','AUTO',true,true,true));assert.equal(r.varint(),36);assert.deepEqual(r.position(),pos);assert.equal(r.string(),'say native');assert.equal(r.varint(),1);assert.equal(r.u8(),7);assert.equal(r.remaining(),0);
 const t={mode:'SAVE',name:'test',posX:-1,posY:0,posZ:1,sizeX:2,sizeY:3,sizeZ:4,mirror:'FRONT_BACK',rotation:'COUNTERCLOCKWISE_90',metadata:'',integrity:.5,seed:-1n,ignoreEntities:true,showAir:false,showBoundingBox:true};
 const s=new Reader498(C.updateStructure(pos,2,t));assert.equal(s.varint(),40);assert.deepEqual(s.position(),pos);assert.equal(s.varint(),1);assert.equal(s.varint(),0);assert.equal(s.string(),'test');assert.deepEqual(Array.from({length:6},()=>s.i8()),[-1,0,1,2,3,4]);assert.equal(s.varint(),2);assert.equal(s.varint(),3);assert.equal(s.string(),'');assert.equal(s.f32(),.5);assert.equal(s.varlong(),-1n);assert.equal(s.u8(),5);assert.equal(s.remaining(),0);
});

 test('remote pose metadata changes player bounds and crawl animation independently of sprint-swimming flags',()=>{
 const manager=new EntityManager({}),e={kind:'player',entityName:'player',metadata:{},width:.6,height:1.8};
 manager._applyMeta(e,{6:3,0:0});assert.equal(e.height,Math.fround(.6));assert.equal(e.visuallySwimming,true);assert.equal(e.swimming,false);assert.equal(e.eyeHeight,.4);
 Object.assign(e,{x:0,z:0,prevX:0,prevZ:0,bodyYaw:0,yaw:0});manager._livingUpdate(e);assert.equal(e.swimAmount,.09);
 manager._applyMeta(e,{6:5});assert.equal(e.height,Math.fround(1.5));assert.equal(e.eyeHeight,1.27);manager._livingUpdate(e);assert.equal(e.swimAmount,0);
 manager._applyMeta(e,{6:0});assert.equal(e.height,Math.fround(1.8));assert.equal(e.eyeHeight,1.62);
 });

test('panda skin selection follows native dominant/recessive genes and all selected skins exist',()=>{
 assert.equal(PANDA_VARIANTS.length,7);const skins=new Set();
 for(let main=0;main<7;main++)for(let hidden=0;hidden<7;hidden++){const path=EntityRenderer.prototype._texFor.call({}, {type:'panda',pandaGene:main,pandaHiddenGene:hidden});assert.ok(jar.read('assets/minecraft/textures/'+path),path);skins.add(path);}
 assert.equal(skins.size,7);const tex=(main,hidden)=>EntityRenderer.prototype._texFor.call({}, {type:'panda',pandaGene:main,pandaHiddenGene:hidden});
 assert.equal(tex(4,0),'entity/panda/panda.png');assert.equal(tex(4,4),'entity/panda/brown_panda.png');assert.equal(tex(5,5),'entity/panda/weak_panda.png');assert.equal(tex(1,4),'entity/panda/lazy_panda.png');
});

test('creative Search contains native all-item variants, filters names/tags and repopulates after clearing',()=>{
 const g=fixture();g.gui={width:640,height:480};g.effects=new Map();g.tags={forEntry:(_,id)=>id===g.items.byName.get('sand').id?['minecraft:sand']:[]};
 const screen=new CreativeScreen(g);screen.init();screen.setTab(5);assert.equal(screen.list.length,1127);assert.ok(screen.list.some(it=>g.items.name(it.id)==='crossbow'));assert.ok(screen.list.some(it=>g.items.name(it.id)==='enchanted_book'&&g.items.enchantments(it).some(e=>e.id==='minecraft:multishot')));
 screen.search.setText('crossbow');assert.ok(screen.list.length);assert.ok(screen.list.every(it=>g.items.name(it.id)==='crossbow'));
 screen.search.setText('#minecraft:sand');assert.ok(screen.list.length);assert.ok(screen.list.every(it=>g.items.name(it.id)==='sand'));
 screen.search.setText('');assert.equal(screen.list.length,1127);screen.setTab(0);screen.setTab(5);assert.equal(screen.list.length,1127);
});

test('accessibility button draws full native 20-pixel sheet rows at the actual button position',()=>{
 const screen=new TitleScreen({gui:{width:640,height:480},assets:{splashes:[]}});screen.init();const b=screen.buttons.find(b=>b.id===6),calls=[],gui={blit:(...a)=>calls.push(a)};
 b.render(gui,-1,-1);b.render(gui,b.x+1,b.y+1);b.focused=true;b.render(gui,-1,-1);
 assert.deepEqual(calls,[["gui/accessibility.png",b.x,b.y,0,0,20,20,32,64],["gui/accessibility.png",b.x,b.y,0,20,20,20,32,64],["gui/accessibility.png",b.x,b.y,0,20,20,20,32,64]]);
});

test('native brand, anvil and beacon packets use resource locations and dedicated packet layouts',()=>{
 const brand=new Reader498(C.customPayload('minecraft:brand',new Writer498().string('vanilla').build()));assert.equal(brand.varint(),11);assert.equal(brand.string(),'minecraft:brand');assert.equal(brand.string(),'vanilla');assert.equal(brand.remaining(),0);assert.throws(()=>C.customPayload('MC|Brand',new Uint8Array()),/Invalid custom payload/);
 assert.equal(Buffer.from(C.nameItem('Test')).toString('hex'),'1e0454657374');assert.equal(Buffer.from(C.setBeaconEffects(1,10)).toString('hex'),'22010a');assert.equal(Buffer.from(C.selectTrade(130)).toString('hex'),'218201');
 const s=new Reader498(C.settings('en_us',12,2,false,85,0));assert.equal(s.varint(),5);assert.equal(s.string(),'en_us');assert.equal(s.i8(),12);assert.equal(s.varint(),2);assert.equal(s.bool(),false);assert.equal(s.u8(),85);assert.equal(s.varint(),0);assert.equal(s.remaining(),0);
});
