// Repeatable static/native audit. This does not certify all gameplay behavior.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {execFile} from 'node:child_process';import {promisify} from 'node:util';
import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
import {join} from 'node:path';import {ZipFile} from '../../lib/zip.js';
import {cache,target,root} from './prepare.mjs';
import {initBlocks,getStateProperties,getBlock} from '../../client/js/world/blocks.js';
import {soundTypeOf} from '../../client/js/audio/sound.js';
const json=async p=>JSON.parse(await readFile(p)),hash=b=>createHash('sha1').update(b).digest('hex');
const jarPath=join(cache,'client.jar'),jarBytes=await readFile(jarPath);assert.equal(hash(jarBytes),target.downloads.client.sha1);
const mappingBytes=await readFile(join(cache,'client.txt'));assert.equal(hash(mappingBytes),target.downloads.client_mappings.sha1);
const mappings=new Map([...mappingBytes.toString().matchAll(/^([^ \n]+) -> ([^:\n]+):$/gm)].map(m=>[m[1],m[2]]));
const jar=new ZipFile(jarPath),native=await json(join(cache,'generated/reports/blocks.json')),registries=await json(join(cache,'generated/reports/registries.json'));
const defs=await json(join(root,'client/data/blocks.json')),shapes=await json(join(root,'client/data/blockCollisionShapes.json')),sounds=await json(join(root,'client/data/sounds.json'));
assert.equal(shapes.render.source.clientJarSha1,target.downloads.client.sha1);
initBlocks(defs,shapes);let states=0;
for(const d of defs){const n=native['minecraft:'+d.name];assert.ok(n,d.name);assert.equal(n.states.find(s=>s.default).id,d.defaultState);for(const s of n.states){assert.equal(getBlock(s.id).name,d.name);assert.deepEqual(getStateProperties(s.id),s.properties||{});assert.deepEqual(soundTypeOf(getBlock(s.id)),shapes.render.values[shapes.render.states[s.id]].sound);states++;}}
assert.equal(states,23725);assert.equal(defs.length,Object.keys(native).length);
for(const s of sounds)assert.equal(registries['minecraft:sound_event'].entries['minecraft:'+s.name].protocol_id,s.id);
const areas={
 protocol:['net.minecraft.client.multiplayer.ClientPacketListener','net.minecraft.network.protocol.game.ClientboundSoundPacket','net.minecraft.network.protocol.game.ClientboundLevelEventPacket'],
 interaction:['net.minecraft.client.multiplayer.MultiPlayerGameMode','net.minecraft.world.level.block.Block','net.minecraft.world.level.block.SlabBlock','net.minecraft.server.level.ServerPlayerGameMode'],
 sound:['net.minecraft.client.sounds.SoundEngine','net.minecraft.client.resources.sounds.SimpleSoundInstance','net.minecraft.sounds.SoundSource','net.minecraft.world.level.block.SoundType'],
 movement:['net.minecraft.world.entity.Entity','net.minecraft.world.entity.LivingEntity','net.minecraft.world.entity.player.Player','net.minecraft.client.player.LocalPlayer'],
 world:['net.minecraft.client.multiplayer.ClientLevel','net.minecraft.world.level.lighting.LevelLightEngine'],
 rendering:['net.minecraft.client.renderer.LevelRenderer','net.minecraft.client.renderer.GameRenderer','net.minecraft.client.renderer.entity.EntityRenderDispatcher'],
 inventory:['net.minecraft.client.ClientRecipeBook','net.minecraft.world.item.crafting.CraftingBookCategory','net.minecraft.world.item.crafting.CookingBookCategory','net.minecraft.client.gui.screens.inventory.InventoryScreen','net.minecraft.client.gui.screens.inventory.CreativeModeInventoryScreen','net.minecraft.client.gui.screens.inventory.MerchantScreen','net.minecraft.world.inventory.AbstractContainerMenu'],
 text:['net.minecraft.network.chat.Component','net.minecraft.network.chat.contents.TranslatableContents','net.minecraft.locale.Language','net.minecraft.client.gui.Font'],
 gui:['net.minecraft.client.gui.screens.OptionsScreen','net.minecraft.client.gui.screens.VideoSettingsScreen','net.minecraft.client.gui.screens.AccessibilityOptionsScreen','net.minecraft.client.gui.screens.ChatOptionsScreen','net.minecraft.client.gui.screens.social.SocialInteractionsScreen','net.minecraft.client.gui.screens.DeathScreen'],
 chatTrust:['net.minecraft.network.chat.PlayerChatMessage','net.minecraft.util.SignatureValidator'],
 resourcePacks:['net.minecraft.client.gui.screens.packs.PackSelectionScreen','net.minecraft.server.packs.repository.PackRepository'],
};
const classes={};for(const [area,names] of Object.entries(areas))classes[area]=names.map(name=>{const obfuscated=mappings.get(name);assert.ok(obfuscated,'Missing exact native mapping '+name);const bytes=jar.read(obfuscated.replaceAll('.','/')+'.class');assert.ok(bytes,'Missing native class '+name);return{name,obfuscated,sha1:hash(bytes),status:'indexed; behavior requires explicit review/tests'};});
const result={version:'1.19.4',protocol:762,fullParity:false,clientJarSha1:hash(jarBytes),mappingsSha1:hash(mappingBytes),checked:{blocks:defs.length,states,soundRegistry:sounds.length,stateSoundTypes:states},classes,limitations:['State/property/sound table equality is checked against pinned generated native data.','Class indexing establishes exact source inputs, not implementation equivalence.','Pixel acceptance, all entity state transitions and authenticated webmc audio remain unverified.']};
await mkdir(join(cache,'audit'),{recursive:true});await writeFile(join(cache,'audit/native-index.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result.checked));

if(process.argv.includes('--test')){
 const cases=await json(new URL('./audit-cases.json',import.meta.url));
 const {stdout,stderr}=await promisify(execFile)(process.execPath,['--test','--test-concurrency=2',...cases],{cwd:root,maxBuffer:16*1024*1024});
 await writeFile(join(cache,'audit/regressions.tap'),stdout+stderr);
 const totals=Object.fromEntries([...stdout.matchAll(/^# (tests|pass|fail|skipped) (\d+)$/gm)].map(m=>[m[1],Number(m[2])]));
 assert.equal(totals.fail,0);await writeFile(join(cache,'audit/regressions.json'),JSON.stringify({fullParity:false,cases,totals},null,2)+'\n');console.log(JSON.stringify(totals));
}
