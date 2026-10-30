# Dripleaf placement feedback

Failed placement must not report success, play a placement sound, swing the arm,
consume the held stack or create a predicted block. Native `BlockItem.place`
checks the candidate state's survival and collision before those success effects.

The native release difference is preserved:

- **1.17.1:** big dripleaf can stand on another big dripleaf/stem or a block whose
  top face passes `BlockState.isFaceSturdy`. This includes stone and top slabs,
  but excludes bottom slabs and farmland. The sturdy-top predicate is extracted
  from the exact client jar for every state; collision bounds are not substituted.
- **1.18.2:** big dripleaf uses `big_dripleaf_placeable`, in addition to dripleaf
  tips/stems. Dirt-family blocks, clay, moss and farmland qualify by default;
  stone and sand do not. Synchronized server tag changes are honored.
- Small dripleaf can use its placeable tag, or dirt/farmland while its target cell
  contains water. The second cell must be replaceable and inside world height.

Native classes checked in both jars: `BlockItem`, `BigDripleafBlock`,
`BigDripleafStemBlock` and `SmallDripleafBlock`, with official mappings.
Regression fixtures cover the release difference, partial support shapes, wet/dry
support, upper obstruction/height, server tags and the actual failed right-click
feedback path. Dripleaf does not exist in supported releases before 1.17, so its
placement feature and assets are not backported there.

Historical reference: [Big Dripleaf](https://minecraft.wiki/w/Big_Dripleaf).
