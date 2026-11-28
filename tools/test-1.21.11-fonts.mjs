import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { isAbsolute } from 'node:path';
import { unihexProvider } from '../client/js/gui/font-unihex.js';

const root = new URL('../', import.meta.url);
const readJson = p => JSON.parse(readFileSync(new URL(p, root), 'utf8'));

function singleFileZip(name, contentBytes) {
  const nameBytes = Buffer.from(name, 'utf8');
  const crcTable = singleFileZip.crcTable || (singleFileZip.crcTable = (() => {
    const t = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
      t[i] = c >>> 0;
    }
    return t;
  })());
  let crc = 0xffffffff;
  for (let i = 0; i < contentBytes.length; i++) crc = crcTable[(crc ^ contentBytes[i]) & 0xff] ^ (crc >>> 8);
  crc = (crc ^ 0xffffffff) >>> 0;

  const local = Buffer.alloc(30 + nameBytes.length);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt32LE(crc, 14);
  local.writeUInt32LE(contentBytes.length, 18);
  local.writeUInt32LE(contentBytes.length, 22);
  local.writeUInt16LE(nameBytes.length, 26);
  nameBytes.copy(local, 30);

  const central = Buffer.alloc(46 + nameBytes.length);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(20, 4);
  central.writeUInt16LE(20, 6);
  central.writeUInt32LE(crc, 16);
  central.writeUInt32LE(contentBytes.length, 20);
  central.writeUInt32LE(contentBytes.length, 24);
  central.writeUInt16LE(nameBytes.length, 28);
  nameBytes.copy(central, 46);

  const cdOffset = local.length + contentBytes.length;
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(1, 8);
  eocd.writeUInt16LE(1, 10);
  eocd.writeUInt32LE(central.length, 12);
  eocd.writeUInt32LE(cdOffset, 16);

  return Buffer.concat([local, contentBytes, central, eocd]);
}

function sha256Alpha(rgba, w, h) {
  const alpha = new Uint8Array(w * h);
  for (let i = 0; i < alpha.length; i++) alpha[i] = rgba[i * 4 + 3];
  return createHash('sha256').update(alpha).digest('hex');
}

test('all 78 Mojang 1.21.11 unihex glyphs match widths, advances, bold/shadow metrics and rasterized alpha SHA-256', async () => {
  const inputs = readJson('cache/port-1.21.11/fonts-inputs.json');
  const fixture = readJson('tools/fixtures/fonts-1.21.11.json');
  assert.equal(inputs.length, fixture.samples.length);

  for (let i = 0; i < inputs.length; i++) {
    const inp = inputs[i];
    const sample = fixture.samples[i];
    assert.equal(inp.label, sample.label);

    const bytes = inp.path
      ? readFileSync(isAbsolute(inp.path) ? inp.path : new URL('../' + inp.path, import.meta.url))
      : singleFileZip('synthetic.hex', Buffer.from(inp.hex, 'utf8'));

    const uploads = new Map();
    const assets = {
      makeTexture: (name, w, h) => ({ name, width: w, height: h }),
      device: {
        updateTexture: (_atlas, rgba, x, y, w, h) => {
          uploads.set(`${x},${y},${w},${h}`, { rgba: Uint8Array.from(rgba), w, h });
        },
      },
    };
    const provider = await unihexProvider(assets, inp.definition, bytes, inp.label);

    for (const expected of sample.glyphs) {
      const glyph = provider.get(expected.character);
      if (expected.missing) {
        assert.equal(glyph, null, `${inp.label} expected missing glyph for ${expected.character}`);
        continue;
      }
      assert.ok(glyph, `${inp.label} expected present glyph for ${expected.character}`);
      assert.equal(glyph.width, expected.width, `${inp.label} width for ${expected.character}`);
      assert.equal(glyph.advance, expected.advance, `${inp.label} advance for ${expected.character}`);
      assert.equal(glyph.advance + glyph.boldOffset, expected.boldAdvance, `${inp.label} boldAdvance for ${expected.character}`);
      assert.equal(glyph.shadowOffset, expected.shadowOffset, `${inp.label} shadowOffset for ${expected.character}`);

      const tex = glyph.texture();
      assert.ok(tex, `${inp.label} texture baked for ${expected.character}`);
      const xPx = Math.round(glyph.u0 * tex.width);
      const yPx = Math.round(glyph.v0 * tex.height);
      const wPx = Math.round((glyph.u1 - glyph.u0) * tex.width);
      const hPx = Math.round((glyph.v1 - glyph.v0) * tex.height);
      assert.equal(wPx, expected.pixelWidth, `${inp.label} pixelWidth for ${expected.character}`);
      assert.equal(hPx, 16, `${inp.label} pixelHeight for ${expected.character}`);

      const upload = uploads.get(`${xPx},${yPx},${wPx},${hPx}`);
      assert.ok(upload, `${inp.label} recorded updateTexture for ${expected.character}`);
      assert.equal(sha256Alpha(upload.rgba, upload.w, upload.h), expected.alphaSha256, `${inp.label} alphaSha256 for ${expected.character}`);
    }
  }
});

test('1.21.11 client assets bundle default.json, include/unifont.json and both unifont zip files', () => {
  const def = readJson('client/assets/minecraft/font/default.json');
  assert.ok(def.providers.some(p => p.type === 'reference' && p.id === 'minecraft:include/unifont'));
  const unifont = readJson('client/assets/minecraft/font/include/unifont.json');
  assert.deepEqual(unifont.providers.map(p => p.hex_file), [
    'minecraft:font/unifont_jp.zip',
    'minecraft:font/unifont.zip',
  ]);
  assert.ok(existsSync(new URL('client/assets/minecraft/font/unifont.zip', root)));
  assert.ok(existsSync(new URL('client/assets/minecraft/font/unifont_jp.zip', root)));
});
