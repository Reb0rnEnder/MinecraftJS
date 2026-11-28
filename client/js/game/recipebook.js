import { serverRecipe } from './server-recipes.js';
import { DEFAULT_TAGS } from './default-tags.js';

export const FIRST_JSON_ID = 11;
export const BOOK_TABS = ['search', 'tools', 'buildingBlocks', 'misc', 'redstone'];

function stackOf(game, j) {
  if (typeof j === 'string') j = { item: j };
  const name = String(j.item || '').replace(/^minecraft:/, '');
  const def = game.assets.itemsByName.get(name);
  if (!def) return null;
  return { id: def.id, data: j.data === undefined ? 0 : j.data, count: j.count || 1 };
}

export class RecipeBook {
  constructor(game) {
    this.game = game;
    this.known = new Set();
    this.fresh = new Set();
    this.serverDisplays = new Map();
    this.open = false;
    this.filtering = false;
    this.cookingStates = {
      smelting: { open: false, filtering: false },
      blasting: { open: false, filtering: false },
      smoking: { open: false, filtering: false }
    };
    this.recipes = null;
    this.lists = null;
  }

  _parse() {
    if (this.recipes) return;
    const g = this.game;
    this.recipes = {};
    if (this.serverDisplays.size) {
      for (const [id, rec] of this.serverDisplays) this.recipes[id] = rec;
    } else if (Array.isArray(g.serverRecipes)) {
      for (const record of g.serverRecipes) {
        const rec = serverRecipe(record, g);
        if (rec) this.recipes[rec.id] = rec;
      }
    } else {
      const list = Array.isArray(g.assets.recipes) ? g.assets.recipes : [];
      list.forEach((r) => {
        if (!r?.name || !r?.type) return;
        const id = r.name.includes(':') ? r.name : 'minecraft:' + r.name;
        const ing = (v) => (Array.isArray(v) ? v : [v]).flatMap((x) => {
          if (x?.tag) {
            const ids = g.tags?.registries.items.get(x.tag) || DEFAULT_TAGS.items[x.tag] || [];
            return ids.map((tid) => ({ id: tid, data: 0, count: 1 }));
          }
          const item = x && stackOf(g, x);
          return item ? [item] : [];
        });
        const result = stackOf(g, r.result || {});
        if (!result) return;
        const rec = {
          id, type: r.type, name: r.name, group: r.group || '',
          category: r.category ?? 'misc', result,
          shaped: r.type.replace(/^minecraft:/, '') === 'crafting_shaped'
        };
        if (rec.shaped) {
          rec.height = r.pattern.length;
          rec.width = Math.max(...r.pattern.map((row) => row.length));
          rec.cells = [];
          for (let y = 0; y < rec.height; y++) {
            for (let x = 0; x < rec.width; x++) {
              const c = r.pattern[y][x];
              rec.cells.push(!c || c === ' ' ? null : ing(r.key[c]));
            }
          }
        } else {
          rec.cells = (r.ingredients || (r.ingredient ? [r.ingredient] : [])).map(ing);
          rec.width = rec.height = Math.ceil(Math.sqrt(rec.cells.length));
        }
        this.recipes[id] = rec;
      });
    }
    this.lists = {};
    for (const t of [...BOOK_TABS, 'food']) this.lists[t] = [];
    const groups = new Map();
    for (const rec of Object.values(this.recipes)) {
      if (!rec) continue;
      const tab = this.categoryOf(rec);
      let list = rec.group ? groups.get(tab + '|' + rec.group) : null;
      if (!list) {
        list = { recipes: [], tab };
        if (rec.group) groups.set(tab + '|' + rec.group, list);
        this.lists[tab].push(list);
        this.lists.search.push(list);
      }
      list.recipes.push(rec);
    }
  }

  stateFor(kind = 'crafting') { return kind === 'crafting' ? this : this.cookingStates[kind]; }

  categoryOf(rec) {
    const rawCat = String(rec.category ?? 'misc');
    if (rawCat.startsWith('crafting_')) {
      const sub = rawCat.slice(9);
      return { building_blocks: 'buildingBlocks', redstone: 'redstone', equipment: 'tools' }[sub] || 'misc';
    }
    if (rawCat === 'furnace_food' || rawCat === 'smoker_food' || rawCat === 'campfire') return 'food';
    if (rawCat === 'furnace_blocks' || rawCat === 'blast_furnace_blocks') return 'buildingBlocks';
    if (rawCat.startsWith('furnace_') || rawCat.startsWith('blast_furnace_')) return 'misc';

    const kind = rec.type?.replace(/^minecraft:/, ''), category = rec.category;
    const cooking = ['food', 'blocks', 'misc'], crafting = ['building', 'redstone', 'equipment', 'misc'];
    if (['smelting', 'blasting', 'smoking', 'campfire_cooking', 'furnace'].includes(kind)) {
      if (kind === 'smoking' || kind === 'campfire_cooking') return 'food';
      const name = typeof category === 'number' ? cooking[category] : category;
      if (kind === 'blasting') return name === 'blocks' ? 'buildingBlocks' : 'misc';
      return name === 'food' ? 'food' : name === 'blocks' ? 'buildingBlocks' : 'misc';
    }
    const name = typeof category === 'number' ? crafting[category] : category;
    return { building: 'buildingBlocks', redstone: 'redstone', equipment: 'tools' }[name] || 'misc';
  }

