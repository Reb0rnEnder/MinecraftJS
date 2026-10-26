import {Screen} from './manager.js';
import {Button,Slider} from '../widgets.js';
import {platform} from '../../platform/platform.js';
import {tr} from '../i18n.js';
export const SHADER_PACK_KEY='shaderpacks/final-stage';
export class ShaderPacksScreen extends Screen {
 constructor(game,parent){super(game);this.parent=parent;this.message=game.shaderPack.error||game.shaderPack.wavingError||'';}
 init(){
  const x=this.width/2-100,y=this.height/2,p=this.game.shaderPack;
  this.buttons.push(new Button(0,x,y-30,200,20,'Import shader ZIP…',()=>this.importPack()));
  this.buttons.at(-1).enabled=!!this.game.device.createFinalShaderPass;
  const toggle=new Button(1,x,y-6,200,20,()=>p.enabled?'Shaders: ON':'Shaders: OFF',()=>{p.enabled=!p.enabled;this.persist();});toggle.enabled=!!p.bytes;this.buttons.push(toggle);
  const settings=new Button(4,x,y+18,200,20,'Shader pack settings…',()=>this.game.screens.open(new ShaderOptionsScreen(this.game,this)));settings.enabled=!!p.availableOptions.length;this.buttons.push(settings);
  const remove=new Button(2,x,y+42,200,20,'Remove shader pack',async()=>{p.clear();await platform().files.delete(SHADER_PACK_KEY);platform().saveSetting(SHADER_PACK_KEY+'.meta','');this.onResize();});remove.enabled=!!p.bytes;this.buttons.push(remove);
  this.buttons.push(new Button(3,x,this.height-28,200,20,tr('gui.done'),()=>this.game.screens.open(this.parent)));
 }
 async persist(){try{const p=this.game.shaderPack;await platform().files.put(SHADER_PACK_KEY,p.bytes);platform().saveSetting(SHADER_PACK_KEY+'.meta',JSON.stringify({name:p.name,enabled:p.enabled,options:p.options}));}catch(e){this.message='Could not save shader pack: '+e.message;}}
 async importPack(){
  try{const [file]=await platform().pickFiles({accept:'.zip'});if(!file)return;this.game.shaderPack.load(file.name,file.bytes);await this.persist();this.message=this.game.shaderPack.hasWaving?'Image effects and vegetation animation loaded.':(this.game.shaderPack.wavingError?'Image effects loaded; vegetation animation unavailable.':'Image effects loaded.');this.onResize();}
  catch(e){this.message=e.message;}
 }
 renderContent(gui){
  gui.textCentered('Shader Packs — Experimental',this.width/2,18,0xffffff,true);
  gui.textCentered('Image effects + supported plant animation.',this.width/2,36,0xcccccc,false);
  gui.textCentered('Basic pack lighting; shadows/reflections unavailable.',this.width/2,48,0xcccccc,false);
  gui.textCentered(this.game.shaderPack.name||'No shader pack loaded',this.width/2,66,0xffffff,false);
  if(!this.game.device.createFinalShaderPass)gui.textCentered('Select WebGL 2 and restart to use shader packs.',this.width/2,76,0xffaaaa,false);
  if(this.message){const lines=gui.font.wrap(this.message,this.width-20).slice(0,2);lines.forEach((line,i)=>gui.textCentered(line,this.width/2,this.height-60+i*10,0xffffaa,false));}
 }
}

export class ShaderOptionsScreen extends Screen {
 constructor(game,parent){super(game);this.parent=parent;this.values={...game.shaderPack.options};this.page=0;this.message='';}
 init(){
  const pack=this.game.shaderPack,rows=Math.max(1,Math.floor((this.height-112)/24));this.perPage=rows*2;
  this.pages=Math.max(1,Math.ceil(pack.availableOptions.length/this.perPage));this.page=Math.min(this.page,this.pages-1);
  const left=this.width/2-155;
  pack.availableOptions.slice(this.page*this.perPage,(this.page+1)*this.perPage).forEach((o,i)=>{
   const x=left+i%2*160,y=46+Math.floor(i/2)*24,current=()=>this.values[o.name]??o.default;
   const label=()=>o.label+': '+(o.toggle?(current()==='true'?'ON':'OFF'):current());
   let button;
   if(o.values.length>8){button=new Slider(i,x,y,150,20,label,o.values.indexOf(current())/(o.values.length-1),v=>{this.values[o.name]=o.values[Math.round(v*(o.values.length-1))];});}
   else button=new Button(i,x,y,150,20,label,()=>{this.values[o.name]=o.values[(o.values.indexOf(current())+1)%o.values.length];});
   button.option=o;this.buttons.push(button);
  });
  this.buttons.push(new Button(100,left,this.height-60,45,20,'<',()=>{this.page=(this.page+this.pages-1)%this.pages;this.onResize();}));
  this.buttons.push(new Button(101,left+265,this.height-60,45,20,'>',()=>{this.page=(this.page+1)%this.pages;this.onResize();}));
  this.buttons.push(new Button(102,left+50,this.height-60,210,20,'Reset all to pack defaults',()=>{this.values={};this.onResize();}));
  this.buttons.push(new Button(103,left,this.height-28,150,20,'Cancel',()=>this.close()));
  this.buttons.push(new Button(104,left+160,this.height-28,150,20,'Apply',async()=>{
   try{const enabled=pack.enabled;pack.load(pack.name,pack.bytes,this.values);pack.enabled=enabled;await this.parent.persist();this.game.screens.open(this.parent);}catch(e){this.message=e.message;}
  }));
 }
 close(){this.game.screens.open(this.parent);}
 wheel(d){this.page=(this.page+(d>0?1:this.pages-1))%this.pages;this.onResize();}
 renderContent(gui,mx,my){
  gui.textCentered('Shader pack settings ('+(this.page+1)+'/'+this.pages+')',this.width/2,12,0xffffff,true);
  gui.textCentered('Options used by supported image, plant and basic lighting stages',this.width/2,28,0xcccccc,false);
  if(this.message)gui.textCentered(gui.font.wrap(this.message,this.width-20)[0],this.width/2,this.height-73,0xffaaaa,false);
  const hovered=this.buttons.find(b=>b.option&&b.hovered(mx,my));
  if(hovered?.option.description)gui.tooltip(gui.font.wrap(hovered.option.description,Math.min(300,this.width-20)),mx,my);
 }
}
