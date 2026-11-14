import {test} from 'node:test';import assert from 'node:assert/strict';import mcassets from '../lib/mcassets.js';import {CreativeScreen} from '../client/js/gui/screens/containers.js';
test('creative tab icons keep stable stack identity until the icon definition is replaced',()=>{
 const seen=[],screen={game:{itemRenderer:{drawItem(gui,stack){seen.push(stack);}}},_tabRect:()=>({x:0,y:0,top:true,col:0})},gui={blit(){},sprite(){}},tab=mcassets.MC_VERSION==='1.8.9'?0:{icon:[1,0,null]};
 CreativeScreen.prototype._drawTab.call(screen,gui,tab,false);CreativeScreen.prototype._drawTab.call(screen,gui,tab,true);assert.equal(seen[0],seen[1]);
 if(typeof tab==='object'){tab.icon=[2,0,null];CreativeScreen.prototype._drawTab.call(screen,gui,tab,false);assert.notEqual(seen[2],seen[0]);assert.equal(seen[2].id,2);}
});
