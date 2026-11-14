# Protocol 766 packet audit

The reported `update_advancements` crash was a missing 32-bit branch in the generic bitfield reader. Advancement display flags are a native big-endian int. Defining the packet schema had not exercised that branch. The permanent gate now uses the native Java codec, rather than treating schema coverage as packet acceptance.

The audit covers **122 incoming Play IDs, all 58 actual outgoing senders, and 1,513 native cases**. See [the per-packet inventory](packet-coverage-1.20.6.json) and [the wire corpus](../tools/fixtures/play-packets-1.20.6.json).

## Corrections

| Path | Correction |
| --- | --- |
| Advancements | Read 32-bit flags; exercise all eight display-flag combinations. |
| Signed chat / message removal | Respect fixed buffer lengths, including 256-byte signatures, instead of consuming the remaining packet. |
| Player list | Read the listed flag as a Boolean; exercise all 64 action masks, including public-key/session data. |
| Entity metadata | GlobalPos includes its packed BlockPos. Wolf and painting holders use direct registry IDs, including ID zero; inline holder data belongs to other codecs. |
| Block entities | Require the native NBT payload. |
| Recipe / command schemas | Remove unreachable old serializer aliases; retain the exact target registry IDs. |
| Chunk batches | Reply with the native clamped, weighted loading-rate estimate, rather than the received batch size. Graphical and standalone transports use the same calculator. |
| Projectile power | Apply acceleration updates to AbstractHurtingProjectile types, including experimental wind charges; ignore other entities. |
| Combat enter / end | Explicit native no-ops. |
| Ping / debug samples | Retain bounded diagnostic histories; native chart presentation/subscription behavior remains incomplete. |
| Editor senders | Restore book, command-block, minecart and structure editor senders missing from the 1.20.6 facade. Add the remaining target Play builders. |
| Item wire components | Correct food effect payloads / absent later fields and inline instrument duration/fields. Native component-slot regressions travel through the actual Creative sender. |

## Independent validation

`PacketRoundtrip1206.java` binds the real `GameProtocols.CLIENTBOUND` and `SERVERBOUND` dispatch codecs using native registry access. Each sample must decode without unread bytes and re-encode. The JS decoder consumes the native canonical incoming bytes; every actual outgoing builder must match its native re-encoding byte for byte. Native packet identities are checked too. Registration ID zero is the special bundle registration; the wire decoder produces the bundle delimiter.

The pinned client SHA-1 is `05b6f1c6b46a29d6ea82b4e0d42190e42402030f`. The audit verifies its official mappings and all 8,206 class files in the unsigned oracle copy against the original jar. Native authority includes `DisplayInfo`, `EntityDataSerializers`, `ByteBufCodecs.holderRegistry`, `GlobalPos`, `ChunkBatchSizeCalculator`, and `ClientPacketListener` handlers. Historical scope: [1.20.2](https://minecraft.wiki/w/Java_Edition_1.20.2) introduced chunk batches; [1.20.5](https://minecraft.wiki/w/Java_Edition_1.20.5) introduced the component/registry/transfer changes used here. Exact wire behavior comes from the pinned 1.20.6 classes.

The generator expands reachable switch, mapper, option and holder branches, plus the explicit advancement/player-list masks. These are representative values, not every combination or malformed input. Existing decoder, Configuration, transfer, bundling and signed-chat regressions remain separate gates. A packet reaching a handler does **not** prove that its gameplay, animation, GUI or rendering is fully implemented. In particular, public-server and authenticated-account acceptance, debug chart presentation, item-component consumers and the remaining parity checklist are still open. Signing packet construction does not supply Mojang credentials or implement account signing.

Run `npm run packet-corpus:1.20.6` to regenerate with a JDK 21+ compiler/runtime and prepared native assets. `JAVA` and `JAVAC` overrides are supported. `npm run test:1.20.6` checks native regeneration and the permanent tests. The native model extraction prepares the unsigned client oracle cache; its class contents are verified before use. No user world/server is started or changed by this audit. Chunk-rate tests use synthetic clocks; they are correctness tests, not FPS measurements.

## Backport review

No older branch shares the protocol-766 schema interpreter. The advancement readers in 1.12.2–1.19.4 already read native 32-bit flags; 1.8.9 predates advancements. The 1.19.4 signed-chat reader already consumes exactly 256 bytes and its metadata reads complete GlobalPos values and direct painting IDs. The 1.13.2–1.19.4 editor senders are present. The 1.8.9/1.12.2 editors correctly use their version's plugin-message channels. Chunk-batch feedback, component slots, wolf variants, projectile-power packets and the new Play control packets must not be copied into those versions.

Selected existing checks passed in every older worktree: network errors (1.8.9, 1.12.2), native protocol/chunks (1.13.2, 1.14.4, 1.16.5, 1.18.2), runtime/bootstrap (1.15.2), terrain/light lifecycle (1.17.1), and signed chat (1.19.4): 64 checks in total. This is a focused applicability review, not complete older-version parity acceptance. No older source change was needed for this batch.
