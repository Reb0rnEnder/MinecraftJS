# Player pushing, leads, cat poses and shader options — 2026-10-26

The local player now receives native nearby-player/living-entity collision
impulses. The client previously omitted this step and discarded scoreboard team
collision rules. Impulses now respect these rules, spectators, sleeping, riding,
ladders and coincident centres. Remote positions remain server-authoritative.
This applies to 1.14.4, 1.13.2 and 1.12.2. Player collision rules are a 1.9+
feature; 1.8.9 keeps its native older behaviour.

Attach-entity packets already stored leash holders, but the renderer drew only
the fence knot. It now draws vanilla's two crossed brown strips, with 24 sagging
segments, alternating colours, interpolated endpoints, native offsets and fog.
Visibility uses the rope bounds independently of its mob. Detach/removal removes
the mesh on the next render. Local-player and fence-knot holders both work.

Sitting cats previously rotated only their torso. The native body/head/leg/tail
pivot changes are now applied, and every frame restores standing pivots before
posing. The 1.14 cat uses the native 16.1 front-leg height; older tame ocelots use
15.8. The fix also applies when standing up after sitting. Native constructors
and poses were checked against the pinned client jars.

Video Settings → Shader Packs → Shader pack settings exposes supported pack
options: toggles, numeric choices/sliders, descriptions supplied by the pack,
pages, Reset, Cancel and Apply. Options persist with the ZIP and reload at
startup. Option tokens are validated; compilation completes before replacing a
working pack. Internal dimension/stage macros and unsupported BSL features such
as shadows, reflections, TAA and non-vegetation waves are not exposed.
The format includes #define toggles, commented toggles, //[values] choices and
const int/float choices. This is a subset of OptiFine's configuration format;
pack-defined screen hierarchies, profiles and arbitrary shader pipelines are not
implemented. Other packs can expose options referenced by their supported final
program; this does not establish compatibility with all shader packs.

The basic BSL lighting bridge uses the imported pack's light/ambient colours
and intensities, day/night transitions, rain desaturation, minimum cave light,
block-light attenuation and Nether/End colours. It replaces the terrain fragment
lightmap calculation only while enabled. Existing packed terrain, baked face
shade/AO and vegetation animation are retained. It is an approximation using
BSL authoring values and lightmap falloff, not BSL's complete GetLighting program.
Entities retain native lighting. There are no shadow maps, PBR, reflections,
deferred buffers, bloom, TAA or exposure/tone-mapping integration. GPU vertex
animation continues to run the selected pack GLSL. The user ZIP stays local.

All shared render and shader changes are backported to 1.13.2, 1.12.2 and 1.8.9
with native block-state accessors and version macros. No new vanilla content is
added to older versions.

Validation: 167 tests pass on 1.14.4, 256 on 1.13.2, 91 on 1.12.2 and 83 on
1.8.9; each skips one optional external endpoint check. Tests cover pushing and
actual local movement, team rules, leash geometry/lifecycle, pose transitions,
option parsing/validation/UI controls, actual GPU lighting pixel changes,
shader Off restoring native terrain, and existing gameplay regressions.
A live two-browser-client test against the isolated vanilla 1.14.4 server moved
an overlapping player from x=0.5 to x=0.997485 without input or browser errors.
The real UI imported the supplied BSL ZIP, changed WAVING_GRASS, applied and
persisted it, then reloaded with both terrain stages compiled and no browser
errors. This is scoped validation, not a claim of complete game/shader parity.

Follow-up: [world entity lighting, corrected sky/block coordinates and fence
knot alignment](entity-lighting-and-fence-knots.md) supersedes the terrain-only
lighting limitation above and records the shadow implementation scope.
