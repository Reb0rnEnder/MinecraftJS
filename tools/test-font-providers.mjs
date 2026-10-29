import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {ZipFile} from '../lib/zip.js';
import {decodePng} from '../client/js/util/png.js';
import {FontRenderer} from '../client/js/gui/font.js';
import {Game} from '../client/js/game/game.js';
import {buildTextMeshes} from '../client/js/render/text-mesh.js';
import {loadFontSets,trueTypeProvider,bitmapProvider,FontSet} from '../client/js/gui/font-providers.js';
import mcassets from '../lib/mcassets.js';
const jar=new ZipFile(await mcassets.locateJar());
function assets(){const a={version:1,packs:[],textures:new Map(),source:{bytes:async name=>jar.read('assets/'+name)},image:()=>null,texture:()=>null,
 device:{updateTexture:(tex,data,x,y,w,h)=>{tex.upload={data,x,y,w,h};}},makeTexture:(key,width,height,data)=>{const tex={width,height,data};a.textures.set(key,tex);return tex;}};return a;}

test('real default font JSON resolves accented and non-Latin sheets before old ASCII/Unicode fallback',async()=>{
 const a=assets();a.fontSets=await loadFontSets(a);const f=new FontRenderer({assets:a});
 for(const [ch,path,y] of [['ą','font/accented.png',-3],['Ł','font/accented.png',-3],['Ж','font/nonlatin_european.png',0],['→','font/nonlatin_european.png',0]]){
  const g=a.fontSets.default.glyph(ch);assert.equal(g.y,y,ch);const q=f.layout(ch,0,0,0xffffff,false).quads[0];assert.ok(q,ch);assert.deepEqual(q.tex.data,decodePng(jar.read('assets/minecraft/textures/'+path)).data);assert.equal(f.width(ch),g.advance);
 }
 const meshes=buildTextMeshes({createMesh:(_f,data)=>({data})},f,[{text:'§oą',x:0,y:0}]);assert.equal(meshes[0].mesh.data[0],1.75,'italic tilt uses the text baseline, including tall accented glyphs');
 const normal=f.width('Polski: ąęółżźćń');assert.ok(normal>0);assert.equal(f.layout('ą',0,0,0xffffff,false).quads[0].y0,-3);
 const game={gui:{font:f},assets:{langUnicode:true,langBidi:false},settings:{forceUnicodeFont:false}};Game.prototype.applyLanguage.call(game);assert.equal(f.unicode,false,'locale statistics must not bypass bitmap providers');
 game.settings.forceUnicodeFont=true;Game.prototype.applyLanguage.call(game);assert.equal(f.unicode,true);assert.equal(a.fontSets.default.glyph('ą',true).boldOffset,.5);
 assert.equal(f.width('§lą'),Math.ceil(a.fontSets.default.glyph('ą',true).advance+.5));
});

test('resource-pack font definitions add providers ahead of base definitions and survive reloads',async()=>{
 const a=assets(),def=JSON.parse(jar.read('assets/minecraft/font/default.json'));
 const bitmap=def.providers.find(p=>p.file?.endsWith('ascii.png'));const p={type:'bitmap',file:'minecraft:font/ascii.png',height:8,ascent:5,chars:bitmap.chars};
 const bytes=new TextEncoder().encode(JSON.stringify({providers:[p]}));
 a.packs=[{id:'font-test',has:path=>path==='font/default.json',read:()=>bytes}];a.fontSets=await loadFontSets(a);
 assert.equal(a.fontSets.default.glyph('A').y,2);assert.equal(a.fontSets.default.glyph('ą').y,-3,'base provider fallback retained');
 const font=new FontRenderer({assets:a});assert.equal(font.layout('A',0,0,0xffffff,false).quads[0].y0,2);
 a.packs=[];a.version++;a.fontSets=await loadFontSets(a);assert.equal(font.layout('A',0,0,0xffffff,false).quads[0].y0,0);
});

test('TTF provider uses real stb metrics/pixels, fractional advances, oversampling, shift and skip',()=>{
 const a=assets(),bytes=readFileSync(new URL('./fixtures/font-provider-test.ttf',import.meta.url));
 const p=trueTypeProvider(a,{size:10},bytes,'test-ttf'),g=p.get('A');assert.ok(g);assert.equal(g.advance,6);assert.equal(g.width,5);assert.equal(g.height,7);
 const tex=g.texture();assert.equal(tex.upload.w,5);assert.equal(tex.upload.h,7);assert.ok(tex.upload.data.every(v=>v===255),'solid rectangle font fixture rasterizes exactly');
 assert.equal(p.get('B'),null);assert.equal(trueTypeProvider(a,{size:10,skip:['A']},bytes,'skip').get('A'),null);
 const large=trueTypeProvider(a,{size:10,oversample:2,shift:[1,2]},bytes,'large').get('A');assert.equal(large.width,5);assert.equal(large.height,7);assert.equal(large.advance,6);assert.notEqual(large.x,g.x);assert.notEqual(large.y,g.y);
 const scaled=trueTypeProvider(a,{size:11},bytes,'fraction').get('A');assert.ok(Math.abs(scaled.advance-6.6)<1e-5);
 a.fontSets={default:new FontSet(a,[p])};const f=new FontRenderer({assets:a});assert.equal(f.width('AAA'),18);assert.equal(f.layout('§lA',0,0,0xffffff,true).quads.length,4);assert.equal(f.width('§lA'),7);
 assert.throws(()=>trueTypeProvider(a,{size:-1},bytes,'bad'),/Invalid TTF/);assert.throws(()=>trueTypeProvider(a,{},new Uint8Array(8),'bad'),/Invalid TTF/);
});

test('bitmap dimensions, ascent and ink widths are independent of texture resolution',()=>{
 const a=assets(),data=new Uint8Array(16*24*4);for(let y=0;y<24;y++)for(let x=0;x<10;x++)data[(y*16+x)*4+3]=255;
 const g=bitmapProvider(a,{chars:['A'],height:12,ascent:10},{width:16,height:24,data},'scale').get('A');assert.equal(g.advance,6);assert.equal(g.width,8);assert.equal(g.height,12);assert.equal(g.y,-3);
});


test('bitmap rows and text metrics use Unicode code points rather than surrogate halves',()=>{
 const a=assets(),data=new Uint8Array(16*16*4).fill(255);
 const p=bitmapProvider(a,{chars:['A😀','BC'],height:8,ascent:7},{width:16,height:16,data},'supplementary');
 assert.ok(p.get('😀'));assert.equal(p.get('\ud83d'),null);
 a.fontSets={default:new FontSet(a,[p])};const f=new FontRenderer({assets:a});
 assert.equal(f.width('😀'),9);assert.equal(f.layout('😀',0,0,0xffffff,false).quads.length,1);
 assert.deepEqual(f.wrap('😀😀',9),['😀','😀']);
});
