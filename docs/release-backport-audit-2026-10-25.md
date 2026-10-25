# Release and backport audit — 2026-10-25

Reviewed the recent 1.13.2 fixes through `79792c6`, the corresponding 1.12.2
history through `52b775f`, and 1.8.9 through `248a76f`, before creating the
1.14.4 development branch. Compared implementation paths, prior audit records,
and the shared regression suites. No additional missing applicable fix was
identified in this review. This is a targeted audit of the recent fixes, not a
claim of complete vanilla parity or an exhaustive audit of the repository's history.

| Area | 1.13.2 | 1.12.2 / 1.8.9 |
| --- | --- | --- |
| Inventory NBT ownership/equality, slot limits, authoritative results | Fixed | Adapted fixes present; legacy metadata retained |
| Visibility and skin invalidation | Fixed | Present |
| Rain, firework trails, barrier marker lifecycle, camera-distance LOD | Fixed | Present with native particle IDs; no elytra in 1.8.9 |
| Dragon/crystal/guardian beams, texture cutouts, dragon death effects | Fixed | Present with native metadata |
| Jar selection bounds, bed sleep camera, portal reload rendering | Fixed | Shared fixes present; native bed colours and portal scanning retained |
| Controls ordering and resource-pack compatibility confirmation | Fixed | Native layout and pack-format adaptations present |
| Custom skin/profile proxy, UUID/raw/encoded URL placeholders | Fixed | Present |
| Explicit empty selection shapes | Fixed | Present; cave/void air stay exclusive to newer versions |
| Chat history, translation placeholders, hover tooltips, stale block/light updates | Fixed | Present with native chat formats |
| Falling-block local replacement | Fixed | Present |
| Path-block light opacity | Fixed | Present in 1.12.2; no path block in 1.8.9 |
| Creative sword mining guard, model-based breaking overlay | Fixed | Present |
| Wisp v1 URL paths, early greeting retention, credits and close cleanup | Fixed | Present |
| Creative search category bold reset | Corrected | Older UI does not use this category path |
| Turtle eggs, swimming/Riptide, biome water colours, native tags/Brigadier, GLFW labels | Native fixes | Version-specific; not transplanted into older clients |

The `skinProxy` field was already read from site configuration on all three
versions. This release adds a ready-to-edit configuration example, includes the
field in the main README's full config example, and checks the actual config
build/load/settings/fetch path. Tests cover external-over-embedded defaults,
user-setting precedence, and embedded configuration on `file://`.

Validation commands, run from each checkout:

```sh
node tools/test-site-config-regressions.mjs
node tools/test-client-regressions.mjs
node tools/test-chat-hover-proxy-regressions.mjs
node tools/test-chat-world-regressions.mjs
node tools/test-sword-mining-regressions.mjs
node tools/test-wisp-regressions.mjs
```

Run `tools/test-1.13.2-*.mjs` additionally on 1.13.2. The optional real
wisp-python interoperability test was run during the preceding Wisp fix, as
recorded in `wisp-v1-fixes-2026-10-25.md`; it is skipped without WISP_TEST_URL.
`node tools/audit-backports.mjs` also reports all six original audit checks as
true on both older branches and the native working tree.

Build all three supported releases before starting the port. Generated HTML,
assets, checksums and local build logs belong in ignored `dist/`, not Git.
The 1.14.4 branch initially contains the stable 1.13.2 implementation plus a
transition plan; it is not yet a 1.14.4 client or a fourth release artifact.
