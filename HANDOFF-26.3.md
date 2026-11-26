# MinecraftJS 26.3 — agent handoff

**Repository:** https://github.com/Reb0rnEnder/MinecraftJS
**Branch:** `26.3` (last commit `88fd7a6`, "Decode 26.3 map data and swing animation.")
**Branch contains:** all 26.3 protocol work, reports, gates and tools. The handoff zip excludes `.git`, so clone the repo and check out `26.3`, or copy this tree over a clean clone.

## Read first

1. `AGENTS.md` — multi-version rules; never force one release's layout onto another.
2. `docs/transition-26.3.md` — the ender-style transition plan and the current raw-packet inventory (34 IDs).
3. `docs/parity-checklist-26.3.md` — 17-task ledger and P06 evidence.
4. `docs/transition-26.3.tasks.json` — machine-readable task state and chronological evidence.
5. `tools/port-26.3/` — pinned inputs, generators, byte gates and live-server harness.

## State at handoff

- **P06 coverage: 110/144 inbound IDs decoded, 99 with adapters, 34 raw.**
- Ledger: **41.2%** (3 done, 8 partial, 6 todo; done=1, partial=0.5).
- Last full run: `test:26.3`, `adapter:26.3`, `client-net:26.3` and `inbound-gate.mjs` all exit 0.
- Real 26.3 server socket test passes (`client-net`, 27 chunks); graphical browser verification is unreliable on this machine (low disk, join stalls). Do not claim visual verification you did not do.
- Uncommitted in the source workspace: three `docs/checkpoint-26.3-entities*.png` screenshots (not part of the port; leave or add deliberately).
- No Mojang jars, derived large artifacts or credentials are in the zip or repo.

## Required environment

- Node.js (repo uses ESM scripts), Java JDK with `javap`.
- Restore pinned native inputs with `npm run prepare:26.3` (script downloads and SHA-verifies the 26.3 client jar and libraries into `cache/port-26.3/`). The `cache/` directory is deliberately excluded from the zip.
- `npm install` for tooling.

Classpath used for every layout check:

```bash
CP="cache/port-26.3/client.jar;$(find cache/port-26.3/libraries -name '*.jar' | tr '\n' ';')"
javap -p -c -classpath "$CP" net.minecraft.network.protocol.game.<PacketClass> > /tmp/p.txt
```

Never dump `client/js/net/play-schema-1.20.6.js`; it floods output.

## Gates (run after every section)

```bash
node tools/port-26.3/inbound-gate.mjs
npm run test:26.3
npm run adapter:26.3
npm run client-net:26.3
```

After adding a `Game` handler, run `node tools/port-26.3/generate-ids.mjs` first; `test:26.3` checks the generated map.

## Non-negotiable method

- Decode only against 26.3 bytecode (`javap`) or live 26.3 bytes. Never guess a layout.
- Unknown packets stay raw and fail closed. A decode error must not close the socket.
- Do not mix versions: menus are native 26.3, number formats are decoded natively, styled formats remain fail-closed until the Style codec is ported, and textures stay 1.20.6 because 26.3 models are Java code, not entity JSON.
- No mixed-version data; no committed Mojang jars; preserve GPL-3.0 provenance.
- Stage files explicitly; never commit user screenshots, servers/worlds or session files.
- Update the three docs counts and evidence in the same commit as the code.

## Next sections, in order

1. **`player_chat` (id 66)** — verified 26.3 field order: `VarInt globalIndex`, sender `UUID`, `VarInt index`, optional `MessageSignature`, `SignedMessageBody.Packed`, optional unsigned `Component`, `FilterMask`, `ChatType.Bound`. Still to verify with `javap`: `MessageSignature.STREAM_CODEC`, `SignedMessageBody$Packed.STREAM_CODEC`, `FilterMask.STREAM_CODEC`, `ChatType$Bound.STREAM_CODEC`. Then map to the existing `on_chat` shape. Do not guess these four.
2. `merchant_offers` (53) / 766 `trade_list` — container id, offers list, villager level/XP/regular/restock; use existing 26.3 item-stack codec.
3. `update_tags` (137), `update_recipes` (136), `update_advancements` (133) — reuse native registries and existing 766 handler shapes.
4. `explode` (36), `damage_event` (25), `award_stats` (3), `game_rule_values` (40), `projectile_power` (138).
5. Borders: `initialize_border`, `set_border_center/lerp_size/size/warning_delay/warning_distance` (the 1.20.6 handler vocabulary is 0–5).
6. `waypoint` / dialogs, `mount_screen_open`, `add_transient_block`, `move_minecart_along_track`, `place_ghost_recipe`, recipe-book add/remove/settings, debug/test packets.
7. **P10** `ExtractModels26_3.java` — biggest unlock/risk: dump 26.3 `ModelLayers`/`ModelPart` into `bundles/entity-models.json`, then evaluate a 26.3 asset target (pack format 97, jar-first textures, indexed sounds).

## Known blockers

- P09 auth requires a real Microsoft account; do not fabricate session tests.
- P13 visual parity needs user review.
- Entity-model extraction feasibility unknown; there is no JSON oracle in the 26.3 jar.
- Full live browser verification is unreliable here; use the byte gates and headless `client-net` harness.

## Definition of done for one section

1. Bytecode-verified decoder and adapter.
2. Gate fixture in `tools/port-26.3/inbound-gate.mjs`.
3. `generate-ids` if a Game handler was added.
4. All four commands above green.
5. Docs updated with new counts and an evidence entry.
6. One focused commit with the repo's existing message style.
