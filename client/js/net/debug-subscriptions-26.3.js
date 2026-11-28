// Native 26.3 DebugSubscription registry and the value codecs for the four debug Play packets.
// The registry order is the minecraft:debug_subscription report; each decoder follows the
// subscription's STREAM_CODEC from the 26.3 jar. Values are kept as data (the native debug
// renderer is a separate surface) but every byte is consumed before a frame is accepted.

export const DEBUG_SUBSCRIPTION_NAMES_26_3=Object.freeze([
  'dedicated_server_tick_time',
  'bees',
  'brains',
  'breezes',
  'goal_selectors',
  'entity_paths',
  'entity_block_intersections',
  'bee_hives',
  'pois',
  'redstone_wire_orientations',
  'village_sections',
  'raids',
  'structures',
  'game_event_listeners',
  'neighbor_updates',
  'game_events'
]);

// 26.3 PathType ids, in declaration order. Node.DEBUG_STREAM_CODEC writes this idMapper value.
const PATH_TYPES=Object.freeze([
  'BLOCKED','OPEN','WALKABLE','WALKABLE_DOOR','TRAPDOOR','POWDER_SNOW','ON_TOP_OF_POWDER_SNOW',
  'FENCE','LAVA','WATER','WATER_BORDER','RAIL','UNPASSABLE_RAIL','FIRE_IN_NEIGHBOR','FIRE',
  'DAMAGING_IN_NEIGHBOR','DAMAGING','DOOR_OPEN','DOOR_WOOD_CLOSED','DOOR_IRON_CLOSED','BREACH',
  'LEAVES','STICKY_HONEY','COCOA','DAMAGE_CAUTIOUS','ON_TOP_OF_TRAPDOOR','BIG_MOBS_CLOSE_TO_DANGER'
]);

const BLOCK_INTERSECTIONS=Object.freeze(['IN_BLOCK','IN_FLUID','IN_AIR']);

function readOptional(r,read){
  return r.bool()?read(r):null;
}
function readList(r,read){
  const count=r.varint(),values=[];
  for(let i=0;i<count;i++)values.push(read(r));
  return values;
}
function readStringList(r){
  return readList(r,reader=>reader.string());
}
function readBlockPosList(r){
  return readList(r,reader=>reader.position());
}
function readBlockPosSet(r){
  return readList(r,reader=>reader.position());
}

// Node.DEBUG_STREAM_CODEC: three ints, two floats, closed, PathType id, walkedDistance,
// costMalus. Target uses the same codec because it is a Node subclass.
function readDebugNode(r){
  return {
    x:r.i32(),y:r.i32(),z:r.i32(),
    g:r.f32(),h:r.f32(),
    closed:r.bool(),
    type:PATH_TYPES[r.varint()]??'UNKNOWN',
    walkedDistance:r.f32(),
    costMalus:r.f32()
  };
}

// Path.DEBUG_STREAM_CODEC: reached, nextNodeIndex, target, nodes, DebugData.
// DebugData is openSet, closedSet and targetNodes (a set encoded like a list).
function readDebugPath(r){
  const reached=r.bool();
  const nextNodeIndex=r.i32();
  const target=r.position();
  const nodes=readList(r,readDebugNode);
  const openSet=readList(r,readDebugNode);
  const closedSet=readList(r,readDebugNode);
  const targetNodes=readList(r,readDebugNode);
  return {reached,nextNodeIndex,target,nodes,debugData:{openSet,closedSet,targetNodes}};
}

// DebugStructureInfo: BoundingBox.STREAM_CODEC is two BlockPoses, then the piece list.
function readBoundingBox(r){
  const min=r.position(),max=r.position();
  return {minX:min.x,minY:min.y,minZ:min.z,maxX:max.x,maxY:max.y,maxZ:max.z};
}
function readStructureInfo(r){
  return {boundingBox:readBoundingBox(r),pieces:readList(r,reader=>({boundingBox:readBoundingBox(reader),isStart:reader.bool()}))};
}

