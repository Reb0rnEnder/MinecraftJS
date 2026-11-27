import {appendAdventureTooltips} from './adventure-tooltip.js';
import {itemComponentValues766} from '../net/item-components-1.20.6.js';
import {itemComponentValues26_3} from '../net/item-components-26.3.js';
import {ITEM_DATA_766} from './item-data-1.20.6.js';
import {NATIVE_EFFECTS_26_3} from './effects-26.3.js';
import{bundleContents,bundleContentWeight}from'./bundle.js';
import {NATIVE_BLOCK_TAGS_26_3} from './block-tags-26.3.js';
import {NATIVE_REQUIRES_TOOL_26_3} from './block-tools-26.3.js';
const attributeKey = name => 'attribute.name.' + name.replace(/^minecraft:/, '').replace(/[A-Z]/g, c => '_' + c.toLowerCase());
const REQUIRES_TOOL_26_3 = new Set(NATIVE_REQUIRES_TOOL_26_3.blocks);
// Item metadata helpers: names, tooltips, stack sizes, durability, use actions, tool speeds.
import { simplify } from '../net/nbt.js';
import { blocksByName } from '../world/blocks.js';
import { chatToLegacy } from '../gui/chat.js';

// Registry names, never legacy item IDs or metadata variants. See items-1.13.2.md for sources.
const FOOD_NAMES = new Set(`apple mushroom_stew bread porkchop cooked_porkchop golden_apple enchanted_golden_apple
  cod salmon tropical_fish pufferfish cooked_cod cooked_salmon cookie melon_slice beef cooked_beef chicken cooked_chicken
  rotten_flesh spider_eye carrot potato baked_potato poisonous_potato golden_carrot pumpkin_pie rabbit cooked_rabbit
  rabbit_stew mutton cooked_mutton chorus_fruit beetroot beetroot_soup dried_kelp honey_bottle`.split(/\s+/));
const SWORDS = new Set(['iron_sword', 'wooden_sword', 'stone_sword', 'diamond_sword', 'golden_sword','netherite_sword']);
const POTIONS = new Set(['potion', 'splash_potion', 'lingering_potion', 'tipped_arrow']);
const SINGLE_LEVEL = new Set(`aqua_affinity binding_curse silk_touch flame infinity channeling mending vanishing_curse`.split(' '));
// Item.getUseAnimation overrides that are not represented by a component. Bundles are the
// named bundle plus every dyed bundle; the rest are the native item classes' constants.
const NATIVE_USE_ANIMATIONS = new Map([
  ['bow','bow'],['crossbow','crossbow'],['trident','trident'],['spyglass','spyglass'],
  ['brush','brush'],['goat_horn','toot_horn']
]);
const nativeUseAnimation = name => name === 'bundle' || name.endsWith('_bundle') ? 'bundle' : NATIVE_USE_ANIMATIONS.get(name) || null;
const resource = (name) => name.includes(':') ? name : 'minecraft:' + name;
const translationKey = (kind, name) => kind + '.' + resource(name).replace(':', '.');
export class Items {
  constructor(assets,player=null) {
    this.player=player;
    this.assets = assets;
    // Only item definitions belong here: block IDs and item IDs are different registries.
    this.byId = new Map(assets.data.items.map(d => [d.id, d]));
    this.byName = new Map(assets.data.items.map(d => [d.name, d]));
    this.maps = new Map();
    this.effects = {...ITEM_DATA_766.effects,...NATIVE_EFFECTS_26_3};
  }

  def(id) { return this.byId.get(id) || null; }

  name(id) { const d = this.def(id); return d ? d.name : 'unknown'; }

  components(item) {return item?.version==='26.3'?itemComponentValues26_3(item):itemComponentValues766(item);}
  component(item,type) {return this.components(item)[type];}
  maxStack(item) {return this.component(item,'max_stack_size')??1;}
  maxDurability(item) {return this.component(item,'max_damage')??0;}
  isDamageable(item) {const c=this.components(item);return !!item&&c.max_damage!==undefined&&c.damage!==undefined&&c.unbreakable===undefined;}
  damage(item) {return Math.max(0,Math.min(this.maxDurability(item),this.component(item,'damage')??0));}
  rarity(item) {
    const base=this.component(item,'rarity')??'common';
    if(!this.enchantments(item,false).length)return base;
    return base==='common'||base==='uncommon'?'rare':base==='rare'?'epic':base;
  }

