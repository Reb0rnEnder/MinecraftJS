# Native foliage corrections — 1.12.2

Reviewed 2026-11-14 against native client SHA-1 `0f275bc1547d01fa5f56ba34bdc87d981ee12daf`. Native classes: `anh / aof; bcq`.

Coordinate-dependent swamp grass, retaining native height-dependent colors and block IDs.

Climate inputs retain native float precision when selecting colormap pixels.

The native noise wrapper was executed at 192 coordinate pairs; every value and swamp color agrees with the shared worker-safe implementation. The regression fixture records this target's jar identity. Run `node --test tools/test-foliage-regressions.mjs tools/test-terrain-particle-colours.mjs` (9 passed).

No newer block IDs, assets, Creative components or protocol fields were backported. Native 1.8.9–1.14.4 retain their height-dependent biome colors. The `short_grass` rename belongs to 1.20.3+, as recorded in the [release notes](https://www.minecraft.net/en-us/article/minecraft-java-edition-1-20-3).

This is a scoped correctness fix; full version parity and published distribution regeneration are not claimed.
