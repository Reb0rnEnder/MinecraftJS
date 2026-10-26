// Native camera eye-height easing. Gameplay rays/collision use the unsmoothed entity eye.
export class CameraEye {
  constructor(){this.current=null;this.previous=null;}
  reset(){this.current=this.previous=null;}
  tick(height){
    height=Math.fround(height);
    if(this.current===null)this.current=this.previous=height;
    else {this.previous=this.current;this.current=Math.fround(this.current+Math.fround(Math.fround(height-this.current)*.5));}
  }
  height(partial,target){
    if(this.current===null)this.tick(target);
    return this.previous+(this.current-this.previous)*partial;
  }
}
