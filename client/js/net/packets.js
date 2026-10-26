// Native Java 1.15.2 play-state packet encoders (protocol 578).
import {Writer578,C578,decodePacket578} from './protocol-1.15.2.js';
import {SERVERBOUND_578 as OUT} from './protocol-1.15.2-ids.js';
export const PROTOCOL_VERSION=578;
export const decodePacket=decodePacket578;
const packet=name=>new Writer578().varint(OUT[name]);
function payloadChannel(channel){
 if(!/^[a-z0-9_.-]+:[a-z0-9/._-]+$/.test(channel))throw new Error('Invalid custom payload channel: '+channel);
 return channel;
}
export const C={
 ...C578,
 settings:(locale,viewDistance,chatFlags,chatColors,skinParts,mainHand=1)=>packet('settings').string(locale).i8(viewDistance).varint(chatFlags).bool(chatColors).u8(skinParts).varint(mainHand).build(),
 tabComplete:(text,_position=null,transactionId=0)=>packet('tab_complete').varint(transactionId).string(text).build(),
 chat:msg=>packet('chat').string(msg.slice(0,256)).build(),
 clientCommand:action=>packet('client_command').varint(action).build(),
 transaction:(windowId,action,accepted)=>packet('transaction').i8(windowId).i16(action).bool(accepted).build(),
 enchantItem:(windowId,enchantment)=>packet('enchant_item').u8(windowId).u8(enchantment).build(),
 menuButton:(windowId,button)=>packet('enchant_item').u8(windowId).u8(button).build(),
 windowClick:(windowId,slot,button,action,mode,item)=>packet('window_click').u8(windowId).i16(slot).i8(button).i16(action).varint(mode).slot(item).build(),
 closeWindow:windowId=>packet('close_window').u8(windowId).build(),
 customPayload:(channel,data)=>packet('custom_payload').string(payloadChannel(channel)).raw(data).build(),
 useEntity:(target,mouse,x,y,z,hand=0)=>{
  const w=packet('use_entity').varint(target).varint(mouse);
  if(mouse===2)w.f32(x).f32(y).f32(z);
  if(mouse!==1)w.varint(hand);
  return w.build();
 },
 flying:onGround=>packet('flying').bool(onGround).build(),
 position:(x,y,z,onGround)=>packet('position').f64(x).f64(y).f64(z).bool(onGround).build(),
 look:(yaw,pitch,onGround)=>packet('look').f32(yaw).f32(pitch).bool(onGround).build(),
 vehicleMove:(x,y,z,yaw,pitch)=>packet('vehicle_move').f64(x).f64(y).f64(z).f32(yaw).f32(pitch).build(),
 steerBoat:(left,right)=>packet('steer_boat').bool(left).bool(right).build(),
 abilities:(flags,flySpeed,walkSpeed)=>packet('abilities').u8(flags).f32(flySpeed).f32(walkSpeed).build(),
 entityAction:(eid,action,jumpBoost=0)=>packet('entity_action').varint(eid).varint(action).varint(jumpBoost).build(),
 steerVehicle:(sideways,forward,flags)=>packet('steer_vehicle').f32(sideways).f32(forward).u8(flags).build(),
 resourcePackStatus:result=>packet('resource_pack_receive').varint(result).build(),
 placeRecipe:(windowId,recipe,all)=>packet('craft_recipe_request').u8(windowId).string(String(recipe)).bool(all).build(),
 recipeInfoShown:recipe=>packet('crafting_book_data').varint(0).string(String(recipe)).build(),
 recipeInfoSettings:(open,filtering)=>packet('crafting_book_data').varint(1).bool(open).bool(filtering).bool(false).bool(false).bool(false).bool(false).bool(false).bool(false).build(),
 seenAdvancements:tab=>(tab?packet('advancement_tab').varint(0).string(tab):packet('advancement_tab').varint(1)).build(),
 selectTrade:index=>packet('select_trade').varint(index).build(),
 nameItem:name=>packet('name_item').string(name).build(),
 setBeaconEffects:(primary,secondary)=>packet('set_beacon_effect').varint(primary).varint(secondary).build(),
 heldItemSlot:slot=>packet('held_item_slot').i16(slot).build(),
 creativeSlot:(slot,item)=>packet('set_creative_slot').i16(slot).slot(item).build(),
 updateJigsaw:(pos,type,pool,state)=>packet('update_jigsaw_block').position(pos.x,pos.y,pos.z).string(type).string(pool).string(state).build(),
 updateSign:(x,y,z,lines)=>{const w=packet('update_sign').position(x,y,z);for(let i=0;i<4;i++)w.string(lines[i]||'');return w.build();},
 armAnimation:(hand=0)=>packet('arm_animation').varint(hand).build(),
 spectate:uuid=>packet('spectate').uuid(uuid).build(),
 useItem:(hand=0)=>packet('use_item').varint(hand).build(),
};
export const mcStringBytes=s=>new Writer578().string(s).build();
