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
