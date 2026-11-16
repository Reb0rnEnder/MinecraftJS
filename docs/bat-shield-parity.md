# Bat and shield presentation — 1.20.6

Compared against the pinned 1.20.6 client and official mappings, 2026-11-17.

The bat geometry was already extracted from the new layer, but its runtime still used the old wing animation, hanging transforms and **0.35** renderer scale. The current adapter retains the complete native root/body/head/wing/wing-tip/feet hierarchy, resets its baked pose each render, applies the actual `BAT_FLYING`/`BAT_RESTING` keyframes and uses the native full model scale. Client animation states start once per flying/resting transition and preserve their original tick during subsequent ticks. Resting head yaw follows the native model; the old free head-pitch animation is removed. Native metadata flag accessor 16 is verified through `EntityManager.setMetadata`.

Blocking arms now use `HumanoidModel.poseBlockingArm`: half the walking pitch, the native blocking offset, clamped head pitch and clamped head yaw. Both main-hand sides and offhand blocking use the shared humanoid pose, including the third-person player renderer.

The oracle executes actual native `BatModel.setupAnim`, `Bat.setupAnimationStates`, and humanoid blocking methods. Fixtures contain **64 bat poses** over both states, starts at zero/40, partial ages and yaw choices, plus **100 shield poses** across both arms and pitch/yaw clamp boundaries. A separate native extraction reads the bat animation definitions; JavaScript keyframes and all named model parts are compared against the method outputs. The original classes are verified byte-identical to the pinned jar before execution; no graphics or FPS metrics are invented.

Run `node tools/port-1.20.6/presentation-fixtures.mjs --check` and `node --test tools/test-presentation-1.20.6.mjs`, then the complete target gate. Development assets include the updated bat field layout. Live screenshots are not recorded here; entity-name and pearl-feedback acceptance remain independently open in CONTENT-10.

Both behaviors changed in **1.20.3**, as documented in [Mojang's release notes](https://www.minecraft.net/en-us/article/minecraft-java-edition-1-20-3) and [the versioned Wiki](https://minecraft.wiki/w/Java_Edition_1.20.3). All nine existing older targets are 1.19.4 or earlier, so these later model/pose features are not backported. Older native bat and shield behavior is preserved.

The full `npm run test:1.20.6` gate passes **485 tests**, zero failures/skips. Both feature batches together pass twelve focused tests, and the complete browser bundle builds successfully.
