// Native 1.20.6 WinScreen content and navigation (menu credits skip the poem).
import {Screen} from './manager.js';
import {C} from '../../net/packets.js';
import {JavaRandom} from '../../util/jrandom.js';

export function creditLines(sections){
  const lines=[];
  for(const section of sections){
    lines.push('[C]§f============','[C]§e'+section.section,'[C]§f============','','');
    for(const discipline of section.disciplines){
      if(discipline.discipline)lines.push('[C]§e'+discipline.discipline,'','');
      for(const title of discipline.titles)lines.push('§7'+title.title,...title.names.map(name=>'§f           '+name),'','');
    }
  }
  return lines;
}

export class CreditsScreen extends Screen {
  constructor(game,{poem=true,onFinished=null}={}){
    super(game);this.poem=poem;this.onFinished=onFinished;
    this.background=poem?'none':'world';this.isCredits=true;
    this.scroll=0;this.baseSpeed=poem?.5:.75;this.speed=this.baseSpeed;
    this.held=new Set();this.lines=null;this.totalHeight=0;
    this._load();
  }
  async _load(){
    const g=this.game,A=g.assets,lines=[],name=g.username||g.accounts?.active()?.name||'Player';
    const read=async(path,consume)=>{try{const value=await A.readText(path);if(value)consume(value);}catch(e){console.error("Couldn't load credits",path,e);}};
    const poem=text=>{
      const random=new JavaRandom(8124371),mark='§f§k§a§b';
      for(let line of text.split(/\r?\n/)){
        line=line.split('PLAYERNAME').join(name);
        while(line.includes(mark))line=line.replace(mark,'§f§k'+'XXXXXXXX'.slice(0,random.nextInt(4)+3));
        lines.push(...g.gui.font.wrap(line,256),'');
      }
      for(let i=0;i<8;i++)lines.push('');
    };
    if(this.poem)await read('texts/end.txt',poem);
    await read('texts/credits.json',text=>lines.push(...creditLines(JSON.parse(text))));
    if(this.poem)await read('texts/postcredits.txt',poem);
    this.lines=lines;this.totalHeight=lines.length*12;
  }
  tick(){super.tick();if(!this.lines)return;this.scroll=Math.max(0,this.scroll+this.speed);if(this.scroll>this.totalHeight+this.height*2+24)this.finish();}
  finish(){if(this.finished)return;this.finished=true;if(this.onFinished)this.onFinished();else{this.game.send(C.clientCommand(0));this.game.screens.open(null);}}
  respawn(){this.finish();}
  _speed(){const controls=Number(this.held.has('ControlLeft'))+Number(this.held.has('ControlRight'));this.speed=this.baseSpeed*(this.held.has('Space')?5+controls*15:1)*(this.held.has('ArrowUp')?-1:1);}
  key(e){if(e.code==='Escape'){this.finish();return true;}this.held.add(e.code);this._speed();return true;}
  keyUp(e){this.held.delete(e.code);this._speed();}
  close(){this.finish();}
  render(gui,mx,my,partial){
    const W=this.width,H=this.height,scroll=Math.max(0,this.scroll+partial*this.speed);
    if(!this.poem)gui.menuBackground(this.game.inWorld,0,0,W,H,scroll*.5);
    // End-poem portal background remains tracked in P10; no legacy dirt asset.
    else gui.rect(0,0,W,H,0xff000000);
    if(!this.lines)return;
    const x=Math.floor(W/2)-128,k=H+50,off=-scroll;
    gui.pushMatrix();gui.translate(0,off);
    gui.blit('gui/title/minecraft.png',W/2-128,k,0,0,256,44,256,64);
    gui.blit('gui/title/edition.png',W/2-64,k+37,0,0,128,14,128,16);
    let y=k+100;
    for(let i=0;i<this.lines.length;i++){
      if(i===this.lines.length-1&&y+off<Math.floor(H/2)-6)gui.translate(0,Math.floor(H/2)-6-y-off);
      if(y+off+20>0&&y+off<H){const line=this.lines[i];if(line.startsWith('[C]'))gui.textCentered(line.slice(3),x+128,y,0xffffff,true);else gui.text(line,x,y,0xffffff,true);}
      y+=12;
    }
    gui.popMatrix();
    const vignette=gui.tex('misc/credits_vignette.png');
    if(vignette){gui.setBlend('darken');gui.quad(vignette,0,0,W,H,0,0,1,1,[1,1,1,1]);gui.setBlend('alpha');}
  }
}
