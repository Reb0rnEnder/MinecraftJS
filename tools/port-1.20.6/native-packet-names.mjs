// Native packet identities, not minecraft-data's compatibility aliases.
import {execFileSync} from 'node:child_process';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {join,delimiter} from 'node:path';
import {homedir} from 'node:os';
import {nativeClasspath} from '../../lib/native-classpath.js';
import {ZipFile} from '../../lib/zip.js';
import {root,cache,target,verify} from './prepare.mjs';
verify(await readFile(join(cache,'client.jar')),target.downloads.client,'client jar');
const mappings=await readFile(join(cache,'client.txt'),'utf8');verify(Buffer.from(mappings),target.downloads.client_mappings,'client mappings');
const alias=/^net\.minecraft\.network\.protocol\.game\.GameProtocols -> (\w+):/m.exec(mappings)[1];
const out=join(cache,'packet-names-src');await mkdir(out,{recursive:true});
execFileSync(process.env.JAVA||'java',['-jar',process.env.CFR_JAR||join(homedir(),'.cache/minecraftjs-parity-tools/cfr.jar'),join(cache,'client.jar'),'--jarfilter',alias,'--outputdir',out,'--silent','true'],{stdio:'pipe'});
const code=await readFile(join(out,alias+'.java'),'utf8');
const jar=new ZipFile(join(cache,'client.jar')),unsigned=new ZipFile(join(cache,'client-model-oracle.jar'));
const definitions=[];
for(const [field,direction] of [['b','CLIENTBOUND'],['a','SERVERBOUND']]){
 const line=code.split('\n').find(line=>new RegExp('public static final [^\\n]+ '+field+' =').test(line));
 const fields=[...line.matchAll(/\.a\((\w+\.\w+),/g)].map(m=>m[1]);
 for(const owner of new Set(fields.map(f=>f.split('.')[0])))if(!jar.read(owner+'.class').equals(unsigned.read(owner+'.class')))throw Error('Modified native packet identities '+owner);
 const parts=nativeClasspath(cache).split(delimiter);parts[0]=join(cache,'client-model-oracle.jar');
 const output=execFileSync(process.env.JAVA||'java',['-cp',parts.join(delimiter),join(root,'tools/port-1.20.6/PrintPacketNames.java'),...fields],{encoding:'utf8',maxBuffer:1024*1024});
 const names=JSON.parse(output.trim().split('\n').find(line=>line.startsWith('[')));
 if(names.length!==(direction==='CLIENTBOUND'?122:58))throw Error('Unexpected native Play packet count '+direction+': '+names.length);
 definitions.push('export const NATIVE_PLAY_'+direction+'_NAMES_766=Object.freeze('+JSON.stringify(names)+');');
}
const source='// Native 1.20.6 GameProtocols registration order; client SHA-1 '+target.downloads.client.sha1+'.\n'+definitions.join('\n')+'\n',file=join(root,'client/js/net/native-packet-names-1.20.6.js');
if(process.argv.includes('--check')){if(await readFile(file,'utf8')!==source)throw Error('Stale native packet identities');}else await writeFile(file,source);
console.log('Verified native Play packet identities');
