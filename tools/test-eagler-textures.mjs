import{test}from'node:test';import assert from'node:assert/strict';import{EaglerTextures,skinPixelsV3,capePixelsV3}from'../client/js/net/eagler-textures.js';import{Writer}from'../client/js/net/buffer.js';import{EntityRenderer}from'../client/js/render/entity-renderer.js';import{EAGLER_SKINS,EAGLER_CAPES}from'../client/js/net/eagler-presets.js';
const uuid='00112233-4455-6677-8899-aabbccddeeff';
function fixture(){const sent=[],rebuilt=[],textures=new Map(),disposed=[],g={conn:{ws:{isEagler:true}},send:b=>sent.push(b),assets:{textures,device:{destroyTexture:t=>disposed.push(t)},makeTexture(key,width,height,data){const t={width,height,data};textures.set(key,t);return t;}},entityRenderer:{_rebuild:u=>rebuilt.push(u)}};const manager=g.eaglerTextures=new EaglerTextures(g);return{manager,g,sent,rebuilt,textures,disposed};}
test('Eagler skins and capes are requested once over plugin messages, with no HTTP fetch',()=>{
 const {g,sent,manager}=fixture();const r={game:g};const record=EntityRenderer.prototype.skinFor.call(r,{uuid});assert.ok(record);EntityRenderer.prototype.skinFor.call(r,{uuid});assert.equal(sent.length,2);assert.equal(manager.records.size,1);
 const pixels=new Uint8Array(16384);pixels.set([255,30,20,10]);const reply=new Writer().u8(5).uuid(uuid).u8(1).raw(pixels).build();assert.equal(manager.handle('eagler:skins-1-8',reply),true);assert.equal(record.slim,true);assert.deepEqual([...record.texture.data.slice(0,4)],[10,20,30,255]);assert.equal(EntityRenderer.prototype.skinFor.call(r,{uuid}),record);
 manager.clear();assert.equal(manager.records.size,0);
});
test('raw skin ABGR and cape BGR data map into native RGBA textures, including cape side strip',()=>{
 const skin=new Uint8Array(16384);skin.set([40,30,20,10]);assert.deepEqual([...skinPixelsV3(skin).slice(0,4)],[10,20,30,40]);const cape=new Uint8Array(1173);cape.set([3,2,1]);cape.set([6,5,4],(6*23+22)*3);const rgba=capePixelsV3(cape);assert.deepEqual([...rgba.slice(0,4)],[1,2,3,255]);assert.deepEqual([...rgba.slice((11*64+22)*4,(11*64+22)*4+4)],[4,5,6,255]);
});
test('all upstream skin/cape presets decode, share textures, and survive normal server channels',()=>{
 const{manager,textures}=fixture();manager.request(uuid);
 for(const p of EAGLER_SKINS){manager.handle('EAG|Skins-1.8',new Writer().u8(4).uuid(uuid).i32(p.id).build());const record=manager.records.get(uuid);assert.ok(record.texture,p.name);assert.equal(record.slim,p.slim);}
 for(const p of EAGLER_CAPES){manager.handle('EAG|Capes-1.8',new Writer().u8(4).uuid(uuid).i32(p.id).build());assert.ok(manager.records.get(uuid).cape,p.name);}
 const count=textures.size;manager.handle('EAG|Skins-1.8',new Writer().u8(4).uuid(uuid).i32(1).build());assert.equal(textures.size,count);manager.clear();assert.equal(textures.size,0);
});
test('malformed replies, unknown UUIDs and vanilla connections do not allocate textures or send requests',()=>{
 const{manager,g,sent,textures}=fixture();manager.handle('EAG|Skins-1.8',new Uint8Array([5]));assert.equal(textures.size,0);manager.handle('EAG|Skins-1.8',new Writer().u8(4).uuid(uuid).i32(1).build());assert.equal(textures.size,0);g.conn.ws.isEagler=false;assert.equal(manager.request(uuid),null);assert.equal(sent.length,0);
});
