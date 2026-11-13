import {PostChain} from './post.js';

// Exact 1.20.6 shaders/post/blur.json. The extra RadiusMultiplier properties in
// its BlurDir objects are ignored by native PostChain.parseUniformNode: only
// name/values are read. The program's multiplier therefore remains 1 throughout.
export const MENU_BLUR = {
  targets:['swap'],
  passes:Array.from({length:6},(_,i)=>({
    name:'box_blur',intarget:i%2?'swap':'minecraft:main',outtarget:i%2?'minecraft:main':'swap',
    use_linear_filter:true,uniforms:[{name:'BlurDir',values:i%2?[0,1]:[1,0]}],
  })),
};

export class MenuBlur {
  constructor(device){this.device=device;this.chain=null;}
  render(value){
    const radius=Math.max(0,Math.min(1,Number(value) || 0))*10;
    // GameRenderer.processBlurEffect skips the chain below one pixel.
    if(radius<1)return;
    const c=this.chain??=new PostChain(this.device,MENU_BLUR,{captureScreen:true});
    c._resize();
    this.device.captureColor(c.main);
    for(const pass of c.passes)pass.params[6]=radius;
    c.render();
  }
  destroy(){this.chain?.destroy();this.chain=null;}
}
