# Piston, team-dispatch and OptiFine GUI corrections

The supplied text capture shows scoreboard rows containing just entry identifiers
and border glyphs, with no teams attached. The 1.15.2 codec decoded a native team
packet as `scoreboard_team`, then overwrote that runtime dispatch name with the
schema name `teams`. The game had no `on_teams` handler. Preserve the decoded name
when remapping packet IDs. This restores team prefix/suffix text, team colors and
server collision rules. A wire-level test covers decoding through game dispatch.
The four chat packets retained in the capture contain complete formatted strings;
this capture does not establish a separate chat glyph-rendering failure.

Flattened piston retraction still constructed head/base states with legacy bit
arithmetic, selecting unrelated states including fire. It now resolves native
state properties, including direction/type/extended. Piston heads were also hidden
by the no-model list and the generic `_head` skull-name suffix. Actual skull names
are now explicit; 1.14/1.15 derive model eligibility from extracted native render
shape. Retracting collision heads keep their actual direction and sticky type.
Tests cover all six directions, both piston types, animation phases, and baking
visible geometry from the shipped models. These fixes apply to 1.13.2–1.15.2;
legacy metadata arithmetic remains appropriate on 1.8/1.12.

## OptiFine reference

Reference: the official `OptiFine_1.15.2_HD_U_G6.jar`, downloaded from
[OptiFine](https://optifine.net/adloadx?f=OptiFine_1.15.2_HD_U_G6.jar).
Inspected `GuiShaders`, `GuiShaderOptions`, `GuiSlotShaders`,
`GuiSliderShaderOption`, `TooltipManager` and `TooltipProviderShaderOptions`.
The jar and decompiler output are not distributed in this repository.

- Main list: width `screenWidth - 140`, top 30, bottom `height - 50`, row height
  16, row width `listWidth - 20`; OFF, internal renderer, then imported ZIPs.
- Eight 120×20 right controls begin at `(width - 130, 30)` with 20-pixel spacing.
  Features not implemented by this renderer remain disabled with explanatory
  tooltips. Disabled controls do not imply additional shader feature support.
- Folder/import, download, Done and Shader Options use G6 bottom-row coordinates.
  Browser adaptation: Shaders Folder imports ZIPs. Shift-click an imported pack,
  or press Delete on the selected pack, to remove it from the browser library.
- Option columns honor the pack declaration, increasing to keep at most nine
  rows. Columns are at most 200 pixels wide; controls start at y=30, spaced 20.
  Reset and Done use G6's 120-pixel buttons and `height / 6 + 179` baseline.
  Done/Escape applies changes; Shift-click resets an option, right-click reverses
  cycling. Shader sliders use the native hovered thumb texture row.
- Tooltips render after buttons, wait 700 ms with a 5-pixel motion threshold,
  and use the native 300×94 panel and line spacing. They remain above overlapping
  buttons. The world remains visible behind the in-game shader list.

Shared GUI and shader-library changes are backported to all five native branches.
