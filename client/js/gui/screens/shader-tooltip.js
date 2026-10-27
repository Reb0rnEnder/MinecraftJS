import {platform} from '../../platform/platform.js';
// OptiFine 1.15.2 G6 TooltipManager / TooltipProviderOptions coordinates.
export function drawShaderTooltip(screen,gui,mx,my){
 const now=platform().now(),last=screen.tooltipMouse;
 if(!last||Math.abs(mx-last.x)>5||Math.abs(my-last.y)>5){screen.tooltipMouse={x:mx,y:my,time:now};return;}
 if(now-last.time<700)return;
 const hovered=screen.buttons.find(b=>b.visible&&b.hovered(mx,my)),option=hovered?.option,description=option?.description||hovered?.description;
 if(!option&&!description)return;
 const text=[option?.label||hovered.label,...(description||'').replace(/^\/\//,'').trim().split(/\. /).filter(Boolean).map(s=>'- '+s.replace(/\.$/,''))];
 let lines=text.flatMap(line=>gui.font.wrap(line,300));if(lines.length>8){lines=lines.slice(0,8);lines[7]+=' ...';}
 const x=Math.floor(screen.width/2)-150;let y=Math.floor(screen.height/6)-7;if(my<=y+98)y+=105;
 gui.rect(x,y,x+300,y+94,0xe0000000);
 lines.forEach((line,i)=>gui.text(line,x+5,y+5+i*11,line.endsWith('!')?0xff2020:0xdddddd,true));
}
