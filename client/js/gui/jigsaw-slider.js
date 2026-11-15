import {Slider} from './widgets.js';
import {JIGSAW_LAYOUT as layout} from './jigsaw-layout.js';

// AbstractSliderButton: keyboard changes use a float step; modern Enter toggles editing.
export class JigsawLevelsSlider extends Slider {
  get focused(){return !!this._focused;}
  set focused(value){this._focused=value;this.canChangeValue=!!value;}
  key(e) {
    if(!this.enabled||!this.visible)return false;
    if(layout.sliderToggle&&['Enter','NumpadEnter','Space'].includes(e.code)){this.canChangeValue=!this.canChangeValue;return true;}
    if(layout.sliderToggle&&!this.canChangeValue)return false;
    if(!['ArrowLeft','ArrowRight'].includes(e.code))return false;
    const next=Math.max(0,Math.min(1,this.value+Math.fround((e.code==='ArrowRight'?1:-1)/(this.w-8))));
    if(next!==this.value){this.value=next;this.onChange(next);}
    return !!layout.sliderToggle;
  }
  mouseDown(mx,my,game) {
    if(!this.visible||!this.enabled||!this.hovered(mx,my))return false;
    this.dragging=true;this._set(mx);this.releaseGame=game;return true;
  }
  mouseUp() {
    if(this.dragging)this.releaseGame?.sound.playUi('ui.button.click',1);
    this.dragging=false;this.releaseGame=null;
  }
}
