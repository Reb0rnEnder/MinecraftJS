// JSON chat component -> legacy formatted string (with section-sign codes)

const COLOR_NAMES = {
  black: '0', dark_blue: '1', dark_green: '2', dark_aqua: '3', dark_red: '4', dark_purple: '5', gold: '6', gray: '7',
  dark_gray: '8', blue: '9', green: 'a', aqua: 'b', red: 'c', light_purple: 'd', yellow: 'e', white: 'f',
  reset: 'r',
};

import { setTranslator as setI18nTranslator } from './i18n.js';

let translateFn = (k) => k;
export function setTranslator(fn) { translateFn = fn; setI18nTranslator(fn); }

function styleCodes(style) {
  // A false flag needs an actual reset even at the root (e.g. a custom item name
  // rendered inside an italic tooltip). Reapply the remaining effective style.
  let s = ['obfuscated', 'bold', 'strikethrough', 'underlined', 'italic'].some((k) => style[k] === false) ? '§r' : '';
  if (style.color && typeof COLOR_NAMES[style.color] === 'string') s += '§' + COLOR_NAMES[style.color];
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
    // JSON null, like an absent style property, inherits; false explicitly clears it.
    if (c[k] !== undefined && c[k] !== null) st[k] = k === 'color' ? c[k] : c[k] === true || c[k] === 'true';
  }
  return st;
}

function rootStyle(c, parent) {
  // A component array deserializes to its first component with the rest appended.
  if (Array.isArray(c)) return c.length ? rootStyle(c[0], parent) : parent;
  return c && typeof c === 'object' ? inherit(parent, c) : parent;
}

function toText(c, parentStyle) {
  if (c === null || c === undefined) return '';
  if (typeof c === 'string' || typeof c === 'number' || typeof c === 'boolean') {
    return c === '' ? '' : styleCodes(parentStyle) + String(c);
  }
  if (Array.isArray(c)) {
    if (!c.length) return '';
    const base = rootStyle(c[0], parentStyle);
    // the first element is the parent of the rest (each later part starts from its style, not the previous part's)
    return c.map((x, i) => toText(x, i === 0 ? parentStyle : base)).filter(Boolean).join('§r');
  }
  const style = inherit(parentStyle, c);
  const codes = styleCodes(style);
  let text = '';
  if (c.text !== undefined) text = String(c.text);
  else if (c.translate !== undefined) {
    // Reset BEFORE an argument as well as after it: bold:false (etc.) has no
    // enabling code of its own and otherwise leaks the translation's style.
    const args = (c.with || []).map((w) => '§r' + toText(w, style) + '§r' + codes);
    text = translateFn(c.translate, args);
  } else if (c.score) text = c.score.value !== undefined ? String(c.score.value) : '';
  else if (c.selector !== undefined) text = c.selector;
  let out = text ? codes + text : '';
  if (c.extra) for (const e of c.extra) {
    const part = toText(e, style);
    if (part) out += (out ? '§r' : '') + part;
  }
  return out;
}

const primitive = (c) => typeof c === 'string' || typeof c === 'number' || typeof c === 'boolean';

function isComponent(c) {
  if (primitive(c)) return true;
  if (!c || typeof c !== 'object') return false;
  if (Array.isArray(c)) return c.length > 0 && c.every(isComponent);
  let valid = false;
  if (c.text !== undefined) valid = primitive(c.text);
  else if (c.translate !== undefined) valid = typeof c.translate === 'string' && (c.with === undefined || Array.isArray(c.with) && c.with.every(isComponent));
  else if (c.score) valid = primitive(c.score.name) && primitive(c.score.objective) && (c.score.value === undefined || primitive(c.score.value));
  else if (c.selector !== undefined) valid = typeof c.selector === 'string';
  return valid && (c.extra === undefined || Array.isArray(c.extra) && c.extra.every(isComponent));
}

function hasComponentObject(c) {
  return Array.isArray(c) ? c.some(hasComponentObject) : c !== null && typeof c === 'object';
}

function decodeComponent(text) {
  try {
    const c = JSON.parse(text);
    // Bare numbers/booleans/null can also be legacy text. Preserve their spelling
    // and whitespace; quoted strings, component objects and arrays decode once.
    return (typeof c === 'string' || c !== null && typeof c === 'object') && isComponent(c) ? c : text;
  } catch (e) {
    try {
      const c = parseLenientJson(text);
      // Leniency is for recognizable components, not prose such as [red, blue],
      // single-quoted text or comments that happen to be accepted by Gson.
      return hasComponentObject(c) && isComponent(c) ? c : text;
    } catch (err) { return text; }
  }
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
        if (c === 'u') {
          const hex = text.slice(i, i + 4);
          if (!/^[0-9a-fA-F]{4}$/.test(hex)) fail();
          out += String.fromCharCode(parseInt(hex, 16)); i += 4; continue;
        }
        if (!'"\'\\/bfnrt\n'.includes(c)) fail();
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
      const o = Object.create(null);
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

// At a wire/NBT component boundary, strings are serialized JSON or legacy text.
// Use { parsed: true } for values already extracted from JSON (status.description,
// hoverEvent.value, translation arguments, etc.). Never reparse text/extra/with
// string values, even if they contain a complete JSON component as literal text.
// `style` supplies an inherited style when composing components (e.g. team color).
export function chatToLegacy(json, { parsed = false, style = {} } = {}) {
  if (json === null || json === undefined) return '';
  let obj = typeof json === 'string' && !parsed ? decodeComponent(json) : json;
  if (!isComponent(obj)) obj = typeof json === 'string' ? json : JSON.stringify(json);
  const s = toText(obj, style);
  // Close structured formatting so appending another string cannot leak styles.
  // Plain/legacy strings retain their exact bytes, including existing § codes.
  if (typeof obj === 'object' || styleCodes(style)) {
    if (!s.replace(/§./g, '')) return '';
    return /§./.test(s) ? s + '§r' : s;
  }
  return s;
}

// Plain text with codes removed
export function chatToPlain(json, options) {
  return chatToLegacy(json, options).replace(/§./g, '');
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
