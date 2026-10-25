// 1.13+ technical-block editors use dedicated packets, with enums/bit flags on the wire.
export function technicalPackets(packet) {
  return {
    updateCommandBlock:(pos,command,mode,track,conditional,automatic)=>packet('update_command_block').position(pos.x,pos.y,pos.z).string(command).varint(['SEQUENCE','AUTO','REDSTONE'].indexOf(mode)).u8((track?1:0)|(conditional?2:0)|(automatic?4:0)).build(),
    updateCommandMinecart:(id,command,track)=>packet('update_command_block_minecart').varint(id).string(command).bool(track).build(),
    updateStructure:(pos,action,t)=>{
      const w=packet('update_structure_block').position(pos.x,pos.y,pos.z).varint(action-1).varint(['SAVE','LOAD','CORNER','DATA'].indexOf(t.mode)).string(t.name);
      for(const key of ['posX','posY','posZ','sizeX','sizeY','sizeZ'])w.i8(t[key]);
      return w.varint(['NONE','LEFT_RIGHT','FRONT_BACK'].indexOf(t.mirror)).varint(['NONE','CLOCKWISE_90','CLOCKWISE_180','COUNTERCLOCKWISE_90'].indexOf(t.rotation)).string(t.metadata).f32(t.integrity).varlong(t.seed).u8((t.ignoreEntities?1:0)|(t.showAir?2:0)|(t.showBoundingBox?4:0)).build();
    },
  };
}
