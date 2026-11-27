// P14: one explicit 26.3 disposition for every inherited 1.20.6 checkpoint.
//
// The 1.20.6 checklist has 83 checkpoints. The version jump must not silently drop any of
// them, so this register maps every id to exactly one of:
//   implemented-26.3  ported/replaced by the native 26.3 implementation and covered by tests
//   carried-open      still applies and remains partial/unverified on 26.3
//   blocked-account   needs a real Microsoft/Mojang authenticated session
//   blocked-visual    needs a human visual/backend comparison or live server scenario
//   out-of-scope      product/optional surface outside the port
//
// Usage: node tools/port-26.3/inherited-findings.mjs [--check]
import {readFileSync,writeFileSync} from 'node:fs';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const sourcePath=join(root,'docs/parity-checklist-1.20.6.json');
const jsonPath=join(root,'docs/transition-26.3.inherited-findings.json');
const mdPath=join(root,'docs/transition-26.3.inherited-findings.md');
const source=JSON.parse(readFileSync(sourcePath,'utf8'));

const O='out-of-scope',B='blocked-account',V='blocked-visual',I='implemented-26.3',C='carried-open';
const decisions={
  'BASE-01':I,'BASE-02':I,'BASE-03':I,'BASE-04':I,'BASE-05':I,'BASE-06':I,'BASE-07':I,'BASE-08':I,'BASE-09':I,'BASE-10':I,'BASE-11':I,'BASE-12':I,
  'FONT-01':I,'FONT-02':I,'FONT-03':I,'FONT-04':V,
  'PACK-01':I,'PACK-02':I,'PACK-03':C,'PACK-04':V,
  'ITEM-01':I,'ITEM-02':I,'ITEM-03':I,'ITEM-04':I,'ITEM-05':C,'ITEM-06':I,
  'MENU-01':C,'MENU-02':C,
  'ACT-01':I,'ACT-02':C,'ACT-03':C,
  'UI-01':C,'UI-02':C,'UI-03':C,'UI-04':C,'UI-05':C,'UI-06':I,'UI-07':C,'UI-06-LIVE':V,
  'CHAT-01':I,'CHAT-02':I,'CHAT-03':C,'CHAT-04':B,'CHAT-05':B,'CHAT-06':B,
  'NET-01':I,'NET-02':B,'NET-03':B,'NET-04':C,
  'CONTENT-01':C,'CONTENT-02':C,'CONTENT-03':C,'CONTENT-04':C,'CONTENT-05':C,'CONTENT-06':C,'CONTENT-07':C,'CONTENT-08':C,'CONTENT-09':C,'CONTENT-10':C,
  'PAWS-01':C,'PAWS-02':C,'PAWS-03':C,'PAWS-04':C,
  'RENDER-01':I,'RENDER-02':I,'RENDER-03':C,'RENDER-04':C,'RENDER-05':C,
  'FX-01':C,'FX-02':C,'FX-03':C,
  'VERIFY-01':I,'VERIFY-02':V,'VERIFY-03':V,'VERIFY-04':V,'VERIFY-05':C,'VERIFY-06':I,
  'EXP-01':C,'EXP-02':C,
  'PRODUCT-01':O,'PRODUCT-02':O,
  'EXTRA-01':O,'EXTRA-02':O
};
const evidence={
  [I]:['npm run test:26.3','npm run adapter:26.3','docs/parity-checklist-26.3.md'],
  [C]:['docs/parity-checklist-26.3.md','docs/transition-26.3.tasks.json'],
  [B]:['P09 requires a real Microsoft/Mojang session; no offline substitute is accepted.'],
  [V]:['P15 visual/scenario acceptance requires a human comparison against native 26.3.'],
  [O]:['Product/optional scope decision; not part of native multiplayer parity.']
};
const notes={
  'PACK-03':'Pack priority, import and overlays are implemented; native drag/drop confirmation and the full focus transition remain open.',
  'PACK-04':'Live multi-pack reload and Configuration/Play pack lifecycle need a human/server run.',
  'ITEM-05':'Books, skull profiles, banners, bundles and container contents are adapted; visual/tooltip acceptance remains open.',
  'MENU-01':'Native layouts and component-bearing clicks exist; live merchant/enchanting/stonecutter/loom acceptance remains.',
  'MENU-02':'Native RecipeDisplay graph and recipe book are implemented; live visual acceptance remains.',
  'ACT-02':'Placement/prediction paths exist; the complete side-effect matrix is not live-accepted.',
  'CHAT-03':'Incoming chat trust/deletion/filtering is decoded; live hover/click/narration acceptance remains.',
  'NET-04':'Offline reconnect paths are exercised; cancellation/timeout/stress acceptance remains open.',
  'CONTENT-01':'Sign rendering/editing is ported; the complete two-sided/wax live matrix remains open.',
  'PAWS-02':'Wolf variants and textures are native; live visual comparison remains.',
  'FX-01':'Client-owned sound triggers are mapped; live per-trigger acceptance remains.',
  'VERIFY-05':'Shared fixes are reviewed per batch; not every target has a final backport receipt.',
  'FONT-04':'Provider stacks are tested; live font-pack/backend and complex-script visual acceptance remain.'
};

