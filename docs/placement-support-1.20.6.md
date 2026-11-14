# Native placement support restoration

The 1.20.6 runtime port omitted `blockCollisionShapes.support` entirely. Inherited
torch/lantern prediction therefore threw on ordinary states, including the reported
16 and 19460, rather than checking attachment support.

`support-data.mjs` executes the pinned client's `Block.canSupportCenter` and
`BlockState.isFaceSturdy` for all 26,684 states and all six faces, with native block
tags bound. The source jar SHA-1 is
`05b6f1c6b46a29d6ea82b4e0d42190e42402030f`; oracle classes are verified unchanged.
The generic extractor also finds the target's shipped `update_1_21` experimental
tags, which native registry constants reference. This does not enable experiments.

Visual runtime regeneration now includes support extraction; the target gate
re-extracts and compares the whole table. No guessed opacity/collision fallback
replaces these predicates. Thirteen placement/action/generation regressions pass.

Backport review: every existing 1.14.4–1.19.4 target already has its own complete
native support table; their 24 attachment regressions pass. 1.13.2 and earlier do
not use this support-table consumer. No modern state table is copied backwards.
Live WebMC acceptance and unrelated plant-placement rules remain separate work.
