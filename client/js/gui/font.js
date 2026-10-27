// Vanilla 1.13+ provider fonts, with the legacy renderer retained for older asset sets.
// layout() produces glyph quads; the GUI draws them directly and world text builds meshes from them.

const CHARS = 'ÀÁÂÈÊËÍÓÔÕÚßãõğİıŒœŞşŴŵžȇ\u0000\u0000\u0000\u0000\u0000\u0000\u0000 !"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~\u0000ÇüéâäàåçêëèïîìÄÅÉæÆôöòûùÿÖÜø£Ø×ƒáíóúñÑªº¿®¬½¼¡«»░▒▓│┤╡╢╖╕╣║╗╝╜╛┐└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀αβΓπΣσμτΦΘΩδ∞∅∈∩≡±≥≤⌠⌡÷≈°∙·√ⁿ²■\u0000';

export const COLOR_CODES = [];
for (let i = 0; i < 32; i++) {
  const j = ((i >> 3) & 1) * 85;
  let r = ((i >> 2) & 1) * 170 + j;
  let g = ((i >> 1) & 1) * 170 + j;
  let b = (i & 1) * 170 + j;
  if (i === 6) r += 85;
  if (i >= 16) { r = (r / 4) | 0; g = (g / 4) | 0; b = (b / 4) | 0; }
  COLOR_CODES.push((r << 16) | (g << 8) | b);
}

const CHAR_INDEX = new Map();
for (let i = 0; i < CHARS.length; i++) if (CHARS[i] !== '\u0000' && !CHAR_INDEX.has(CHARS[i])) CHAR_INDEX.set(CHARS[i], i);

const rgb = (c, a) => [((c >> 16) & 255) / 255, ((c >> 8) & 255) / 255, (c & 255) / 255, a];

export class FontRenderer {
  // texPath: font/ascii.png, or font/ascii_sga.png for Minecraft.standardGalacticFontRenderer
  constructor(gui, texPath = 'font/ascii.png') {
    this.gui = gui;
    this.texPath = texPath;
    this.assets = gui.assets;
    this.charWidth = new Array(256).fill(0);
    this.FONT_HEIGHT = 9;
    this.measuredVersion = -1;
    this.unicode = false; // FontRenderer.unicodeFlag: draw every character from the unicode glyph pages
    this.bidi = false;    // FontRenderer.bidiFlag: reorder right-to-left text
    this._measure();
  }

  get glyphWidth() { return this.assets.glyphSizes || EMPTY; }

  _measure() {
    const img = this.assets.image(this.texPath);
    if (!img) return;
    this.measuredVersion = this.assets.version;
    const cell = img.width / 16;
    const scale = 8 / cell;
    const data = img.data;
    for (let i = 0; i < 256; i++) {
      const cx = i % 16, cy = Math.floor(i / 16);
      if (i === 32) { this.charWidth[i] = 4; continue; }
      let col;
      for (col = cell - 1; col >= 0; col--) {
        let empty = true;
        for (let row = 0; row < cell && empty; row++) {
          if (data[((cy * cell + row) * img.width + cx * cell + col) * 4 + 3] !== 0) empty = false;
        }
        if (!empty) break;
      }
      col++;
      this.charWidth[i] = Math.floor(0.5 + col * scale) + 1;
    }
    this.cell = cell;
  }

  _providerSet() { return this.assets.fontSets?.[this.texPath === 'font/ascii_sga.png' ? 'alt' : 'default']; }

  _ready() {
    if (this.measuredVersion !== this.assets.version) this._widthBuckets = null;
    if (this._providerSet()) { this.measuredVersion = this.assets.version; return true; }
    if (this.measuredVersion !== this.assets.version) this._measure();
    return this.measuredVersion === this.assets.version;
  }

  charW(ch) {
    if (ch === ' ') return 4;
    if (ch === '§') return -1;
    const set = this._providerSet();
    if (set) return set.glyph(ch, this.unicode && this.texPath !== 'font/ascii_sga.png').advance;
    const i = this.unicode ? undefined : CHAR_INDEX.get(ch);
    if (i !== undefined) return this.charWidth[i];
    const gw = this.glyphWidth[ch.charCodeAt(0)];
    if (gw) return (((gw & 15) + 1 - (gw >>> 4)) / 2 + 1) | 0;
    return 0;
  }

