# Incoming chat cryptographic verification (1.19.4)

Incoming player chat now verifies both the Mojang-issued profile-key certificate and the session-key signature over the native signed message payload. A signature's presence is no longer enough to select trusted rendering. The implementation is synchronous public-key verification, so packet order is preserved and HTTP LAN/file clients do not depend on secure-context WebCrypto.

## Exact native rules

Checked against the pinned official 1.19.4 client and authlib 3.18.38:

- ProfilePublicKey.Data (byp$a): SHA1withRSA service signature over big-endian player UUID, certificate expiry in epoch milliseconds, and DER public-key bytes. The native eight-hour expiry grace applies when installing a remote session.
- PlayerChatMessage (ty), SignedMessageLink (ud), SignedMessageBody (ub) and LastSeenMessages (tp): SHA256withRSA over version integer 1, sender UUID, session UUID, message index, salt, epoch seconds, UTF-8 byte count/content and ordered previous-message signatures/count.
- SignedMessageValidator (ue$a): valid message signatures plus advancing sender/session indices; exact repeated messages are allowed, changed same-index messages/replays are rejected, and a failed chain remains failed until a new session. Gaps in indices are allowed, as in the native client.
- ChatTrustLevel (fdv): verified signatures alone do not make seven-minute-old messages trusted. Changed displayed content/non-default fonts use the modified tag and original-text tooltip. Unsigned/stale messages remain unverified; system chat remains a separate category. The integrated-singleplayer trust exemption is not applied to this multiplayer-only client.
- Replacing/removing a player-info entry clears its old key. Native invalid-key, expired-key and message-validation failures disconnect. Secure-only rejected messages are not acknowledged as displayed. Signed and unsigned player-chat payloads both retain the native 256 UTF-16 character bound.

Native code was extracted under cache/port-1.19.4/chat-tags-src. Incoming verification is a 1.19 feature and is intentionally absent from the existing 1.18.2 and earlier branches.

## Trust anchors and primitives

chat-trust-roots.js contains public keys only: the native authlib yggdrasil_session_pubkey.der and the official [Minecraft Services public-key endpoint](https://api.minecraftservices.com/publickeys)'s playerCertificateKeys snapshot fetched on 2026-11-04. The native key SHA-256 is recorded in the source. No game server can supply its own trust root; no runtime CORS proxy or authenticated account request is required to load these bundled anchors. Future service-key rotations require a trusted source update, not accepting a new root from a chat packet.

The verifier parses bounded RSA SPKI DER, checks the RSA algorithm/parameters and rejects malformed/oversized inputs. PKCS#1 v1.5 validation checks the complete padding, exact digest-info encoding and complete SHA-1/SHA-256 digest; values outside the modulus and wrong-length signatures fail. SHA-256 and RSA verification use pure JavaScript/BigInt. No private-key handling or new account-token storage is introduced.

## Validation and limits

- Independent Node/OpenSSL signatures validate certificates/messages; malformed DER, bad padding, altered text/UUID/session/index/salt/timestamp, swapped certified keys, bad roots, expiry, stale messages and chain replay are rejected appropriately.
- A separate byte-layout oracle checks the complete signed payload; decoded native player-info packets install the certificate and drive the actual Game handler/trust bars.
- A headless HTTP Chromium test removes WebCrypto entirely and verifies certificate/message signatures, then rejects tampering. One run measured about 6.4 ms for initial certificate installation and 12.1 ms for 100 message verifications; these are synthetic browser CPU timings with a generated test authority, not Java/user-GPU/FPS measurements.
- Real WebGL chat-bar pixel tests and existing chat/deletion/filter/hover regressions pass. Test private keys are generated only in test-process memory; production anchors are public official keys. Tests do not change production trust roots.

A disposable official 1.19.4 offline-mode server also passed a real login/player-info/chat round trip: unsigned chat displayed with the native unverified tag. The fixture used a temporary world and left the user server untouched. Offline mode advertises secure chat as disabled; this does not test authenticated certificates.

No live authenticated Mojang-account chat capture was available for an end-to-end server test; no such result is claimed. Outgoing account/session signing, signed command arguments, reportable chat history and authenticated report submission remain unfinished. Current outgoing chat stays unsigned. This patch implements incoming verification, not the entire signed-chat/reporting milestone.
