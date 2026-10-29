# Explosion audio and fire targeting

All six clients now play the native explosion-packet sound at its supplied
position, including zero-block-damage explosions: volume 4, block category and
pitch `(1 + (random - random) * .2) * .7`. The 1.8.9 client uses `random.explode`;
later versions use `entity.generic.explode`. Existing block updates, knockback
and particles are preserved. The missing call was in the game packet handler,
so complete sound assets alone did not make explosions audible.

In 1.16.5, ordinary fire and soul fire use the extracted native selection shape.
A hardcoded fire exclusion had skipped that shape and let clicks reach the
supporting block. Direct fire removal leaves the support intact and lets the
server's native extinguish event provide the sound, without generic block-break
sound/particles. The older versions' extracted fire selection is empty and their
adjacent-fire extinguish behavior is retained; the 1.16 shape is not backported.

Native 1.16.5 ScreenEffectRenderer always uses ModelBakery.FIRE_1 for the
first-person burning overlay. Soul fire therefore retains the orange overlay;
local soul-fire contact is now recognized by the existing burning detection.
No blue overlay texture is substituted.

`tools/test-explosion-playback.mjs` checks audio, coordinates, zero-damage cases,
knockback and block changes in every checkout. The 1.16.5 fire-targeting regression
also checks native ray hits, support preservation in Creative/Survival, and the
ordinary fire atlas entry while touching soul fire. These behaviors were checked
against the pinned native Explosion, BaseFireBlock and ScreenEffectRenderer code.

The earlier 32-bit padded-palette optimization remains on 1.16.5. Older versions
already use word-based decoders for their different palette layout. Shared audio
and rider-cleanup fixes remain backported to all versions where they apply.
