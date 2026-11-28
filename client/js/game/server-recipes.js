const clone = (stack) => (stack ? structuredClone(stack) : null);

export function resolveSlotDisplay774(game, sd) {
  if (!sd) return [];
  switch (sd.type) {
    case 'empty': return [];
    case 'any_fuel': return [];
    case 'item': {
      const id = Number(sd.data);
      return Number.isInteger(id) && id > 0 ? [{ id, data: 0, count: 1 }] : [];
    }
    case 'item_stack': {
      const s = sd.data;
      return s && (s.count ?? 1) > 0 ? [{ ...clone(s), data: 0 }] : [];
    }
    case 'tag': {
      const tagName = String(sd.data || '').replace(/^#/, '');
      const ids = game?.tags?.registries?.items?.get?.(tagName) || [];
      return [...ids].map((id) => ({ id, data: 0, count: 1 }));
    }
    case 'with_remainder':
      return resolveSlotDisplay774(game, sd.data?.input);
    case 'smithing_trim':
      return resolveSlotDisplay774(game, sd.data?.base);
    case 'composite':
      return Array.isArray(sd.data) ? sd.data.flatMap((child) => resolveSlotDisplay774(game, child)) : [];
    default:
      return [];
  }
}

export function serverRecipe(record, game = null) {
  // Legacy array record format
  if (record?.data && record?.type) {
    const d = record.data, type = record.type.replace(/^minecraft:/, ''), shaped = type === 'crafting_shaped';
    if (!d.result) return null;
    const raw = shaped || type === 'crafting_shapeless' ? d.ingredients : [d.ingredient || []];
    return {
      id: record.recipeId, name: record.recipeId, type: record.type,
      group: d.group || '', category: d.category, result: clone(d.result), shaped,
      width: shaped ? d.width : type === 'crafting_shapeless' ? Math.ceil(Math.sqrt(raw.length)) : 1,
      height: shaped ? d.height : type === 'crafting_shapeless' ? Math.ceil(Math.sqrt(raw.length)) : 1,
      cells: raw.map((alternatives) => alternatives.length ? alternatives.filter(Boolean).map((s) => ({ ...clone(s), data: 0 })) : null),
      experience: d.experience, cookingTime: d.cookingTime
    };
  }
  // 1.21.11 RecipeDisplayEntry { displayId, display: { type, data }, group, category, craftingRequirements }
  const disp = record?.display;
  if (!disp?.type) return null;
  const type = disp.type;
  const d = disp.data || {};
  const resultList = resolveSlotDisplay774(game, d.result);
  const result = resultList[0] || null;
  if (!result) return null;
  const shaped = type === 'crafting_shaped';
  const raw = shaped || type === 'crafting_shapeless'
    ? (d.ingredients || []).map((sd) => resolveSlotDisplay774(game, sd))
    : type === 'furnace' || type === 'stonecutter'
      ? [resolveSlotDisplay774(game, d.ingredient)]
      : type === 'smithing'
        ? [d.template, d.base, d.addition].map((sd) => resolveSlotDisplay774(game, sd))
        : [];
  const recipeType = type === 'stonecutter' ? 'minecraft:stonecutting' : type === 'furnace' ? 'minecraft:smelting' : 'minecraft:' + type;
  return {
    id: record.displayId,
    name: String(record.displayId),
    type: recipeType,
    group: record.group ? String(record.group) : '',
    category: record.category ?? 'misc',
    result: clone(result),
    shaped,
    width: shaped ? d.width : type === 'crafting_shapeless' ? Math.ceil(Math.sqrt(raw.length)) : 1,
    height: shaped ? d.height : type === 'crafting_shapeless' ? Math.ceil(Math.sqrt(raw.length)) : 1,
    cells: raw.map((alts) => (alts.length ? alts : null)),
    experience: d.experience,
    cookingTime: d.duration,
    craftingRequirements: record.craftingRequirements || null
  };
}

const matches = (alternatives, item) => !alternatives ? !item : !!item && alternatives.some((s) => s.id === item.id);

export function serverCraftResult(grid, n, recipes) {
  const present = grid.filter(Boolean);
  if (!present.length) return null;
  for (const r of recipes) {
    const kind = r.type.replace(/^minecraft:/, '');
    if (!['crafting_shaped', 'crafting_shapeless'].includes(kind)) continue;
    if (r.shaped) {
      for (let ox = 0; ox <= n - r.width; ox++) for (let oy = 0; oy <= n - r.height; oy++) for (const mirror of [false, true]) {
        let ok = true;
        for (let y = 0; y < n && ok; y++) for (let x = 0; x < n; x++) {
          const rx = x - ox, ry = y - oy, inside = rx >= 0 && rx < r.width && ry >= 0 && ry < r.height;
          if (!matches(inside ? r.cells[ry * r.width + (mirror ? r.width - 1 - rx : rx)] : null, grid[y * n + x])) { ok = false; break; }
        }
        if (ok) return clone(r.result);
      }
    } else {
      const cells = r.cells.filter(Boolean);
      if (cells.length !== present.length) continue;
      const used = new Set();
      const search = (i) => {
        if (i === cells.length) return true;
        for (let j = 0; j < present.length; j++) if (!used.has(j) && matches(cells[i], present[j])) {
          used.add(j); if (search(i + 1)) return true; used.delete(j);
        }
        return false;
      };
      if (search(0)) return clone(r.result);
    }
  }
  return null;
}

export function replaceServerRecipes(game, packetOrRecipes) {
  if (Array.isArray(packetOrRecipes)) {
    game.serverRecipes = packetOrRecipes;
    if (game.items) game.items.serverRecipes = packetOrRecipes.map((r) => serverRecipe(r, game)).filter(Boolean);
  } else {
    const sets = packetOrRecipes?.recipes || [];
    game.recipePropertySets = new Map(sets.map((s) => [s.name, new Set(s.items || [])]));
    game.stonecutterRecipes = packetOrRecipes?.stoneCutterRecipes || [];
  }
  if (game.recipeBook) { game.recipeBook.recipes = null; game.recipeBook.lists = null; }
  const screen = game.screens?.current;
  if (screen?.recipeBook) { screen.recipeBook.ghost = null; screen.recipeBook.overlay = null; screen.recipeBook.update?.(true); }
}

export function resetServerRecipes(game) {
  game.serverRecipes = null;
  game.recipePropertySets = null;
  game.stonecutterRecipes = null;
  if (game.items) game.items.serverRecipes = null;
  if (game.recipeBook) {
    game.recipeBook.recipes = null;
    game.recipeBook.lists = null;
    game.recipeBook.serverDisplays?.clear?.();
    game.recipeBook.known.clear();
    game.recipeBook.fresh.clear();
    game.recipeBook.open = false;
    game.recipeBook.filtering = false;
    for (const state of Object.values(game.recipeBook.cookingStates || {})) {
      state.open = false;
      state.filtering = false;
    }
  }
}
