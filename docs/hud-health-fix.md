# Hearts and hunger restoration

In 1.14.4, player absorption is metadata index 13. Index 17 holds shoulder NBT.
The HUD retained the 1.8.9 absorption index and added an NBT object to max health,
producing an invalid heart-loop bound and drawing no hearts. The HUD now resolves
the native player absorption field through metadata extracted from the pinned
jar; player fields are included in the native metadata extraction.

The native respawn decoder also returned `gameMode` while the Game handler read
`gamemode`. After death, dimension transfer or a proxy respawn this set the local
game mode to undefined, hiding both survival bars. The decoder now uses the
handler's field name. Respawn preserves difficulty because protocol 498 does
not include it. A fresh Join Game clears old player metadata/max-health state.

The absorption-index correction is backported to 1.13.2 and 1.12.2 (index 11).
Their respawn field already matches the handler. 1.8.9 correctly retains index 17.

Tests exercise actual HUD drawing with shoulder NBT, normal and absorption
hearts, hunger, and survival/adventure modes; native respawn packets pass
through the decoder and Game handler repeatedly. Expanded suites: 140 checks
pass on 1.14.4, 226 on 1.13.2 and 65 on 1.12.2; each skips one optional external
endpoint check.
