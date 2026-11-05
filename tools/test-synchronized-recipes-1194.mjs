// Native protocol-762 fixtures; pre-1.16 combined recipe settings do not apply.
import{test}from'node:test';import assert from'node:assert/strict';import{PROTOCOL_VERSION,decodePacket,C}from'../client/js/net/packets.js';import{Writer762 as Writer,Reader762 as Reader}from'../client/js/net/protocol-1.19.4.js';import{CLIENTBOUND_762 as IN,SERVERBOUND_762 as OUT}from'../client/js/net/protocol-1.19.4-ids.js';import{nbt,writeNbtRoot}from'../client/js/net/nbt.js';import{Game}from'../client/js/game/game.js';import{RecipeBook}from'../client/js/game/recipebook.js';import{RecipeBookGui}from'../client/js/gui/recipebook.js';import{craftResult}from'../client/js/game/crafting.js';import{NbtQueries,copyInspect,snbt}from'../client/js/game/nbt-queries.js';import{setPlatform}from'../client/js/platform/platform.js';import{serverCraftResult}from'../client/js/game/server-recipes.js';
const recipeId=IN.declare_recipes,nbtId=IN.nbt_query_response;
const stack=id=>({id,count:1,damage:0}),name=nbt.compound({display:nbt.compound({Name:nbt.string('{"text":"Custom output"}')})});
function fixture(){
 const sent=[],g={settings:{},enabledFeatures:new Set(['minecraft:vanilla']),conn:{},screens:{current:null},assets:{data:{creative:{tabs:[]}},itemsByName:new Map(),recipes:[]},items:{isFood:()=>false,isBlockItem:()=>false},inventory:{main:[stack(1),stack(2),stack(3)]},hud:{addRecipeToast(){}},send:b=>sent.push(b)};g.recipeBook=new RecipeBook(g);g.nbtQueries=new NbtQueries(g);return{g,sent};
}
function wire(){const w=new Writer().varint(recipeId).varint(3),header=(type,id)=>{if(PROTOCOL_VERSION===404)w.string(id).string(type);else w.string('minecraft:'+type).string(id);},ingredient=ids=>{w.varint(ids.length);for(const id of ids)w.slot(stack(id));};
 header('crafting_shapeless','custom:overlap');w.string('custom').varint(0).varint(3);ingredient([1,2]);ingredient([1,3]);ingredient([1,3]);w.slot({...stack(4),nbt:name});
 header('crafting_shaped','custom:shaped');w.varint(2).varint(1).string('').varint(0);ingredient([1]);ingredient([2]);w.slot(stack(5)).bool(true);
 header('smelting','custom:cook');w.string('').varint(0);ingredient([1]);w.slot(stack(6)).f32(.7).varint(100);return w.build();}
