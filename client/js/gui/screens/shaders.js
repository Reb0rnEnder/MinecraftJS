import {Screen} from './manager.js';
import {Button,Slider} from '../widgets.js';
import {platform} from '../../platform/platform.js';
import {tr} from '../i18n.js';
import {shaderMenu} from '../../render/shader-menu.js';
import {SlotList} from '../slot-list.js';
import {drawShaderTooltip} from './shader-tooltip.js';
import {ShaderLibrary} from '../../render/shader-library.js';
export const SHADER_PACK_KEY='shaderpacks/final-stage';
export class ShaderPacksScreen extends Screen {
 constructor(game,parent){super(game);this.parent=parent;this.library=game.shaderLibrary||(game.shaderLibrary=new ShaderLibrary(game.shaderPack));this.background=game.inWorld?'world':'dirt';this.message=game.shaderPack.error||game.shaderPack.wavingError||'';}
 init(){
  const p=this.game.shaderPack,width=this.width-140,right=this.width-130,folderWidth=Math.min(150,Math.floor(width/2)-10),folderX=Math.floor(width/4)-Math.floor(folderWidth/2);
  this.list=new ShaderPackList(this);
  const gl=this.game.device.gl;this.graphicsInfo=gl?'OpenGL: '+[gl.getParameter(gl.VERSION),gl.getParameter(gl.VENDOR),gl.getParameter(gl.RENDERER)].join(', '):(this.game.device.name||'WebGL 2');
  const unavailable=['Antialiasing: OFF','Normal Map: OFF','Specular Map: OFF','Render Quality: 1x','Shadow Quality: 1x','Hand Depth: 1x','Old Hand Light: Default','Old Lighting: Default'];
  unavailable.forEach((label,i)=>{const button=new Button(10+i,right,30+i*20,120,20,label);button.enabled=false;button.description='This renderer setting is not implemented';this.buttons.push(button);});
  const settings=new Button(4,right,this.height-25,120,20,'Shader Options...',()=>this.game.screens.open(new ShaderOptionsScreen(this.game,this)));settings.enabled=!!p.bytes&&p.enabled&&!!p.availableOptions.length;this.buttons.push(settings);
  this.buttons.push(new Button(0,folderX,this.height-25,folderWidth-21,20,'Shaders Folder',()=>this.importPack()));this.buttons.at(-1).description='Import shader ZIPs into the browser shader library';this.buttons.at(-1).enabled=!!this.game.device.createFinalShaderPass;
  this.buttons.push(new Button(210,folderX+folderWidth-23,this.height-25,22,20,'↓',()=>platform().openUrl('https://optifine.net/shaderPacks')));this.buttons.at(-1).description='Download shader packs';
  this.buttons.push(new Button(3,Math.floor(width/4)*3-Math.floor(folderWidth/2),this.height-25,folderWidth,20,tr('gui.done'),()=>this.game.screens.open(this.parent)));
 }
 render(gui,mx,my,partial){super.render(gui,mx,my,partial);drawShaderTooltip(this,gui,mx,my);}

 mouseDown(x,y,button,e){return super.mouseDown(x,y,button)||this.list.mouseDown(x,y,button,e);}
 mouseUp(x,y,button){super.mouseUp(x,y,button);this.list.mouseUp();}
 mouseMove(x,y){this.list.mouseMove(x,y);}
 wheel(d){this.list.wheel(d);}

 async persist(){try{this.library.saveCurrent();}catch(e){this.message='Could not save shader pack: '+e.message;}}
 async importPack(){
  try{const files=await platform().pickFiles({accept:'.zip',multiple:true});if(!files.length)return;
   for(const file of files)await this.library.add(file.name,file.bytes);
   this.message='';this.onResize();
  }catch(e){this.message=e.message;this.onResize();}
 }
 async removePack(id=this.library.selected){try{await this.library.remove(id);this.onResize();}catch(e){this.message=e.message;}}
 key(e){if(e.code==='Delete'&&this.library.enabled&&this.library.selected&&this.library.selected!=='(internal)'){this.removePack();return true;}return super.key(e);}
 async selectPack(id){try{await this.library.select(id);this.message='';this.onResize();}catch(e){this.message=e.message;}}

 renderContent(gui,mx,my){
  this.list.render(gui,mx,my);
  gui.textCentered('Shaders',Math.floor(this.width/2),15,0xffffff,true);
  if(!this.game.device.createFinalShaderPass)gui.textCentered('Shader packs require WebGL 2.',this.width/2,this.height-40,0xffaaaa,false);
  else if(this.message)gui.textCentered(gui.font.trimToWidth(this.message,this.width-20),this.width/2,this.height-40,0xffffaa,false);
  else if(gui.textWidth(this.graphicsInfo)<this.width-5)gui.textCentered(this.graphicsInfo,Math.floor(this.width/2),this.height-40,0x808080,false);
  else gui.text(this.graphicsInfo,5,this.height-40,0x808080,false);
 }
}
class ShaderPackList extends SlotList {
 constructor(screen){const width=screen.width-140;super(screen,30,screen.height-50,16,{listWidth:width-20,left:0,width,scrollBarRight:true});}
 // Vanilla selection lists normally draw dirt in their entire area. The shader
 // list must preserve the world behind the screen while playing.
 _dirt(gui,y0,y1,tint,scroll){if(!this.screen.game.inWorld)super._dirt(gui,y0,y1,tint,scroll);}
 size(){return this.screen.library.entries.length+2;}
 isSelected(i){const library=this.screen.library;return i===0?!library.enabled:library.enabled&&(i===1?'(internal)':this.screen.library.entries[i-2]?.id)===library.selected;}
 drawSlot(gui,i,x,y){const label=i===0?'OFF':i===1?'(internal)':this.screen.library.entries[i-2]?.name;gui.textCentered(gui.font.trimToWidth(label||'',this.listWidth-8),Math.floor(this.width/2),y+1,0xe0e0e0,true);}
 clicked(i,dbl,mx,my,rx,ry,event){if(i>1&&event?.shift)this.screen.removePack(this.screen.library.entries[i-2].id);else this.screen.selectPack(i===0?null:i===1?'(internal)':this.screen.library.entries[i-2].id);return true;}
 contentHeight(){return this.size()*18;}
}

