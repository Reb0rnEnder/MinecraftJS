import { createItemStack774 } from '../net/item-components-1.21.11.js';

const catalogs = new WeakMap();
const arrays = { Int8Array, Uint8Array, Int32Array, BigInt64Array };

function revive(value) {
  if (value?.$big !== undefined) return BigInt(value.$big);
  if (value?.$ta) {
    const Type = arrays[value.$ta];
    if (!Type) throw Error('Invalid Creative component array');
    return Type === BigInt64Array ? BigInt64Array.from(value.a, BigInt) : new Type(value.a);
  }
  if (Array.isArray(value)) return value.map(revive);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, revive(child)]));
  }
  return value;
}

export function creativeStack774(tuple) {
  if (!tuple) return null;
  const [id, , , patch] = tuple;
  return createItemStack774(id, 1, patch ? revive(patch) : { added: [], removed: [] });
}

export function nativeCreativeRows774(game) {
  const data = game.assets.data.creative;
  if (data.stackFormat !== 'native-components-774') return null;
  let catalog = catalogs.get(data);
  if (!catalog) {
    const buildRows = (rows) => rows.map((row) => ({
      ...row,
      icon: data.stacks[row.icon],
      items: row.items.map((id) => data.stacks[id])
    }));
    catalog = data.featureCatalogs.map((c) => ({
      ...c,
      tabs: buildRows(c.tabs),
      operatorTabs: buildRows(c.operatorTabs)
    }));
    catalogs.set(data, catalog);
  }
  const flags = game.enabledFeatures;
  const mask = (flags?.has('minecraft:trade_rebalance') ? 1 : 0)
    | (flags?.has('minecraft:redstone_experiments') ? 2 : 0)
    | (flags?.has('minecraft:minecart_improvements') ? 4 : 0);
  const selected = catalog.find((c) => c.mask === mask);
  if (!selected) throw Error('Missing native Creative feature catalogue ' + mask);
  return game.settings.operatorItemsTab && game.canUseCommandBlock() ? selected.operatorTabs : selected.tabs;
}
