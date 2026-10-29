import {Screen} from './manager.js';import {C} from '../../net/packets.js';import {tr} from '../i18n.js';
export const GAMEMODE_CHOICES=[{id:1,name:'creative',icon:'grass_block'},{id:0,name:'survival',icon:'iron_sword'},{id:2,name:'adventure',icon:'map'},{id:3,name:'spectator',icon:'ender_eye'}];
// GameModeSwitcherScreen, protocol-independent command submission after releasing F3.
export class GameModeSwitcherScreen extends Screen {
 constructor(game){super(game);this.background='none';const previous=game.previousGameMode??(game.gameMode===1?0:1);this.selected=GAMEMODE_CHOICES.findIndex(m=>m.id===previous);if(this.selected<0)this.selected=0;this.initialMouse=null;}
 finish(){const mode=GAMEMODE_CHOICES[this.selected];if(this.game.permissionLevel>=2&&mode.id!==this.game.gameMode)this.game.send(C.chat('/gamemode '+mode.name));this.game.f3Combo=false;this.game.screens.close();}
 tick(){if(!this.game.input.down.has('F3'))this.finish();}
 key(e){if(e.code==='F4'){this.selected=(this.selected+1)%4;this.initialMouse=null;return true;}return super.key(e);}
 keyUp(e){if(e.code==='F3')this.finish();}
 renderContent(gui,mx,my){
  const cx=Math.floor(this.width/2),cy=Math.floor(this.height/2),texture='gui/container/gamemode_switcher.png';
  gui.blit(texture,cx-62,cy-57,0,0,125,75,128,128);
  if(!this.initialMouse)this.initialMouse=[mx,my];const moved=this.initialMouse[0]!==mx||this.initialMouse[1]!==my;
  for(const [i,choice]of GAMEMODE_CHOICES.entries()){
   const x=cx-Math.floor(115/2)+i*30,y=cy-30;if(moved&&mx>=x&&mx<x+25&&my>=y&&my<y+25)this.selected=i;
   gui.blit(texture,x,y,0,75,25,25,128,128);const item=this.game.assets.itemsByName.get(choice.icon);if(item)this.game.itemRenderer.drawItem(gui,{id:item.id,count:1},x+5,y+5,false);
   if(this.selected===i)gui.blit(texture,x,y,25,75,25,25,128,128);
  }
  gui.textCentered(tr('gameMode.'+GAMEMODE_CHOICES[this.selected].name),cx,cy-50,0xffffff);
  gui.textCentered(tr('debug.gamemodes.select_next','§b'+tr('debug.gamemodes.press_f4')+'§r'),cx,cy+5,0xffffff);
 }
}