  nbt(item) {
    if (item?._renderTag !== undefined) return item._renderTag; // Simplified block-entity display stack; never sent as an inventory stack.
    if (!item || !item.nbt) return null;
    if (!item._simple || item._simpleFor !== item.nbt) {
      item._simple = simplify(item.nbt) || {};
      item._simpleFor = item.nbt;
    }
    return item._simple;
  }

  // ItemStack.getDisplayName: custom name, else the translated item name
  displayName(item) {
    const c=this.components(item);
    if(c.custom_name!==undefined)return chatToLegacy(c.custom_name,{parsed:true});
    if(c.item_name!==undefined)return chatToLegacy(c.item_name,{parsed:true});
    const d=this.def(item.id);if(!d)return 'Unknown ('+item.id+')';
    if(d.name==='written_book'&&c.written_book_content?.title){const title=c.written_book_content.title;return typeof title==='string'?title:title.content??title.raw??'';}
    if(d.name==='player_head'&&c.profile?.name)return this.assets.translate('block.minecraft.player_head.named',[c.profile.name]);
    if(POTIONS.has(d.name))return this.potionName(item);
    if(d.name==='compass'&&c.lodestone_tracker!==undefined)return this.assets.translate('item.minecraft.lodestone_compass');
    const key=translationKey(this.isBlockItem(item.id)?'block':'item',d.name),translated=this.assets.translate(key);return translated===key?d.displayName:translated;
  }

  potionName(item) { return this.assets.translate(translationKey('item', this.name(item.id)) + '.effect.' + this.potionType(item).name); }

  potionType(item) {
    const c=this.component(item,'potion_contents')||{},id=c.potionId;
    if(id!==undefined&&id!==null)return ITEM_DATA_766.potions[id]||{name:'empty',effects:[]};
    return Object.values(ITEM_DATA_766.potions).find(p=>p.key===c.potion)||{name:'empty',effects:[]};
  }
  potionEffects(item) {
    const c=this.component(item,'potion_contents')||{},base=this.potionType(item).effects.map(e=>({...e}));
    for(const e of c.customEffects||c.custom_effects||[]){const d=e.details||e,raw=e.id,id=typeof raw==='number'?raw:Number(Object.entries(ITEM_DATA_766.registries.mob_effect).find(([,name])=>name===resource(raw))?.[0]);if(this.effects[id])base.push({id,duration:d.duration??0,amplifier:d.amplifier??0,particles:d.showParticles??d.show_particles??true,ambient:d.ambient??false});}
    return base;
  }
  potionColor(item) {const c=this.component(item,'potion_contents')||{};return c.customColor??c.custom_color??this.effectsColor(this.potionEffects(item));}
  effectsColor(effects) {
    let r=0,g=0,b=0,n=0;
    for(const e of effects){if(e.particles===false)continue;const c=this.effects[e.id]?.color??0,w=e.amplifier+1;r+=w*((c>>16)&255);g+=w*((c>>8)&255);b+=w*(c&255);n+=w;}
    return n?((Math.trunc(r/n)<<16)|(Math.trunc(g/n)<<8)|Math.trunc(b/n)):0x385dc6;
  }

