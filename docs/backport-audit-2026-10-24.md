# Backport audit — 2026-10-24

Compared the current 1.13.2 worktree with `1.12.2` at `ab11987` and `1.8.9`
at `61d9a9e`, after fetching origin. The older branches were inspected without
editing or switching their checkouts. This is a targeted review of fixes made
during the current migration and the recent shared history, not a certification
that every historical change has been backported.

## Confirmed shared fixes missing from older branches

| Fix present in 1.13.2 | 1.12.2 | 1.8.9 | Evidence / consequence |
| --- | --- | --- | --- |
| Deep-copy stack NBT and raw NBT bytes | Missing | Missing | Runtime probe: changing the copy's nested display name also changes the source stack. `game/container.js`, `copy`. |
| Compare structured NBT, including numeric tag types and compound/list values | Missing | Missing | Runtime probe: differently named stacks with typed NBT but no `nbtRaw` incorrectly compare as stackable. Keep legacy item damage/metadata comparisons when porting. |
| Respect JSON style resets, inherited styles and string `false` in chat | Missing | Missing | Runtime probe: `{text:'text',bold:'false'}` incorrectly emits bold formatting on both older branches. `gui/chat.js`. |
| Keep network inventory results authoritative | Missing | Missing | Runtime probe: `Inventory.setAll` calls local recipe prediction on both older branches; the 1.13.2 setter does not. Port the inbound setters while retaining legitimate local click prediction, especially for 1.8.9 servers that do not echo accepted clicks. |
| Keep invisible bodies separate from equipped items and handle visibility changes on skipped LOD frames | Missing | Missing | Source review: older renderers cull invisible mobs and skip poses without a visibility-state check. The current renderer has independently controlled body drawables and `wasInvisible` handling. Needs version-specific rendering tests when ported. |
| Defer hand-skin invalidation until a safe render boundary | Present | Missing | `ab11987` (1.12.2) / `188fee8` (1.13.2) contain the same fix; 1.8.9 still calls `handRenderer.reset()` directly from skin rebuilds. |

The first four findings are executable behavior probes; the final two combine
source inspection with history. Reproduce with:

```sh
node tools/audit-backports.mjs
```

`true` means the checked fix is present. The script extracts read-only Git
snapshots into the system temporary directory and checks the working tree too.
It does not cherry-pick, commit, push, or alter either older branch.

## Additional source-reviewed candidates

- Slot merging now checks slot validity and per-slot limits before merging or
  filling empty slots. The older branches retain the earlier merge logic.
- The item block-mesh cache now includes resolved model identity and item tint
  identity, avoiding meshes shared between distinct models with equal quad counts.
- Creative barrier markers and their immediate item/block-state lifecycle checks
  are absent from both older clients' local ambience pass. Their server particle
  ID 35 is correct for those versions; do **not** copy the 1.13 particle IDs.

These candidates require adapted tests against each version's jar before backporting.

## Changes that should stay version-specific

- Flattened block/item/entity IDs, native 1.13 sound/particle registries, and native
  protocol404 payload layouts belong to 1.13.2. Older IDs are not regressions.
- Riptide, held tridents, swimming strokes, waterlogging, blue ice, conduits and
  aquatic mobs do not belong in 1.8.9 or 1.12.2.
- The Brigadier suggestion popup and automatic slash-command suggestions are
  1.13 behavior. Older clients' Tab completion needs their own protocol/UI.
- Narrator/tutorial/toasts, advancements and other features introduced after
  1.8.9 should not be treated as missing 1.8.9 backports.
- Several changes have separate backport commits with different hashes. For
  example, shader, spectator, demo, resource-pack and command-screen work has
  corresponding 1.8.9 commits; `git cherry` alone overstates the missing work.

## Publication scope

This request publishes the accumulated, tested 1.13.2 migration/fixes and this
audit. It investigates backports; it does not change or push the older branches.
Generated `dist/` and Mojang assets remain ignored, as configured by the repository.
