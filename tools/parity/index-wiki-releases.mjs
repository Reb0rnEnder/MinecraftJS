// Rebuild the factual release inventory from downloaded MediaWiki API wikitext.
// node tools/parity/index-wiki-releases.mjs /path/to/cached-wikitext
import{readFileSync,writeFileSync}from'node:fs';import{createHash}from'node:crypto';import{resolve}from'node:path';
const directory=process.argv[2];if(!directory)throw Error('Pass a directory containing <version>.wikitext and sources.json');
const clean=text=>text.replace(/\[\[(?:File|Image):[^\]]*\]\]/gi,'').replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g,'$2').replace(/\[\[([^\]]+)\]\]/g,'$1').replace(/\{\{cmd\|([^}|]+)[^}]*\}\}/g,'/$1').replace(/\{\{[^}]*\}\}/g,'').replace(/<[^>]+>/g,'').replace(/'{2,}/g,'').replace(/&nbsp;/g,' ').trim();
const sources=JSON.parse(readFileSync(resolve(directory,'sources.json'))),releases=[];
for(const source of sources){
 const raw=readFileSync(resolve(directory,source.version+'.wikitext'),'utf8');if(createHash('sha256').update(raw).digest('hex')!==source.sha256)throw Error('Wiki cache hash mismatch: '+source.version);
 let section='',category='';const topics=[];
 for(const line of raw.split('\n')){
  const heading=line.match(/^(={2,4})\s*(.*?)\s*\1\s*$/);if(heading){const title=clean(heading[2]);if(heading[1].length===2){section=title;category='General';}else if(heading[1].length===3)category=title;else if(['Additions','Changes'].includes(section))topics.push({section,category,topic:title});continue;}
  const bold=line.match(/^'''(.+?)'''\s*$/);if(bold&&['Additions','Changes'].includes(section)){const topic=clean(bold[1]);if(topic)topics.push({section,category,topic});}
 }
 const fixes=raw.split(/^== Fixes ==\s*$/m)[1]?.split(/^==[^=]/m)[0]||'';
 const bugs=[...new Set([...fixes.matchAll(/^\|(\d+)\|/gm)].map(m=>'MC-'+m[1]).concat([...fixes.matchAll(/MC-\d+/g)].map(m=>m[0])))];
 const clientJarSha1=raw.match(/^\|\s*clienthash\s*=\s*([a-f0-9]{40})/m)?.[1]||null;
 releases.push({...source,clientJarSha1,topics,bugIds:bugs,acceptance:'not-certified'});
}
const output={reviewedOn:'2026-10-27',scope:'Java 1.8 through 1.15.2 release pages, including the intermediate 1.9/1.10/1.11 baselines. Headings and bug IDs are an inventory, not runtime acceptance of every bullet.',releases};
writeFileSync(new URL('wiki-release-index.json',import.meta.url),JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify({pages:releases.length,topics:releases.reduce((n,r)=>n+r.topics.length,0),listedBugIds:releases.reduce((n,r)=>n+r.bugIds.length,0)}));
