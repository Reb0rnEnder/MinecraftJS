# Native 1.20.6 development evidence

The graphical runtime is still the 1.19.4 baseline. This branch is an early
protocol port, not a playable 1.20.6 client or a full-parity release.

On 2026-11-05 the SHA-1-pinned native 1.20.6 server (protocol 766) accepted the
new offline transport in a disposable loopback-only world. The probe observed
compression threshold 256, full Configuration negotiation, eight streamed
registries (64 biomes, 7 chat types, 16 trim patterns, 10 trim materials, 9 wolf
variants, 4 dimension types, 45 damage types, 41 banner patterns), vanilla feature
flags, native Play join in the overworld, teleport confirmation, a real keepalive
reply, four chunk-batch replies and 45 received chunk payloads. Those chunks were
counted as raw packets; no terrain decoding/rendering is claimed.

Run `npm run prepare:1.20.6`, `npm run test:1.20.6`, then the fixture and probe
commands in README.md. Native ConfigurationProtocols registrations, registry
entries and known-pack packets were cross-checked against the exact client jar
and official mappings. Java DataOutputStream independently confirmed the modified
UTF-8 fixture `000b41c080c3a9eda0bcedbcbf` for NUL and supplementary characters.
Nine target regressions pass. Inherited mouse-look/Wisp regressions have nine
passes and one intentional browser-only skip.

Cookie limits, absent registry payload rejection, duplicate entries, phase
acknowledgements, subsequent reconfiguration and malformed input are covered by
regressions. Real server transfer, encrypted authentication, resource-pack UI,
item-component stacks, complete Play decoding and graphical integration remain
open. The old slot codec explicitly throws for this target rather than silently
misreading component stacks. Target-specific network formats are not backported.

The local server jar is verified against target.json; only server properties and
EULA were copied from the existing 1.19.4 fixture. User worlds/configs/captures
are not committed or loaded by the isolated probe. No distribution was rebuilt.

## Forwarded interaction-entity correction

The 1.19.4 parity review (source commit `59853ce`) found zero registration dimensions overwriting the
interaction entity's own 1x1 spawn bounds and pickability. This shared graphical
baseline now retains its defaults, applies width/height/response metadata, uses
zero pick-radius inflation and consumes Use with response-controlled arm swing.
Native 1.20.6 Interaction (`btm`) confirms the same dimensions/response semantics;
client jar SHA-1 is `05b6f1c6b46a29d6ea82b4e0d42190e42402030f`.

The forwarded interaction/chest-boat tests pass (8 tests), and the client bundle
compiles. These use the existing 1.19.4 graphical/metadata baseline, not a
completed 1.20.6 Play codec. A broader projectile test was attempted but cannot
load the absent generated entity-model bundle. Native 1.20.6 live/render parity
is not inferred. No pre-1.19.4 target receives this newer entity feature.

## Planning checkpoint, 2026-11-06

The user authorized advancing the existing 1.20.6 port while carrying inherited gaps explicitly. The [updated plan](transition-1.20.6.md) and [task ledger](transition-1.20.6.tasks.json) replace the earlier finish-all-baseline-fixes-before-starting gate. Four native input hashes and embedded version fields were rechecked; the existing Configuration suite passed nine tests. No live server probe was rerun and no gameplay milestone is newly accepted by this documentation change.

P02 native reports/default components/resource coverage is now accepted below; P03/P04 codec work follows. The first graphical acceptance target is P07. The browser restricted historical release URLs, but direct curl retrieved all seven original Wiki pages; Fandom direct requests returned challenge pages. Their source hashes/topic/fix index, selected-section review and official/native cross-checks are recorded in transition-1.20.6.inputs.json and transition-1.20.6.release-index.json.

## P02 native data/resource baseline, 2026-11-07

P02 is accepted. `tools/port-1.20.6/reports.mjs` now regenerates the exact
1.20.6 Mojang data-generator reports from the SHA-1-pinned server input and
checks a committed semantic baseline. The target resolves to 1,060 blocks,
26,684 contiguous block states, 1,330 items, 56 contiguous data-component
types, 74 registries and 8,283 default item-component entries. Every reported
default item component is validated against the target component registry.

The same gate inventories the target client-jar atlas/font definitions and the
asset-index language, sound and external Unihex objects. FeatureFlags bytecode
is checked against the pinned server class: `minecraft:vanilla` is the native
default set, while bundle, trade rebalance and update-1.21 remain non-default
experiments. Protocol phase packet counts are recorded for 1.20.4 versus the
1.20.5/1.20.6 schema boundary.

Mojang's generated item report can vary in JSON object key order between runs,
so report source hashes use canonical parsed JSON rather than raw serializer
bytes. The semantic baseline passed two consecutive full
`npm run test:1.20.6` runs, while the existing nine Configuration tests
remained green. P03 (native binary/NBT text primitives) is the next gate.

## P03 native NBT text primitives, 2026-11-07

P03 is accepted. Protocol 766 now has a bounded anonymous-NBT writer matching
the existing typed reader across tags 1-12, including Java modified UTF-8,
byte/int/long arrays, list/compound nesting and malformed-length/depth checks.

`component-nbt-1.20.6.js` adds the target-specific 1.20.3+ text-component
boundary without changing older chat parsing. It enforces native string/object/
non-empty-list roots, preserves styles/events, normalizes root sibling arrays to
`extra`, and reproduces NbtOps heterogeneous-list empty-key wrappers.

`component-fixtures.mjs` regenerates byte fixtures from the SHA-pinned 1.20.6
server by bootstrapping Mojang `ComponentSerialization` + `NbtOps` and writing
network anonymous NBT. The committed set covers plain text, style/click events,
root siblings, translated mixed lists and hover text, plus native rejection of
numeric, boolean, null and empty-list roots. Configuration disconnect/resource-
pack prompts and Play disconnects now consume the strict component codec.

`npm run test:1.20.6` now checks target IDs, native data/resource reports, native
component fixtures and both regression suites: 17/17 tests pass. P04 item
component-stack defaults/patches/nested stacks is the next dependency gate.
