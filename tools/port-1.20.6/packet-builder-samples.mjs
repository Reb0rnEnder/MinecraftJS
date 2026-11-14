// Exercise the actual runtime senders, independently decoded by native Java.
import {C} from '../../client/js/net/packets.js';
import {C766,Reader766} from '../../client/js/net/configuration-1.20.6.js';
import {ChatState766} from '../../client/js/net/chat-state-1.20.6.js';
import {PLAY_SERVERBOUND_766} from '../../client/js/net/protocol-1.20.6-ids.js';
import {publicKey} from './packet-samples.mjs';
export function builderSamples() {
 const pos={x:16777217,y:-63,z:-33554431},uuid='12345678-1234-4234-8234-123456789abc';
 const slot={id:1,count:12,componentPatch:{added:[],removed:[]}},signature=new Uint8Array(256).fill(0xa5),acknowledged=new Uint8Array([0x81,0xff,0x0f]);
 const calls=[
  ['teleportConfirm',[234]],['chunkBatchReceived',[3.5]],['keepAlive',[0x123456789abcdefn]],['pong',[-72]],
  ['settings',['en_us',32,1,true,0x7f,1,false]],['customPayload',['minecraft:brand',new Uint8Array([1,65])]],
  ['clientCommand',[1]],['tabComplete',['kill @e[type=',null,25]],['closeWindow',[129]],
  ['flying',[true]],['position',[1.25,-63.75,3.125,true]],['look',[90,-40,false]],['positionLook',[1,2,3,95,-60,true]],
  ['vehicleMove',[1,2,3,40,-20]],['steerBoat',[true,false]],['abilities',[2]],['entityAction',[122,5,90]],
  ['steerVehicle',[-1,1,3]],['heldItemSlot',[8]],['armAnimation',[1]],['spectate',[uuid]],
  ['useEntity',[23,0,0,0,0,1,true]],['useEntity',[23,1,0,0,0,0,false]],['useEntity',[23,2,0.25,0.5,0.75,0,true]],
  ['blockDig',[0,pos.x,pos.y,pos.z,2,35]],['blockPlace',[pos.x,pos.y,pos.z,2,1,0.25,0.5,0.75,true,36]],['useItem',[1,37]],
  ['queryBlockNbt',[73,pos.x,pos.y,pos.z]],['queryEntityNbt',[74,23]],
  ['placeRecipe',[2,'minecraft:oak_planks',true]],['recipeInfoShown',['minecraft:oak_planks']],['recipeBookSettings',[2,true,false]],
  ['creativeSlot',[36,slot]],['creativeSlot',[-1,null]],['windowClick',[2,12,1,93,0,[{slot:12,item:slot}],null]],
  ['resourcePackStatus',[uuid,3]],['enchantItem',[2,1]],['seenAdvancements',['minecraft:story/root']],['seenAdvancements',[null]],
  ['selectTrade',[4]],['nameItem',['Fixture']],['setBeaconEffects',[1,3]],['setBeaconEffects',[null,null]],
  ['updateJigsaw',[pos,'minecraft:fixture','minecraft:target','minecraft:pool','minecraft:air','aligned',-2,7]],
  ['updateSign',[pos.x,pos.y,pos.z,['first','second','third','fourth'],false]],
  ['updateCommandBlock',[pos,'say fixture','REDSTONE',true,true,false]],['updateCommandMinecart',[23,'say fixture',true]],
  ['updateStructure',[pos,2,{mode:'LOAD',name:'minecraft:fixture',posX:-16,posY:-1,posZ:12,sizeX:24,sizeY:32,sizeZ:48,mirror:'LEFT_RIGHT',rotation:'COUNTERCLOCKWISE_90',metadata:'fixture',integrity:0.75,seed:0x123456789abcdefn,ignoreEntities:true,showAir:false,showBoundingBox:true}]],
  ['editBook',[40,['first page','second page'],'Book title']],['editBook',[8,[],null]],
  ['setDifficulty',[3]],['lockDifficulty',[true]],['pickItem',[24]],['pingRequest',[987654321n]],['debugSampleSubscription',[0]],
  ['setSlotState',[3,128,true]],['generateStructure',[pos,7,false]],
  ['chatSession',[{sessionUUID:uuid,expireTime:1900000000000n,publicKey,signature}]],
  ['signedCommand',['say fixture',{timestamp:1700000000123n,salt:123n,argumentSignatures:[{argumentName:'message',signature}],messageCount:12,acknowledged}]],
 ];
 const ids=Object.fromEntries(Object.entries(PLAY_SERVERBOUND_766).map(([k,v])=>[v,k]));
 const sample=(wire,api,index)=>{const name=ids[new Reader766(wire).varint()];if(!name)throw Error('Unknown builder packet');return{label:'BUILDER:'+name+':'+api+':'+index,direction:'SERVERBOUND',name,api,wire:Buffer.from(wire).toString('base64'),coverage:[]};};
 const out=calls.map(([name,args],i)=>sample(C[name](...args),'C.'+name,i));
 const state=new ChatState766();state.process(signature);
 out.push(sample(state.flush(),'ChatState766.flush',0),sample(state.encode('/say fixture'),'ChatState766.encode',0),sample(state.encode('fixture',{now:1700000000123,salt:123n,signature}),'ChatState766.encode',1));
 out.push(sample(C766.acknowledgeReconfiguration(),'C766.acknowledgeReconfiguration',0),sample(C766.playCookieResponse('minecraft:fixture',new Uint8Array([4,2])),'C766.playCookieResponse',0),sample(C766.playCookieResponse('minecraft:fixture',null),'C766.playCookieResponse',1));
 // Native component layouts that were wrong in the pinned upstream schema.
 for(const [label,wire]of [
  ['custom_food','AQEBABQDQJAAAAE/QAAAAQkCUAABAQA/AAAA'],
  ['inline_horn','AbAJAQAoAMMFEUKAAAA='],
  ['removed_food','AZ8GAAEU'],['named_horn','AbAJAQAoAQ==']
 ])out.push(sample(C.creativeSlot(36,new Reader766(Buffer.from(wire,'base64')).slot()),'C.creativeSlot.'+label,0));
 return out;
}
