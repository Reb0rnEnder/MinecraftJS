# Chat regression fixture audit

The previously reported 1.19.4 chat-hover failures were stale test fixtures, rather than established missing product behavior. The test's version whitelist stopped at 1.16.5: newer targets received pre-1.13 numeric enchantment IDs, pre-1.14 non-JSON lore and a pre-1.16 chat hit-test baseline. Each now gets its native item metadata and HUD origin. Tests cover enchantment/lore tooltips and nested translated hover spans across wrapping. No compatibility rewrite of newer item NBT was added to make an obsolete fixture pass.

The UI test similarly assumed pre-1.15 button hover colors and a fixed-row Chat Settings screen for newer scrolling option-list releases. It now checks native colors and the correct per-target widget collection/list bounds. The completion narrator fixture supplies the input state its selection handler actually consumes. Existing narrator assertions remain enabled on their original targets.

Both corrected regression files pass on all nine supported targets. This does not add 1.19 trust indicators to older clients and is not a claim that signed-chat/reporting is complete. In particular, native 1.16.5–1.18.2 ChatComponent spacing/source formulas differ from 1.19.4 and were preserved.
