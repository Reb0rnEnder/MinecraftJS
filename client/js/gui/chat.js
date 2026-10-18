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
    return c.map((x, i) => toText(x, i === 0 ? parentStyle : base)).join('');
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

export function chatToLegacy(json) {
  if (json === null || json === undefined) return '';
  let obj = json;
  if (typeof json === 'string') {
    try { obj = JSON.parse(json); } catch (e) { return json; }
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
