import{Inventory,copy}from'../client/js/game/container.js';
import{formatCode}from'../client/js/gui/format-codes.js';
import{test}from'node:test';import assert from'node:assert/strict';import{readFileSync}from'node:fs';
import{Items}from'../client/js/game/items.js';import{Reader766,Writer766}from'../client/js/net/configuration-1.20.6.js';import{createItemStack766}from'../client/js/net/item-components-1.20.6.js';import{ItemRenderer}from'../client/js/render/item-renderer.js';import{Assets}from'../client/js/assets.js';import{setTranslator,chatComponentString,chatToLegacy}from'../client/js/gui/chat.js';import{initBlocks}from'../client/js/world/blocks.js';import{ZipFile}from'../lib/zip.js';import{ITEM_DATA_766}from'../client/js/game/item-data-1.20.6.js';
const json=p=>JSON.parse(readFileSync(new URL(p,import.meta.url))),jar=new ZipFile(new URL('../cache/port-1.20.6/client.jar',import.meta.url));
const assets={data:{items:json('../client/data/items.json'),creative:json('../client/data/creative.json'),enchantments:json('../client/data/enchantments.json')},lang:JSON.parse(jar.read('assets/minecraft/lang/en_us.json')),translate:Assets.prototype.translate};setTranslator(assets.translate.bind(assets),(k,f)=>assets.lang[k]??f??k);initBlocks(json('../client/data/blocks.json'),null);
const items=new Items(assets),fixtures=json('fixtures/item-ux-1.20.6.json'),decode=f=>new Reader766(Buffer.from(f.wire,'base64')).slot(),plain=s=>s.replace(/§[0-9a-z]/gi,''),sample=name=>decode(fixtures.samples.find(f=>f.label===name));
test('actual item consumers match all native item UX stack fixtures and preserve exact bytes',()=>{
 for(const f of fixtures.samples){const stack=decode(f);for(const[name,value]of Object.entries({damage:items.damage(stack),maxDamage:items.maxDurability(stack),maxStack:items.maxStack(stack),damageable:items.isDamageable(stack),foil:items.hasEffect(stack),duration:items.useDuration(stack),name:plain(items.displayName(stack)),rarity:items.rarity(stack),action:items.useAction(stack)}))assert.equal(value,f[name],f.label+' '+name);
 assert.equal(Buffer.from(new Writer766().slot(stack).build()).toString('base64'),f.wire,f.label+' preserved components');}
});
test('normal and advanced tooltip text matches native Java output for the full UX corpus',()=>{
 for(const f of fixtures.samples){const stack=decode(f);assert.deepEqual(items.tooltip(stack).map(plain),f.tooltip.map(chatComponentString),f.label+' normal');assert.deepEqual(items.tooltip(stack,true).map(plain),f.advancedTooltip.map(chatComponentString),f.label+' advanced');}
});
test('default item actions, use durations and glint agree with all 1330 native registry items',()=>{
 for(const def of assets.data.items){const stack=createItemStack766(def.id),expected=ITEM_DATA_766.items[def.id];assert.equal(items.useAction(stack),expected.action,def.name+' action');assert.equal(items.useDuration(stack),expected.duration,def.name+' duration');assert.equal(items.hasEffect(stack),expected.foil,def.name+' foil');}
});
test('native item colors read effective component values in generated-item layers',()=>{
 const renderer={game:{items},_defaultTint:()=>0xffffff};
 for(const f of fixtures.samples){const stack=decode(f),name=items.name(stack.id);if(!['potion','splash_potion','tipped_arrow','leather_chestplate','firework_star','filled_map'].includes(name))continue;
 for(let layer=0;layer<2;layer++)assert.equal(ItemRenderer.prototype.layerTint.call(renderer,stack,layer),f.colors[layer],f.label+' tint '+layer);}
});
test('durability overlay uses the stack-specific maximum and respects removals/unbreakable',()=>{
 const calls=[],renderer={game:{items}},gui={rect:(...a)=>calls.push(a)};ItemRenderer.prototype.drawOverlay.call(renderer,gui,sample('custom_max_damage'),0,0);assert.equal(calls[1][2],5);
 for(const label of ['unbreakable','removed_damage','removed_max_damage']){calls.length=0;ItemRenderer.prototype.drawOverlay.call(renderer,gui,sample(label),0,0);assert.equal(calls.length,0,label);}
});
test('item use, enchantment lookup, colors and hidden components change behavior without legacy slot NBT',()=>{
 assert.equal(items.damage(sample('damaged')),37);assert.equal(items.enchantLevel(sample('enchanted'),'sharpness'),3);assert.equal(items.enchantLevel(sample('stored_book'),'protection'),0);
 assert.equal(items.useDuration(sample('custom_food')),15);assert.equal(items.isFood(sample('custom_food')),true);assert.equal(items.canAlwaysEat(sample('custom_food')),true);
 assert.equal(items.hasEffect(sample('foil_false')),false);assert.equal(items.hasEffect(sample('foil_true')),true);assert.deepEqual(items.tooltip(sample('hidden_tooltip')),[]);
 assert.equal(items.nbt(sample('named')),null);assert.equal(sample('named').componentPatch.added.some(c=>c.type==='custom_name'),true);
});

