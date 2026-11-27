# 26.3 resource packs and fonts

Updated 2026-11-27. This is a disposition ledger for the inherited 1.20.6 font/pack findings,
not a claim of live visual acceptance. Native input: 26.3 client SHA-1
`e877b6a07acd633fb3bb475002175cec036e7b87`.

## 26.3-specific finding fixed in this batch

| Finding | Disposition | Evidence |
| --- | --- | --- |
| 1.20.6 used pack format 32 for the resource-pack compatibility screen, so every native 26.3 pack (major 97, minor 1) was classified as "new" and every 1.20.6 pack as compatible. | **Fixed.** The 26.3 protocol now selects `PackFormat(97,1)`; 1.20.6 keeps 32. `min_format`/`max_format` compact lists (`[major]`, `[major,minor]`) and legacy integer `pack_format`/`supported_formats` are parsed. Comparison follows native `PackFormat.compareTo` (major, then minor). | `client/js/resource-pack-compatibility.js`, `client/js/gui/screens/packs.js`, `client/js/assets.js`; `tools/test-resource-pack-format-26.3.mjs` (3 tests: 97.0 is old, [97,1] compatible, 98 new, legacy ranges, 1.20.6 threshold). |

## Inherited font findings

| Finding | 26.3 disposition | Evidence / remaining work |
| --- | --- | --- |
| Recursive, layered and namespaced `reference` providers | **Implemented and carried.** 26.3 `default.json` uses three references (`include/space`, `include/default` with `uniform:false`, `include/unifont`); `loadFontSets` resolves them recursively with cycle rejection. | `client/js/gui/font-providers.js`; 1.20.6 provider regressions remain green. |
| `uniform` and `jp` provider filters | **Implemented and carried.** Filters merge across references; conflicts suppress the provider. 26.3 `default.json` depends on the `uniform:false` filter. | `loadFontSets` `filters()`; `FontSet.glyph`. |
| Unihex ZIP, `size_overrides`, lazy glyph atlases | **Implemented and carried.** 26.3 ships `unifont.zip`, `unifont_jp.zip` and `unifont_pua.zip`; the installed 26.3 `include/unifont.json` is the asset-index override (not the empty jar placeholder) and names `unifont_jp.zip` with range overrides. | `client/js/gui/font-unihex.js`; `client/assets/minecraft/font/include/unifont.json` hash differs from the jar by design (index override). |
| Bitmap provider metrics, scale, ascent and missing-glyph box | **Implemented and carried.** Bitmap rows/cells, integer advance and the 5x8 box fallback match the inherited native oracle. | `bitmapProvider`, `FontSet.glyph`. |
| TTF providers (`size`, `oversample`, `shift`, `skip`) | **Implemented and carried.** Isolated stb_truetype WASM; no system/Canvas substitution. | `trueTypeProvider`. |
| Negative/zero advances and bold/shadow offsets | **Implemented and carried.** Advances participate in measurement; Unihex uses half-pixel offsets. | Font provider tests. |
| Force Unicode and Japanese glyph variant options | **Implemented and carried.** Native two-row Font Settings, refresh of chat/labels/signs, browser-locale Japanese default. | `docs/font-audit-1.20.6.md`; option rows in the 26.3 UI. |
| Complex-script shaping, bidi beyond native ordering and CFF/OpenType acceptance | **Out of scope for this target.** Native uses its own bidi reordering and stb_truetype; CFF outlines are not supported by that rasterizer. Not claimed as accepted. | Inherited `FONT-04`; recorded as `blocked-visual` in `docs/transition-26.3.inherited-findings.md`. |
| Live font-pack/backend and physical screenshots | **Blocked on human review.** Provider pixels are tested, but no 26.3 physical backend capture or human comparison exists. | P15 / FONT-04. |

## Inherited resource-pack findings

| Finding | 26.3 disposition | Evidence / remaining work |
| --- | --- | --- |
| Pack selection, priority, overlays and resource filters | **Implemented and carried.** `OverlayZip`, `resourceFilter`, layered `readResourceStack`; 26.3 pack metadata is read by the same path. | `client/js/resource-layers.js`, `client/js/assets.js`. |
| `supported_formats` ranges and incompatible colours/text/prompts | **Implemented and carried** for integers; **extended** for 26.3 `min_format`/`max_format` and major.minor comparison. | `resource-pack-compatibility.js`; 26.3 test above. |
| Pack import, default pack icon and first-frame readiness | **Implemented.** File-picker import and the synchronous default `pack.png` path remain. | `ResourcePacksScreen._add`, `_defaultIcon`. |
| Moving Default within the resource stack, native drag/drop confirmation and full focus transitions | **Carried open.** Not every 1.20.6 pack-selection interaction is closed on 26.3. | PACK-03 / PACK-04; recorded in the inherited register. |
| Native atlas source JSON and paletted permutations | **Implemented.** `palettedPermutationSprites` is applied while loading 26.3 assets. | `client/js/assets.js`, `client/js/render/paletted-permutations.js`. |
| Live multi-pack reload and Configuration/Play pack lifecycle | **Blocked on a live scenario.** Needs a server/pack run and human observation. | PACK-04 / P15. |
| Authenticated WebMC resource-pack rendering | **Blocked on account.** No signed-in session is available; no offline substitute is used. | P09. |
| Malformed pack/font graphs | **Fail closed.** Bad `pack.mcmeta`, filters, overlays and provider definitions log and skip instead of crashing; exhaustive malformed-graph fuzzing is not claimed. | `assets.js`, `font-providers.js` warnings. |

## Native 26.3 font/pack inputs checked

- `default.json`, `alt.json`, `uniform.json`, `illageralt.json`, `include/default.json` and
  `include/space.json` are byte-identical to the pinned 26.3 jar.
- `include/unifont.json` is the installed asset-index override that references the 26.3
  `unifont_jp.zip` and its `size_overrides`; the jar's own copy is intentionally empty.
- The 26.3 jar's font/provider types are `reference`, `space`, `bitmap`, `unihex` and `ttf`,
  all handled by `client/js/gui/font-providers.js`.

## Honest limits

This ledger does not certify the resource-pack screen or font rendering visually on 26.3. It
records code-level parity, the new native pack-format comparison and every inherited finding's
disposition. Human visual acceptance and authenticated pack delivery remain open.
