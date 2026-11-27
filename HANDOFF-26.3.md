# MinecraftJS 26.3 — agent handoff

**Repository:** https://github.com/Reb0rnEnder/MinecraftJS
**Branch:** `26.3` (last commit `be69aed`, "Use native 26.3 equippable slots for armor placement.")
**GitHub:** https://github.com/Reb0rnEnder/MinecraftJS/tree/26.3
**Branch contains:** all 26.3 protocol work, reports, gates and tools. The handoff zip excludes `.git`, so clone the repo and check out `26.3`, or copy this tree over a clean clone.

## Read first

1. `AGENTS.md` — multi-version rules; never force one release's layout onto another.
2. `docs/transition-26.3.md` — the ender-style transition plan and the current raw-packet inventory (9 IDs).
3. `docs/parity-checklist-26.3.md` — 17-task ledger and P06 evidence.
4. `docs/transition-26.3.tasks.json` — machine-readable task state and chronological evidence.
5. `tools/port-26.3/` — pinned inputs, generators, byte gates and live-server harness.

## State at handoff

- **P06 coverage: 144/144 inbound IDs decoded, 120 with adapters, 0 raw.** The final four are the debug value/event packets; debug-subscriptions-26.3.js ports the native 16-entry subscription registry and 15 value codecs (dedicated_server_tick_time has a null value codec and stays fail-closed). Configuration `show_dialog` and `server_links` decode through the same native common codecs as Play; Play `show_dialog`/`clear_dialog` are now adapted too.
- **Native Creative catalogue:** `creative-data:26.3` rebuilds the pinned client's CreativeModeTabs for all eight feature masks (2034 unique stacks, 405 component-patched, 14 tabs) and verifies every stack and raw component patch through the JavaScript codec. `test-creative-26.3.mjs` covers the consumer; creative slots send the native untrusted-stack patch, and every patched catalog stack carries `HashedStack.create` hashes verified byte-for-byte against Mojang's `HashedStack` codec. General hashing for arbitrary server-provided component values is still open.
- Ledger: **44.1%** (4 done, 7 partial, 6 todo; done=1, partial=0.5).
- P04 item work now also applies adapted slot patches on re-read, adapts nested ItemStackTemplates (bundles, containers, charged projectiles), mirrors native use animations/durations, skips the 766 id-indexed use/attribute fallbacks for 26.3 stacks, and exercises occupied component samples in the oracle.
- Last full run: `test:26.3`, `adapter:26.3`, `client-net:26.3` and `inbound-gate.mjs` all exit 0.
- Real 26.3 server socket test passes (`client-net`, 23–31 chunks depending on spawn); graphical browser verification is unreliable on this machine (low disk, join stalls). Do not claim visual verification you did not do.
- Uncommitted in the source workspace: three `docs/checkpoint-26.3-entities*.png` screenshots (not part of the port; leave or add deliberately).
- No Mojang jars, derived large artifacts or credentials are in the zip or repo.

## Required environment

