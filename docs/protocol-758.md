# Protocol 758 source audit

Pinned 756/758 schemas and the 1.18.2 client jar agree on the changed packet
bodies: combined terrain/light, join simulation distance, registry-varint block
entity types, varint effect IDs, updated particle IDs and the outgoing server-list
visibility boolean. The multi-block-change schema renames its boolean; the wire
layout is unchanged. All other reused bodies are compared in `baseline.json`.
The new simulation-distance packet has its own ID. Recipe, inventory state/cursor,
respawn and entity metadata body layouts remain compatible; metadata particle
payloads use the new target registry. No 1.19 interaction sequence is added.

Exact native classes checked through official mappings:
`ClientboundLoginPacket`, `ClientboundLevelChunkWithLightPacket`,
`ClientboundLevelChunkPacketData`, `LevelChunkSection`, `PalettedContainer`,
its block/biome strategies and `PalettedContainer.Data.getSerializedSize`.
The last method sizes the entry-count VarInt while serialization writes the
long-array-count VarInt, explaining native zero padding after chunk bytes.
Malformed nonzero or excessive trailing bytes still fail.

Native reports come from the bundled server's `net.minecraft.data.Main`.
Runtime reflection uses the matching client and the launcher's pinned dependency
jars; the outer 1.18 server jar itself is not a dependency classpath.

Fixtures, live TCP and disposable browser/server acceptance are described in
`parity-1.18.2.md`. A live idle join alone cannot prove every rare packet path.
