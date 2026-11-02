# Projectile correction and applicable backport audit

Thrown sprites previously selected old numeric object IDs after 1.14 switched
spawn packets to the unified entity registry. Select the decoded canonical
identity on 1.13.2–1.18.2, including potion metadata/tint, fireball variants and
the dedicated wither-skull model. 1.13.2 already had matching old object IDs;
the identity lookup remains compatible. 1.8.9 and 1.12.2 retain their native object
IDs and potion differences; no later entity or item is added there.

`tools/test-projectile-rendering.mjs` spawns each projectile through the real
EntityManager using the target registry and builds its actual renderer with
native extracted models: pearl, egg, snowball, eye, bottle, potion, fireball,
small fireball, fireworks and wither skull. No test substitutes a modern entity's
wire ID with the old ID. The old versions receive regression coverage too.

Native reference: 1.18.2 official client mappings and CFR output for
EntityRenderers (`evl`), ThrownItemRenderer (`exs`), NoteBlock (`cij`). The native
renderer registry selects renderer classes by EntityType. See also the historical
[1.14 protocol/entity change](https://minecraft.wiki/w/Java_Edition_1.14).

Note blocks already dispatch Use through the configured key binding. Native
NoteBlock.use advances the note and plays it; attack plays without tuning. Keep
both actions rather than removing vanilla attack behavior. Mojang also describes
[Use to tune](https://www.minecraft.net/pl-pl/article/block-week-note-block).
The server owns the resulting note/state/event.

## Backport verification

This audit covers the recent shared corrections: held-block face culling,
creative icon stability, sprint particles, paired-door prediction, loading,
chest/preview rendering, and each target's available camera, registry, compass,
attribute and growing-plant regression suites. 1.18-only creative effect layout
remains 1.18-only; pre-1.16 attribute keys and 1.16 native compass hashing remain
unchanged. Growing-plant mechanics begin at 1.16; cave vines at 1.17. Registry
namespace corrections begin with the dimension-codec versions. Existing named
branches are used throughout; this is not a claim that every historical parity
gap has been solved.

| Target | Projectile selection | Relevant assertions passing / failing |
| --- | --- | --- |
| 1.8.9 | legacy object IDs retained | 24 / 0 |
| 1.12.2 | legacy object IDs retained | 24 / 0 |
| 1.13.2 | canonical projectile identity | 25 / 0 |
| 1.14.4 | canonical projectile identity | 26 / 0 |
| 1.15.2 | canonical projectile identity | 27 / 0 |
| 1.16.5 | canonical projectile identity | 36 / 0 |
| 1.17.1 | canonical projectile identity | 36 / 0 |
| 1.18.2 | canonical projectile identity | 37 / 0 |

The older monolithic `test-client-regressions.mjs` also passes on 1.8.9–1.15.2.
On 1.16.5–1.18.2 it has 16/20/20 existing failures (old IDs, particle-sheet and
world/UI fixtures); running it against the unmodified renderer produces exactly
the same failing test names. Those are not reported as passing. The focused
native suites above pass. The loading fixture on 1.17.1/1.18.2 was supplied its
required Settings object; runtime loading behavior was not altered.
