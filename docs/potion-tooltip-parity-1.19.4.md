# Potion tooltip duration backport

Potion durations now match the 1.19.4 native `StringUtil.formatTickDuration(int)` (`aqb.a`): `00:30`, `01:00`, and `01:02:30`, rather than the inherited unpadded minute count. Infinite effects show the translated `effect.duration.infinite` label. Amplifier and duration composition uses `potion.withAmplifier` / `potion.withDuration`, allowing language and resource-pack templates to reorder arguments.

Authority: the pinned client `958928a560c9167687bea0cefeb7375da1e552a8`, official mappings, `PotionUtils.addPotionTooltip`, `MobEffectUtil.formatDuration`, and `StringUtil.formatTickDuration`. Mojang's [1.19.4 release notes](https://www.minecraft.net/en-us/article/minecraft-java-edition-1-19-4) record infinite effect durations. The finite fixture generator executes the actual Java formatter; infinity/translation tests exercise the real NBT potion tooltip path against the shipped language templates.

Run `node tools/port-1.19.4/potion-duration-fixtures.mjs --check` and `node --test tools/test-potion-tooltip-1194.mjs`. The related use-sound and signed-chat tests also pass (23 checks together). No user server, configuration, world or capture is modified.

This applies to 1.19.4 and is implemented in the 1.20.6 component consumers too. Native formatter classes were inspected in 1.14.4–1.18.2; their unpadded minute format remains unchanged. It is not a reason to copy 1.20.6 item components or newer tooltip rows into older targets.

The follow-up effect presentation fix also uses native ordering and duration labels in inventory panels, prevents infinite HUD icons from being treated as nearly expired, and lets infinite nausea drive distortion. It preserves the 1.19.4 effect IDs and legacy GUI sheet textures. The targeted effect-panel, portal and item-use regressions pass (13 checks); the earlier 23-check potion/use/chat pass is separate evidence.