export class ShaderOptionsScreen extends Screen {
 constructor(game,parent){super(game);this.parent=parent;this.background=game.inWorld?'world':'dirt';this.values={...game.shaderPack.options};this.page=0;this.message='';this.path=[];this.menuData=game.shaderPack.bytes?shaderMenu(game.shaderPack.bytes,game.shaderPack.availableOptions):null;}
 init(){
  const pack=this.game.shaderPack;
  this.menu=this.path.at(-1)||this.menuData?.root;
  const entries=this.menu?.entries||pack.availableOptions.map(o=>({option:o.name})),columns=Math.max(this.menu?.columns||2,Math.ceil(entries.length/9)),cellWidth=Math.min(Math.floor(this.width/columns),200),left=Math.floor((this.width-cellWidth*columns)/2);
  this.pages=1;this.page=0;this.perPage=entries.length;
  entries.slice(this.page*this.perPage,(this.page+1)*this.perPage).forEach((entry,i)=>{
   if(!entry)return;
   const x=left+i%columns*cellWidth+5,y=30+Math.floor(i/columns)*20;
   if(entry.menu){this.buttons.push(new Button(i,x,y,cellWidth-10,20,entry.menu.label+'...',()=>{this.path.push(entry.menu);this.page=0;this.onResize();}));return;}
   const o=pack.availableOptions.find(o=>o.name===entry.option);if(!o)return;
   const current=()=>this.values[o.name]??o.default,label=()=>{const value=o.toggle?(current()==='true'?'ON':'OFF'):current(),width=this.gui.font?.width(': OFF')||35,name=this.gui.font?.trimToWidth(o.label,cellWidth-15-width)||o.label;return name+': '+(current()!==o.default?'§a':'')+value;};
   let button;
   if(this.menuData?.sliders?this.menuData.sliders.has(o.name):o.values.length>8){button=new ShaderSlider(i,x,y,cellWidth-10,20,label,Math.max(0,o.values.indexOf(current()))/(o.values.length-1),v=>{this.values[o.name]=o.values[Math.round(v*(o.values.length-1))];});}
   else button=new Button(i,x,y,cellWidth-10,20,label,()=>{this.values[o.name]=o.values[(o.values.indexOf(current())+1)%o.values.length];});
   button.option=o;this.buttons.push(button);
  });
  const y=Math.floor(this.height/6)+179,cx=Math.floor(this.width/2);
  this.buttons.push(new Button(102,cx-140,y,120,20,tr('controls.reset'),()=>{this.values={};this.onResize();}));
  this.buttons.push(new Button(104,cx+20,y,120,20,tr('gui.done'),()=>this.close()));
 }
 mouseDown(mx,my,button,event){
  const target=this.buttons.find(b=>b.option&&b.hovered(mx,my));
  if(target&&(button===2||event?.shift)){
   const o=target.option,current=this.values[o.name]??o.default;
   this.values[o.name]=event?.shift?o.default:o.values[(o.values.indexOf(current)+o.values.length-1)%o.values.length];this.onResize();return true;
  }
  return super.mouseDown(mx,my,button,event);
 }
 async close(){
  const pack=this.game.shaderPack;
  try{const enabled=pack.enabled;pack.load(pack.name,pack.bytes,this.values);pack.enabled=enabled;await this.parent.persist();if(this.path.length){this.path.pop();this.onResize();}else this.game.screens.open(this.parent);}catch(e){this.message=e.message;}
 }

 wheel(d){this.page=(this.page+(d>0?1:this.pages-1))%this.pages;this.onResize();}
 render(gui,mx,my,partial){super.render(gui,mx,my,partial);drawShaderTooltip(this,gui,mx,my);}
 renderContent(gui){
  gui.textCentered(this.menu?.label||'Shader Options',Math.floor(this.width/2),15,0xffffff,true);
  if(this.message)gui.textCentered(gui.font.wrap(this.message,this.width-20)[0],Math.floor(this.width/2),this.height-40,0xffaaaa,false);
 }
}

// GuiSliderShaderOption uses the disabled-background row with a hovered thumb.
class ShaderSlider extends Slider {
 render(gui,mx,my){
  if(!this.visible)return;if(this.dragging)this._set(mx);
  gui.blit('gui/widgets.png',this.x,this.y,0,46,this.w/2,this.h);gui.blit('gui/widgets.png',this.x+this.w/2,this.y,200-this.w/2,46,this.w/2,this.h);
  const x=this.x+Math.floor(this.value*(this.w-8)),row=this.hovered(mx,my)?86:66;
  gui.blit('gui/widgets.png',x,this.y,0,row,4,20);gui.blit('gui/widgets.png',x+4,this.y,196,row,4,20);
  gui.textCentered(this.labelFn(this.value),this.x+this.w/2,this.y+(this.h-8)/2,this.hovered(mx,my)?0xffffa0:0xe0e0e0);
 }
}
