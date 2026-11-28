// Builds the local 26.3 crafting fallback table from the pinned client jar. Servers still
// send their own recipe displays, but the client keeps this table for local prediction and
// for the recipe book before a server declares recipes. Ingredients are resolved to native
// item ids; item tags become `{any:[ids]}` so the matcher keeps the native alternatives.
import {readFile, writeFile} from 'node:fs/promises';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {ZipArchive} from '../../client/js/util/zip.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const jarPath = join(root, 'cache/port-26.3/client.jar');
const itemsPath = join(root, 'client/data/items.json');
const output = join(root, 'client/data/recipes.json');
const check = process.argv.includes('--check');

const short = value => String(value || '').replace(/^minecraft:/, '');
const isCrafting = type => type === 'crafting_shaped' || type === 'crafting_shapeless';

export async function buildRecipes() {
  const jar = new ZipArchive(await readFile(jarPath));
  const items = JSON.parse(await readFile(itemsPath, 'utf8'));
  const itemByName = new Map(items.map(item => [item.name, item]));
  const tagCache = new Map();

  const recipeNames = [...jar.entries.keys()]
    .filter(name => /^data\/minecraft\/recipe\/.+\.json$/.test(name))
    .sort();
  const tagNames = new Set([...jar.entries.keys()]
    .filter(name => /^data\/minecraft\/tags\/item\/.+\.json$/.test(name))
    .map(name => name.slice('data/minecraft/tags/item/'.length, -5)));

  function tagItems(tag, seen = new Set()) {
    tag = short(tag);
    if (tagCache.has(tag)) return tagCache.get(tag);
    if (seen.has(tag)) return [];
    if (!tagNames.has(tag)) return null;
    seen.add(tag);
    const data = JSON.parse(jar.readText('data/minecraft/tags/item/' + tag + '.json'));
    const ids = [];
    for (const value of data.values || []) {
      const entry = typeof value === 'string' ? value : value?.id;
      if (typeof entry !== 'string') continue;
      if (entry.startsWith('#')) {
        const nested = tagItems(entry.slice(1), seen);
        if (nested) ids.push(...nested);
        else if (value?.required === false) continue;
        else return null;
      } else {
        const item = itemByName.get(short(entry));
        if (item) ids.push(item.id);
        else if (value?.required === false) continue;
        else return null;
      }
    }
    const unique = [...new Set(ids)];
    tagCache.set(tag, unique);
    return unique;
  }

  function ingredient(value, recipe, key) {
    const raw = Array.isArray(value) ? value : [value];
    const ids = [];
    for (const part of raw) {
      if (part == null) continue;
      if (typeof part === 'object') {
        if (part.tag != null) {
          const nested = tagItems(part.tag);
          if (!nested) throw Error(recipe + ': unknown tag ' + part.tag);
          ids.push(...nested);
        } else if (part.item != null) {
          const item = itemByName.get(short(part.item));
          if (!item) throw Error(recipe + ': unknown item ' + part.item);
          ids.push(item.id);
        } else if (typeof part.id === 'string') {
          if (part.id.startsWith('#')) {
            const nested = tagItems(part.id.slice(1));
            if (!nested) throw Error(recipe + ': unknown tag ' + part.id);
            ids.push(...nested);
          } else {
            const item = itemByName.get(short(part.id));
            if (!item) throw Error(recipe + ': unknown item ' + part.id);
            ids.push(item.id);
          }
        } else {
          throw Error(recipe + ': invalid ingredient ' + JSON.stringify(part));
        }
      } else if (typeof part === 'string') {
        if (part === ' ') continue;
        if (part.startsWith('#')) {
          const nested = tagItems(part.slice(1));
          if (!nested) throw Error(recipe + ': unknown tag ' + part);
          ids.push(...nested);
        } else {
          const item = itemByName.get(short(part));
          if (!item) throw Error(recipe + ': unknown item ' + part);
          ids.push(item.id);
        }
      }
    }
    const unique = [...new Set(ids)];
    if (!unique.length) throw Error(recipe + ': ingredient ' + key + ' resolved to nothing');
    return unique.length === 1 ? unique[0] : {any: unique};
  }

  const byResult = {};
  let supported = 0, skipped = 0, withAlternatives = 0;
  for (const name of recipeNames) {
    const recipe = JSON.parse(jar.readText(name));
    const type = short(recipe.type);
    if (!isCrafting(type)) { skipped++; continue; }
    const result = recipe.result || {};
    if (result.id == null) throw Error(name + ': missing result id');
    const resultItem = itemByName.get(short(result.id));
    if (!resultItem) throw Error(name + ': unknown result item ' + result.id);
    if (result.components) {
      // The local table has no component output model; let the server recipe display decide.
      skipped++;
      continue;
    }
    const out = {id: resultItem.id, count: Math.max(1, Number(result.count) || 1)};
    let entry;
    if (type === 'crafting_shaped') {
      const key = recipe.key || {};
      const rows = (recipe.pattern || []).map(row => [...row].map(cell => {
        if (cell === ' ') return null;
        if (!Object.hasOwn(key, cell)) throw Error(name + ': pattern uses missing key ' + cell);
        return ingredient(key[cell], name, cell);
      }));
      if (!rows.length) throw Error(name + ': empty pattern');
      const width = Math.max(...rows.map(row => row.length));
      for (const row of rows) while (row.length < width) row.push(null);
      entry = {inShape: rows, result: out};
      if (rows.some(row => row.some(cell => cell?.any))) withAlternatives++;
    } else {
      const cells = (recipe.ingredients || []).map((value, index) => ingredient(value, name, 'ingredient ' + index));
      if (!cells.length) throw Error(name + ': empty ingredients');
      entry = {ingredients: cells, result: out};
      if (cells.some(cell => cell?.any)) withAlternatives++;
    }
    (byResult[out.id] ||= []).push(entry);
    supported++;
  }

  const serialized = JSON.stringify(byResult) + '\n';
  if (check) assert.equal(await readFile(output, 'utf8'), serialized, 'client/data/recipes.json is regenerated from the native recipe files');
  else await writeFile(output, serialized);

  assert.equal(recipeNames.length, 2042, 'the pinned jar carries 2042 recipe files');
  assert.equal(supported, 1185, 'all shaped/shapeless recipes with a component-free result are retained');
  assert.equal(skipped, 857, 'non-crafting and component-result recipes stay out of the local table');
  assert.equal(withAlternatives, 198, 'native tags produce 198 alternative ingredient sets');

  const boat = byResult[itemByName.get('acacia_boat').id][0];
  assert.deepEqual(boat.inShape.map(row => row.length), [3, 3], 'acacia boat is a 3x3 native pattern');
  assert.equal(boat.inShape[1][0], itemByName.get('acacia_planks').id, 'boat planks use the native item id');
  const fire = byResult[itemByName.get('fire_charge').id][0];
  assert.ok(fire.ingredients.some(cell => cell?.any), 'fire charge keeps its coal/charcoal alternatives');

  console.log('Native 26.3 recipes: ' + supported + ' shaped/shapeless of ' + recipeNames.length +
    ' (' + skipped + ' non-crafting/component recipes skipped), ' + withAlternatives + ' with tag alternatives');
  return byResult;
}

if (process.argv[1] && process.argv[1].endsWith('build-recipes.mjs')) await buildRecipes();
