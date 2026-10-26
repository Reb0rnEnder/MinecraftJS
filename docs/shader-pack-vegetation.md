# Shader packs: image effects and vegetation

Video Settings → Shader Packs… imports a local ZIP and remembers its enabled
state. WebGL 2 is required. This supports final image effects and BSL-style
vegetation animation, not full OptiFine/BSL rendering.

The new GLSL helper only selects a named function and the functions/constants it
uses. It understands balanced tokens/comments and bridges simple desktop GLSL
float literals. It does not interpret GLSL in JavaScript: the GPU compiles and
runs the actual selected pack functions. Existing pack settings and versioned
block.properties selectors determine which plants animate. Unsupported
requirements leave final effects usable and report animation as unavailable.

The supplied BSL v10.1.8 runs its actual WavingBlocks/CalcMove/noise/bending code.
Grass tips move and roots remain anchored; the pack also controls compatible
plants, crops, leaves and vines. World/camera coordinates and time are provided
for coherent movement. The relativeEyePosition offset follows the Iris camera
uniform convention (cameraPosition minus the player's eye position):
[Iris uniform reference](https://github.com/IrisShaders/ShaderDoc/blob/master/iris-features.md)

The terrain format stays 20 bytes per vertex. Previously unused position.w
stores the native block-state ID and a top-UV bit. A small GPU lookup maps state
IDs to the pack's categories; no pack-specific CPU motion or per-frame remeshing
is used. Loading/toggling a pack does not require rebuilding terrain. Software
and WebGPU retain their ordinary static rendering; the extension is optional.
Two optional device methods create/select an alternate terrain program built from the
existing program, with the same formats, lighting and draw path.

The feature is backported to 1.13.2, 1.12.2 and 1.8.9 with each version's native
block mapping and MC_VERSION value. No newer vanilla content is backported.

Full BSL world lighting, shadow maps, reflections, bloom/composite history and
TAA remain unimplemented. Water/lava/fire/lantern vertex programs are outside
the vegetation hook. Existing final-pass support and saved pack selections are
preserved. The user's pack is loaded locally; its shader source is not bundled
or redistributed.

Tests check function selection, numeric conversion, property branches, actual
version-specific block states, unchanged packed geometry, stationary roots and
stone, time-varying tips, Off restoring static terrain and zero GL errors. BSL's
final programs also compile/render in all three dimensions. Optional GPU tests
use PLAYWRIGHT_MODULE and BSL_SHADER_PACK; an original ZIP fixture exercises the
baseline without requiring externally supplied shader-pack files.
