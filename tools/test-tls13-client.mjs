// The client's own TLS 1.3 + X.509 + HTTP (net/tls13.js, net/x509.js, net/https.js) against Node's TLS server.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import tls from 'node:tls';
import net from 'node:net';
import {parseCertificate,verifyChain,hostnameMatches} from '../client/js/net/x509.js';
import {TlsSocket} from '../client/js/net/tls13.js';
import {httpsRequest,parseResponse} from '../client/js/net/https.js';
const F=new URL('./fixtures/tls/',import.meta.url),pem=n=>readFileSync(new URL(n,F),'utf8');
const derOf=p=>new Uint8Array(Buffer.from(p.replace(/-----[^-]+-----/g,'').replace(/\s+/g,''),'base64'));
const cert=n=>parseCertificate(derOf(pem(n)));
const host='test.minecraftjs.invalid';
test('chains verify through SHA-384 RSA and P-384 ECDSA issuers; names, roots and dates are enforced',async()=>{
  const rsa=[cert('rsa-leaf.pem'),cert('rsa-int.pem')],ec=[cert('ec-leaf.pem')],rsaRoot=cert('rsa-root.pem'),ecRoot=cert('ec-root.pem');
  assert.equal(await verifyChain(rsa,host,[rsaRoot]),true);
  assert.equal(await verifyChain(ec,host,[ecRoot]),true);
  assert.ok(hostnameMatches(rsa[0],'a.wild.minecraftjs.invalid'));assert.ok(!hostnameMatches(rsa[0],'a.b.wild.minecraftjs.invalid'));
  await assert.rejects(verifyChain(rsa,'other.invalid',[rsaRoot]),/not valid for/);
  await assert.rejects(verifyChain(rsa,host,[ecRoot]),/trusted root/);
  await assert.rejects(verifyChain([rsa[0]],host,[rsaRoot]),/trusted root/);
  await assert.rejects(verifyChain(rsa,host,[rsaRoot],Date.UTC(1999,0,1)),/expired or not yet valid/);
});
const serve=(key,certPem,ciphers)=>new Promise(resolve=>{
  const server=tls.createServer({key:pem(key),cert:certPem,minVersion:'TLSv1.3',ciphersuites:ciphers,ecdhCurve:'P-256'},s=>{
    let req='';s.on('data',d=>{req+=d;if(req.includes('\r\n\r\n')){const body=JSON.stringify({ok:true,path:req.split(' ')[1]});s.end('HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nTransfer-Encoding: chunked\r\n\r\n'+body.length.toString(16)+'\r\n'+body+'\r\n0\r\n\r\n');}});
  });
  server.listen(0,'127.0.0.1',()=>resolve(server));
});
const open=(port)=>(route,h,p)=>new Promise((resolve,reject)=>{const s=net.connect(port,'127.0.0.1'),hs={};const stream={on:(e,f)=>(hs[e]||=[]).push(f),write:b=>s.write(b),close:()=>s.destroy()};s.on('data',b=>(hs.data||[]).forEach(f=>f(new Uint8Array(b))));s.on('close',()=>(hs.close||[]).forEach(f=>f()));s.on('connect',()=>resolve(stream));s.on('error',reject);});
for(const [name,key,chain,root,ciphers] of [['RSA-PSS + AES-256-GCM','rsa-leaf.key',pem('rsa-leaf.pem')+pem('rsa-int.pem'),'rsa-root.pem','TLS_AES_256_GCM_SHA384'],['ECDSA + AES-128-GCM','ec-leaf.key',pem('ec-leaf.pem'),'ec-root.pem','TLS_AES_128_GCM_SHA256']]){
  test('TLS 1.3 handshake and HTTP request: '+name,async()=>{
    const server=await serve(key,chain,ciphers),port=server.address().port;
    try{
      const roots=[cert(root)];
      const orig=TlsSocket.prototype.connect;TlsSocket.prototype.connect=function(o={}){return orig.call(this,{...o,roots});};
      try{
        const r=await httpsRequest('https://'+host+'/player/certificates?x=1',{method:'POST',route:{type:'test'},open:open(port)});
        assert.equal(r.status,200);assert.deepEqual(r.json(),{ok:true,path:'/player/certificates?x=1'});
        await assert.rejects(httpsRequest('https://wrong.minecraftjs.invalid/',{route:{type:'test'},open:open(port)}),/not valid for/);
      }finally{TlsSocket.prototype.connect=orig;}
      await assert.rejects(httpsRequest('https://'+host+'/',{route:{type:'test'},open:open(port)}),/trusted root/);
    }finally{server.close();}
  });
}
test('HTTP responses: content-length, chunked and read-to-close bodies',()=>{
  const e=s=>new TextEncoder().encode(s);
  assert.equal(parseResponse(e('HTTP/1.1 200 OK\r\nContent-Length: 5\r\n\r\nhel')),null);
  assert.equal(parseResponse(e('HTTP/1.1 200 OK\r\nContent-Length: 5\r\n\r\nhello')).text(),'hello');
  assert.equal(parseResponse(e('HTTP/1.1 201 X\r\nTransfer-Encoding: chunked\r\n\r\n2\r\nhi\r\n1\r\n!\r\n0\r\n\r\n')).text(),'hi!');
  assert.equal(parseResponse(e('HTTP/1.1 204 No Content\r\n\r\n'),true).status,204);
});
