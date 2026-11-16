import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import encoder from '../lib/audio-encoder.js';
const {AudioEncoder,findFfmpeg,validateAudioOptions}=encoder;

test('audio options select Opus by default and reject ambiguous codecs/rates',()=>{
  assert.equal(new AudioEncoder({}).codec,'opus');
  for(const audio of ['opus','vorbis','copy'])assert.doesNotThrow(()=>validateAudioOptions({audio}));
  for(const audio of ['',true,'mp3','opuss'])assert.throws(()=>validateAudioOptions({audio}),/--audio/);
  for(const rate of ['',true,0,-32,'32kbps',32.5,513])assert.throws(()=>validateAudioOptions({'sfx-kbps':rate}),/sfx-kbps/);
  assert.throws(()=>validateAudioOptions({'music-kbps':511}),/510/);
  assert.doesNotThrow(()=>validateAudioOptions({'sfx-kbps':64,'music-kbps':'96'}));
});

test('CLI documents codec choices and rejects invalid audio before loading game assets',()=>{
  const cli=(...args)=>spawnSync(process.execPath,['tools/build.js','html',...args],{encoding:'utf8'});
  const help=cli('--help');assert.equal(help.status,0);assert.match(help.stdout,/--audio=opus\|vorbis\|copy \(default opus\)/);
  const invalid=cli('--audio=typo');assert.equal(invalid.status,1);assert.match(invalid.stderr,/--audio must be/);assert.doesNotMatch(invalid.stdout,/Client jar|Downloading/);
});

test('real Opus and Vorbis encode, cache, decode and retain the original when smaller',async()=>{
  const ffmpeg=findFfmpeg();assert.ok(ffmpeg,'Install ffmpeg or set FFMPEG to run encoder regressions');
  const dir=mkdtempSync(join(tmpdir(),'minecraftjs-audio-'));
  try{
    const source=spawnSync(ffmpeg,['-hide_banner','-loglevel','error','-f','lavfi','-i','sine=frequency=440:duration=2:sample_rate=48000','-ac','2','-c:a','pcm_s16le','-f','wav','pipe:1'],{maxBuffer:1<<24});assert.equal(source.status,0);
    for(const codec of ['opus','vorbis']){
      const enc=new AudioEncoder({audio:codec,cacheDir:dir}),bytes=await enc.encode('music/test',source.stdout);
      assert.ok(bytes.length<source.stdout.length/3);
      assert.ok(bytes.includes(Buffer.from(codec==='opus'?'OpusHead':'vorbis')));
      assert.deepEqual(await enc.encode('music/test',source.stdout),bytes,'cache must preserve exact output');
      const decoded=spawnSync(ffmpeg,['-hide_banner','-loglevel','error','-i','pipe:0','-f','s16le','pipe:1'],{input:bytes,maxBuffer:1<<24});assert.equal(decoded.status,0);assert.ok(decoded.stdout.length>300000);
      const mono=await enc.encode('random/test',source.stdout);assert.ok(mono.length<source.stdout.length/3);
    }
    const copy=new AudioEncoder({audio:'copy',cacheDir:dir});assert.equal(await copy.encode('x',source.stdout),source.stdout);
    const tiny=spawnSync(ffmpeg,['-hide_banner','-loglevel','error','-f','lavfi','-i','anullsrc=r=48000:cl=mono','-t','0.001','-c:a','libopus','-f','ogg','pipe:1']).stdout;
    const enc=new AudioEncoder({audio:'opus',cacheDir:dir});assert.ok((await enc.encode('tiny',tiny)).length<=tiny.length);
    await assert.rejects(enc.encode('empty',Buffer.alloc(0)),/Empty sound/);
  }finally{rmSync(dir,{recursive:true,force:true});}
});
