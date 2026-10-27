import {Screen} from './manager.js';
import {Button,Slider} from '../widgets.js';
import {platform} from '../../platform/platform.js';
import {tr} from '../i18n.js';
import {shaderMenu} from '../../render/shader-menu.js';
import {SlotList} from '../slot-list.js';
import {ShaderLibrary} from '../../render/shader-library.js';
export const SHADER_PACK_KEY='shaderpacks/final-stage';
export class ShaderPacksScreen extends Screen {
 constructor(game,parent){super(game);this.parent=parent;this.library=game.shaderLibrary||(game.shaderLibrary=new ShaderLibrary(game.shaderPack));this.background=game.inWorld?'world':'dirt';this.message=game.shaderPack.error||game.shaderPack.wavingError||'';}
 init(){
  const p=this.game.shaderPack,right=this.width-150;
  this.list=new ShaderPackList(this);
  const settings=new Button(4,right,40,140,20,'Shader Options…',()=>this.game.screens.open(new ShaderOptionsScreen(this.game,this)));settings.enabled=!!p.bytes&&!!p.availableOptions.length;this.buttons.push(settings);
  const remove=new Button(2,right,64,140,20,'Remove shader pack',async()=>{try{await this.library.remove();this.onResize();}catch(e){this.message=e.message;}});remove.enabled=!!this.library.selected;this.buttons.push(remove);
  this.buttons.push(new Button(0,10,this.height-28,Math.min(150,this.width-170),20,'Import shader ZIPs…',()=>this.importPack()));this.buttons.at(-1).enabled=!!this.game.device.createFinalShaderPass;
  this.buttons.push(new Button(3,right,this.height-28,140,20,tr('gui.done'),()=>this.game.screens.open(this.parent)));
 }

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
 async selectPack(id){try{await this.library.select(id);this.message='';this.onResize();}catch(e){this.message=e.message;}}

 renderContent(gui,mx,my){
  this.list.render(gui,mx,my);
  gui.textCentered('Shaders',this.width/2,16,0xffffff,true);
  if(!this.game.device.createFinalShaderPass)gui.textCentered('Shader packs require WebGL 2.',this.width/2,this.height-42,0xffaaaa,false);
  else if(this.message)gui.textCentered(gui.font.trimToWidth(this.message,this.width-20),this.width/2,this.height-42,0xffffaa,false);
 }
}
class ShaderPackList extends SlotList {
 constructor(screen){const width=Math.max(100,screen.width-160);super(screen,32,Math.max(56,screen.height-50),18,{listWidth:width-16,left:0,width,scrollBarRight:true});}
 // Vanilla selection lists normally draw dirt in their entire area. The shader
 // list must preserve the world behind the screen while playing.
 _dirt(gui,y0,y1,tint,scroll){if(!this.screen.game.inWorld)super._dirt(gui,y0,y1,tint,scroll);}
 size(){return this.screen.library.entries.length+1;}
 isSelected(i){const library=this.screen.library;return i===0?!library.enabled:library.enabled&&this.screen.library.entries[i-1]?.id===library.selected;}
 drawSlot(gui,i,x,y){const label=i?this.screen.library.entries[i-1]?.name:'OFF';gui.textCentered(gui.font.trimToWidth(label||'',this.listWidth-8),Math.floor(this.width/2),y+2,0xffffff,true);}
 clicked(i){this.screen.selectPack(i?this.screen.library.entries[i-1].id:null);return true;}
}

export class ShaderOptionsScreen extends Screen {
 constructor(game,parent){super(game);this.parent=parent;this.background=game.inWorld?'world':'dirt';this.values={...game.shaderPack.options};this.page=0;this.message='';this.path=[];this.menuData=game.shaderPack.bytes?shaderMenu(game.shaderPack.bytes,game.shaderPack.availableOptions):null;}
 init(){
  const pack=this.game.shaderPack,rows=Math.max(1,Math.floor((this.height-112)/24));
  this.menu=this.path.at(-1)||this.menuData?.root;
  const entries=this.menu?.entries||pack.availableOptions.map(o=>({option:o.name})),columns=this.menu?.columns||2;
  this.perPage=rows*columns;this.pages=Math.max(1,Math.ceil(entries.length/this.perPage));this.page=Math.min(this.page,this.pages-1);
  const left=Math.floor(this.width/2)-155,cellWidth=310/columns;
  entries.slice(this.page*this.perPage,(this.page+1)*this.perPage).forEach((entry,i)=>{
   if(!entry)return;
   const x=left+i%columns*cellWidth,y=46+Math.floor(i/columns)*24;
   if(entry.menu){this.buttons.push(new Button(i,x,y,cellWidth-10,20,entry.menu.label+'…',()=>{this.path.push(entry.menu);this.page=0;this.onResize();}));return;}
   const o=pack.availableOptions.find(o=>o.name===entry.option);if(!o)return;
   const current=()=>this.values[o.name]??o.default,label=()=>{const text=o.label+': '+(o.toggle?(current()==='true'?'ON':'OFF'):current());return this.gui.font?.trimToWidth(text,cellWidth-16)||text;};
   let button;
   if(this.menuData?.sliders?this.menuData.sliders.has(o.name):o.values.length>8){button=new Slider(i,x,y,cellWidth-10,20,label,Math.max(0,o.values.indexOf(current()))/(o.values.length-1),v=>{this.values[o.name]=o.values[Math.round(v*(o.values.length-1))];});}
   else button=new Button(i,x,y,cellWidth-10,20,label,()=>{this.values[o.name]=o.values[(o.values.indexOf(current())+1)%o.values.length];});
   button.option=o;this.buttons.push(button);
  });
  this.buttons.push(new Button(100,left,this.height-60,45,20,'<',()=>{this.page=(this.page+this.pages-1)%this.pages;this.onResize();}));
  this.buttons.push(new Button(101,left+265,this.height-60,45,20,'>',()=>{this.page=(this.page+1)%this.pages;this.onResize();}));
  this.buttons.push(new Button(102,left+50,this.height-60,210,20,'Reset all to pack defaults',()=>{this.values={};this.onResize();}));
  this.buttons.push(new Button(103,left,this.height-28,150,20,this.path.length?'Back':'Cancel',()=>this.close()));
  this.buttons.push(new Button(104,left+160,this.height-28,150,20,'Apply',async()=>{
   try{const enabled=pack.enabled;pack.load(pack.name,pack.bytes,this.values);pack.enabled=enabled;await this.parent.persist();this.game.screens.open(this.parent);}catch(e){this.message=e.message;}
  }));
 }
 close(){if(this.path.length){this.path.pop();this.page=0;this.onResize();}else this.game.screens.open(this.parent);}
 wheel(d){this.page=(this.page+(d>0?1:this.pages-1))%this.pages;this.onResize();}
 renderContent(gui,mx,my){
  gui.textCentered((this.menu?.label||'Shader Options')+(this.pages>1?' ('+(this.page+1)+'/'+this.pages+')':''),this.width/2,12,0xffffff,true);
  gui.textCentered(this.game.shaderPack.name||'',this.width/2,28,0xcccccc,false);
  if(this.message)gui.textCentered(gui.font.wrap(this.message,this.width-20)[0],this.width/2,this.height-73,0xffaaaa,false);
  const hovered=this.buttons.find(b=>b.option&&b.hovered(mx,my));
  if(hovered?.option.description)gui.tooltip(gui.font.wrap(hovered.option.description,Math.min(300,this.width-20)),mx,my);
 }
}
