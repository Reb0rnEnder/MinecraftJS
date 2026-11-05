# Browser performance capture

In the browser console while connected and standing in the affected area:

```js
const {capturePerformance}=await import('/js/debug/capture-performance.js');
window.mcjsPerf=capturePerformance(game,{seconds:10});
```

Play normally for ten seconds, then download the automatically stopped capture:

```js
mcjsPerf.download();
```

To stop early, use `mcjsPerf.stop()`. The JSON includes CPU tick, collision, entity/tile build, culling, mesh scheduling/upload, draw submission and shader post timing, retained frame interval percentiles, settings, viewport and queue sizes. Capturing again restores/stops the previous capture. No permanent work remains after stopping. It records no chat, server URLs, credentials, player names or raw network data. Imports work on the normal/static served client; a file:// standalone build may not expose modules.

Timings include instrumentation overhead. Inclusive section times overlap; selfMs excludes instrumented children. Draw counts are device API submissions; optional GPU queries are reported separately. Frame intervals include browser presentation/scheduling and FPS limits. Mesh worker duration is the existing worker-reported cumulative CPU value, not Java or server time. No native-client comparison or whole-client FPS improvement is claimed. Keep the same area, camera, render distance, display resolution, frame cap and shader state when comparing captures; record vanilla separately.

Native resting-item collision staggering and hidden non-leather armor-overlay pose skipping have already been restored. Visibility/sort caching and the remaining batching investigation are described in preloading-and-real-shader-pipeline.md. Further renderer optimization should follow actual captures rather than assume a CPU/GPU bottleneck.

Tests cover nested timing, bounded samples, automatic stop, errors, hook replacement/cleanup, data exclusions and JSON download across all nine supported versions.

The capture also serves as a hidden microprofiler. Enable asynchronous WebGL2 GPU timing explicitly:

```js
var mp = (await import('/js/debug/capture-performance.js')).capturePerformance(game, {seconds:15, gpu:true});
// After 15 seconds:
mp.download();
```

GPU timing requires `EXT_disjoint_timer_query_webgl2`; unavailable APIs report unsupported. Queries are bounded, polled without waiting, and discarded after disjoint events. Stopping deletes pending queries and restores every method hook. It adds no settings/menu rows and does no work unless started. GPU samples cover renderFrame; CPU sections now separate entity drawing, shadows and LOD scheduling, and draws include per-pipeline submission/element totals.

The initial/final memory snapshots count unique backing buffers for world blocks, lighting, biomes, heightmaps, pending mesh uploads and culling arrays, plus tracked terrain vertex-buffer sizes and optional browser heap figures. They exclude worker heaps, object/string overhead, textures, indices and driver allocations; these are not total process or GPU-residency measurements. Snapshots only scan when starting/dumping a capture, not every frame.

Source builds also expose `var mp = game.microprofile({seconds:15,gpu:true})` directly, including future standalone builds where module imports are unavailable. After capture, call `mp.download()`. The method installs instrumentation only when called. Existing distributions must be rebuilt to include it.
