import { BUNDLE_NATIVE_774, BUNDLE_NAME_SET_774 } from './bundle-data-1.21.11.js';
import { createItemStack774, itemComponentValues774 } from '../net/item-components-1.21.11.js';

const FORBIDDEN = new Set(BUNDLE_NATIVE_774.forbiddenItems);
const BUNDLE_IDS = new Set(BUNDLE_NATIVE_774.bundleIds);
const itemName = (item, items) => items?.name?.(item?.id) || item?.itemKey?.replace(/^minecraft:/, '') || '';

export const isBundleItem = (item, items) => !!item && (BUNDLE_IDS.has(item.id) || BUNDLE_NAME_SET_774.has(itemName(item, items)));

function normalizeEntry(entry) {
  if (!entry || (entry.count ?? entry.itemCount ?? 0) <= 0) return null;
  if (entry.componentPatch || entry.componentValues) return entry;
  return createItemStack774(entry.itemId ?? entry.id, entry.count ?? entry.itemCount ?? 1);
}

export function bundleContents(item) {
  if (!item) return [];
  const c = itemComponentValues774(item).bundle_contents;
  const list = Array.isArray(c) ? c : Array.isArray(c?.contents) ? c.contents : [];
  return list.filter((e) => e && (e.count ?? e.itemCount ?? 0) > 0);
}

function setBundleContents(bundle, list) {
  const cleaned = list.filter((e) => e && (e.count ?? e.itemCount ?? 0) > 0).map(normalizeEntry);
  const prevAdded = (bundle.componentPatch?.added || []).filter((e) => e.type !== 'bundle_contents');
  const prevRemoved = (bundle.componentPatch?.removed || []).filter((t) => t !== 'bundle_contents');
  const added = cleaned.length
    ? [...prevAdded, { type: 'bundle_contents', data: { contents: cleaned } }]
    : prevAdded;
  const updated = createItemStack774(bundle.itemId ?? bundle.id, bundle.count ?? 1, {
    added,
    removed: prevRemoved
  });
  Object.assign(bundle, updated);
  if ((bundle.bundleSelectedIndex ?? -1) >= cleaned.length) bundle.bundleSelectedIndex = -1;
}

export function bundleCanAccept(item, items) {
  if (!item || (item.count ?? 0) <= 0) return false;
  if (FORBIDDEN.has(item.id)) return false;
  const name = itemName(item, items);
  if (name.endsWith('_shulker_box') || name === 'shulker_box') return false;
  return true;
}

// Fraction weight scaled to 64 (max bundle capacity = 64).
// Uses exact rational reduction matching BundleContents.getWeight / computeContentWeight.
function gcd(a, b) { return b === 0 ? a : gcd(b, a % b); }
function addFrac(a, b) {
  const num = a[0] * b[1] + b[0] * a[1];
  const den = a[1] * b[1];
  const g = gcd(Math.abs(num), den);
  return [num / g, den / g];
}

function itemWeightFraction(item, items) {
  if (!item) return [0, 1];
  if (isBundleItem(item, items)) {
    const inner = contentWeightFraction(item, items);
    return addFrac([1, 16], inner);
  }
  const vals = itemComponentValues774(item);
  const bees = vals.bees?.bees ?? vals.bees;
  if (Array.isArray(bees) && bees.length > 0) return [1, 1];
  const max = Math.max(1, items?.maxStack?.(item) ?? vals.max_stack_size ?? item.maxStackSize ?? 64);
  return [1, max];
}

function contentWeightFraction(bundle, items) {
  let sum = [0, 1];
  for (const entry of bundleContents(bundle)) {
    const [n, d] = itemWeightFraction(entry, items);
    const cnt = entry.count ?? entry.itemCount ?? 1;
    const g = gcd(cnt * n, d);
    sum = addFrac(sum, [(cnt * n) / g, d / g]);
  }
  return sum;
}

export function bundleWeight(item, items) {
  const [n, d] = itemWeightFraction(item, items);
  return (n * 64) / d;
}

export function bundleContentWeight(item, items) {
  const [n, d] = contentWeightFraction(item, items);
  return (n * 64) / d;
}

export function bundleSelectedIndex(bundle) {
  const list = bundleContents(bundle);
  const idx = bundle?.bundleSelectedIndex ?? -1;
  return idx >= 0 && idx < list.length ? idx : -1;
}

export function selectBundleItem(bundle, index) {
  if (!bundle) return -1;
  const list = bundleContents(bundle);
  const next = (index < 0 || index >= list.length || bundle.bundleSelectedIndex === index) ? -1 : index;
  bundle.bundleSelectedIndex = next;
  return next;
}

