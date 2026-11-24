// ClientBundleTooltip geometry and sprite coordinates from the native jar.
export function bundleTooltipLayout(data){const columns=Math.max(2,Math.ceil(Math.sqrt(data.items.length+1))),rows=Math.ceil((data.items.length+1)/columns);return{columns,rows,width:columns*18+2,height:rows*20+6};}
// Native 1.20.6 ClientBundleTooltip: the container/bundle/background sprite behind 18x20 slot sprites; when the
// bundle is full the empty slot shows container/bundle/blocked_slot. The first item gets the slot highlight.
export function drawBundleTooltip(gui,data,x,y){
 const{columns,rows}=bundleTooltipLayout(data),full=data.weight>=64;
 gui.sprite('container/bundle/background',x,y,columns*18+2,rows*20+2);
 for(let row=0,index=0;row<rows;row++)for(let column=0;column<columns;column++,index++){
  const px=x+column*18+1,py=y+row*20+1,item=data.items[index];
  gui.sprite(!item&&full?'container/bundle/blocked_slot':'container/bundle/slot',px,py,18,20);
  if(item){gui.itemRenderer?.drawItem(gui,item,px+1,py+1,true);if(index===0)gui.rect(px+1,py+1,px+17,py+17,0x80ffffff);}
 }
}
