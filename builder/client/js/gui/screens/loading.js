import {Screen} from './manager.js';
import {platform} from '../../platform/platform.js';
import {renderLoadingOverlay,loadingProgress} from '../../render/loading-overlay.js';
// Native reload overlay: .5 s fade-in, smoothed progress, then two-stage 2 s fade-out.
export class ResourceLoadingScreen extends Screen{
 constructor(game,parent,{startup=false,progress=0}={}){super(game);this.parent=parent;this.startup=startup;this.progress=progress;this.pct=progress*100;this.startedAt=platform().now();}
 init(){if(this.parent){this.parent.buttons=[];this.parent.fields=[];this.parent.init();}}
 finish(){this.pct=100;this.completedAt=platform().now();return new Promise(resolve=>this.resolve=resolve);}
 render(gui,mx,my,partial){
  const now=platform().now(),fadeIn=this.startup?1:Math.min(1,(now-this.startedAt)/500),out=this.completedAt===undefined?-1:(now-this.completedAt)/1000;
  if((fadeIn<1||out>=1)&&this.parent)this.parent.render(gui,0,0,partial);
  this.progress=loadingProgress(this.progress,this.pct/100);
  const alpha=out>=1?Math.max(0,2-out):1;
  renderLoadingOverlay(gui,this.progress,{backgroundAlpha:out>=1?alpha:Math.max(.15,fadeIn),logoAlpha:out>=1?alpha:fadeIn,barAlpha:out<0?1:Math.max(0,1-out)});
  if(out>=2&&this.resolve){const resolve=this.resolve;this.resolve=null;resolve();}
 }
 key(){return true;}mouseDown(){return true;}char(){return true;}close(){}
 onClose(){if(this.resolve){this.resolve();this.resolve=null;}}
}
