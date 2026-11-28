// RFC 8484 DNS over HTTPS for the _minecraft._tcp SRV lookup: query encoding, answer parsing (with name
// compression), server URLs and fallback order.
import {test} from 'node:test';import assert from 'node:assert/strict';
import {encodeDnsQuery,parseDnsResponse,dohUrl,lookupSrv,validDnsServer} from '../client/js/net/dns.js';
const name=s=>[...s.split('.').flatMap(l=>[l.length,...Buffer.from(l)]),0];
function response(records,rcode=0){
  const q=[...name('_minecraft._tcp.example.net'),0,33,0,1],out=[0,0,0x81,0x80|0,0,1,0,records.length,0,0,0,0,...q];out[3]=0x80|rcode;
  for(const r of records){const target=r.target==='ptr'?[0xc0,12+16]:name(r.target),data=[r.priority>>8,r.priority&255,r.weight>>8,r.weight&255,r.port>>8,r.port&255,...target];out.push(0xc0,12,0,33,0,1,0,0,1,0,data.length>>8,data.length&255,...data);}
  return Uint8Array.from(out);
}
test('query bytes, SRV answers and server URLs',()=>{
  const q=encodeDnsQuery('_minecraft._tcp.example.net',33);
  assert.deepEqual([...q.slice(0,12)],[0,0,1,0,0,1,0,0,0,0,0,0]);assert.deepEqual([...q.slice(-4)],[0,33,0,1]);
  const r=parseDnsResponse(response([{priority:5,weight:1,port:25599,target:'mc.example.net'},{priority:0,weight:5,port:25600,target:'ptr'}]));
  assert.deepEqual(r.answers.map(a=>a.srv),[{priority:5,weight:1,port:25599,target:'mc.example.net'},{priority:0,weight:5,port:25600,target:'example.net'}]);
  assert.equal(dohUrl('1.1.1.1'),'https://1.1.1.1/dns-query');assert.equal(dohUrl('https://dns.google/dns-query'),'https://dns.google/dns-query');
  assert.equal(dohUrl('2606:4700:4700::1111'),'https://[2606:4700:4700::1111]/dns-query');assert.ok(!validDnsServer('not a url ::'));
});
test('the best record wins; NXDOMAIN is an answer; failing servers fall through',async()=>{
  const calls=[],ok=await lookupSrv('_minecraft._tcp.example.net',{list:['bad.example','1.1.1.1'],fetchBytes:async u=>{calls.push(u);if(u.includes('bad'))throw Error('down');return response([{priority:5,weight:1,port:1,target:'b.net'},{priority:1,weight:1,port:2,target:'a.net'}]);}});
  assert.deepEqual(ok,{records:[{priority:1,weight:1,port:2,target:'a.net'},{priority:5,weight:1,port:1,target:'b.net'}],answered:true});
  assert.match(calls[1],/^https:\/\/1\.1\.1\.1\/dns-query\?dns=[A-Za-z0-9_-]+$/);
  assert.deepEqual(await lookupSrv('x',{list:['1.1.1.1'],fetchBytes:async()=>response([],3)}),{records:[],answered:true});
  assert.deepEqual(await lookupSrv('x',{list:['1.1.1.1'],fetchBytes:async()=>null}),{records:[],answered:false});
});