  width(text) {
    if (!text) return 0;
    this._ready();
    if (this.bidi) text = bidiReorder(text);
    let w = 0;
    let bold = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (ch === '§' && i + 1 < text.length) {
        const code = text[i + 1].toLowerCase();
        if (code === 'l') bold = true;
        else if (code === 'r' || '0123456789abcdef'.includes(code)) bold = false;
        i++;
        continue;
      }
      const cw = this.charW(ch);
      const set = this._providerSet();
      const offset = set ? set.glyph(ch, this.unicode && this.texPath !== 'font/ascii_sga.png').boldOffset : 1;
      if (cw > 0) w += cw + (bold ? offset : 0);
    }
    return this._providerSet() ? Math.ceil(w) : w;
  }

  // Returns { quads: [{ tex, x0, y0, x1, y1, u0, v0, u1, v1, color:[r,g,b,a], skew }], width }
  layout(text, x, y, baseColor, shadow, alpha = 1) {
    const out = [];
    if (!text || !this._ready()) return { quads: out, width: 0 };
    if (this.bidi) text = bidiReorder(text);
    const offset = this._providerSet() ? 0 : 1;
    if (shadow) this._layout(out, text, x + offset, y + offset, baseColor, true, alpha);
    const width = this._layout(out, text, x, y, baseColor, false, alpha);
    return { quads: out, width };
  }

  _layout(out, text, x, y, baseColor, isShadow, alpha) {
    const shadowOf = (c) => (c & 0xfcfcfc) >> 2;
    let color = isShadow ? shadowOf(baseColor) : baseColor;
    let bold = false, italic = false, underline = false, strike = false, obf = false;
    const startX = x;
    const ascii = this.assets.texture(this.texPath);
    for (let i = 0; i < text.length; i++) {
      let ch = text[i];
      if (ch === '§' && i + 1 < text.length) {
        const code = text[i + 1].toLowerCase();
        const idx = '0123456789abcdef'.indexOf(code);
        if (idx >= 0) { bold = italic = underline = strike = obf = false; color = COLOR_CODES[idx + (isShadow ? 16 : 0)]; }
        else if (code === 'k') obf = true;
        else if (code === 'l') bold = true;
        else if (code === 'm') strike = true;
        else if (code === 'n') underline = true;
        else if (code === 'o') italic = true;
        else if (code === 'r') { bold = italic = underline = strike = obf = false; color = isShadow ? shadowOf(baseColor) : baseColor; }
        i++;
        continue;
      }
      if (obf && ch !== ' ') {
        const cands = this._sameWidth(this.charW(ch));
        if (cands.length) ch = cands[(Math.random() * cands.length) | 0];
      }
      const c = rgb(color, alpha);
      const set = this._providerSet(), glyph = set?.glyph(ch, this.unicode && this.texPath !== 'font/ascii_sga.png');
      const shadowOffset = isShadow && set ? glyph.shadowOffset : 0, boldOffset = glyph?.boldOffset ?? 1;
      const adv = this._glyph(out, ascii, ch, x + shadowOffset, y + shadowOffset, c, italic);
      if (bold && adv > 0) this._glyph(out, ascii, ch, x + shadowOffset + boldOffset, y + shadowOffset, c, italic);
      const total = adv + (bold && adv > 0 ? boldOffset : 0);
      if (strike) out.push({ tex: null, x0: x, y0: y + 4, x1: x + total, y1: y + 5, color: c });
      if (underline) out.push({ tex: null, x0: x - 1, y0: y + 8, x1: x + total, y1: y + 9, color: c });
      x += total;
    }
    return x - startX;
  }

  _sameWidth(w) {
    if (!this._widthBuckets) {
      this._widthBuckets = new Map();
      for (const [ch, i] of CHAR_INDEX) {
        if (i < 32 || i > 126) continue;
        const cw = this.charW(ch);
        if (!this._widthBuckets.has(cw)) this._widthBuckets.set(cw, []);
        this._widthBuckets.get(cw).push(ch);
      }
    }
    return this._widthBuckets.get(w) || [];
  }

  _glyph(out, ascii, ch, x, y, color, italic) {
    if (ch === ' ') return 4;
    const set = this._providerSet();
    if (set) {
      const g = set.glyph(ch, this.unicode && this.texPath !== 'font/ascii_sga.png'), tex = g.texture();
      if (tex) out.push({ tex, x0:x+g.x, y0:y+g.y, x1:x+g.x+g.width, y1:y+g.y+g.height,
        u0:g.u0, v0:g.v0, u1:g.u1, v1:g.v1, color, skew:italic?1:0, skewOrigin:y });
      return g.advance;
    }
    const i = this.unicode ? undefined : CHAR_INDEX.get(ch);
    const skew = italic ? 1 : 0;
    if (i !== undefined) {
      const w = this.charWidth[i] - 1;
      if (ascii) {
        const sz = ascii.width;
        const cell = this.cell;
        const u0 = (i % 16) * cell / sz, v0 = Math.floor(i / 16) * cell / sz;
        out.push({ tex: ascii, x0: x, y0: y, x1: x + w, y1: y + 8, u0, v0, u1: u0 + (w * cell / 8) / sz, v1: v0 + cell / sz, color, skew });
      }
      return this.charWidth[i];
    }
    const code = ch.charCodeAt(0);
    const gw = this.glyphWidth[code];
    if (!gw) return 0;
    const page = this.assets.texture(`font/unicode_page_${(code >> 8).toString(16).padStart(2, '0')}.png`);
    const start = gw >>> 4, end = (gw & 15) + 1;
    if (page) {
      const sz = page.width, cs = sz / 16;
      const u0 = ((code & 15) * cs + start * cs / 16) / sz, v0 = ((code >> 4) & 15) * cs / sz;
      out.push({ tex: page, x0: x, y0: y, x1: x + (end - start - 0.02) / 2, y1: y + 8, u0, v0, u1: u0 + (end - start - 0.02) * cs / 16 / sz, v1: v0 + cs / sz, color, skew });
    }
    return ((end - start) / 2 + 1) | 0;
  }

  // Draw into the GUI
  draw(text, x, y, color = 0xffffff, shadow = false, alpha = 1) {
    const g = this.gui;
    // Snap the text origin to whole screen pixels (unless rotated) so glyph texels map 1:1 to pixels;
    // half-GUI-pixel positions at odd GUI scales would otherwise resample the font texture
    const m = g.matrix;
    if (m && m[1] === 0 && m[4] === 0 && m[0] !== 0 && m[5] !== 0) {
      const k = g.scale || 1;
      const sx = (m[0] * x + m[12]) * k, sy = (m[5] * y + m[13]) * k;
      x += (Math.round(sx) - sx) / k / m[0];
      y += (Math.round(sy) - sy) / k / m[5];
    }
    const { quads, width } = this.layout(text, x, y, color, shadow, alpha);
    for (const q of quads) {
      if (!q.tex) { g.quad(g.white, q.x0, q.y0, q.x1, q.y1, 0, 0, 1, 1, q.color); continue; }
      if (q.skew) this._skewed(g, q); else g.quad(q.tex, q.x0, q.y0, q.x1, q.y1, q.u0, q.v0, q.u1, q.v1, q.color);
    }
    return width;
  }

  _skewed(g, q) {
    // Italic: vanilla shifts the glyph top right by 1 pixel and the bottom left by 1 pixel
    g.pushMatrix();
    const m = g.matrix;
    // x' = x + (y0 + 4 - y) * 0.25
    const sh = new Float32Array([1, 0, 0, 0, -0.25, 1, 0, 0, 0, 0, 1, 0, ((q.skewOrigin ?? q.y0) + 4) * 0.25, 0, 0, 1]);
    const r = new Float32Array(16);
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { let s = 0; for (let k = 0; k < 4; k++) s += m[k * 4 + j] * sh[i * 4 + k]; r[i * 4 + j] = s; }
    m.set(r);
    g.quad(q.tex, q.x0, q.y0, q.x1, q.y1, q.u0, q.v0, q.u1, q.v1, q.color);
    g.popMatrix();
  }

  drawCentered(text, cx, y, color = 0xffffff, shadow = true) {
    return this.draw(text, cx - Math.floor(this.width(text) / 2), y, color, shadow); // int maths like vanilla
  }

  // Formatting pairs are indivisible. Carry the style at the actual line break,
  // including when a component changes colour partway through a long word.
  wrap(text, maxWidth) {
    const out = []; let start = 0, prefix = '';
    const format = value => {
      let active = '';
      for (const match of value.matchAll(/§[0-9a-fk-or]/gi)) {
        const code = match[0].toLowerCase();
        active = /§[0-9a-fr]/.test(code) ? code : active + code;
      }
      return active;
    };
    while (start < text.length) {
      let end = start, space = -1;
      while (end < text.length && text[end] !== '\n') {
        if (text[end] === '§' && end + 1 < text.length) { end += 2; continue; }
        const next = end + (text.codePointAt(end) > 0xffff ? 2 : 1);
        if (this.width(prefix + text.slice(start, next)) > maxWidth) {
          if (space >= start) end = space;
          else if (!this.width(prefix + text.slice(start, end))) end = next;
          break;
        }
        if (text[end] === ' ') space = end;
        end = next;
      }
      const line = prefix + text.slice(start, end);
      out.push(line); prefix = format(line);
      start = end;
      if (text[start] === '\n' || text[start] === ' ') start++;
    }
    if (!text.length || text.endsWith('\n')) out.push(prefix);
    return out;
  }

  trimToWidth(text, w) {
    let s = '';
    for (let i = 0; i < text.length;) {
      const ch = text[i] === '§' && i + 1 < text.length ? text.slice(i, i + 2) : String.fromCodePoint(text.codePointAt(i));
      if (this.width(s + ch) > w) break;
      s += ch; i += ch.length;
    }
    return s;
  }
}

