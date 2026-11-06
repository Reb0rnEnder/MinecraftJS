# Border and look-at corrections (2026-11-06)

Border initialization and resizing now reach native gameplay state instead of
being dropped or jumping to the final size. The border has native wall geometry,
forcefield texture, status tint, warning calculation, absolute limits and collision
bounds. Its state resets on a fresh server world. Server look-at packets apply
feet/eyes anchors, entity lookup/fallback and both rotation interpolation endpoints.

| Target | Border reference | Native differences retained |
| --- | --- | --- |
| 1.8.9 | WorldBorder ams, packet hg, RenderGlobal bfr, HUD avo, World adm | Float interpolation, one-sided absolute bounds, outside-border hysteresis; 0–256 wall. No look-at packet. |
| 1.12.2 | WorldBorder axn, packet jz, renderer buy, HUD biq | Same legacy interpolation/bounds and wall; no newer look-at feature. |
| 1.13.2 | WorldBorder bmv, packet lc, renderer cue, CollisionGetter ayc, Entity aer, look-at ks, MathHelper xq | Double interpolation, legacy bounds/hysteresis and 0–256 wall; native look-at anchors. |
| 1.14.4 | WorldBorder bxf, renderer dng, Entity aio | Camera-based fade; legacy wall height and bounds, voxel-border collision eligibility. |
| 1.15.2 | WorldBorder bzw, renderer dqr, Entity akq, CollisionGetter bjk | Legacy wall height/bounds and voxel-border eligibility. |
| 1.16.5 | WorldBorder cfu, renderer eae, Entity aqa, CollisionGetter brg | Legacy wall height/bounds and voxel-border eligibility. |
| 1.17.1 | WorldBorder cmj, renderer eng, Entity atg, CollisionGetter bvz | Split packets, clamped absolute bounds, raised wall and its native texture-coordinate formula. |
| 1.18.2 | WorldBorder cql, renderer eqq | Close-to-border collision check; raised wall texture coordinates retained. |
| 1.19.4 | WorldBorder ddi, renderer fie, Entity bfh, packets wn/xz/xm, Mth apj | Updated vertical texture phase and half-block horizontal phase. |
| 1.20.6 | Existing 1.19.4 graphical baseline | Forwarded correction; this does not complete the separate native-766 Play transition. |

All pre-split initialization packets were also reading warning distance/time in
the wrong order. Exact native hg/lc/ClientboundSetBorderPacket writes distance
first, followed by time. The test uses unequal values to catch reversal.

The native-server test additionally exposed an earlier interaction-entity eye
height assumption. Its synchronized dimensions only replace its bounding box;
they do not refresh the cached zero eye height from EntityType registration.
That detail is corrected in 1.19.4 and the forwarded baseline. A native look-at
packet's fallback coordinates independently verify the zero eye anchor.

Validation:

- All ten branches pass focused state, collision, wire and rotation tests and
  compile as browser bundles. The 1.19.4/forwarded baseline also rerun interaction
  regressions. No feature introduced in 1.13 is installed in 1.8/1.12.
- The pinned 1.19.4 JVM directly supplies eight angle vectors and five border
  snapshots, including fractional coordinates and absolute limits. Reproduce
  with `tools/port-1.19.4/VerifyBorderAngles.java` using the verified client jar
  and bundled third-party libraries as the classpath.
- An isolated pinned vanilla server verifies initialization, warning values,
  timed resizing, coordinate/entity look-at, missing-entity fallback and client
  collision clipping. Run `probe-border-look.mjs` against
  `run-presentation-fixture.mjs`; its MOTD gate refuses other servers.
- `test-world-border-browser.mjs` verifies visible native texture stripes, tint
  and scene-depth occlusion on WebGL2, WebGPU and Software on every target from
  1.8.9 through 1.19.4. These checks are not full Java screenshot comparisons.
- 1.20.6 lacks generated assets, so no browser-pixel result is claimed for it.
  No distributable builds, manifests or checksums were regenerated in this batch.

Native source was decompiled from each target's exact local client jar. Attempts
to fetch the Wiki's world-border and 1.19.4 history pages were restricted on this
pass; unavailable pages are not counted as reviewed. The earlier release-history
audit and exact jar behavior remain the references for release boundaries.
