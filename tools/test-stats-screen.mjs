// Statistics regressions for the 1.13+ protocol: registry decoding, native formatters, list contents and
// the version's native screen layout. Fixtures are this branch's native registries and stat item data.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {setPlatform} from '../client/js/platform/platform.js';
import {setTranslator} from '../client/js/gui/i18n.js';
import {STAT_REGISTRY_VERSION,STAT_TYPES,CUSTOM_STATS} from '../client/js/game/stat-registry.js';
import {StatsCounter,formatStat,customStatFormat,statItems,blockAsItem,itemBlock} from '../client/js/game/stats-counter.js';
import {StatsScreen} from '../client/js/gui/screens/stats.js';
setPlatform({now:()=>0,loadSetting:()=>null,saveSetting(){}});
setTranslator((k,a)=>a?.length?k+'('+a.join(',')+')':k);
const json=n=>JSON.parse(readFileSync(new URL('../client/data/'+n+'.json',import.meta.url),'utf8'));
const data={items:json('items'),blocks:json('blocks'),entities:json('entities')};
const minor=Number(STAT_REGISTRY_VERSION.split('.')[1]),MODERN=STAT_REGISTRY_VERSION==='1.20.6'||minor>=21;
const id=(list,name)=>{const e=data[list].find(x=>x.name===name&&x.type!=='object');assert.ok(e,name);return e.internalId??e.id;};
const type=n=>STAT_TYPES.indexOf(n);
function entries(){
  const play=CUSTOM_STATS.includes('play_time')?'play_time':'play_one_minute';
  return [
    {categoryId:type('custom'),statisticId:CUSTOM_STATS.indexOf(play),value:72000},
    {categoryId:type('custom'),statisticId:CUSTOM_STATS.indexOf('walk_one_cm'),value:123456},
    {categoryId:type('custom'),statisticId:CUSTOM_STATS.indexOf('damage_dealt'),value:1245},
    {categoryId:type('mined'),statisticId:id('blocks','stone'),value:17},
    {categoryId:type('mined'),statisticId:id('blocks','wall_torch'),value:4},
    {categoryId:type('picked_up'),statisticId:id('items','torch'),value:9},
    {categoryId:type('crafted'),statisticId:id('items','stick'),value:8},
    {categoryId:type('used'),statisticId:id('items','diamond_pickaxe'),value:300},
    {categoryId:type('killed'),statisticId:id('entities','zombie'),value:3},
    {categoryId:type('killed_by'),statisticId:id('entities','creeper'),value:1},
    {categoryId:99,statisticId:0,value:5},{categoryId:type('item'),statisticId:999999,value:5},
  ];
}
function game(width=427,height=240){
  const texts=[],sprites=[],sent=[];
  const gui={width,height,textWidth:s=>String(s).replace(/§./g,'').length*6,text:(...t)=>texts.push(t),textCentered:(...t)=>texts.push(t),rect(){},quad(){},gradient(){},scissor(){},clearScissor(){},menuBackground(){},dirtBackground(){},sprite:(...s)=>sprites.push(s),blit:(...s)=>sprites.push(s),button(){},tooltip(){},tex:()=>null,setBlend(){},resetColor(){}};
  const g={gui,inWorld:false,assets:{data,texture:()=>null},items:{displayName:i=>'item'+i.id},itemRenderer:{drawItem(){}},sound:{playUi(){}},screens:{open(s){this.current=s;}},send:p=>sent.push(p),settings:{}};
  g.on_statistics=p=>{g.statsCounter||=new StatsCounter(data);g.statsCounter.apply(p.entries);g.screens.current?.onStats?.(g.statsCounter);};
  return {g,texts,sprites,sent};
}

