// Glowing entity outlines: Entity.getTeamColor (team colour by player name or entity UUID, else white; display
// glow overrides), which layers have RenderType.outline, and the flat-colour outline material.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {outlineColor,EntityOutline} from '../client/js/render/entity-outline.js';
import {EntityParams} from '../client/js/gfx/device.js';

const game=(teams)=>({scoreboard:{playerTeam:new Map(teams)}});
test('team colours by player name or entity UUID, white without a coloured team, display glow override first',()=>{
 const red={color:12},blue={color:9},none={color:21};
 assert.equal(outlineColor(game([['Steve',red]]),{kind:'player',name:'Steve'}),0xff5555);
 assert.equal(outlineColor(game([['0f04-uuid',blue]]),{kind:'mob',uuid:'0f04-uuid'}),0x5555ff);
 assert.equal(outlineColor(game([['x',none]]),{kind:'mob',uuid:'x'}),0xffffff,'reset colour');
 assert.equal(outlineColor(game([]),{kind:'mob',uuid:'y'}),0xffffff);
 assert.equal(outlineColor(game([['z',red]]),{kind:'display',uuid:'z',display:{glowColor:0x123456}}),0x123456);
 assert.equal(outlineColor(game([['z',red]]),{kind:'display',uuid:'z',display:{glowColor:-1}}),0xff5555);
});
test('only entity layers without additive blending are outlined; the outline material is flat, unlit and ignores depth',()=>{
 const p=new EntityParams();
 assert.equal(EntityOutline.outlines({mat:{pipeline:'entity',params:p,state:{blend:'alpha'}}}),true);
 assert.equal(EntityOutline.outlines({mat:{pipeline:'entity',params:p,state:{blend:'add'}}}),false,'glint/eyes');
 assert.equal(EntityOutline.outlines({mat:{pipeline:'color',params:[],state:{}}}),false,'name tags and shadows');
 const o=new EntityOutline({}),m=o._material({pipeline:'entity',tex:'x.png',params:p,state:{cull:true}},0xff5555);
 assert.deepEqual([...m.params.p.slice(4,8)].map(v=>Math.round(v*255)),[255,85,85,255]);assert.equal(m.params.p[10],1);assert.equal(m.params.p[11],1);
 assert.deepEqual(m.state,{blend:'none',depthTest:false,depthWrite:false,cull:true});
 assert.equal(o._material({pipeline:'entity',tex:'x.png',params:p,state:{}},0xff5555)!==m,true);
});
test('the native entity_outline chain only uses programs the post pipeline implements',async()=>{
 const {ZipFile}=await import('../lib/zip.js');const {readdirSync,existsSync}=await import('node:fs');
 const cache=new URL('../cache/',import.meta.url),port=readdirSync(cache).find(n=>/^port-/.test(n)&&existsSync(new URL(n+'/client.jar',cache))),plain=readdirSync(cache).find(n=>/^1\.[0-9.]+\.jar$/.test(n));
 const jar=new ZipFile(new URL(port?port+'/client.jar':plain,cache));
 const chain=JSON.parse(new TextDecoder().decode(jar.read('assets/minecraft/shaders/post/entity_outline.json')));
 const post=readFileSync(new URL('../client/js/render/post.js',import.meta.url),'utf8');
 for(const pass of chain.passes)assert.match(post,new RegExp('\\b'+pass.name+': \\{ mode'),pass.name);
});
