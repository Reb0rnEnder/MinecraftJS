# Native wolf collar and metadata backport

2026-11-15. The missing collar overlay now follows native tame/invisibility state and the actual animated model. Health-based tails retain zero health and prioritize anger. These fixes apply to all nine older targets; modern Paws content is not backported.

Native metadata is regenerated on 1.14.4–1.19.4 by `tools/wolf-metadata.mjs` using each pinned jar/mappings. 1.15's removed wolf-health accessor and 1.16's anger-time insertion no longer corrupt collar/interest fields. Partial updates retain prior collar state. Native sitting rear-leg height stays 22px through 1.14.4 and is corrected to 22.7px on 1.15.2 and later. The six native regeneration checks pass.

1.8.9/1.12.2 retain reversed dye-damage IDs; flattened targets retain white-first dye IDs. 1.8.9 uses the native sheep color table and orange default collar (the later correction is not backported). Its fixed-20 tail rule is preserved; 1.12.2–1.19.4 keep the absolute health deficit. The 1.20.6 ratio/40-health behavior, variants, armor, body slot, Armadillo and experimental entities stay on their applicable target.

Three regressions pass on this branch (27 across all nine): dye IDs/defaults, actual renderer metadata/invisibility/distant-pose transitions, zero-health/anger tails. Every browser entrypoint bundles. This source batch does not rebuild older distributions or certify full native parity.

Native legacy anchors: 1.8.9 `ua`/`blk`/`zd`/`tv`; 1.12.2 `aam`/`ccq`; 1.13.2 `akm`/`dcl`. Modern Wolf/WolfCollarLayer use official versioned mappings. Existing dye tables are native-extracted. [15w46a history](https://minecraft.wiki/w/Java_Edition_15w46a) records the default collar correction after 1.8; [1.20.5 history](https://minecraft.wiki/w/Java_Edition_1.20.5) distinguishes the later variants/armor/health rules. Direct Wiki pages were restricted; indexed history excerpts and exact jars were checked.
