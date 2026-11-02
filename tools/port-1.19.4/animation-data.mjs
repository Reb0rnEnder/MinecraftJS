import {execFileSync} from 'node:child_process';
import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {createRequire} from 'node:module';
import {root,cache} from './prepare.mjs';
const require=createRequire(import.meta.url),{nativeClasspath}=require('../../lib/native-classpath-1.19.4.js');
const run=(name,out)=>execFileSync(process.env.JAVA||'java',['-cp',nativeClasspath(cache),join(root,'tools/port-1.19.4',name+'.java'),out,join(cache,'client.txt')],{cwd:cache,stdio:'inherit',maxBuffer:8*1024*1024});
run('ExtractAnimations',join(cache,'animations.json'));
const animations=JSON.parse(await readFile(join(cache,'animations.json')));
await writeFile(join(root,'client/js/render/animations-1.19.4.js'),'// Native 1.19.4 AnimationDefinition channels, extracted from the pinned jar.\nexport const ANIMATIONS_762='+JSON.stringify(animations)+';\n');
// Pose expectations come from Minecraft's Java sampler, never the JS implementation.
run('SampleAnimations',join(root,'tools/fixtures/keyframes-1.19.4.json'));
