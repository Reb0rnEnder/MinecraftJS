// Regenerate client/js/game/entity-metadata-native.js: every entity type's native EntityDataAccessor ids, extracted
// from the pinned client by tools/ExtractMetadata.java.
import {execFileSync} from 'node:child_process';
import {existsSync,readdirSync} from 'node:fs';
import {readFile,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {delimiter,join} from 'node:path';
const VERSION='1.14.4',root=new URL('..',import.meta.url).pathname,cache=join(root,'cache/port-'+VERSION);
const jars=dir=>existsSync(dir)?readdirSync(dir,{recursive:true}).filter(n=>n.endsWith('.jar')).sort().map(n=>join(dir,n)):[];
let cp;
if(existsSync(join(root,'lib/native-classpath.js')))cp=createRequire(import.meta.url)(join(root,'lib/native-classpath.js')).nativeClasspath(cache);
else if(existsSync(join(cache,'bundler')))cp=[join(cache,'client.jar'),...jars(join(cache,'bundler/META-INF/libraries'))].join(delimiter);
else cp=[join(cache,'client.jar'),join(cache,'server.jar')].join(delimiter);
const stdout=execFileSync(process.env.JAVA||'java',['-cp',cp,join(root,'tools/ExtractMetadata.java'),join(cache,'client.txt')],{encoding:'utf8',maxBuffer:1<<26,stdio:['ignore','pipe','ignore']});
const json=stdout.slice(stdout.indexOf('{"')).split('\n')[0],data=JSON.parse(json);
const source=`// Native ${VERSION} EntityDataAccessor ids for every entity type, extracted from the pinned client by
// tools/metadata-native.mjs. Do not edit by hand.
export const NATIVE_ENTITY_METADATA=${JSON.stringify(data)};
`;
const out=join(root,'client/js/game/entity-metadata-native.js');
if(process.argv.includes('--check')){if(await readFile(out,'utf8')!==source)throw Error('Stale native entity metadata; run tools/metadata-native.mjs');}
else await writeFile(out,source);
console.log('Native '+VERSION+' metadata: '+Object.keys(data).length+' entity types');
