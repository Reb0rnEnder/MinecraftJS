// Client-side crafting result computation (vanilla 1.8 computes this on the client too).

let recipesByResult = null;
let allShaped = [];
let allShapeless = [];

function norm(ing) {
  if (ing === null || ing === undefined) return null;
  if (typeof ing === 'number') return { id: ing, meta: -1 };
  return { id: ing.id, meta: ing.metadata === undefined ? -1 : ing.metadata };
}

export function initRecipes(json) {
  recipesByResult = json;
  allShaped = [];
  allShapeless = [];
  for (const list of Object.values(json)) {
    for (const r of list) {
      const result = { id: r.result.id, count: r.result.count, damage: r.result.metadata || 0 };
      if (r.inShape) {
        const shape = r.inShape.map((row) => row.map(norm));
        const h = shape.length, w = Math.max(...shape.map((row) => row.length));
        for (const row of shape) while (row.length < w) row.push(null);
        allShaped.push({ shape, w, h, result });
      } else if (r.ingredients) {
        allShapeless.push({ ingredients: r.ingredients.map(norm), result });
      }
    }
  }
}

const matchIng = (ing, item) => {
  if (!ing) return !item;
  if (!item) return false;
  return item.id === ing.id && (ing.meta === -1 || ing.meta === 32767 || ing.meta === item.damage);
};

// grid: array of items (row-major), size n x n
export function craftResult(grid, n, items) {
  // Bounding box of non-empty cells
  let minX = n, minY = n, maxX = -1, maxY = -1, count = 0;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    if (grid[y * n + x]) { count++; minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
  }
  if (!count) return null;
  const w = maxX - minX + 1, h = maxY - minY + 1;
  const at = (x, y) => grid[(y + minY) * n + (x + minX)];

  // Repair: two identical damageable items
  if (count === 2 && items) {
    const list = grid.filter(Boolean);
    const a = list[0], b = list[1];
    const maxD = items.maxDurability(a.id);
    if (a.id === b.id && a.count === 1 && b.count === 1 && maxD > 0) {
      const da = maxD - a.damage, db = maxD - b.damage;
      const total = da + db + Math.floor(maxD * 5 / 100);
      let dmg = maxD - total;
      if (dmg < 0) dmg = 0;
      return { id: a.id, count: 1, damage: dmg, nbt: null };
    }
  }

  for (const r of allShaped) {
    if (r.w !== w || r.h !== h) continue;
    for (const mirror of [false, true]) {
      let ok = true;
      for (let y = 0; y < h && ok; y++) {
        for (let x = 0; x < w && ok; x++) {
          const ing = r.shape[y][mirror ? w - 1 - x : x];
          if (!matchIng(ing, at(x, y))) ok = false;
        }
      }
      if (ok) return { id: r.result.id, count: r.result.count, damage: r.result.damage, nbt: null };
    }
  }
  const present = grid.filter(Boolean);
  for (const r of allShapeless) {
    if (r.ingredients.length !== present.length) continue;
    const used = new Array(present.length).fill(false);
    let ok = true;
    for (const ing of r.ingredients) {
      let found = false;
      for (let i = 0; i < present.length; i++) {
        if (!used[i] && matchIng(ing, present[i])) { used[i] = true; found = true; break; }
      }
      if (!found) { ok = false; break; }
    }
    if (ok) return { id: r.result.id, count: r.result.count, damage: r.result.damage, nbt: null };
  }
  return null;
}

// Items left in the grid after crafting (buckets etc.)
export function containerItem(item) {
  if (!item) return null;
  if (item.id === 326 || item.id === 327 || item.id === 335) return { id: 325, count: 1, damage: 0, nbt: null };
  if (item.id === 373 && false) return { id: 374, count: 1, damage: 0, nbt: null };
  return null;
}
