# Audio build audit

The builder already selected Opus by default in every supported checkout before this audit. This change retains that default, makes the options visible in `--help`, rejects unknown codecs and invalid bitrates before extracting assets, and shares one tested encoder between all output formats.

## Measured 1.20.6 corpus

Measured on 2026-11-16 using the target Mojang asset index, FFmpeg/libopus, effects at 32 kbps mono and music/discs at 48 kbps with their original channel layout:

| Corpus | Files | Original bytes | Build output bytes |
| --- | ---: | ---: | ---: |
| Effects/ambient | 3,634 | 119,889,310 | 19,215,210 |
| Music/discs | 67 | 432,117,767 | 117,040,341 |
| Total | 3,701 | 552,007,077 | 136,255,551 |

Audio shrank **75.3%**, from 526.4 MiB to 129.9 MiB. Of these files, 3,683 were Opus and 18 retained the original because it was smaller. Independent per-file raw DEFLATE totals were 546,099,964 versus 135,627,696 bytes; these exclude ZIP headers and are not complete HTML build sizes. Existing Opus builds already receive these savings; this is not an additional 75% reduction of their HTML.

Chromium 156 decoded **all 3,701 encoded output files**, zero failures, through Web Audio `decodeAudioData`. Synthetic regression samples also exercise actual Opus/Vorbis encoding, FFmpeg decoding, cached bytes, copy mode and tiny-file retention. Firefox and Safari playback have not been measured here. Older Safari releases may not support Ogg Opus; Ogg Vorbis originals have their own browser constraints. See [MDN Ogg container support](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Formats/Containers) and [FFmpeg libopus options](https://ffmpeg.org/ffmpeg-codecs.html#libopus-1).

Opus re-encoding is **lossy**, not a lossless optimization. These measurements establish size and successful decoding, not perceptual transparency. Increase the rates to trade file size for quality, or use `copy` to preserve exact original bytes. Keeping `.ogg` paths is intentional: both codecs use Ogg and Web Audio detects the actual encoded content.

## Reproduce and select

```sh
npm run build -- --audio=opus
npm run build -- --static --audio=vorbis
npm run assets -- --audio=copy
npm run build -- --audio=opus --sfx-kbps=64 --music-kbps=96
node --test tools/test-audio-encoder.mjs
node tools/benchmark-audio.mjs --out=cache/audio-benchmark.json
# Optional: PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs
```

FFmpeg is found via `FFMPEG`, `PATH` or `ffmpeg-static`. Missing FFmpeg emits a warning and keeps the originals. The shared builder changes apply to every existing named target from 1.8.9 through 1.20.6; target-specific gameplay/assets are unaffected. No published distributions were rebuilt by this audit.
