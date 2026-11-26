// Native 26.3 particle StreamCodecs. ParticleTypes.STREAM_CODEC writes the registry id as a
// VarInt and then the StreamCodec that ParticleTypes.register attached to that ParticleType;
// each codec below was read from that option class with javap. Types registered without a
// data codec (SimpleParticleType) carry no payload.
import {PARTICLE_TYPES_26_3} from './particle-types-26.3.js';
import {readItemStackTemplate26_3} from './item-components-26.3.js';

export function readParticleOptions26_3(r){
  const id=r.varint();
  const entry=PARTICLE_TYPES_26_3[id];
  if(!entry)throw Error('Unknown 26.3 particle type '+id);
  const {name,codec}=entry;
  switch(codec){
    // BlockParticleOption.streamCodec: IdMapper(Block.BLOCK_STATE_REGISTRY) -> VarInt state.
    case 'block':return {id,name,blockState:r.varint()};
    // GeyserParticleOptions.streamCodec: INT waterBlocks.
    case 'geyser':return {id,name,waterBlocks:r.i32()};
    // GeyserBaseParticleOptions.streamCodec: INT waterBlocks, FLOAT burstImpulseBase.
    case 'geyser_base':return {id,name,waterBlocks:r.i32(),burstImpulseBase:r.f32()};
    // PowerParticleOption.streamCodec: FLOAT power.
    case 'power':return {id,name,power:r.f32()};
    // SpellParticleOption.streamCodec: INT color, FLOAT power.
    case 'spell':return {id,name,color:r.i32(),power:r.f32()};
    // ColorParticleOption.streamCodec: INT color.
    case 'color':return {id,name,color:r.i32()};
    // ItemParticleOption.streamCodec: ItemStackTemplate.
    case 'item':return {id,name,item:readItemStackTemplate26_3(r)};
    // DustParticleOptions.STREAM_CODEC: INT color, FLOAT scale.
    case 'dust':return {id,name,color:r.i32(),scale:r.f32()};
    // DustColorTransitionOptions.STREAM_CODEC: INT from, INT to, FLOAT scale.
    case 'dust_color_transition':return {id,name,fromColor:r.i32(),toColor:r.i32(),scale:r.f32()};
    // SculkChargeParticleOptions.STREAM_CODEC: FLOAT roll.
    case 'sculk_charge':return {id,name,roll:r.f32()};
    // ShriekParticleOption.STREAM_CODEC: VarInt delay.
    case 'shriek':return {id,name,delay:r.varint()};
    // TrailParticleOption.STREAM_CODEC: Vec3 target (3 doubles), INT color, VarInt duration.
    case 'trail':return {id,name,target:{x:r.f64(),y:r.f64(),z:r.f64()},color:r.i32(),duration:r.varint()};
    // VibrationParticleOption.STREAM_CODEC nests a polymorphic PositionSource, so it stays
    // undecoded until that codec is ported; consuming it wrong would corrupt the metadata map.
    case 'vibration':throw Error('26.3 vibration particle decoding is not implemented');
    case 'unit':return {id,name};
  }
  throw Error('Unclassified 26.3 particle codec '+codec);
}

export function readParticles26_3(r){
  const count=r.varint();
  const particles=[];
  for(let i=0;i<count;i++)particles.push(readParticleOptions26_3(r));
  return particles;
}
