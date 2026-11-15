# Native scoreboard slot suggestions

2026-11-15. The Brigadier scoreboard-slot parser now exposes its native choices to suggestions instead of only validating complete input. The integration regression checks a server command tree, the below-name slot and all 16 team sidebar slots. It passes on all seven older supported Brigadier targets (1.13.2–1.19.4); their browser bundles pass.

These releases retain `belowName`. The newer `below_name` spelling is only enabled on 1.20.6, whose complete DisplaySlot enum is independently extracted and checked. [Versioned 1.20.2 history](https://minecraft.wiki/w/Java_Edition_1.20.2) and [scoreboard history](https://minecraft.wiki/w/Scoreboard#History) record that rename. Native static choices were already used by the older parser; this fix reuses them for its missing suggestions path.

Newer per-score display text and number-format fields are not backported. Native command execution/permission checks remain on the server. No distributions are rebuilt in this source batch.
