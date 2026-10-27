import{test}from'node:test';import assert from'node:assert/strict';import{randomBytes}from'node:crypto';import{gzipSync}from'node:zlib';import{decodeBase85}from'../client/js/util/base85.js';import{ungzip}from'../client/js/lib/pako.esm.mjs';import packed from'../lib/packed-html.js';
test('HTML-safe base85 retains arbitrary bytes, partial groups and PNG-like payloads losslessly',()=>{
 for(const length of [0,1,2,3,4,5,17,255,1024,65537]){const bytes=randomBytes(length),encoded=packed.encodeBase85(bytes);assert.doesNotMatch(encoded,/[<>&\s]/);assert.deepEqual(Buffer.from(decodeBase85(encoded,length)),bytes);if(length>100)assert.ok(encoded.length<Math.ceil(bytes.length/3)*4);}
 assert.throws(()=>decodeBase85('!!!!!',99),/length/);assert.throws(()=>decodeBase85('<<<<<<',4),/length/);
});
test('compressed Blob module bytes recover the exact Unicode JavaScript source',()=>{
 const source='globalThis.message="Unicode ą → 🐢 and </script>";\n'.repeat(200),bytes=gzipSync(Buffer.from(source)),encoded=packed.encodeBase85(bytes);assert.equal(Buffer.from(ungzip(decodeBase85(encoded,bytes.length))).toString('utf8'),source);assert.ok(encoded.length<source.length/2);
});
