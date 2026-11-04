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

Timings include instrumentation overhead. Inclusive section times overlap; selfMs excludes instrumented children. Draw counts are device API submissions, not GPU timers. Frame intervals include browser presentation/scheduling and FPS limits. Mesh worker duration is the existing worker-reported cumulative CPU value, not Java or server time. No native-client comparison or whole-client FPS improvement is claimed. Keep the same area, camera, render distance, display resolution, frame cap and shader state when comparing captures; record vanilla separately.

Native resting-item collision staggering and hidden non-leather armor-overlay pose skipping have already been restored. Visibility/sort caching and the remaining batching investigation are described in preloading-and-real-shader-pipeline.md. Further renderer optimization should follow actual captures rather than assume a CPU/GPU bottleneck.

Tests cover nested timing, bounded samples, automatic stop, errors, hook replacement/cleanup, data exclusions and JSON download across all nine supported versions.
