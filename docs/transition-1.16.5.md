# Transition to Java 1.16.5

This branch starts from 1.15.2. The first deliverable is a native protocol-754
connection baseline; full 1.16 gameplay/rendering parity is a later milestone.
Older supported branches keep their current protocol and content versions.

1. Pin official 1.16.5 metadata, jars, mappings and asset index, plus the upstream
   protocol/registry schemas. Generate packet IDs and compare changed layouts.
   Report the client as 1.16.5 in status checks, handshake, menus and crash reports.
2. Implement login/play framing and the changed join/respawn dimension registry,
   chunks/palettes/biomes/light, block updates, entity equipment/metadata, chat,
   inventory, tags, recipes and outgoing packet layouts needed to join and stay
   connected. Load matching native IDs/assets rather than interpreting new IDs
   through older registries. Unknown new features must remain safely unsupported.
3. Verify against the already-running local 1.16.5 server: status, login,
   compression, keepalive, teleport confirmation, chunks, local movement and
   inventory. Do not change its world, configuration, or running processes.
   Run protocol/fixture checks and a real browser join, then build a separately
   named 1.16.5 development client and static folder and push the branch.
4. Add Nether Update content incrementally: new dimensions/biomes, blocks/items,
   entities, equipment, mechanics, sounds/particles, menus and visual differences.
   Audit 1.16 through 1.16.5, recording verified features and remaining gaps.
5. Backport only fixes applicable to the older target versions; keep features
   introduced in 1.16 on this branch. Full parity requires further verification.

First-session acceptance: the new client identifies as Java 1.16.5 (protocol
754), successfully joins the local server, loads terrain and remains connected
through keepalives and ordinary movement. This is not a full-parity release.

## Connection milestone verification

The active runtime now uses protocol 754 with native block/item/entity/sound IDs,
metadata, collision/selection/rendering data and assets. A direct local-server
probe decoded 2,313 terrain sections, confirmed the spawn teleport, answered two
keepalives and reported no unsupported packets. The browser probe loaded terrain,
rendered the world/HUD, moved the player and remained connected through two
keepalives with no console errors, decoding warnings or missing HTTP resources.
All 12 protocol/font checks pass. The asset build validates 17,112 block states
and includes all 2,336 sounds; 90 common entity models are extracted natively.

The font sheet fix is backported to 1.13.2, 1.14.4 and 1.15.2, which already
support font providers. Bounded asset-build concurrency and useful per-file errors
apply to all supported branches. Version-specific wire changes remain here.

## Nether content milestone

The six Nether mob renderers, smithing interface, native biome effects and
particles, tool-speed tables, Netherite equipment, lodestone compasses, strider
steering, RGB/named-font text and native option lists are now implemented. The
asset validator checks the new mobs without exemptions. Isolated browser scenes
exercise twelve adult/child mob variants and the new screens; the live browser
probe still verifies joining, terrain, movement and keepalives.

See [the parity audit](parity-1.16.5.md) for fixture coverage, applicable backports
and open issues. Next priorities are end-to-end Nether gameplay verification,
remaining animation/ambient differences, command/protocol audit expansion and
Fabulous/account-service gaps. Full parity remains an open milestone.
