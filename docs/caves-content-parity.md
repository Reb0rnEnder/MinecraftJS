# Caves content and inherited effects follow-up

Native input: the official client and mappings pinned in
`tools/port-1.17.1/target.json`. This records completed checks separately from
remaining version-wide acceptance work.

## State decoding and interaction

The client decoded integer properties from zero even when the registry supplied
an explicit list beginning at one. This affected candle counts, snow layers,
sea pickles, turtle eggs, repeater delay, leaf distance and filled cauldrons in
1.17.1. `propertyValues` now honors the supplied list. Every one of the 20,342
native block states matches the official generated report. The native runtime
build performs that comparison too, so future ports fail on a property mismatch.
The decoder correction and round-trip test are backported to flattened targets;
older data mostly used enum-valued lists and did not exhibit the new integer bug.

Light-block activation, candle extinguishing/ignition and berry-vine harvesting
consume one block-use result. This prevents a second hand or adjacent placement
from undoing an action. Stacking candles, snow layers, sea pickles and turtle eggs
uses the clicked cell, predicts the known incremented state and consumes one
item. Applicable stacking fixes are backported to 1.13.2–1.16.5; candles and other
1.17 content stay in 1.17.1.

## New models and effects

- AxolotlModel's five native poses (land idle/crawl, water hover/swim, playing
  dead), per-entity rotation history and transitions replace the previous
  generic oscillation. `ExtractAxolotlPoses.java` invokes the private numeric
  pose methods in the pinned native model. The JS port matches 20 native
  samples, including repeated interpolation, within 0.000003 radians/pixels.
  Baby axolotls use native AgeableListModel body transforms.
- Goat status 58/59 controls the 20-tick ramming head timer and two-tick decay.
  Baby head/body transforms and horn visibility follow native GoatModel and
  AgeableListModel settings. LONG_JUMPING dimensions scale by 0.7. Native 1.17
  inserted that pose before DYING; player decoding now uses DYING index 7.
  Screaming goats select their screaming hurt/death sound family.
- HumanoidModel's spyglass arm pose and PlayerItemInHandLayer's head attachment
  work in both hands, including left-primary-hand selection, pitch clamping,
  idle-bob suppression and restoration of the arm attachment on release.
- All 17 new particle types have packet/provider routing. These include light
  markers, color-transition dust, vibration signals, blossom spores, snowflakes,
  small flames, dripstone drops, glow/ink and copper sparks/wax/scrape. Dedicated
  vibration packets and particle payloads follow block/entity destinations;
  rendering uses native crossed, rotating planes rather than a billboard.
- Candle/cake wick positions, blossom emissions, active sculk-sensor dust,
  dripstone drops and powder-snow movement flakes have client effect producers.
  Copper world events 3002–3005 emit their native face/axis particle families.
  Light markers and item level overrides follow the target's light item.

## Inherited effects and backports

Modern block-break events were incorrectly unpacked as pre-1.13 block IDs, and
potion/Ender-eye effects used legacy item IDs. Modern targets now use direct
state IDs and registry item names. Dispenser smoke uses the six direction
ordinals introduced in 1.13, preserving the old horizontal encoding on 1.8.9
and 1.12.2. Both native Ender-eye portal rings are restored on all seven targets.

Ambient dispatch now recognizes flattened lit furnaces/wall torches, portal
names, redstone power/lit ore, bookshelf identities and leaf names. Furnace,
blast-furnace and smoker effects retain their native version availability.
These corrections are backported to 1.13.2–1.16.5.

Native comparisons include 1.8.9/1.12.2 RenderGlobal, 1.13.2 RenderGlobal and
1.17.1 LevelRenderer, ParticleUtils, the particle providers, AbstractCandleBlock,
CandleBlock, PointedDripstoneBlock, SculkSensorBlock, SporeBlossomBlock,
AxolotlModel, Goat/GoatModel, HumanoidModel and PlayerItemInHandLayer.
Wiki cross-checks: [1.17](https://minecraft.wiki/w/Java_Edition_1.17) and
[1.17.1](https://minecraft.wiki/w/Java_Edition_1.17.1).

## Verification and limits

The `test-axolotl-poses`, `test-1.17-mob-poses`, `test-caves-particles`,
`test-block-state-properties`, `test-stacked-block-use`,
`test-world-event-particles` and `test-modern-block-ambience` scripts exercise
these changes. Shared tests run on every applicable branch.

The isolated WebGL 2 content scene passes; the use-feature browser probe checks
all four hand/primary-hand combinations and frost/sign rendering; the new
particle browser probe draws all 17 new providers with valid sprites and no
console or missing-resource errors. These do not establish all-adapter or exact
pixel equality, and do not replace live server equipment/interactions.

Remaining engine-wide work is listed in `parity-1.17.1.md` and
`parity-1.16.5.md`: custom height support, Fabulous rendering, live inventory and
travel coverage, account services and remaining inherited animation/GUI audits.
This is not a declaration of full parity and does not start 1.18.2.
