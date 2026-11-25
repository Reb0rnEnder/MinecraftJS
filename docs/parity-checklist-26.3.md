# Full-parity checklist: 26.3

Generated from [transition-26.3.tasks.json](transition-26.3.tasks.json). Updated 2026-11-25.

Full parity is **not** claimed. This checklist starts empty on purpose: a milestone enters it only with
acceptance evidence from a native run, not because a table or model exists.

## Accepted

| Area | Scope accepted |
| --- | --- |
| Native inputs (P00) | SHA-1 and size match for metadata, client and server; embedded version identity (protocol 777, world 5023, packs 97.1/121.0, Java 25); unobfuscated layout proven. |
| Native reports (P02) | Reproducible blocks/items/components/registries/commands/packets reports recorded in `tools/port-26.3/baseline.json`; every phase contiguous from zero. |

## Partial

| Area | Open part |
| --- | --- |
| P02 extraction | Reports exist; client data tables (`client/data/*.json`) are still the 1.20.6 generation and are not yet rebuilt from 26.3. |
| Everything from P03 on | Not started in this branch. |

## Missing (inherited from 1.20.6)

Inventory action edge cases, authenticated sessions, resource packs/fonts beyond defaults, chat/commands
families, several presentation families, and the inherited 1.19.4 gaps. These are carried by P14 and are
not closed by the version jump.

## Unverified

- Nothing in this branch has been exercised against a live 26.3 server or in a browser yet.
- No 26.3 client build, join, render or interaction test has run.

## Out of scope

Integrated singleplayer/world creation and Realms remain separate missing products, exactly as on 1.20.6.
