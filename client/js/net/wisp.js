// Wisp endpoints use a trailing slash; wisp-python otherwise selects wsproxy.
export function wispUrl(value) {
  const url = new URL(value);
  if (!url.pathname.endsWith('/')) url.pathname += '/';
  return url.href;
}

export function wispPacket(bytes) {
  if (bytes.length < 5) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const type = bytes[0], id = view.getUint32(1, true);
  if (type === 3 && bytes.length !== 9 || type === 4 && bytes.length !== 6 || type === 5 && bytes.length < 7) return null;
  return { type, id, payload: bytes.subarray(5), credit: type === 3 ? view.getUint32(5, true) : null };
}
