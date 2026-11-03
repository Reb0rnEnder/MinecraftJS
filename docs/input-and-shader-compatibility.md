# Function keys, movement fixes and shader compatibility

The Controls key-binding list groups Zoom under **MinecraftJS Extras**. Existing
saved Zoom bindings remain intact. Extras also provides **F + Number Function
Keys**, enabled by default. While playing, hold F and press 1–9 for F1–F9, 0
for F10, minus for F11 or equals for F12. Hold F + 3 + 4 for the native F3/F4
switcher where that version has one. A plain F press is delivered on release so
starting a chord does not swap hands first. Text editors and disabled shortcuts
retain normal physical keys. Blur and either release order clear virtual keys.

## Movement and pickup corrections

Native LocalPlayer push-out checks the current pose's height. The inherited
fixed two-block check could push a crawling player toward neighbouring air
columns. 1.14/1.15 retain their native vertical block scan; 1.16 onward use the
native deflated bounding-box column and suffocating collision shapes. The fix
is backported to the six existing targets with native crawling. See
[Crawling history](https://minecraft.wiki/w/Crawling#History).

BubbleColumnBlock.entityInside now invokes native column/surface impulses from
1.13 onward. Inside a column, downward acceleration is 0.03 (limit -0.3), upward
acceleration is 0.06 (limit 0.7), and fall distance resets. With air immediately
above the column, limits become -0.9 and 1.8, with upward acceleration 0.1.
These are contacts before travel's ordinary fluid drag/gravity, not a replacement
for swimming physics. The existing server-supplied drag state selects direction.

Hotbar pickup animation now follows native set-slot count increases, counts down
for five simulation ticks and is not restarted by an unrelated matching full
stack in a collection packet. The correction applies to all nine targets.

The isolated native 1.19.4 fixture accepted crawling across five blocks and both
bubble directions with zero movement corrections. Reproduce with:

```sh
node tools/port-1.19.4/run-presentation-fixture.mjs
# Separate terminal; probe refuses a different server's MOTD:
node tools/port-1.19.4/probe-movement-fixes.mjs
# Send stop in the fixture terminal afterwards.
```

## Supported shader programs

WebGL 2 runs imported final fragment/vertex programs and the existing selected
vegetation/BSL lighting hooks. Complementary Reimagined and Photon have explicit
**partial compatibility profiles**: their actual final-image programs run, with
only final-image settings exposed. Their deferred lighting, shadows, voxel
lighting, bloom history, atmosphere and native reflection pipelines are **not
implemented**. The GUI states this limitation. A working final pass is not full
Iris/OptiFine support.

Reference sources tested locally:
[Complementary Reimagined](https://github.com/ComplementaryDevelopment/ComplementaryReimagined)
and [Photon](https://github.com/sixthsurge/photon). Downloaded source ZIPs stay in
ignored cache; shader sources are not bundled or redistributed. The renderer
supplies the actual target's MC_VERSION, rather than the inherited 1.15.2 value.

The compatibility bridge handles reachable GLSL functions/overloads, continued
macros, comments, legacy fragment outputs and fullscreen vertex attributes,
ES-compatible sampling, global initializer deferral including arrays, and
explicit texture/uniform validation. Failed imports preserve the previous pack;
a failed dimension pass disables the pack and presents the unmodified scene.
Unknown buffers/extensions still produce an error instead of invented data.

## Water reflections

**Shader Water Reflections** in Extras is enabled by default and applies while
a shader pack is active on WebGL 2. The renderer captures opaque scene color and
depth once before translucent terrain. Only native water states sample it. A
bounded 32-step screen-space ray march with intersection refinement reflects visible terrain/sky, with Fresnel
weighting, edge fading and a skylight-weighted sky-color fallback. Glass and
ordinary blocks do not receive the water effect. Turning the option/pack off
restores ordinary rendering; no terrain remesh or vertex-format change is needed.

This is the MinecraftJS reflection implementation, not the imported pack's
reflection code. Objects outside the captured view cannot be reflected, and the
fallback is a sky color rather than a full sky cube. WebGPU/Software continue to
use their ordinary rendering and do not execute imported GLSL packs.

## Authoring a small compatible pack

A ZIP may contain `shaders/final.fsh` and optionally `shaders/final.vsh`, with
OptiFine-style includes, dimension overrides, options, `shaders.properties` and
language labels. A custom final shader can use:

- `colortex0`: the rendered scene; `texCoord`/`texcoord` from the default fullscreen
  vertex program, or custom varyings from its own vertex program.
- `depthtex0`: captured terrain/water depth before first-person hand depth clears.
  Under Fabulous this comes from its terrain translucency target, not every
  separate particle/weather layer.
- `gbufferProjection` / inverse, orientation-only `gbufferModelView` / inverse,
  `cameraPosition`, `near`, `far`, `viewWidth`, `viewHeight`, `view_res`,
  `view_pixel_size`, frame/time, eye light and the supported environment uniforms.
- PNG textures declared as `texture.final.NAME=textures/example.png`, sampled
  with `uniform sampler2D NAME`; `texture.noise` remains supported.
- Parsed author options such as `#define GAIN 1.0 // [0.5 1.0 1.5]` and author
  menu layouts. Options affect compilation and are saved per pack.

The original `tools/fixtures/shader-depth-texture-test.zip` demonstrates color,
world depth, a custom PNG and a configurable gain. It has a browser pixel test.
This contract supports new final-image shaders without adding a profile.
Arbitrary deferred/compute shaderpacks still require additional renderer work;
there is no GLSL parser that can supply their missing render passes automatically.

Targeted unit checks run on every applicable worktree. Browser checks compile
real Complementary/Photon finals in all dimensions, retain BSL vegetation and
lighting, check water/stone pixels and option-off restoration, and verify that
custom depth survives first-person hand clearing. Full vanilla parity and full
shaderpack emulation are separate unfinished work.

Exact tested upstream commits and cached-archive hashes are recorded in
`tools/fixtures/shader-compatibility-sources.json`. The source ZIPs remain local.
