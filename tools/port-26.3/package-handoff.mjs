// P16: clean 26.3 handoff packaging.
//
// Builds a deterministic zip from tracked sources only. Mojang jars, derived caches, local
// servers/worlds, logs, credentials and screenshots are excluded. The archive is accompanied
// by a per-file SHA-256 manifest in docs/ and a .sha256 next to the zip.
//
// Usage: node tools/port-26.3/package-handoff.mjs [--allow-dirty]
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {existsSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {deflateRawSync} from 'node:zlib';
import assert from 'node:assert/strict';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
const branch=git('rev-parse','--abbrev-ref','HEAD');
assert.equal(branch,'26.3','package-handoff must run on branch 26.3');
const commit=git('rev-parse','HEAD');
const short=commit.slice(0,12);
const dirty=Boolean(git('status','--porcelain','--untracked-files=no'));
if(dirty&&!process.argv.includes('--allow-dirty'))throw Error('tracked worktree changes must be committed before packaging (or pass --allow-dirty)');

// Keep this list in sync with .gitignore and the handoff rules. A tracked forbidden file is a
// packaging error, not something to silently omit.
const EXCLUDED=[
  [/^cache\//,'native/derived cache'],
  [/^node_modules\//,'installed dependencies'],
  [/^server\d+\//,'local test server/world'],
  [/^dist\//,'build output'],
  [/^\.freebuff\//,'tool state'],
  [/\.jar$/,'Mojang/native jar'],
  [/^docs\/[^/]+\.png$/,'screenshots'],
  [/^docs\/transition-26.3\.package-manifest\.json$/,'package manifest (committed separately)'],
  [/\.(?:log|out)$/,'transient log'],
  [/^MinecraftJS-26\.3-.*\.zip$/,'previous handoff archive']
];
const SOFT=new Set(['installed dependencies','build output','tool state','package manifest (committed separately)','previous handoff archive']);
const files=git('ls-files','-z').split('\0').filter(Boolean);
const forbidden=[];
const included=[];
for(const path of files){
  const hit=EXCLUDED.find(([re])=>re.test(path));
  if(hit){if(!SOFT.has(hit[1]))forbidden.push(path);continue;}
  const data=readFileSync(join(root,path));
  included.push({path,data});
}
assert.deepEqual(forbidden,[],'tracked files hit the handoff exclusion list: '+forbidden.join(', '));
assert.ok(included.length>100,'handoff source set is unexpectedly small');
included.sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0);

const manifestFiles=included.map(({path,data})=>({path,bytes:data.length,sha256:sha256(data)}));
const packageManifest={
  schemaVersion:1,
  target:'26.3',
  branch,
  commit,
  workingTreeDirty:dirty,
  generatedOn:new Date().toISOString(),
  fileCount:included.length,
  bytes:included.reduce((sum,file)=>sum+file.data.length,0),
  exclusions:EXCLUDED.map(([re,reason])=>re.source+' -> '+reason),
  files:manifestFiles
};
const manifestBytes=Buffer.from(JSON.stringify(packageManifest,null,2)+'\n');
// The in-archive manifest describes the same files without the archive hash, so the zip is
// self-verifying and the repository copy can record the archive digest.
included.push({path:'HANDOFF-MANIFEST.json',data:manifestBytes});

const CRC_TABLE=(()=>{
  const table=new Uint32Array(256);
  for(let n=0;n<256;n++){
    let c=n;
    for(let k=0;k<8;k++)c=(c&1)?(0xedb88320^(c>>>1)):(c>>>1);
    table[n]=c>>>0;
  }
  return table;
})();
function crc32(bytes){
  let c=0xffffffff;
  for(const byte of bytes)c=CRC_TABLE[(c^byte)&255]^(c>>>8);
  return (c^0xffffffff)>>>0;
}
function dosTime(date){
  const year=Math.max(1980,date.getUTCFullYear());
  return {
    time:((date.getUTCHours()<<11)|(date.getUTCMinutes()<<5)|Math.floor(date.getUTCSeconds()/2))&0xffff,
    date:(((year-1980)<<9)|((date.getUTCMonth()+1)<<5)|date.getUTCDate())&0xffff
  };
}
function zip(files){
  const chunks=[],central=[];
  let offset=0;
  const stamp=dosTime(new Date(commitTime*1000));
  for(const file of files){
    const name=Buffer.from(file.path,'utf8');
    const compressed=deflateRawSync(file.data,{level:9});
    const method=compressed.length<file.data.length?8:0;
    const payload=method===8?compressed:file.data;
    const crc=crc32(file.data);
    const local=Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50,0);
    local.writeUInt16LE(20,4);
    local.writeUInt16LE(0x0800,6);
    local.writeUInt16LE(method,8);
    local.writeUInt16LE(stamp.time,10);
    local.writeUInt16LE(stamp.date,12);
    local.writeUInt32LE(crc,14);
    local.writeUInt32LE(payload.length,18);
    local.writeUInt32LE(file.data.length,22);
    local.writeUInt16LE(name.length,26);
    local.writeUInt16LE(0,28);
    chunks.push(local,name,payload);
    const dir=Buffer.alloc(46);
    dir.writeUInt32LE(0x02014b50,0);
    dir.writeUInt16LE(20,4);
    dir.writeUInt16LE(20,6);
    dir.writeUInt16LE(0x0800,8);
    dir.writeUInt16LE(method,10);
    dir.writeUInt16LE(stamp.time,12);
    dir.writeUInt16LE(stamp.date,14);
    dir.writeUInt32LE(crc,16);
    dir.writeUInt32LE(payload.length,20);
    dir.writeUInt32LE(file.data.length,24);
    dir.writeUInt16LE(name.length,28);
    dir.writeUInt16LE(0,30);
    dir.writeUInt16LE(0,32);
    dir.writeUInt16LE(0,34);
    dir.writeUInt16LE(0,36);
    dir.writeUInt32LE(0,38);
    dir.writeUInt32LE(offset,42);
    central.push(dir,name);
    offset+=local.length+name.length+payload.length;
  }
  const centralBytes=Buffer.concat(central);
  const end=Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50,0);
  end.writeUInt16LE(0,4);
  end.writeUInt16LE(0,6);
  end.writeUInt16LE(files.length,8);
  end.writeUInt16LE(files.length,10);
  end.writeUInt32LE(centralBytes.length,12);
  end.writeUInt32LE(offset,16);
  end.writeUInt16LE(0,20);
  return Buffer.concat([...chunks,centralBytes,end]);
}
const commitTime=Number(git('log','-1','--format=%ct'));
const archive=zip(included);
const archiveName='MinecraftJS-26.3-'+short+'.zip';
const dist=join(root,'dist');
mkdirSync(dist,{recursive:true});
const archivePath=join(dist,archiveName);
writeFileSync(archivePath,archive);
const archiveSha=sha256(archive);
writeFileSync(archivePath+'.sha256',archiveSha+'  '+archiveName+'\n');

packageManifest.archive={name:archiveName,bytes:archive.length,sha256:archiveSha};
packageManifest.archiveContents={files:included.length,bytes:included.reduce((sum,file)=>sum+file.data.length,0)};
const manifestPath=join(root,'docs/transition-26.3.package-manifest.json');
writeFileSync(manifestPath,JSON.stringify(packageManifest,null,2)+'\n');
console.log('Packaged '+archiveName+': '+included.length+' files / '+packageManifest.archiveContents.bytes+' uncompressed bytes');
console.log('SHA-256 '+archiveSha);
console.log('Manifest '+manifestPath);
