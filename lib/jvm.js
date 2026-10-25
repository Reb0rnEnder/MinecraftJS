// A tiny Java bytecode interpreter for running Minecraft's model constructors at build time. It executes the jar's
// own code (ModelBase, ModelRenderer, the model classes) and stubs what lies outside the jar: java.lang / java.util
// collections, Guava's Lists / Maps, Math. Classes listed in `intercept` get their constructor replaced by a recorder
// (ModelBox: the boxes are what we want, not their vertices).
const { parseClass, parseDesc } = require('./classfile');

class JObject {
  constructor(cls) { this.cls = cls; this.fields = {}; }
}

// java.util stand-ins
class JList { constructor() { this.cls = 'java/util/ArrayList'; this.items = []; } }
class JMap { constructor() { this.cls = 'java/util/HashMap'; this.map = new Map(); } }

const f32 = Math.fround;

// java.util.Random (48-bit LCG), for models with seeded random part sizes (ModelGhast tentacles)
class JRandom {
  constructor() { this.cls = 'java/util/Random'; this.seed = 0n; }
  setSeed(s) { this.seed = (BigInt(Math.trunc(s)) ^ 0x5DEECE66Dn) & ((1n << 48n) - 1n); }
  next(bits) {
    this.seed = (this.seed * 0x5DEECE66Dn + 0xBn) & ((1n << 48n) - 1n);
    return Number(BigInt.asIntN(32, this.seed >> BigInt(48 - bits)));
  }
  nextInt(bound) {
    if ((bound & -bound) === bound) return Number((BigInt(bound) * BigInt(this.next(31))) >> 31n);
    let bits, val;
    do { bits = this.next(31); val = bits % bound; } while (bits - val + (bound - 1) < 0 || bits - val + (bound - 1) > 2147483647);
    return val;
  }
}
const isWide = (d) => d === 'J' || d === 'D';

class Jvm {
  constructor(jar, opts = {}) {
    this.jar = jar;
    this.cache = new Map();
    this.statics = new Map(); // class -> { field: value }
    this.intercept = opts.intercept || {}; // 'cls.<init>desc' or 'cls' -> (args, self) => value
    this.fieldKeys = new Map();
    this.steps = 0;
    this.maxSteps = opts.maxSteps || 5e6;
  }

  cls(name) {
    if (this.cache.has(name)) return this.cache.get(name);
    const buf = this.jar.read(name + '.class');
    const c = buf ? parseClass(buf) : null;
    this.cache.set(name, c);
    return c;
  }

  // Walks superclasses: is `name` (a jar class) a subclass of `base`?
  isSubclass(name, base) {
    for (let c = this.cls(name); c; c = c.superName ? this.cls(c.superName) : null) if (c.name === base) return true;
    return false;
  }

  // Field key "DeclaringClass.name": obfuscated names repeat across a class hierarchy
  fieldKey(owner, name, desc) {
    const k = owner + '.' + name + ':' + desc;
    let v = this.fieldKeys.get(k);
    if (v === undefined) {
      v = owner + '.' + name;
      for (let c = this.cls(owner); c; c = c.superName ? this.cls(c.superName) : null) {
        if (c.fields.some((f) => f.name === name && f.desc === desc)) { v = c.name + '.' + name; break; }
      }
      this.fieldKeys.set(k, v);
    }
    return v;
  }

  findMethod(clsName, name, desc) {
    for (let c = this.cls(clsName); c; c = c.superName ? this.cls(c.superName) : null) {
      const m = c.methods.find((x) => x.name === name && x.desc === desc);
      if (m) return { cls: c, m };
    }
    return null;
  }

  // Static initializer on first use of a jar class's statics
  staticsOf(name) {
    if (!this.statics.has(name)) {
      this.statics.set(name, {});
      const c = this.cls(name);
      if (c) {
        if (c.superName && this.cls(c.superName)) this.staticsOf(c.superName);
        const clinit = c.methods.find((m) => m.name === '<clinit>');
        if (clinit) {
          try { this.run(c, clinit, []); } catch (e) { /* static state we do not need */ }
        }
      }
    }
    return this.statics.get(name);
  }

  newObject(name) {
    if (name === 'java/util/Random') return new JRandom();
    if (name === 'java/util/ArrayList' || name === 'java/util/LinkedList') return new JList();
    if (name === 'java/util/HashMap' || name === 'java/util/LinkedHashMap' || name === 'java/util/TreeMap') return new JMap();
    return new JObject(name);
  }

