# Default namespaces in server biome registries

Target: 1.16.5. Applies to existing 1.16.5, 1.17.1 and 1.18.2 branches only.
Earlier supported clients have no synchronized server biome codec.

The user-provided network trace showed a hub transfer receiving a new Login,
then Respawn, then 376 rejected terrain packets. The client changed its biome
registry limit from 174 to 1 and loaded zero chunks. The supplied registry dump
contained 69 biome entries under `worldgen/biome` (IDs 0 through 68). Our literal
lookup of `minecraft:worldgen/biome` ignored that valid unqualified key. It also
ignored the server's colors and effects, which can affect the older applicable
clients even though their chunk wire formats differ.

Native `ResourceLocation` defaults an absent or empty namespace to `minecraft`.
Checked against pinned native classes: 1.16.5 `vk`, 1.17.1 `ww`, 1.18.2 `yt`;
this target uses `vk`. The [Minecraft Wiki identifier documentation](https://minecraft.wiki/w/Identifier)
also specifies the default namespace. Registry keys `worldgen/biome`,
`:worldgen/biome` and `minecraft:worldgen/biome` therefore identify the same registry.
Custom namespaces remain distinct.

`registryEntries` now resolves those native aliases for both server biome effects
and, in 1.18.2, the registry limit used by the section biome palette decoder.
Every new Login still replaces the previous server registry; we do not retain
stale hub mappings, guess IDs or relax palette validation. Palette failures in
1.18.2 now include the palette kind, offending ID and registry bound.

Validation:

- `node --test tools/test-registry-codec.mjs` on all three affected targets:
  qualified/unqualified/empty namespaces, custom namespace isolation, one-entry
  registries and replacement of a previous server's biome table.
- 1.18.2 `tools/test-biome-registry-transfer.mjs` invokes the actual Login and
  Map Chunk handlers with typed NBT: 174-entry hub -> 69-entry backend, 24 sections,
  single-value and 7-bit direct biome palettes. Both load; out-of-range IDs still
  reject the packet before terrain is changed.
- Existing 758 protocol, vertical-world, door, respawn, network capture and warning
  regressions pass. Browser bundle checks pass on all three affected targets.

The browser check renders a synthetic transfer using real client handlers and
assets. The authenticated webmc.fun transfer still needs user retesting after
refreshing the updated client; no successful live transfer is claimed here.
The user capture and full registry dump are local inputs and are not committed.
