import {serverRecipe} from './server-recipes.js';
// Recipe book (1.12): RecipeBook (known / new recipes, open and filtering flags), RecipeBookClient (recipe lists per
// tab, grouped by the recipe's "group") and RecipeList craftability against the player's items.
import { creativeTabOf } from '../gui/screens/containers.js';
import {DEFAULT_TAGS} from './default-tags.js';

export const FIRST_JSON_ID = 11; // CraftingManager: ids 0 - 10 are the special (dynamic) recipes
export const BOOK_TABS = ['search', 'tools', 'buildingBlocks', 'misc', 'redstone'];

// "minecraft:planks" + data -> { id, data } (data 32767 = any)
function stackOf(game, j) {
  if(typeof j==='string')j={item:j};
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
    this.cookingStates={smelting:{open:false,filtering:false},blasting:{open:false,filtering:false},smoking:{open:false,filtering:false}};
    this.recipes = null;   // parsed, by id
    this.lists = null;     // tab -> [RecipeList]
  }

  // Parse the JSON recipes once (shaped: width / height / cells, shapeless: ingredient list)
  _parse() {
    if (this.recipes) return;
    const g = this.game;
    this.recipes = {};
    if(Array.isArray(g.serverRecipes)){for(const record of g.serverRecipes){const rec=serverRecipe(record);if(rec)this.recipes[rec.id]=rec;}}
    else (g.assets.recipes || []).forEach((r, i) => {
      const id = r.name.includes(':') ? r.name : 'minecraft:' + r.name;
      const ing = (v) => (Array.isArray(v) ? v : [v]).flatMap(x=>{
        if(x?.tag){const ids=g.tags?.registries.items.get(x.tag)||DEFAULT_TAGS.items[x.tag]||[];return ids.map(id=>({id,data:0,count:1}));}
        const item=x&&stackOf(g,x);return item?[item]:[];
      });
      const result = stackOf(g, r.result || {});
      if (!result) return;
      const rec = { id, type:r.type, name: r.name, group: r.group || '', result, shaped: r.type.replace(/^minecraft:/,'') === 'crafting_shaped' };
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
        rec.cells = (r.ingredients || (r.ingredient?[r.ingredient]:[])).map(ing);
        rec.width = rec.height = Math.ceil(Math.sqrt(rec.cells.length));
      }
      this.recipes[id] = rec;
    });
    // RecipeBookClient.rebuildTable: lists per tab, one per group (or per ungrouped recipe), in id order
    this.lists = {};
    for (const t of [...BOOK_TABS,'food']) this.lists[t] = [];
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

  // RecipeBookClient.getItemCategory: tools / building blocks / redstone, combat with tools, the rest misc
  stateFor(kind='crafting'){return kind==='crafting'?this:this.cookingStates[kind];}

  categoryOf(rec) {
    if(['smelting','blasting','smoking'].includes(rec.type?.replace(/^minecraft:/,''))){if(this.game.items?.isFood(rec.result))return 'food';if(this.game.items?.isBlockItem(rec.result.id))return 'buildingBlocks';return 'misc';}
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
    this.cookingStates.smelting.open=!!p.smeltingBookOpen;this.cookingStates.smelting.filtering=!!p.filteringSmeltable;
    if (p.action === 2) for (const id of p.recipes) this.known.delete(id);
    else if (p.action === 0) {
      this.known.clear();this.fresh.clear();
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

  // Match all ingredient alternatives; a greedy choice can consume another cell's only item.
  canCraft(rec, counts) {
    const left=new Map(counts),cells=rec.cells.filter(Boolean).sort((a,b)=>a.length-b.length);
    const search=index=>{
      if(index===cells.length)return true;
      for(const [key,count]of left){if(count<=0)continue;const [id,damage]=key.split(':').map(Number);
        if(!cells[index].some(s=>s.id===id&&(s.data===32767||s.data===damage)))continue;
        left.set(key,count-1);if(search(index+1))return true;left.set(key,count);
      }return false;
    };return search(0);
  }

  // RecipeList.canCraft for a grid: per recipe whether it is known, fits and can be made now
  evaluate(list, counts, gw, gh) {
    list.known = list.recipes.filter((r) => this.known.has(r.id));
    list.valid = list.known.filter((r) => r.width <= gw && r.height <= gh);
    list.craftable = list.valid.filter((r) => this.canCraft(r, counts));
    return list;
  }
}
