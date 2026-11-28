// Record which release articles are actually retrievable, with URL, status, bytes and SHA-256.
// A challenge page or a non-200 response is recorded as unavailable, never as article content.
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {root} from './prepare.mjs';

const run=promisify(execFile);
const releases=['1.21','1.21.1','1.21.2','1.21.3','1.21.4','1.21.5','1.21.6','1.21.7','1.21.8','1.21.9','1.21.10','1.21.11','26.1','26.1.1','26.1.2','26.2','26.3'];
const dir=join(root,'cache/port-26.3/source-review-2026-11-25');
await mkdir(dir,{recursive:true});
const index=[];
for(const release of releases){
  const url='https://minecraft.wiki/w/Java_Edition_'+release;
  const file=join(dir,release+'.html');
  let status='error',bytes=0,body='';
  try{
    const result=await run('curl',['--silent','--show-error','--location','--max-time','30','--user-agent','MinecraftJS-port/26.3 (compatibility research)','--write-out','%{http_code}','--output',file,url],{encoding:'utf8',maxBuffer:1024*1024});
    status=result.stdout.trim();
    body=await readFile(file,'utf8');
    bytes=Buffer.byteLength(body);
  }catch(e){status='error:'+String(e.message||e).slice(0,80);}
  const isArticle=status==='200'&&/mw-content-text|mw-parser-output/.test(body)&&!/(Just a moment|cf-challenge|Enable JavaScript and cookies)/i.test(body.slice(0,4000));
  index.push({release,url,retrieval:'curl',status,bytes,sha256:bytes?createHash('sha256').update(body).digest('hex'):null,treatedAsArticle:isArticle});
  console.log(release.padEnd(8),status,isArticle?'article':'UNAVAILABLE',bytes);
}
await writeFile(join(root,'docs/transition-26.3.release-index.json'),JSON.stringify({target:'26.3',recordedOn:'2026-11-25',method:'direct curl with a descriptive user agent',releases:index},null,2)+'\n');
const ok=index.filter(entry=>entry.treatedAsArticle).length;
console.log('Recorded '+ok+'/'+index.length+' articles in docs/transition-26.3.release-index.json');
