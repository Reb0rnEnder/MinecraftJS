// P01: triage every release topic between 1.20.6 and 26.3.
//
// The wiki articles are release notes, not the game. Each bullet under Additions, Changes,
// Technical, Fixes and Removals is a topic. The crosswalk gives every topic one disposition:
//   native-client          behaviour the 26.3 client has to implement or present
//   server-owned           dedicated-server/JAR/RCON/allow-list behaviour outside the client
//   experiment-gated       behaviour shipped behind a feature flag/experiment
//   product-outside-scope  Realms, world creation, launcher or marketplace products
// It also records the source URL, retrieval method, full-page SHA-256, extracted-article
// SHA-256 and the official version-manifest row. Challenge pages are rejected because the
// parser requires the article container and release-note sections.
//
// Usage:
//   node tools/port-26.3/release-crosswalk.mjs --refresh   fetch, update index + crosswalk
//   node tools/port-26.3/release-crosswalk.mjs --write     rebuild from cached articles
//   node tools/port-26.3/release-crosswalk.mjs --check     compare committed outputs
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {existsSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const cache=join(root,'cache/port-26.3/releases');
const indexPath=join(root,'docs/transition-26.3.release-index.json');
const officialPath=join(root,'docs/transition-26.3.official-versions.json');
const jsonPath=join(root,'docs/transition-26.3.crosswalk.json');
const mdPath=join(root,'docs/transition-26.3.crosswalk.md');
const USER_AGENT='MinecraftJS parity research (https://github.com/MinecraftJS)';
const check=process.argv.includes('--check');
const refresh=process.argv.includes('--refresh');
mkdirSync(cache,{recursive:true});

const index=JSON.parse(readFileSync(indexPath,'utf8'));
const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');

function download(url,path){
  execFileSync('curl',['--fail','--silent','--show-error','--location','--retry','3','--max-time','180','-A',USER_AGENT,'-o',path,url]);
  return readFileSync(path);
}

const ENTITY={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' ',ndash:'-',mdash:'-',hellip:'...'};
function decode(text){
  return text.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi,(all,name)=>{
    if(name[0]==='#')return String.fromCodePoint(name[1].toLowerCase()==='x'?parseInt(name.slice(2),16):Number(name.slice(1)));
    return ENTITY[name.toLowerCase()]??all;
  });
}
function plain(html){
  return decode(html
    .replace(/<style[\s\S]*?<\/style>/gi,' ')
    .replace(/<script[\s\S]*?<\/script>/gi,' ')
    .replace(/<sup[\s\S]*?<\/sup>/gi,' ')
    .replace(/<br\s*\/?>/gi,' ')
    .replace(/<[^>]+>/g,' '))
    .replace(/\s+/g,' ').trim();
}
function articleContainer(html){
  const start=/<div class="[^"]*mw-parser-output[^"]*"[^>]*>/i.exec(html);
  assert.ok(start,'page has no mw-parser-output article container (challenge page?)');
  let body=html.slice(start.index+start[0].length);
  const end=/<h2[^>]*id="(?:Videos|Trivia|References|Navigation)"/i.exec(body);
  if(end)body=body.slice(0,end.index);
  assert.ok(/<h2[^>]*id="(?:Additions|Changes|Fixes)"/i.test(body),'article has no release-note sections');
  return body;
}
// Tables are inventories/references, not topics; removing them also removes nested bullets
// that would otherwise be counted twice.
function withoutTables(html){return html.replace(/<table[\s\S]*?<\/table>/gi,' ');}

function chunks(body){
  const out=[];
  const re=/<h([234])[^>]*>([\s\S]*?)<\/h\1>/gi;
  let section='',subsection='',subsubsection='',last=0,match;
  while((match=re.exec(body))){
    if(match.index>last)out.push({section,subsection,subsubsection,html:body.slice(last,match.index)});
    const text=plain(match[2]);
    if(match[1]==='2'){section=text;subsection='';subsubsection='';}
    else if(match[1]==='3'){subsection=text;subsubsection='';}
    else subsubsection=text;
    last=re.lastIndex;
  }
  if(last<body.length)out.push({section,subsection,subsubsection,html:body.slice(last)});
  return out;
}

