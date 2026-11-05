import {test} from 'node:test';import assert from 'node:assert/strict';
import {memorySnapshot} from '../client/js/debug/memory-snapshot.js';
import {createGpuTimer} from '../client/js/debug/gpu-timer.js';
test('memory snapshot deduplicates shared buffers and counts current terrain/upload capacity',()=>{
 const blocks=new Uint16Array(4096),light=new Uint8Array(2048),biomes=new Uint32Array(64),heightMap=new Int32Array(256),upload=new Uint8Array(100),mesh={byteLength:800,vertexCount:40};
 const nativeLight={sky:[light],block:[]},g={world:{chunks:new Map([[0,{sections:[{blocks,skyLight:light,blockLight:light}],nativeLight,biomes,heightMap}]]),lightColumns:new Map([[0,nativeLight]])},renderer:{sections:new Map([[0,{solid:mesh,cutout:mesh}]])},_meshUploads:[{solid:upload,cutout:upload.subarray(0,5)}],worker:{size:6}};
 const s=memorySnapshot(g);assert.equal(s.world.blockBytes,8192);assert.equal(s.world.lightBytes,2048);assert.equal(s.world.knownBufferBytes,11520);assert.equal(s.terrain.vertexBufferBytes,800);assert.equal(s.terrain.meshes,1);assert.equal(s.pendingUploadBytes,100);assert.equal(s.meshWorkers,6);
});
function gpu(){let active=null,id=0,disjoint=false,available=false;const deleted=[],ext={GPU_DISJOINT_EXT:1,TIME_ELAPSED_EXT:2},gl={QUERY_RESULT_AVAILABLE:3,QUERY_RESULT:4,CURRENT_QUERY:5,getExtension:()=>ext,getParameter:()=>disjoint,getQuery:()=>active,createQuery:()=>++id,beginQuery:(t,q)=>{assert.equal(active,null);active=q;},endQuery:()=>active=null,deleteQuery:q=>deleted.push(q),getQueryParameter:(q,p)=>p===3?available:2500000};return{timer:createGpuTimer({gl},true),deleted,setDisjoint:v=>disjoint=v,setAvailable:v=>available=v,external:q=>active=q};}
test('GPU timer polls asynchronously, caps pending queries and discards disjoint samples',()=>{
 const g=gpu();for(let i=0;i<20;i++){g.timer.begin();g.timer.end();}assert.equal(g.timer.snapshot().pending,8);
 g.setAvailable(true);g.timer.begin();g.timer.end();assert.equal(g.timer.snapshot().samplesMs.length,8);assert.equal(g.timer.snapshot().samplesMs[0],2.5);
 g.setDisjoint(true);g.timer.begin();assert.equal(g.timer.snapshot().discarded,1);g.timer.stop();assert.equal(g.timer.snapshot().pending,0);assert.equal(g.deleted.length,9);
});
test('unsupported and existing GPU queries are left alone; active query cleans up on stop',()=>{
 const t=createGpuTimer({},true);t.begin();t.end();t.stop();assert.equal(t.snapshot().supported,false);
 const g=gpu();g.external('other');g.timer.begin();assert.equal(g.timer.snapshot().pending,0);g.external(null);g.timer.begin();g.timer.stop();assert.equal(g.deleted.length,1);
});

import {Game} from '../client/js/game/game.js';import {setPlatform} from '../client/js/platform/platform.js';
test('console microprofiler works without a module URL and restores its hooks',()=>{setPlatform({now:()=>0});const g={settings:{},renderFrame:()=>17},original=g.renderFrame,c=Game.prototype.microprofile.call(g,{gpu:true});assert.equal(g.renderFrame(),17);const report=c.stop();assert.equal(report.frameCount,1);assert.equal(report.gpu.supported,false);assert.equal(g.renderFrame,original);});
