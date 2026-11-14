import{readFileSync}from'node:fs';import{createHash}from'node:crypto';import{join}from'node:path';import{ZipFile}from'../../lib/zip.js';import{root,cache,target,verify}from'./prepare.mjs';
const jar=new ZipFile(join(cache,'client.jar')),indexBytes=readFileSync(join(cache,'asset-index.json'));verify(jar.data,target.downloads.client,'font jar');verify(indexBytes,target.assetIndex,'font asset index');const index=JSON.parse(indexBytes);
export function fontBytes(name){const object=index.objects[name];if(!object)return jar.read('assets/'+name);const bytes=readFileSync(join(root,'client/assets',name));verify(bytes,{sha1:object.hash,size:object.size},name);return bytes;}
export function fontInputs(){
 const chars=Array.from('AąĄćĆęĘłŁńŃóÓśŚźŹżŻЖ→中文骨直令あｱ한😀🦨\u2000\u2001\u2002\u3000\u0000');
 const defs=JSON.parse(fontBytes('minecraft/font/include/unifont.json')).providers;
 const native=defs.map((definition,i)=>({label:i?'unifont':'japanese',definition,resource:definition.hex_file.replace(':','/'),characters:chars}));
 const hex=[8,16,24,32].map((w,i)=>(0xe000+i).toString(16).toUpperCase()+':'+('8'+'0'.repeat(w/4-2)+'1').repeat(16)+'\n').join('')+'E004:'+('0'.repeat(32))+'\n';
 native.push({label:'widths-and-overrides',definition:{hex_file:'test:synthetic.zip',size_overrides:[{from:'\ue001',to:'\ue003',left:-1,right:16},{from:'\ue002',to:'\ue004',left:0,right:7}]},hex,characters:Array.from('\ue000\ue001\ue002\ue003\ue004\ue005')});return native;
}