  // PotionUtils.addPotionTooltip (durationFactor: potions 1, lingering 0.25, tipped arrows 0.125)
  potionTooltip(item, lines, factor) {
    const E = this.effects;
    const t = (k, ...a) => this.assets.translate(k, a).trim();
    const effects = this.potionEffects(item), mods = [];
    if (!effects.length) lines.push('§7' + t('effect.none'));
    for (const e of effects) {
      const def = E[e.id];
      if (!def) continue;
      let s = t(translationKey('effect', def.key));
      for (const [attr, amount, op] of def.modifiers) mods.push([attr, amount * (e.amplifier + 1), op]); // getAttributeModifierAmount
      if (e.amplifier > 0) s = t('potion.withAmplifier',s,t('potion.potency.' + e.amplifier));
      if (e.duration > 20 || e.duration===-1) {
        // Potion.getPotionDurationString -> StringUtils.ticksToElapsedTime
        const ticks = Math.floor(Math.fround(e.duration * factor)), sec = Math.floor(ticks / 20), m = Math.floor(sec / 60), r = sec % 60;
        const hours=Math.floor(m/60),time=e.duration===-1?t('effect.duration.infinite'):(hours?String(hours).padStart(2,'0')+':'+String(m%60).padStart(2,'0'):String(m).padStart(2,'0'))+':'+String(r).padStart(2,'0');s=t('potion.withDuration',s,time);
      }
      lines.push((def.bad ? '§c' : '§9') + s);
    }
    if (!mods.length) return;
    lines.push('');
    lines.push('§5' + t('potion.whenDrank'));
    const fmt = (d) => String(Math.round(d * 100) / 100); // ItemStack.DECIMALFORMAT "#.##"
    for (const [attr, amount, op] of mods) {
      const d = op === 1 || op === 2 ? amount * 100 : amount;
      if (amount > 0) lines.push('§9' + t('attribute.modifier.plus.' + op, fmt(d), t(attributeKey(attr))));
      else if (amount < 0) lines.push('§c' + t('attribute.modifier.take.' + op, fmt(-d), t(attributeKey(attr))));
    }
  }

  // The flattened egg determines its default entity; EntityTag can override the spawn type.
  eggEntity(item) {
    const entity=this.component(item,'entity_data');const data=entity?simplify(entity):null;
    let id = typeof data?.id==='string'?data.id:null;
    if (id && !id.includes(':')) id = 'minecraft:' + id;
    const name = this.name(item.id);
    return id || (name.endsWith('_spawn_egg') ? 'minecraft:' + name.slice(0, -10) : null);
  }

  // EntityList.ENTITY_EGGS: [primary, secondary, translation name] or null
  eggInfo(item) {
    // ItemColors uses the egg item's own colours, even when EntityTag changes what it spawns.
    return ITEM_DATA_766.eggs[resource(this.name(item.id))]||null;
  }
  enchantments(item,stored=this.name(item?.id)==='enchanted_book') {
    if(!item)return [];
    const c=this.component(item,stored?'stored_enchantments':'enchantments');if(!c)return [];
    if(c.levels)return this.sortEnchantments(Object.entries(c.levels).map(([id,lvl])=>({id:resource(id),lvl})));
    return this.sortEnchantments((c.enchantments||[]).map(e=>{
      const native=typeof e.id==='string';
      return {id:native?e.id:ITEM_DATA_766.registries.enchantment[e.enchantment??e.id],lvl:e.level,native};
    }).filter(e=>e.id));
  }
  sortEnchantments(list) {
    const order=list.some(e=>e.native)
      ?this.assets.data.enchantments.map(e=>resource(e.name))
      :ITEM_DATA_766.enchantmentOrder.map(id=>ITEM_DATA_766.registries.enchantment[id]);
    return list.sort((a,b)=>{const ai=order.indexOf(a.id),bi=order.indexOf(b.id);return (ai<0?Infinity:ai)-(bi<0?Infinity:bi);});
  }
  isEnchanted(item) {return !!item&&this.enchantments(item,false).length>0;}
  hasEffect(item) {
    if(!item)return false;const c=this.components(item);
    if(c.enchantment_glint_override!==undefined)return c.enchantment_glint_override;
    return this.name(item.id)==='compass'&&c.lodestone_tracker!==undefined||this.isEnchanted(item);
  }

