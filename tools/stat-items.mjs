// Regenerate client/js/game/stat-items.js by running tools/ExtractStatItems.java against the pinned client.
import {execFileSync} from 'node:child_process';
import {existsSync,readdirSync} from 'node:fs';
import {readFile,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {delimiter,join} from 'node:path';
const VERSION='1.16.5',root=new URL('..',import.meta.url).pathname,cache=join(root,'cache/port-'+VERSION);
const jars=dir=>existsSync(dir)?readdirSync(dir,{recursive:true}).filter(n=>n.endsWith('.jar')).sort().map(n=>join(dir,n)):[];
let cp;
if(existsSync(join(root,'lib/native-classpath.js')))cp=createRequire(import.meta.url)(join(root,'lib/native-classpath.js')).nativeClasspath(cache);
else if(existsSync(join(cache,'bundler')))cp=[join(cache,'client.jar'),...jars(join(cache,'bundler/META-INF/libraries'))].join(delimiter);
else cp=[join(cache,'client.jar'),join(cache,'server.jar')].join(delimiter); // pre-1.18 servers bundle the libraries
const stdout=execFileSync(process.env.JAVA||'java',['-cp',cp,join(root,'tools/ExtractStatItems.java'),join(cache,'client.txt')],{encoding:'utf8',maxBuffer:1<<24,stdio:['ignore','pipe','ignore']});
const data=JSON.parse(stdout.slice(stdout.indexOf('{"blockToItem"')).split('\n')[0]);
const source=`// Native ${VERSION} Block.asItem() / BlockItem.getBlock() pairs whose names differ ("air" = no item, null = not a
// block item), extracted from the pinned client by tools/stat-items.mjs. Unlisted names map to themselves.
export const BLOCK_TO_ITEM=${JSON.stringify(data.blockToItem)};
export const ITEM_TO_BLOCK=${JSON.stringify(data.itemToBlock)};
`;
const out=join(root,'client/js/game/stat-items.js');
if(process.argv.includes('--check')){if(await readFile(out,'utf8')!==source)throw Error('Stale stat item data; run tools/stat-items.mjs');}
else await writeFile(out,source);
console.log('Native '+VERSION+' stat items: '+Object.keys(data.blockToItem).length+' block, '+Object.keys(data.itemToBlock).length+' item differences');
