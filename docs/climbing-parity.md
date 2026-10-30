# Climbable vegetation

`LivingEntity.onClimbable` in the pinned 1.16.5/1.17.1/1.18.2 native jars
checks `BlockTags.CLIMBABLE` before the trapdoor-above-ladder exception. Player
movement now follows that tag, including synchronized server replacements.
An empty or modified server tag does not silently fall back to built-in names.
Standalone worlds use the already extracted native default tag.

1.16.5 includes both tip and stem blocks of twisting and weeping vines.
1.17.1 and 1.18.2 also include cave-vine tips and stems, with or without berries.
Hanging roots, glow lichen, kelp and Nether roots are not made climbable.
Native movement already supplies jump climbing, wall-assisted ascent, crouch
holding, horizontal/downward speed limits and fall-distance reset; recognizing
the missing blocks now applies those mechanics to the new vines too.

Regression tests check tag membership directly against each SHA-1-pinned jar,
all target-native climbable blocks, non-climbable plants, spectator exclusion,
unsupported-vine jump ascent, crouch holding, descent limits and server changes.
The 1.8.9 through 1.15.2 targets were reviewed: these new vines do not exist
there, so no newer vegetation or synchronized climbable-tag feature is added.

Release history references: [twisting vines](https://minecraft.wiki/w/Twisting_vines),
[weeping vines](https://minecraft.wiki/w/Weeping_vines), and
[cave vines](https://minecraft.wiki/w/Cave_vines). Native jar tags/source decide
membership for each target rather than the present-day Wiki contents.
