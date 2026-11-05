// Explicit snapshots only: never walk the world or retain resources each frame.
// These are known backing-buffer sizes, not a browser/GPU process memory estimate.
export function memorySnapshot(game) {
  const seen = new Set();
  const bytes = value => {
    const buffer = ArrayBuffer.isView(value) ? value.buffer : value instanceof ArrayBuffer ? value : null;
    if (!buffer || seen.has(buffer)) return 0;
    seen.add(buffer);
    return buffer.byteLength;
  };
  let blocks = 0, light = 0, biomes = 0, heightmaps = 0, sections = 0;
  for (const c of game.world?.chunks?.values() || []) {
    biomes += bytes(c.biomes); heightmaps += bytes(c.heightMap);
    for (const s of c.sections || []) if (s) {
      sections++; blocks += bytes(s.blocks);
      light += bytes(s.skyLight) + bytes(s.blockLight);
    }
    for (const list of [c.nativeLight?.sky, c.nativeLight?.block])
      for (const a of list || []) light += bytes(a);
  }
  for (const column of game.world?.lightColumns?.values() || [])
    for (const list of [column.sky, column.block]) for (const a of list || []) light += bytes(a);
  let terrainVertexBytes = 0, terrainVertices = 0, terrainMeshes = 0, terrainCpuBytes = 0;
  const meshes = new Set();
  for (const s of game.renderer?.sections?.values() || []) {
    for (const layer of ['solid', 'cutout', 'translucent', 'tripwire']) {
      const m = s[layer]; if (!m || meshes.has(m)) continue; meshes.add(m);
      terrainMeshes++; terrainVertices += m.vertexCount || 0;
      terrainVertexBytes += m.vsize ?? m.byteLength ?? 0;
      terrainCpuBytes += bytes(m.cpu);
    }
  }
  let pendingUploadBytes = 0;
  for (const m of game._meshUploads || [])
    for (const layer of ['solid', 'cutout', 'translucent', 'tripwire']) pendingUploadBytes += bytes(m[layer]);
  let cullingBytes = 0;
  for (const key of ['state', 'dirs', 'queue', 'columns']) cullingBytes += bytes(game.renderer?.culler?.[key]);
  const heap = globalThis.performance?.memory;
  return {
    world: {sections, blockBytes: blocks, lightBytes: light, biomeBytes: biomes, heightmapBytes: heightmaps,
      knownBufferBytes: blocks + light + biomes + heightmaps},
    terrain: {meshes: terrainMeshes, vertices: terrainVertices, vertexBufferBytes: terrainVertexBytes, retainedCpuBytes: terrainCpuBytes},
    pendingUploadBytes, cullingBytes,
    meshWorkers: game.worker?.size ?? null,
    browserHeap: heap ? {usedBytes: heap.usedJSHeapSize, totalBytes: heap.totalJSHeapSize, limitBytes: heap.jsHeapSizeLimit} : null,
    limitations: ['Backing buffers are counted once, including the full buffer behind a view.',
      'World object/string overhead, worker heaps, assets, textures, index buffers and driver allocations are excluded.',
      'Terrain vertex bytes are tracked buffer sizes, not measured GPU residency. Browser heap is optional and browser-defined.'],
  };
}
