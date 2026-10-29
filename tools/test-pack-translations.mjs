import{test}from'node:test';import assert from'node:assert/strict';import{readFileSync,existsSync}from'node:fs';import{ZipFile}from'../lib/zip.js';import mcassets from'../lib/mcassets.js';
const jar=new ZipFile(await mcassets.locateJar());const path=jar.list('assets/minecraft/lang/').find(p=>/^assets\/minecraft\/lang\/en_us\.(json|lang)$/i.test(p)),bytes=jar.read(path).toString('utf8'),lang=path.endsWith('.json')?JSON.parse(bytes):Object.fromEntries(bytes.split(/\r?\n/).filter(l=>l&&!l.startsWith('#')&&l.includes('=')).map(l=>{const i=l.indexOf('=');return[l.slice(0,i),l.slice(i+1)];}));
test('resource-pack labels and incompatibility dialogs use keys present in the target jar',()=>{
 const source=readFileSync(new URL('../client/js/gui/screens/packs.js',import.meta.url),'utf8');
 const keys=[...source.matchAll(/['"]((?:resourcePack|pack)\.[^'"]+)['"]/g)].map(m=>m[1]);
 for(const key of new Set(keys.filter(key=>key!=='pack.png'))){if(key.endsWith('.'))for(const age of['new','old'])assert.ok(lang[key+age],key+age);else assert.ok(lang[key],key);}
 assert.ok(keys.includes('resourcePack.title'));
});
test('mob statistics and structure titles use translated native GUI keys',()=>{
 for(const name of['stats','structure']){if(!existsSync(new URL('../client/js/gui/screens/'+name+'.js',import.meta.url)))continue;const source=readFileSync(new URL('../client/js/gui/screens/'+name+'.js',import.meta.url),'utf8');for(const [,key]of source.matchAll(/tr\(['"]((?:stat(?:_type)?\.|tile\.structureBlock\.|block\.minecraft\.structure_block)[^'"]*)['"]/g))assert.ok(lang[key],key);}
});
