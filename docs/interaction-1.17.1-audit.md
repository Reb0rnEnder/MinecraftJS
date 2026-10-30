# 1.17.1 interaction and overlay audit

The source is the pinned official 1.17.1 client jar/mappings in
`tools/port-1.17.1/target.json`. These are implementation checks, not a claim
that the entire version has parity.

## Native behavior implemented

- `ClientPacketListener.handleResourcePack`: required packs prompt even with
  the server's preference disabled; the custom JSON prompt is displayed;
  Proceed accepts, Disconnect/escape declines and disconnects. Declining a
  required pack does not rewrite the saved resource-pack preference. A stale
  dialog cannot affect a new connection. Download failures still report the
  protocol failure status; the server owns its response to that failure.
- `SpyglassItem`, `Player.isScoping`, `AbstractClientPlayer.getFieldOfViewModifier`,
  `MouseHandler.turnPlayer`, `ItemInHandRenderer` and `Gui.renderSpyglassOverlay`:
  main/offhand use, native 1,200-tick limit and use/stop sounds; first-person
  0.1 FOV target with native FOV interpolation, one-eighth mouse sensitivity,
  hidden hands, centered square scope, black outer margins and scope opening
  interpolation. F1 hides the scope overlay; third-person does not zoom.
  Idle held spyglasses select the native `spyglass_in_hand` model.
- `SignRenderer`: dye RGB, full-bright glow text and eight-neighbor outline;
  black's outline is pale (0xf0ebcc), other colors use their 0.4-darkened dye.
  Nonblack outlines appear within 16 blocks or while scoping. Outline visibility
  updates when the camera crosses the threshold. Ordinary text samples the
  ambient lightmap. The preexisting ordinary-text lighting error is fixed on
  all supported branches; glow-specific behavior is limited to 1.17.1.
- `PowderSnowBlock`, `LivingEntity.removeFrost/addFrost`, `Gui.HeartType` and
  `FogRenderer`: leather-boot standing, sneak-through, long-fall 0.9 collision,
  falling-block collision, movement multiplier/fall reset and boot climbing.
  Server frozen-tick metadata drives the frost outline, frozen hearts and
  -0.05 maximum speed modifier (native UUID replaces rather than doubles the
  packet modifier). Immersed-camera fog uses native color and two-block range;
  spectators use the native half-render-distance range. The server controls
  freezing progression, leather-armor immunity and damage.
- Crimson/warped standing/wall signs were omitted from sign registration;
  this correction is backported to their introduction in 1.16.5. Resource-pack
  HTTP identification now follows the actual target in 1.16.5 and 1.17.1.
  Earlier versions already advertised their correct version.

Native 1.15.2/1.16.5 SignRenderer pass packed world light to font drawing.
The fixed-function 1.8.9/1.12.2 sign renderers retain dispatcher lightmap
coordinates for font drawing; the ambient-text material correction preserves
this behavior and adds no glow feature to older targets.

Wiki cross-checks:
[1.17 additions](https://minecraft.wiki/w/Java_Edition_1.17),
[1.17.1 changes](https://minecraft.wiki/w/Java_Edition_1.17.1),
[powder snow](https://minecraft.wiki/w/Powder_snow),
[signs](https://minecraft.wiki/w/Oak_sign).
The Wiki's indexed content was available; direct page fetching was blocked.
The pinned native code resolves version-specific details.

## Evidence and remaining checks

`tools/test-1.17-use-features.mjs`, `tools/test-powder-snow.mjs` and
`tools/test-sign-lighting.mjs` exercise prompt choices/cancellation, use/release,
slot changes, scope geometry, dye/outline rules, contextual collision, movement
and freezing modifiers. The sign test runs on all seven supported branches.
Protocol/runtime fixtures still pass.

`tools/probe-1.17-use-features-browser.mjs` uses an isolated WebGL 2 scene. It
checks scope rendering, the held model, hidden hands, ordinary/glowing/Nether
sign construction and material values, frozen-tick handling, frost overlay,
frozen heart texture coordinates and powder-snow fog. It does not modify a
server. This does not replace live-server interaction or all-adapter checks.

Third-person spyglass attachment and powder-snow particles are covered by the
follow-up in `caves-content-parity.md`. Pending: complete live
equipment/freezing/vehicle sequences;
formatted glowing-text corner cases and GPU visual comparisons. The remaining
version-wide gaps are tracked in `parity-1.17.1.md` and `parity-1.16.5.md`.
1.18.2 remains gated on those ledgers, as requested.
