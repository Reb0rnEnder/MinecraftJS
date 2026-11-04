// Native 1.19.4 SystemToast.multiline and ToastComponent slot allocation.
export function multilineToast(gui,kind,title,message,duration=5000){
 const lines=gui.font.wrap(message,200);
 return{type:'system',kind,title,subtitle:message,lines,width:Math.max(200,...lines.map(line=>gui.textWidth(line)))+30,height:20+Math.max(1,lines.length)*12,duration,hasNew:true};
}
export function fillToastSlots(toasts,queue){
 const occupied=Array(5).fill(false);
 for(let i=0;i<toasts.length;i++)if(toasts[i])for(let j=0;j<Math.ceil((toasts[i].toast.height||32)/32)&&i+j<5;j++)occupied[i+j]=true;
 while(queue.length){const slots=Math.ceil((queue[0].height||32)/32);let found=-1;for(let i=0;i+slots<=5;i++)if(occupied.slice(i,i+slots).every(v=>!v)){found=i;break;}if(found<0)break;
  toasts[found]={toast:queue.shift(),animationTime:-1,visibleTime:-1,visibility:'show'};for(let j=0;j<slots;j++)occupied[found+j]=true;
 }
}
export function drawMultilineToast(gui,toast){
 const width=toast.width,height=toast.height,bottom=Math.min(4,height-28);
 const row=(uvY,y,h)=>{const left=uvY===0?20:5,right=Math.min(60,width-left);gui.blit('gui/toasts.png',0,y,0,64+uvY,left,h);for(let x=left;x<width-right;x+=64)gui.blit('gui/toasts.png',x,y,32,64+uvY,Math.min(64,width-x-right),h);gui.blit('gui/toasts.png',width-right,y,160-right,64+uvY,right,h);};
 row(0,0,28);for(let y=28;y<height-bottom;y+=10)row(16,y,Math.min(16,height-y-bottom));row(32-bottom,height-bottom,bottom);
 gui.text(toast.title,18,7,0xffff00,false);toast.lines.forEach((line,i)=>gui.text(line,18,18+i*12,0xffffff,false));
}
