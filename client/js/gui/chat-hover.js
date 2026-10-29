import { VANILLA_UI } from './vanilla-layout.js';
import { chatToLegacy } from './chat.js';
import { parseSnbt } from '../net/snbt.js';
import { simplify } from '../net/nbt.js';
// Hover values are already parsed chat components. SNBT is their literal text, not a second chat message.
const payload=value=>typeof value==='string'?value:Array.isArray(value)?value.map(payload).join(''):String(value?.text??'')+(value?.extra||[]).map(payload).join('');
export function chatHoverTooltip(game,component) {
  const event=component?.hover;
  if(!event)return component?.hoverText?.split('\n')||null;
  if(event.action==='show_text')return chatToLegacy(event.contents??event.value,{parsed:true}).split('\n');
  if(event.action==='show_item') {
    try {
      const modern=event.contents,root=modern?null:parseSnbt(payload(event.value)),nbt=modern?{id:modern.id,Count:modern.count??1}:simplify(root),id=typeof nbt.id==='number'?nbt.id:game.items.byName.get(String(nbt.id||'').replace(/^minecraft:/,''))?.id;
      if(id===undefined||!game.items.def(id)||nbt.Count!==undefined&&Number(nbt.Count)<=0)throw new Error('Invalid item');
      const item={id,count:Number(nbt.Count??1),damage:Number(nbt.Damage||0),nbt:modern?.tag?parseSnbt(modern.tag):root?.v.tag||null};
      return game.items.tooltip(item,!!game.settings.advancedItemTooltips);
    }catch{return ['§cInvalid Item!'];}
  }
  if(event.action==='show_entity') {
    if(!game.settings.advancedItemTooltips)return null;
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
