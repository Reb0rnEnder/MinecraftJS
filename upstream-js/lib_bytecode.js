// Linear bytecode walker: yields { pc, op, ...operands } for each instruction (used to find `new Model(...)` sites).
const LEN = new Uint8Array(256).fill(1);
for (const op of [0x10, 0x12, 0x15, 0x16, 0x17, 0x18, 0x19, 0x36, 0x37, 0x38, 0x39, 0x3a, 0xa9, 0xbc]) LEN[op] = 2;
for (const op of [0x11, 0x13, 0x14, 0x84, 0xb2, 0xb3, 0xb4, 0xb5, 0xb6, 0xb7, 0xb8, 0xbb, 0xbd, 0xc0, 0xc1, 0xc6, 0xc7]) LEN[op] = 3;
for (let op = 0x99; op <= 0xa8; op++) LEN[op] = 3;
LEN[0xc5] = 4; LEN[0xb9] = 5; LEN[0xba] = 5; LEN[0xc8] = 5; LEN[0xc9] = 5;

function* walk(code) {
  let pc = 0;
  while (pc < code.length) {
    const op = code[pc];
    let len = LEN[op];
    if (op === 0xaa) { const p = (pc + 4) & ~3; const lo = code.readInt32BE(p + 4), hi = code.readInt32BE(p + 8); len = p - pc + 12 + (hi - lo + 1) * 4; }
    else if (op === 0xab) { const p = (pc + 4) & ~3; const n = code.readInt32BE(p + 4); len = p - pc + 8 + n * 8; }
    else if (op === 0xc4) len = code[pc + 1] === 0x84 ? 6 : 4;
    const ins = { pc, op, len };
    if (len >= 3) ins.u2 = code.readUInt16BE(pc + 1);
    if (len === 2) ins.u1 = code[pc + 1];
    if (op === 0x10) ins.value = code.readInt8(pc + 1);
    if (op === 0x11) ins.value = code.readInt16BE(pc + 1);
    yield ins;
    pc += len;
  }
}

module.exports = { walk };
