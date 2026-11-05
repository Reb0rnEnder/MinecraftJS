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
