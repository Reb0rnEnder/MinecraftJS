// SpriteSourceList sources used by atlas definitions. Sprite ids use the client atlas naming convention:
// vanilla paths are unqualified (block/stone), while other namespaces retain "namespace:path".
const strip = (id) => String(id ?? '').replace(/^minecraft:/, '');
const parts = (id) => {
  const s = String(id), i = s.indexOf(':');
  return i < 0 ? ['minecraft', s] : [s.slice(0, i), s.slice(i + 1)];
};

export function cropImage(image, x, y, width, height) {
  const data = new Uint8Array(width * height * 4);
  for (let row = 0; row < height; row++) {
    const from = ((y + row) * image.width + x) * 4;
    data.set(image.data.subarray(from, from + width * 4), row * width * 4);
  }
  return { width, height, data };
}

// ctx: { names: Set<id>, list(dir): relative paths below textures/<dir>, load(path): Promise<image|null> }
// The result describes ids added/replaced by sources and ids removed by filters.
export async function runAtlasSources(definitions, ctx) {
  const table = new Map([...ctx.names].map((name) => [name, null]));
  const added = new Map();
  const put = (id, loader) => { table.set(id, loader); added.set(id, loader); };

  for (const definition of definitions) for (const source of definition?.sources || []) {
    const type = strip(source.type);
    if (type === 'directory') {
      const directory = strip(source.source), prefix = String(source.prefix ?? '');
      for (const rel of await ctx.list(directory)) {
        const id = strip(prefix + rel);
        // Vanilla's existing block/item directory sprites are already loaded; retain those images.
        if (!table.has(id)) put(id, () => ctx.load(directory + '/' + rel));
      }
    } else if (type === 'single') {
      const resource = strip(source.resource), id = strip(source.sprite ?? source.resource);
      if (!(id === resource && table.has(id))) put(id, () => ctx.load(resource));
    } else if (type === 'filter') {
      const namespace = source.pattern?.namespace ? new RegExp('^(?:' + source.pattern.namespace + ')$') : null;
      const path = source.pattern?.path ? new RegExp('^(?:' + source.pattern.path + ')$') : null;
      for (const id of [...table.keys()]) {
        const [ns, name] = parts(id);
        if ((!namespace || namespace.test(ns)) && (!path || path.test(name))) {
          table.delete(id);
          added.delete(id);
        }
      }
    } else if (type === 'unstitch') {
      const resource = strip(source.resource), divisorX = Number(source.divisor_x ?? 1), divisorY = Number(source.divisor_y ?? 1);
      const sheet = ctx.load(resource);
      for (const region of source.regions || []) put(strip(region.sprite), async () => {
        const image = await sheet;
        if (!image || !(divisorX > 0) || !(divisorY > 0)) return null;
        const scaleX = image.width / divisorX, scaleY = image.height / divisorY;
        return cropImage(image, Math.floor(region.x * scaleX), Math.floor(region.y * scaleY),
          Math.floor(region.width * scaleX), Math.floor(region.height * scaleY));
      });
    }
  }

  return {
    add: added,
    remove: new Set([...ctx.names].filter((name) => !table.has(name))),
  };
}
