# Native message deletion, signature references and partial filtering

The decoder already supported hide_message and filter masks, but no game handler consumed message-deletion requests and partial filtering emitted plain hashes without their native style/hover text.

Implemented for the existing 1.19.4 target only:

- A separate 128-slot MessageSignatureCache, following the native deque replacement algorithm (including duplicate/tail behavior). Player-message body references and deletion references resolve through this cache; zero carries a full 256-byte signature and other wire IDs are cache index + 1. Invalid references use the native invalid-packet disconnect rather than target the wrong message. This cache is transport bookkeeping, not signature verification.
- Signature metadata follows messages through the delayed-display queue and stored HUD history. A deletion cancels a still-queued message immediately. Displayed messages remain visible until their original HUD timestamp plus 60 ticks, then become the translated gray/italic deletion marker with a system tag. Wrapped content rebuilds without resetting the timestamps or losing unrelated messages. Clearing chat/disconnecting cancels pending work.
- Deletion invalidates a pending last-seen acknowledgement. Connection login resets its reference cache.
- Partial filtering groups native UTF-16 positions into visible text and dark-gray hash runs, retaining the native chat.filtered hover explanation. Filtering does not turn an unverified message into verified chat.

Exact source evidence: native 1.19.4 MessageSignatureCache tv, MessageSignature.Packed tu$a, ChatComponent eod, ClientPacketListener fdk and FilterMask tm; extracted from the pinned official client jar under cache/port-1.19.4/chat-tags-src. Historical context: [Minecraft Java 1.19.3 release notes](https://www.minecraft.net/en-us/article/minecraft-java-edition-1-19-3) and [Wiki 1.19.3 history](https://minecraft.wiki/w/Java_Edition_1.19.3). No 1.19 packet/cache/GUI behavior is backported to 1.18.2 or earlier.

Validation: 35 focused chat/UI/social tests pass, including the native cache reference comparison, full and packed deletion packets, actual HUD ticking through the minimum display interval, cancellation/ACK handling, hidden-player cache synchronization, malformed references, clearing, UTF-16/64-bit filter boundaries and hover formatting. Real headless WebGL trust-bar pixel tests pass after the history refactor, and the existing protocol-762 fixture verifier passes. Shared native-version hover/UI fixtures pass on all nine targets.

Still unfinished: profile/session certificate verification, message-chain cryptography, signed outgoing messages/arguments, authenticated reporting and native reference-image gates. None of these tests establishes cryptographic trust or measures the user's GPU/FPS.
