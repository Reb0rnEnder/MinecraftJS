# Respawn parity follow-up (2026-11-06)

Native respawn creates a new local player, even within the same dimension. The client now replaces that body, resets motion, effects, use state, inventory, camera/mount state and health synchronization, and follows each target's retention rules. Attribute records are copied independently of synchronized metadata. Max-health modifiers now use native arithmetic and the release's attribute range. The first server health update initializes health without inventing a damage flash.

| Target | Metadata retention | Attribute retention | Max-health minimum |
| --- | --- | --- | --- |
| 1.8.9 / 1.12.2 / 1.13.2 / 1.14.4 | Always | Never | 0 |
| 1.15.2 | Always | Always | 0 |
| 1.16.5 / 1.17.1 / 1.18.2 | Always | Packet boolean (`keepAttributes`) | 1 |
| 1.19.4 | `dataToKeep & 2` | `dataToKeep & 1` | 1 |
| 1.20.6 worktree | Forwarded 1.19.4 graphics baseline | Forwarded baseline | 1 |

The 1.20.6 worktree still lacks complete native 766 Play support; this follow-up does not certify that port. No newer metadata indices or respawn fields are added to older targets. The existing 1.16–1.18 decoder boolean was misleadingly named `copyMetadata`; it now exposes its actual native meaning.

## Native references

Compared the exact local client jars, not current-version source: Minecraft respawn code `ave.a(int)` (1.8.9), `bib.a(int)` (1.12.2), `cft.a(bod)` (1.13.2), ClientPacketListener `dkc.a(mk)` (1.14.4), `dnp.a(ob)` (1.15.2), `dwu.a(qp)` (1.16.5), `ejj.a(rv)` (1.17.1), `emt.a(tp)` (1.18.2), and `fdk.handleRespawn` (1.19.4). The 1.19.4 reference is client SHA-1 `958928a560c9167687bea0cefeb7375da1e552a8` with official mappings `f14771b764f943c154d3a6fcb47694477e328148`.

Also compared Player constructor/shared-spawn positioning, LocalPlayer.resetPos and hurtTo, attribute copying and native max-health definitions. The 1.19.4 historical Wiki page was restricted during this follow-up; release-specific code establishes these retention details. No unavailable Wiki text is marked verified.

## Validation

- `node --test tools/test-respawn-player.mjs`: all four retention combinations, target-native Game handler policy, independent copies, movement/use/effect/inventory reset, spawn/angles, native metadata indices, health modifier operations/range and first health synchronization.
- Focused respawn/camera/riding regressions and browser-bundle compilation pass on all ten worktrees (14–18 tests per target). The native 1.16.5 protocol suite passes all ten tests on that target. Its inherited identity test is intentionally specific to protocol 754 and is not a later-target identity check.
- The 1.19.4 selected native audit passes 320 tests, zero failures/skips, in 53 files.
- `tools/port-1.19.4/probe-respawn.mjs` against the owned isolated pinned vanilla fixture passes: dimension transfer sends flags 3 and retains max health 40 / movement-speed base .3; death sends flags 0 and restores defaults. Both replace the body and clear old effects/velocity. The following initial health update produces no invented hurt flash.

Server snapshots are taken during Respawn before subsequent authoritative position, inventory, effects and attributes. Server normal paths exercise flags 0/3; independent flags 1/2 have wire/Game regressions and native-source comparison. The supplied webmc transfer capture is not a complete browser replay, and no blanket proxy-transfer acceptance is claimed. No distributions were rebuilt in this batch.
