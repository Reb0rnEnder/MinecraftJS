import{test}from'node:test';import assert from'node:assert/strict';import{Assets}from'../client/js/assets.js';import{encodePng}from'../client/js/util/png.js';
test('standalone resource images keep ResourceLocation namespaces through asynchronous loading and caching',async()=>{
 const png=encodePng(1,1,Uint8Array.from([12,34,56,255])),calls=[],a=Object.assign(Object.create(Assets.prototype),{version:1,images:new Map(),imageLoads:new Map(),readBytes:async n=>{calls.push(n);return png;},readResourceBytes:async n=>{calls.push(n);return png;}});
 const custom=await a.imageAsync('custom:entity/banner/design.png');assert.deepEqual(calls,['custom:textures/entity/banner/design.png']);assert.deepEqual([...custom.data],[12,34,56,255]);assert.equal(await a.imageAsync('custom:entity/banner/design.png'),custom);assert.equal(calls.length,1);
 await a.imageAsync('entity/banner/base.png');assert.equal(calls[1],'textures/entity/banner/base.png');await a.imageAsync('minecraft:entity/banner/base.png');assert.equal(calls[2],'minecraft:textures/entity/banner/base.png');
});