- Node.js (repo uses ESM scripts), Java JDK with `javap`.
- Restore pinned native inputs with `npm run prepare:26.3` (script downloads and SHA-verifies the 26.3 client jar and libraries into `cache/port-26.3/`). The `cache/` directory is deliberately excluded from the zip and git.
- **Native jar in this workspace:** `MinecraftJS/cache/port-26.3/client.jar` (40 MB). SHA-1: `e877b6a07acd633fb3bb475002175cec036e7b87`. If it is missing, `npm run prepare:26.3` restores the exact pinned artifact; never substitute a different build. The official version manifest is https://piston-meta.mojang.com/mc/game/version_manifest_v2.json. The jar is Mojang code and is not redistributed in the handoff zip or repository.
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
npm run client-net:26.3   # needs the disposable 26.3 server on 127.0.0.1:25568
```

After adding a `Game` handler, run `node tools/port-26.3/generate-ids.mjs` first; `test:26.3` checks the generated map.

## Non-negotiable method

- Decode only against 26.3 bytecode (`javap`), the CFR-decompiled method body, or live 26.3 bytes. Never guess a layout. CFR 0.152 goes in the gitignored cache:

```bash
mkdir -p cache/tools && curl -fsSL -o cache/tools/cfr.jar https://repo1.maven.org/maven2/org/benf/cfr/0.152/cfr-0.152.jar
java -jar cache/tools/cfr.jar cache/port-26.3/client.jar --jarfilter '^net\.minecraft\.<package>\..*$' --outputdir cache/dec263
```

- When field order or flag bits are not provable from `javap` alone, write a `Dump<Packet>26_3.java` oracle that builds the packet and encodes it with Mojang's own `STREAM_CODEC`; the gate then decodes those exact bytes. `DumpAdvancements26_3.java`/`advancements-oracle.mjs` is the reference.
- If the client needs a Java library behaviour that JS lacks (weighted selection, `Instant`, a tracker class), port that class's method body instead of approximating it. `ClientExplosionTracker` is ported in `client/js/game/explosion-tracker.js` and unit-gated: 512-particle cap, weighted picks, particle-setting clearing and solid-block rejection.
- Unknown packets stay raw and fail closed. A decode error must not close the socket.
- Do not mix versions: menus are native 26.3, number formats are decoded natively, styled formats remain fail-closed until the Style codec is ported. Assets target 26.3 (pack format 97, jar-first textures, indexed sounds): `ExtractLayers26_3` bakes the native layers, and the remaining families whose part trees 26.3 restructured (ender dragon, end crystal) keep the 1.20.6 rig; boats, rabbit, horse/donkey, camel, sniffer, horse armor and the player use native 26.3 layers the renderer animates. Only sprite paths 26.3 dropped fall back to the pinned 1.20.6 file.
- No mixed-version data; no committed Mojang jars; preserve GPL-3.0 provenance.
- Stage files explicitly; never commit user screenshots, servers/worlds or session files.
- Update the three docs counts and evidence in the same commit as the code.

## Next sections, in order

1. **P13 dialog remainder** — notice/confirmation/multi_action/dialog_list/server_links and static/custom actions are presented, with server-link buttons fed from `server_links`; text/multiline, boolean, number-range and single-option inputs feed dynamic actions, item bodies draw their icon and count, the title-row warning button opens Back/Disconnect, and styled plain-message spans keep their click actions and show-text tooltips. Only live visual acceptance remains. The debug value/event packets are decoded but still need a native debug renderer.
2. **P02 entity table closed** — the 161-type 26.3 registry now drives wire ids, dimensions, eye heights, mob categories, stats names and boat/potion object kinds; `test-entity-registry-26.3.mjs` and `entity-registry:26.3 --check` pin it. P10 now binds native rigs for boats, rabbit, horse/donkey, camel, sniffer, horse armor and the player; the ender dragon and end crystal still need renderer work.
3. **P10** started: `tools/port-26.3/ExtractLayers26_3.java` dumps all 361 native layers and `lib/model-extract-26.3.js` bakes a complete 129-model bundle for the 26.3 asset target. Remaining: port the dragon neck/tail chain and end-crystal hierarchy; all other restructured rigs are native, including player cape/ears and horse/camel saddle layers.

Already closed: scoreboard/teams, biomes, maps, swing animation, player chat, merchant offers, damage events, advancements, explosions (Mojang-codec fixtures; `ClientExplosionTracker` ported), statistics (native 26.3 stat registry), minecart steps, projectile power (decoded only — 26.3's scalar has no 766 adapter), the full world-border family (initialize plus all five setters, 0–5 action vocabulary), tags, game-rule values, report details, the disk-space warning, transient blocks, mount screens, debug samples, the test-instance/highlight frames, server links, clear-dialog, native item defaults (all 1658 reports → `itemComponentValues26_3`) and the recipe family (native RecipeDisplay/SlotDisplay graph, live-capture verified; no 766 adapter because 766 has no display graph).

## Known blockers

- P09 auth requires a real Microsoft account; do not fabricate session tests.
- P13 visual parity needs user review.
- Ender dragon and end-crystal rigs still animate the 1.20.6 part trees; their 26.3 geometry waits on renderer updates. Boat/chest-boat, rabbit, horse/donkey, camel, sniffer, horse-armor and player rigs are native, including pale_oak/poplar boats and the player cape/ears.
- Full live browser verification is unreliable here; use the byte gates and headless `client-net` harness.

## Definition of done for one section

1. Bytecode-verified decoder and adapter.
2. Gate fixture in `tools/port-26.3/inbound-gate.mjs`.
3. `generate-ids` if a Game handler was added.
4. All four commands above green.
5. Docs updated with new counts and an evidence entry.
6. One focused commit with the repo's existing message style.
