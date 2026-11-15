# Jigsaw editor parity audit

2026-11-15. This fixes a screen inherited from 1.14 that remained unchanged even after its native fields and serverbound packet changed. Newer clients read obsolete NBT keys and sent the attachment/pool/final-state strings into the name/target/pool arguments. Native generation controls were absent.

## Native references

Every target uses its existing branch/worktree and its own SHA-1-verified client jar and official mappings. The mapped `JigsawBlockEditScreen`, `ServerboundSetJigsawBlockPacket`, `ServerboundJigsawGeneratePacket`, `ResourceLocation`, and `AbstractSliderButton` were compared. Layout constants were reviewed in native bytecode/decompilation; the native GUI was not run as a graphical Java application.

| Target | Native client SHA-1 | Screen class | Native controls |
| --- | --- | --- | --- |
| 1.14.4 | `8c325a0c5bd674dd747d6ebaa4c791fd363ad8a9` | `dec` | Three fields; no generation controls |
| 1.15.2 | `e3f78cd16f9eb9a52307ed96ebec64241cc5b32d` | `dhs` | Three fields; no generation controls |
| 1.16.5 | `37fd3c903861eeff3bc24b71eed48f828b5269c8` | `dqn` | Four resource/state fields, levels 0–7 |
| 1.17.1 | `8d9b65467c7913fcf6f5b2e729d44a1e00fde150` | `ecl` | Four resource/state fields, levels 0–7 |
| 1.18.2 | `2e9a3e3107cca00d6bc9c97bf7d149cae163ef21` | `efs` | Four resource/state fields, levels 0–7 |
| 1.19.4 | `958928a560c9167687bea0cefeb7375da1e552a8` | `evc` | Four resource/state fields, levels 0–7 |
| 1.20.6 | `05b6f1c6b46a29d6ea82b4e0d42190e42402030f` | `fpg` | Four resource/state fields, priorities, levels 0–20 |

The [1.16 history](https://minecraft.wiki/w/Java_Edition_1.16) records the split from `attachement_type` into `name` and `target`, joint selection and Keep Jigsaws/generation. The [official 23w43a notes](https://www.minecraft.net/fr-fr/article/minecraft-snapshot-23w43a) record the two priority inputs, introduced in the 1.20.3 cycle. Those inputs and packet fields are included only in 1.20.6 among the supported targets. No jigsaw feature is added to 1.8.9, 1.12.2 or 1.13.2.

## Corrected behavior

- Native NBT field names, resource normalization, initial/edit limits, field/label positions and Done/Cancel positions. Empty final states and empty resource paths remain legal, as in native ResourceLocation; invalid resource names disable Done.
- 1.14.4/1.15.2 retain the native `attachement_type` spelling and the attachment/pool/final-state wire order. Their field limits are 128/128/256 characters and their buttons are at y=210.
- 1.16.5 onward use name/target/pool/final-state/joint wire order. Joint is shown only for a vertical front direction; invalid/missing joint NBT uses native orientation fallback. Levels and Keep Jigsaws (default true) are supplied to Generate after saving and closing.
- 1.16.5 retains its native enabled Generate button when a resource field is invalid; attempting generation then raises the native-equivalent resource validation error. From 1.17.1 Generate is disabled along with Done.
- 1.20.6 selection and placement priorities are independent three-character fields, serialized selection first and placement second, with Integer.parseInt failure returning zero. Native escaping is retained in its resource error messages. The higher generation level limit remains target-specific.
- Cancel/Escape send nothing. Enter respects the focused button. Mouse focus, resized edits, levels, joint and keep state are retained. Native modern slider Enter/Space editing mode and float keyboard steps are preserved; slider clicks sound on release. Priority tooltips render after widgets.

## Reproducible validation

`tools/ExtractJigsawParity.java` runs the actual native ResourceLocation validation and native packet constructors/writers. `tools/jigsaw-fixtures.mjs` verifies jar/mapping hashes, then writes or checks `tools/fixtures/jigsaw-native.json`. Across seven targets, the fixtures contain **119 resource cases and 42 Java-produced packet bodies**, plus 14 native integer cases on 1.20.6. JS regressions compare the real packet builders and screen save/generate paths to those bodies, with each target's packet IDs.

Run `npm run test:jigsaw` on each 1.14.4–1.19.4 worktree. On 1.20.6 the fixture check and regression suite are part of `npm run test:1.20.6` (a JDK with javac/javap is needed for the other existing native gates). All six older targets pass **93 jigsaw/Controls tests** combined; all seven browser entrypoints bundle successfully. The complete 1.20.6 native-data/test gate passes **242 tests, zero failures/skips**.

Live graphical Java/browser comparison and server-side generation acceptance remain open. This is a validated implementation batch, not certification of full client parity. Distribution HTML/manifest/checksums were not rebuilt by this batch.
