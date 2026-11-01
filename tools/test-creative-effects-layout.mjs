import {test} from 'node:test';import assert from 'node:assert/strict';import {drawModernEffects} from '../client/js/gui/screens/containers.js';
function scene(width){const calls=[],g={effects:new Map([[1,{duration:200,amplifier:0}]]),items:{effects:{1:{key:'minecraft:speed',color:123}}},assets:{data:{creative:{effects:{1:{key:"minecraft:speed"}}}},translate:k=>k}},gui={width,blit:(...a)=>calls.push(a),text(){},tex:()=>null,tooltip:(...a)=>calls.push(['tooltip',...a])},screen={guiLeft:100,guiTop:40,xSize:195};return{g,gui,screen,calls};}
test('native right-side effect panels use wide, compact or hidden geometry without shifting the creative inventory',()=>{
 for(const[width,panelWidth,v]of[[500,120,166],[360,32,198]]){const s=scene(width);drawModernEffects(s.g,s.gui,s.screen,0,0);assert.deepEqual(s.calls[0],['gui/container/inventory.png',297,40,0,v,panelWidth,32]);assert.equal(s.screen.guiLeft,100);}
 const s=scene(320);drawModernEffects(s.g,s.gui,s.screen,0,0);assert.equal(s.calls.length,0);
 const compact=scene(360);drawModernEffects(compact.g,compact.gui,compact.screen,300,45);assert.equal(compact.calls[1][0],'tooltip');
});
