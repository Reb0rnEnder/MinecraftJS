// 26.3 chunk section decoding. Layout taken from javap on LevelChunkSection.write:
//   short nonEmptyBlockCount, short fluidCount, PalettedContainer block states, PalettedContainerRO biomes.
// PalettedContainer.read: byte bitsPerEntry, palette (single/indirect/direct), then a fixed-size long array.
// ClientboundLevelChunkPacketData: heightmap map, VarInt-prefixed byte buffer, block entity list.
import {Reader} from './buffer.js';
import {readAnonymousNbt} from './nbt-anonymous.js';

const BLOCK_GLOBAL_BITS=8;
const BIOME_GLOBAL_BITS=3;
const BLOCK_ENTRIES=4096;
// A biome container covers a 4x4x4 volume, so 64 entries, not 4096.
const BIOME_ENTRIES=64;

function readPalette(reader,bits,globalBits){
  if(bits===0)return {kind:'single',values:[reader.varint()]};
  if(bits<=globalBits){
    const size=reader.varint();
    if(size<0||size>4096)throw Error('Invalid 26.3 palette size');
    const values=[];
    for(let i=0;i<size;i++)values.push(reader.varint());
    return {kind:'indirect',values};
  }
  return {kind:'direct',values:null};
}

// BitStorage packs floor(64/bits) values per long, so longs = ceil(entries / floor(64/bits)).
// The padding matters: 5 bits uses 342 longs for 4096 entries, not 320.
// The wire carries exactly that many longs, with no length prefix.
function readContainer(reader,globalBits,entries){
  const bits=reader.u8();
  const palette=readPalette(reader,bits,globalBits);
  const longCount=bits===0?0:Math.ceil(entries/Math.floor(64/bits));
  const storage=new Array(longCount);
  for(let i=0;i<longCount;i++)storage[i]=reader.i64();
  return {bits,palette,storage};
}

export function unpackContainer(container,count){
  const entries=new Uint16Array(count);
  if(container.bits===0){entries.fill(container.palette.values[0]);return entries;}
  const {bits,storage,palette}=container;
  const perLong=Math.floor(64/bits),mask=(1n<<BigInt(bits))-1n;
  for(let i=0;i<count;i++){
    const word=storage[Math.floor(i/perLong)];
    const raw=Number((word>>BigInt((i%perLong)*bits))&mask);
    entries[i]=palette.kind==='direct'?raw:palette.values[raw];
  }
  return entries;
}

export function readHeightmaps(reader){
  const count=reader.varint();
  const heightmaps={};
  for(let i=0;i<count;i++){
    const type=reader.varint();
    const length=reader.varint();
    const values=[];
    for(let j=0;j<length;j++)values.push(reader.i64());
    heightmaps[type]=values;
  }
  return heightmaps;
}

export function readBlockEntities(reader){
  const count=reader.varint();
  const list=[];
  for(let i=0;i<count;i++){
    const packedXZ=reader.u8();
    const y=reader.i16();
    const type=reader.varint();
    const nbt=readAnonymousNbt(reader);
    list.push({packedXZ,y,type,nbt});
  }
  return list;
}

export function readChunkBuffer(buffer,sections=null){
  const reader=new Reader(buffer);
  const out=[];
  const readSection=()=>{
    const nonEmptyBlockCount=reader.i16();
    const fluidCount=reader.i16();
    const states=readContainer(reader,BLOCK_GLOBAL_BITS,BLOCK_ENTRIES);
    const biomes=readContainer(reader,BIOME_GLOBAL_BITS,BIOME_ENTRIES);
    out.push({
      index:out.length,
      nonEmptyBlockCount,
      fluidCount,
      blockBits:states.bits,
      blockPaletteSize:states.palette.kind==='direct'?null:states.palette.values.length,
      biomeBits:biomes.bits,
      biomePaletteSize:biomes.palette.kind==='direct'?null:biomes.palette.values.length,
      blockLongs:states.storage.length,
      biomeLongs:biomes.storage.length,
      stateIds:unpackContainer(states,BLOCK_ENTRIES),
      biomeIds:unpackContainer(biomes,BIOME_ENTRIES)
    });
  };
  // The buffer length is the native section count: 24 for a 384-block overworld, 16 for
  // 256-block nether/end dimensions. Never assume overworld height on a dimension change.
  if(sections===null)while(reader.remaining()>0)readSection();
  else for(let i=0;i<sections;i++)readSection();
  if(reader.remaining()!==0)throw Error('Chunk buffer not fully consumed: '+reader.remaining()+' bytes left');
  return out;
}

// ClientboundLevelChunkPacketData body (after x/z), as read by its STREAM_CODEC.
export function readChunkPacketData(reader){
  const heightmaps=readHeightmaps(reader);
  const length=reader.varint();
  const buffer=reader.bytesN(length).slice();
  const blockEntities=readBlockEntities(reader);
  return {heightmaps,buffer,blockEntities};
}

// ByteBufCodecs.BIT_SET is FriendlyByteBuf.readByteArray: VarInt byte length, then BitSet.toByteArray bytes.
function readBitSet(reader){
  return reader.bytesN(reader.varint()).slice();
}

function readByteArrayList(reader){
  const count=reader.varint();
  const list=[];
  for(let i=0;i<count;i++)list.push(reader.bytesN(reader.varint()).slice());
  return list;
}

export function readLightData(reader){
  return {
    skyYMask:readBitSet(reader),
    blockYMask:readBitSet(reader),
    emptySkyYMask:readBitSet(reader),
    emptyBlockYMask:readBitSet(reader),
    skyUpdates:readByteArrayList(reader),
    blockUpdates:readByteArrayList(reader)
  };
}

export function decodeLevelChunkWithLight(reader){
  const x=reader.i32();
  const z=reader.i32();
  const chunk=readChunkPacketData(reader);
  const light=readLightData(reader);
  return {x,z,...chunk,light,sections:readChunkBuffer(chunk.buffer)};
}
