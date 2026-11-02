# Native biome color worker fix

The main thread applied server biome registries, but meshing workers retained
only the builtin numeric biome table. Custom/reordered server IDs therefore
produced different colors in terrain and camera/weather effects. Login/registry
replacement and disconnect now broadcast the same registry to every worker,
and explicit native grass/foliage color overrides are honored.

Applicable existing targets: 1.16.5, 1.17.1, 1.18.2 and 1.19.4. Earlier supported
protocols do not receive the dynamic dimension/biome codec, so the registry
broadcast is not added there. Their builtin color behavior is preserved.

1.19.4 additionally needs native climate extraction: its new imported biome
table omits rainfall. Reflect the pinned jar's Biome climate settings and write
temperature, downfall/rainfall and precipitation into generated runtime data.
Do not substitute a guessed rainfall default; that hides broken extraction.

Verification: `node --test tools/test-biome-worker-colors.mjs` on every affected
target checks finite native climates, nonblack tint output, a custom server ID
with exact grass/foliage overrides, and registry reset via the worker handler.

Reference: exact-version native Biome/GrassColor/BiomeSpecialEffects and client
registry handling, with the historical [1.16](https://minecraft.wiki/w/Java_Edition_1.16)
and [1.19.4](https://minecraft.wiki/w/Java_Edition_1.19.4) release boundaries.
