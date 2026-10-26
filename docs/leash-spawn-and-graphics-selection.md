# Fence-knot packets and graphics selection

The previous renderer translation fix missed the spawn conversion. A real
1.14.4 server sends the fence block coordinates (for example 0,4,0), while
vanilla constructs LeashFenceKnotEntity at floor(position)+0.5 (0.5,4.5,0.5).
Using the packet position directly put the knot at a block corner and sampled
zero light, producing the displaced black cube. The entity now uses its native
centre, bounds and eye height at spawn and subsequent position updates. Rope
endpoints, picking, interpolation and light sampling share those coordinates.
Negative coordinates are covered; fence positions already at centres stay fixed.

Startup previously overwrote settings.graphicsApi with whichever backend was
actually selected after fallback. Now the requested API stays saved. The device
records requested/active backends and initialization errors; Video Settings
shows the active fallback in the API label and the reason in its tooltip.
WebGPU explicitly explains an insecure page or unavailable browser support.
A browser still requires a secure context for WebGPU: HTTPS or a trustworthy
local origin such as localhost. Plain HTTP to a LAN IP does not become WebGPU
capable through this client fix. Availability also depends on browser/driver.

Both changes are backported to 1.13.2, 1.12.2 and 1.8.9 and carried forward to
1.15.2's staged, still-1.14.4 runtime. There is no new vanilla content backport.

## Verification

- Full suites: 170 passing checks on 1.14.4, 259 on 1.13.2, 94 on 1.12.2 and
  86 on 1.8.9. Each skips one optional external endpoint probe.
- The staged 1.15.2 branch passes its four native-preparation checks and two
  graphics checks. Its changed runtime source matches the fixed 1.14.4 runtime.
- All five source trees render/read back pixels with WebGL2, WebGPU and Software:
  terrain, entities, lit geometry, color/leads, end portals, post processing and
  offscreen render targets. All 15 version/backend combinations pass with no
  WebGPU validation errors. Tests use Chromium's software Vulkan adapter; this
  is not a certification of every user's hardware/driver or all gameplay parity.
- Saved WebGPU preference survives unavailable-WebGPU fallback and reload.
  Standalone HTML startup/reload is additionally checked across all four builds.
- A live isolated vanilla 1.14.4 server reproduces the integer knot spawn packet;
  the corrected knot is (0.5,4.5,0.5), with daylight 15 instead of 0. A cow tied
  to it renders on all three backends with no browser/validation errors.
- Imported GLSL shader packs remain WebGL2-only; native WebGPU/Software rendering
  does not imply running BSL's GLSL on those backends.

Run optional browser checks with PLAYWRIGHT_MODULE pointing to Playwright's
index.mjs. The backend test explicitly configures software Vulkan for headless
WebGPU, reads actual rendered pixels and times out on stalled readback rather
than accepting a successful adapter request as a rendering pass.

Reference: [WebGPU secure-context requirement](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/gpu).
