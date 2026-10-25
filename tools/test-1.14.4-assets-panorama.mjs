import assert from 'node:assert/strict';import {test} from 'node:test';import {createHash} from 'node:crypto';
import {readDefaultAsset,indexedClientAssets,builtAssetsMatch} from '../lib/asset-layers.js';
import {FolderSource} from '../client/js/asset-source.js';import {setPlatform} from '../client/js/platform/platform.js';import {Renderer} from '../client/js/render/renderer.js';
import mcassets from '../lib/mcassets.js';import {ZipFile} from '../lib/zip.js';
test('indexed default resources override jar leftovers; unindexed resources still use the jar',async()=>{
 const calls=[],jar={read:name=>{calls.push(name);return new Uint8Array([1]);}},index={objects:{'minecraft/textures/test.png':{}},read:async()=>new Uint8Array([2])};
 assert.deepEqual(await readDefaultAsset(jar,index,'minecraft/textures/test.png'),new Uint8Array([2]));assert.equal(calls.length,0);
 assert.deepEqual(await readDefaultAsset(jar,index,'minecraft/textures/other.png'),new Uint8Array([1]));
 assert.deepEqual(indexedClientAssets({objects:{'minecraft/textures/gui/title/background/panorama_0.png':{},'minecraft/sounds/test.ogg':{},'minecraft/resourcepacks/programmer_art.zip':{},'realms/lang/en.json':{}}}),['minecraft/textures/gui/title/background/panorama_0.png','minecraft/sounds/test.ogg']);
});
test('stale or unversioned extracted assets cannot shadow the native asset index',()=>{
 assert.equal(builtAssetsMatch({},'1.14.4','hash','1.14'),false);assert.equal(builtAssetsMatch({layoutVersion:2,minecraftVersion:'1.13.2',clientJarSha1:'hash',assetIndex:'1.14'},'1.14.4','hash','1.14'),false);
 assert.equal(builtAssetsMatch({layoutVersion:2,minecraftVersion:'1.14.4',clientJarSha1:'hash',assetIndex:'1.14'},'1.14.4','hash','1.14'),true);
});
test('folder asset requests use a new cache identity for corrected indexed textures and bundles',async()=>{
 const urls=[];setPlatform({fetchBytes:async u=>{urls.push(u);return new Uint8Array();},fetchJson:async u=>{urls.push(u);return {};}});
 const source=new FolderSource();await source.bytes('minecraft/textures/gui/title/background/panorama_0.png');await source.models();await source.recipes();await source.entityModels();
 assert.ok(urls.every(u=>u.endsWith('?v=1.14.4-indexed-v2')));
});
test('native 1.14 panorama renders full resolution with four passes and 85-degree projection',()=>{
 const draws=[],globals=[],requests=[],device={createMesh:(_f,data)=>({data}),beginFrame(){},setGlobals:g=>globals.push(g),draw:d=>draws.push({...d,alpha:d.params[3]})};
 const r=Object.create(Renderer.prototype);r.device=device;r.assets={texture:(name,opts)=>{requests.push([name,opts]);return {};}};
 setPlatform({width:960,height:640,potato:false});r.renderPanorama(0);assert.equal(draws.length,24);assert.equal(globals.length,4);assert.equal(requests.length,6);assert.ok(requests.every(([,o])=>o.filter==='linear'));
 assert.ok(Math.abs(globals[0].proj[5]-1/Math.tan(85*Math.PI/360))<1e-5);assert.deepEqual([0,6,12,18].map(i=>draws[i].alpha).map(a=>Math.round(a*255)),[255,127,85,63]);
});
test('all six native village panorama faces resolve to asset-index hashes rather than jar leftovers',async()=>{
 const index=await mcassets.loadAssetIndex(),jar=new ZipFile(await mcassets.locateJar());
 for(let i=0;i<6;i++){const name='minecraft/textures/gui/title/background/panorama_'+i+'.png',b=await readDefaultAsset(jar,index,name);assert.equal(createHash('sha1').update(b).digest('hex'),index.objects[name].hash);assert.notEqual(createHash('sha1').update(jar.read('assets/'+name)).digest('hex'),index.objects[name].hash);}
});
