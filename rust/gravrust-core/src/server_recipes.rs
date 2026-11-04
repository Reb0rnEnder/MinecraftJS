// Port of `client/js/game/server-recipes.js` (server recipe handling).
use crate::items::Items;

// Clone helper matching JS structuredClone behavior for recipe data.
fn clone_recipe_data(data: &Option<serde_json::Value>) -> Option<serde_json::Value> {
    data.as_ref().map(|d| serde_json::to_value(d).ok()?.as_deref().and_then(|v| v.clone()).transpose().ok()?)
}

// Convert a server recipe record into a portable format.
#[derive(Clone, Debug)]
pub struct ServerRecipe {
    pub id: String,
    pub name: String,
    pub type: String,
    pub group: String,
    pub result: Option<serde_json::Value>,
    pub shaped: bool,
    pub width: i32,
    pub height: i32,
    pub cells: Vec<Option<Vec<IngredientCell>>>,
    pub experience: f64,
    pub cooking_time: i32,
}

#[derive(Clone, Debug)]
pub struct IngredientCell {
    pub id: String,
    pub data: i32,
}

impl From<serde_json::Value> for IngredientCell {
    fn from(v: serde_json::Value) -> Self {
        let obj = v.as_object().unwrap();
        IngredientCell {
            id: obj.get("id").and_then(|v| v.as_str()).unwrap_or("").to_string(),
            data: obj.get("data").and_then(|v| v.as_i32()).unwrap_or(0),
        }
    }
}

pub fn server_recipe(record: &serde_json::Value) -> Option<ServerRecipe> {
    let d = record.get("data")?;
    let type_val = record.get("type")?.as_str()? .replace("minecraft:", "");
    let shaped = type_val == "crafting_shaped";
    let raw = if shaped || type_val == "crafting_shapeless" {
        d.get("ingredients")?
    } else {
        d.get("ingredient")?.as_array()?.first().cloned()
    }?;
    if !d.get("result")?.is_object()? {
        return None;
    }
    let result = Some(clone_recipe_data(&d.get("result")?)?);
    let width = if shaped {
        d.get("width")?.as_i32()?
    } else {
        let n = raw.as_array()?.len();
        (n as f64).sqrt().ceil() as i32
    };
    let height = if shaped {
        d.get("height")?.as_i32()?
    } else {
        let n = raw.as_array()?.len();
        (n as f64).sqrt().ceil() as i32
    };
    let cells = raw.as_array()?
        .iter()
        .map(|alt| {
            alt.as_array()
                .map(|arr| {
                    arr.iter()
                        .map(|s| IngredientCell::from(s.clone()))
                        .collect()
                })
                .or(Some(vec![]))
        })
        .collect();
    let experience = d.get("experience")?.as_f64()?;
    let cooking_time = d.get("cookingTime")?.as_i32()?;

    Some(ServerRecipe {
        id: record.get("recipeId")?.as_str()?.to_string(),
        name: record.get("recipeId")?.as_str()?.to_string(),
        type: type_val,
        group: d.get("group")?.as_str()?.unwrap_or("").to_string(),
        result,
        shaped,
        width,
        height,
        cells,
        experience,
        cooking_time,
    })
}

fn matches_ingredient(alternatives: &[IngredientCell], item: &IngredientCell) -> bool {
    if alternatives.is_empty() {
        return false;
    }
    alternatives.iter().any(|s| s.id == item.id && s.data == item.data)
}

pub fn server_craft_result(grid: &[IngredientCell], n: i32, recipes: &[ServerRecipe]) -> Option<serde_json::Value> {
    let present: Vec<IngredientCell> = grid.to_vec();
    if present.is_empty() {
        return None;
    }
    for r in recipes {
        let kind = r.type.as_str();
        if kind != "crafting_shaped" && kind != "crafting_shapeless" {
            continue;
        }
        if r.shaped {
            if r.width > n || r.height > n {
                continue;
            }
            for _ox in 0..=(n - r.width) {
                for _oy in 0..=(n - r.height) {
                    for _mirror in [false, true] {
                        let mut ok = true;
                        for y in 0..n {
                            for x in 0..n {
                                let rx = x - _ox;
                                let ry = y - _oy;
                                let inside = rx >= 0 && rx < r.width && ry >= 0 && ry < r.height;
                                let cell = if inside {
                                    r.cells.get(ry * r.width + (if _mirror {
                                        r.width - 1 - rx
                                    } else {
                                        rx
                                    }))
                                } else {
                                    None
                                };
                                let grid_cell = present.get(y * n + x);
                                if let (Some(c), Some(g)) = (cell, grid_cell) {
                                    if !matches_ingredient(c, g) {
                                        ok = false;
                                        break;
                                    }
                                }
                            }
                            if !ok {
                                break;
                            }
                        }
                        if ok {
                            return r.result.clone();
                        }
                    }
                }
            }
        } else {
            let cells = r.cells.iter().filter(|c| c.is_some()).collect::<Vec<_>>();
            if cells.len() != present.len() {
                continue;
            }
            let mut used = std::collections::HashSet::new();
            let search = |i: usize| -> bool {
                if i >= cells.len() {
                    return true;
                }
                for j in 0..present.len() {
                    if !used.contains(&j) && matches_ingredient(&cells[i].as_ref().unwrap(), &present[j]) {
                        used.insert(j);
                        if search(i + 1) {
                            return true;
                        }
                        used.delete(&j);
                    }
                }
                false
            };
            if search(0) {
                return r.result.clone();
            }
        }
    }
    None
}

pub fn replace_server_recipes(game: &mut GameRecipes, recipes: &[ServerRecipe]) {
    game.server_recipes = recipes.to_vec();
    game.items.server_recipes = recipes.iter().filter_map(|r| server_recipe(r).ok()).map(|r| r.id.clone()).collect();
    game.recipe_book.recipes = None;
    game.recipe_book.lists = None;
    if let Some(screen) = game.screens.current.as_mut() {
        if screen.recipe_book.ghost.is_some() {
            screen.recipe_book.ghost = None;
        }
        if screen.recipe_book.overlay.is_some() {
            screen.recipe_book.overlay = None;
        }
        screen.recipe_book.update(true);
    }
}

pub fn reset_server_recipes(game: &mut GameRecipes) {
    game.server_recipes = vec![];
    if let Some(items) = &mut game.items {
        items.server_recipes = vec![];
    }
    if let Some(recipe_book) = &mut game.recipe_book {
        recipe_book.recipes = None;
        recipe_book.lists = None;
        recipe_book.known.clear();
        recipe_book.fresh.clear();
        recipe_book.open = false;
        recipe_book.filtering = false;
        for state in recipe_book.cooking_states.values() {
            state.open = false;
            state.filtering = false;
        }
    }
}

// Game state container for server recipes
#[derive(Clone, Debug)]
pub struct GameRecipes {
    pub server_recipes: Vec<ServerRecipe>,
    pub items: Items,
}

// Convenience constructor
impl GameRecipes {
    pub fn new(items: Items) -> Self {
        Self {
            server_recipes: vec![],
            items,
        }
    }
}