  // Enchantment.getTranslatedName: curses in red, the level unless a single-level enchantment at level 1
  enchantmentName(id, level) {
    const name = typeof id === 'number' ? ITEM_DATA_766.registries.enchantment[id] : id;
    const definition = this.assets.data.enchantments.find(e => resource(e.name) === resource(name));
    if (!name) return this.assets.translate('enchantment.unknown', [id]);
    const short = name.replace(/^minecraft:/, '');
    let s = this.assets.translate(translationKey('enchantment', name));
    if (short === 'binding_curse' || short === 'vanishing_curse') s = '§c' + s;
    const key = 'enchantment.level.' + level, translated = this.assets.translate(key);
    return level === 1 && (definition ? definition.maxLevel === 1 : SINGLE_LEVEL.has(short)) ? s : s + ' ' + (translated === key ? level : translated);
  }

  enchantLevel(item, id) {
    if (!item) return 0;
    // Numeric IDs are the 766 wire registry used by the legacy component decoder; gameplay
    // callers and native 26.3 components use resource names.
    const name = typeof id === 'number' ? ITEM_DATA_766.registries.enchantment[id] : id;
    const e = name && this.enchantments(item,false).find((x) => x.id === resource(name));
    return e ? e.lvl : 0;
  }

  tooltip(item, advanced = false, creative = false) {
    const c=this.components(item);if(!creative&&(Object.hasOwn(c,'hide_tooltip')||c.tooltip_display?.hide_tooltip))return [];
    const hidden=new Set(c.tooltip_display?.hidden_components||[]);
    const rarity=this.rarity(item),color={common:'white',uncommon:'yellow',rare:'aqua',epic:'light_purple'}[rarity]||'white';
    const name=c.custom_name??c.item_name??{text:this.displayName(item)},lines=[chatToLegacy(name,{parsed:true,style:{color,...(c.custom_name!==undefined?{italic:true}:{})}})];
    const t=(key,...args)=>this.assets.translate(key,args),registryName=this.name(item.id);
    if(!Object.hasOwn(c,'hide_additional_tooltip')){
      if(POTIONS.has(registryName)&&!hidden.has('potion_contents'))this.potionTooltip(item,lines,registryName==='lingering_potion'?.25:registryName==='tipped_arrow'?.125:1);
      if(registryName==='bundle'&&!hidden.has('bundle_contents')){const weight=bundleContentWeight(item,this);lines.push('§7'+t('item.minecraft.bundle.fullness',weight,64));lines.bundleTooltip={items:bundleContents(item,this),weight};}
      const book=c.written_book_content;if(registryName==='written_book'&&book?.author&&!hidden.has('written_book_content'))lines.push('§7'+t('book.byAuthor',book.author));
      if(registryName.startsWith('music_disc_')&&!hidden.has('jukebox_playable')&&!hidden.has('song'))lines.push('§7'+t(translationKey('item',registryName)+'.desc'));
      if(registryName==='goat_horn'&&!hidden.has('instrument')){const instrument=c.instrument,meta=ITEM_DATA_766.instruments[instrument?.instrumentId];if(meta)lines.push('§7'+t('instrument.'+meta.key.replace(':','.')));}
      if(registryName==='crossbow'&&!hidden.has('charged_projectiles')&&this.chargedProjectiles(item).length){const projectile=this.chargedProjectiles(item)[0];lines.push(t('item.minecraft.crossbow.projectile')+' ['+this.displayName(projectile)+']');if(advanced&&this.name(projectile.id)==='firework_rocket'){const more=[];this.rocketTooltip(this.component(projectile,'fireworks'),more);lines.push(...more.map(s=>'§7  '+s));}}
      if(registryName==='firework_rocket'&&!hidden.has('fireworks'))this.rocketTooltip(c.fireworks,lines);
      if(registryName==='filled_map'&&advanced&&!hidden.has('map_id')&&!this.maps.has(c.map_id))lines.push('§7'+t('filled_map.unknown'));
      if(registryName==='firework_star'&&!hidden.has('firework_explosion')&&c.firework_explosion)this.fireworkTooltip(c.firework_explosion,lines);

    }
    for(const stored of [true,false]){
      const enchant=this.component(item,stored?'stored_enchantments':'enchantments');
      if(enchant&&!hidden.has(stored?'stored_enchantments':'enchantments')&&(enchant.show_in_tooltip??enchant.showInTooltip??enchant.showTooltip??true))for(const e of this.enchantments(item,stored))lines.push('§7'+this.enchantmentName(e.id,e.lvl));
    }
    const dye=c.dyed_color;if(dye&&!hidden.has('dyed_color')&&(dye.show_in_tooltip??dye.showTooltip??true))lines.push(advanced?'§7'+t('item.color',('#'+(dye.rgb??dye.color).toString(16).toUpperCase())):'§7§o'+t('item.dyed'));
    if(!hidden.has('lore'))for(const line of c.lore||[])lines.push(chatToLegacy(line,{parsed:true,style:{color:'dark_purple',italic:true}}));
    if(!hidden.has('attribute_modifiers'))this.attributeTooltip(item,lines);
    if(c.unbreakable!==undefined&&!hidden.has('unbreakable')&&(typeof c.unbreakable==='boolean'?c.unbreakable:c.unbreakable.show_in_tooltip??c.unbreakable.showTooltip??true))lines.push('§9'+t('item.unbreakable'));
    appendAdventureTooltips(this,item,lines);
    if(advanced){if(this.isDamageable(item)&&this.damage(item)>0)lines.push(t('item.durability',this.maxDurability(item)-this.damage(item),this.maxDurability(item)));lines.push('§8'+resource(registryName));const n=Object.keys(c).length;if(n)lines.push('§8'+t('item.components',n));}
    return lines;
  }

