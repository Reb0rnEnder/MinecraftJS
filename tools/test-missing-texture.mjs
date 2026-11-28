// MissingTextureAtlasSprite: every atlas carries "missingno" (16x16 magenta/black checkerboard) and unknown sprite
// names resolve to it instead of another block's texture.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Atlas,AtlasLookup,MISSING_SPRITE} from '../client/js/render/atlas.js';
test('unknown sprites use the native missingno checkerboard',()=>{
  const a=new Atlas();a.build([{name:'block/dirt',image:{width:16,height:16,data:new Uint8Array(1024).fill(200)}}],{});
  const e=a.entries.get(MISSING_SPRITE),px=(x,y)=>[...a.data.subarray(((e.y+y)*a.size+e.x+x)*4,((e.y+y)*a.size+e.x+x)*4+4)];
  assert.deepEqual([px(0,0),px(8,0),px(0,8),px(15,15)],[[0,0,0,255],[248,0,248,255],[248,0,248,255],[0,0,0,255]]);
  assert.deepEqual(a.uv('block/not_a_texture'),e.uv);assert.notDeepEqual(a.uv('block/dirt'),e.uv);
  assert.deepEqual(new AtlasLookup(a.exportLookup()).uv('nope'),e.uv);
});
