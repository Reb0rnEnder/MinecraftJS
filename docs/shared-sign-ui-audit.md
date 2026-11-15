# Shared sign and version-specific GUI audit

Reviewed 2026-11-15 against each target's native renderer. Long sign messages must use the first wrapped 90px line in each of four rows. Their X position uses Java integer division; odd pixel widths must not shift half a pixel. Earlier renderers also added a non-native 0.001 depth offset. The shared layout helper fixes clipping/centering; 1.8.9–1.18.2 now use the native float text plane/scale. Existing dye, formatting and glow paths remain version-specific.

The actual placed-sign renderers are exercised, including long lines, embedded newlines, odd-width centering and text-plane coordinates. This audit batch has 138 passing scoped checks across 1.8.9–1.19.4, covering sign layout/lighting, controls and existing placement regressions. The 1.20.6 target suite additionally has 230 passing tests. Every browser entry bundles successfully. These are source/CPU validations; no live GPU, Java FPS or visual equivalence measurement is claimed.

Controls checks previously assumed the 1.15 screen structure. They now preserve the older direct key-binding list, the separate Key Binds screen introduced in 1.18, and each target's Accessibility layout. This is a test correction, not a layout change to otherwise correct older screens. Native 1.20.6 Controls still used the old height-relative grid: only that target now uses its native OptionsList/HeaderAndFooter layout and keeps the existing six controls in their native order.

Native sign sources (obfuscated class names; official mappings used where available):

| Version | Class | Verified client SHA-1 |
| --- | --- | --- |
| 1.8.9 | bhj | `3870888a6c3d349d3771a3e9d16c9bf5e076b908` |
| 1.12.2 | bxf | `0f275bc1547d01fa5f56ba34bdc87d981ee12daf` |
| 1.13.2 | cwh | `30bfe37a8db404db11c7edf02cb5165817afb4d9` |
| 1.14.4 | dpm | `8c325a0c5bd674dd747d6ebaa4c791fd363ad8a9` |
| 1.15.2 | dta | `e3f78cd16f9eb9a52307ed96ebec64241cc5b32d` |
| 1.16.5 | ecn | `37fd3c903861eeff3bc24b71eed48f828b5269c8` |
| 1.17.1 | epq | `8d9b65467c7913fcf6f5b2e729d44a1e00fde150` |
| 1.18.2 | eta | `2e9a3e3107cca00d6bc9c97bf7d149cae163ef21` |
| 1.19.4 | fkq | `958928a560c9167687bea0cefeb7375da1e552a8` |
| 1.20.6 | gge | `05b6f1c6b46a29d6ea82b4e0d42190e42402030f` |

Old source inspection uses the exact pinned client classes, not Java output invented by the tests. 1.19.4/1.20.6 hanging limits and text offsets stay release-specific. No later protocol field, GUI row or asset is introduced in earlier targets.

History cross-checks: [1.18 release notes](https://feedback.minecraft.net/hc/en-us/articles/4415128577293-Minecraft-Java-Edition-1-18) explicitly move Keybinds to a separate screen; [Options history](https://minecraft.wiki/w/Options) records that transition and the later 1.20.5 redesign; [1.20.5 release notes](https://www.minecraft.net/pl-pl/article/minecraft-java-edition-1-20-5) describe the new consistent UI layouts. Native render code is the authority for sign width, division and plane values.
