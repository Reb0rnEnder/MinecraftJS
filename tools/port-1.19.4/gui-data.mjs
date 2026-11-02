// Derive instance-option ordering from the pinned native screen methods. Unlike
// 1.18, these arrays call Options getters rather than static Option fields.
import{execFileSync}from'node:child_process';import{readFile,writeFile,mkdir}from'node:fs/promises';import{join}from'node:path';import{homedir}from'node:os';
import{cache,root,target}from'./prepare.mjs';
const mapping=await readFile(join(cache,'client.txt'),'utf8'),classes=new Map([...mapping.matchAll(/^(\S+) -> (\S+):$/gm)].map(m=>[m[1],m[2]])),names={options:'net.minecraft.client.Options',accessibilityOptions:'net.minecraft.client.gui.screens.AccessibilityOptionsScreen',chatOptions:'net.minecraft.client.gui.screens.ChatOptionsScreen',videoOptions:'net.minecraft.client.gui.screens.VideoSettingsScreen',mouseOptions:'net.minecraft.client.gui.screens.MouseSettingsScreen'};
const aliases=Object.fromEntries(Object.entries(names).map(([k,v])=>[k,classes.get(v)]));
const output=join(cache,'gui-src');await mkdir(output,{recursive:true});execFileSync(process.env.JAVA||'java',['-jar',process.env.CFR_JAR||join(homedir(),'.cache/minecraftjs-parity-tools/cfr.jar'),join(cache,'client.jar'),'--jarfilter',Object.values(aliases).join('|'),'--outputdir',output,'--silent','true'],{stdio:'pipe'});
const source=await readFile(join(output,aliases.options+'.java'),'utf8'),fields=new Map();
for(const m of source.matchAll(/(?:private final emk<[^;\n]+> |this\.)(\w+) = (?:new emk<[^\n]*?>|emk\.\w+)\("([^"]+)"/g))fields.set(m[1],m[2]);
const getters=new Map([...source.matchAll(/public emk<[^\n]+> (\w+)\(\) \{\s*return this\.(\w+);\s*\}/g)].map(m=>[m[1],fields.get(m[2])]));
const data={};for(const key of Object.keys(names).filter(k=>k!=='options')){const code=await readFile(join(output,aliases[key]+'.java'),'utf8'),array=/new emk\[\]\{([^}]+)\}/.exec(code);if(!array)throw Error('No native option array '+key);data[key]=[...array[1].matchAll(/\$\$\d+\.(\w+)\(\)/g)].map(m=>{const caption=getters.get(m[1]);if(!caption)throw Error('Unresolved native option '+key+'.'+m[1]);return caption;});}
data.videoOptions=['options.fullscreen.resolution','options.biomeBlendRadius',...data.videoOptions];
const file=join(root,'client/js/gui/vanilla-layout.js'),old=JSON.parse((await readFile(file,'utf8')).split('export const VANILLA_UI = ')[1].replace(/;\s*$/,'')),result={...old,...data,version:'1.19.4',packFormat:13,clientJarSha1:target.downloads.client.sha1,controlsLayout:{...old.controlsLayout,listTop:20}};
await writeFile(file,'// Native 1.19.4 option arrays, derived from the pinned jar and mapped getters.\nexport const VANILLA_UI = '+JSON.stringify(result,null,2)+';\n');
await writeFile(join(cache,'gui-order.json'),JSON.stringify({source:target.downloads.client.sha1,...data},null,2)+'\n');console.log('Native option order:',Object.fromEntries(Object.entries(data).map(([k,v])=>[k,v.length])));
