# Spectator flight and F3+F4 fixes

Opening a screen intentionally releases pointer lock and clears gameplay input.
The game-mode switcher previously interpreted that reset as releasing F3 and
committed on its next tick. `Input.heldKeys` now tracks physical keyboard state
independently of gameplay bindings. Keyup and window blur clear that state;
pointer unlock does not. The switcher commits once on F3 release, permits F4
cycling while held, and consumes the debug combo without toggling the F3 HUD.
Escape still cancels. This applies to 1.16.5 and 1.17.1, which have this screen.

`Player.tick` in the native jars sets spectator noclip and clears onGround before
local movement. Previously noclip was set late, allowing the first spectator
tick to push out of blocks, and onGround could remain set indefinitely because
noclip movement never performed collision resolution. That incorrectly selected
ground acceleration/drag instead of flight acceleration and airborne drag.
This correction applies to all supported branches, 1.8.9 through 1.17.1.

Native `LocalPlayer.aiStep`, `KeyboardInput.tick`, and `Player.travel` differ by
release, so descent behavior is not copied indiscriminately between versions:

| Versions | Handling retained or corrected |
| --- | --- |
| 1.8.9 | Preserve native horizontal sneak slowdown while flying. |
| 1.12.2 / 1.13.2 | Preserve sneak input reduction and its flight compensation. |
| 1.14.4 | Reduce non-spectator input on Shift before the native compensation; preserve the native spectator exception. |
| 1.15.2–1.17.1 | Remove obsolete horizontal compensation: crouching input already excludes flight. |
| 1.16.5 / 1.17.1 | Respect `Player.isAffectedByFluids`: flight does not receive an extra liquid jump impulse. |

Comparisons used the installed native client jars, including official mappings
for the modern versions. Decompilation output and downloaded tooling remain in
`/tmp`, not in the repository. No game assets or native source were added.

`tools/test-spectator-flight.mjs` checks first-tick noclip/ground state, airborne
acceleration, coasting/vertical damping and applicable version-specific descent
and fluid behavior. It runs on every supported branch.
`tools/test-gamemode-switcher-input.mjs` exercises the real Input/ScreenManager
unlock and key event ordering, focus loss, cycling, cancellation and one-time
submission. `tools/probe-gamemode-switcher-browser.mjs` verifies actual browser
pointer-lock transitions and F3/F4 events in an isolated scene; it sends no
commands to a game server. Browser probes passed on 1.16.5 and 1.17.1.
