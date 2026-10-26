# Recent fix/backport audit — 2026-10-26

Reviewed the recent 1.14.4 implementation/fix commits and the older branches,
using their native protocol/asset behavior. This certifies the dispositions
below, not complete vanilla feature parity or every historical commit.

Three missed adaptations were found and completed: fresh-login player-state
reset on all older targets; native full-hunger food exceptions in 1.13.2; and
1.13.2 recipe resource names, item-tag ingredients and recipe asset extraction.
The 1.13.2 jar contains 524 recipes under data/minecraft/recipes; the old bundle
read the removed assets/minecraft/recipes directory and was empty. Source
serving, extracted assets and HTML now include the correct native recipe tree.

| Fix/feature | 1.13.2 | 1.12.2 | 1.8.9 |
| --- | --- | --- | --- |
| Clear previous-server metadata/max health on Join Game | Backported now | Backported now | Backported now |
| Absorption HUD metadata | Native index 11, fixed | Native index 11, fixed | Native index 17 retained |
| Respawn game-mode field | Native decoder/handler already agree | Native decoder/handler already agree | Native decoder/handler already agree |
| Crouch/swim camera easing | Native half-step easing backported | Native direct eye height retained | Native direct eye height retained |
| Sharpness prediction | Post-1.9 formula/name lookup fixed | Post-1.9 formula fixed | Native 1.25-per-level formula retained |
| Food at full hunger | Chorus allowed, golden carrot rejected, corrected now | Native apple/chorus exceptions already correct | Native golden apple exception; no chorus fruit |
| Recipe identifiers/tags/assets | Resource IDs/tag expansion and all 524 native recipes restored now | Native numeric recipe IDs and assets retained | No native recipe book to port |
| Held bow/map identity | Native names and NBT map ID fixed | Native numeric identity retained | Native numeric identity retained |
| Book save/hand and technical editor packets | Dedicated native packets fixed | Native plugin messages retained | Native plugin messages retained where present |
| Anvil/beacon actions | Dedicated native packets fixed | Native plugin messages retained | Native plugin messages retained |
| Note-block events | Native block-state note/instrument fixed | Native event-byte behavior retained | Native event-byte behavior retained |
| Shader final image effects and vegetation | Backported now with 11302 settings | Backported now with 11202 settings/legacy states | Backported now with 10809 settings/legacy states |
| Transport, chat, NBT copying, mesh invalidation, hand skin reset, invisible equipment | Existing shared regression checks pass | Existing shared regression checks pass | Existing shared regression checks pass |

1.14-only content, native metadata layouts, crossbows, crawling, sign dye colors,
new wood signs, particle JSON resources, Accessibility UI, F3+Escape and target
1.14.4 camera-offset behavior are not injected into older versions. Search tab
extraction was only broken in the new 1.14 extractor; older native catalogs were
already populated. Protocol 404 decoding/registration stays native on 1.13.2;
its removal was specific to the active 1.14.4 codec.

Validation: 153 checks pass on 1.14.4; 242 on 1.13.2; 77 on 1.12.2; 74 on 1.8.9.
Each skips one optional external-endpoint check. Tests include native HUD
rendering, fresh-login resets, version-specific shader macros/block mappings,
packed geometry, parser cases, real GPU final-pass output and vegetation controls
using both an original fixture and the locally supplied BSL archive. The BSL
archive remains local and is not redistributed. Six existing shared audit probes
also pass across all older refs. Live arbitrary-server gameplay and full BSL
lighting are not certified by these checks.


Follow-up: nearby entity/player pushing now applies to 1.14.4/1.13.2/1.12.2,
with native team rules. 1.8.9 keeps native pre-1.9 behaviour. Lead strings, native
sitting cat/tame-ocelot pivots, saved shader options and basic terrain lighting
are fixed/added across all four versions. Native packed-state helpers are
retained on 1.12.2/1.8.9. Current totals are 167/256/91/83 passing checks,
respectively, plus the live collision and shader-settings reload checks.
See [details and limits](pushing-leads-and-shader-settings.md).