// One decoder per registry entry. The registry is dense, so this list is also the protocol id.
const VALUE_READERS=Object.freeze([
  // dedicated_server_tick_time has a null valueStreamCodec in DebugSubscriptions; it cannot
  // appear in a value/event holder and must fail closed if a server tries.
  null,
  // DebugBeeInfo
  r=>({
    hivePos:readOptional(r,reader=>reader.position()),
    flowerPos:readOptional(r,reader=>reader.position()),
    travelTicks:r.varint(),
    blacklistedHives:readBlockPosList(r)
  }),
  // DebugBrainDump
  r=>({
    name:r.string(),profession:r.string(),xp:r.i32(),health:r.f32(),maxHealth:r.f32(),
    inventory:r.string(),wantsGolem:r.bool(),angerLevel:r.i32(),
    activities:readStringList(r),behaviors:readStringList(r),memories:readStringList(r),gossips:readStringList(r),
    pois:readBlockPosSet(r),potentialPois:readBlockPosSet(r)
  }),
  // DebugBreezeInfo
  r=>({
    attackTarget:readOptional(r,reader=>reader.varint()),
    jumpTarget:readOptional(r,reader=>reader.position())
  }),
  // DebugGoalInfo: list of (priority, isRunning, stringUtf8(255)).
  r=>({goals:readList(r,reader=>({priority:reader.varint(),isRunning:reader.bool(),name:reader.string()}))}),
  // DebugPathInfo
  r=>({path:readDebugPath(r),maxNodeDistance:r.f32()}),
  // DebugEntityBlockIntersection, an idMapper over 0..2.
  r=>BLOCK_INTERSECTIONS[r.varint()]??'UNKNOWN',
  // DebugHiveInfo: plain block registry id, not a holder.
  r=>({blockId:r.varint(),occupantCount:r.varint(),honeyLevel:r.varint(),sedated:r.bool()}),
  // DebugPoiInfo: holderRegistry writes id + 1 and reserves 0 for a direct value (not used).
  r=>({position:r.position(),poiTypeId:r.varint()-1,freeTicketCount:r.varint()}),
  // Orientation.STREAM_CODEC is an idMapper over the 48 generated orientations.
  r=>({index:r.varint()}),
  // Unit.STREAM_CODEC is empty.
  ()=>null,
  // raids: list<BlockPos>
  r=>readBlockPosList(r),
  // structures: list<DebugStructureInfo>
  r=>readList(r,readStructureInfo),
  // DebugGameEventListenerInfo
  r=>({listenerRadius:r.varint()}),
  // neighbor_updates
  r=>r.position(),
  // DebugGameEventInfo: game-event holder (id + 1) and a Vec3 of three doubles.
  r=>({eventId:r.varint()-1,position:{x:r.f64(),y:r.f64(),z:r.f64()}})
]);

export function debugSubscriptionName(id){
  return DEBUG_SUBSCRIPTION_NAMES_26_3[id]??null;
}

export function readDebugSubscriptionValue(r,id){
  const read=VALUE_READERS[id];
  if(!read)throw Error('Unsupported 26.3 debug subscription '+id+(debugSubscriptionName(id)?' ('+debugSubscriptionName(id)+')':''));
  return read(r);
}

// DebugSubscription.Update.STREAM_CODEC: registry id, optional(value). The subscription id is
// a raw registry id; only the value is optional.
export function readDebugSubscriptionUpdate(r){
  const id=r.varint(),name=debugSubscriptionName(id);
  if(!name)throw Error('Unknown 26.3 debug subscription '+id);
  const present=r.bool();
  return {subscription:id,subscriptionName:name,value:present?readDebugSubscriptionValue(r,id):null};
}

// DebugSubscription.Event.STREAM_CODEC: registry id followed by a mandatory value.
export function readDebugSubscriptionEvent(r){
  const id=r.varint(),name=debugSubscriptionName(id);
  if(!name)throw Error('Unknown 26.3 debug subscription '+id);
  return {subscription:id,subscriptionName:name,value:readDebugSubscriptionValue(r,id)};
}
