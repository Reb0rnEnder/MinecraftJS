import { createItemStack774, itemComponentValues774 } from '../net/item-components-1.21.11.js';

// Block-entity update NBT uses ItemStack.CODEC (id/count/components), not the
// inventory wire patch. This is a presentation-only view; retain its source.
export function savedItem774(items, saved) {
  if (!saved || typeof saved.id !== 'string' || !Number.isInteger(saved.count ?? 1) || (saved.count ?? 1) < 1) return null;
  const def = items.byName.get(saved.id.replace(/^minecraft:/, ''));
  if (!def) return null;
  const stack = createItemStack774(def.id, saved.count ?? 1), values = { ...itemComponentValues774(stack) };
  for (const [id, raw] of Object.entries(saved.components || {})) {
    const name = id.replace(/^minecraft:/, '');
    if (name.startsWith('!')) { delete values[name.slice(1).replace(/^minecraft:/, '')]; continue; }
    let value = raw;
    if (['custom_name', 'item_name'].includes(name) && typeof raw === 'string') {
      try { value = JSON.parse(raw); } catch {}
    }
    if (name === 'pot_decorations' && Array.isArray(raw)) {
      value = { decorations: raw.map((n) => items.byName.get(n.replace(/^minecraft:/, ''))?.id ?? items.byName.get('brick').id) };
    }
    values[name] = value;
  }
  return { ...stack, componentValues: values, savedItem: saved };
}