// Top-level list items only. Nested bullets describe a topic instead of becoming topics.
// Text after a nested list is still part of the same topic for disposition purposes.
function topicsIn(html){
  const topics=[];
  let listDepth=0,current=null,skipText=false;
  const token=/<\/?([a-z0-9]+)[^>]*>/gi;
  let last=0,match;
  const flush=()=>{if(current){const text=plain(current).replace(/^\s*[-*]\s*/,'').trim();if(text)topics.push(text);}current=null;};
  while((match=token.exec(html))){
    const tag=match[1].toLowerCase(),closing=match[0][1]==='/';
    const text=html.slice(last,match.index);
    if(current&&!skipText)current+=text;
    if(tag==='ul'||tag==='ol'){
      if(closing)listDepth=Math.max(0,listDepth-1);
      else{listDepth++;if(listDepth>1)skipText=true;}
    }else if(tag==='li'){
      if(closing){if(listDepth<=1)flush();}
      else if(listDepth<=1){flush();current=' ';skipText=false;}
    }
    last=token.lastIndex;
  }
  if(current&&!skipText)current+=html.slice(last);
  flush();
  return topics;
}

const PRODUCT=[
  [/\brealms?\b/i,'Realms is a separate product'],
  [/\b(?:world creation|create (?:a )?new world|integrated server|open to lan)\b/i,'world creation/LAN product surface'],
  [/\b(?:launcher|marketplace|minecoin|microsoft account|telemetry|player reporting)\b/i,'account/launcher/telemetry product surface']
];
const SERVER=[
  [/\bdedicated server\b/i,'dedicated-server behaviour'],
  [/\bserver\.properties\b/i,'server configuration'],
  [/\b(?:rcon|server console|server jar|server list ping)\b/i,'server administration'],
  [/\b(?:allow.?list|whitelist|ban list|banned players?)\b/i,'server administration'],
  [/\bserver-side\b/i,'server-owned behaviour']
];
const EXPERIMENT=[/\bexperimental(?:ly)?\b/i,/\bexperiment(?:s)? (?:is|are) (?:enabled|required)\b/i,/\bonly (?:available|works?) (?:when|with) .*experiment/i];

function disposition(topic,section){
  const text=topic.text;
  if(/^experimental\b/i.test(section)||EXPERIMENT.some(re=>re.test(text)))return {disposition:'experiment-gated',reason:'behind an experiment/feature flag'};
  for(const [re,reason] of PRODUCT)if(re.test(text))return {disposition:'product-outside-scope',reason};
  for(const [re,reason] of SERVER)if(re.test(text))return {disposition:'server-owned',reason};
  return {disposition:'native-client',reason:'release-note behaviour presented or consumed by the client'};
}

const AREAS=[
  ['commands',/\b(?:command|commands|suggestions?|brigadier)\b/i],
  ['world generation',/\b(?:biome|world generation|worldgen|structure|feature|ore|tree|dimension|chunk|seed)\b/i],
  ['entities',/\b(?:mob|entity|entities|spawn|breeding|tame|pathfind|armadillo|breeze|creaking|ghast|golem|nautilus|zombie|skeleton|wolf|piglin|dragon)\b/i],
  ['blocks',/\b(?:block|blocks|stairs|slab|fence|door|torch|flower|coral|leaves|wood|ore)\b/i],
  ['items',/\b(?:item|items|tool|weapon|armor|armour|potion|bucket|bundle|enchant|recipe|food|shield|mace|spear)\b/i],
  ['audio',/\b(?:sound|sounds|music|audio|jukebox|note block)\b/i],
  ['UI/rendering',/\b(?:gui|screen|menu|hud|font|text|tooltip|icon|render|model|texture|particle|dialog|chat|title|recipe book|advancement|waypoint|locator)\b/i],
  ['protocol/data',/\b(?:packet|protocol|component|codec|nbt|resource pack|data pack|pack format|registry|tag)\b/i],
  ['gameplay',/\b(?:player|gameplay|combat|damage|health|hunger|experience|sleep|respawn|movement|flying|swimming|mining|crafting|trading|survival|creative)\b/i],
  ['performance',/\b(?:performance|memory|fps|lag|thread|tick)\b/i],
  ['localization',/\b(?:translation|language|localization|localisation)\b/i]
];
function area(text){
  for(const [name,re] of AREAS)if(re.test(text))return name;
  return 'general';
}

