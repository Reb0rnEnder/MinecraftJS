// Server light is authoritative. Identical sections reuse their owned buffer;
// explicit empty sky sections and unknown sky are still distinct states.
export function sameLightBytes(previous, bytes) {
  if (!previous) return false;
  if (bytes) {
    for (let i=0;i<2048;i++) if (previous[i]!==bytes[i]) return false;
  } else {
    for (let i=0;i<2048;i++) if (previous[i]!==0) return false;
  }
  return true;
}
