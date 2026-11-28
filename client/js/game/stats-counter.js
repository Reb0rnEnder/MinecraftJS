// Client StatsCounter for the 1.13+ statistics protocol. ClientboundAwardStatsPacket carries
// (stat type registry id, value registry id, value) triples; each stat type names the registry its
// values come from (Stats: mined -> block, crafted..dropped -> item, killed/killed_by -> entity_type,
// custom -> custom_stat). Values replace earlier ones, as StatsCounter.setValue does.
import {STAT_TYPES,CUSTOM_STATS} from './stat-registry.js';
import {BLOCK_TO_ITEM,ITEM_TO_BLOCK} from './stat-items.js';

const TYPE_REGISTRY={mined:'block',crafted:'item',used:'item',broken:'item',picked_up:'item',dropped:'item',killed:'entity_type',killed_by:'entity_type',custom:'custom_stat'};
const TIME_STATS=new Set(['play_one_minute','play_time','total_world_time','time_since_death','time_since_rest','sneak_time']);

// Stats.makeCustomStat formatter assignment; checked against the decompiled 1.13.2 and 1.20.6 Stats classes.
export function customStatFormat(name){
  return TIME_STATS.has(name)?'time':name.endsWith('_one_cm')?'distance':name.startsWith('damage_')?'tenth':'default';
}

// new DecimalFormat("########0.00", Locale.ROOT): HALF_EVEN rounding of the exact binary value.
export function decimal2(x){
  const [whole,fraction]=Math.abs(x).toFixed(100).split('.');
  let digits=BigInt(whole+fraction.slice(0,2));const rest=fraction.slice(2);
  if(rest[0]>'5'||rest[0]==='5'&&(/[1-9]/.test(rest.slice(1))||digits%2n===1n))digits+=1n;
  const s=digits.toString().padStart(3,'0');
  return (x<0?'-':'')+s.slice(0,-2)+'.'+s.slice(-2);
}
// NumberFormat.getIntegerInstance(Locale.US)
const grouped=v=>(v<0?'-':'')+String(Math.abs(Math.trunc(v))).replace(/\B(?=(\d{3})+(?!\d))/g,',');
// Double.toString for the small positive seconds values TIME reaches (always below 30.5).
const javaDouble=v=>Number.isInteger(v)?v.toFixed(1):String(v);

// StatFormatter.DEFAULT / DIVIDE_BY_TEN / DISTANCE / TIME
export function formatStat(format,v){
  switch(format){
    case 'time':{const s=v/20,m=s/60,h=m/60,d=h/24,y=d/365;return y>.5?decimal2(y)+' y':d>.5?decimal2(d)+' d':h>.5?decimal2(h)+' h':m>.5?decimal2(m)+' m':javaDouble(s)+' s';}
    case 'distance':{const m=v/100,km=m/1000;return km>.5?decimal2(km)+' km':m>.5?decimal2(m)+' m':v+' cm';}
    case 'tenth':return decimal2(v*.1);
    default:return grouped(v);
  }
}

// EntityType registry entries. Older entity tables also list spawn-object aliases (type "object") whose ids are
// legacy object numbers, not registry ids; internalId is the registry id where present.
export function entityTypes(data){return (data.entities||[]).filter(e=>e.type!=='object').map(e=>({...e,id:e.internalId??e.id}));}

export class StatsCounter {
  // statTypes/customStats default to the 1.20.6 tables; the 26.3 client passes its native
  // registry order, where happy_ghast, nautilus and straw-bed stats shift the custom ids.
  constructor(data, {statTypes = STAT_TYPES, customStats = CUSTOM_STATS} = {}) {
    const byId=list=>new Map((list||[]).map(d=>[d.id,d.name]));
    this.statTypes=statTypes;
    this.customStatsList=[...customStats];
    this.registries={block:byId(data.blocks),item:byId(data.items),entity_type:byId(entityTypes(data)),custom_stat:new Map(customStats.map((n,i)=>[i,n]))};
    this.values=new Map();
  }
  customStats(){return this.customStatsList.slice();}
  static key(type,name){return type+':'+name;}
  resolve(categoryId,statisticId){
    const type=this.statTypes[categoryId],registry=type&&this.registries[TYPE_REGISTRY[type]],name=registry?.get(statisticId);
    return name==null?null:{type,name};
  }
  apply(entries){
    for(const e of entries||[]){const stat=this.resolve(e.categoryId,e.statisticId);if(stat)this.values.set(StatsCounter.key(stat.type,stat.name),e.value);}
  }
  get(type,name){return this.values.get(StatsCounter.key(type,name))||0;}
  // Every stat of one type with a positive value, as [name, value].
  positive(type){
    const out=[],prefix=type+':';
    for(const [k,v] of this.values)if(v>0&&k.startsWith(prefix))out.push([k.slice(prefix.length),v]);
    return out;
  }
}

// Block.asItem(): the item a mined block contributes to the item list (null for air).
export function blockAsItem(name,itemNames){const n=Object.hasOwn(BLOCK_TO_ITEM,name)?BLOCK_TO_ITEM[name]:name;return n==='air'||!itemNames.has(n)?null:n;}
// BlockItem.getBlock(): the block whose "mined" stat an item row shows (null when the item is not a block item).
export function itemBlock(name,blockNames){const n=Object.hasOwn(ITEM_TO_BLOCK,name)?ITEM_TO_BLOCK[name]:name;return n&&blockNames.has(n)?n:null;}

// ItemStatisticsList: items with a positive broken/crafted/used/picked_up/dropped stat, plus the items of mined
// blocks, without air. Native collects them in an identity hash set (no stable order); this keeps registry order.
export const BLOCK_COLUMNS=['mined'],ITEM_COLUMNS=['broken','crafted','used','picked_up','dropped'];
export function statItems(counter,data){
  const items=data.items||[],itemNames=new Set(items.map(i=>i.name)),wanted=new Set();
  for(const type of ITEM_COLUMNS)for(const [name] of counter.positive(type))wanted.add(name);
  for(const [name] of counter.positive('mined')){const item=blockAsItem(name,itemNames);if(item)wanted.add(item);}
  wanted.delete('air');
  return items.filter(i=>wanted.has(i.name));
}
// EntityType registry order, keeping types with a kill in either direction.
export function statMobs(counter,data){return entityTypes(data).sort((a,b)=>a.id-b.id).filter(e=>counter.get('killed',e.name)>0||counter.get('killed_by',e.name)>0);}
// General list: every custom stat in registration order.
export function customStats(){return CUSTOM_STATS.slice();}
