import {Screen} from './manager.js';
import {Button,TextField} from '../widgets.js';
import {tr} from '../i18n.js';
import {C} from '../../net/packets.js';
const resource=s=>/^([a-z0-9_.-]+:)?[a-z0-9_./-]+$/.test(s);
export class JigsawScreen extends Screen {
  constructor(game,pos,data={}){super(game);this.pos=pos;this.values=[data.target_pool||'minecraft:empty',data.attachement_type||'minecraft:empty',data.final_state||'minecraft:air'];}
  init(){
    const cx=this.width/2;
    this.fields=this.values.map((text,i)=>new TextField(cx-150,50+i*40,300,20,{text,maxLength:256,focused:i===0,onChange:s=>{this.values[i]=s;this.updateButtons();}}));
    this.done=new Button(0,cx-154,180,150,20,tr('gui.done'),()=>this.save());
    this.buttons.push(this.done,new Button(1,cx+4,180,150,20,tr('gui.cancel'),()=>this.close()));this.updateButtons();
  }
  updateButtons(){if(this.done)this.done.enabled=resource(this.values[0])&&resource(this.values[1])&&!!this.values[2].trim();}
  save(){if(!this.done.enabled)return;const [pool,type,state]=this.values;this.game.send(C.updateJigsaw(this.pos,type,pool,state));this.close();}
  key(e){if(e.code==='Enter'||e.code==='NumpadEnter'){this.save();return true;}return super.key(e);}
  renderContent(gui){['jigsaw_block.target_pool','jigsaw_block.attachement_type','jigsaw_block.final_state'].forEach((k,i)=>gui.text(tr(k),this.width/2-150,40+i*40,0xa0a0a0));}
}
