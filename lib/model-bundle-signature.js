const fs=require('fs'),path=require('path'),crypto=require('crypto');
const ROOT=path.join(__dirname,'..');
const digest=(bytes,algorithm='sha256')=>crypto.createHash(algorithm).update(bytes).digest('hex');
function modelSourceSignature(root=ROOT){
  const inputs=[];
  for(const name of fs.readdirSync(path.join(root,'lib')))if(/^(?:model.*\.(?:js|java)|jvm\.js|bytecode\.js)$/i.test(name)&&name!=='model-bundle-signature.js')inputs.push('lib/'+name);
  const tools=path.join(root,'tools');
  if(fs.existsSync(tools))for(const entry of fs.readdirSync(tools,{withFileTypes:true})){
    if(entry.isFile()&&/model.*\.java$/i.test(entry.name))inputs.push('tools/'+entry.name);
    if(entry.isDirectory()&&entry.name.startsWith('port-'))for(const name of fs.readdirSync(path.join(tools,entry.name)))if(name==='model-layers.json'||/^(?:Extract.*(?:Model|Layer)|Model).*\.java$/i.test(name))inputs.push('tools/'+entry.name+'/'+name);
  }
  const hash=crypto.createHash('sha256');for(const name of inputs.sort()){hash.update(name+'\0');hash.update(fs.readFileSync(path.join(root,name)));hash.update('\0');}return hash.digest('hex');
}
function modelBundleStamp(jar,bundle,root=ROOT){return{schemaVersion:1,sourceSignature:modelSourceSignature(root),clientJarSha1:digest(jar,'sha1'),bundleSha256:digest(bundle)};}
function builtModelBundleMatches(stamp,jar,bundle,root=ROOT){
  if(stamp?.schemaVersion!==1)return false;
  const current=modelBundleStamp(jar,bundle,root);return Object.keys(current).every(key=>stamp[key]===current[key]);
}
module.exports={modelSourceSignature,modelBundleStamp,builtModelBundleMatches};
