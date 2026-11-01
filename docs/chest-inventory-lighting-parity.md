# Chest geometry and inventory player lighting

Target: 1.13.2. Performance investigation was cancelled by the user; this
change does not alter Super Potato Mode, resolution, frame pacing or settings.

## Chest fixes and release boundaries

1.15.2 through 1.18.2: native chest geometry is y-up. The item path still applied
the legacy y/z flip, putting the base above the lid. Chest, trapped chest and
ender chest items now use the extracted geometry with positive 1/16 scale.
Native ChestRenderer's no-world fallback faces SOUTH; an extra 180-degree turn
would hide the latch. The test checks base/lid heights and the latch's front Z.
1.8.9 through 1.14.4 retain their native y-down geometry and existing item flip;
the same height/front checks pass without changing those old transforms.
The [Minecraft Wiki chest history](https://minecraft.wiki/w/Chest#History)
records the 1.15 texture-layout change; actual vertices and transforms are
checked against each target's extracted jar models.

1.17.1 / 1.18.2: native DOUBLE_CHEST_LEFT belongs to a LEFT block and
DOUBLE_CHEST_RIGHT to a RIGHT block. Their model names were reversed at the
render call. Correcting the choice closes the seam and brings the two lock
halves together. 1.15.2 / 1.16.5 use older extraction field names whose geometry
has the reverse naming; their existing mapping is retained and passes the same
seam and lock geometry regression. Earlier releases keep their whole double
chest model and texture.

Native 1.18.2 references: ChestRenderer `esu`, ModelLayers `ema` fields E/F,
ChestType `cpn` (b=LEFT,c=RIGHT), BlockEntityWithoutLevelRenderer `eqe` and
ItemRenderer `ewh`. The no-world branch in ChestRenderer explicitly selects
SOUTH. The single model's base is y=0..10, lid y=9..14 and lock z=15..16,
in model pixels. The left half has x=0..15 and the right half x=1..16.

## Player preview lighting

The inventory preview was full-bright but used world-space directional lights.
It now selects a separate inventory lighting mode, keeping the lightmap
full-bright while applying the target's native directional illumination.
WebGL 2, WebGPU and the software rasterizer share the target's light constants.
World entities and item lighting retain their existing modes.

Native versions inspected:

| Targets | Native implementation | Lighting in our y-down GUI space |
| --- | --- | --- |
| 1.8.9 | GuiInventory azc / RenderHelper avc | Standard lights under GUI flip and Y rotation 135 degrees |
| 1.12.2 | GuiInventory bmx / RenderHelper bhz | Same legacy transform |
| 1.13.2 | InventoryScreen clp / RenderHelper cfr | Same legacy transform |
| 1.14.4 | InventoryScreen deb / Lighting cuf | Same legacy transform |
| 1.15.2 | InventoryScreen dhr / Lighting cxn / GlStateManager cxk | Native GUI 3D diffuse-light matrix |
| 1.16.5 | InventoryScreen dql / Lighting dep / GlStateManager dem | Native GUI 3D diffuse-light matrix |
| 1.17.1 | InventoryScreen ecj / Lighting dph | Dedicated inventory entity shader lights |
| 1.18.2 | InventoryScreen efq / Lighting dsi | Dedicated inventory entity shader lights |

The 1.15/1.16 matrix is RY(62) RX(185.5) S(1,-1,1) RY(-22.5) RX(135).
1.17+ normalizes (0.2,-1,-1) and (-0.2,-1,0); their Z is reflected into our
normal space because our model matrix includes the GUI position's Z reflection,
where native shader normals arrive before that model-view reflection.
The newer dedicated light setup is not forced into older targets.

## Validation

`node --test tools/test-chest-preview-rendering.mjs` passes on all eight targets:
actual extracted item geometry, modern double-chest seam/locks and the actual
player-preview material's lighting/full-bright flags.

With PLAYWRIGHT_MODULE pointing to Playwright, run
`node --test tools/test-graphics-backends-browser.mjs` on every affected target.
All 24 target/backend combinations pass shader compilation and pixel readback
for front, top and left normals, as well as the existing backend smoke checks.
Software GPU adapters validate correctness, not real hardware performance.

A full 1.18.2 browser inventory render with all three chest icons and the player
preview passes without a crash. Browser bundles and diff whitespace checks pass.
User screenshots, captures, server worlds, shader packs and configs are preserved.
