import { NATIVE_METADATA } from './entity-metadata-1.21.11.js';
import { KNOWN_PACK_774 } from '../net/known-pack-1.21.11.js';
import { simplify } from '../net/nbt.js';

function unwrapPaintingEntry(entry, fallbackId) {
  const data = entry?.value ? simplify(entry.value) : (entry?.element || entry || {});
  const name = entry?.key || data.asset_id || ('minecraft:' + (data.name || fallbackId));
  return {
    id: fallbackId,
    name: String(name),
    assetId: String(data.asset_id || name),
    width: Number(data.width || 1),
    height: Number(data.height || 1),
    title: data.title ?? null,
    author: data.author ?? null,
  };
}

export const PAINTINGS_774 = Object.freeze(
  KNOWN_PACK_774.registries['minecraft:painting_variant'].map((entry, id) => unwrapPaintingEntry(entry, id))
);

export const PAINTING_DIRECTION_INDEX_774 = NATIVE_METADATA.painting.DATA_DIRECTION;
export const PAINTING_VARIANT_INDEX_774 = NATIVE_METADATA.painting.DATA_PAINTING_VARIANT_ID;

const defaultVariants = new Map(PAINTINGS_774.map((v) => [v.id, v]));

// HangingEntity: DATA_DIRECTION is Direction 3D data value (0=DOWN,1=UP,2=NORTH,3=SOUTH,4=WEST,5=EAST).
// 2D horizontal facing order used in renderer: SOUTH=0, WEST=1, NORTH=2, EAST=3.
export function paintingFacing774(direction) {
  return ({ 3: 0, 4: 1, 2: 2, 5: 3 })[direction] ?? 0;
}

export function resolvePaintingVariant774(spec, customRegistry = null) {
  if (spec && typeof spec === 'object') {
    if (spec.variantData) {
      const d = spec.variantData;
      return {
        id: null,
        name: String(d.assetId || 'kebab'),
        assetId: String(d.assetId || 'minecraft:kebab'),
        width: Number(d.width || 1),
        height: Number(d.height || 1),
        title: d.title ?? null,
        author: d.author ?? null,
      };
    }
    if (spec.variantId !== undefined) spec = spec.variantId;
  }
  const id = Number(spec ?? 0);
  if (customRegistry?.get) {
    const custom = customRegistry.get(id);
    if (custom) return custom;
  }
  return defaultVariants.get(id) || null;
}

export function paintingVariantList774(entries) {
  if (!Array.isArray(entries)) return new Map(defaultVariants);
  return new Map(entries.map((entry, id) => [id, unwrapPaintingEntry(entry, id)]));
}

// Painting.calculateBoundingBox (width & height in blocks).
export function configurePainting774(entity, variantSpec = entity.paintingVariant ?? entity.paintingId ?? 0, customRegistry = null) {
  const art = resolvePaintingVariant774(variantSpec, customRegistry);
  if (!art || !entity.blockPos) return false;
  if (art.id !== null) entity.paintingId = art.id;
  entity.paintingVariant = variantSpec;
  entity.paintingName = art.assetId.replace(/^minecraft:/, '');
  entity.title = entity.paintingName;
  entity.width = art.width;
  entity.height = art.height;
  entity.pickable = true;
  const facing = entity.facing ?? 0;
  const front = [[0, 1], [-1, 0], [0, -1], [1, 0]][facing];
  const side = [[1, 0], [0, 1], [-1, 0], [0, -1]][facing];
  const p = entity.blockPos;
  const off = (blocks) => (blocks % 2 === 0 ? 0.5 : 0);
  const x = p.x + 0.5 - front[0] * 0.46875 + side[0] * off(art.width);
  const y = p.y + 0.5 + off(art.height);
  const z = p.z + 0.5 - front[1] * 0.46875 + side[1] * off(art.width);
  const hx = (front[0] === 0 ? art.width : 0.0625) / 2;
  const hy = art.height / 2;
  const hz = (front[0] === 0 ? 0.0625 : art.width) / 2;
  entity.box = [x - hx, y - hy, z - hz, x + hx, y + hy, z + hz];
  entity.x = entity.prevX = entity.newX = x;
  entity.y = entity.prevY = entity.newY = y;
  entity.z = entity.prevZ = entity.newZ = z;
  return true;
}
