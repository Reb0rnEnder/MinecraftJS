# Held plant faces and creative compass stability

Target: 1.15.2.

Baked block item models now use a back-face-culling material without changing
the shared material used by generated sprites. Big dripleaf has opposing faces
on identical planes, with different UVs; rendering both sides at once caused
fighting on held geometry. Preserve both native quads, their UVs and positions;
select the visible side by winding, rather than moving a face or adding an offset.
This shared block-item rendering correction applies to every supported target,
but big dripleaf itself remains exclusive to 1.17.1 and later.

Native 1.18.2 reference: ItemBlockRenderTypes `eqn.a(BlockState,boolean)` routes
non-translucent block items to Sheets.cutoutBlockSheet (`ere.h`, field D), created
with RenderType.entityCutout (`era.c`), whose default culling is enabled. Models
with opposing faces also exist in older targets. Generated sprites, custom
entity items, the placed-block mesher and shared material state are unchanged.

1.16.5 through 1.18.2 additionally fix the random compass branch. Creative tab
icons recreate item stacks every render. Assigning each JS stack a random salt
changed the phase on every frame instead of following the shared tick wobble.
Creative tab icons now cache their stack per icon definition, as native
CreativeModeTab.getIconItem does. Native 1.16.5 ItemProperties (`ejm` anonymous
class 2) uses a stable stack identity phase; this behavior is retained.
Native 1.17/1.18 ItemProperties compass getter (`fai` anonymous class 2) offsets its
random wobble by a signed integer hash of the rendering seed (multiplier
1327217883), not stack object identity. GUI defaults use seed zero.

The random target now updates only once per world tick. A stable rendering
seed supplies the phase offset on 1.17+, while 1.16 keeps the stack identity phase. Nether compasses still spin, as intended; valid
Overworld and same-dimension lodestone targets remain directional. Earlier
supported versions use their existing tick-driven compass path and do not need
this identity-salt correction. No lodestone feature is added to older releases.

Validation: `tools/test-block-item-faces.mjs` passes on all eight targets and
`tools/test-compass-wobble.mjs` on the three applicable targets. The latter covers
stable tab-icon identity, smooth tick changes, native version-specific phase offsets
and valid directional targets. Existing chest/player-preview regressions pass.
`tools/test-graphics-backends-browser.mjs` renders two opposite coplanar quads with
different texels using the actual block-item material path: only the front color
is visible. This pixel regression passes on WebGL 2, WebGPU and Software for all
eight versions. It validates rendering correctness, not hardware FPS.