  // Library calls outside the jar
  callExternal(owner, name, desc, self, args) {
    const key = owner + '.' + name;
    switch (key) {
      case 'java/lang/Object.<init>': case 'java/util/ArrayList.<init>': case 'java/util/HashMap.<init>': return undefined;
      case 'com/google/common/collect/Lists.newArrayList': { const l = new JList(); if (args[0] instanceof JList) l.items.push(...args[0].items); return l; }
      case 'com/google/common/collect/Maps.newHashMap': return new JMap();
      case 'java/lang/Math.sin': case 'java/lang/Math.cos': case 'java/lang/Math.sqrt': case 'java/lang/Math.abs':
      case 'java/lang/Math.floor': case 'java/lang/Math.ceil': return Math[name](args[0]);
      case 'java/lang/Math.max': return Math.max(args[0], args[1]);
      case 'java/lang/Math.min': return Math.min(args[0], args[1]);
      case 'java/lang/Float.valueOf': case 'java/lang/Integer.valueOf': case 'java/lang/Boolean.valueOf': return args[0];
      case 'java/lang/Float.floatValue': case 'java/lang/Integer.intValue': case 'java/lang/Boolean.booleanValue': return self;
      case 'java/lang/StringBuilder.<init>': self.s = args.length ? String(args[0]) : ''; return undefined;
      case 'java/lang/StringBuilder.append': self.s += String(args[0]); return self;
      case 'java/lang/StringBuilder.toString': return self.s;
      default: break;
    }
    if (owner.startsWith('org/lwjgl/')) return name === 'glGenLists' ? 1 : 0; // display lists etc.: no GL at build time
    if (self instanceof JRandom) {
      if (name === '<init>') { self.setSeed(args.length ? args[0] : Date.now()); return undefined; }
      if (name === 'setSeed') { self.setSeed(args[0]); return undefined; }
      if (name === 'nextInt') return args.length ? self.nextInt(args[0]) : self.next(32);
      if (name === 'nextFloat') return self.next(24) / (1 << 24);
      if (name === 'nextBoolean') return self.next(1);
      if (name === 'nextDouble') return (self.next(26) * 134217728 + self.next(27)) / 9007199254740992;
    }
    if (self instanceof JList) {
      if (name === 'add') { if (args.length === 2) self.items.splice(args[0], 0, args[1]); else self.items.push(args[0]); return 1; }
      if (name === 'get') return self.items[args[0]];
      if (name === 'remove') { const i = desc === '(I)Ljava/lang/Object;' ? args[0] : self.items.indexOf(args[0]); if (i < 0) return 0; const [old] = self.items.splice(i, 1); return desc === '(I)Ljava/lang/Object;' ? old : 1; }
      if (name === 'size') return self.items.length;
      if (name === 'clear') { self.items.length = 0; return undefined; }
      if (name === 'isEmpty') return self.items.length === 0 ? 1 : 0;
      if (name === 'addAll') { self.items.push(...args[0].items); return 1; }
      if (name === 'iterator') { let i = 0; const it = new JObject('iterator'); it.next = () => self.items[i++]; it.hasNext = () => (i < self.items.length ? 1 : 0); return it; }
    }
    if (self instanceof JMap) {
      if (name === 'put') { const old = self.map.get(args[0]); self.map.set(args[0], args[1]); return old === undefined ? null : old; }
      if (name === 'get') { const v = self.map.get(args[0]); return v === undefined ? null : v; }
      if (name === 'containsKey') return self.map.has(args[0]) ? 1 : 0;
    }
    if (self && self.cls === 'iterator') { if (name === 'next') return self.next(); if (name === 'hasNext') return self.hasNext(); }
    if (name === 'hashCode') return 0;
    if (name === 'equals') return self === args[0] ? 1 : 0;
    throw new Error('external call ' + key + desc);
  }

  // Invoke a method (virtual dispatch on the receiver's class when `virtual`)
  invoke(owner, name, desc, self, args, virtual) {
    const ic = this.intercept[owner + '.' + name + desc] || (name === '<init>' && this.intercept[owner]);
    if (ic) return ic(args, self, this);
    let target = owner;
    if (virtual && self instanceof JObject && this.cls(self.cls)) target = self.cls;
    const found = this.cls(target) ? this.findMethod(target, name, desc) : null;
    if (!found) return this.callExternal(owner, name, desc, self, args);
    if (!found.m.code) {
      if (found.m.access & 0x0100) return this.callExternal(owner, name, desc, self, args); // native
      throw new Error('abstract method ' + target + '.' + name + desc);
    }
    return this.run(found.cls, found.m, self === undefined ? args : [self, ...args]);
  }

