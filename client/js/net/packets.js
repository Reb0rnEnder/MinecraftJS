// Native Java 1.17.1 play-state packet encoders (protocol 756).
import {Writer756,C756,decodePacket756} from './protocol-1.17.1.js';
import {SERVERBOUND_756 as OUT} from './protocol-1.17.1-ids.js';
export const PROTOCOL_VERSION=756;
export const decodePacket=decodePacket756;
const packet=name=>new Writer756().varint(OUT[name]);
function payloadChannel(channel){
 if(!/^[a-z0-9_.-]+:[a-z0-9/._-]+$/.test(channel))throw new Error('Invalid custom payload channel: '+channel);
 return channel;
}
export const C={
 ...C756,
 settings:(locale,viewDistance,chatFlags,chatColors,skinParts,mainHand=1)=>packet('settings').string(locale).i8(viewDistance).varint(chatFlags).bool(chatColors).u8(skinParts).varint(mainHand).bool(false).build(),
 tabComplete:(text,_position=null,transactionId=0)=>packet('tab_complete').varint(transactionId).string(text).build(),
 chat:msg=>packet('chat').string(msg.slice(0,256)).build(),
 clientCommand:action=>packet('client_command').varint(action).build(),
 enchantItem:(windowId,enchantment)=>packet('enchant_item').u8(windowId).u8(enchantment).build(),
 menuButton:(windowId,button)=>packet('enchant_item').u8(windowId).u8(button).build(),
 closeWindow:windowId=>packet('close_window').u8(windowId).build(),
 customPayload:(channel,data)=>packet('custom_payload').string(payloadChannel(channel)).raw(data).build(),
 useEntity:C756.useEntity,
 flying:onGround=>packet('flying').bool(onGround).build(),
 position:(x,y,z,onGround)=>packet('position').f64(x).f64(y).f64(z).bool(onGround).build(),
 look:(yaw,pitch,onGround)=>packet('look').f32(yaw).f32(pitch).bool(onGround).build(),
 vehicleMove:(x,y,z,yaw,pitch)=>packet('vehicle_move').f64(x).f64(y).f64(z).f32(yaw).f32(pitch).build(),
 steerBoat:(left,right)=>packet('steer_boat').bool(left).bool(right).build(),
 abilities:C756.abilities,
 entityAction:(eid,action,jumpBoost=0)=>packet('entity_action').varint(eid).varint(action).varint(jumpBoost).build(),
 steerVehicle:(sideways,forward,flags)=>packet('steer_vehicle').f32(sideways).f32(forward).u8(flags).build(),
 resourcePackStatus:result=>packet('resource_pack_receive').varint(result).build(),
 placeRecipe:(windowId,recipe,all)=>packet('craft_recipe_request').u8(windowId).string(String(recipe)).bool(all).build(),
 recipeInfoShown:C756.displayedRecipe,
 recipeInfoSettings:(open,filtering)=>C756.recipeBookSettings(0,open,filtering),
 recipeBookSettings:C756.recipeBookSettings,
 seenAdvancements:tab=>(tab?packet('advancement_tab').varint(0).string(tab):packet('advancement_tab').varint(1)).build(),
 selectTrade:index=>packet('select_trade').varint(index).build(),
 nameItem:name=>packet('name_item').string(name).build(),
 setBeaconEffects:(primary,secondary)=>packet('set_beacon_effect').varint(primary).varint(secondary).build(),
 heldItemSlot:slot=>packet('held_item_slot').i16(slot).build(),
 creativeSlot:(slot,item)=>packet('set_creative_slot').i16(slot).slot(item).build(),
 updateJigsaw:C756.updateJigsaw,
 updateSign:(x,y,z,lines)=>{const w=packet('update_sign').position(x,y,z);for(let i=0;i<4;i++)w.string(lines[i]||'');return w.build();},
 armAnimation:(hand=0)=>packet('arm_animation').varint(hand).build(),
 spectate:uuid=>packet('spectate').uuid(uuid).build(),
 useItem:(hand=0)=>packet('use_item').varint(hand).build(),
};
export const mcStringBytes=s=>new Writer756().string(s).build();
