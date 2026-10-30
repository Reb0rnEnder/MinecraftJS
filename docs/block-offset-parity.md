# Native model and shape offsets

Offset policies now come from each matching client jar. The mesher and damage
renderer use the native enum, float division, horizontal clamp and vertical
range. This restores double plants and several flattened/new plants, bamboo,
dripleaf, hanging roots and pointed dripstone, and removes the incorrect offset
from mushrooms. Pointed dripstone clamps horizontal movement to 0.125 blocks;
small dripleaf uses its native 0.1 vertical range.

Native shape methods are sampled at two positions to determine whether their
selection/collision shapes actually follow the model offset. Only those shapes
receive the difference from their extraction-origin offset when queried. Bamboo
and dripstone collision, placement checks, selection and camera rays therefore
match the rendered block. Several native plant selection shapes deliberately
remain stationary even though their models move; those differences are retained.

Version differences remain native: 1.8.9's position seed includes Y, whereas the
later targets use Y=0 for offsets. Four offset block definitions are extracted in
1.8.9/1.12.2, 19 in 1.13.2, 24 in 1.14.4/1.15.2, 27 in 1.16.5 and 30 in 1.17.1.
Every supported version is covered. No newer blocks are added to older targets.

`ExtractBlockOffsets.java` uses official mappings on modern targets;
`ExtractLegacyOffsets.java` executes the pinned older enum/vector/hash methods
with the aliases already used by shape extraction. Modern runtime generation
runs `extract-block-offsets.mjs`; legacy shape extraction runs the corresponding
legacy wrapper with its dependency classpath. Incomplete registry coverage or
an unsupported position-dependent shape fails extraction.

`test-block-offsets.mjs` compares native samples at positive, negative and world
border coordinates, checks the version's Y rule, and exercises selection and
world collision translation. All seven targets pass. The existing older-client
regression suites pass too. A related correction on 1.14.4+ prevents fluid/camera
ray queries from appending fluid boxes into cached collision-shape arrays.