const articles=[];
const topicRows=[];
for(const release of index.releases){
  const path=join(cache,release.release+'.html');
  let bytes;
  if(refresh||!existsSync(path))bytes=download(release.url,path);
  else bytes=readFileSync(path);
  const html=bytes.toString('utf8');
  const body=withoutTables(articleContainer(html));
  const articleHash=sha256(body);
  const rows=[];
  for(const chunk of chunks(body)){
    if(!/^(?:Additions|Changes|Technical|Fixes|Removals|Experimental)$/i.test(chunk.section))continue;
    for(const text of topicsIn(chunk.html)){
      const row={release:release.release,section:chunk.section,subsection:chunk.subsection||null,text};
      Object.assign(row,disposition(row,chunk.section));
      row.area=area(text);
      rows.push(row);
    }
  }
  assert.ok(rows.length>0,release.release+' produced no release-note topics');
  articles.push({release:release.release,url:release.url,retrieval:'curl',fullSha256:sha256(bytes),bytes:bytes.length,articleSha256:articleHash,articleBytes:body.length,topics:rows.length});
  topicRows.push(...rows);
  console.log(release.release+': '+rows.length+' topics, article '+articleHash.slice(0,12));
}

// Official release-manifest cross-check: the article set must be exactly the release rows
// Mojang publishes for these ids, and all 17 must be type=release.
const manifestPath=join(cache,'..','version-manifest.json');
let manifestBytes;
if(refresh||!existsSync(manifestPath))manifestBytes=download('https://piston-meta.mojang.com/mc/game/version_manifest_v2.json',manifestPath);
else manifestBytes=readFileSync(manifestPath);
const manifest=JSON.parse(manifestBytes.toString('utf8'));
const wanted=new Set(index.releases.map(release=>release.release));
const official=[];
for(const version of manifest.versions){
  if(!wanted.has(version.id))continue;
  assert.equal(version.type,'release',version.id+' is not a release in the official manifest');
  official.push({id:version.id,type:version.type,releaseTime:version.releaseTime,sha1:version.sha1,complianceLevel:version.complianceLevel??null});
}
assert.equal(official.length,wanted.size,'the official manifest does not carry every crosswalk release');
for(const id of wanted)assert.ok(official.some(version=>version.id===id),'official manifest is missing '+id);
official.sort((a,b)=>index.releases.findIndex(r=>r.release===a.id)-index.releases.findIndex(r=>r.release===b.id));
const officialDocument={target:'26.3',recordedOn:'2026-11-27',url:'https://piston-meta.mojang.com/mc/game/version_manifest_v2.json',method:'curl with a descriptive user agent',manifestSha256:sha256(manifestBytes),releases:official};

