import{test}from'node:test';import assert from'node:assert/strict';import{readFileSync}from'node:fs';import{trueTypeProvider}from'../client/js/gui/font-providers.js';
test('TTF skip filters a whole supplementary code point using a real format-12 cmap',()=>{
 // Reuse the rectangle fixture's glyph; give it a supplementary cmap entry.
 const bytes=Uint8Array.from(readFileSync(new URL('./fixtures/font-provider-test.ttf',import.meta.url))),v=new DataView(bytes.buffer);let offset;
 for(let i=0;i<v.getUint16(4);i++){const p=12+i*16;if(String.fromCharCode(...bytes.subarray(p,p+4))==='cmap')offset=v.getUint32(p+8);}
 assert.ok(offset);bytes.fill(0,offset,offset+44);v.setUint16(offset+2,1);v.setUint16(offset+4,3);v.setUint16(offset+6,10);v.setUint32(offset+8,12);v.setUint16(offset+12,12);v.setUint32(offset+16,28);v.setUint32(offset+24,1);v.setUint32(offset+28,0x1f600);v.setUint32(offset+32,0x1f600);v.setUint32(offset+36,1);
 const a={textures:new Map(),device:{updateTexture(){}},makeTexture:(_k,width,height,data)=>({width,height,data})};assert.equal(trueTypeProvider(a,{size:10},bytes,'emoji').get('😀').advance,6);assert.equal(trueTypeProvider(a,{size:10,skip:'😀'},bytes,'skip-emoji').get('😀'),null);
});
