// Minimal Java class file reader: constant pool, fields, methods and their Code attributes (enough to run
// constructors in lib/jvm.js). The client jar is obfuscated, so callers find classes by their shape.

const CP = { UTF8: 1, INT: 3, FLOAT: 4, LONG: 5, DOUBLE: 6, CLASS: 7, STRING: 8, FIELD: 9, METHOD: 10, IMETHOD: 11, NAMETYPE: 12, MHANDLE: 15, MTYPE: 16, INDY: 18 };

function parseClass(buf) {
  let o = 0;
  const u1 = () => buf[o++];
  const u2 = () => { const v = buf.readUInt16BE(o); o += 2; return v; };
  const u4 = () => { const v = buf.readUInt32BE(o); o += 4; return v; };
  if (u4() !== 0xcafebabe) throw new Error('not a class file');
  u2(); u2(); // version
  const n = u2();
  const cp = new Array(n);
  for (let i = 1; i < n; i++) {
    const tag = u1();
    switch (tag) {
      case CP.UTF8: { const len = u2(); cp[i] = { tag, value: buf.toString('utf8', o, o + len) }; o += len; break; }
      case CP.INT: cp[i] = { tag, value: buf.readInt32BE(o) }; o += 4; break;
      case CP.FLOAT: cp[i] = { tag, value: buf.readFloatBE(o) }; o += 4; break;
      case CP.LONG: cp[i] = { tag, value: Number(buf.readBigInt64BE(o)) }; o += 8; i++; break;
      case CP.DOUBLE: cp[i] = { tag, value: buf.readDoubleBE(o) }; o += 8; i++; break;
      case CP.CLASS: case CP.STRING: case CP.MTYPE: cp[i] = { tag, ref: u2() }; break;
      case CP.FIELD: case CP.METHOD: case CP.IMETHOD: case CP.NAMETYPE: case CP.INDY: cp[i] = { tag, a: u2(), b: u2() }; break;
      case CP.MHANDLE: cp[i] = { tag, kind: u1(), ref: u2() }; break;
      default: throw new Error('bad constant tag ' + tag);
    }
  }
  const utf = (i) => cp[i].value;
  const className = (i) => utf(cp[i].ref);
  const access = u2();
  const name = className(u2());
  const sup = u2();
  const superName = sup ? className(sup) : null;
  const interfaces = [];
  for (let i = u2(); i > 0; i--) interfaces.push(className(u2()));
  const readAttrs = () => {
    const attrs = {};
    for (let i = u2(); i > 0; i--) {
      const an = utf(u2()), len = u4();
      attrs[an] = buf.subarray(o, o + len);
      o += len;
    }
    return attrs;
  };
  const members = () => {
    const out = [];
    for (let i = u2(); i > 0; i--) {
      const acc = u2(), nm = utf(u2()), desc = utf(u2());
      out.push({ access: acc, name: nm, desc, attrs: readAttrs() });
    }
    return out;
  };
  const fields = members();
  const methods = members();
  for (const m of methods) {
    const c = m.attrs.Code;
    if (!c) continue;
    const codeLen = c.readUInt32BE(4);
    m.maxLocals = c.readUInt16BE(2);
    m.code = c.subarray(8, 8 + codeLen);
  }
  // resolved constant pool helpers
  const ref = (i) => {
    const e = cp[i];
    const nt = cp[e.b];
    return { owner: className(e.a), name: utf(nt.a), desc: utf(nt.b) };
  };
  const constant = (i) => {
    const e = cp[i];
    if (e.tag === CP.STRING) return { type: 'string', value: utf(e.ref) };
    if (e.tag === CP.CLASS) return { type: 'class', value: utf(e.ref) };
    if (e.tag === CP.FLOAT || e.tag === CP.DOUBLE) return { type: 'float', value: e.value };
    if (e.tag === CP.INT || e.tag === CP.LONG) return { type: 'int', value: e.value };
    return { type: 'other', value: null };
  };
  const strings = cp.filter((e) => e && e.tag === CP.STRING).map((e) => utf(e.ref));
  return { name, superName, interfaces, access, fields, methods, cp, ref, constant, className, strings };
}

// Method descriptor -> { args: ['F', 'I', 'L...;', ...], ret }
function parseDesc(desc) {
  const args = [];
  let i = 1;
  while (desc[i] !== ')') {
    let j = i;
    while (desc[j] === '[') j++;
    if (desc[j] === 'L') j = desc.indexOf(';', j);
    args.push(desc.slice(i, j + 1));
    i = j + 1;
  }
  return { args, ret: desc.slice(i + 1) };
}

module.exports = { parseClass, parseDesc };
