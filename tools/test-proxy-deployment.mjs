import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {once} from 'node:events';
import {WebSocket} from 'ws';
const require=createRequire(import.meta.url),{resolveTarget,isLoopback,proxyOptions,openPack}=require('../lib/proxy-options');
const root=new URL('../',import.meta.url);
test('loopback policy includes mapped IPv6, all DNS answers and explicit opt-in',async()=>{
 for(const ip of ['127.0.0.1','127.8.9.10','::1','::ffff:127.0.0.2','::ffff:7f00:1','0.0.0.0','::']){assert.equal(isLoopback(ip),true,ip);await assert.rejects(resolveTarget(ip,25565),/Loopback/);}
 for(const host of ['localhost','LOCALHOST.','x.localhost'])await assert.rejects(resolveTarget(host,25565),/Loopback/);
 await assert.rejects(resolveTarget('example.test',25565,{lookup:async()=>[{address:'203.0.113.1',family:4},{address:'127.0.0.1',family:4}]}),/Loopback/);
 assert.deepEqual(await resolveTarget('public.test',25565,{lookup:async()=>[{address:'203.0.113.1',family:4}]}),{host:'203.0.113.1',port:25565});
 assert.deepEqual(await resolveTarget('::1',25565,{allowLoopback:true}),{host:'::1',port:25565});
 assert.deepEqual(proxyOptions(['--proxy-only'],{}),{proxyOnly:true,allowLoopback:false});assert.equal(proxyOptions(['--allow-loopback'],{}).allowLoopback,true);
});
async function unusedPort(){const s=createServer();s.listen(0,'127.0.0.1');await once(s,'listening');const port=s.address().port;await new Promise(r=>s.close(r));return port;}
async function launch(t,allow){const port=await unusedPort(),child=spawn(process.execPath,['proxy.js','--proxy-only',...(allow?['--allow-loopback']:[])],{cwd:root,env:{...process.env,PORT:String(port),MC_JAR:'/does/not/exist',PROXY_ONLY:'0',ALLOW_LOOPBACK:'0'},stdio:['ignore','pipe','pipe']});let output='';child.stdout.on('data',b=>output+=b);child.stderr.on('data',b=>output+=b);t.after(async()=>{child.kill();if(child.exitCode===null)await once(child,'exit');});await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error(output)),5000),check=()=>{if(output.includes('server running')){clearTimeout(timer);resolve();}};child.stdout.on('data',check);child.once('error',reject);});assert.doesNotMatch(output,/Game assets|asset index loaded/);return {port,output};}
async function request(port,message){const ws=new WebSocket('ws://127.0.0.1:'+port);await once(ws,'open');const result=new Promise((resolve,reject)=>{const timer=setTimeout(()=>{ws.terminate();reject(Error('No control reply'));},4000);ws.on('message',b=>{const p=JSON.parse(b);if(p.type==='error'||p.type==='ping_result'){clearTimeout(timer);resolve(p);ws.close();}});ws.on('error',reject);});ws.send(JSON.stringify(message));return result;}
test('proxy-only starts without assets, serves no client, rejects loopback ping/connect/pack',{timeout:15000},async t=>{
 const {port}=await launch(t,false);for(const path of ['/','/js/main.js','/assets/pack.mcmeta'])assert.equal((await fetch('http://127.0.0.1:'+port+path)).status,404);
 for(const type of ['connect','ping']){const reply=await request(port,{type,host:'127.0.0.1',port:25565});assert.match(reply.error||reply.message,/Loopback/);}
 const response=await fetch('http://127.0.0.1:'+port+'/pack?url='+encodeURIComponent('http://127.0.0.1:9999/pack.zip'));assert.equal(response.status,403);
});
test('explicit allow-loopback connects the bridge to a local TCP server',{timeout:15000},async t=>{
 const {port}=await launch(t,true),tcp=createServer(s=>{s.on('error',()=>{});s.on('data',()=>{s.destroy();});});tcp.listen(0,'127.0.0.1');await once(tcp,'listening');t.after(()=>new Promise(r=>tcp.close(r)));const connected=once(tcp,'connection');const ws=new WebSocket('ws://127.0.0.1:'+port);await once(ws,'open');t.after(()=>ws.terminate());ws.send(JSON.stringify({type:'connect',host:'127.0.0.1',port:tcp.address().port,username:'LocalTest'}));const [socket]=await connected;socket.destroy();
});
test('resource pack redirects are validated before opening the next connection',async t=>{
 const {createServer}=await import('node:http');let hits=0;const s=createServer((req,res)=>{hits++;res.writeHead(302,{location:'file:///not-an-http-pack'});res.end();});s.listen(0,'127.0.0.1');await once(s,'listening');t.after(()=>new Promise(r=>s.close(r)));
 const response=await openPack(new URL('http://127.0.0.1:'+s.address().port),{}, {allowLoopback:true},undefined).catch(e=>e);assert.match(response.message,/Invalid resource pack URL/);assert.equal(hits,1);
 await assert.rejects(openPack(new URL('http://127.0.0.1:'+s.address().port),{},{allowLoopback:false}),/Loopback/);assert.equal(hits,1);
});
