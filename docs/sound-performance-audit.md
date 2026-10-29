# Sound audit and terrain decoder performance

All registered sound events and nested event references resolve against the
matching sound definitions. Every shipped Ogg sample was decoded through the
Chromium Web Audio adapter, including samples not referenced by default events:

| Version | Decoded samples | Result |
| --- | ---: | --- |
| 1.8.9 | 578 | pass |
| 1.12.2 | 1,085 | pass |
| 1.13.2 | 1,406 | pass |
| 1.14.4 | 1,779 | pass |
| 1.15.2 | 1,830 | pass |
| 1.16.5 | 2,336 | pass |

This proves asset availability and decoding in the tested browser, rather than
exhaustive correctness of every gameplay trigger or behavior on every browser.
Runtime reference checks also cover living-mob hurt/death events, block sound
types and literal playback calls in 1.16.5. A native LevelRenderer comparison
identified additional missing world-event handlers and category mismatches.

Corrections include fire extinguishing selecting the correct event in 1.12.2+,
End gateway/dragon/fireball events in 1.12.2+, and composter/lava/torch burnout/
portal-frame sounds in 1.14.4+. Ocelots use their separate native sounds in
1.14.4+, trader llamas reuse llama sounds, and pillager/ravager hurt sounds use
the hostile volume category. The modern world-event table now supplies native
categories explicitly. Newer events and mob identities are kept off older targets.

Reproduce resource and adapter checks with:

```sh
node --test tools/test-sound-coverage.mjs tools/test-fire-event-sound.mjs
PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs node --test tools/test-audio-decode-browser.mjs
```

1.14.4+ also has `tools/test-client-sound-triggers.mjs` for the expanded runtime
reference/event checks. Native 1.16.5 sound details were compared with the pinned
jar's LevelRenderer, ComposterBlock and SoundEvents; the 1.14.4 LevelRenderer
confirms the corresponding older event handlers.

## Optimization

A Chromium CPU profile during a local 1.16.5 server join placed chunk decoding
at the top of sampled JavaScript functions. The decoder shifted BigInt values
for each of 4,096 cells in every section. It now reads each long as two 32-bit
words and extracts padded entries with integer shifts. This retains long-boundary
padding and handles entries crossing the midpoint between words. Randomized
fixtures compare all widths (4, 5, 6, 7, 8 and global 15) with an independent
BigInt encoder; malformed-input and fluid-heavy-packet checks still pass.

A controlled Node benchmark of 100 chunks with 16 five-bit sections, median of
five measured runs after warm-up, changed from 234.88 ms to 48.77 ms (about 4.8x
faster in that workload). Checksums match. This is a decoder benchmark, not an
FPS promise. Browser join/profile checks also pass after the change.

Run `node tools/benchmark-chunk754.mjs` in 1.16.5. Older clients already decode
their continuous palettes using word operations; padded 1.16 logic is not
backported. Biome fog sampling was also measured, but its cost was small in the
controlled workload, so no extra cache or invalidation scheme was added.

## WebAssembly feasibility

The 1.13.2+ clients already use a small stb_truetype WASM module for font
rasterization; see `tools/font/README.md` in those checkouts. Additional bounded CPU modules such as terrain
meshing, decoding or software rasterization could accept typed buffers and
return results through JavaScript. Existing graphics, audio, UI and networking
adapters could remain in JavaScript. A full client conversion would need
substantial porting or a different runtime, and WASM alone does not guarantee a
speedup or solve GPU-bound rendering. Measure crossing/copying overhead before
choosing a module. No new WASM build or module was made for this audit.

The integration model is described by the official
[WebAssembly goals](https://webassembly.org/docs/high-level-goals/).
