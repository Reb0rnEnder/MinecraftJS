// Derive native 1.20.6 option arrays through the mapped Options getters.
import{execFileSync}from'node:child_process';import{readFile,writeFile,mkdir}from'node:fs/promises';import{join}from'node:path';import{homedir}from'node:os';
import{cache,root,target,verify}from'./prepare.mjs';
verify(await readFile(join(cache,'client.jar')),target.downloads.client,'client jar');
const mapping=await readFile(join(cache,'client.txt'),'utf8'),classes=new Map([...mapping.matchAll(/^(\S+) -> (\S+):$/gm)].map(m=>[m[1],m[2]])),names={options:'net.minecraft.client.Options',accessibilityOptions:'net.minecraft.client.gui.screens.AccessibilityOptionsScreen',chatOptions:'net.minecraft.client.gui.screens.ChatOptionsScreen',videoOptions:'net.minecraft.client.gui.screens.VideoSettingsScreen',mouseOptions:'net.minecraft.client.gui.screens.MouseSettingsScreen',fontOptions:'net.minecraft.client.gui.screens.FontOptionsScreen'};
const aliases=Object.fromEntries(Object.entries(names).map(([k,v])=>[k,classes.get(v)]));
const output=join(cache,'gui-src');await mkdir(output,{recursive:true});execFileSync(process.env.JAVA||'java',['-jar',process.env.CFR_JAR||join(homedir(),'.cache/minecraftjs-parity-tools/cfr.jar'),join(cache,'client.jar'),'--jarfilter',Object.values(aliases).join('|'),'--outputdir',output,'--silent','true'],{stdio:'pipe'});
const source=await readFile(join(output,aliases.options+'.java'),'utf8'),fields=new Map();
for(const m of source.matchAll(/(?:private final ffk<[^;\n]+> |this\.)(\w+) = (?:new ffk<[^\n]*?>|ffk\.\w+)\("([^"]+)"/g))fields.set(m[1],m[2]);
const getters=new Map([...source.matchAll(/public ffk<[^\n]+> (\w+)\(\) \{\s*return this\.(\w+);\s*\}/g)].map(m=>[m[1],fields.get(m[2])]));
const data={};for(const key of Object.keys(names).filter(k=>k!=='options')){const code=await readFile(join(output,aliases[key]+'.java'),'utf8'),array=/new ffk\[\]\{([^}]+)\}/.exec(code);if(!array)throw Error('No native option array '+key);data[key]=[...array[1].matchAll(/\$\$\d+\.(\w+)\(\)/g)].map(m=>{const caption=getters.get(m[1]);if(!caption)throw Error('Unresolved native option '+key+'.'+m[1]);return caption;});}
data.videoOptions=['options.fullscreen.resolution','options.biomeBlendRadius',...data.videoOptions];
const file=join(root,'client/js/gui/vanilla-layout.js'),old=JSON.parse((await readFile(file,'utf8')).split('export const VANILLA_UI = ')[1].replace(/;\s*$/,'')),result={...old,...data,version:'1.20.6',packFormat:32,clientJarSha1:target.downloads.client.sha1,controlsLayout:{...old.controlsLayout,listTop:20}};
const text='// Native 1.20.6 option arrays, derived from the pinned jar and mapped getters.\nexport const VANILLA_UI = '+JSON.stringify(result,null,2)+';\n';
if(process.argv.includes('--check')){if(await readFile(file,'utf8')!==text)throw Error('Stale native option arrays');}else await writeFile(file,text);
await writeFile(join(cache,'gui-order.json'),JSON.stringify({source:target.downloads.client.sha1,...data},null,2)+'\n');console.log('Native option order:',Object.fromEntries(Object.entries(data).map(([k,v])=>[k,v.length])));
