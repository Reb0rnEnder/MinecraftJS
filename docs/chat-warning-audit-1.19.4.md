# Secure-chat warning audit (1.19.4)

The protocol decoder already read server_data.enforcesSecureChat, but Game had no handler. It now records the server policy and queues the native multiline “Chat messages can't be verified” toast when that policy is false. It does not wait for the first chat message and does not infer policy from missing message signatures. Secure servers do not produce this warning. New login clears the policy metadata.

Native reference: exact 1.19.4 ClientPacketListener fdk.handleServerData (xw overload), SystemToast epx.multiline, epx$a.UNSECURE_SERVER_WARNING (10,000 ms), and ToastComponent height-based slot allocation. The 200-pixel wrapped body, 230-pixel minimum overall width, 12-pixel line spacing and tiled background are reproduced. Multiline toasts reserve enough 32-pixel slots instead of overlapping later notifications.

Version boundary verified against the [Minecraft 1.19.1 release notes](https://www.minecraft.net/en-us/article/minecraft-java-edition-1-19-1) and [Minecraft Wiki 1.19.1 RC2 history](https://minecraft.wiki/w/Java_Edition_1.19.1_Release_Candidate_2). This feature is intentionally absent from supported 1.18.2 and earlier clients.

Unfinished: incoming session/profile certificate verification, message signature chains, trust indicators/reportable logs and signed outbound chat. The existing player-chat path conservatively marks messages unverified and secure-only chat is not claimed complete. The server policy warning does not establish trust in any individual message. No cryptographic verification was added by this patch.

Tests decode a real 762 server_data payload, check both policies, verify multiline dimensions/slot reservation, drawing bounds and the ten-second lifetime.

Focused warning/social-blocking regressions: 9 passed. The older chat-hover regression file still has two failures (item enchantment/lore tooltip and translated hover hit regions); both reproduce unchanged at the parent commit. A follow-up audit traced these to stale version-whitelisted fixtures (legacy item NBT and HUD baseline); corrected native-version fixtures now pass. See chat-regression-fixture-audit.md.
