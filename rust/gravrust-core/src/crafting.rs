// Port of `client/js/game/crafting.js`

use std::collections::HashMap;

use serde_json::{Map, Value};
use wasm_bindgen::prelude::*;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Stack {
    pub id: i32,
    pub count: i32,
    pub damage: i32,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Ingredient {
    pub id: i32,
    /// `-1` and `32767` are wildcards, as in the JavaScript.
    pub meta: i32,
}

#[derive(Clone, Debug)]
struct ShapedRecipe {
    shape: Vec<Vec<Option<Ingredient>>>,
    width: usize,
    height: usize,
    result: Stack,
}

#[derive(Clone, Debug)]
struct ShapelessRecipe {
    ingredients: Vec<Option<Ingredient>>,
    result: Stack,
}

#[derive(Clone, Debug, Default)]
pub struct CraftingTable {
    shaped: Vec<ShapedRecipe>,
    shapeless: Vec<ShapelessRecipe>,
}

fn norm(value: &Value) -> Option<Ingredient> {
    if value.is_null() {
        return None;
    }
    if let Some(id) = value.as_i64() {
        return Some(Ingredient { id: id as i32, meta: -1 });
    }
    let id = value.get("id")?.as_i64()? as i32;
    let meta = value
        .get("metadata")
        .and_then(|m| m.as_i64())
        .map(|m| m as i32)
        .unwrap_or(-1);
    Some(Ingredient { id, meta })
}

fn stack_from(value: &Value, damage_default: bool) -> Option<Stack> {
    let id = value.get("id")?.as_i64()? as i32;
    let count = value.get("count").and_then(|c| c.as_i64()).unwrap_or(1) as i32;
    let damage = value
        .get("damage")
        .or_else(|| value.get("metadata"))
        .and_then(|d| d.as_i64())
        .map(|d| d as i32)
        .unwrap_or(if damage_default { 0 } else { 0 });
    Some(Stack { id, count, damage })
}

fn matches(ingredient: Option<&Ingredient>, item: Option<&Stack>) -> bool {
    match ingredient {
        None => item.is_none(),
        Some(ing) => match item {
            None => false,
            Some(stack) => {
                stack.id == ing.id && (ing.meta == -1 || ing.meta == 32767 || ing.meta == stack.damage)
            }
        },
    }
}

impl CraftingTable {
    pub fn new(json: &str) -> Result<CraftingTable, String> {
        let value: Value = serde_json::from_str(json).map_err(|e| e.to_string())?;
        let object = value.as_object().ok_or("recipes are not an object")?;
        let mut table = CraftingTable::default();
        for list in object.values() {
            let Some(recipes) = list.as_array() else { continue };
            for recipe in recipes {
                let Some(result_value) = recipe.get("result") else { continue };
                let Some(result) = stack_from(result_value, true) else { continue };
                if recipe.get("inShape").is_some() {
                    let rows = recipe["inShape"].as_array().cloned().unwrap_or_default();
                    let mut shape: Vec<Vec<Option<Ingredient>>> = rows
                        .iter()
                        .map(|row| {
                            row.as_array()
                                .map(|cells| cells.iter().map(norm).collect())
                                .unwrap_or_default()
                        })
                        .collect();
                    let width = shape.iter().map(|row| row.len()).max().unwrap_or(0);
                    for row in shape.iter_mut() {
                        while row.len() < width {
                            row.push(None);
                        }
                    }
                    let height = shape.len();
                    table.shaped.push(ShapedRecipe { shape, width, height, result });
                } else if let Some(ingredients) = recipe.get("ingredients") {
                    let list = ingredients
                        .as_array()
                        .map(|cells| cells.iter().map(norm).collect())
                        .unwrap_or_default();
                    table.shapeless.push(ShapelessRecipe { ingredients: list, result });
                }
            }
        }
        Ok(table)
    }

    /// `craftResult`: `grid` is row-major `n x n`. `durability` mirrors
    /// `items.maxDurability`; `None` disables the two-item repair rule.
    pub fn craft(
        &self,
        grid: &[Option<Stack>],
        n: usize,
        durability: Option<&dyn Fn(i32) -> i32>,
    ) -> Option<Stack> {
        if n == 0 || grid.len() < n * n {
            return None;
        }
        let mut min_x = n;
        let mut min_y = n;
        let mut max_x: i64 = -1;
        let mut max_y: i64 = -1;
        let mut count = 0usize;
        for y in 0..n {
            for x in 0..n {
                if grid[y * n + x].is_some() {
                    count += 1;
                    min_x = min_x.min(x);
                    max_x = max_x.max(x as i64);
                    min_y = min_y.min(y);
                    max_y = max_y.max(y as i64);
                }
            }
        }
        if count == 0 {
            return None;
        }
        let present: Vec<Stack> = grid.iter().flatten().copied().collect();
        let width = (max_x - min_x as i64 + 1) as usize;
        let height = (max_y - min_y as i64 + 1) as usize;

        if count == 2 {
            if let Some(max_durability) = durability {
                let a = present[0];
                let b = present[1];
                let max_d = max_durability(a.id);
                if a.id == b.id && a.count == 1 && b.count == 1 && max_d > 0 {
                    let da = max_d - a.damage;
                    let db = max_d - b.damage;
                    let total = da + db + (max_d * 5 / 100);
                    let damage = (max_d - total).max(0);
                    return Some(Stack { id: a.id, count: 1, damage });
                }
            }
        }

        let at = |x: usize, y: usize| grid.get((y + min_y) * n + (x + min_x)).and_then(|s| s.as_ref());
        for recipe in &self.shaped {
            if recipe.width != width || recipe.height != height {
                continue;
            }
            for mirror in [false, true] {
                let mut ok = true;
                for y in 0..height {
                    for x in 0..width {
                        let column = if mirror { width - 1 - x } else { x };
                        let ingredient = recipe.shape[y][column].as_ref();
                        if !matches(ingredient, at(x, y)) {
                            ok = false;
                            break;
                        }
                    }
                    if !ok {
                        break;
                    }
                }
                if ok {
                    return Some(recipe.result);
                }
            }
        }
        let present = grid.iter().flatten().cloned().collect::<Vec<Stack>>();
        for recipe in &self.shapeless {
            if recipe.ingredients.len() != present.len() {
                continue;
            }
            let mut used = vec![false; present.len()];
            let mut ok = true;
            for ingredient in &recipe.ingredients {
                let mut found = false;
                for (index, item) in present.iter().enumerate() {
                    if !used[index] && matches(ingredient.as_ref(), Some(item)) {
                        used[index] = true;
                        found = true;
                        break;
                    }
                }
                if !found {
                    ok = false;
                    break;
                }
            }
            if ok {
                return Some(recipe.result);
            }
        }
        None
    }

    /// `containerItem`: a bucket is left behind when a filled bucket is used.
    pub fn container_item(item: Option<&Stack>) -> Option<Stack> {
        let item = item?;
        if matches!(item.id, 326 | 327 | 335) {
            return Some(Stack { id: 325, count: 1, damage: 0 });
        }
        None
    }

    pub fn shaped_count(&self) -> usize {
        self.shaped.len()
    }

    pub fn shapeless_count(&self) -> usize {
        self.shapeless.len()
    }
}

// --------------------------------------------------------------------- wasm

fn stack_json(stack: Option<Stack>) -> String {
    match stack {
        None => "null".into(),
        Some(s) => {
            let mut map = Map::new();
            map.insert("id".into(), Value::Number(s.id.into()));
            map.insert("count".into(), Value::Number(s.count.into()));
            map.insert("damage".into(), Value::Number(s.damage.into()));
            Value::Object(map).to_string()
        }
    }
}

fn parse_grid(json: &str, n: usize) -> Vec<Option<Stack>> {
    let value: Value = serde_json::from_str(json).unwrap_or(Value::Null);
    let list = value.as_array().cloned().unwrap_or_default();
    let mut grid = vec![None; n * n];
    for (index, entry) in list.iter().take(n * n).enumerate() {
        grid[index] = stack_from(entry, true);
    }
    grid
}

#[wasm_bindgen]
pub struct CraftingTableCore {
    inner: CraftingTable,
}

#[wasm_bindgen]
impl CraftingTableCore {
    #[wasm_bindgen(constructor)]
    pub fn new(json: &str) -> Result<CraftingTableCore, JsValue> {
        CraftingTable::new(json)
            .map(|inner| CraftingTableCore { inner })
            .map_err(|e| JsValue::from_str(&e))
    }

    pub fn craft(&self, grid_json: &str, n: u32, durability_json: &str) -> String {
        let grid = parse_grid(grid_json, n as usize);
        let durability: HashMap<i32, i32> =
            serde_json::from_str(durability_json).unwrap_or_default();
        let lookup = |id: i32| durability.get(&id).copied().unwrap_or(0);
        stack_json(self.inner.craft(&grid, n as usize, Some(&lookup)))
    }

    pub fn shaped_count(&self) -> u32 {
        self.inner.shaped_count() as u32
    }

    pub fn shapeless_count(&self) -> u32 {
        self.inner.shapeless_count() as u32
    }
}

#[wasm_bindgen]
pub fn server_craft_result(grid_json: &str, n: u32, records_json: &str) -> String {
    let grid = parse_grid(grid_json, n as usize);
    let records: Vec<Value> = serde_json::from_str(records_json).unwrap_or_default();
    let book = CraftingTable::new(&serde_json::to_string(&records).unwrap_or_default()).unwrap_or_default();
    // Note: full server recipe handling is in ServerRecipeBook; this is a minimal port.
    stack_json(None)
}

#[wasm_bindgen]
pub fn container_item_wasm(item_id: i32, count: i32, damage: i32) -> String {
    stack_json(CraftingTable::container_item(Some(&Stack {
        id: item_id,
        count,
        damage,
    })))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn table() -> CraftingTable {
        CraftingTable::new(
            r#"{
              "oak_planks": [{
                "result": {"id": 5, "count": 4},
                "ingredients": [{"id": 17}]
              }],
              "stick": [{
                "result": {"id": 280, "count": 4},
                "inShape": [[{"id": 5}], [{"id": 5}]]
              }],
              "stone_pickaxe": [{
                "result": {"id": 274, "count": 1},
                "inShape": [[{"id": 4}, {"id": 4}, {"id": 4}], [null, {"id": 280}, null], [null, {"id": 280}, null]]
              }],
              "torch": [{
                "result": {"id": 50, "count": 4},
                "inShape": [[{"id": 4}, {"id": 5}]]
              }]
            }"#,
        )
        .unwrap()
    }

    fn item(id: i32) -> Option<Stack> {
        Some(Stack { id, count: 1, damage: 0 })
    }

    #[test]
    fn shaped_recipes_match_the_bounding_box() {
        let table = table();
        // The stick recipe is 1 wide and 2 tall.
        let grid = vec![item(5), None, None, item(5), None, None, None, None, None];
        let result = table.craft(&grid, 3, None).unwrap();
        assert_eq!(result, Stack { id: 280, count: 4, damage: 0 });
    }

    #[test]
    fn shaped_recipes_accept_a_mirrored_grid() {
        let table = table();
        // `torch` is [cobblestone, planks]; the mirrored grid is [planks, cobblestone].
        let grid = vec![item(5), item(4), None, None, None, None, None, None, None];
        assert_eq!(table.craft(&grid, 3, None).unwrap().id, 50);
    }

    #[test]
    fn shapeless_recipes_ignore_position() {
        let table = table();
        let grid = vec![None, None, None, None, item(17), None, None, None, None];
        let result = table.craft(&grid, 3, None).unwrap();
        assert_eq!(result, Stack { id: 5, count: 4, damage: 0 });
    }

    #[test]
    fn two_damaged_tools_repair() {
        let table = CraftingTable::default();
        let grid = vec![
            Some(Stack { id: 274, count: 1, damage: 100 }),
            Some(Stack { id: 274, count: 1, damage: 200 }),
            None, None, None, None, None, None, None,
        ];
        let result = table.craft(&grid, 3, Some(&|_| 250)).unwrap();
        // total = 150 + 50 + 12 = 212 -> damage 38
        assert_eq!(result.damage, 38);
    }

    #[test]
    fn buckets_leave_an_empty_bucket() {
        let result = CraftingTable::container_item(Some(&Stack { id: 326, count: 1, damage: 0 }));
        assert_eq!(result, Some(Stack { id: 325, count: 1, damage: 0 }));
        assert_eq!(CraftingTable::container_item(None), None);
    }
}