test(STAT_REGISTRY_VERSION+': registry ids resolve through the native stat type, block, item, entity and custom registries',()=>{
  assert.deepEqual(STAT_TYPES,['mined','crafted','used','broken','picked_up','dropped','killed','killed_by','custom']);
  const c=new StatsCounter(data);c.apply(entries());
  assert.equal(c.get('mined','stone'),17);assert.equal(c.get('picked_up','torch'),9);assert.equal(c.get('killed','zombie'),3);assert.equal(c.get('killed_by','creeper'),1);
  assert.equal(c.get('custom','walk_one_cm'),123456);assert.equal(c.values.size,10,'unknown categories and ids are ignored');
  c.apply([{categoryId:type('mined'),statisticId:id('blocks','stone'),value:2}]);assert.equal(c.get('mined','stone'),2,'values replace earlier ones');
});
test(STAT_REGISTRY_VERSION+': native StatFormatter output (verified against java.text formatters)',()=>{
  assert.equal(customStatFormat(CUSTOM_STATS.includes('play_time')?'play_time':'play_one_minute'),'time');
  assert.equal(customStatFormat('walk_one_cm'),'distance');assert.equal(customStatFormat('damage_dealt'),'tenth');assert.equal(customStatFormat('jump'),'default');
  assert.equal(formatStat('time',72000),'1.00 h');assert.equal(formatStat('time',599),'29.95 s');assert.equal(formatStat('time',601),'0.50 m');assert.equal(formatStat('distance',123456),'1.23 km');
  assert.equal(formatStat('tenth',1245),'124.50');assert.equal(formatStat('tenth',1255),'125.50');assert.equal(formatStat('distance',1250),'12.50 m');
  assert.equal(formatStat('default',1234567),'1,234,567');assert.equal(formatStat('distance',45),'45 cm');
});
test(STAT_REGISTRY_VERSION+': item list uses native Block.asItem and BlockItem.getBlock pairs',()=>{
  const items=new Set(data.items.map(i=>i.name)),blocks=new Set(data.blocks.map(b=>b.name));
  assert.equal(blockAsItem('wall_torch',items),'torch');assert.equal(blockAsItem('water',items),null);assert.equal(blockAsItem('stone',items),'stone');
  assert.equal(itemBlock('wheat_seeds',blocks),'wheat');assert.equal(itemBlock('wheat',blocks),null);assert.equal(itemBlock('stick',blocks),null);assert.equal(itemBlock('redstone',blocks),'redstone_wire');
  const c=new StatsCounter(data);c.apply(entries());
  assert.deepEqual(statItems(c,data).map(i=>i.name).sort(),['diamond_pickaxe','stick','stone','torch']);
});
test(STAT_REGISTRY_VERSION+': the screen requests stats once, builds three lists and native footer geometry',()=>{
  for(const [w,h] of [[320,240],[427,240],[640,360]]){
    const {g,sent}=game(w,h),s=new StatsScreen(g,null);g.screens.open(s);s.init();s.render(g.gui,-1,-1);
    assert.equal(sent.length,1);assert.equal(s.pausesGame,false,'does not pause while downloading');
    g.on_statistics({entries:entries()});assert.equal(s.pausesGame,true);s.onResize?.();
    const box=b=>[b.x,b.y,b.w,b.h],cx=Math.floor(w/2);
    if(MODERN){
      const fx=Math.max(0,Math.floor((w-370)/2));
      assert.deepEqual(s.buttons.map(box),[[fx,h-51,120,20],[fx+125,h-51,120,20],[fx+250,h-51,120,20],[fx+85,h-26,200,20]]);
      assert.equal(s.lists.general.top,33);assert.equal(s.lists.general.bottom,h-58);assert.equal(s.lists.items.listWidth,280);
      assert.equal(s.lists.general.scrollBarX(),cx-140+280+10);
    }else{
      assert.deepEqual(s.buttons.map(box),[[cx-120,h-52,80,20],[cx-40,h-52,80,20],[cx+40,h-52,80,20],[cx-100,h-28,200,20]]);
      assert.equal(s.lists.general.top,32);assert.equal(s.lists.general.bottom,h-64);assert.equal(s.lists.items.listWidth,375);
      assert.equal(s.lists.items.scrollBarX(),cx+140);
    }
    assert.deepEqual(s.buttons.map(b=>b.enabled),[true,true,true,true]);
    for(const mode of ['general','items','mobs']){s.mode=mode;s.render(g.gui,-1,-1);}
  }
});
test(STAT_REGISTRY_VERSION+': lists match native order, columns, sorting and mob rows',()=>{
  const {g,texts,sprites}=game(),s=new StatsScreen(g,null);g.screens.open(s);s.init();g.on_statistics({entries:entries()});
  const general=s.lists.general.stats,keys=general.map(n=>'stat.minecraft.'+n);
  if(MODERN||minor>=16)assert.deepEqual(keys,[...keys].sort(),'sorted by translated name');else assert.deepEqual(general,CUSTOM_STATS,'registration order');
  const items=s.lists.items;assert.equal(items.value(items.rows.find(i=>i.name==='stick'),'mined'),null);
  assert.equal(items.value(items.rows.find(i=>i.name==='torch'),'mined'),0,'a torch row shows the torch block, not wall_torch');
  items.headerClicked(MODERN?75+40*3-5:115+40*3-5);assert.equal(items.sortColumn,'used');assert.equal(items.rows[0].name,'diamond_pickaxe');
  items.headerClicked(MODERN?75+40*3-5:115+40*3-5);assert.equal(items.sortOrder,1);assert.equal(items.rows.at(-1).name,'diamond_pickaxe');
  items.headerClicked(MODERN?75+40*3-5:115+40*3-5);assert.equal(items.sortColumn,null);
  s.mode='items';s.render(g.gui,-1,-1);
  if(MODERN)assert.ok(sprites.some(x=>x[0]==='statistics/item_used')&&sprites.some(x=>x[0]==='container/slot'));
  else assert.ok(sprites.some(x=>x[0]==='gui/container/stats_icons.png'&&x[3]===18*2&&x[4]===18),'used column icon');
  assert.ok(texts.some(t=>t[0]===(MODERN?'stats.none':'-')),'missing mined stats');
  assert.deepEqual(s.lists.mobs.rows.map(r=>r.name),data.entities.filter(e=>e.type!=='object'&&['zombie','creeper'].includes(e.name)).sort((a,b)=>(a.internalId??a.id)-(b.internalId??b.id)).map(e=>e.name));
  texts.length=0;s.mode='mobs';s.render(g.gui,-1,-1);
  const name=texts.find(t=>t[0]==='entity.minecraft.'+s.lists.mobs.rows[0].name),line=texts.find(t=>String(t[0]).startsWith('stat_type.minecraft.killed'));
  const x=s.lists.mobs.slotLeft();assert.equal(name[1],minor===13&&!MODERN?x+2-10:x+2);assert.equal(line[1],minor===13&&!MODERN?x+2:x+12);
});
