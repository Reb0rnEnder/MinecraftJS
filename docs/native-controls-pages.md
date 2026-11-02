# Native controls and key bindings pages

1.18.2 split Controls from Key Binds: native `ControlsScreen` (`een`) creates
Mouse Settings / Key Binds at height/6 - 12, Sneak / Sprint on the next row,
Auto-Jump on the following row and Done one row below. `KeyBindsScreen` (`eep`)
contains the binding list and Reset Keys / Done footer. `KeyBindsList` (`eeo`)
starts at y=20 with 20-pixel rows and a 32-pixel bottom margin.

1.19.4 (`etu`, `etw`, `etv`) retains that layout and adds Operator Items Tab next
to Auto-Jump. The latter option is not backported. Native 1.17.1 `ControlsScreen`
(`ebi`) still combines the binding list and top Mouse Settings / Auto-Jump row;
that version and older branches retain their native combined page.

Verified against SHA-1-pinned native jars and official mappings using CFR, and
with `tools/test-controls-pages.mjs`. Opening Key Binds keeps Controls as its
parent, so Done returns to the correct page.
