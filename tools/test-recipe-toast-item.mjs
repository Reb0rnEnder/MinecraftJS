import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Hud} from '../client/js/gui/hud.js';
test('recipe toast resolves its crafting-table icon through the current native item registry',()=>{
 const draws=[],hud={game:{items:{byName:new Map([['crafting_table',{id:923}]])},itemRenderer:{drawItem:(gui,item)=>draws.push(item)}}};
 const gui={blit(){},text(){},pushMatrix(){},scaleBy(){},popMatrix(){}};
 Hud.prototype._drawRecipeToast.call(hud,gui,{recipes:[{result:{id:11,data:0}}]},0);
 assert.equal(draws[0].id,923);assert.equal(draws[1].id,11);
});
