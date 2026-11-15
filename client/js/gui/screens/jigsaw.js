import {Screen} from './manager.js';
import {Button,TextField} from '../widgets.js';
import {JigsawLevelsSlider} from '../jigsaw-slider.js';
import {tr} from '../i18n.js';
import {C} from '../../net/packets.js';
import {getStateProperties} from '../../world/blocks.js';
import {JIGSAW_LAYOUT as layout} from '../jigsaw-layout.js';
import {validJigsawResource,jigsawResource} from '../jigsaw-values.js';

export class JigsawScreen extends Screen {
  constructor(game,pos,data={}) {
    super(game);this.pos=pos;
    this.values={pool:String(data.pool??'minecraft:empty'),name:String(data.name??'minecraft:empty'),target:String(data.target??'minecraft:empty'),finalState:String(data.final_state??'minecraft:air')};
    const properties=getStateProperties(game.world.getState(pos.x,pos.y,pos.z));
    this.vertical=/^(up|down)_/.test(properties.orientation||'');
    this.joint=['rollable','aligned'].includes(data.joint)?data.joint:this.vertical?'rollable':'aligned';
    this.levels=0;this.keepJigsaws=true;
  }
  init() {
    const cx=Math.floor(this.width/2),field=(key,label,x,y,w,maxLength)=>{
      const text=this.values[key].slice(0,maxLength);this.values[key]=text;
      const f=new TextField(cx+x,y,w,20,{text,maxLength,onChange:value=>{this.values[key]=value;this.updateButtons();}});
      f.jigsawKey=key;f.jigsawLabel=label;this.fields.push(f);return f;
    };
    this.edits={};
    for(const [i,key]of ['pool','name','target','finalState'].entries())this.edits[key]=field(key,'jigsaw_block.'+(key==='finalState'?'final_state':key),layout.fieldX,20+i*35,300,key==='finalState'?256:128);
    this.edits.pool.focused=true;this.focusedWidget=this.edits.pool;
    const add=(id,x,y,w,label,fn)=>{const b=new Button(id,cx+x,y,w,20,label,fn);this.buttons.push(b);return b;};
    const jointLabelWidth=this.gui.textWidth(tr('jigsaw_block.joint_label'))+10;
    this.jointButton=add(2,-152+jointLabelWidth,150,300-jointLabelWidth,()=>tr('jigsaw_block.joint.'+this.joint),()=>{this.joint=this.joint==='rollable'?'aligned':'rollable';});
    this.jointButton.visible=this.jointButton.enabled=this.vertical;
    const y=180;
    this.levelSlider=new JigsawLevelsSlider(3,cx-154,y,100,20,()=>tr('jigsaw_block.levels',this.levels),this.levels/layout.maxLevels,value=>{this.levels=Math.floor(value*layout.maxLevels);});
    this.buttons.push(this.levelSlider);
    this.keepButton=add(4,-50,y,100,()=>tr('options.generic_value',tr('jigsaw_block.keep_jigsaws'),tr(this.keepJigsaws?'options.on':'options.off')),()=>{this.keepJigsaws=!this.keepJigsaws;});
    this.generateButton=add(5,54,y,100,tr('jigsaw_block.generate'),()=>this.generate());
    this.done=add(0,-154,210,150,tr('gui.done'),()=>this.save());
    this.cancelButton=add(1,4,210,150,tr('gui.cancel'),()=>this.close());
    this.updateButtons();
  }
  updateButtons() {
    if(!this.done)return;
    this.done.enabled=['pool','name','target'].every(key=>validJigsawResource(this.values[key]));
    if(layout.validateGenerate)this.generateButton.enabled=this.done.enabled;
  }
  sendUpdate() {
    const v=this.values;
    this.game.send(C.updateJigsaw(this.pos,jigsawResource(v.name),jigsawResource(v.target),jigsawResource(v.pool),v.finalState,this.joint,...(layout.priorities?[jigsawPriority(v.selectionPriority)(v.placementPriority)]:[])));
  }
  save() {if(!this.done.enabled)return;this.sendUpdate();this.close();}
  generate() {if(!this.generateButton.enabled)return;this.sendUpdate();this.close();this.game.send(C.generateStructure(this.pos,this.levels,this.keepJigsaws));}
  mouseDown(mx,my,button) {
    const handled=super.mouseDown(mx,my,button);
    if(button===0){
      const target=this.buttons.find(b=>b.visible&&b.enabled&&b.hovered(mx,my))||this.fields.find(f=>f.focused);
      if(target){for(const w of [...this.fields,...this.buttons])w.focused=w===target;this.focusedWidget=target;}
    }
    return handled;
  }
  key(e) {
    if(e.code==='Enter'||e.code==='NumpadEnter'){
      if(this.focusedWidget&&!this.fields.includes(this.focusedWidget)&&this.focusedWidget.key?.(e,this.game))return true;
      this.save();return true;
    }
    return super.key(e);
  }
  renderContent(gui) {
    const cx=Math.floor(this.width/2);
    for(const f of this.fields)gui.text(tr(f.jigsawLabel),cx-153,f.y-10,0xa0a0a0);
    if(this.vertical)gui.text(tr('jigsaw_block.joint_label'),cx-153,156,0xffffff);
  }
}
