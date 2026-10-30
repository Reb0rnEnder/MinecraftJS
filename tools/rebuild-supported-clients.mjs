// Rebuild named supported worktrees into a staged distribution, then publish
// HTML/static outputs with source commits and checksums. Preserve site configs.
import {spawn,execFileSync} from 'node:child_process';
import {mkdir,mkdtemp,readFile,writeFile,rename,stat,readdir,copyFile} from 'node:fs/promises';
import {createWriteStream,createReadStream} from 'node:fs';import {createHash} from 'node:crypto';import {join,dirname} from 'node:path';
const home='/home/ender',base=join(home,'minecraftjs'),dist=join(base,'dist'),live=join(dist,'all-versions'),staticLive=join(dist,'static'),versions=['1.8.9','1.12.2','1.13.2','1.14.4','1.15.2','1.16.5','1.17.1','1.18.2'];
const git=(root,...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
await mkdir(dist,{recursive:true});const stage=await mkdtemp(join(dist,'.supported-build-')),out=join(stage,'all-versions'),staticOut=join(stage,'static');await mkdir(out);await mkdir(staticOut);
const exists=async p=>!!await stat(p).catch(e=>{if(e.code==='ENOENT')return null;throw e;});
const digest=async p=>{const h=createHash('sha256');for await(const b of createReadStream(p))h.update(b);return h.digest('hex');};
async function files(dir,prefix=''){const result=[];for(const e of await readdir(join(dir,prefix),{withFileTypes:true})){const p=prefix?prefix+'/'+e.name:e.name;if(e.isDirectory())result.push(...await files(dir,p));else if(e.isFile())result.push(p);}return result.sort();}
const roots=Object.fromEntries(versions.map(v=>[v,v==='1.12.2'?base:join(home,'minecraftjs-'+v)])),commits={};
for(const v of versions){const root=roots[v];if(git(root,'branch','--show-current')!==v)throw Error('Wrong target branch '+v);if(git(root,'diff','--name-only')||git(root,'diff','--cached','--name-only'))throw Error('Tracked source is dirty: '+v);commits[v]=git(root,'rev-parse','HEAD');if(git(root,'rev-parse','origin/'+v)!==commits[v])throw Error('Source not pushed: '+v);}
console.log('Staging distribution in '+stage);
async function build(root,args,logPath){const log=createWriteStream(logPath,{flags:'a'});try{await new Promise((resolve,reject)=>{const child=spawn(process.execPath,['tools/build.js','html',...args],{cwd:root,env:{...process.env,NODE_OPTIONS:'--max-old-space-size=4096'},stdio:['ignore','pipe','pipe']});child.stdout.pipe(log,{end:false});child.stderr.pipe(log,{end:false});child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(Error(root+' build failed ('+code+'); see '+logPath)));});}finally{await new Promise(r=>log.end(r));}}
const records=new Map();let next=0;
async function worker(){while(next<versions.length){const v=versions[next++],root=roots[v],development=!['1.8.9','1.12.2','1.13.2'].includes(v),file=v+(development?'-development':'')+'.html',log=join(stage,v+'.log'),html=join(out,file),site=join(staticOut,v),config=await exists(join(staticLive,v,'config.json'))?join(staticLive,v,'config.json'):join(live,'config.json');console.log('Building '+v+' HTML and static');
 const configArgs=await exists(config)?['--config='+config]:[];
 await build(root,['--out='+html,...configArgs],log);await build(root,['--static','--out='+site,...configArgs],log);
 if(git(root,'rev-parse','HEAD')!==commits[v]||git(root,'diff','--name-only'))throw Error('Source changed during build: '+v);
 const source={version:v,commit:commits[v],branch:v,development};await writeFile(join(site,'source.json'),JSON.stringify(source,null,2)+'\n');
 const entries=[];let bytes=0;for(const p of await files(site)){const path=join(site,p),size=(await stat(path)).size;bytes+=size;entries.push((await digest(path))+'  '+p);}await writeFile(join(site,'SHA256SUMS'),entries.join('\n')+'\n');
 records.set(v,{...source,file,publishedCommit:commits[v],bytes:(await stat(html)).size,sha256:await digest(html),static:{directory:'../static/'+v,files:entries.length,bytes,checksums:'../static/'+v+'/SHA256SUMS',checksumsSha256:await digest(join(site,'SHA256SUMS'))}});console.log('Built '+v);
}}
await Promise.all([worker(),worker()]);
const artifacts=[...versions].reverse().map(v=>records.get(v)),manifest={builtAt:new Date().toISOString(),artifacts};await writeFile(join(out,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');await writeFile(join(out,'SHA256SUMS'),artifacts.map(a=>a.sha256+'  '+a.file).join('\n')+'\n');
await writeFile(join(out,'README.md'),'# MinecraftJS builds\n\nBuilt '+manifest.builtAt+' from pushed source commits.\n\n'+artifacts.map(a=>'- ['+a.version+']('+a.file+')'+(a.development?' (development)':'')+' — `'+a.commit.slice(0,7)+'`; static site: `../static/'+a.version+'/`.').join('\n')+'\n\nHTML files contain the complete client/assets; each static directory is independently uploadable. Java TCP servers require a compatible WebSocket proxy. Development labels retain known parity gaps from each checkout. The 1.19.2 transition is planning only and has no build.\n\n`manifest.json` records source commits, sizes and SHA-256 checksums. `SHA256SUMS` verifies HTML; every static directory has its own `source.json` and complete `SHA256SUMS`.\n\nSite configuration is preserved in `config.json`. A custom skin proxy can use `%u` for UUID, `%r` for the raw texture URL and `%R` for its URL-encoded form. Saved player choices override site defaults. Serve these files over HTTP(S), for example:\n\n```sh\npython3 -m http.server 8080 --bind 127.0.0.1 --directory /home/ender/minecraftjs/dist/all-versions\n```\n\nExisting configuration/examples are preserved. Prior static folders are retained in the timestamped backup next to this distribution; local server worlds, screenshots, shader packs and session files are untouched.\n');
// Configs are intentionally not among replaced live files.
await mkdir(live,{recursive:true});await mkdir(staticLive,{recursive:true});const backup=join(dist,'.previous-static-'+Date.now());await mkdir(backup);
for(const a of artifacts){const site=join(staticLive,a.version);if(await exists(site))await rename(site,join(backup,a.version));await rename(join(staticOut,a.version),site);await rename(join(out,a.file),join(live,a.file));}
for(const name of ['manifest.json','SHA256SUMS','README.md'])await rename(join(out,name),join(live,name));
console.log('Published all eight HTML/static clients to '+live+' and '+staticLive);console.log('Build logs: '+stage);