export function bundleAdd(bundle, item, items, equal) {
  if (!bundleCanAccept(item, items)) return 0;
  const [wn, wd] = contentWeightFraction(bundle, items);
  const [inN, inD] = itemWeightFraction(item, items);
  // Remaining capacity: (1 - wn/wd) / (inN/inD) = ((wd - wn) * inD) / (wd * inN)
  const room = Math.max(0, Math.floor(((wd - wn) * inD) / (wd * inN)));
  const count = Math.min(item.count, room);
  if (count <= 0) return 0;
  const list = bundleContents(bundle).map((e) => structuredClone(e));
  const maxStack = Math.max(1, items?.maxStack?.(item) ?? item.maxStackSize ?? 64);
  const stackIdx = maxStack > 1 && equal ? list.findIndex((e) => equal(e, item) && e.count < maxStack) : -1;
  if (stackIdx !== -1) {
    const existing = list.splice(stackIdx, 1)[0];
    const space = Math.min(count, maxStack - existing.count);
    existing.count += space;
    list.unshift(existing);
    if (count > space) {
      const rest = structuredClone(item);
      rest.count = count - space;
      list.unshift(rest);
    }
  } else {
    const added = structuredClone(item);
    added.count = count;
    list.unshift(added);
  }
  item.count -= count;
  setBundleContents(bundle, list);
  bundle.bundleSelectedIndex = -1;
  return count;
}

export function bundleRemove(bundle) {
  const list = bundleContents(bundle).map((e) => structuredClone(e));
  if (!list.length) return null;
  const idx = bundleSelectedIndex(bundle);
  const removed = idx >= 0 ? list.splice(idx, 1)[0] : list.shift();
  setBundleContents(bundle, list);
  bundle.bundleSelectedIndex = -1;
  return normalizeEntry(removed);
}

export function bundleSound(game, kind) {
  if (BUNDLE_NATIVE_774.sounds) {
    game.sound?.playAtPlayer?.('item.bundle.' + kind, 0.8, 0.8 + Math.random() * 0.4, 'player');
  }
}

export function emptyBundle(game, item) {
  if (!bundleContents(item).length) return false;
  setBundleContents(item, []);
  bundleSound(game, 'drop_contents');
  return true;
}

export function bundleSlotClick(container, slotId, button, equal) {
  if (button !== 0 && button !== 1) return false;
  const inv = container.inv ?? container;
  const slotItem = container.get(slotId);
  const cursor = inv.cursor;
  const items = container.items;
  const slotIsBundle = isBundleItem(slotItem, items);
  const cursorIsBundle = isBundleItem(cursor, items);

  // Cursor is a bundle (BundleItem.overrideStackedOnOther)
  if (cursorIsBundle) {
    if (button === 0 && slotItem) {
      if (!container.canTake(slotId)) {
        bundleSound(container.game, 'insert_fail');
        return true;
      }
      const n = bundleAdd(cursor, slotItem, items, equal);
      if (n > 0) {
        container.put(slotId, slotItem.count <= 0 ? null : slotItem);
        bundleSound(container.game, 'insert');
      } else {
        bundleSound(container.game, 'insert_fail');
      }
      return true;
    }
    if (button === 1 && !slotItem) {
      if (!container.isValid(slotId, cursor)) return true;
      const out = bundleRemove(cursor);
      if (out) {
        if (container.isValid(slotId, out)) {
          container.put(slotId, out);
          bundleSound(container.game, 'remove_one');
        } else {
          bundleAdd(cursor, out, items, equal);
        }
      }
      return true;
    }
    return false;
  }

  // Slot is a bundle (BundleItem.overrideOtherStackedOnMe)
  if (!slotIsBundle) return false;
  if (button === 0 && cursor) {
    const n = bundleAdd(slotItem, cursor, items, equal);
    if (n > 0) {
      if (cursor.count <= 0) inv.cursor = null;
      bundleSound(container.game, 'insert');
    } else {
      bundleSound(container.game, 'insert_fail');
    }
    return true;
  }
  if (button === 1 && !cursor) {
    const out = bundleRemove(slotItem);
    if (out) {
      inv.cursor = out;
      bundleSound(container.game, 'remove_one');
    }
    return true;
  }
  if (button === 0 && !cursor) {
    selectBundleItem(slotItem, -1);
  }
  return false;
}

export function bundleBar(item, items) {
  const [n, d] = contentWeightFraction(item, items);
  if (n <= 0) return null;
  const full = n >= d;
  return {
    width: Math.min(1 + Math.trunc((12 * n) / d), 13),
    color: full ? BUNDLE_NATIVE_774.fullBarColor : BUNDLE_NATIVE_774.barColor
  };
}
