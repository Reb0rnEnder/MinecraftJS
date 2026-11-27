// SpriteSourceList (1.19.3+): every source of atlases/<atlas>.json, merged across the pack stack lowest first, run in
// order against one id -> sprite table. directory adds textures/<source>/** as <prefix><path>, single adds one
// texture (optionally renamed), filter removes ids matching its namespace/path patterns, unstitch crops regions of
// a sheet. paletted_permutations is handled by paletted-permutations.js. Sprite ids use the client's naming:
// bare paths for minecraft, "namespace:path" otherwise.
const strip = (id) => String(id ?? '').replace(/^minecraft:/, '');
const parts = (id) => { const s = String(id), i = s.indexOf(':'); return i < 0 ? ['minecraft', s] : [s.slice(0, i), s.slice(i + 1)]; };

export function cropImage(image, x, y, w, h) {
  const out = new Uint8Array(w * h * 4);
  for (let row = 0; row < h; row++) out.set(image.data.subarray(((y + row) * image.width + x) * 4, ((y + row) * image.width + x + w) * 4), row * w * 4);
  return { width: w, height: h, data: out };
}

// ctx: { names: Set of ids already in the atlas, list(dir) -> relative texture paths under textures/<dir>/ (no .png),
//        load(path) -> Promise<image|null> for textures/<path>.png }
// Returns { add: Map(id -> () => Promise<image|null>), remove: Set(id) }
export async function runAtlasSources(definitions, ctx) {
  const table = new Map([...ctx.names].map((n) => [n, null])), added = new Map();
  const put = (id, loader) => { table.set(id, loader); added.set(id, loader); };
  for (const def of definitions) for (const source of def?.sources || []) {
    const type = strip(source.type);
    if (type === 'directory') {
      const dir = strip(source.source), prefix = String(source.prefix ?? '');
      // ids already present (the block/item directories every client loads) keep their loaded sprite
      for (const rel of await ctx.list(dir)) { const id = strip(prefix + rel); if (!table.has(id)) put(id, () => ctx.load(dir + '/' + rel)); }
    } else if (type === 'single') {
      const resource = strip(source.resource), id = strip(source.sprite ?? source.resource);
      if (!(id === resource && table.has(id))) put(id, () => ctx.load(resource));
    } else if (type === 'filter') {
      const ns = source.pattern?.namespace ? new RegExp('^(?:' + source.pattern.namespace + ')$') : null;
      const path = source.pattern?.path ? new RegExp('^(?:' + source.pattern.path + ')$') : null;
      for (const id of [...table.keys()]) {
        const [n, p] = parts(id);
        if ((!ns || ns.test(n)) && (!path || path.test(p))) { table.delete(id); added.delete(id); }
      }
    } else if (type === 'unstitch') {
      const resource = strip(source.resource), dx = Number(source.divisor_x ?? 1), dy = Number(source.divisor_y ?? 1);
      const sheet = ctx.load(resource);
      for (const r of source.regions || []) put(strip(r.sprite), async () => {
        const image = await sheet;
        if (!image) return null;
        const sx = image.width / dx, sy = image.height / dy;
        return cropImage(image, Math.floor(r.x * sx), Math.floor(r.y * sy), Math.floor(r.width * sx), Math.floor(r.height * sy));
      });
    }
  }
  const remove = new Set([...ctx.names].filter((n) => !table.has(n)));
  return { add: added, remove };
}
