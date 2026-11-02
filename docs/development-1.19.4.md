# 1.19.4 development checkpoint

## Completed

- The existing 1.18.2 fixes are inherited, including canonical projectile rendering.
  Branch/worktree: `1.19.4`, `/home/ender/minecraftjs-1.19.4`.
- SHA-1-pinned official metadata, client/server jars, mappings, asset index and
  protocol schemas. `tools/port-1.19.4/target.json` records exact sources.
- Executed native data generation: 998 blocks, 23,725 states, 64 registries,
  79 root commands. `baseline.json` is a reproducible native report summary;
  target tables have not been silently installed into the old browser runtime.
- Protocol-762 IDs: 111 clientbound / 51 serverbound. Before inheriting a body,
  recursively compare its shared-type dependencies against 758. 81 / 42 bodies
  pass that schema check; runtime support can still be absent and is reported.
- New isolated decoder/encoders: registry-based join dimensions, optional death
  locations, position without the removed dismount boolean, unified spawn,
  system chat, binary server icon and secure-chat indication, raw target block
  entity records, combined terrain/light and explicit native palette registry.
- Native 1.19.4 LoginStart appends the optional UUID flag. This change is gated
  to protocol 762, and 758 framing is covered by a regression.
- Native respawn uses a **data-to-keep byte**: mask 1 keeps attributes, mask 2 keeps
  entity data. The pinned upstream schema calls it a boolean; the implementation
  follows the native constructor/write method instead. Previous mode is signed
  so the -1 sentinel survives.

## Native reference and verification

Decompiled the SHA-1-pinned official 1.19.4 client using CFR and official mappings:
ClientboundLoginPacket (`wv`), ClientboundPlayerPositionPacket (`xn`),
ClientboundRespawnPacket (`xs`), ClientboundAddEntityPacket (`vf`),
ClientboundLevelChunkWithLightPacket (`wq`), ServerboundHelloPacket (`abz`).
The [version's historical Wiki page](https://minecraft.wiki/w/Java_Edition_1.19.4)
confirms protocol 762, data version 3337, pack formats 13/12 and the experimental
1.20 boundary. Native wire code takes precedence over a conflicting schema.

Commands from this worktree:

```sh
node tools/port-1.19.4/prepare.mjs
node tools/port-1.19.4/reports.mjs --check
node tools/port-1.19.4/packet-ids.mjs --check
node tools/port-1.19.4/verify-protocol.mjs
node tools/port-1.19.4/probe-server.mjs --port=25567 --duration=25000
```

Fixture coverage: join/namespace/dimension validation, last-death position,
all four native respawn flag combinations, previous-mode sentinel, removed
position field/trailing-byte rejection, entity spawn data, server icon bytes,
keepalive/teleport IDs, transitive slot compatibility, rejected unported digging,
no inherited unsigned chat encoder, target air IDs/highest block state and both
758/762 LoginStart layouts. The inherited projectile and loading suites pass against the baseline 1.18.2
model bundle copied into ignored assets for those regressions; no 1.19.4 entity
model extraction or graphical parity is claimed.

The live probe used its own offline-mode test connection to the new native
server on port 25567: compression/login, registry dimensions, teleport confirm,
stale inventory resynchronization and keepalive passed. It decoded 461 chunks
(11064 sections), with 1 keepalive round trip. These are observed packet counts,
not graphics or Java performance metrics. Full diagnostics stay in ignored
`cache/port-1.19.4/live-probe.json`.

## Local server

`server1194/server.jar` is the verified official target jar. `server.properties`
and `eula.txt` were initially copied byte-for-byte from `server1182`; no existing
world was opened or upgraded. For the test only, the launch command overrode the
port to 25567:

```sh
cd server1194
java -Xms256M -Xmx1024M -jar server.jar --port 25567 nogui
```

The server can normalize properties on startup. Server/config/world files stay
ignored and are never committed. The test process is stopped after verification.

## Next work / remaining gates

The **browser still identifies as 1.18.2** because its active codec/assets remain
758. New 762 modules are deliberately isolated; the supported distribution
contains the existing eight clients only. The TCP/terrain probe is not a claim
that the graphical client can join correctly yet.

Next: target-native assets/extractors (including the JOML model-matrix change),
complete 762 entity and metadata registries, bundle boundaries, command/recipe
shared types, profile/player-list updates, changed block/effect/sound packets,
sequence-based prediction acknowledgements and target block-entity conversion.
Then integrate the graphical connection and update every runtime/F3/proxy/build
identity together. Implement signed chat/session handling separately, with honest
account-capability and trust states; do not reuse 758 chat encoding.

The live probe explicitly skipped feature flags, recipes, commands, player info,
world-border initialization, bundle delimiters, metadata, multi-block changes and
damage events. These are queued work, not silently reported as supported.
Milestones 2–6 in the transition plan still cover content, chat, UI and parity.
No new 1.19 protocol field, asset or experimental feature is backported.
