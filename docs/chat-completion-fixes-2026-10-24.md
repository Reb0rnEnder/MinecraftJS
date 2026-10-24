# Chat completion fixes

Legacy Tab completion now preserves text after the cursor, positions the caret
after the inserted suggestion, keeps cycling usable, and rejects replies after
typing or moving the cursor. Existing server-driven completion and native legacy
UI remain in use.

The accompanying 1.13.2 changes decode the Brigadier command tree and block tags,
add argument colours and local syntax checks, and repair suggestion scrolling and
player-name suggestions. Brigadier and registry tags were introduced in 1.13 and
are not features of this older branch.

Validation: both completion regressions, the 24 shared client regressions, and a
production HTML build pass on this branch.