// Compare the styles of visible characters; equivalent redundant/reset codes
// need not have identical serialization.
const colors=['000000','0000aa','00aa00','00aaaa','aa0000','aa00aa','ffaa00','aaaaaa','555555','5555ff','55ff55','55ffff','ff5555','ff55ff','ffff55','ffffff'];
function styled(text){
 let color='ffffff',flags=new Set(),font='minecraft:default';const out=[];
 for(let i=0;i<text.length;i++){
  const token=formatCode(text,i);if(token){const c=token.code,at='0123456789abcdef'.indexOf(c);if(token.font)font=token.font;else if(token.color!==undefined){color=token.color.toString(16).padStart(6,'0');flags.clear();}else if(at>=0){color=colors[at];flags.clear();}else if(c==='r'){color='ffffff';flags.clear();font='minecraft:default';}else flags.add(c);i+=token.length-1;continue;}
  out.push([text[i],color,[...flags].sort().join(''),font]);
 }return out;
}
test('tooltip visible colors, rarity, italics and decorations match native component styles',()=>{
 for(const f of fixtures.samples)for(const advanced of [false,true]){
  const actual=items.tooltip(decode(f),advanced).map(styled),expected=(advanced?f.advancedTooltip:f.tooltip).map(c=>styled(chatToLegacy(c,{parsed:true})));
  assert.deepEqual(actual,expected,f.label+(advanced?' advanced':' normal'));
 }
});

test('real inventory clicks honor a server stack-size component rather than the item default',()=>{
 const g={items,gameMode:0,player:{},heldSlot:0},inv=new Inventory(g);g.inventory=inv;
 const custom=sample('custom_stack');custom.count=10;inv.cursor=custom;
 inv.slotClick(36,0,0);assert.equal(inv.held().count,7);assert.equal(inv.cursor.count,3);
 inv.slotClick(37,0,0);assert.equal(inv.main[1].count,3);assert.equal(inv.cursor,null);
 inv.cursor=copy(inv.main[1]);inv.slotClick(36,0,0);assert.equal(inv.held().count,7);assert.equal(inv.cursor.count,3);
});
test('resource-pack item predicates consume custom model, durability and charged-projectile components',()=>{
 const renderer={game:{items,entityId:1,player:{usingItem:false},settings:{mainHand:'right'}}};
 const values=item=>ItemRenderer.prototype._predicates.call(renderer,item);
 assert.equal(values(sample('custom_model')).custom_model_data,123);
 assert.equal(values(sample('custom_max_damage')).damage,0.75);assert.equal(values(sample('removed_damage')).damaged,0);
 const charged=values(sample('charged_rocket'));assert.equal(charged.charged,1);assert.equal(charged.firework,1);
});

test('potion duration templates and infinity remain localizable',()=>{
 const keys=['potion.withAmplifier','potion.withDuration','effect.duration.infinite'],saved=Object.fromEntries(keys.map(k=>[k,assets.lang[k]]));
 try{assets.lang['potion.withAmplifier']='%2$s | %1$s';assets.lang['potion.withDuration']='%2$s <- %1$s';assets.lang['effect.duration.infinite']='forever';assert.equal(plain(items.tooltip(sample('infinite_potion'))[1]),'forever <- II | Speed');}
 finally{Object.assign(assets.lang,saved);}
});
