const {nativeClasspath}=require('./native-classpath-1.19.4');
// Bake the official 1.19.4 layer definitions, then expose semantic animation slots.
const fs=require('fs'),path=require('path'),crypto=require('crypto');const{execFileSync}=require('child_process');
exports.extractModels=function(jar){
 const root=path.join(__dirname,'..'),cache=path.join(root,'cache/port-1.19.4'),client=path.join(cache,'client.jar'),expected='958928a560c9167687bea0cefeb7375da1e552a8',hash=data=>crypto.createHash('sha1').update(data).digest('hex');
 if(hash(jar.data)!==expected||hash(fs.readFileSync(client))!==expected)throw Error('Native model extraction requires the pinned 1.19.4 jar');
 execFileSync('java',['-cp',nativeClasspath(cache),path.join(root,'tools/port-1.19.4/ExtractLayers.java'),path.join(cache,'layers.json'),path.join(cache,'client.txt')],{stdio:['ignore','pipe','pipe']});
 const layers=JSON.parse(fs.readFileSync(path.join(cache,'layers.json'))),specs=JSON.parse(fs.readFileSync(path.join(root,'tools/port-1.19.4/model-layers.json'))),models={},errors=[];
 const named=layer=>new Map(layer.parts.flatMap(part=>Object.entries(part.namedChildren)));
 for(const[key,spec]of Object.entries(specs))try{
  if(key==='bed'){
   const head=layers[spec.headLayer],foot=layers[spec.footLayer],offset=head.parts.length,h=named(head),f=named(foot);
   const parts=[...head.parts,...foot.parts.map(p=>({...p,children:p.children.map(i=>i+offset)}))];
   models[key]={parts,fields:[h.get('main'),f.get('main')+offset,[f.get('left_leg')+offset,h.get('left_leg'),f.get('right_leg')+offset,h.get('right_leg')]],nums:[],nativeLayer:[spec.headLayer,spec.footLayer]};continue;
  }
  const layer=layers[spec.layer];if(!layer)throw Error('Missing native layer '+spec.layer);const names=named(layer);
  const id=name=>{if(name===null)return null;if(name==="$root")return layer.root;const value=names.get(name);if(value===undefined)throw Error('Missing native part '+name);return value;};
  models[key]={parts:layer.parts,fields:spec.fields.map(value=>Array.isArray(value)?value.map(id):id(value)),nums:[],slotNames:spec.fields,nativeLayer:spec.layer};
 }catch(e){errors.push(key+': '+e.message);}
 return{models,errors};
};
