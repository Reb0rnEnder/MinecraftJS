import {WORKSTATIONS_498,LOOM_PATTERNS,stonecutterRecipes,tradeCost} from '../../game/workstations-1.14.4.js';
import {C} from '../../net/packets.js';
import {BookScreen} from './book.js';
import {Button} from '../widgets.js';
import {composeBanner} from '../../render/banner.js';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const inside=(x,y,a,b,w,h)=>x>=a&&y>=b&&x<a+w&&y<b+h;

// Base classes are supplied by the container router to avoid an inheritance import cycle.
export function createWorkstationScreen(game,win,SimpleScreen,ContainerScreen) {
  const definition=WORKSTATIONS_498[win.type];
  if(win.type==='minecraft:lectern')return new LecternScreen(game,win);
  if(win.type==='minecraft:villager')return createMerchantScreen(game,win);
  if(!definition)return null;
  class WorkstationScreen extends SimpleScreen {
    constructor(){
      super(game,win,'gui/container/'+definition.texture+'.png',definition.slots,{titleX:8,titleY:definition.titleY});
      this.row=0;this.scrolling=false;this.inputId=null;
    }
    recipes(){
      const input=win.get(0);
      if(this.inputId!==input?.id){this.row=0;this.inputId=input?.id;}
      return stonecutterRecipes(game,input);
    }
    patterns(){
      const banner=win.get(0),dye=win.get(1),pattern=win.get(2);
      if(!banner||!dye||(game.items.nbt(banner)?.BlockEntityTag?.Patterns?.length||0)>=6)return [];
      if(pattern){
        const id={globe_banner_pattern:35,creeper_banner_pattern:36,skull_banner_pattern:37,flower_banner_pattern:38,mojang_banner_pattern:39}[game.items.name(pattern.id)];
        return id?[id]:[];
      }
      return Array.from({length:34},(_,i)=>i+1);
    }
    grid(){
      const stone=win.type==='minecraft:stonecutter';
      const entries=stone?this.recipes():this.patterns();
      return {stone,entries,x:stone?52:60,y:stone?14:13,w:stone?16:14,h:stone?18:14,rows:stone?3:4};
    }
    icon(gui,id,x,y,width=5,height=10,layers=null){
      const key='loom/'+game.assets.version+'/'+(layers?JSON.stringify(layers):id);
      let tex=game.assets.textures.get(key);
      if(!tex){const image=composeBanner(game.assets,layers||[{Pattern:'b',Color:8},{Pattern:LOOM_PATTERNS[id],Color:0}]);if(!image)return;tex=game.assets.makeTexture(key,image.width,image.height,image.data);}
      gui.blit(tex,x,y,1,1,20,40,tex.width,tex.height,width,height);
    }
    drawBackground(gui,mx,my){
      super.drawBackground(gui);
      const x=this.guiLeft,y=this.guiTop;
      if(win.type==='minecraft:grindstone'){
        if((win.get(0)||win.get(1))&&!win.get(2))gui.blit(this.tex,x+92,y+31,176,0,28,21);
      }else if(win.type==='minecraft:cartography'){
        const second=win.get(1),name=second?game.items.name(second.id):'',input=win.get(0);
        const tag=input?game.items.nbt(input):null,map=tag?.map,texture=game.entityRenderer.mapTexture(map);
        const locked=tag?.map_locked || game.items.maps.get(map)?.locked;
        const invalid=locked&&['paper','glass_pane'].includes(name)||name==='paper'&&game.items.maps.get(map)?.scale>=4;
        if(invalid)gui.blit(this.tex,x+35,y+31,226,132,28,21);
        const drawMap=(dx,dy,size)=>{if(texture)gui.blit(texture,x+dx,y+dy,0,0,128,128,128,128,size,size);};
        if(name==='paper'&&!invalid){gui.blit(this.tex,x+67,y+13,176,66,66,66);drawMap(85,31,128*.226);}
        else if(name==='map'){
          gui.blit(this.tex,x+83,y+13,176,132,50,66);drawMap(86,16,128*.34);
          gui.blit(this.tex,x+67,y+29,176,132,50,66);drawMap(70,32,128*.34);
        }else{
          gui.blit(this.tex,x+67,y+13,176,0,66,66);drawMap(71,17,128*.45);
          if(name==='glass_pane')gui.blit(this.tex,x+66,y+12,0,166,66,66);
        }
      }else{
        const grid=this.grid(),{stone,entries,w,h,rows}=grid;
        const max=Math.max(0,Math.ceil(entries.length/4)-rows);this.row=clamp(this.row,0,max);
        const scroll=max?this.row/max:0;
        gui.blit(this.tex,x+119,y+(stone?15:13)+Math.floor(41*scroll),stone?(max?176:188):(entries.length?232:244),0,12,15);
        if(!stone){
          for(const [slot,sx,sy] of definition.slots.slice(0,3))if(!win.get(slot))gui.blit(this.tex,x+sx,y+sy,176+slot*16,0,16,16);
          const output=win.get(3);if(output){
            const colors=['white','orange','magenta','light_blue','yellow','lime','pink','gray','light_gray','cyan','purple','blue','brown','green','red','black'];
            const base=15-colors.indexOf(game.items.name(output.id).replace('_banner',''));
            const layers=[{Pattern:'b',Color:base},...(game.items.nbt(output)?.BlockEntityTag?.Patterns||[]).map(p=>({...p,Color:15-p.Color}))];
            this.icon(gui,0,x+141,y+8,20,40,layers);
          }
        }
        for(let j=0;j<rows*4;j++){
          const index=this.row*4+j;if(index>=entries.length)break;
          const gx=x+grid.x+j%4*w,gy=y+grid.y+Math.floor(j/4)*h;
          const selected=win.properties[0]===(stone?index:entries[index]);
          const hovered=inside(mx,my,gx,gy,w,h);
          gui.blit(this.tex,gx,gy,0,166+(selected?h:hovered?h*2:0),w,h);
          if(stone)game.itemRenderer.drawItem(gui,entries[index].data.result,gx,gy+2,false);
          else this.icon(gui,entries[index],gx+4,gy+2);
        }
      }
    }
    extraMouseDown(mx,my,button){
      if(button!==0||!['minecraft:stonecutter','minecraft:loom'].includes(win.type))return false;
      const grid=this.grid(),{entries,w,h,rows}=grid,x=mx-this.guiLeft,y=my-this.guiTop;
      if(inside(x,y,grid.x,grid.y,w*4,h*rows)){
        const index=this.row*4+Math.floor((x-grid.x)/w)+Math.floor((y-grid.y)/h)*4;
        if(index<entries.length){game.send(C.menuButton(win.id,grid.stone?index:entries[index]));game.sound.playUi(grid.stone?'ui.stonecutter.select_recipe':'ui.loom.select_pattern',1);}
        return true;
      }
      if(inside(x,y,119,9,12,56)){this.scrolling=true;this.mouseMove(mx,my);return true;}
      return false;
    }
    mouseMove(mx,my){
      if(this.scrolling){const g=this.grid(),max=Math.max(0,Math.ceil(g.entries.length/4)-g.rows);this.row=Math.round(clamp((my-this.guiTop-g.y-7.5)/41,0,1)*max);return;}
      super.mouseMove(mx,my);
    }
    mouseUp(...args){this.scrolling=false;super.mouseUp(...args);}
    wheel(delta){if(['minecraft:stonecutter','minecraft:loom'].includes(win.type)){const g=this.grid();this.row=clamp(this.row+delta,0,Math.max(0,Math.ceil(g.entries.length/4)-g.rows));}}
    renderExtraTooltip(gui,mx,my){
      if(win.type!=='minecraft:stonecutter'||game.inventory.cursor)return;
      const g=this.grid(),x=mx-this.guiLeft-g.x,y=my-this.guiTop-g.y;
      if(x<0||y<0||x>=64||y>=54)return;
      const recipe=g.entries[this.row*4+Math.floor(x/16)+Math.floor(y/18)*4];
      if(recipe)gui.tooltip(game.items.tooltip(recipe.data.result,game.settings.advancedItemTooltips),mx,my);
    }
  }
  return new WorkstationScreen();

  function createMerchantScreen(game,win){
    class NativeMerchantScreen extends ContainerScreen {
      constructor(){super(game,win);this.xSize=276;this.index=0;this.row=0;this.scrolling=false;this.slotPos=[[0,136,37],[1,162,37],[2,220,37]];
        for(let i=0;i<27;i++)this.slotPos.push([3+i,108+i%9*18,84+Math.floor(i/9)*18]);
        for(let i=0;i<9;i++)this.slotPos.push([30+i,108+i*18,142]);}
      onTradeList(data){this.index=clamp(this.index,0,Math.max(0,data.trades.length-1));win.selectedTrade=this.index;this.row=clamp(this.row,0,Math.max(0,data.trades.length-7));}
      drawBackground(gui,mx,my){
        const tex='gui/container/villager2.png',x=this.guiLeft,y=this.guiTop,data=win.tradeData,trades=data?.trades||[];
        gui.blit(tex,x,y,0,0,276,166,512,256);
        if(trades[this.index]?.disabled)gui.blit(tex,x+182,y+35,311,0,28,21,512,256);
        const max=Math.max(0,trades.length-7);this.row=clamp(this.row,0,max);
        gui.blit(tex,x+94,y+18+(max?Math.floor(113*this.row/max):0),max?0:6,199,6,27,512,256);
        for(let j=0;j<7;j++){
          const t=trades[this.row+j];if(!t)break;
          const ty=y+18+j*20;
          gui.button(x+5,ty,89,20,'',inside(mx,my,x+5,ty,89,20),true);
          const cost=tradeCost(t,game.items.maxStack(t.a.id));
          game.itemRenderer.drawItem(gui,cost,x+10,ty+1);
          if(t.b)game.itemRenderer.drawItem(gui,t.b,x+40,ty+1);
          game.itemRenderer.drawItem(gui,t.out,x+73,ty+1);
          gui.blit(tex,x+60,ty+4,t.disabled?25:15,171,10,9,512,256);
          if(cost.count!==t.a.count){gui.text(String(t.a.count),x+10,ty+10,0xffffff,true);gui.blit(tex,x+17,ty+13,0,176,9,2,512,256);}
        }
        const level=data?.villagerLevel||0;
        if(data?.isRegularVillager&&level>0&&level<5){
          const thresholds=[0,0,10,70,150,250],lo=thresholds[level],hi=thresholds[level+1],amount=clamp(Math.floor((data.experience-lo)*100/(hi-lo)),0,100);
          gui.blit(tex,x+136,y+16,0,186,102,5,512,256);
          gui.blit(tex,x+136,y+16,0,191,amount+1,5,512,256);
          const xp=trades[this.index]?.xp||0,pending=Math.min(Math.ceil(xp*100/(hi-lo)),100-amount);
          if(pending>0)gui.blit(tex,x+137+amount,y+17,2,182,pending,3,512,256);
        }
      }
      drawForeground(gui){
        const data=win.tradeData,level=data?.villagerLevel,title=win.title+(data?.isRegularVillager&&level?' - '+game.assets.translate('merchant.level.'+level):'');
        this.title(gui,title,187-gui.textWidth(title)/2,6);
        const label=game.assets.translate('merchant.trades');this.title(gui,label,53-gui.textWidth(label)/2,6);
        this.title(gui,game.assets.translate('container.inventory'),107,72);
      }
      extraMouseDown(mx,my,button){
        if(button!==0)return false;
        const x=mx-this.guiLeft,y=my-this.guiTop,trades=win.tradeData?.trades||[];
        if(inside(x,y,5,18,89,140)){const index=this.row+Math.floor((y-18)/20);if(index<trades.length){this.index=index;win.selectedTrade=index;game.send(C.selectTrade(index));}return true;}
        if(inside(x,y,94,18,6,139)&&trades.length>7){this.scrolling=true;this.mouseMove(mx,my);return true;}return false;
      }
      mouseMove(mx,my){if(this.scrolling){this.row=Math.round(clamp((my-this.guiTop-18-13.5)/112,0,1)*Math.max(0,(win.tradeData?.trades.length||0)-7));return;}super.mouseMove(mx,my);}
      mouseUp(...args){this.scrolling=false;super.mouseUp(...args);}
      wheel(delta){this.row=clamp(this.row+delta,0,Math.max(0,(win.tradeData?.trades.length||0)-7));}
      renderExtraTooltip(gui,mx,my){
        if(game.inventory.cursor)return;
        const x=mx-this.guiLeft,y=my-this.guiTop;if(!inside(x,y,5,18,89,140))return;
        const t=win.tradeData?.trades[this.row+Math.floor((y-18)/20)];if(!t)return;
        const item=x<35?tradeCost(t,game.items.maxStack(t.a.id)):x<60?t.b:t.out;
        if(item)gui.tooltip(game.items.tooltip(item,game.settings.advancedItemTooltips),mx,my);
      }
    }
    return new NativeMerchantScreen();
  }
}

