import {Screen} from './manager.js';
import {Button} from '../widgets.js';
import {platform} from '../../platform/platform.js';
import {tr} from '../i18n.js';
export const SHADER_PACK_KEY='shaderpacks/final-stage';
export class ShaderPacksScreen extends Screen {
 constructor(game,parent){super(game);this.parent=parent;this.message=game.shaderPack.error||'';}
 init(){
  const x=this.width/2-100,y=this.height/2,p=this.game.shaderPack;
  this.buttons.push(new Button(0,x,y-30,200,20,'Import shader ZIP…',()=>this.importPack()));
  this.buttons.at(-1).enabled=!!this.game.device.createFinalShaderPass;
  const toggle=new Button(1,x,y-6,200,20,()=>p.enabled?'Final pass: ON':'Final pass: OFF',()=>{p.enabled=!p.enabled;this.persist();});toggle.enabled=!!p.bytes;this.buttons.push(toggle);
  const remove=new Button(2,x,y+18,200,20,'Remove shader pack',async()=>{p.clear();await platform().files.delete(SHADER_PACK_KEY);platform().saveSetting(SHADER_PACK_KEY+'.meta','');this.onResize();});remove.enabled=!!p.bytes;this.buttons.push(remove);
  this.buttons.push(new Button(3,x,this.height-28,200,20,tr('gui.done'),()=>this.game.screens.open(this.parent)));
 }
 async persist(){try{const p=this.game.shaderPack;await platform().files.put(SHADER_PACK_KEY,p.bytes);platform().saveSetting(SHADER_PACK_KEY+'.meta',JSON.stringify({name:p.name,enabled:p.enabled}));}catch(e){this.message='Could not save shader pack: '+e.message;}}
 async importPack(){
  try{const [file]=await platform().pickFiles({accept:'.zip'});if(!file)return;this.game.shaderPack.load(file.name,file.bytes);await this.persist();this.message='Final pass loaded.';this.onResize();}
  catch(e){this.message=e.message;}
 }
 renderContent(gui){
  gui.textCentered('Shader Packs — Experimental',this.width/2,18,0xffffff,true);
  gui.textCentered('Final-stage effects only.',this.width/2,36,0xcccccc,false);
  gui.textCentered('No pack lighting, shadows or reflections.',this.width/2,48,0xcccccc,false);
  gui.textCentered(this.game.shaderPack.name||'No shader pack loaded',this.width/2,66,0xffffff,false);
  if(!this.game.device.createFinalShaderPass)gui.textCentered('Select WebGL 2 and restart to use shader packs.',this.width/2,76,0xffaaaa,false);
  if(this.message){const lines=gui.font.wrap(this.message,this.width-20).slice(0,2);lines.forEach((line,i)=>gui.textCentered(line,this.width/2,this.height-60+i*10,0xffffaa,false));}
 }
}
