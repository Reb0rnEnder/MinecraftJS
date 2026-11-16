// Measure the actual target asset corpus, not synthetic tones. No source assets are changed.
import {writeFileSync,mkdirSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {deflateRawSync} from 'node:zlib';
import {createServer} from 'node:http';
import mcassets from '../lib/mcassets.js';
import encoder from '../lib/audio-encoder.js';
const index=await mcassets.loadAssetIndex(),enc=new encoder.AudioEncoder({}),names=Object.keys(index.objects).filter(n=>n.startsWith('minecraft/sounds/')&&n.endsWith('.ogg')).sort();
const totals={files:names.length,originalBytes:0,encodedBytes:0,originalDeflatedBytes:0,encodedDeflatedBytes:0,opusFiles:0,retainedOriginalFiles:0};
const groups={},buffers=new Map();let next=0;
await Promise.all(Array.from({length:4},async()=>{while(next<names.length){const name=names[next++],rel=name.slice('minecraft/sounds/'.length),source=await index.read(name),encoded=await enc.encode(rel,source),music=/^(music|records)\//.test(rel),g=groups[music?'music':'effects']||=( {files:0,originalBytes:0,encodedBytes:0} );
  g.files++;g.originalBytes+=source.length;g.encodedBytes+=encoded.length;
  totals.originalBytes+=source.length;totals.encodedBytes+=encoded.length;
  totals.originalDeflatedBytes+=deflateRawSync(source).length;totals.encodedDeflatedBytes+=deflateRawSync(encoded).length;
  if(encoded.includes(Buffer.from('OpusHead')))totals.opusFiles++;else totals.retainedOriginalFiles++;
  buffers.set(name,encoded);
}}));
let playback={tested:false};
if(process.env.PLAYWRIGHT_MODULE){
  const {chromium}=await import(process.env.PLAYWRIGHT_MODULE),server=createServer((req,res)=>{
    if(req.url==='/'){res.end('<body>Audio codec check</body>');return;}
    const bytes=buffers.get(req.url.slice(1));if(!bytes){res.writeHead(404).end();return;}res.setHeader('Content-Type','audio/ogg');res.end(bytes);
  });await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
  try{browser=await chromium.launch({headless:true,args:['--no-sandbox','--autoplay-policy=no-user-gesture-required']});const page=await browser.newPage();await page.goto('http://127.0.0.1:'+server.address().port);
    playback=await page.evaluate(async names=>{const ctx=new AudioContext(),errors=[];let next=0,decoded=0;await Promise.all(Array.from({length:2},async()=>{while(next<names.length){const name=names[next++];try{const bytes=await fetch('/'+name).then(r=>r.arrayBuffer()),buffer=await ctx.decodeAudioData(bytes);if(!buffer.length||!buffer.duration)throw Error('Empty sound');decoded++;}catch(e){errors.push({name,error:String(e)});}}}));await ctx.close();return{tested:true,decoded,errors,userAgent:navigator.userAgent};},names);
    if(playback.errors.length)process.exitCode=1;
  }finally{await browser?.close();await new Promise(r=>server.close(r));}
}
const report={minecraftVersion:mcassets.MC_VERSION,codec:enc.codec,effectsKbps:enc.sfxKbps,musicKbps:enc.musicKbps,totals,groups,savingPercent:100*(1-totals.encodedBytes/totals.originalBytes),playback};
const out=resolve(process.argv.find(a=>a.startsWith('--out='))?.slice(6)||'cache/audio-benchmark.json');mkdirSync(dirname(out),{recursive:true});writeFileSync(out,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
