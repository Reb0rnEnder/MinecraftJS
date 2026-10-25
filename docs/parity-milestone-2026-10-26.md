# Native gameplay parity milestone — 2026-10-26

Implementation and remaining scope are recorded in the [feature audit](feature-audit-1.14.4.md) and [patch review](patch-audit-1.14.1-1.14.4.md). This is a development milestone; no full-parity release is certified.

Applicable shared fixes were adapted to older target jars:

| Target | Commit | Scope | Validation |
| --- | --- | --- | --- |
| 1.13.2 | `8d0d941` | Native note state events, named enchantments, held maps/bows, native book editing and technical editor packets | 223 checks pass; one optional external endpoint skipped |
| 1.12.2 | `d7a42b2` | Post-1.9 Sharpness prediction formula | 63 checks pass; one optional external endpoint skipped |
| 1.8.9 | unchanged | Its native Sharpness formula differs; protocol-404 editor changes and flattened item fixes do not apply | Existing artifact retained |

New 1.14 content, metadata layouts, particle JSON format, crossbows, crawling and new menus remain exclusive to 1.14.4. The 1.13.2 book retains its native page limit. No server-owned AI or generation changes are simulated by these backports.

Target validation: 72 focused tests pass; expanded target/shared suite passes 133 checks with one optional endpoint skipped. A fresh diagnostic reports 58 selected probes passing while the strict release gate still fails on open topic reviews. Browser menu and small visual fixture checks passed; an isolated vanilla-server crossbow test passed with rendering disabled only for that test. Full-world headless software rendering timed out and is not certified. See the audit for precise limitations.