  rocketTooltip(fireworks,lines) {if(!fireworks)return;const duration=fireworks.flight_duration??fireworks.flightDuration??0;if(duration>0)lines.push('§7'+this.assets.translate('item.minecraft.firework_rocket.flight')+' '+duration);for(const explosion of fireworks.explosions||[])this.fireworkTooltip(explosion,lines);}

  fireworkTooltip(explosion,lines) {
    const t=(key,...args)=>this.assets.translate(key,args),base='item.minecraft.firework_star.';
    lines.push('§7'+t(base+'shape.'+explosion.shape));
    const colors=values=>values.map(c=>t(base+(ITEM_DATA_766.fireworkColors[c]||'custom_color'))).join(', ');
    if(explosion.colors?.length)lines.push('§7'+colors(explosion.colors));
    const fade=explosion.fadeColors??explosion.fade_colors;if(fade?.length)lines.push('§7'+t(base+'fade_to')+' '+colors(fade));
    if(explosion.hasTrail??explosion.has_trail)lines.push('§7'+t(base+'trail'));
    if(explosion.hasTwinkle??explosion.has_twinkle)lines.push('§7'+t(base+'flicker'));
  }

  attributeTooltip(item,lines) {
    const attrs=this.component(item,'attribute_modifiers')||{};if((attrs.show_in_tooltip??attrs.showTooltip??true)===false)return;
    const own=attrs.modifiers??attrs.attributes??[],mods=own.length?own:item.version==='26.3'?[]:ITEM_DATA_766.items[item.id]?.defaultAttributes?.modifiers||[],t=(key,...args)=>this.assets.translate(key,args),player=typeof this.player==='function'?this.player():this.player;
    const uuid=v=>Array.isArray(v)?v.map(n=>(n>>>0).toString(16).padStart(8,'0')).join('').replace(/^(........)(....)(....)(....)(............)$/,'$1-$2-$3-$4-$5'):v;
    const groups=['mainhand','offhand','feet','legs','chest','head','body'];
    for(const group of groups){const selected=mods.filter(m=>{const s=(m.slot??'any').replace('_','');return s==='any'||s===group||s==='hand'&&['mainhand','offhand'].includes(group)||s==='armor'&&['feet','legs','chest','head'].includes(group);});if(!selected.length)continue;
      lines.push('','§7'+t('item.modifiers.'+group));
      for(const m of selected){
        const type=m.type??ITEM_DATA_766.registries.attribute[m.typeId],op={add_value:0,add:0,add_multiplied_base:1,multiply_base:1,add_multiplied_total:2,multiply_total:2}[m.operation]??0;
        let value=m.amount??m.value,equal=false;
        if(player&&uuid(m.uuid)===ITEM_DATA_766.baseAttackDamageUuid){value+=(player.attributes?.get('generic.attackDamage')?.value??1)+(this.enchantLevel(item,'sharpness')>0?.5*this.enchantLevel(item,'sharpness')+.5:0);equal=true;}
        else if(player&&uuid(m.uuid)===ITEM_DATA_766.baseAttackSpeedUuid){value+=player.attributes?.get('generic.attackSpeed')?.value??4;equal=true;}
        const amount=op?value*100:type==='minecraft:generic.knockback_resistance'?value*10:value,fmt=Number(amount.toFixed(2)).toString();
        if(equal)lines.push('§2 '+t('attribute.modifier.equals.'+op,fmt,t(attributeKey(type))));
        else if(value>0)lines.push('§9'+t('attribute.modifier.plus.'+op,fmt,t(attributeKey(type))));
        else if(value<0)lines.push('§c'+t('attribute.modifier.take.'+op,Number((-amount).toFixed(2)).toString(),t(attributeKey(type))));
      }
    }
  }

