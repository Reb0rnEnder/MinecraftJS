// Recipe book (1.12): RecipeBook (known / new recipes, open and filtering flags), RecipeBookClient (recipe lists per
// tab, grouped by the recipe's "group") and RecipeList craftability against the player's items.
import { creativeTabOf } from '../gui/screens/containers.js';

export const FIRST_JSON_ID = 11; // CraftingManager: ids 0 - 10 are the special (dynamic) recipes
export const BOOK_TABS = ['search', 'tools', 'buildingBlocks', 'misc', 'redstone'];

// "minecraft:planks" + data -> { id, data } (data 32767 = any)
function stackOf(game, j) {
  const name = String(j.item || '').replace(/^minecraft:/, '');
  const def = game.assets.itemsByName.get(name);
  if (!def) return null;
  const id = def.id;
  return { id, data: j.data === undefined ? 0 : j.data, count: j.count || 1 };
}

export class RecipeBook {
  constructor(game) {
    this.game = game;
    this.known = new Set();
    this.fresh = new Set(); // RecipeBook.newRecipes (highlighted until seen)
    this.open = false;
    this.filtering = false;
    this.recipes = null;   // parsed, by id
    this.lists = null;     // tab -> [RecipeList]
  }

  // Parse the JSON recipes once (shaped: width / height / cells, shapeless: ingredient list)
  _parse() {
    if (this.recipes) return;
    const g = this.game;
    this.recipes = [];
    (g.assets.recipes || []).forEach((r, i) => {
      const id = FIRST_JSON_ID + i;
      const ing = (v) => (Array.isArray(v) ? v : [v]).map((x) => stackOf(g, x)).filter(Boolean);
      const result = stackOf(g, r.result || {});
      if (!result) return;
      const rec = { id, name: r.name, group: r.group || '', result, shaped: r.type === 'crafting_shaped' };
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
        rec.cells = (r.ingredients || []).map(ing);
        rec.width = rec.height = Math.ceil(Math.sqrt(rec.cells.length));
      }
      this.recipes[id] = rec;
    });
    // RecipeBookClient.rebuildTable: lists per tab, one per group (or per ungrouped recipe), in id order
    this.lists = {};
    for (const t of BOOK_TABS) this.lists[t] = [];
    const groups = new Map();
    for (const rec of this.recipes) {
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

  // RecipeBookClient.getItemCategory: tools / building blocks / redstone, combat with tools, the rest misc
  categoryOf(rec) {
    const t = creativeTabOf(this.game, rec.result.id);
    if (t === 'buildingBlocks' || t === 'tools' || t === 'redstone') return t;
    return t === 'combat' ? 'tools' : 'misc';
  }

  recipe(id) { this._parse(); return this.recipes[id] || null; }
  tabLists(tab) { this._parse(); return this.lists[tab] || []; }

  // SPacketRecipeBook (NetHandlerPlayClient.handleRecipeBook)
  onPacket(p) {
    this._parse();
    this.open = p.craftingBookOpen;
    this.filtering = p.filteringCraftable;
    if (p.action === 2) for (const id of p.recipes) this.known.delete(id);
    else if (p.action === 0) {
      for (const id of p.recipes) this.known.add(id);
      for (const id of p.recipesToHighlight || []) this.fresh.add(id);
    } else if (p.action === 1) {
      const added = [];
      for (const id of p.recipes) { this.known.add(id); this.fresh.add(id); const r = this.recipe(id); if (r) added.push(r); }
      // RecipeToast.addOrUpdate
      if (added.length) this.game.hud.addRecipeToast(added);
    }
    const scr = this.game.screens.current;
    if (scr && scr.recipesUpdated) scr.recipesUpdated();
  }

  // Items the player can use: the main inventory and the crafting grid (RecipeItemHelper)
  stackedContents(gridItems) {
    const counts = new Map();
    const add = (it) => { if (!it || it.count <= 0) return; const k = it.id + ':' + it.damage; counts.set(k, (counts.get(k) || 0) + it.count); };
    for (const it of this.game.inventory.main) add(it);
    for (const it of gridItems || []) add(it);
    return counts;
  }

  // RecipeItemHelper.canCraft (greedy: ingredients with the fewest alternatives take their items first)
  canCraft(rec, counts) {
    const left = new Map(counts);
    const cells = rec.cells.filter(Boolean).sort((a, b) => a.length - b.length);
    for (const alts of cells) {
      let ok = false;
      for (const s of alts) {
        for (const [k, n] of left) {
          if (n <= 0) continue;
          const [id, dmg] = k.split(':').map(Number);
          if (id === s.id && (s.data === 32767 || s.data === dmg)) { left.set(k, n - 1); ok = true; break; }
        }
        if (ok) break;
      }
      if (!ok) return false;
    }
    return true;
  }

  // RecipeList.canCraft for a grid: per recipe whether it is known, fits and can be made now
  evaluate(list, counts, gw, gh) {
    list.known = list.recipes.filter((r) => this.known.has(r.id));
    list.valid = list.known.filter((r) => r.width <= gw && r.height <= gh);
    list.craftable = list.valid.filter((r) => this.canCraft(r, counts));
    return list;
  }
}