const EMPTY = new Uint8Array(65536);

// Minimal bidirectional reordering for right-to-left languages (Arabic, Hebrew...): visual order is the
// runs in reverse, with right-to-left runs reversed internally. Text with formatting codes is left alone.
const RTL = /[\u0590-\u08ff\ufb1d-\ufdff\ufe70-\ufeff]/;

// Arabic shaping (what vanilla does with ICU ArabicShaping): pick each letter's isolated / final /
// initial / medial presentation form from its neighbours, and join lam + alef into ligatures.
// ARABIC[code] = [isolated, final, initial, medial]; letters with only two forms join to the right only.
const ARABIC = {};
(() => {
  const right = [[0x622, 0xfe81], [0x623, 0xfe83], [0x624, 0xfe85], [0x625, 0xfe87], [0x627, 0xfe8d], [0x629, 0xfe93],
    [0x62f, 0xfea9], [0x630, 0xfeab], [0x631, 0xfead], [0x632, 0xfeaf], [0x648, 0xfeed], [0x649, 0xfeef]];
  for (const [c, f] of right) ARABIC[c] = [f, f + 1, 0, 0];
  const dual = [[0x626, 0xfe89], [0x628, 0xfe8f], [0x62a, 0xfe95], [0x62b, 0xfe99], [0x62c, 0xfe9d], [0x62d, 0xfea1], [0x62e, 0xfea5],
    [0x633, 0xfeb1], [0x634, 0xfeb5], [0x635, 0xfeb9], [0x636, 0xfebd], [0x637, 0xfec1], [0x638, 0xfec5], [0x639, 0xfec9], [0x63a, 0xfecd],
    [0x641, 0xfed1], [0x642, 0xfed5], [0x643, 0xfed9], [0x644, 0xfedd], [0x645, 0xfee1], [0x646, 0xfee5], [0x647, 0xfee9], [0x64a, 0xfef1]];
  for (const [c, f] of dual) ARABIC[c] = [f, f + 1, f + 2, f + 3];
  ARABIC[0x621] = [0xfe80, 0, 0, 0];
})();
const LAM_ALEF = { 0x622: 0xfef5, 0x623: 0xfef7, 0x625: 0xfef9, 0x627: 0xfefb };
const isMark = (c) => (c >= 0x64b && c <= 0x65f) || c === 0x670;
const joinsForward = (c) => c === 0x640 || !!(ARABIC[c] && ARABIC[c][2]);
const joinsBack = (c) => c === 0x640 || !!(ARABIC[c] && ARABIC[c][1]);