  useAction(item) {
    if(!item)return 'none';
    const c=this.components(item),animation=c?.consumable?.animation;
    if(animation&&animation!=='none')return animation;
    if(c?.food!==undefined)return 'eat';
    const native=nativeUseAnimation(this.name(item.id));
    if(native)return native;
    if(c?.blocks_attacks!==undefined)return 'block';
    if(c?.kinetic_weapon!==undefined)return 'spear';
    if(item.version==='26.3')return 'none';
    const action=ITEM_DATA_766.items[item.id]?.action||'none';
    if(!['none','eat'].includes(action))return action;
    return 'none';
  }
  useDuration(item) {
    if(!item)return 0;const c=this.components(item),name=this.name(item.id),meta=ITEM_DATA_766.items[item.id];
    if(c.consumable)return Math.trunc(Math.fround(Math.fround(c.consumable.consumeSeconds??c.consumable.secondsToConsume??1.6)*20));
    if(c.food&&(item.version==='26.3'||['eat','none'].includes(meta?.action)))return Math.trunc(Math.fround(Math.fround(c.food.eat_seconds??c.food.secondsToEat??1.6)*20));
    // Item.getUseDuration: blocking and kinetic weapons use 72000 ticks; the item classes
    // below override that with their own fixed durations.
    if(c.blocks_attacks!==undefined||c.kinetic_weapon!==undefined)return 72000;
    if(name==='bow'||name==='trident')return 72000;
    if(name==='spyglass')return 1200;
    if(name==='brush'||name==='bundle'||name.endsWith('_bundle'))return 200;
    if(name==='crossbow')return this.crossbowChargeDuration(item)+3;
    if(name==='goat_horn'){const instrument=c.instrument;return instrument?.data?.useDuration??ITEM_DATA_766.instruments[instrument?.instrumentId]?.duration??(typeof instrument==='string'?Object.values(ITEM_DATA_766.instruments).find(i=>i.key===instrument)?.duration:undefined)??meta?.duration??0;}
    if(item.version==='26.3')return 0;
    return meta?.action==='eat'?0:meta?.duration||0;
  }
  isFood(item) {return !!item&&this.component(item,'food')!==undefined;}
  canAlwaysEat(item) {const food=this.component(item,'food');return !!(food?.can_always_eat??food?.canAlwaysEat);}
  crossbowChargeDuration(item) {return 25-5*this.enchantLevel(item,'quick_charge');}
  chargedProjectiles(item) {const value=this.component(item,'charged_projectiles');return value?.projectiles??value??[];}
  crossbowCharged(item) {return this.chargedProjectiles(item).length>0;}

