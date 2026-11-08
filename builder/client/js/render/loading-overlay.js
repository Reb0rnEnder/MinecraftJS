// Layouts verified against native startup splashes and 1.14+ LoadingOverlay.
export const LOADING_STYLE = 'square';
export const LOADING_LOGO = 'gui/title/mojang.png';
const clamp=v=>Math.max(0,Math.min(1,v));
export function loadingScale(width,height,setting=0){let scale=1;while(scale<(setting||1000)&&width/(scale+1)>=320&&height/(scale+1)>=240)scale++;return scale;}
export function loadingLayout(width,height){
 const studios=LOADING_STYLE==='studios',logoWidth=studios?Math.min(width*.75,height):256,logoHeight=studios?logoWidth/4:256;
 return {background:studios?[239/255,50/255,61/255]:[1,1,1],logo:[Math.floor(width/2)-Math.floor(logoWidth/2),Math.floor(height/2)-Math.floor(logoHeight/2),Math.floor(logoWidth/2)*2,Math.floor(logoHeight)],bar:studios?[Math.floor(width/2)-Math.floor(logoWidth/2),Math.floor(height*.8325)-5,Math.floor(width/2)+Math.floor(logoWidth/2),Math.floor(height*.8325)+5]:[Math.floor(width/2)-150,Math.floor(height/4)*3,Math.floor(width/2)+150,Math.floor(height/4)*3+10]};
}
export function loadingProgress(previous,target){return clamp(previous*.95+clamp(target)*.050000012);}
// [destination rect, UV rect]. Studios uses two atlas halves, with native +/- .0625 texel offsets.
export function loadingLogoQuads(layout){
 const [x,y,w,h]=layout.logo;
 return LOADING_STYLE==='studios'?[[x,y,w/2,h,-.0625/120,0,1-.0625/120,.5],[x+w/2,y,w/2,h,.0625/120,.5,1+.0625/120,1]]:[[x,y,w,h,0,0,1,1]];
}
export function loadingRects(layout,progress,alpha=1){
 if(LOADING_STYLE==='legacy')return [];
 const [x,y,r,b]=layout.bar,p=clamp(progress);
 if(LOADING_STYLE==='studios')return [[x+1,y,r-1,y+1,[1,1,1,alpha]],[x+1,b-1,r-1,b,[1,1,1,alpha]],[x,y,x+1,b,[1,1,1,alpha]],[r-1,y,r,b,[1,1,1,alpha]],[x+2,y+2,x+Math.ceil((r-x-2)*p),b-2,[1,1,1,alpha]]];
 const fade=1-alpha;
 return [[x-1,y-1,r+1,b+1,[fade,fade,fade,1]],[x,y,r,b,[1,1,1,1]],[x+1,y+1,x+Math.ceil((r-x-1)*p),b-1,[(226+29*fade)/255,(40+215*fade)/255,(55+200*fade)/255,1]]];
}
export function renderLoadingOverlay(gui,progress,{backgroundAlpha=1,logoAlpha=1,barAlpha=1}={}){
 const layout=loadingLayout(gui.width,gui.height),[r,g,b]=layout.background;
 gui.rect(0,0,gui.width,gui.height,((Math.ceil(backgroundAlpha*255)<<24)|(Math.round(r*255)<<16)|(Math.round(g*255)<<8)|Math.round(b*255))>>>0);
 const tex=gui.tex(LOADING_LOGO);
 if(tex){gui.setBlend(LOADING_STYLE==='studios'?'add':'alpha');for(const [x,y,w,h,u0,v0,u1,v1]of loadingLogoQuads(layout))gui.quad(tex,x,y,x+w,y+h,u0,v0,u1,v1,[1,1,1,logoAlpha]);gui.setBlend('alpha');}
 for(const [x,y,r,b,c]of loadingRects(layout,progress,barAlpha))if(r>x&&b>y)gui.rect(x,y,r,b,((Math.round(c[3]*255)<<24)|(Math.round(c[0]*255)<<16)|(Math.round(c[1]*255)<<8)|Math.round(c[2]*255))>>>0);
}