const byDisposition={},byRelease={},bySection={},byArea={};
for(const row of topicRows){
  byDisposition[row.disposition]=(byDisposition[row.disposition]||0)+1;
  bySection[row.section]=(bySection[row.section]||0)+1;
  byArea[row.area]=(byArea[row.area]||0)+1;
  byRelease[row.release]??={total:0,dispositions:{}};
  byRelease[row.release].total++;
  byRelease[row.release].dispositions[row.disposition]=(byRelease[row.release].dispositions[row.disposition]||0)+1;
}
const crosswalk={
  schemaVersion:1,
  target:'26.3',
  recordedOn:'2026-11-27',
  baselineVersion:'1.20.6',
  method:'cached wiki article HTML parsed into top-level release-note topics; dispositions assigned by the documented rules in tools/port-26.3/release-crosswalk.mjs',
  rule:'experiment-gated > product-outside-scope > server-owned > native-client',
  officialCrossCheck:officialDocument.releases.map(version=>version.id),
  sourceArticles:articles,
  counts:{topics:topicRows.length,byDisposition,bySection,byArea,byRelease},
  topics:topicRows
};
const markdown=[
  '# 26.3 release-history crosswalk',
  '',
  'Generated by `tools/port-26.3/release-crosswalk.mjs` on 2026-11-27. This is a disposition ledger,',
  'not a claim that every native-client topic has been visually accepted.',
  '',
  `**${topicRows.length} topics** from ${articles.length} release articles.`,
  '',
  '| Disposition | Topics |',
  '| --- | ---: |',
  ...Object.entries(byDisposition).sort((a,b)=>b[1]-a[1]).map(([name,count])=>`| ${name} | ${count} |`),
  '',
  '| Release | Topics | native-client | experiment-gated | server-owned | product-outside-scope |',
  '| --- | ---: | ---: | ---: | ---: | ---: |',
  ...Object.entries(byRelease).map(([release,info])=>`| ${release} | ${info.total} | ${info.dispositions['native-client']||0} | ${info.dispositions['experiment-gated']||0} | ${info.dispositions['server-owned']||0} | ${info.dispositions['product-outside-scope']||0} |`),
  '',
  '## Source verification',
  '',
  'Every page was fetched with direct `curl`, accepted only after the article container and release-note',
  'headings were present, and hashed. The full-page bytes and the extracted article bytes are recorded',
  'separately because wiki chrome changes without changing the release notes.',
  '',
  '| Release | URL | Full SHA-256 | Article SHA-256 | Topics |',
  '| --- | --- | --- | --- | ---: |',
  ...articles.map(article=>`| ${article.release} | ${article.url} | \`${article.fullSha256}\` | \`${article.articleSha256}\` | ${article.topics} |`),
  '',
  'Official release-manifest cross-check: all 17 ids are `type=release` in',
  '`https://piston-meta.mojang.com/mc/game/version_manifest_v2.json`; see',
  '`docs/transition-26.3.official-versions.json`.',
  '',
  '## Rules',
  '',
  '- A topic is a top-level bullet under Additions, Changes, Technical, Fixes, Removals or Experimental; nested bullets describe their parent topic.',
  '- `experiment-gated` applies when the topic or its section names an experiment/feature flag.',
  '- `product-outside-scope` applies to Realms, world creation/LAN, launcher, marketplace, account, telemetry and reporting.',
  '- `server-owned` applies to dedicated-server/RCON/allow-list/ban/server.properties/server-list behaviour.',
  '- Everything else is `native-client`: the client must implement or present it.',
  '- The per-release area and the full topic list are in `docs/transition-26.3.crosswalk.json` for P11 coverage review.',
  ''
].join('\n');

if(check){
  assert.deepEqual(JSON.parse(readFileSync(jsonPath,'utf8')),crosswalk,'release crosswalk needs regeneration');
  assert.equal(readFileSync(mdPath,'utf8'),markdown,'release crosswalk markdown needs regeneration');
  assert.deepEqual(JSON.parse(readFileSync(officialPath,'utf8')),officialDocument,'official version manifest cross-check needs regeneration');
  console.log('Verified '+topicRows.length+' release topics against '+articles.length+' cached articles');
}else{
  // Refresh the recorded full-page bytes/hash when the wiki chrome changed. The previous
  // full-page hash is retained so the re-fetch is auditable.
  const updated={...index,recordedOn:'2026-11-27',method:'direct curl with a descriptive user agent'};
  updated.releases=index.releases.map(release=>{
    const article=articles.find(entry=>entry.release===release.release);
    return {
      ...release,
      status:'200',
      bytes:article.bytes,
      sha256:article.fullSha256,
      previousSha256:release.sha256===article.fullSha256?release.previousSha256??null:release.sha256,
      articleBytes:article.articleBytes,
      articleSha256:article.articleSha256,
      topics:article.topics,
      treatedAsArticle:true
    };
  });
  writeFileSync(indexPath,JSON.stringify(updated,null,2)+'\n');
  writeFileSync(officialPath,JSON.stringify(officialDocument,null,2)+'\n');
  writeFileSync(jsonPath,JSON.stringify(crosswalk,null,2)+'\n');
  writeFileSync(mdPath,markdown);
  console.log('Wrote '+topicRows.length+' topics across '+articles.length+' releases');
}
