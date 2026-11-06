# Chat completions and keybind components (2026-11-06)

Keybind text components now resolve the current control binding in chat, styled/hover segments, and the unformatted component-string path where that API exists. Changes in Controls are read at rendering time. Unknown bindings preserve native release differences: literal IDs in 1.12.2–1.15.2, translatable fallback in 1.16.5 and later. Key names reuse each target's existing Controls naming. Keybind components were not added to 1.8.9.

References: native 1.12.2 KeyBinding `bhy.b`, 1.13.2 `cfp.a`, 1.14.4 `cxz.a`, 1.15.2 `dbk.a`, 1.16.5 `djw.a`, 1.17.1 `dvm.a`, 1.18.2 `dyo.a`, and 1.19.4 KeyMapping `emf.createNameSupplier` / KeybindContents `um` from each exact client jar.

On 1.19.4, custom chat-completion ADD/REMOVE/SET packets update a connection-owned set. Normal-chat Tab completion unions that set with online player names, without adding custom entries to entity/game-profile command providers. A new Join Game clears it; respawn does not. Invalid action enums are rejected.

The packet writer and set handler were executed directly in the pinned native 1.19.4 JVM using `tools/port-1.19.4/VerifyCustomCompletions.java`; committed vectors cover all actions, duplicates and removal of missing entries. `tools/test-custom-completions.mjs` checks those bytes through the real decoder/Game handler, online-name union, ChatScreen Tab, command-provider separation and connection reset. The native classes are ClientboundCustomChatCompletionsPacket `wb` and ClientSuggestionProvider `fdm`. The historical Wiki endpoint was restricted; no unavailable historical text is marked verified. The [official 1.19.3 notes](https://www.minecraft.net/en-us/article/minecraft-java-edition-1-19-3) are available; exact code determines these behaviors.

Keybind regressions and relevant chat/command tests pass on all nine applicable branches; browser bundles compile. Custom-completion tests pass on 1.19.4 and its forwarded 1.20.6 baseline. Custom completions are not added to 1.18.2 or earlier; the unfinished native 766 Play transition is not certified. No distributions were rebuilt.