class LecternScreen extends BookScreen {
  constructor(game,win){
    super(game,{id:game.assets.itemsByName.get('written_book')?.id||0,count:1},false);
    this.container=win;this.isContainer=true;this.book=null;
  }
  init(){super.init();this.buttons=this.buttons.filter(b=>b!==this.nextBtn&&b!==this.prevBtn);
    this.buttons[0].w=98;this.buttons[0].x=this.width/2-100;
    if(this.game.gameMode!==2&&this.game.gameMode!==3)this.buttons.push(new Button(3,this.width/2+2,196,98,20,this.game.assets.translate('lectern.take_book'),()=>this.game.send(C.menuButton(this.container.id,3))));
    if(this.game.gameMode===2||this.game.gameMode===3)this.buttons[0].w=200;
    this.buttons.push(this.nextBtn,this.prevBtn);
    this.prevBtn.onClick=()=>this.game.send(C.menuButton(this.container.id,1));
    this.nextBtn.onClick=()=>this.game.send(C.menuButton(this.container.id,2));
  }
  render(gui,mx,my){
    const book=this.container.get(0);
    if(book!==this.book){
      this.book=book;
      this.pages=book?new BookScreen(this.game,book,false).pages:[''];
    }
    this.page=clamp(this.container.properties[0]||0,0,Math.max(0,this.pages.length-1));this.updateButtons();super.render(gui,mx,my);
  }
  close(){ContainerClose(this);}
}
function ContainerClose(screen){
  const g=screen.game;g.send(C.closeWindow(screen.container.id));g.window=null;g.inventory.cursor=null;g.screens.open(null);
}