test('native wire recipes replace the book/crafting catalog, preserve output NBT and support overlapping alternatives',()=>{
 const {g}=fixture(),packet=decodePacket(wire());assert.equal(packet.name,'declare_recipes');assert.equal(packet.recipes.length,3);Game.prototype.on_declare_recipes.call(g,packet);g.recipeBook.onPacket({action:0,craftingBookOpen:true,filteringCraftable:false,recipes:['custom:overlap','custom:shaped','custom:cook'],recipesToHighlight:[]});
 const recipe=g.recipeBook.recipe('custom:overlap');assert.equal(recipe.result.id,4);assert.equal(recipe.result.nbt.v.display.v.Name.v,'{"text":"Custom output"}');assert.equal(g.recipeBook.canCraft(recipe,g.recipeBook.stackedContents([])),true);
 const result=craftResult([stack(1),stack(2),stack(3),null],2,g.items);assert.equal(result.id,4);result.nbt.v.display.v.Name.v='changed';assert.equal(recipe.result.nbt.v.display.v.Name.v,'{"text":"Custom output"}');
 const shifted=serverCraftResult([null,null,null,null,stack(2),stack(1),null,null,null],3,g.items.serverRecipes.filter(r=>r.shaped));assert.equal(shifted.id,5);
 const craftLists=RecipeBookGui.prototype.contextLists.call({book:g.recipeBook,opts:{}},'search');assert.equal(craftLists.flatMap(l=>l.recipes).some(r=>r.id==='custom:cook'),false);
 const cookLists=RecipeBookGui.prototype.contextLists.call({book:g.recipeBook,opts:{kind:'smelting'}},'search');assert.deepEqual(cookLists.flatMap(l=>l.recipes).map(r=>r.id),['custom:cook']);
 Game.prototype.on_declare_recipes.call(g,{recipes:[]});assert.equal(g.recipeBook.recipe('custom:overlap'),null);assert.equal(craftResult([stack(1),null,null,null],2,g.items),null);
});
test('recipe init clears stale unlocks and cooking settings remain independent',()=>{const {g}=fixture();g.recipeBook.known.add('old');g.recipeBook.fresh.add('old');g.recipeBook.onPacket({action:0,craftingBookOpen:false,filteringCraftable:false,smeltingBookOpen:true,filteringSmeltable:true,recipes:[],recipesToHighlight:[]});assert.equal(g.recipeBook.known.size,0);assert.equal(g.recipeBook.fresh.size,0);assert.equal(g.recipeBook.stateFor('smelting').open,true);assert.equal(g.recipeBook.open,false);const r=new Reader(C.recipeBookSettings(1,true,true));assert.equal(r.varint(),OUT.recipe_book);assert.equal(r.varint(),1);assert.equal(r.bool(),true);assert.equal(r.bool(),true);assert.equal(r.remaining(),0);});
test('NBT query response dispatch consumes matching replies once and rejects stale connections/transactions',()=>{const {g,sent}=fixture();let result='unset';const id=g.nbtQueries.entity(12,value=>result=value),r=new Reader(sent[0]);assert.equal(r.varint(),OUT.query_entity_nbt);assert.equal(r.varint(),id);assert.equal(r.varint(),12);const writer=new Writer().varint(nbtId).varint(id);writeNbtRoot(writer,name);const packet=decodePacket(writer.build());assert.equal(packet.name,'nbt_query_response');Game.prototype.on_nbt_query_response.call(g,packet);assert.deepEqual(result.v,name.v);result='unset';Game.prototype.on_nbt_query_response.call(g,packet);assert.equal(result,'unset');g.nbtQueries.entity(1,value=>result=value);g.conn={};Game.prototype.on_nbt_query_response.call(g,{...packet,transactionId:id+1});assert.equal(result,'unset');});
test('typed SNBT keeps integer widths, UUID longs, arrays and escaped strings',()=>{const value=nbt.compound({x:nbt.int(1),Text:nbt.string('a"b'),Big:{t:4,v:1234567890123456789n}});assert.equal(snbt(value),'{x:1,Text:"a\\"b",Big:1234567890123456789L}');});

test('F3+I uses server NBT only with permission, strips identity fields and keeps custom data',()=>{
 const{g,sent}=fixture(),copied=[];setPlatform({setClipboard:text=>copied.push(text)});Object.assign(g,{settings:{},permissionLevel:2,debugFeedback(){},interaction:{target:{type:'entity',entity:{id:9,entityName:'fox',x:1.25,y:64,z:-2}}}});
 assert.equal(Game.prototype._debugCombo.call(g,{code:'KeyI',shift:false}),true);assert.equal(sent.length,1);const id=g.nbtQueries.pending.id;Game.prototype.on_nbt_query_response.call(g,{transactionId:id,nbt:nbt.compound({UUID:nbt.string('remove'),Dimension:nbt.int(1),CustomName:nbt.string('Named fox')})});assert.equal(copied.pop(),'/summon minecraft:fox 1.25 64.00 -2.00 {CustomName:"Named fox"}');
 g.permissionLevel=0;Game.prototype._debugCombo.call(g,{code:'KeyI',shift:false});assert.equal(sent.length,1);assert.equal(copied.pop(),'/summon minecraft:fox 1.25 64.00 -2.00');
 g.permissionLevel=2;Game.prototype._debugCombo.call(g,{code:'KeyI',shift:true});assert.equal(sent.length,1);
});

test('native recipe categories survive the wire adapter and override output creative classification',()=>{
 const {g}=fixture();const recs=[0,1,2,3].map(category=>({type:'minecraft:crafting_shapeless',recipeId:'custom:category_'+category,data:{category,ingredients:[[{id:1,count:1,damage:0}]],result:stack(4)}}));
 Game.prototype.on_declare_recipes.call(g,{recipes:recs});
 for(const [index,tab] of ['buildingBlocks','redstone','tools','misc'].entries()){const rec=g.recipeBook.recipe('custom:category_'+index);assert.equal(rec.category,index);assert.equal(g.recipeBook.categoryOf(rec),tab);}
 for(const [category,tab]of [[0,'food'],[1,'buildingBlocks'],[2,'misc']])assert.equal(g.recipeBook.categoryOf({type:'minecraft:smelting',category,result:stack(4)}),tab);
 assert.equal(g.recipeBook.categoryOf({type:'minecraft:blasting',category:0,result:stack(4)}),'misc');
 assert.equal(g.recipeBook.categoryOf({type:'minecraft:smoking',category:2,result:stack(4)}),'food');
});
