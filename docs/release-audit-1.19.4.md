# Release-history audit and remaining gates

This is a bounded audit of the changes relevant to the current parity batch,
not a certificate that every feature in 1.19–1.19.4 works. Registry/model presence,
a decoded packet, a functional interaction and a screenshot match are separate
levels of evidence. The pinned **1.19.4** native jar is the implementation
reference for this target; older worktrees extract their own native tables.

## Historical boundaries

| Release | Historical boundary | Client evidence / remaining work |
| --- | --- | --- |
| 1.19 | Wild Update content, including sculk-related effects | Registry, block models and protocol data exist. Vibration trails and shrieker rings have targeted tests; new mobs still require animation/layer/sound review. Full release page could not be fetched because of robots restrictions; this row does not claim a complete Wiki review. |
| 1.19.1 | Allay dancing/duplication and player chat changes | Duplication is server-authoritative; client animation transitions remain in the mob audit. Signed sessions, trust verification and reporting are unfinished. |
| 1.19.2 | Secure-chat disconnect and social-screen crash fixes | These are not new blocks/assets. Unsigned chat support does not establish parity with either secure-chat fix. |
| 1.19.3 | New default skins and creative/feature-flag changes | Native UUID selection, 18 skin/model combinations, feature-filtered suggestions and four native creative catalogs are implemented and tested. No new skins or catalog rows are backported into older releases. |
| 1.19.4 | Display/interaction entities and further client changes; Update 1.20 experiments remain gated | Painting unified-spawn metadata is verified against native packets. Complete display transforms/interpolation and interaction bounds remain open. Cherry/piglin-head/other 1.20 experiment assets remain registry entries, but commands and creative visibility require server flags. |

History references: [1.19](https://minecraft.wiki/w/Java_Edition_1.19),
[1.19.1](https://minecraft.wiki/w/Java_Edition_1.19.1),
[1.19.2](https://minecraft.wiki/w/Java_Edition_1.19.2),
[1.19.3](https://minecraft.wiki/w/Java_Edition_1.19.3),
[1.19.4](https://minecraft.wiki/w/Java_Edition_1.19.4).
The latter four historical pages were available for this review. Current general
block/entity pages are not used to infer older bundle or particle behavior.

## Native implementation evidence for this batch

- `DefaultPlayerSkin`, `CommandSuggestions`, `ChatScreen`, `PauseScreen`,
  `ConfirmLinkScreen`, `ScreenEffectRenderer`: skins, command ranges/usage,
  link confirmation and first-person obstruction. The command oracle includes
  116 parses and seven selector-completion cases.
- `Painting`, `PaintingRenderer`, native painting registry: all 30 variants,
  dimensions, wall orientation, per-tile geometry and lighting. Live native
  spawn plus metadata verified a 4×4 painting.
- `BundleItem`, `ClientBundleTooltip`, `AbstractContainerMenu`: capacity,
  nested overhead, ordered typed NBT, extraction, slot restrictions, item-use
  emptying and grid layout. Live native slot snapshots verified right-click
  insertion/extraction. The server remains authoritative for spawned drops.
- `SkullBlockRenderer`, native skull model layers, `BannerRenderer`,
  `LayeredColorMaskTexture`, `NativeImage`: orientations, native dye colors,
  old/new compositing, pattern count and cloth phase. AWT integer-compositing
  rounding is preserved in the oldest targets.
- `SheetedDecalTextureGenerator`, `RenderType.crumbling`, native crumbling
  shaders: projected decal coordinates, modern lightmap exclusion and block
  entity white vertex colors. Browser pixels verify crack coverage on closed
  and open chest lids on WebGL2, WebGPU and Software across all nine versions.
- Native `canSurvive` method ownership, `Block.canSupportCenter`,
  `Block.canSupportRigidBlock`, `BlockState.isFaceSturdy` and material
  replacement: extracted predicates for support-dependent families. Overrides
  requiring more world context are recorded as `otherSurvivalClasses`, not
  silently declared supported by the generic rule.
- `VibrationSignalParticle`, `ShriekParticle`: source coordinates, destination
  tracking, packed light, delayed visibility and lifetime. Sensor vibration
  does not gain shrieker effects in versions without shriekers.

## Backport matrix

| Fix | Applicable targets |
| --- | --- |
| Painting tiled geometry/lighting, dye/banner fixes, clipboard browser checks, chest surface checks | All nine existing targets, 1.8.9 through 1.19.4 |
| Modern crumbling lightmap/color changes | 1.15.2 onward; legacy pipeline retained |
| Native support and placement-family extraction | 1.14.4 onward; no newer blocks introduced into older targets |
| Bundle behavior and tooltip | 1.17.1 onward; native sound differences preserved |
| Vibration light correction | 1.17.1 onward |
| Unified paintings, shriek delay and experimental piglin head | 1.19.4 only |

## Open gates

- Display entity transforms, interpolation and interaction bounds.
- Outgoing account/session signing, signed command arguments and authenticated reporting. Incoming certificate/message verification, native trust
  bars, signature references, deletion and partial-filter formatting are implemented;
  see chat-deletion-and-filtering-1.19.4.md for exact scope.
- Remaining new-mob animation transitions, emissive layers, held items and
  entity-specific sound/particle behavior.
- Powered dragon/piglin head animation and exhaustive native screenshots of
  eligible block-entity destruction, placed heads and banner patterns.
- Context-dependent placement overrides beyond the audited families. Server
  protection rejections cannot be predicted from local geometry alone.
- Remaining packet bodies, detailed respawn retention, border initialization,
  glint/fog changes and complete GUI/container/recipe review.

The broad inherited regression file contains stale version fixtures. Only the
named targeted tests and live/browser checks are reported passing. No native
Java FPS, physical audio playback, full shaderpack support or full 1.19.4 parity
is inferred from these tests. Distribution manifests must identify the actual
committed source heads used to build their artifacts.
