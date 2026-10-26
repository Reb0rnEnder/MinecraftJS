# Native Java 1.15.2 preparation (milestone 1)

Read [the committed transition plan](../../docs/transition-1.15.2.md) first.
These tools stage verified data for the active 1.15.2 runtime.

```
node tools/port-1.15.2/prepare.mjs
node tools/port-1.15.2/reports.mjs --check
node tools/port-1.15.2/packet-ids.mjs --check
node --test tools/test-1.15.2-bootstrap.mjs
```

`target.json` pins official release metadata, both jars and mappings, the asset
index, and version/protocol schemas from a fixed minecraft-data revision. Every
input is SHA-1 checked, including cache reads. Corrupt cache files are rejected.
Native data generation runs `net.minecraft.data.Main --reports` in the ignored
port cache; it does not start a server, open a world or accept an EULA.
The committed baseline records reports/hashes, registry counts, changed packet
IDs/layouts, bee/honey resource coverage, recipes and resource-pack format.
Staged packet ID tables are generated but not selected by the active codec.

Native baseline: 680 blocks, 11,337 states, 884 items, 103 entity types, 768
recipes; resource-pack format 5. Protocol 578 has 93 clientbound and 46
serverbound play packets. Moving the digging acknowledgement from 0x5c to 0x08
shifts many clientbound IDs; the mapping must be used instead of a global shift.
The seven changed layouts are living/player spawn (metadata removed), game
state (immediate respawn), chunks (1024 separate biome IDs for full chunks),
particles (double coordinates), login (hashed seed and respawn-screen flag),
and respawn (hashed seed). The pinned serverbound layouts are unchanged.

Milestone 2 is implemented in `client/js/net/protocol-1.15.2.js` and is
exercised by `tools/test-1.15.2-runtime.mjs` plus a live proxy join. Native
registries, 1.15.2 indexed assets and protocol 578 are now selected together.
Entity model extraction is still using the verified inherited bundle while the
packaged-class extractor is ported; this remains a documented visual gap.
