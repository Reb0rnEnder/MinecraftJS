// Native Minecraft 1.21.9+ / 1.21.11 packed low-precision Vec3 (net.minecraft.network.LpVec3).
const MAX_QUANTIZED = 32766;
const ABS_MAX = 1.7179869183e10;
const ABS_MIN = 3.051944088384301e-5;

function sanitize(v) {
  return Number.isNaN(v) ? 0 : Math.min(Math.max(v, -ABS_MAX), ABS_MAX);
}

function pack(v) {
  return BigInt(Math.round((v * 0.5 + 0.5) * MAX_QUANTIZED));
}

function unpack(v) {
  return Math.min(Number(v & 0x7fffn), MAX_QUANTIZED) * 2 / MAX_QUANTIZED - 1;
}

export function readLpVec3(reader) {
  const b0 = reader.u8();
  if (b0 === 0) return { x: 0, y: 0, z: 0 };
  const b1 = reader.u8();
  const hi = reader.u32();
  const packed = (BigInt(hi) << 16n) | (BigInt(b1) << 8n) | BigInt(b0);
  let scale = BigInt(b0 & 3);
  if ((b0 & 4) === 4) {
    scale |= BigInt(reader.varint() >>> 0) << 2n;
  }
  const s = Number(scale);
  return {
    x: unpack(packed >> 3n) * s,
    y: unpack(packed >> 18n) * s,
    z: unpack(packed >> 33n) * s
  };
}

export function writeLpVec3(writer, vec) {
  const x = sanitize(vec?.x ?? 0);
  const y = sanitize(vec?.y ?? 0);
  const z = sanitize(vec?.z ?? 0);
  const max = Math.max(Math.abs(x), Math.max(Math.abs(y), Math.abs(z)));
  if (max < ABS_MIN) {
    writer.u8(0);
    return writer;
  }
  const scale = BigInt(Math.ceil(max));
  const hasContinuation = (scale & 3n) !== scale;
  const header = hasContinuation ? ((scale & 3n) | 4n) : scale;
  const s = Number(scale);
  const packed =
    header |
    (pack(x / s) << 3n) |
    (pack(y / s) << 18n) |
    (pack(z / s) << 33n);
  writer.u8(Number(packed & 0xffn));
  writer.u8(Number((packed >> 8n) & 0xffn));
  writer.u32(Number((packed >> 16n) & 0xffffffffn));
  if (hasContinuation) {
    writer.varint(Number((scale >> 2n) & 0xffffffffn));
  }
  return writer;
}
