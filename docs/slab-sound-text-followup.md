# Slab prediction, air break sound and server text follow-up

2026-11-05. Work returned to the 1.19.4 regression fixes; 1.20.6 remains an early
transport port with its graphical 1.19.4 baseline and open transition plan.

## Slabs

The prediction allowlist rejected any non-axis state property, including slab
`type` and `waterlogged`. Thus even the existing half-selection code never
rendered slabs locally, and matching slabs had no merging path. Slabs now predict
the resulting state immediately, test the actual resulting collision volume,
and retain server corrections. Matching single slabs merge; double slabs and
unmatched materials are not overwritten. New source-water slabs waterlog;
merging clears waterlogging. Sneaking does not disable native slab merging.

Native pre-flattening ItemSlab uses Up/Down for clicked-cell merging, with
metadata variants and paired double-slab blocks. Java 1.13.2+ SlabBlock also
uses the empty half for side clicks and supports waterlogging. The backports
preserve this difference; no waterlogging or later slab types enter 1.8/1.12.

Exact native classes inspected: 1.8.9 aau, 1.12.2 ajs; 1.13.2 bhl;
1.14.4 brr; 1.15.2 buf; 1.16.5 bzw; 1.17.1 cfw; 1.18.2 cjx; 1.19.4 cwh.
The [Wiki slab description/history](https://minecraft.wiki/w/Slab) was checked
alongside those release-native implementations.

The isolated 1.19.4 vanilla server accepted four exact locally predicted states:
bottom, double, top and waterlogged bottom slab. All four sequence acknowledgements
completed without reverting the predictions; each emitted one local placement
sound. Reproduce with run-presentation-fixture.mjs and probe-slab-prediction.mjs
under tools/port-1.19.4. It binds a fresh world to loopback port 25567 and the
probe refuses commands on any other server. This is a network/state test, not a
graphical screenshot comparison. Other context-dependent placement families
remain governed by their existing support and prediction checks.

## Extra stone sound

An air state in break event 2001 reached the stone sound-type fallback. Native
code skips that sound, so air/cave-air/void-air now stay silent. Exact event
handlers checked include native 1.8.9 bfr, 1.12.2 buy, 1.13.2 cue and 1.19.4 fie.
Real wood breaks still play their wood sound. No time-based duplicate suppression
was added: that would discard legitimate nearby players' sounds. The user
identified webmc as the affected server; its authenticated game-mode audio has
not been captured, so this fixes a concrete extra-stone-sound path without
claiming every webmc-specific sound event was reproduced.

## Translation fallback (1.19.4 and newer only)

The [1.19.4 history](https://minecraft.wiki/w/Java_Edition_1.19.4) added fallback
strings for translatable components. Native TranslatableContents (ut) was checked;
a native JVM oracle confirmed fallback formatting and malformed-template behavior.
The renderer now honors unknown-key fallbacks in death messages, chat, plain-text
comparisons and interactive hover/click segments, while known language entries
win. Missing/invalid placeholders retain the whole native template. Numeric
language-file placeholder normalization is separate from server fallback text.

This can explain a server's `<chat=uuid>` translation key appearing instead of
its supplied fallback name. The specific raw webmc death packet has not been
captured; literal tags are deliberately preserved rather than removed by regex.
Older clients keep their native behavior and do not gain this newer JSON field.

If the tag remains, capture the raw message locally before dying:

```js
var tc = (await import('/js/debug/text-capture.js')).captureText(game);
// After reproducing:
tc.download(); tc.stop();
```

The shared bounded text capture now includes death/combat messages and preserves
the raw component alongside formatted output. No credentials are included.

## Checks and scope

Targeted placement/sound/door/text-capture suite: 208 passes across ten worktrees
(19 each on 1.8/1.12, 21 each on 1.13–1.18, 22 each on 1.19/1.20).
All ten browser entry points bundle successfully. The 1.19.4 chat/hover/trust/
text-capture suite additionally passed 36 tests before the final capture extension.
These checks do not certify full parity or resolve the floating-boat jitter
recorded in boat-camera-followup.md. Existing user worlds/configs/captures are
preserved. No distributions were rebuilt in this fix batch.
