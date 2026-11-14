# Foliage acceptance — 1.20.6

Reviewed 2026-11-14 against pinned native client SHA-1 `05b6f1c6b46a29d6ea82b4e0d42190e42402030f`.

Short grass was missed by old `grass` dispatch, and the generic leaf suffix applied green to already-colored cherry and azalea textures. Native `BlockColors`/`ItemColors` registrations now determine these paths: pink petals tint only nonzero stem indices; mangrove leaf items use `0x92c648`; potted fern and upper tall-plant sampling follow native behavior.

The upstream biome table omitted rainfall and effects. Native known-pack climate/effects now populate every fallback biome, including cherry grove's grass/foliage overrides. Grass and foliage use base temperature, with native explicit color modifiers and coordinate-dependent swamp noise. Server registry IDs/effects remain authoritative. Climate inputs retain native float precision when selecting colormap pixels. Weather temperature remains separate.

## Evidence

- `tools/port-1.20.6/foliage-fixtures.mjs --check` runs the native registered color providers and biome network codec with a synthetic colormap. It records 22 block/item cases, all 64 biomes at four horizontal coordinates, and 192 swamp-noise positions.
- `tools/test-1.20.6-foliage.mjs` compares the real mesher/item-color/biome consumers against those native results, including multiple heights, resource colormaps, upper halves and custom server IDs/modifiers.
- Complete target gate: 162 passed, zero skipped. Browser smoke joined the isolated native server, opened Creative search with 19 cherry results and captured pink leaves. No console/page errors. Captures are ignored under `cache/port-1.20.6/foliage-audit/`.
- Wiki [Short Grass history](https://minecraft.wiki/w/Short_Grass#History), [Cherry Leaves history](https://minecraft.wiki/w/Cherry_Leaves#History), and [official 1.20.3 notes](https://www.minecraft.net/en-us/article/minecraft-java-edition-1-20-3) were reviewed. The rename is 1.20.3+; cherry was experimental in 1.19.4. Direct Wiki tool opening failed; curl copies were read instead. Exact native code governs the target.

## Backports

Every native target's noise wrapper was executed at the same 192 coordinate pairs: zero numeric/color differences. `ExtractLegacyBiomeNoise.java` supports the older Random constructor and newer RandomSource wrappers. Mapped/decompiled native biome methods establish the native height-color boundary at 1.15. Native color registration lists establish leaf/plant differences. The nine targets each pass nine relevant regressions (81 total, zero skipped).

| Target | Native client SHA-1 | Native classes | Applied scope |
| --- | --- | --- | --- |
| 1.8.9 | 3870888a6c3d349d3771a3e9d16c9bf5e076b908 | ady / aet; ard | Coordinate-dependent swamp grass, retaining native height-dependent colors and block IDs. |
| 1.12.2 | 0f275bc1547d01fa5f56ba34bdc87d981ee12daf | anh / aof; bcq | Coordinate-dependent swamp grass, retaining native height-dependent colors and block IDs. |
| 1.13.2 | 30bfe37a8db404db11c7edf02cb5165817afb4d9 | ayu / bbl / bbm; cgf; byk | Coordinate-dependent swamp grass, retaining native height-dependent colors and block IDs. Potted-fern tint and lower-half sampling for tall grass/ferns. |
| 1.14.4 | 8c325a0c5bd674dd747d6ebaa4c791fd363ad8a9 | bio / blf / blg; cyp; ckp | Coordinate-dependent swamp grass, retaining native height-dependent colors and block IDs. Potted-fern tint and lower-half sampling for tall grass/ferns. |
| 1.15.2 | e3f78cd16f9eb9a52307ed96ebec64241cc5b32d | bkt / bnp / bnq; dcb; cno | Coordinate-dependent swamp grass, retaining native block IDs. Potted-fern tint and lower-half sampling for tall grass/ferns. Base biome temperature determines foliage tint, as in native 1.15+. |
| 1.16.5 | 37fd3c903861eeff3bc24b71eed48f828b5269c8 | bsv; dko; cuc | Coordinate-dependent swamp grass, retaining native block IDs. Potted-fern tint and lower-half sampling for tall grass/ferns. Base biome temperature determines foliage tint, as in native 1.15+. Server grass modifiers apply independently of biome names and also to explicit overrides. |
| 1.17.1 | 8d9b65467c7913fcf6f5b2e729d44a1e00fde150 | bxp; dwf / dwj; ddy | Coordinate-dependent swamp grass, retaining native block IDs. Potted-fern tint and lower-half sampling for tall grass/ferns. Base biome temperature determines foliage tint, as in native 1.15+. Server grass modifiers apply independently of biome names and also to explicit overrides. Azalea leaves remain untinted in world/item rendering. |
| 1.18.2 | 2e9a3e3107cca00d6bc9c97bf7d149cae163ef21 | cbr; dzj / dzn; die | Coordinate-dependent swamp grass, retaining native block IDs. Potted-fern tint and lower-half sampling for tall grass/ferns. Base biome temperature determines foliage tint, as in native 1.15+. Server grass modifiers apply independently of biome names and also to explicit overrides. Azalea leaves remain untinted in world/item rendering. |
| 1.19.4 | 958928a560c9167687bea0cefeb7375da1e552a8 | cnf; eni / enm; dvq | Coordinate-dependent swamp grass, retaining native block IDs. Potted-fern tint and lower-half sampling for tall grass/ferns. Base biome temperature determines foliage tint, as in native 1.15+. Server grass modifiers apply independently of biome names and also to explicit overrides. Azalea leaves remain untinted in world/item rendering. Experimental cherry leaves remain untinted; only pink-petal stems are tinted; mangrove items use their fixed native color. Experimental feature availability is unchanged. |

Distributions were not rebuilt by this source batch. Full parity remains open in the transition ledger, including font providers, item-component consumers and remaining GUI/content acceptance.
