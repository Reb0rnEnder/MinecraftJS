# Camera transitions and experimental shader packs

The 1.14.4 jar's Camera.tick eases its eye-height field halfway toward the
entity's eye height every tick, retaining the previous value for frame
interpolation. Render camera positioning now uses that process, while gameplay
rays, eye-fluid checks and collision continue to use the actual pose immediately.
This applies to crouching, swimming and crawling, including transitions back to
standing. The same easing exists in the 1.13.2 EntityRenderer and is backported in `fb10637`.
The inspected 1.12.2 renderer uses the eye height directly; newer camera behavior
is not introduced there or in 1.8.9. New-world camera state resets independently.

## Shader packs: current scope

Video Settings → Shader Packs… imports a local ZIP, enables/disables it and
removes it. WebGL 2 is required. The imported bytes and selection persist across
reloads. Compilation happens before replacing a working pack, and an unavailable
backend or a failed dimension variant does not take down the game loop.

The original implementation below covered final-stage compatibility only.
[Vegetation support and the backport audit](shader-pack-vegetation.md) now add
BSL waving functions on all four targets; full OptiFine/BSL support remains open.
It executes the pack's actual final fragment program against the completed
MinecraftJS scene, before the GUI. The source loader expands root/relative
includes, selects world0/world-1/world1 variants and adapts basic GLSL 120 syntax
and integer texture LOD calls to GLSL ES 300. Known scalar frame uniforms and
scene-color sampler aliases are bound. Unsupported active buffer/uniform
requirements are rejected rather than populated with misleading fake data.
The standard scene pipelines and vertex formats are retained.

The supplied BSL v10.1.8 final shader compiles and renders in all three dimensions;
this includes its final sharpening/image effects. The follow-up also runs its vegetation functions. **BSL's lighting, shadows,
reflections, volumetrics, bloom/composite history, TAA and material pipeline do
not run.** That needs a substantially larger gbuffer/depth/shadow/composite
integration. Current final-pass support does not establish arbitrary pack
compatibility. The user's BSL archive remains local and is not redistributed.

## Validation

- Camera tests verify float half-step easing, frame interpolation, pose return,
  reset and separation from immediate gameplay eye positioning.
- Loader tests cover includes, path containment, cycles and retaining a working
  pack after a compilation failure.
- Browser/GPU tests read back known pixels and check zero GL errors for an
  original test fixture and the locally supplied BSL final programs in all three
  dimensions. A separate browser UI check imported BSL, disabled it, reloaded
  and verified restored ZIP bytes/name/disabled state with no JavaScript errors.
- Expanded regression suites pass 143 checks on 1.14.4 and 227 on 1.13.2,
  each with one optional external endpoint skipped. Two additional GPU tests pass.

Run the optional GPU checks with PLAYWRIGHT_MODULE pointing to Playwright's
index.mjs. BSL_SHADER_PACK can point to a local pack ZIP; the BSL-specific test is
skipped when no archive is supplied. The original small fixture remains in the
repository so baseline final-stage compilation does not depend on BSL assets.
