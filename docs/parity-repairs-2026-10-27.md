# Native parity repairs and shared backports

The reference for vanilla behavior is the pinned client jar and its official
mappings in `cache/port-1.15.2`, not the presence of a registry entry alone.

## Shared repairs

- Fire-overlay geometry follows native `ScreenEffectRenderer`'s two perspective
  quads, centered across the screen, including F1. A burning Creative player is
  not excluded by game mode. Native 1.15.2 itself clears Creative fire ticks;
  continuous burning in Creative is not assumed to match newer versions.
- 1.14/1.15 sky-light storage extrapolates above its highest retained data layer.
  Empty light masks above that layer no longer blacken weather or entities.
  Explicit below/above-world light data remain valid, including partial updates.
- Relative teleport bits 8/16 now modify yaw/pitch respectively. Reversed handling
  previously changed the wrong rotation on server teleports.
- Flattened slime, bed and cobweb identities reach the native movement branches.
- Team lifecycle changes remove stale memberships; server collision rules remain
  authoritative on versions which support entity pushing. Team-colored sidebars
  are retained regardless of packet order and follow subsequent team changes.
- Formatted wrapping and trimming cannot split a section-sign code. Style is
  carried from the actual break, including mid-word changes and explicit newlines.
- Direct Connect uses its native +12 button offset (Add Server uses +18), its
  title is at y=20, and odd-width server rows use integer coordinates.
- Sound-event references use native recursive weights and multiply volume/pitch.
  Namespaced audio files and namespaced sounds.json definitions are supported.
  Pending decoding cannot restart a sound after stop/reload. Browser loop handles
  support pitch changes. Registry mappings, sample references and Ogg headers are
  checked per version; all 1,816 1.15.2 samples also decode in the browser adapter.
- Shared repairs were applied to the existing 1.8.9, 1.12.2, 1.13.2 and 1.14.4
  branches where applicable; their native registries/protocols remain separate.

## Shader packs and menus

The supplied Sildur and AstraLex packs run their own final image and selected
vegetation programs through the existing WebGL 2 bridge. Tests import both ZIPs,
render all three dimensions, change options and turn the pack off. GLSL changes
include conditional preprocessing, safe global initialization, integer/float
normalization, real final vertex programs, noise textures and frame uniforms.
This remains partial shader-pack support: deferred buffers, shadows, reflection
passes, TAA, DoF and motion blur are not implemented.

The shader library stores multiple ZIPs and migrates the previous single-pack
save without deleting it. Options are stored per pack. The menu uses a left pack
list, right controls and bottom import/Done buttons. In-game list dirt overlays
are suppressed so the world remains visible; out-of-game screens are opaque.
Pack-authored categories, columns, labels and slider declarations replace the
flat option list, with unsupported empty categories omitted. Unavailable renderer
features are not presented as working OptiFine controls. Saved obsolete options
are filtered during restore without disabling the entire pack.

C is the default hold-to-zoom key, configurable in Controls. Zoom quarters the
FOV and uses filtered mouse movement, releasing/resetting on key release, menus,
loss of focus or a debug-key chord. The cinematic-camera preference is preserved.
This client enhancement is backported independently of Minecraft content versions.

## 1.15-specific work

- Crouching aliases use extracted native pose dimensions, avoiding the reported
  missing-pose crash. The generator preserves this adapter on regeneration.
- Native seeded biome zoom is checked against 100 calls to the actual Java
  implementation over five signed 64-bit seeds. Homogeneous cells avoid hashing.
- Bee grounded/flying/rolling animation follows native model parameters. Bee
  flight/angry audio loops follow speed and age, switch with anger metadata and
  stop on silence, removal or a pending decode completing after destruction.
- Honey walking/jumping/side sliding use native bounds and factors. Honey drip
  stages use native gravity, lifetimes, colors and landing sound; full-hive
  ambient drips read `honey_level`. Entity statuses 53/54 emit honey-block effects.
- Multiplayer warning, persistent opt-out and session-specific window title are
  implemented using native translations and coordinates.

These 1.15 content and biome changes are not backported to older versions.
Complete parity is still not certified. Remaining work includes visual acceptance
of every entity animation, general particle collision fidelity, all workstation
interaction paths and further server-driven outcome acceptance. See the version
feature audit; server AI/world generation are not simulated by this client.

For incomplete server text, use [the local packet capture helper](text-capture.md).