  recipe(id) { this._parse(); return this.recipes[id] || null; }
  tabLists(tab) { this._parse(); return this.lists[tab] || []; }

  // 1.21.2+ recipe_book_settings
  onSettings(p) {
    if (p.crafting) {
      this.open = !!p.crafting.open;
      this.filtering = !!p.crafting.filtering;
    }
    if (p.furnace) this.cookingStates.smelting = { open: !!p.furnace.open, filtering: !!p.furnace.filtering };
    if (p.blast) this.cookingStates.blasting = { open: !!p.blast.open, filtering: !!p.blast.filtering };
    if (p.smoker) this.cookingStates.smoking = { open: !!p.smoker.open, filtering: !!p.smoker.filtering };
    this.game.screens?.current?.recipesUpdated?.();
  }

  // 1.21.2+ recipe_book_add
  onAdd(p) {
    if (p.replace) {
      this.known.clear();
      this.fresh.clear();
      this.serverDisplays.clear();
    }
    const added = [];
    for (const entry of p.entries || []) {
      const r = entry?.recipe;
      if (!r) continue;
      const parsed = serverRecipe(r, this.game);
      if (parsed) this.serverDisplays.set(r.displayId, parsed);
      this.known.add(r.displayId);
      if (entry.flags?.highlight) this.fresh.add(r.displayId);
      if (entry.flags?.notification && parsed) added.push(parsed);
    }
    this.recipes = null;
    this.lists = null;
    this._parse();
    if (added.length) this.game.hud?.addRecipeToast?.(added);
    this.game.screens?.current?.recipesUpdated?.();
  }

  // 1.21.2+ recipe_book_remove
  onRemove(p) {
    for (const id of p.recipeIds || []) {
      this.known.delete(id);
      this.fresh.delete(id);
      this.serverDisplays.delete(id);
    }
    if (this.serverDisplays.size || this.recipes) {
      this.recipes = null;
      this.lists = null;
    }
    this.game.screens?.current?.recipesUpdated?.();
  }

  // Legacy unlock_recipes handler kept for fixture compatibility
  onPacket(p) {
    this._parse();
    this.open = p.craftingBookOpen;
    this.filtering = p.filteringCraftable;
    this.cookingStates.smelting.open = !!p.smeltingBookOpen; this.cookingStates.smelting.filtering = !!p.filteringSmeltable;
    this.cookingStates.blasting.open = !!p.blastFurnaceOpen; this.cookingStates.blasting.filtering = !!p.filteringBlastFurnace;
    this.cookingStates.smoking.open = !!p.smokerBookOpen; this.cookingStates.smoking.filtering = !!p.filteringSmoker;
    if (p.action === 2) for (const id of p.recipes) this.known.delete(id);
    else if (p.action === 0) {
      this.known.clear(); this.fresh.clear();
      for (const id of p.recipes) this.known.add(id);
      for (const id of p.recipesToHighlight || []) this.fresh.add(id);
    } else if (p.action === 1) {
      const added = [];
      for (const id of p.recipes) { this.known.add(id); this.fresh.add(id); const r = this.recipe(id); if (r) added.push(r); }
      if (added.length) this.game.hud.addRecipeToast(added);
    }
    const scr = this.game.screens.current;
    if (scr && scr.recipesUpdated) scr.recipesUpdated();
  }

  stackedContents(gridItems) {
    const counts = new Map();
    const add = (it) => { if (!it || it.count <= 0) return; const k = it.id + ':' + it.damage; counts.set(k, (counts.get(k) || 0) + it.count); };
    for (const it of this.game.inventory.main) add(it);
    for (const it of gridItems || []) add(it);
    return counts;
  }

  canCraft(rec, counts) {
    const left = new Map(counts), cells = rec.cells.filter(Boolean).sort((a, b) => a.length - b.length);
    const search = (index) => {
      if (index === cells.length) return true;
      for (const [key, count] of left) {
        if (count <= 0) continue;
        const [id, damage] = key.split(':').map(Number);
        if (!cells[index].some((s) => s.id === id && (s.data === 32767 || s.data === damage))) continue;
        left.set(key, count - 1);
        if (search(index + 1)) return true;
        left.set(key, count);
      }
      return false;
    };
    return search(0);
  }

  evaluate(list, counts, gw, gh) {
    list.known = list.recipes.filter((r) => this.known.has(r.id));
    list.valid = list.known.filter((r) => r.width <= gw && r.height <= gh);
    list.craftable = list.valid.filter((r) => this.canCraft(r, counts));
    return list;
  }
}
