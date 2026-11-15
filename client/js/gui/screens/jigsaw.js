import {Screen} from './manager.js';
import {Button,TextField} from '../widgets.js';
import {tr} from '../i18n.js';
import {C} from '../../net/packets.js';
import {validJigsawResource,jigsawResource} from '../jigsaw-values.js';
export class JigsawScreen extends Screen {
  constructor(game,pos,data={}) {
    super(game);this.pos=pos;
    this.values={pool:String(data.target_pool??'minecraft:empty'),attachment:String(data.attachement_type??'minecraft:empty'),finalState:String(data.final_state??'minecraft:air')};
  }
  init() {
    const cx=Math.floor(this.width/2);this.edits={};
    for(const [i,key]of ['pool','attachment','finalState'].entries()){
      const maxLength=key==='finalState'?256:128,text=this.values[key].slice(0,maxLength);this.values[key]=text;
      const f=new TextField(cx-152,40+i*40,300,20,{text,maxLength,focused:i===0,onChange:value=>{this.values[key]=value;this.updateButtons();}});
      f.jigsawLabel=['jigsaw_block.target_pool','jigsaw_block.attachement_type','jigsaw_block.final_state'][i];this.edits[key]=f;this.fields.push(f);
    }
    this.focusedWidget=this.edits.pool;
    this.done=new Button(0,cx-154,210,150,20,tr('gui.done'),()=>this.save());
    this.cancelButton=new Button(1,cx+4,210,150,20,tr('gui.cancel'),()=>this.close());
    this.buttons.push(this.done,this.cancelButton);this.updateButtons();
  }
  updateButtons(){if(this.done)this.done.enabled=validJigsawResource(this.values.pool)&&validJigsawResource(this.values.attachment);}
  save(){if(!this.done.enabled)return;this.game.send(C.updateJigsaw(this.pos,jigsawResource(this.values.attachment),jigsawResource(this.values.pool),this.values.finalState));this.close();}
  mouseDown(mx,my,button) {
    const handled=super.mouseDown(mx,my,button);
    if(button===0){
      const target=this.buttons.find(b=>b.visible&&b.enabled&&b.hovered(mx,my))||this.fields.find(f=>f.focused);
      if(target){for(const w of [...this.fields,...this.buttons])w.focused=w===target;this.focusedWidget=target;}
    }
    return handled;
  }
  key(e){
    if(e.code==='Enter'||e.code==='NumpadEnter'){
      if(this.focusedWidget&&!this.fields.includes(this.focusedWidget)&&this.focusedWidget.key?.(e,this.game))return true;
      this.save();return true;
    }
    return super.key(e);
  }
  renderContent(gui){for(const f of this.fields)gui.text(tr(f.jigsawLabel),Math.floor(this.width/2)-153,f.y-10,0xa0a0a0);}
}
