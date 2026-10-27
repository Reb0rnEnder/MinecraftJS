// Read-only evidence report. A passing data check is never a full-parity claim.
import{readFileSync,writeFileSync,existsSync}from'node:fs';import{execFileSync}from'node:child_process';import{join,dirname}from'node:path';import{pathToFileURL,fileURLToPath}from'node:url';import{createHash}from'node:crypto';
const {ZipFile}=await import('../lib/zip.js');
const root=fileURLToPath(new URL('../',import.meta.url)),wiki=JSON.parse(readFileSync(new URL('parity/wiki-release-index.json',import.meta.url)));
const worktrees=execFileSync('git',['worktree','list','--porcelain'],{cwd:root,encoding:'utf8'}).trim().split('\n\n').map(block=>{const lines=block.split('\n');return{root:lines.find(l=>l.startsWith('worktree ')).slice(9),branch:lines.find(l=>l.startsWith('branch '))?.slice(18)};});
const versions=['1.8.9','1.12.2','1.13.2','1.14.4','1.15.2'],reports=[];
for(const version of versions){
 const checkout=worktrees.find(w=>w.branch===version)?.root;if(!checkout)throw Error('Missing worktree for '+version);
 const json=path=>JSON.parse(readFileSync(join(checkout,path))),data=name=>json('client/data/'+name+'.json');
 const blocks=data('blocks'),items=data('items'),entities=data('entities'),shapes=data('blockCollisionShapes');
 const modelPath=join(checkout,'client/assets/bundles/entity-models.json');let models,extractorWarnings=[];if(existsSync(modelPath))models=JSON.parse(readFileSync(modelPath));else{const {extractModels}=await import(pathToFileURL(join(checkout,'lib/modelextract.js')));const result=extractModels(new ZipFile(join(checkout,'cache',version+'.jar')));extractorWarnings=result.errors;models=result.models;}
 const manifestPath=join(checkout,'client/assets/asset-manifest.json'),manifest=existsSync(manifestPath)?JSON.parse(readFileSync(manifestPath)):null;
 const source=wiki.releases.find(r=>r.version===version),jar=readFileSync(join(checkout,'cache',version+'.jar')),sha1=createHash('sha1').update(jar).digest('hex');
 const {decodePacket,C}=await import(pathToFileURL(join(checkout,'client/js/net/packets.js'))),{defaultProxies}=await import(pathToFileURL(join(checkout,'client/js/net/proxies.js')));
 const probes=[{id:'client-jar',pass:sha1===source.clientJarSha1,expected:source.clientJarSha1,actual:sha1},
 {id:'collision-data-for-all-blocks',pass:blocks.every(b=>Object.hasOwn(shapes.blocks,b.name)),missing:blocks.filter(b=>!Object.hasOwn(shapes.blocks,b.name)).map(b=>b.name)},
 {id:'static-host-empty-proxies',pass:defaultProxies({proxies:[]}).length===0},
 {id:'custom-model-loader',pass:existsSync(join(checkout,'client/js/resource-models.js'))},
 {id:'skull-profiles',pass:readFileSync(join(checkout,'client/js/render/entity-renderer.js'),'utf8').includes('skullTexture(owner)')}];
 const gaps=[];
 if(version==='1.13.2')for(const [id,name]of [[0x1d,'nbt_query_response'],[0x54,'declare_recipes']]){const actual=decodePacket(new Uint8Array([id])).name;gaps.push({id:'protocol.'+name,status:actual==='unknown'?'missing':'needs-validation',actual,evidence:'client/js/net/packets.js:decodePacket'});}
 const menus=readFileSync(join(checkout,'client/js/gui/screens/menus.js'),'utf8');gaps.push({id:'integrated-singleplayer',status:menus.includes('sp.enabled = false')?'outside-client-scope':'needs-validation',evidence:'client/js/gui/screens/menus.js'});
 gaps.push({id:'exhaustive-wiki-behavior',status:'not-certified',reason:'No acceptance record covers every release topic and listed vanilla fix.'},{id:'entity-animation-visual-acceptance',status:'partial',reason:'Native model presence does not verify every state transition or layer.'});
 reports.push({version,fullParity:false,protocol:{'1.8.9':47,'1.12.2':340,'1.13.2':404,'1.14.4':498,'1.15.2':578}[version],content:{blocks:blocks.length,items:items.length,entities:entities.length,entityModels:Object.keys(models).length,flattenedStates:blocks[0].minStateId===undefined?null:blocks.reduce((n,b)=>n+b.maxStateId-b.minStateId+1,0)},assetManifest:manifest,extractorWarnings,probes,gaps});
}
const result={reviewedOn:wiki.reviewedOn,method:'Wiki release index plus read-only runtime/data probes across the existing worktrees. No claim of exhaustive gameplay, rendering, server AI or every wiki fix.',wiki:{pages:wiki.releases.length,topics:wiki.releases.reduce((n,r)=>n+r.topics.length,0),bugIds:wiki.releases.reduce((n,r)=>n+r.bugIds.length,0)},versions:reports};
if(process.argv.includes('--write'))writeFileSync(new URL('../docs/supported-version-audit-results.json',import.meta.url),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
if(process.argv.includes('--strict')&&(reports.some(r=>!r.fullParity)))process.exitCode=1;
