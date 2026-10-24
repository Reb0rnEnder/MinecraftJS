# Backport audit — 2026-10-24

Compared the current 1.13.2 worktree with `1.12.2` at `ab11987` and `1.8.9`
at `61d9a9e`, after fetching origin. The initial investigation inspected older branches without editing them. The
follow-up request applied and tested the shared backports in separate worktrees. This is a targeted review of fixes made
during the current migration and the recent shared history, not a certification
that every historical change has been backported.

## Shared fixes found missing and now backported

The evidence column records the original failure. All rows now have version-specific regression coverage in `tools/test-client-regressions.mjs`.

| Fix present in 1.13.2 | 1.12.2 | 1.8.9 | Evidence / consequence |
| --- | --- | --- | --- |
| Deep-copy stack NBT and raw NBT bytes | Backported | Backported | Runtime probe: changing the copy's nested display name also changes the source stack. `game/container.js`, `copy`. |
| Compare structured NBT, including numeric tag types and compound/list values | Backported | Backported | Runtime probe: differently named stacks with typed NBT but no `nbtRaw` incorrectly compare as stackable. Keep legacy item damage/metadata comparisons when porting. |
| Respect JSON style resets, inherited styles and string `false` in chat | Backported | Backported | Runtime probe: `{text:'text',bold:'false'}` incorrectly emits bold formatting on both older branches. `gui/chat.js`. |
| Keep network inventory results authoritative | Backported | Backported | Runtime probe: `Inventory.setAll` calls local recipe prediction on both older branches; the 1.13.2 setter does not. Port the inbound setters while retaining legitimate local click prediction, especially for 1.8.9 servers that do not echo accepted clicks. |
| Keep invisible bodies separate from equipped items and handle visibility changes on skipped LOD frames | Backported | Backported | Source review: older renderers cull invisible mobs and skip poses without a visibility-state check. The current renderer has independently controlled body drawables and `wasInvisible` handling. Now covered by visibility changes during skipped LOD frames on each client. |
| Defer hand-skin invalidation until a safe render boundary | Present | Backported | `ab11987` (1.12.2) / `188fee8` (1.13.2) contain the same fix; 1.8.9 previously called `handRenderer.reset()` directly; it now defers invalidation until `prepare`. |

The initial findings combined executable behavior probes, source inspection and history. The follow-up shared regression suite exercises the backported behavior on all three clients. Reproduce with:

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

These candidates are now backported and exercised by `tools/test-client-regressions.mjs` against each version's jar.

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

The follow-up publishes adapted fixes on all three version branches. Version-specific IDs, swimming, tridents and elytra remain restricted to the versions that contain them.
Generated `dist/` and Mojang assets remain ignored, as configured by the repository.
