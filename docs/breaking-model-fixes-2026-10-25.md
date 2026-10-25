# Breaking overlays follow the rendered model

The old damage pass drew a six-face cube scaled to the selection box. This
put cracks across empty space within stairs, fences and other non-cube blocks.
The new pass resolves the same weighted/multipart model as terrain meshing,
retains the baked face geometry/UV orientation, remaps its texture coordinates
to the damage sprite, and uses the same exposed-face tests and plant offsets.
Selection outlines keep using their selection geometry independently.

Chests, signs, skulls, banners, beds and shulker boxes use the live block-entity
model, including animated lid/cloth transforms and both halves of large chests.
Sign lettering and beam effects are excluded from the damage surfaces. Model
texture dimensions preserve the damage texture scaling; model meshes keep their
CPU geometry for this pass.

Local and remote breaking both pass the actual block state. Static geometry is
reused across damage stages and rebuilt when its model or visible faces change.
Resource-pack/world resets destroy its GPU mesh and resolve the current model
store again. The existing lightmap, multiplicative blend and polygon offset
remain in use. All three supported versions receive the adapted fix.

Regression coverage uses each version's real jar models for stairs, slabs,
levers, fences, flowers and native turtle eggs. It checks positions and UVs,
face changes, cache reuse/reload disposal, animated and double chests, local and
remote progress, and the renderer's stage/model transform handling. Full suites
and production builds are checked for each version.
