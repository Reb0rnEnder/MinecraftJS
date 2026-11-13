import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import {delimiter,join} from 'node:path';
import {nativeClasspath} from '../../lib/native-classpath.js';
import {ZipFile} from '../../lib/zip.js';
import {cache,root,target,verify} from './prepare.mjs';
verify(await readFile(join(cache,'client.jar')),target.downloads.client,'client jar');
const jar=new ZipFile(join(cache,'client.jar')),unsigned=new ZipFile(join(cache,'client-model-oracle.jar'));
for(const name of jar.list('').filter(n=>/^fk[orstuvwx](?:\$[^/]*)?\.class$/.test(n))){
  if(!jar.read(name).equals(unsigned.read(name)))throw Error('Modified native layout class '+name);
}
const classpath=nativeClasspath(cache).split(delimiter);classpath[0]=join(cache,'client-model-oracle.jar');
const source=join(root,'tools/port-1.20.6/ExtractUiLayout1206.java');
const stdout=execFileSync(process.env.JAVA||'java',['-cp',classpath.join(delimiter),source],{encoding:'utf8',maxBuffer:1024*1024});
const cases=JSON.parse(stdout.trim().split('\n').find(line=>line.startsWith('[{')));
const data=JSON.stringify({clientJarSha1:target.downloads.client.sha1,oracleSha256:createHash('sha256').update(await readFile(source)).digest('hex'),cases},null,2)+'\n';
const output=join(root,'tools/port-1.20.6/ui-layout-fixtures.json');
if(process.argv.includes('--check')){if(await readFile(output,'utf8')!==data)throw Error('Stale native UI layout fixtures');}
else await writeFile(output,data);
console.log('Native HeaderAndFooterLayout/GridLayout: '+cases.length+' viewport fixtures verified');
