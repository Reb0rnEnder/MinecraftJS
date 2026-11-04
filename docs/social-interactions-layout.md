# Social Interactions native layout

Checked exact native client sources for all applicable supported targets: 1.16.5 dsc/dsb/drz, 1.17.1 eec/eeb/edz, 1.18.2 ehm/ehl/ehj and 1.19.4 exh/exg/exe, plus native AbstractSelectionList. Evidence is extracted locally under cache/port-V/social-chat-src and social-chat-complete, using each version's client jar/mappings.

Corrected native geometry: 220-pixel row width centered with the list's two-pixel offset; 32-pixel row bodies on a 36-pixel stride starting at y=92; portrait/name/status/icon offsets; 73-pixel tabs placed from list bounds; scroll extent and scrollbar/dragging; offline portrait shade and query preservation across resize. Empty All no longer prints a missing translation key.

1.16.5–1.18.2 retain the native quantized 16-pixel panel height and unbordered 196x16 search field at y=78. 1.19.4 uses its continuous panel height, 18-pixel nine-slice body, bordered 198x13 field at y=75, shifted Manage button, self-first list ordering and dedicated Report icon alongside Hide/Show. The Report icon remains disabled with the native service-unavailable explanation: this client does not implement authenticated report submission. It is not a working-reporting claim.

Version boundary: Social Interactions was introduced in 1.16.4; no screen or key binding is added to 1.15.2 or earlier. 1.19 reporting rows are not added to 1.18.2. See Minecraft Wiki Social Interactions history and Minecraft Java 1.19.4 release notes for version context; exact pixel rules above come from the native jar, not the current Wiki page.

Tests cover target-specific dimensions/search, row gaps and text/icon placement, self-first versus alphabetical ordering, actual hide/show clicks, scrollbar bounds/dragging and existing account-blocking behavior (10 passing tests per applicable version).

Still open: native reference screenshot comparison, full keyboard/narrator treatment of icon rows, signed-message history/offline entry retention/recent-message sorting, and authenticated reporting. This is a geometry/interaction correction, not a claim of complete social/chat parity.
