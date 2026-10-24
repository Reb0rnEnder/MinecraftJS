// Read-only branch audit. Extract snapshots into /tmp without switching or editing branches.
// Run from any checkout: node tools/audit-backports.mjs [older-ref ...]
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const refs = process.argv.slice(2);
if (!refs.length) refs.push('1.8.9', '1.12.2');
const snapshots = [];
for (const ref of refs) {
  const dir = mkdtempSync(join(tmpdir(), 'minecraftjs-backport-'));
  const archive = execFileSync('git', ['archive', ref, 'client/js', 'lib'], { cwd: root, maxBuffer: 32 * 1024 * 1024 });
  execFileSync('tar', ['-x', '-C', dir], { input: archive });
  snapshots.push([ref, dir]);
}
snapshots.push(['working tree', root]);
for (const [ref, dir] of snapshots) {
  const { copy, stackable, Inventory } = await import(pathToFileURL(join(dir, 'client/js/game/container.js')));
  const { chatToLegacy } = await import(pathToFileURL(join(dir, 'client/js/gui/chat.js')));
  const item = name => ({ id: 1, count: 1, damage: 0, nbt: { t: 10, v: { display: { t: 10, v: { Name: { t: 8, v: name } } } } } });
  const original = item('A'), cloned = copy(original);
  cloned.nbt.v.display.v.Name.v = 'changed';
  let predictions = 0;
  Inventory.prototype.setAll.call({ slots: [], updateCraftResult() { predictions++; }, onSlotChanged() { predictions++; } }, []);
  const hand = readFileSync(join(dir, 'client/js/render/hand-renderer.js'), 'utf8');
  const renderer = readFileSync(join(dir, 'client/js/render/entity-renderer.js'), 'utf8');
  console.log(JSON.stringify({ ref,
    copyOwnsNBT: original.nbt.v.display.v.Name.v === 'A',
    distinctTypedNBTDoesNotStack: !stackable(item('A'), item('B')),
    stringFalseDisablesBold: !chatToLegacy({ text: 'text', bold: 'false' }).includes('§l'),
    serverResultsAvoidLocalPrediction: predictions === 0,
    deferredHandSkinReset: hand.includes('invalidateSkin()') && renderer.includes('handRenderer.invalidateSkin()'),
    independentInvisibleEquipment: renderer.includes('bodyDrawables') && renderer.includes('wasInvisible'),
  }));
}
