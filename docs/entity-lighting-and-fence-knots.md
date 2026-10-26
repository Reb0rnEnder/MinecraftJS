# Entity shader lighting and fence-knot follow-up

The previous basic BSL bridge covered terrain only. World entities (mobs,
players, equipment and lit world meshes) now use the same pack light colours and
falloff. GUI entity draws retain native GUI lighting, full-bright materials stay
full-bright, and disabling/removing the pack restores the original programs.
The client light coordinates are (sky, block); the earlier bridge treated them
as (block, sky), which also broke terrain exposure. This is corrected everywhere.
The optional adapter compiles/replaces/destroys the terrain/entity/lit programs
together; no vertex formats or non-WebGL backends change.

The fence lead knot had an extra +0.5 Y translation. The native 1.14.4
LeashKnotRenderer translates directly to the entity position, then scales by
(-1,-1,1), rendering its model at 1/16. Removing the extra translation aligns the
knot with its fence. Rope endpoint and sag calculations retain native offsets.

Both fixes apply to 1.14.4, 1.13.2, 1.12.2 and 1.8.9. GPU pixel checks cover
world entities, GUI preservation, full-bright preservation, independent sky/block
inputs, changed brightness after settings, and native restoration with shaders
Off. Existing vegetation/final-pass/gameplay suites are retained.

## Shader shadow scope

Directional shadow support is feasible through an optional WebGL2 depth-map
pass. It cannot be promised artifact-free and is not enabled by these fixes.
A first implementation should use one bounded directional map, stable/snapped
light projection, slope/depth bias and alpha testing, including the same animated
vegetation positions in both passes. Shadow sampling must attenuate only direct
sun/moon light, preserving ambient/block light and emissive materials. Renderer
visibility must include off-screen shadow casters. Test cutout leaves, moving
mobs, camera movement, sunrise/sunset, chunk edges, shader Off and unsupported
backends; expose limited quality/resolution settings and measure GPU cost.
BSL's actual shadow programs, distorted coordinates and coloured translucent
shadows need a separate compatibility milestone. A native client shadow map
alone must not be labelled full BSL shadow support.

References: [Iris shadow guide](https://shaders.properties/current/guides/your-first-shaderpack/4_shadows/),
[shadow map resolution](https://shaders.properties/current/reference/constants/shadowmapresolution/),
and the local pinned vanilla client jar / official mappings.
