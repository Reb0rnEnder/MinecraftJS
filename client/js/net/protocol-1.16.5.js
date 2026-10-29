// Native Java 1.16.5 / protocol 754. Packet names identify compatible inherited
// layouts; changed bodies are decoded here before handing data to the game.
import {Reader578,Writer578,decodePacket578,C578} from './protocol-1.15.2.js';
import {readNbtRoot,simplify} from './nbt.js';
import {readRecipes} from './recipes.js';
import {CLIENTBOUND_578 as IN578,SERVERBOUND_578 as OUT578} from './protocol-1.15.2-ids.js';
import {CLIENTBOUND_754 as IN,SERVERBOUND_754 as OUT} from './protocol-1.16.5-ids.js';
export const PROTOCOL_754=754;
export class Reader754 extends Reader578 {
  varlong(){let n=0n;for(let i=0;i<10;i++){const b=this.u8();n|=BigInt(b&127)<<BigInt(i*7);if(!(b&128))return BigInt.asIntN(64,n);}throw Error('Invalid VarLong');}
  particleData(id){if(id===34)return {item:this.slot()};if(id===32)return {};return super.particleData(id);}
}
export class Writer754 extends Writer578 {
  varlong(n){n=BigInt.asUintN(64,BigInt(n));do{let b=Number(n&127n);n>>=7n;if(n)b|=128;this.u8(b);}while(n);return this;}
}
const names=Object.fromEntries(Object.entries(IN).map(([n,id])=>[id,n]));
const outNames=Object.fromEntries(Object.entries(OUT578).map(([n,id])=>[id,n]));
const prefix=n=>new Writer754().varint(n).build();
const array=(r,read,max=1048576)=>{const n=r.varint();if(n<0||n>max||n>r.remaining())throw Error('Invalid array size');return Array.from({length:n},()=>read());};
const dimension=(tag,worldName)=>{const data=simplify(tag)||{},effects=data.effects||worldName;return {dimension:effects==='minecraft:the_nether'?-1:effects==='minecraft:the_end'?1:0,dimensionData:data};};
function changed(name,r){switch(name){
 case 'login':{
  const entityId=r.i32(),isHardcore=r.bool(),gameMode=r.u8(),previousGameMode=r.i8(),worldNames=array(r,()=>r.string(),1024),dimensionCodec=readNbtRoot(r),tag=readNbtRoot(r),worldName=r.string();
  return {entityId,isHardcore,gameMode,previousGameMode,worldNames,dimensionCodec,worldName,...dimension(tag,worldName),hashedSeed:r.i64(),maxPlayers:r.varint(),viewDistance:r.varint(),reducedDebugInfo:r.bool(),enableRespawnScreen:r.bool(),isDebug:r.bool(),isFlat:r.bool()};
 }
 case 'respawn':{const tag=readNbtRoot(r),worldName=r.string();return {worldName,...dimension(tag,worldName),hashedSeed:r.i64(),gamemode:r.u8(),previousGamemode:r.i8(),isDebug:r.bool(),isFlat:r.bool(),copyMetadata:r.bool()};}
 case 'chat':return {message:r.string(),position:r.i8(),sender:r.uuid()};
 case 'map_chunk':{const x=r.i32(),z=r.i32(),groundUp=r.bool(),bitMap=r.varint(),heightmaps=readNbtRoot(r),biomes=groundUp?array(r,()=>r.varint(),1024):null,chunkData=r.bytesN(r.varint()).slice(),blockEntities=array(r,()=>readNbtRoot(r));if(groundUp&&biomes.length!==1024)throw Error('Expected 1024 biome IDs');return {x,z,groundUp,bitMap,heightmaps,biomes,chunkData,blockEntities};}
 case 'multi_block_change':{
  const position=r.i64(),chunkX=Number(BigInt.asIntN(22,position>>42n)),chunkZ=Number(BigInt.asIntN(22,position>>20n)),sectionY=Number(BigInt.asIntN(20,position)),notTrustEdges=r.bool();
  const records=array(r,()=>{const n=BigInt.asUintN(64,r.varlong());return {state:Number(n>>12n),x:Number(n>>8n&15n),z:Number(n>>4n&15n),y:sectionY*16+Number(n&15n)};});return {chunkX,chunkZ,sectionY,notTrustEdges,records};
 }
 case 'update_light':{
  const p={chunkX:r.varint(),chunkZ:r.varint(),trustEdges:r.bool(),skyLightMask:r.varint(),blockLightMask:r.varint(),emptySkyLightMask:r.varint(),emptyBlockLightMask:r.varint()};
  for(const [key,mask]of[['skyLight',p.skyLightMask],['blockLight',p.blockLightMask]]){if(mask<0||mask>0x3ffff)throw Error('Invalid light mask');const data={};for(let i=0;i<18;i++)if(mask&(1<<i)){if(r.varint()!==2048)throw Error('Invalid light array');data[i-1]=r.bytesN(2048).slice();}p[key]=data;}return p;
 }
 case 'entity_equipment':{const entityId=r.varint(),equipments=[];let more;do{const b=r.u8();more=!!(b&128);const slot=b&127;if(slot>5||equipments.length>=6)throw Error('Invalid equipment list');equipments.push({slot,item:r.slot()});}while(more);return {entityId,equipments};}
 case 'entity_metadata':return {entityId:r.varint(),metadata:r.metadata()};
 case 'world_particles':{const particleId=r.i32(),longDistance=r.bool();return {particleId,longDistance,x:r.f64(),y:r.f64(),z:r.f64(),offsetX:r.f32(),offsetY:r.f32(),offsetZ:r.f32(),particleData:r.f32(),particles:r.i32(),data:r.particleData(particleId)};}
 case 'unlock_recipes':{const action=r.varint(),p={action};for(const key of['craftingBookOpen','filteringCraftable','smeltingBookOpen','filteringSmeltable','blastFurnaceOpen','filteringBlastFurnace','smokerBookOpen','filteringSmoker'])p[key]=r.bool();p.recipes=array(r,()=>r.string());p.recipesToHighlight=action===0?array(r,()=>r.string()):[];return p;}
 case 'declare_recipes':return {recipes:readRecipes(r,754)};
 default:return null;
}}
export function decodePacket754(bytes){
 const r=new Reader754(bytes),id=r.varint(),name=names[id];if(!name)return {name:'unsupported',packetName:null,id,data:r.rest()};
 const p=changed(name,r);if(p){if(r.remaining())throw Error('Trailing data in 754 '+name+': '+r.remaining());if(name==='login'||name==='respawn')p.levelType=p.isFlat?'flat':'default';return {name,id,...p};}
 const old=IN578[name];if(old===undefined)return {name:'unsupported',packetName:name,id,data:r.rest()};
 const head=prefix(old),body=r.rest(),copy=new Uint8Array(head.length+body.length);copy.set(head);copy.set(body,head.length);const decoded={...decodePacket578(copy),id};
 if(decoded.name==='update_attributes')for(const prop of decoded.properties){
  const key=prop.key.replace(/^minecraft:/,'');prop.key=({'generic.max_health':'generic.maxHealth','generic.movement_speed':'generic.movementSpeed','generic.flying_speed':'generic.flyingSpeed','generic.attack_damage':'generic.attackDamage','generic.attack_speed':'generic.attackSpeed','generic.knockback_resistance':'generic.knockbackResistance','generic.follow_range':'generic.followRange','horse.jump_strength':'horse.jumpStrength','zombie.spawn_reinforcements':'zombie.spawnReinforcements'})[key]||key;
 }
 return decoded;
}
function remap(bytes){const r=new Reader754(bytes),old=r.varint(),name=outNames[old],id=OUT[name];if(id===undefined)throw Error('No 754 outgoing packet '+name);const head=prefix(id),body=r.rest(),copy=new Uint8Array(head.length+body.length);copy.set(head);copy.set(body,head.length);return copy;}
const packet=name=>new Writer754().varint(OUT[name]);
export const C754={...Object.fromEntries(Object.entries(C578).map(([name,fn])=>[name,(...args)=>remap(fn(...args))])),
 abilities:flags=>packet('abilities').u8(flags&2).build(),
 useEntity:(target,mouse,x,y,z,hand=0,sneaking=false)=>{const p=packet('use_entity').varint(target).varint(mouse);if(mouse===2)p.f32(x).f32(y).f32(z);if(mouse===0||mouse===2)p.varint(hand);return p.bool(sneaking).build();},
 displayedRecipe:id=>packet('displayed_recipe').string(id).build(),
 recipeBookSettings:(bookId,open,filter)=>packet('recipe_book').varint(bookId).bool(open).bool(filter).build(),
 generateStructure:(pos,levels,keepJigsaws=false)=>packet('generate_structure').position(pos.x,pos.y,pos.z).varint(levels).bool(keepJigsaws).build(),
 updateJigsaw:(pos,name,target,pool,finalState,jointType='rollable')=>packet('update_jigsaw_block').position(pos.x,pos.y,pos.z).string(name).string(target).string(pool).string(finalState).string(jointType).build(),
};