function shapeArabic(text) {
  const cs = [...text].map((ch) => ch.codePointAt(0));
  const out = [];
  const prevLetter = (i) => { for (let j = i - 1; j >= 0; j--) if (!isMark(cs[j])) return cs[j]; return 0; };
  const nextIndex = (i) => { for (let j = i + 1; j < cs.length; j++) if (!isMark(cs[j])) return j; return -1; };
  for (let i = 0; i < cs.length; i++) {
    const c = cs[i];
    const forms = ARABIC[c];
    if (!forms) { out.push(c); continue; }
    const prevJoins = joinsForward(prevLetter(i));
    const ni = nextIndex(i);
    const next = ni >= 0 ? cs[ni] : 0;
    // lam + alef ligature (isolated / final form)
    if (c === 0x644 && LAM_ALEF[next]) {
      out.push(LAM_ALEF[next] + (prevJoins ? 1 : 0));
      for (let j = i + 1; j < ni; j++) out.push(cs[j]);
      i = ni;
      continue;
    }
    const nextJoins = !!forms[2] && joinsBack(next);
    let f = prevJoins && forms[1] ? (nextJoins ? forms[3] : forms[1]) : (nextJoins ? forms[2] : forms[0]);
    out.push(f || forms[0]);
  }
  return String.fromCodePoint(...out);
}

function bidiReorder(text) {
  if (!RTL.test(text) || text.includes('§')) return text;
  text = shapeArabic(text);
  const runs = [];
  let cur = '', curRtl = null;
  for (const ch of text) {
    const rtl = RTL.test(ch) ? true : /[A-Za-z0-9]/.test(ch) ? false : curRtl;
    if (curRtl !== null && rtl !== curRtl) { runs.push([cur, curRtl]); cur = ''; }
    cur += ch; curRtl = rtl;
  }
  if (cur) runs.push([cur, curRtl]);
  return runs.reverse().map(([s, rtl]) => (rtl ? [...s].reverse().join('') : s)).join('');
}
export function stripCodes(s) { return s ? s.replace(/§./g, '') : ''; }
