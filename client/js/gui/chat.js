// JSON chat component -> legacy formatted string (with section-sign codes)

const COLOR_NAMES = {
  black: '0', dark_blue: '1', dark_green: '2', dark_aqua: '3', dark_red: '4', dark_purple: '5', gold: '6', gray: '7',
  dark_gray: '8', blue: '9', green: 'a', aqua: 'b', red: 'c', light_purple: 'd', yellow: 'e', white: 'f',
};

import { setTranslator as setI18nTranslator } from './i18n.js';

let translateFn = (k) => k;
export function setTranslator(fn) { translateFn = fn; setI18nTranslator(fn); }

function styleCodes(style) {
  let s = '';
  if (style.color && COLOR_NAMES[style.color]) s += '§' + COLOR_NAMES[style.color];
  if (style.obfuscated) s += '§k';
  if (style.bold) s += '§l';
  if (style.strikethrough) s += '§m';
  if (style.underlined) s += '§n';
  if (style.italic) s += '§o';
  return s;
}

function inherit(parent, c) {
  const st = { ...parent };
  for (const k of ['color', 'bold', 'italic', 'underlined', 'strikethrough', 'obfuscated']) {
    if (c[k] !== undefined) st[k] = c[k];
  }
  return st;
}

function toText(c, parentStyle) {
  if (c === null || c === undefined) return '';
  if (typeof c === 'string' || typeof c === 'number' || typeof c === 'boolean') {
    return styleCodes(parentStyle) + String(c);
  }
  if (Array.isArray(c)) {
    if (!c.length) return '';
    const first = c[0];
    const base = typeof first === 'object' ? inherit(parentStyle, first) : parentStyle;
    // the first element is the parent of the rest (each later part starts from its style, not the previous part's)
    return c.map((x, i) => (i === 0 ? toText(x, parentStyle) : '§r' + toText(x, base))).join('');
  }
  const style = inherit(parentStyle, c);
  const codes = styleCodes(style);
  let out = '';
  if (c.text !== undefined) out += codes + c.text;
  else if (c.translate !== undefined) {
    const args = (c.with || []).map((w) => toText(w, style) + '§r' + codes);
    out += codes + translateFn(c.translate, args);
  } else if (c.score) out += codes + (c.score.value !== undefined ? c.score.value : '');
  else if (c.selector) out += codes + c.selector;
  if (c.extra) for (const e of c.extra) out += '§r' + toText(e, style);
  return out;
}

// Gson's lenient JsonReader (vanilla parses chat with it): unquoted and single-quoted strings, '=' / '=>' between
// names and values, ';' between elements, and //, # and /* */ comments. Throws on text it cannot read either.
export function parseLenientJson(text) {
  let i = 0;
  const n = text.length;
  const fail = () => { throw new Error('Bad JSON at ' + i); };
  const skip = () => {
    for (;;) {
      while (i < n && /\s/.test(text[i])) i++;
      if (text[i] === '#' || (text[i] === '/' && text[i + 1] === '/')) { while (i < n && text[i] !== '\n') i++; continue; }
      if (text[i] === '/' && text[i + 1] === '*') { const e = text.indexOf('*/', i + 2); if (e < 0) fail(); i = e + 2; continue; }
      return;
    }
  };
  const quoted = (q) => {
    i++;
    let out = '';
    while (i < n && text[i] !== q) {
      let c = text[i++];
      if (c === '\\') {
        c = text[i++];
        if (c === 'u') { out += String.fromCharCode(parseInt(text.slice(i, i + 4), 16)); i += 4; continue; }
        c = { n: '\n', t: '\t', r: '\r', b: '\b', f: '\f' }[c] || c;
      }
      out += c;
    }
    if (i >= n) fail();
    i++;
    return out;
  };
  const literal = () => {
    const st = i;
    while (i < n && !/[\s/\\;#={}[\]:,]/.test(text[i])) i++;
    if (i === st) fail();
    return text.slice(st, i);
  };
  const value = () => {
    skip();
    const c = text[i];
    if (c === '{') {
      i++;
      const o = {};
      for (;;) {
        skip();
        if (text[i] === '}') { i++; return o; }
        const k = text[i] === '"' || text[i] === "'" ? quoted(text[i]) : literal();
        skip();
        if (text[i] === ':') i++;
        else if (text[i] === '=') { i++; if (text[i] === '>') i++; } else fail();
        o[k] = value();
        skip();
        if (text[i] === ',' || text[i] === ';') i++;
        else if (text[i] !== '}') fail();
      }
    }
    if (c === '[') {
      i++;
      const a = [];
      for (;;) {
        skip();
        if (text[i] === ']') { i++; return a; }
        a.push(value());
        skip();
        if (text[i] === ',' || text[i] === ';') i++;
        else if (text[i] !== ']') fail();
      }
    }
    if (c === '"' || c === "'") return quoted(c);
    const lit = literal();
    if (lit === 'true') return true;
    if (lit === 'false') return false;
    if (lit === 'null') return null;
    if (/^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(lit)) return Number(lit);
    return lit;
  };
  const v = value();
  skip();
  if (i < n) fail();
  return v;
}

export function chatToLegacy(json) {
  if (json === null || json === undefined) return '';
  let obj = json;
  if (typeof json === 'string') {
    try { obj = JSON.parse(json); } catch (e) {
      try { obj = parseLenientJson(json); } catch (err) { return json; }
    }
  }
  const s = toText(obj, {});
  return s;
}

// Plain text with codes removed
export function chatToPlain(json) {
  return chatToLegacy(json).replace(/§./g, '');
}

// Extract first click event URL (for chat links)
export function chatClickUrl(json) {
  let obj = json;
  if (typeof json === 'string') { try { obj = JSON.parse(json); } catch (e) { return null; } }
  const walk = (c) => {
    if (!c || typeof c !== 'object') return null;
    if (c.clickEvent && c.clickEvent.action === 'open_url') return c.clickEvent.value;
    for (const e of c.extra || []) { const r = walk(e); if (r) return r; }
    return null;
  };
  return walk(obj);
}
