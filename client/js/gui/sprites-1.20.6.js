// Transitional UV adapter for shared HUD consumers. These rectangles describe
// the caller's old logical sheet, not replacement assets. Every draw samples the
// actual target sprite, including native-format resource-pack replacements.
const sheets=new Map();
function region(sheet,x,y,w,h,sprite){let list=sheets.get(sheet);if(!list)sheets.set(sheet,list=[]);list.push({x,y,w,h,sprite});}
const icons=(x,y,w,h,sprite)=>region('gui/icons.png',x,y,w,h,sprite);
const widgets=(x,y,w,h,sprite)=>region('gui/widgets.png',x,y,w,h,sprite);
widgets(0,0,182,22,'hud/hotbar');widgets(0,22,24,23,'hud/hotbar_selection');
widgets(24,22,29,24,'hud/hotbar_offhand_left');widgets(53,22,29,24,'hud/hotbar_offhand_right');
icons(0,0,16,16,'hud/crosshair');
for(const [u,name] of [[16,'empty'],[25,'half'],[34,'full']])icons(u,9,9,9,'hud/armor_'+name);
icons(16,18,9,9,'hud/air');icons(25,18,9,9,'hud/air_bursting');
icons(16,27,9,9,'hud/food_empty');icons(133,27,9,9,'hud/food_empty_hunger');
icons(52,27,9,9,'hud/food_full');icons(61,27,9,9,'hud/food_half');
icons(88,27,9,9,'hud/food_full_hunger');icons(97,27,9,9,'hud/food_half_hunger');
for(const [v,hardcore] of [[0,false],[45,true]]){
  icons(16,v,9,9,'hud/heart/container'+(hardcore?'_hardcore':''));
  icons(25,v,9,9,'hud/heart/container'+(hardcore?'_hardcore':'')+'_blinking');
  for(const [base,type] of [[52,''],[88,'poisoned_'],[124,'withered_'],[160,'absorbing_'],[178,'frozen_']]){
    for(const [offset,half,blink] of [[0,false,false],[9,true,false],[18,false,true],[27,true,true]]){
      // Frozen sprites occupy the last region on the legacy sheet. Native
      // consumers draw blinking frozen hearts explicitly through sprite().
      if(base===160&&blink)continue;
      icons(base+offset,v,9,9,'hud/heart/'+type+(hardcore?'hardcore_':'')+(half?'half':'full')+(blink?'_blinking':''));
    }
  }
}
icons(52,9,9,9,'hud/heart/vehicle_container');icons(88,9,9,9,'hud/heart/vehicle_full');icons(97,9,9,9,'hud/heart/vehicle_half');
icons(0,64,182,5,'hud/jump_bar_background');icons(0,69,182,5,'hud/jump_bar_progress');
icons(0,84,182,5,'hud/experience_bar_background');icons(0,89,182,5,'hud/experience_bar_progress');
icons(0,94,18,18,'hud/hotbar_attack_indicator_background');icons(18,94,18,18,'hud/hotbar_attack_indicator_progress');
icons(36,94,16,4,'hud/crosshair_attack_indicator_background');icons(52,94,17,4,'hud/crosshair_attack_indicator_progress');icons(68,94,16,16,'hud/crosshair_attack_indicator_full');
for(let i=0;i<6;i++)icons(0,176+i*8,10,8,i===5?'server_list/unreachable':'server_list/ping_'+(5-i));
for(let i=0;i<5;i++)icons(10,176+i*8,10,8,'server_list/pinging_'+(i+1));
for(const [row,name] of [[0,'advancement'],[32,'recipe'],[64,'system'],[96,'tutorial']])region('gui/toasts.png',0,row,160,32,'toast/'+name);
for(const [i,color] of ['pink','blue','red','green','yellow','purple','white'].entries()){
  region('gui/bars.png',0,i*10,182,5,'boss_bar/'+color+'_background');region('gui/bars.png',0,i*10+5,183,5,'boss_bar/'+color+'_progress');
}
for(const [i,count] of [6,10,12,20].entries()){
  region('gui/bars.png',0,80+i*10,182,5,'boss_bar/notched_'+count+'_background');region('gui/bars.png',0,85+i*10,183,5,'boss_bar/notched_'+count+'_progress');
}
for(const [u,name] of [[0,'teleport_to_player'],[16,'teleport_to_team'],[128,'close'],[144,'scroll_left'],[160,'scroll_right']])region('gui/spectator_widgets.png',u,0,16,16,'spectator/'+name);
for(const [x,focused] of [[0,false],[20,true]])for(const [y,selected] of [[0,false],[20,true]])region('gui/checkbox.png',x,y,20,20,'widget/checkbox'+(selected?'_selected':'')+(focused?'_highlighted':''));

export function legacyGuiSprite(path,u,v,w,h){
  const r=sheets.get(path)?.find(r=>u>=r.x&&v>=r.y&&u+w<=r.x+r.w&&v+h<=r.y+r.h);
  return r?{path:'gui/sprites/'+r.sprite+'.png',u:(u-r.x)/r.w,v:(v-r.y)/r.h,u1:(u-r.x+w)/r.w,v1:(v-r.y+h)/r.h}:null;
}

export const CORE_GUI_SPRITES=[...new Set([...sheets.values()].flat().map(r=>'gui/sprites/'+r.sprite+'.png'))];
