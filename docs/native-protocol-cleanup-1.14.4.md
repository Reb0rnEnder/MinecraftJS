# Creative search, accessibility and native protocol cleanup

The Search tab was empty because the new native creative extractor skipped its
fillItemList call along with the intentionally empty hotbar/inventory tabs.
Search now invokes the native implementation and contains all 1,127 stacks,
including search-only item/enchantment variants. The UI test covers opening the
tab, name/tag filtering, clearing the query and switching away/back.

The title accessibility control now draws the complete native 20×20 button from
`gui/accessibility.png` at UV (0,0), or (0,20) when hovered/focused, using the
32×64 sheet. The old 16×16 icon crop and separate widget background were incorrect.

The active codec no longer imports a 1.13.2 codec or remaps its packet IDs.
`packets-1.13.2.js` and `protocol-1.14.4-reuse.js` are removed. Native serverbound
encoders use the pinned 498 names/IDs directly; unchanged clientbound field
readers now register by their native names in `packet-bodies-1.14.4.js`. Existing
internal Game event aliases remain so handlers keep receiving the expected
fields. Native packed positions, metadata, particle and changed-packet readers
remain in `protocol-1.14.4.js`. Schema ID regeneration no longer emits a reuse map.

Obsolete MC plugin-channel aliases, trade/book/stop-sound custom-payload handlers
and the unused old merchant screen are removed. Brand uses `minecraft:brand`;
invalid legacy channel names are rejected. Anvil rename and beacon actions now
use their dedicated string/VarInt packets. Those two fixes are also backported
to protocol 404 in commit `a1f0990`; older clients retain their native plugin-channel behavior.
Saved 1.14 hotbars now accept the full native item range through ID 876.

Validation: 136 target/shared checks pass; one optional external endpoint test is
skipped. Browser rendering confirms the Search grid, filtering and repopulation.
An isolated vanilla 1.14.4 server accepted joining, crossbow charging, loading
and firing through the native codec. World rendering/mesh scheduling were
disabled only for that protocol test. The title control's exact UVs and dimensions
and native brand/anvil/beacon packet bytes have dedicated regression coverage.

The reported cat failure came from the proxy process retaining its old 83-model
bundle in memory. The current rebuilt bundle has 87 models including cat; no
cat fallback was introduced. Restart the existing proxy to use its current code
and rebuilt assets. The user's proxy/server were not stopped by these checks.
