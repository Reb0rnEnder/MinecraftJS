// ClientBundleTooltip geometry and sprite coordinates from the native jar.
export function bundleTooltipLayout(data){const columns=Math.max(2,Math.ceil(Math.sqrt(data.items.length+1))),rows=Math.ceil((data.items.length+1)/columns);return{columns,rows,width:columns*18+2,height:rows*20+6};}
export function drawBundleTooltip(gui,data,x,y){
 const{columns,rows}=bundleTooltipLayout(data),texture='gui/container/bundle.png',blit=(px,py,u,v,w,h)=>gui.blit(texture,px,py,u,v,w,h,128,128);
 for(let row=0,index=0;row<rows;row++)for(let column=0;column<columns;column++,index++){
  const px=x+column*18+1,py=y+row*20+1,item=data.items[index];blit(px,py,0,!item&&data.weight>=64?40:0,18,20);
  if(item){gui.itemRenderer?.drawItem(gui,item,px+1,py+1,true);if(index===0)gui.rect(px+1,py+1,px+17,py+17,0x80ffffff);}
 }
 blit(x,y,0,20,1,1);blit(x+columns*18+1,y,0,20,1,1);
 for(let column=0;column<columns;column++){blit(x+1+column*18,y,0,20,18,1);blit(x+1+column*18,y+rows*20,0,60,18,1);}
 for(let row=0;row<rows;row++){blit(x,y+row*20+1,0,18,1,20);blit(x+columns*18+1,y+row*20+1,0,18,1,20);}
 blit(x,y+rows*20,0,60,1,1);blit(x+columns*18+1,y+rows*20,0,60,1,1);
}
