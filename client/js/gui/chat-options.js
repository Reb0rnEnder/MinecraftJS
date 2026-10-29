import {tr,trOption,onOff} from './i18n.js';
export function chatOption(game,key){
 const s=game.settings;
 const fields={'options.chat.color':'chatColors','options.chat.links':'chatLinks','options.chat.links.prompt':'chatLinksPrompt','options.reducedDebugInfo':'reducedDebugInfo','options.autoSuggestCommands':'autoSuggestCommands','options.hideMatchedNames':'hideMatchedNames'};
 const field=fields[key];
 if(field)return {label:()=>trOption(key,onOff(s[field])),click:()=>s[field]=!s[field]};
 if(key==='options.narrator')return {label:()=>game.narrator.label(),enabled:game.narrator.active,click:()=>game.narrator.cycle()};
 if(key==='options.chat.visibility')return {label:()=>trOption(key,tr('options.chat.visibility.'+['full','system','hidden'][s.chatVisibility])),click:()=>s.chatVisibility=(s.chatVisibility+1)%3};
 if(key==='options.chat.delay_instant')return {slider:true,label:v=>v===0?tr('options.chat.delay_none'):tr('options.chat.delay', (Math.round(v*60)/10).toFixed(1)),value:()=>(s.chatDelay||0)/6,set:v=>s.chatDelay=Math.round(v*60)/10};
 const sliders={'options.chat.line_spacing':['chatLineSpacing',v=>Math.round(v*100)+'%'],'options.chat.opacity':['chatOpacity',v=>Math.round((v*.9+.1)*100)+'%'],'options.accessibility.text_background_opacity':['textBackgroundOpacity',v=>Math.round(v*100)+'%'],'options.chat.scale':['chatScale',v=>Math.round(v*100)+'%'],'options.chat.width':['chatWidth',v=>Math.floor(v*280+40)+'px'],'options.chat.height.focused':['chatHeightFocused',v=>Math.floor(v*160+20)+'px'],'options.chat.height.unfocused':['chatHeightUnfocused',v=>Math.floor(v*160+20)+'px']};
 const entry=sliders[key];if(!entry)throw Error('Unknown native chat option '+key);
 return {slider:true,label:v=>trOption(key,entry[1](v)),value:()=>s[entry[0]],set:v=>s[entry[0]]=v};
}