  // Run one method; locals start with `args` (this first for instance methods; longs/doubles take two slots)
  run(c, m, args) {
    const code = m.code;
    const locals = new Array(m.maxLocals || 0).fill(undefined);
    const isStatic = !!(m.access & 0x0008);
    let li = 0;
    const desc = parseDesc(m.desc);
    if (!isStatic) locals[li++] = args[0];
    desc.args.forEach((d, i) => { locals[li] = args[i + (isStatic ? 0 : 1)]; li += isWide(d) ? 2 : 1; });
    const st = [];
    let pc = 0;
    const s1 = () => code.readInt8(pc++);
    const u1 = () => code[pc++];
    const s2 = () => { const v = code.readInt16BE(pc); pc += 2; return v; };
    const u2 = () => { const v = code.readUInt16BE(pc); pc += 2; return v; };
    const s4 = () => { const v = code.readInt32BE(pc); pc += 4; return v; };
    const pop = () => st.pop();
    const fieldStore = (obj, nm, v) => { obj.fields[nm] = v; };
    const branch = (cond, start, off) => { if (cond) pc = start + off; };
    for (;;) {
      if (++this.steps > this.maxSteps) throw new Error('step limit');
      const start = pc;
      const op = u1();
      switch (op) {
        case 0x00: break; // nop
        case 0x01: st.push(null); break;
        case 0x02: case 0x03: case 0x04: case 0x05: case 0x06: case 0x07: case 0x08: st.push(op - 0x03); break; // iconst
        case 0x09: case 0x0a: st.push(op - 0x09); break; // lconst
        case 0x0b: case 0x0c: case 0x0d: st.push(op - 0x0b); break; // fconst
        case 0x0e: case 0x0f: st.push(op - 0x0e); break; // dconst
        case 0x10: st.push(s1()); break; // bipush
        case 0x11: st.push(s2()); break; // sipush
        case 0x12: case 0x13: case 0x14: { const i = op === 0x12 ? u1() : u2(); const k = c.constant(i); st.push(k.type === 'class' ? { classRef: k.value } : k.value); break; } // ldc
        case 0x15: case 0x16: case 0x17: case 0x18: case 0x19: st.push(locals[u1()]); break; // xload
        case 0x1a: case 0x1b: case 0x1c: case 0x1d: st.push(locals[op - 0x1a]); break; // iload_n
        case 0x1e: case 0x1f: case 0x20: case 0x21: st.push(locals[op - 0x1e]); break; // lload_n
        case 0x22: case 0x23: case 0x24: case 0x25: st.push(locals[op - 0x22]); break; // fload_n
        case 0x26: case 0x27: case 0x28: case 0x29: st.push(locals[op - 0x26]); break; // dload_n
        case 0x2a: case 0x2b: case 0x2c: case 0x2d: st.push(locals[op - 0x2a]); break; // aload_n
        case 0x2e: case 0x2f: case 0x30: case 0x31: case 0x32: case 0x33: case 0x34: case 0x35: { const i = pop(), a = pop(); st.push(a[i]); break; } // xaload
        case 0x36: case 0x37: case 0x38: case 0x39: case 0x3a: locals[u1()] = pop(); break; // xstore
        case 0x3b: case 0x3c: case 0x3d: case 0x3e: locals[op - 0x3b] = pop(); break;
        case 0x3f: case 0x40: case 0x41: case 0x42: locals[op - 0x3f] = pop(); break;
        case 0x43: case 0x44: case 0x45: case 0x46: locals[op - 0x43] = pop(); break;
        case 0x47: case 0x48: case 0x49: case 0x4a: locals[op - 0x47] = pop(); break;
        case 0x4b: case 0x4c: case 0x4d: case 0x4e: locals[op - 0x4b] = pop(); break;
        case 0x4f: case 0x50: case 0x51: case 0x52: case 0x53: case 0x54: case 0x55: case 0x56: { const v = pop(), i = pop(), a = pop(); a[i] = op === 0x51 ? f32(v) : v; break; } // xastore
        case 0x57: pop(); break;
        case 0x58: pop(); pop(); break; // pop2 (we keep wide values in one slot; only used after wide ops here)
        case 0x59: st.push(st[st.length - 1]); break; // dup
        case 0x5a: { const a = pop(), b = pop(); st.push(a, b, a); break; } // dup_x1
        case 0x5b: { const a = pop(), b = pop(), d = pop(); st.push(a, d, b, a); break; } // dup_x2
        case 0x5c: { const a = pop(), b = pop(); st.push(b, a, b, a); break; } // dup2 (two category-1 values)
        case 0x5f: { const a = pop(), b = pop(); st.push(a, b); break; } // swap
        case 0x60: { const b = pop(), a = pop(); st.push((a + b) | 0); break; } // iadd
        case 0x61: case 0x63: { const b = pop(), a = pop(); st.push(a + b); break; } // ladd dadd
        case 0x62: { const b = pop(), a = pop(); st.push(f32(a + b)); break; } // fadd
        case 0x64: { const b = pop(), a = pop(); st.push((a - b) | 0); break; }
        case 0x65: case 0x67: { const b = pop(), a = pop(); st.push(a - b); break; }
        case 0x66: { const b = pop(), a = pop(); st.push(f32(a - b)); break; }
        case 0x68: { const b = pop(), a = pop(); st.push(Math.imul(a, b)); break; }
        case 0x69: case 0x6b: { const b = pop(), a = pop(); st.push(a * b); break; }
        case 0x6a: { const b = pop(), a = pop(); st.push(f32(a * b)); break; }
        case 0x6c: case 0x6d: { const b = pop(), a = pop(); st.push(Math.trunc(a / b)); break; } // idiv ldiv
        case 0x6e: { const b = pop(), a = pop(); st.push(f32(a / b)); break; }
        case 0x6f: { const b = pop(), a = pop(); st.push(a / b); break; }
        case 0x70: case 0x71: { const b = pop(), a = pop(); st.push(a % b); break; } // irem lrem
        case 0x72: { const b = pop(), a = pop(); st.push(f32(a % b)); break; }
        case 0x73: { const b = pop(), a = pop(); st.push(a % b); break; }
        case 0x74: st.push(-pop() | 0); break;
        case 0x75: case 0x77: st.push(-pop()); break;
        case 0x76: st.push(f32(-pop())); break;
        case 0x78: { const b = pop(), a = pop(); st.push(a << b); break; }
        case 0x7a: { const b = pop(), a = pop(); st.push(a >> b); break; }
        case 0x7c: { const b = pop(), a = pop(); st.push(a >>> b); break; }
        case 0x7e: { const b = pop(), a = pop(); st.push(a & b); break; }
        case 0x80: { const b = pop(), a = pop(); st.push(a | b); break; }
        case 0x82: { const b = pop(), a = pop(); st.push(a ^ b); break; }
        case 0x84: { const i = u1(), k = s1(); locals[i] = (locals[i] + k) | 0; break; } // iinc
        case 0x85: case 0x87: case 0x8a: case 0x8d: break; // i2l i2d l2d f2d: same number
        case 0x86: case 0x89: case 0x90: st.push(f32(pop())); break; // i2f l2f d2f
        case 0x88: case 0x8b: case 0x8c: case 0x8e: case 0x8f: { const v = pop(); st.push(Number.isFinite(v) ? Math.trunc(v) | 0 : 0); break; } // l2i f2i f2l d2i d2l
        case 0x91: st.push((pop() << 24) >> 24); break;
        case 0x92: st.push(pop() & 0xffff); break;
        case 0x93: st.push((pop() << 16) >> 16); break;
        case 0x94: case 0x95: case 0x96: case 0x97: case 0x98: { const b = pop(), a = pop(); st.push(a > b ? 1 : a < b ? -1 : a === b ? 0 : (op === 0x96 || op === 0x98 ? 1 : -1)); break; } // lcmp fcmpl fcmpg dcmpl dcmpg
        case 0x99: { const o = s2(); branch(pop() === 0, start, o); break; }
        case 0x9a: { const o = s2(); branch(pop() !== 0, start, o); break; }
        case 0x9b: { const o = s2(); branch(pop() < 0, start, o); break; }
        case 0x9c: { const o = s2(); branch(pop() >= 0, start, o); break; }
        case 0x9d: { const o = s2(); branch(pop() > 0, start, o); break; }
        case 0x9e: { const o = s2(); branch(pop() <= 0, start, o); break; }
        case 0x9f: { const o = s2(), b = pop(), a = pop(); branch(a === b, start, o); break; }
        case 0xa0: { const o = s2(), b = pop(), a = pop(); branch(a !== b, start, o); break; }
        case 0xa1: { const o = s2(), b = pop(), a = pop(); branch(a < b, start, o); break; }
        case 0xa2: { const o = s2(), b = pop(), a = pop(); branch(a >= b, start, o); break; }
        case 0xa3: { const o = s2(), b = pop(), a = pop(); branch(a > b, start, o); break; }
        case 0xa4: { const o = s2(), b = pop(), a = pop(); branch(a <= b, start, o); break; }
        case 0xa5: { const o = s2(), b = pop(), a = pop(); branch(a === b, start, o); break; }
        case 0xa6: { const o = s2(), b = pop(), a = pop(); branch(a !== b, start, o); break; }
        case 0xa7: { const o = s2(); pc = start + o; break; } // goto
        case 0xaa: { // tableswitch
          pc = (pc + 3) & ~3;
          const def = s4(), lo = s4(), hi = s4();
          const v = pop();
          if (v < lo || v > hi) pc = start + def;
          else { pc += (v - lo) * 4; pc = start + code.readInt32BE(pc); }
          break;
        }
        case 0xab: { // lookupswitch
          pc = (pc + 3) & ~3;
          const def = s4(), n = s4();
          const v = pop();
          let target = start + def;
          for (let i = 0; i < n; i++) { const k = s4(), o = s4(); if (k === v) { target = start + o; } }
          pc = target;
          break;
        }
        case 0xac: case 0xad: case 0xae: case 0xaf: case 0xb0: return pop(); // xreturn
        case 0xb1: return undefined; // return
        case 0xb2: { const r = c.ref(u2()); const k = this.fieldKey(r.owner, r.name, r.desc); const s = this.statics.get(k.split('.')[0]) || (this.cls(r.owner) ? this.staticsOf(k.split('.')[0]) : {}); st.push(s[k] === undefined ? defaultFor(r.desc) : s[k]); break; } // getstatic
        case 0xb3: { const r = c.ref(u2()); const k = this.fieldKey(r.owner, r.name, r.desc); this.staticsOf(k.split('.')[0])[k] = pop(); break; }
        case 0xb4: { const r = c.ref(u2()); const o = pop(); if (o == null) throw new Error('null getfield ' + r.name); const k = this.fieldKey(r.owner, r.name, r.desc); st.push(o.fields[k] === undefined ? defaultFor(r.desc) : o.fields[k]); break; }
        case 0xb5: { const r = c.ref(u2()); const v = pop(), o = pop(); fieldStore(o, this.fieldKey(r.owner, r.name, r.desc), r.desc === 'F' ? f32(v) : v); break; }
        case 0xb6: case 0xb7: case 0xb8: case 0xb9: { // invokevirtual / special / static / interface
          const r = c.ref(u2());
          if (op === 0xb9) pc += 2;
          const d = parseDesc(r.desc);
          const args = [];
          for (let i = d.args.length - 1; i >= 0; i--) args[i] = pop();
          const self = op === 0xb8 ? undefined : pop();
          const v = this.invoke(r.owner, r.name, r.desc, self, args, op === 0xb6 || op === 0xb9);
          if (d.ret !== 'V') st.push(v);
          break;
        }
        case 0xbb: { const k = c.constant(u2()); st.push(this.newObject(k.value)); break; } // new
        case 0xbc: { u1(); const n = pop(); st.push(new Array(n).fill(0)); break; } // newarray
        case 0xbd: { u2(); const n = pop(); st.push(new Array(n).fill(null)); break; } // anewarray
        case 0xbe: st.push(pop().length); break;
        case 0xbf: throw new Error('athrow');
        case 0xc0: u2(); break; // checkcast
        case 0xc1: { const k = c.constant(u2()); const o = pop(); st.push(o && o.cls && (o.cls === k.value || this.isSubclass(o.cls, k.value)) ? 1 : 0); break; }
        case 0xc5: { u2(); const dims = u1(); const sizes = []; for (let i = 0; i < dims; i++) sizes.unshift(pop()); const mk = (j) => (j === sizes.length - 1 ? new Array(sizes[j]).fill(0) : Array.from({ length: sizes[j] }, () => mk(j + 1))); st.push(mk(0)); break; }
        case 0xc6: { const o = s2(); branch(pop() == null, start, o); break; }
        case 0xc7: { const o = s2(); branch(pop() != null, start, o); break; }
        default: throw new Error(`opcode 0x${op.toString(16)} in ${c.name}.${m.name}${m.desc} at ${start}`);
      }
    }
  }
}

function defaultFor(desc) {
  if (desc === 'Z' || desc === 'I' || desc === 'F' || desc === 'D' || desc === 'J' || desc === 'B' || desc === 'S' || desc === 'C') return 0;
  return null;
}

module.exports = { Jvm, JObject, JList, JMap, JRandom };
