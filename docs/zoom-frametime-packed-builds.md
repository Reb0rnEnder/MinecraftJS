# Smooth zoom, bounded mesh work and smaller standalone builds

Hold zoom now transitions over 150 ms in both directions using elapsed time.
Reversing the key partway through starts from the current FOV. Menus/focus loss
reset the transient lens; the separate cinematic-camera preference is preserved.

Chunk snapshots previously filled every available worker slot in one main-thread
call. Completed workers also uploaded GPU meshes directly in message callbacks.
Snapshot submission and mesh upload now each have a two-millisecond per-frame
budget, allowing one indivisible operation to finish. Completed results retain
backpressure until consumed, are checked again for stale world/build tokens and
new block changes, and are discarded immediately on a world reset.

A Node benchmark with 36 real 1.15.2 snapshots measured approximately 12–29 ms in
one call before the change. The bounded version submitted 1–3 snapshots per call
at approximately 2–6 ms. This measures that specific burst, not overall game FPS
or a guarantee that every source of stutter is removed.

Standalone packing changes are lossless:

- PNGs and other non-audio entries use ZIP deflate only when it makes them smaller.
  PNG bytes and image metadata are restored exactly. Existing audio quality,
  music, registries and content are retained.
- A raw-text-safe base85 alphabet replaces base64 for the embedded archive.
- The bundled JavaScript is gzip-compressed and imported through a temporary
  Blob module URL. A small bundled inflater supports this without depending on
  the browser's Compression Streams API; the Blob URL is revoked after import.
- Existing base64 standalone archives still load. Source/folder mode is unchanged.

The initial full 1.15.2 build decreased from 131,227,634 to 122,596,552 bytes
(about 6.6%), including the new skin/cape preset resources. All 7,665 asset entries
were compared: 1,903 PNGs and all other binary assets retained identical bytes;
the extracted model JSON had equivalent content with different key ordering.
Packed startup/reload passed on WebGL2, WebGPU, software and fallback, as well as
opening the packed file directly with `file://`.
