// Re-run the exact native predicate oracle; --write deliberately refreshes vectors.
import{readFile,writeFile,readdir,mkdir}from'node:fs/promises';import{join,delimiter}from'node:path';import{execFile}from'node:child_process';import{promisify}from'node:util';import assert from'node:assert/strict';
import{root,cache,target,verify}from'./prepare.mjs';
const jar=join(cache,'client.jar'),mappings=join(cache,'client.txt');verify(await readFile(jar),target.downloads.client.sha1,'client jar');verify(await readFile(mappings),target.downloads.client_mappings.sha1,'client mappings');
async function jars(dir){const paths=[];for(const e of await readdir(dir,{withFileTypes:true})){const path=join(dir,e.name);if(e.isDirectory())paths.push(...await jars(path));else if(e.name.endsWith('.jar'))paths.push(path);}return paths;}
const directory=join(cache,'audit/adventure');await mkdir(directory,{recursive:true});const output=join(directory,'native-predicates.json'),fixture=join(root,'tools/fixtures/adventure-native-1.19.4.json');
await promisify(execFile)(process.env.JAVA||'java',['-cp',[jar,...(await jars(join(cache,'bundler/META-INF/libraries'))).sort()].join(delimiter),join(root,'tools/port-1.19.4/VerifyAdventure.java'),mappings,join(root,'tools/fixtures/adventure-inputs-1.19.4.json'),output],{cwd:root,maxBuffer:4*1024*1024});
const actual=JSON.parse(await readFile(output));if(process.argv.includes('--write'))await writeFile(fixture,JSON.stringify(actual,null,2)+'\n');else assert.deepEqual(actual,JSON.parse(await readFile(fixture)));
console.log('Native 1.19.4 Adventure predicates: '+actual.cases.length+' cases match the pinned client.');
