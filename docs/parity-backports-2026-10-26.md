# Shared parity fixes — 2026-10-26

These fixes were found during the 1.14.4 audit and adapted to protocol 404:

- Note-block events carry zero event bytes; resolve instrument and pitch from the block state. The six 1.14 instruments are not added here.
- Replace legacy numeric enchantment arguments with native names and use the 1.9+ Sharpness formula in melee prediction.
- Resolve held bow/map models by registry name and filled-map identity from NBT.
- Save writable books through the native edit-book packet, including signing and hand selection; preserve the 1.13 page limit.
- Send native command-block, command-minecart and structure packets with target IDs/enums/flags. Read the conditional block property rather than legacy state bits.

Validation: 223 tests pass, one optional external-endpoint test is skipped. This includes packet round trips, existing entity/item/GUI regressions and the crash-screen browser test using a separately installed Playwright. No 1.14 content, new menus, crawling, crossbows, particle format or registry IDs were backported.

The Sharpness formula correction also applies to 1.12.2. Minecraft 1.8.9 retains its native 1.25-per-level formula.
