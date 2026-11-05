# Native sound audit follow-up (2026-11-05)

Shared audio fixes were reviewed against the exact release's native code.
Mining hits use Neutral through 1.14.4, and Blocks from 1.15.2 onward; the older
category behavior is preserved. Native controllers inspected: 1.14.4 dke,
1.15.2 dnr, 1.16.5 dww, 1.17.1 ejl, 1.18.2 emv, 1.19.4 fdn.

One-shot and looping gain now clamp the combined instance/sample amplitude at
the correct stage. Native 1.8.9 bpx clamps before category and master;
1.12.2 chm, 1.13.2 dgr, 1.14.4 eam, 1.15.2 edw, 1.16.5 enr,
1.17.1 fba, 1.18.2 fem and 1.19.4 fxg clamp after category and before master.
The 1.8.9 helper intentionally differs. These changes fix slider/sample-gain
behavior; they are not claimed to fix the remaining webmc duplicate event.

Run `node --test tools/test-sound-gain.mjs tools/test-mining-sound-category.mjs tools/test-sound-capture.mjs tools/test-placement-sound-riding.mjs`.
All ten targets pass ten tests each, and all ten browser entry points bundle.
The 1.20.6 port carries the fixes in its existing graphical 1.19.4 baseline;
this is not a claim of native 1.20.6 sound/asset parity.

The optional bounded capture distinguishes local hit/break/place calls from
server world-event/sound packets. It preserves requested sound names, raw event
IDs, block states, coordinates and mixer category, and excludes chat, server
addresses, authentication and custom payloads. It does not measure actual audio
playback or Java performance. Start/stop explicitly:

```js
var sc = (await import('/js/debug/capture-sounds.js')).captureSounds(game);
// Reproduce once:
sc.download(); sc.stop();
```

A disposable vanilla 1.19.4 integration test produced one local wood break and
no break broadcasts to the initiating player. The authenticated webmc trace is
still needed. No time-based sound suppression is shipped, since it could discard
other players' legitimate sounds. User servers/config/worlds/captures are preserved.
No distributions were rebuilt.
