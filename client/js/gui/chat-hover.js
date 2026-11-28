import { VANILLA_UI } from './vanilla-layout.js';
import { chatToLegacy } from './chat.js';
import { parseSnbt } from '../net/snbt.js';
import { simplify } from '../net/nbt.js';
// Hover values are already parsed chat components. SNBT is their literal text, not a second chat message.
const payload=value=>typeof value==='string'?value:Array.isArray(value)?value.map(payload).join(''):String(value?.text??'')+(value?.extra||[]).map(payload).join('');
const formatHoverUuid = (uuid) => {
  if (!Array.isArray(uuid) || uuid.length !== 4) return String(uuid || '');
  const hex = uuid.map((n) => (n >>> 0).toString(16).padStart(8, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};
export function chatHoverTooltip(game,component) {
  const event=component?.hover;
  if(!event)return component?.hoverText?.split('\n')||null;
  if(event.action==='show_text')return chatToLegacy(event.contents??event.value,{parsed:true}).split('\n');
  if(event.action==='show_item') {
    try {
      if (event.id !== undefined) {
        const name = String(event.id || '').replace(/^minecraft:/, '');
        const id = game.items.byName.get(name)?.id;
        if (id === undefined || !game.items.def(id) || (event.count !== undefined && Number(event.count) <= 0)) throw new Error('Invalid item');
        const componentValues = { ...game.items.components(id) };
        for (const [rawKey, val] of Object.entries(event.components || {})) {
          if (rawKey.startsWith('!')) delete componentValues[rawKey.slice(1).replace(/^minecraft:/, '')];
          else componentValues[rawKey.replace(/^minecraft:/, '')] = val;
        }
        return game.items.tooltip({ id, count: Number(event.count ?? 1), damage: Number(componentValues.damage || 0), componentValues }, !!game.settings.advancedItemTooltips);
      }
      const modern=event.contents,root=modern?null:parseSnbt(payload(event.value)),nbt=modern?{id:modern.id,Count:modern.count??1}:simplify(root),id=typeof nbt.id==='number'?nbt.id:game.items.byName.get(String(nbt.id||'').replace(/^minecraft:/,''))?.id;
      if(id===undefined||!game.items.def(id)||nbt.Count!==undefined&&Number(nbt.Count)<=0)throw new Error('Invalid item');
      const item={id,count:Number(nbt.Count??1),damage:Number(nbt.Damage||0),nbt:modern?.tag?parseSnbt(modern.tag):root?.v.tag||null};
      return game.items.tooltip(item,!!game.settings.advancedItemTooltips);
    }catch{return ['§cInvalid Item!'];}
  }
  if(event.action==='show_entity') {
    if(!game.settings.advancedItemTooltips)return null;
    if(event.id !== undefined && event.uuid !== undefined){
      return [...(event.name?[chatToLegacy(event.name,{parsed:true})]:[]),game.assets.translate('gui.entity_tooltip.type',[game.assets.translate('entity.'+String(event.id||'').replace(':','.'))]),formatHoverUuid(event.uuid)];
    }
    if(event.contents){const nbt=event.contents;return [...(nbt.name?[chatToLegacy(nbt.name,{parsed:true})]:[]),game.assets.translate('gui.entity_tooltip.type',[game.assets.translate('entity.'+String(nbt.type||'').replace(':','.'))]),String(nbt.id||'')];}
    try{const nbt=simplify(parseSnbt(payload(event.value)));return [String(nbt.name||''),...(nbt.type?['Type: '+nbt.type]:[]),String(nbt.id||'')];}catch{return ['§cInvalid Entity!'];}
  }
  if(event.action==='show_achievement'&&VANILLA_UI.version==='1.8.9') {
    const key=payload(event.value),name=game.assets.translate(key);
    if(name===key)return ['§cInvalid statistic/achievement!'];
    const achievement=key.startsWith('achievement.'),lines=[name,'§o'+game.assets.translate('stats.tooltip.type.'+(achievement?'achievement':'statistic'))];
    if(achievement){const desc=game.assets.translate(key+'.desc',[game.settings.keyName?.(game.settings.keys?.inventory)||'E']);lines.push(...game.gui.font.wrap(desc,150));}return lines;
  }
  return null;
}
