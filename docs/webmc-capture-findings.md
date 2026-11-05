# webmc sound and death-message findings (2026-11-05)

The raw captures remain local, untracked user inputs. Sound capture SHA-256:
`b7f72ac8bd9b2dc00939b90cc58331ead66f2ed1fa8387d6c77421fed8de6ab7`.
Text capture SHA-256:
`d44845d206756cbab58221b26b0ab5400690eab61b8b73b42f185c6b091778be`.

## Two break sounds

The bounded 512-event sound trace contains 14 local break requests and 17 break
sound packets. Nine local breaks have a following packet at the exact block
coordinates within 165–276 ms. At 23.146 seconds a dark-oak break correctly
requests block.wood.break (pitch .8, centered in the block); 168 ms later the
server explicitly requests sound registry ID 1245, block.stone.break (pitch 1,
integer block coordinates). Dirt similarly produces a gravel break followed by
the same server-requested stone sound. This is not a local sound-table mix-up.

Native ClientPacketListener and SoundEngine honor explicit sound packets. The
user requested pure native playback, so the client continues playing both. No
suppression setting or guessed echo filter is added. A previous disposable
vanilla-server probe excludes its own normal break broadcast to the initiating
player; it does not emit this extra explicit sound packet.

## Literal marker on the death screen

The combat/death packet contains a plain `text` component ending in
`using <chat={uuid}:[item]:>.` It has no translation fallback or encoded item
component at that location. The separate server chat broadcast contains the
processed item component, hover contents and `/interactivechat viewitem …`
click action. The client already renders that broadcast correctly.

The exact pattern is a server-side InteractiveChat sender marker; see
[ProcessAccurateSender](https://github.com/LOOHP/InteractiveChat/blob/1e7a0cd32f573c01bec01dbf8e894bc1723ba9f0/common/src/main/java/com/loohp/interactivechat/modules/ProcessAccurateSender.java#L35).
That reference identifies the syntax, not the server's installed plugin revision.
The server sends the marker unprocessed through its combat-message path.

An independent JVM invocation of the pinned 1.19.4 Component.Serializer confirmed
that the captured combat component produces exactly its literal `text`, marker
included. The reusable oracle is tools/port-1.19.4/VerifyComponentText.java.
The earlier fallback support fixes a real missing native feature, but is not the
cause of this captured message. Removing this marker or replacing a death packet
with a separate chat broadcast would be non-native behavior; neither is shipped.

## Gray debug bars and verification

Native ChatComponent (`eod`) adds its System tag to ordinary local messages.
GuiMessageTag (`emc`) uses the same gray 0xD0D0D0 bar for System and Not Secure,
with different hover text. Native F3 feedback therefore has a gray bar. A new
regression verifies that debug feedback and system packets retain System, while
unsigned player chat retains Not Secure.

Incoming player chat uses Mojang-certificate validation, RSA message signatures,
last-seen bindings and chain/replay checks. System and debug messages bypass
player verification and are never promoted to signed-player trust. Outgoing chat
remains unsigned without account signing-key support. Neither all text nor all
server messages are claimed cryptographically verified.

The report does not certify full parity. Native fluid-preserving destruction
was another concrete discrepancy found and fixed; see fluid-breaking-parity.md.