const rows=source.checkpoints.map(checkpoint=>{
  const disposition=decisions[checkpoint.id];
  assert.ok(disposition,'missing 26.3 disposition for '+checkpoint.id);
  return {
    id:checkpoint.id,
    area:checkpoint.area,
    inheritedStatus:checkpoint.status,
    title:checkpoint.title,
    disposition,
    note:notes[checkpoint.id]??null,
    evidence:evidence[disposition]
  };
});
assert.equal(rows.length,83,'the 1.20.6 checklist has 83 checkpoints');
assert.equal(new Set(rows.map(row=>row.id)).size,rows.length,'checkpoint ids are unique');
const counts={};
for(const row of rows)counts[row.disposition]=(counts[row.disposition]||0)+1;
const register={
  schemaVersion:1,
  target:'26.3',
  inheritedTarget:'1.20.6',
  source:'docs/parity-checklist-1.20.6.json',
  recordedOn:'2026-11-27',
  checkpoints:rows.length,
  counts,
  rows
};
const markdown=[
  '# 26.3 inherited-finding dispositions',
  '',
  'Generated by `tools/port-26.3/inherited-findings.mjs` from the 83-checkpoint 1.20.6',
  'checklist. Every checkpoint has exactly one 26.3 disposition; no inherited finding is dropped',
  'by the version jump.',
  '',
  '| Disposition | Checkpoints |',
  '| --- | ---: |',
  ...Object.entries(counts).sort((a,b)=>b[1]-a[1]).map(([name,count])=>`| ${name} | ${count} |`),
  '',
  '`implemented-26.3` means the 26.3 implementation and its focused tests supersede the inherited',
  'finding. `carried-open` means the finding still applies and remains partial/unverified; it is',
  'not silently claimed as done.',
  '',
  '| ID | Area | 1.20.6 status | 26.3 disposition | Note |',
  '| --- | --- | --- | --- | --- |',
  ...rows.map(row=>`| ${row.id} | ${row.area} | ${row.inheritedStatus} | ${row.disposition} | ${(row.note||'').replace(/\|/g,'\\|')} |`),
  '',
  '## Evidence',
  '',
  '- Full register with per-row evidence: `docs/transition-26.3.inherited-findings.json`.',
  '- `implemented-26.3` rows are covered by `npm run test:26.3`, `npm run adapter:26.3`, the native gates and the current parity checklist.',
  '- Account, visual and product rows are explicitly blocked/out of scope, not counted as passes.',
  ''
].join('\n');
if(process.argv.includes('--check')){
  assert.deepEqual(JSON.parse(readFileSync(jsonPath,'utf8')),register,'inherited finding register needs regeneration');
  assert.equal(readFileSync(mdPath,'utf8'),markdown,'inherited finding markdown needs regeneration');
  console.log('Verified 26.3 dispositions for all '+rows.length+' inherited 1.20.6 checkpoints');
}else{
  writeFileSync(jsonPath,JSON.stringify(register,null,2)+'\n');
  writeFileSync(mdPath,markdown);
  console.log('Wrote 26.3 dispositions for '+rows.length+' inherited checkpoints');
}
