// Display entities (native Display / DisplayRenderer, 1.19.4+): synced-data defaults, the client-tick update
// flags, interpolation progress and the transformation/billboard matrices.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {NATIVE_METADATA} from '../client/js/game/entity-metadata-1.19.4.js';
import {initDisplay,applyDisplayMeta,tickDisplay,displayProgress,lerpTransformation,transformationMatrix,orientationMatrix,billboardAngles,lerpInt,lerpColor,textStyle} from '../client/js/game/display-entity.js';

const ids=NATIVE_METADATA.block_display,tids=NATIVE_METADATA.text_display;
const legacy=ids.DATA_INTERPOLATION_DURATION_ID!==undefined,START=ids.DATA_TRANSFORMATION_INTERPOLATION_START_DELTA_TICKS_ID??ids.DATA_INTERPOLATION_START_DELTA_TICKS_ID,DURATION=ids.DATA_TRANSFORMATION_INTERPOLATION_DURATION_ID??ids.DATA_INTERPOLATION_DURATION_ID;
const close=(a,b,msg)=>a.forEach((v,i)=>assert.ok(Math.abs(v-b[i])<1e-6,(msg||'')+' index '+i+': '+v+' vs '+b[i]));
const apply=(m,v)=>({x:m[0]*v[0]+m[4]*v[1]+m[8]*v[2]+m[12],y:m[1]*v[0]+m[5]*v[1]+m[9]*v[2]+m[13],z:m[2]*v[0]+m[6]*v[1]+m[10]*v[2]+m[14]});

test('native defaults; render state timing per release, and zero-size displays never cull',()=>{
 const e={kind:'display'};initDisplay(e,ids);
 assert.equal(!!e.display.renderState,legacy);assert.equal(e.noCulling,true);assert.equal(e.display.viewRange,1);assert.equal(e.display.lineWidth,200);assert.equal(e.display.background,0x40000000);
 applyDisplayMeta(e,{[ids.DATA_WIDTH_ID]:2,[ids.DATA_HEIGHT_ID]:1,[ids.DATA_TRANSLATION_ID]:{x:0,y:1,z:0}},ids);
 assert.equal(e.noCulling,false);if(!legacy)assert.equal(e.display.updateRenderState,true);
 tickDisplay(e);assert.deepEqual(e.display.renderState.transformation.to.t,[0,1,0]);assert.deepEqual(e.display.renderState.transformation.from.t,[0,1,0],'first data snaps');
});

test('interpolation starts at tickCount + start delta, runs for the duration and continues from the shown value',()=>{
 const e={kind:'display'};initDisplay(e,ids);tickDisplay(e);
 if(legacy)assert.ok(e.display.renderState,'1.19.4 interpolators exist from construction');else assert.equal(e.display.renderState,null,'1.20.2+: nothing synced, no render state');
 applyDisplayMeta(e,{[ids.DATA_TRANSLATION_ID]:{x:0,y:0,z:0}},ids);tickDisplay(e);
 applyDisplayMeta(e,{[START]:0,[DURATION]:10,[ids.DATA_TRANSLATION_ID]:{x:0,y:10,z:0}},ids);
 tickDisplay(e);const start=e.display.startTick;assert.equal(start,e.display.ticks);
 assert.equal(displayProgress(e,0),0);
 for(let i=0;i<4;i++)tickDisplay(e);
 assert.equal(displayProgress(e,0.5),Math.fround(4.5/10));
 assert.deepEqual(e.display.renderState.transformation.from.t,[0,0,0]);const shown=lerpTransformation(e.display.renderState.transformation,e.display.lastProgress).t[1];assert.ok(Math.abs(shown-4.5)<1e-5,'shown '+shown);
 // a new target mid-way starts from what was on screen
 applyDisplayMeta(e,{[START]:0,[ids.DATA_TRANSLATION_ID]:{x:0,y:0,z:0}},ids);tickDisplay(e);
 assert.ok(Math.abs(e.display.renderState.transformation.from.t[1]-4.5)<1e-5);
 for(let i=0;i<20;i++)tickDisplay(e);assert.equal(displayProgress(e,0),1);
 const zero={kind:'display'};initDisplay(zero,ids);tickDisplay(zero);assert.equal(displayProgress(zero,0.3),1,'no duration: always complete');
});

test('Transformation.getMatrix applies translation, left rotation, scale, right rotation; billboards pick camera angles',()=>{
 const s=Math.SQRT1_2,m=transformationMatrix({t:[1,2,3],l:[0,s,0,s],s:[2,1,1],r:[0,0,0,1]});
 const p=apply(m,[1,0,0]);close([p.x,p.y,p.z],[1,2,1],'90 degree yaw then scale 2 on x');
 assert.deepEqual(billboardAngles(0,30,10,200,-20),[30,10]);assert.deepEqual(billboardAngles(1,30,10,200,-20),[20,10]);
 assert.deepEqual(billboardAngles(2,30,10,200,-20),[30,20]);assert.deepEqual(billboardAngles(3,30,10,200,-20),[20,20]);
 const o=orientationMatrix(90,0),q=apply(o,[0,0,1]);close([q.x,q.y,q.z],[-1,0,0],'rotationYXZ(-yaw): yaw 90 turns +z to -x');
});

test('text opacity and background colour interpolate like Mth.lerpInt and ARGB32.lerp; style flags decode',()=>{
 assert.equal(lerpInt({from:-1,to:99},0.5),49);
 assert.equal(lerpColor({from:0x00000000,to:0xff102030|0},0.5)>>>0,0x7f081018);
 assert.deepEqual(textStyle(1|2|4|8),{shadow:true,seeThrough:true,defaultBackground:true,align:'left'});
 assert.equal(textStyle(16).align,'right');assert.equal(textStyle(0).align,'center');
 const e={kind:'display'};initDisplay(e);applyDisplayMeta(e,{[tids.DATA_TEXT_ID]:'hi',[tids.DATA_TEXT_OPACITY_ID]:100},tids);tickDisplay(e);
 assert.equal(e.display.renderState.text,'hi');assert.equal(e.display.renderState.textOpacity.to,100);
});
