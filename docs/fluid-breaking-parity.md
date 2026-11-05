# Fluid-preserving block destruction (2026-11-05)

Local destruction replaced every broken block with air. Native clients since
1.13 replace it with the existing fluid state's legacy block. Breaking a
waterlogged slab/stair/sign/lantern or underwater plant should retain water
immediately, before the server responds. This fixes missing-water prediction;
it does not invent server-side fluid creation when breaking ordinary ice.

Exact controllers reviewed: 1.13.2 crf, 1.14.4 dke, 1.15.2 dnr, 1.16.5 dww,
1.17.1 ejl, 1.18.2 emv, 1.19.4 fdn. The 1.20.6 graphical baseline inherits the
1.19.4 correction. Older 1.8.9/1.12.2 targets do not gain waterlogging behavior.

Run `node --test tools/test-breaking-fluid-preservation.mjs tools/test-slab-prediction.mjs tools/test-fire-event-sound.mjs tools/test-placement-repairs.mjs`.
The eight affected worktrees pass 98 tests total; all eight browser entries
bundle. Existing native sound/particles still use the destroyed block's state.

The disposable vanilla 1.19.4 probe (probe-fluid-breaking.mjs against
run-presentation-fixture.mjs, loopback 25567, a fresh world and MOTD gate) broke
waterlogged bottom slab state 11019. The local prediction was source-water state
80 and remained 80 after the authoritative sequence acknowledgement. This is
packet/state validation, not a graphics or performance comparison.

Source correctness is checked against release-native code and the historical
[waterlogging feature](https://minecraft.wiki/w/Waterlogging). No user server,
world or configuration is modified. No distributions are rebuilt in this batch.

Native destruction also stops predicting tool durability from 1.14 onward.
The exact 1.13.2 controller still calls the item's mining callback, so that target
keeps its older path. The 1.14.4–1.19.4 controllers return after block/fluid
replacement and let server slot/entity updates own tool damage/destruction. The
client had incorrectly added one damage and could delete a nearly broken tool.
The seven affected baselines add test-block-break-durability.mjs; together with
the fluid/slab/fire/placement suite, all eight targets pass 105 tests.
