// UTF-8 in plain JS (no TextEncoder/TextDecoder), so game code does not depend on host APIs.
// Invalid input decodes to U+FFFD exactly like TextDecoder; lone surrogates encode as U+FFFD like TextEncoder.

export function encodeUtf8(s) {
  const out = new Uint8Array(s.length * 3);
  let o = 0;
  for (let i = 0; i < s.length; i++) {
    let c = s.charCodeAt(i);
    if (c < 0x80) { out[o++] = c; continue; }
    if (c < 0x800) { out[o++] = 0xc0 | (c >> 6); out[o++] = 0x80 | (c & 63); continue; }
    if (c >= 0xd800 && c < 0xe000) {
      const d = s.charCodeAt(i + 1);
      if (c < 0xdc00 && d >= 0xdc00 && d < 0xe000) {
        c = 0x10000 + ((c - 0xd800) << 10) + (d - 0xdc00);
        i++;
        out[o++] = 0xf0 | (c >> 18); out[o++] = 0x80 | ((c >> 12) & 63);
        out[o++] = 0x80 | ((c >> 6) & 63); out[o++] = 0x80 | (c & 63);
        continue;
      }
      c = 0xfffd;
    }
    out[o++] = 0xe0 | (c >> 12); out[o++] = 0x80 | ((c >> 6) & 63); out[o++] = 0x80 | (c & 63);
  }
  return out.subarray(0, o);
}

// WHATWG UTF-8 decode (what TextDecoder does): each maximal invalid subsequence becomes one U+FFFD
export function decodeUtf8(b, start = 0, end = b.length) {
  let s = '';
  const codes = [];
  const push = (cp) => {
    if (cp > 0xffff) { cp -= 0x10000; codes.push(0xd800 + (cp >> 10), 0xdc00 + (cp & 1023)); } else codes.push(cp);
    if (codes.length > 8000) { s += String.fromCharCode.apply(null, codes); codes.length = 0; }
  };
  let needed = 0, seen = 0, cp = 0, lower = 0x80, upper = 0xbf;
  for (let i = start; i < end; i++) {
    const x = b[i];
    if (needed === 0) {
      if (x < 0x80) push(x);
      else if (x >= 0xc2 && x <= 0xdf) { needed = 1; cp = x & 0x1f; }
      else if (x >= 0xe0 && x <= 0xef) { if (x === 0xe0) lower = 0xa0; if (x === 0xed) upper = 0x9f; needed = 2; cp = x & 0xf; }
      else if (x >= 0xf0 && x <= 0xf4) { if (x === 0xf0) lower = 0x90; if (x === 0xf4) upper = 0x8f; needed = 3; cp = x & 7; }
      else push(0xfffd);
      continue;
    }
    if (x < lower || x > upper) {
      needed = seen = cp = 0; lower = 0x80; upper = 0xbf;
      push(0xfffd);
      i--; // the byte starts again
      continue;
    }
    lower = 0x80; upper = 0xbf;
    cp = (cp << 6) | (x & 0x3f);
    if (++seen === needed) { push(cp); needed = seen = cp = 0; }
  }
  if (needed) push(0xfffd);
  return s + String.fromCharCode.apply(null, codes);
}