  blockRuleMatches(rule, blockDef) {
    const blocks=rule?.blocks, name=String(blockDef?.name||'').replace(/^minecraft:/,'');
    if(typeof blocks==='string')return blocks.startsWith('#')?this.blockTagHas(blocks,name):blocks.replace(/^minecraft:/,'')===name;
    if(!blocks)return false;
    if(blocks.tag)return this.blockTagHas(blocks.tag,name);
    if(blocks.name)return blocks.name.replace(/^minecraft:/,'')===name;
    if(Array.isArray(blocks.ids))return blocks.ids.some(id=>{const def=this.assets.data.blocks?.[id]??this.assets.data.blocks?.find?.(block=>block.id===id);return def?.name===name;});
    if(Array.isArray(blocks))return blocks.some(entry=>this.blockRuleMatches({blocks:entry},blockDef));
    return false;
  }

  blockTagHas(tag, name) {
    const key=String(tag).replace(/^#/,'');
    return !!NATIVE_BLOCK_TAGS_26_3.tags[key]?.includes(name);
  }

  // Item.getDestroySpeed: the first matching native tool rule wins, otherwise the tool's
  // default mining speed applies. Rules and tags come from the 26.3 item reports/jar.
  strVsBlock(item, blockDef) {
    if (!item) return 1;
    const tool=this.component(item,'tool');
    if(tool){
      for(const rule of tool.rules||[])if(this.blockRuleMatches(rule,blockDef))return rule.speed??1;
      return tool.default_mining_speed??tool.defaultMiningSpeed??1;
    }
    // A native item without a tool component has hand speed; never index the shifted 766 table.
    if(item.version==='26.3')return 1;
    const name = this.name(item.id),native=this.assets.data.creative?.toolSpeeds?.[item.id];
    if(native)return native[blockDef.name]??1;
    if (name === 'shears') {
      if (blockDef.name === 'cobweb' || blockDef.material === 'leaves') return 15;
      if (blockDef.material === 'wool') return 5;
      return 1;
    }
    if (SWORDS.has(name)) {
      if (blockDef.name === 'cobweb') return 15;
      const m = blockDef.material;
      if (m === 'plant' || m === 'leaves' || blockDef.name === 'vine' || blockDef.name === 'pumpkin' || blockDef.name === 'melon') return 1.5;
      return 1;
    }
    // materials.json still has 1.12 numeric keys. Express the same tool/material rules by registry names.
    const toolName = /^(wooden|stone|iron|diamond|golden|netherite)_(pickaxe|axe|shovel)$/.exec(name);
    if (toolName && ({ pickaxe: ['rock'], axe: ['wood', 'plant'], shovel: ['dirt'] }[toolName[2]]).includes(blockDef.material)) {
      return { wooden: 2, stone: 4, iron: 6, diamond: 8, golden: 12, netherite: 9 }[toolName[1]];
    }
    return 1;
  }

  canHarvest(item, blockDef) {
    if(item?.version==='26.3'){
      if(!REQUIRES_TOOL_26_3.has(resource(blockDef.name)))return true;
      const tool=this.component(item,'tool');
      if(!tool)return false;
      for(const rule of tool.rules||[])if(this.blockRuleMatches(rule,blockDef))return !!(rule.correct_for_drops??rule.correctForDrops??false);
      return false;
    }
    if (!blockDef.harvestTools) return true;
    return !!(item && blockDef.harvestTools[item.id]);
  }

  blockFor(id) {
    const d = this.def(id);
    // Wheat is harvested grain, not the identically named crop block (wheat_seeds plants that).
    return d && d.name !== 'air' && d.name !== 'wheat' ? blocksByName[d.name] || null : null;
  }

  isBlockItem(id) { return !!this.blockFor(id); }

  updateMap(p) {
    let m = this.maps.get(p.itemDamage);
    if (!m) { m = { colors: new Uint8Array(128 * 128), icons: [], scale: p.scale, version: 0 }; this.maps.set(p.itemDamage, m); }
    m.scale = p.scale;
    m.locked = !!p.locked;
    if(p.icons!==null)m.icons = p.icons;
    if (p.columns > 0 && p.data) {
      for (let i = 0; i < p.columns; i++) {
        for (let j = 0; j < p.rows; j++) {
          m.colors[(p.y + j) * 128 + p.x + i] = p.data[j * p.columns + i];
        }
      }
    }
    m.version++;
  }
}

export { SWORDS, FOOD_NAMES };
