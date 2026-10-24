// Offline class/bytecode inspection for the pinned creative extractor.
// node tools/creative-dump/inspect.mjs --find buildingBlocks
// node tools/creative-dump/inspect.mjs ahz '<clinit>'
import { ZipFile } from '../../lib/zip.js';
import { parseClass } from '../../lib/classfile.js';
import { walk } from '../../lib/bytecode.js';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { extractCreative } from './extract-1.13.2.mjs';
const jar = new ZipFile(process.env.MC_JAR || fileURLToPath(new URL('../../cache/1.13.2.jar', import.meta.url)));
const [name, method, descriptor] = process.argv.slice(2);
if (name === '--item') {
  const data = extractCreative(), items = JSON.parse(readFileSync(new URL('../../client/data/items.json', import.meta.url)));
  for (const it of items.filter(it => new RegExp(method).test(it.name))) {
    console.log(it.id, it.name, data.tabs.filter(t => t.items.some(s => s[0] === it.id)).map(t => t.label));
  }
} else if (name === '--lang') {
  const lang = JSON.parse(jar.read('assets/minecraft/lang/en_us.json'));
  console.log(Object.fromEntries(Object.entries(lang).filter(([key]) => key.includes(method))));
} else if (name === '--overrides') {
  for (const path of jar.list('').filter(p => p.endsWith('.class'))) {
    const c = parseClass(jar.read(path));
    for (const m of c.methods.filter(m => m.desc === method)) console.log(c.name, c.superName, m.name + m.desc);
  }
} else if (name === '--find') {
  for (const path of jar.list('').filter(p => p.endsWith('.class'))) {
    const c = parseClass(jar.read(path));
    if (c.strings.some(s => s.includes(method))) console.log(c.name, c.superName, c.strings.filter(s => s.includes(method)));
  }
} else {
  const c = parseClass(jar.read(name + '.class'));
  console.log(c.name, 'extends', c.superName, 'fields', c.fields.map(f => f.name + ':' + f.desc).join(' '));
  for (const m of c.methods) {
    if (method && m.name !== method || descriptor && m.desc !== descriptor) continue;
    console.log('\n' + m.name + m.desc);
    if (!method || !m.code) continue;
    for (const i of walk(m.code)) {
      let detail = '';
      if ([0x12, 0x13, 0x14].includes(i.op)) detail = JSON.stringify(c.constant(i.op === 0x12 ? i.u1 : i.u2));
      else if (i.op >= 0xb2 && i.op <= 0xb9) detail = JSON.stringify(c.ref(i.u2));
      else if ([0xbb, 0xbd, 0xc0, 0xc1].includes(i.op)) detail = c.className(i.u2);
      else if (i.value !== undefined) detail = i.value;
      else if (i.op >= 0x02 && i.op <= 0x08) detail = i.op - 3;
      else if (i.len === 3 && i.op >= 0x99 && i.op <= 0xa7 || i.op === 0xc6 || i.op === 0xc7) detail = '-> ' + (i.pc + m.code.readInt16BE(i.pc + 1));
      console.log(i.pc, i.op.toString(16).padStart(2, '0'), detail);
    }
  }
}
