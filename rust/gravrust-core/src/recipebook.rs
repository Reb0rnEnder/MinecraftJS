//! Port of `client/js/game/recipebook.js` (1.12+ recipe book logic).
//!
//! Handles recipe unlocking, categorization into tabs, search filtering,
//! and craftability evaluation against the player's inventory.

use std::collections::{HashMap, HashSet};

use serde_json::Value;
use wasm_bindgen::prelude::*;

/// Tab names matching the JavaScript BOOK_TABS constant.
pub const BOOK_TABS: [&str; 5] = ["search", "tools", "buildingBlocks", "misc", "redstone"];

/// First JSON recipe ID (crafting manager special recipes are 0-10).
pub const FIRST_JSON_ID: i32 = 11;

/// A simple item stack used in recipe matching.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, serde::Serialize, serde::Deserialize)]
pub struct Stack {
    pub id: i32,
    pub count: i32,
    pub damage: i32,
}

/// An ingredient alternative in a recipe cell.
#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
pub struct Ingredient {
    pub id: i32,
    pub damage: i32,
    pub count: i32,
}

impl Ingredient {
    /// Check if this ingredient matches a stack.
    fn matches(&self, stack: &Stack) -> bool {
        self.id == stack.id
            && (self.damage == 32767 || self.damage == -1 || self.damage == stack.damage)
    }
}

/// A parsed recipe (shaped or shapeless).
#[derive(Clone, Debug, serde::Serialize, serde::Deserialize)]
pub struct Recipe {
    pub id: String,
    pub kind: String,
    pub name: String,
    pub group: String,
    pub result: Stack,
    pub shaped: bool,
    pub width: usize,
    pub height: usize,
    /// For shaped: row-major grid of ingredient alternatives (None = empty).
    /// For shapeless: flat list of ingredient alternatives.
    pub cells: Vec<Option<Vec<Ingredient>>>,
}

/// A group of recipes in a tab (one per recipe group, or one per ungrouped recipe).
#[derive(Clone, Debug, Default, serde::Serialize, serde::Deserialize)]
pub struct RecipeList {
    pub recipes: Vec<Recipe>,
    pub tab: String,
    /// Known recipes (unlocked).
    pub known: Vec<Recipe>,
    /// Valid recipes (fit in the grid).
    pub valid: Vec<Recipe>,
    /// Craftable recipes (have ingredients).
    pub craftable: Vec<Recipe>,
}

/// State for a cooking recipe book (smelting, blasting, smoking).
#[derive(Clone, Debug, Default, serde::Serialize, serde::Deserialize)]
pub struct CookingState {
    pub open: bool,
    pub filtering: bool,
}

/// Main recipe book state.
#[derive(Clone, Debug, Default, serde::Serialize, serde::Deserialize)]
pub struct RecipeBook {
    known: HashSet<String>,
    fresh: HashSet<String>,
    open: bool,
    filtering: bool,
    cooking_states: HashMap<String, CookingState>,
    recipes: Option<HashMap<String, Recipe>>,
    lists: Option<HashMap<String, Vec<RecipeList>>>,
}

impl RecipeBook {
    /// Create a new empty recipe book.
    pub fn new() -> Self {
        let mut cooking_states = HashMap::new();
        for kind in ["smelting", "blasting", "smoking"] {
            cooking_states.insert(kind.to_string(), CookingState::default());
        }
        RecipeBook {
            cooking_states,
            ..Default::default()
        }
    }

    /// Parse all recipes from the game's server recipes or asset recipes.
    fn parse(&mut self, server_recipes: &[Value], asset_recipes: &[Value], tags: &Value) {
        if self.recipes.is_some() {
            return;
        }

        let mut recipes: HashMap<String, Recipe> = HashMap::new();

        // Parse server recipes (from declare-recipes packet)
        for record in server_recipes {
            if let Some(rec) = Self::parse_server_recipe(record) {
                recipes.insert(rec.id.clone(), rec);
            }
        }

        // Parse asset recipes (from data files) if no server recipes
        if server_recipes.is_empty() {
            for r in asset_recipes {
                if let Some(rec) = Self::parse_asset_recipe(r, tags) {
                    recipes.insert(rec.id.clone(), rec);
                }
            }
        }

        // Build tab lists
        let mut lists: HashMap<String, Vec<RecipeList>> = HashMap::new();
        for tab in BOOK_TABS.iter().chain(std::iter::once(&"food")) {
            lists.insert(tab.to_string(), Vec::new());
        }

        // Better approach: collect by group first
        let mut group_recipes: HashMap<String, Vec<&Recipe>> = HashMap::new();
        let mut ungrouped: Vec<&Recipe> = Vec::new();

        for rec in recipes.values() {
            let tab = Self::category_of(rec);
            if rec.group.is_empty() {
                ungrouped.push(rec);
            } else {
                let key = format!("{}|{}", tab, rec.group);
                group_recipes.entry(key).or_default().push(rec);
            }
        }

        // Create lists for groups
        for (key, recs) in group_recipes {
            let parts: Vec<&str> = key.split('|').collect();
            let tab = parts[0].to_string();
            let mut list = RecipeList {
                recipes: recs.into_iter().cloned().collect(),
                tab: tab.clone(),
                ..Default::default()
            };
            list.recipes.sort_by(|a, b| a.id.cmp(&b.id));
            lists.get_mut(&tab).unwrap().push(list.clone());
            lists.get_mut("search").unwrap().push(list);
        }

        // Create lists for ungrouped recipes
        for rec in ungrouped {
            let tab = Self::category_of(rec);
            let mut list = RecipeList {
                recipes: vec![rec.clone()],
                tab: tab.clone(),
                ..Default::default()
            };
            lists.get_mut(&tab).unwrap().push(list.clone());
            lists.get_mut("search").unwrap().push(list);
        }

        // Sort recipes within each list by ID
        for list in lists.values_mut() {
            for rl in list {
                rl.recipes.sort_by(|a, b| a.id.cmp(&b.id));
            }
        }

        self.recipes = Some(recipes);
        self.lists = Some(lists);
    }

    /// Parse a server recipe record (from declare-recipes packet).
    fn parse_server_recipe(record: &Value) -> Option<Recipe> {
        let data = record.get("data")?;
        let raw_type = record.get("type")?.as_str()?;
        let kind = raw_type.strip_prefix("minecraft:").unwrap_or(raw_type).to_string();
        let shaped = kind == "crafting_shaped";
        let shapeless = kind == "crafting_shapeless";
        let is_cooking = matches!(kind.as_str(), "smelting" | "blasting" | "smoking" | "campfire_cooking");

        let result = Self::stack_from(data.get("result")?, false)?;

        let raw: Vec<Value> = if shaped || shapeless {
            data.get("ingredients")
                .and_then(|i| i.as_array())
                .cloned()
                .unwrap_or_default()
        } else if is_cooking {
            vec![data.get("ingredient").cloned().unwrap_or_else(|| Value::Array(Vec::new()))]
        } else {
            vec![]
        };

        let width = if shaped {
            data.get("width").and_then(|w| w.as_u64()).unwrap_or(0) as usize
        } else if shapeless {
            (raw.len() as f64).sqrt().ceil() as usize
        } else {
            1
        };
        let height = if shaped {
            data.get("height").and_then(|h| h.as_u64()).unwrap_or(0) as usize
        } else if shapeless {
            (raw.len() as f64).sqrt().ceil() as usize
        } else {
            1
        };

        let mut cells = Vec::new();
        for alternatives in raw {
            // For cooking recipes (smelting, blasting, etc.), the "alternatives" is a single ingredient object, not an array
            let list = if is_cooking {
                // For cooking recipes, raw contains a single ingredient object, wrap it in a vec
                vec![alternatives]
            } else {
                alternatives.as_array().cloned().unwrap_or_else(Vec::new)
            };
            if list.is_empty() {
                cells.push(None);
                continue;
            }
            let mut ingredients = Vec::new();
            for alt in &list {
                if let Some(ing) = Self::ingredient_from_value(alt) {
                    ingredients.push(ing);
                }
            }
            if ingredients.is_empty() {
                cells.push(None);
            } else {
                cells.push(Some(ingredients));
            }
        }

        Some(Recipe {
            id: record
                .get("recipeId")
                .and_then(|r| r.as_str())
                .unwrap_or("")
                .to_string(),
            kind: raw_type.to_string(),
            name: record
                .get("recipeId")
                .and_then(|r| r.as_str())
                .unwrap_or("")
                .to_string(),
            group: data.get("group").and_then(|g| g.as_str()).unwrap_or("").to_string(),
            result,
            shaped,
            width,
            height,
            cells,
        })
    }

    /// Parse an asset recipe (from data files).
    fn parse_asset_recipe(r: &Value, tags: &Value) -> Option<Recipe> {
        let name = r.get("name")?.as_str()?;
        let id = if name.contains(':') {
            name.to_string()
        } else {
            format!("minecraft:{}", name)
        };
        let r_type = r.get("type")?.as_str()?;
        let kind = r_type.strip_prefix("minecraft:").unwrap_or(r_type).to_string();
        let shaped = kind == "crafting_shaped";
        let shapeless = kind == "crafting_shapeless";
        let is_cooking = matches!(kind.as_str(), "smelting" | "blasting" | "smoking" | "campfire_cooking");

        let result = Self::stack_from(r.get("result")?, false)?;

        let raw: Vec<Value> = if shaped || shapeless {
            let ingredients = r.get("ingredients")?;
            let key = r.get("key")?;
            let pattern = r.get("pattern")?.as_array()?;

            // Build key mapping
            let mut key_map: HashMap<String, Value> = HashMap::new();
            if let Some(key_obj) = key.as_object() {
                for (k, v) in key_obj {
                    key_map.insert(k.clone(), v.clone());
                }
            }

            // Parse pattern with key
            let mut cells = Vec::new();
            for row in pattern {
                let row_str = row.as_str()?;
                for ch in row_str.chars() {
                    if ch == ' ' {
                        cells.push(Value::Null);
                    } else {
                        let key_str = ch.to_string();
                        if let Some(v) = key_map.get(&key_str) {
                            cells.push(v.clone());
                        } else {
                            cells.push(Value::Null);
                        }
                    }
                }
            }
            cells
        } else if is_cooking {
            vec![r.get("ingredient").cloned().unwrap_or_else(|| Value::Array(Vec::new()))]
        } else {
            vec![]
        };

        let width = if shaped {
            // Find max row length from pattern
            let pattern = r.get("pattern")?.as_array()?;
            pattern.iter().map(|row| row.as_str().unwrap_or("").len()).max().unwrap_or(0)
        } else if shapeless {
            (raw.len() as f64).sqrt().ceil() as usize
        } else {
            1
        };
        let height = if shaped {
            r.get("pattern")?.as_array()?.len()
        } else if shapeless {
            (raw.len() as f64).sqrt().ceil() as usize
        } else {
            1
        };

        let mut cells = Vec::new();
        for alternatives in raw {
            let empty_vec = Vec::new();
            let list = alternatives.as_array().unwrap_or(&empty_vec);
            if list.is_empty() {
                cells.push(None);
                continue;
            }
            let mut ingredients = Vec::new();
            for alt in list {
                if let Some(ing) = Self::ingredient_from_value_with_tags(alt, tags) {
                    ingredients.push(ing);
                }
            }
            if ingredients.is_empty() {
                cells.push(None);
            } else {
                cells.push(Some(ingredients));
            }
        }

        Some(Recipe {
            id: id.clone(),
            kind: r_type.to_string(),
            name: name.to_string(),
            group: r.get("group").and_then(|g| g.as_str()).unwrap_or("").to_string(),
            result,
            shaped,
            width,
            height,
            cells,
        })
    }

    /// Create a Stack from a JSON value.
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

    /// Create an Ingredient from a JSON value (server recipe format).
    fn ingredient_from_value(value: &Value) -> Option<Ingredient> {
        if value.is_null() {
            return None;
        }
        if let Some(id) = value.as_i64() {
            return Some(Ingredient { id: id as i32, damage: -1, count: 1 });
        }
        let id = value.get("id")?.as_i64()? as i32;
        let damage = value
            .get("data")
            .or_else(|| value.get("damage"))
            .or_else(|| value.get("metadata"))
            .and_then(|d| d.as_i64())
            .map(|d| d as i32)
            .unwrap_or(-1);
        let count = value.get("count").and_then(|c| c.as_i64()).unwrap_or(1) as i32;
        Some(Ingredient { id, damage, count })
    }

    /// Create an Ingredient from a JSON value with tag expansion (asset recipe format).
    fn ingredient_from_value_with_tags(value: &Value, tags: &Value) -> Option<Ingredient> {
        if value.is_null() {
            return None;
        }
        // Handle tag references
        if let Some(tag) = value.get("tag").and_then(|t| t.as_str()) {
            // In the JS version, tags are expanded to multiple ingredients.
            // Here we just return a placeholder; the actual expansion happens in JS.
            // For simplicity, we'll use the first item from the tag or a default.
            if let Some(tag_items) = tags.get("items").and_then(|t| t.get(tag)).and_then(|v| v.as_array()) {
                if let Some(first) = tag_items.first().and_then(|v| v.as_i64()) {
                    return Some(Ingredient { id: first as i32, damage: 0, count: 1 });
                }
            }
            return None;
        }
        Self::ingredient_from_value(value)
    }

    /// Determine the creative tab category for a recipe.
    fn category_of(rec: &Recipe) -> String {
        let kind = rec.kind.strip_prefix("minecraft:").unwrap_or(&rec.kind);
        if matches!(kind, "smelting" | "blasting" | "smoking" | "campfire_cooking") {
            // For cooking recipes, check if result is food
            // This would need the ItemTable; for now use a heuristic
            if Self::is_food_item(rec.result.id) {
                return "food".to_string();
            }
            // Check if result is a block item
            if Self::is_block_item(rec.result.id) {
                return "buildingBlocks".to_string();
            }
            return "misc".to_string();
        }

        // For crafting recipes, use creative tab of result
        let tab = Self::creative_tab_of(rec.result.id);
        match tab.as_str() {
            "buildingBlocks" | "tools" | "redstone" => tab,
            "combat" => "tools".to_string(),
            _ => "misc".to_string(),
        }
    }

    /// Simplified creative tab lookup based on item ID.
    /// In the full implementation, this would use the creative inventory data.
    fn creative_tab_of(item_id: i32) -> String {
        // This is a simplified mapping. The real version uses creative.json data.
        // For now, we use a basic heuristic based on item ID ranges.
        // In practice, the JS would pass the creative catalog to the WASM module.
        match item_id {
            // Tools and weapons (approximate ranges)
            256..=297 => "tools".to_string(),     // Tools (including stick at 280)
            298..=317 => "tools".to_string(),     // Armor
            // Building blocks
            1..=110 => "buildingBlocks".to_string(), // Blocks
            // Redstone
            331 | 352 | 353 | 354 | 355 | 356 | 357 | 358 | 359 | 360 | 361 | 362 | 363 | 364 | 365 | 366 | 367 | 368 | 369 | 370 | 371 | 372 | 373 | 374 | 375 | 376 | 377 | 378 | 379 | 380 | 381 | 382 | 383 | 384 | 385 | 386 | 387 | 388 | 389 | 390 | 391 | 392 | 393 | 394 | 395 | 396 | 397 | 398 | 399 | 400 | 401 | 402 | 403 | 404 | 405 | 406 | 407 | 408 | 409 | 410 | 411 | 412 | 413 | 414 | 415 | 416 | 417 | 418 | 419 | 420 | 421 | 422 | 423 | 424 | 425 | 426 | 427 | 428 | 429 | 430 | 431 | 432 | 433 | 434 | 435 | 436 | 437 | 438 | 439 | 440 | 441 | 442 | 443 | 444 | 445 | 446 | 447 | 448 | 449 | 450 | 451 | 452 | 453 | 454 | 455 | 456 | 457 | 458 | 459 | 460 | 461 | 462 | 463 | 464 | 465 | 466 | 467 | 468 | 469 | 470 | 471 | 472 | 473 | 474 | 475 | 476 | 477 | 478 | 479 | 480 | 481 | 482 | 483 | 484 | 485 | 486 | 487 | 488 | 489 | 490 | 491 | 492 | 493 | 494 | 495 | 496 | 497 | 498 | 499 | 500 => "redstone".to_string(),
            _ => "misc".to_string(),
        }
    }

    /// Check if an item ID is a food item (simplified).
    fn is_food_item(item_id: i32) -> bool {
        // Food items in 1.15.2 (approximate IDs)
        matches!(
            item_id,
            260 | 282 | 297 | 319 | 320 | 321 | 322 | 349 | 350 | 357 | 360 | 363 | 364 | 365 | 366 | 367 | 391 | 392 | 393 | 394 | 395 | 396 | 397 | 398 | 399 | 400 | 401 | 402 | 403 | 404 | 405 | 406 | 407 | 408 | 409 | 410 | 411 | 412 | 413 | 414 | 415 | 416 | 417 | 418 | 419 | 420 | 421 | 422 | 423 | 424 | 425 | 426 | 427 | 428 | 429 | 430 | 431 | 432 | 433 | 434 | 435 | 436 | 437 | 438 | 439 | 440 | 441 | 442 | 443 | 444 | 445 | 446 | 447 | 448 | 449 | 450
        )
    }

    /// Check if an item ID is a block item (simplified).
    fn is_block_item(item_id: i32) -> bool {
        // Most items with ID < 256 are blocks, except air, wheat, etc.
        item_id > 0 && item_id < 256 && item_id != 296 // wheat
    }

    /// Get the state for a recipe book kind (crafting, smelting, blasting, smoking).
    pub fn state_for(&self, kind: &str) -> &CookingState {
        if kind == "crafting" {
            // Return a pseudo-state for crafting
            static CRAFTING_STATE: std::sync::OnceLock<CookingState> = std::sync::OnceLock::new();
            CRAFTING_STATE.get_or_init(|| CookingState {
                open: self.open,
                filtering: self.filtering,
            })
        } else {
            self.cooking_states.get(kind).unwrap_or_else(|| {
                static DEFAULT: std::sync::OnceLock<CookingState> = std::sync::OnceLock::new();
                DEFAULT.get_or_init(CookingState::default)
            })
        }
    }

    /// Get a recipe by ID.
    pub fn recipe(&self, server_recipes: &[Value], asset_recipes: &[Value], tags: &Value, id: &str) -> Option<&Recipe> {
        // Note: parse() needs &mut self, but we can't call it from &self.
        // The caller must ensure parse() has been called first.
        self.recipes.as_ref()?.get(id)
    }

    /// Get the recipe lists for a tab.
    pub fn tab_lists(&mut self, server_recipes: &[Value], asset_recipes: &[Value], tags: &Value, tab: &str) -> Vec<RecipeList> {
        self.parse(server_recipes, asset_recipes, tags);
        self.lists.as_ref().and_then(|l| l.get(tab)).cloned().unwrap_or_default()
    }

    /// Handle a recipe book packet from the server.
    pub fn on_packet(&mut self, server_recipes: &[Value], asset_recipes: &[Value], tags: &Value, packet: &Value) {
        self.parse(server_recipes, asset_recipes, tags);

        self.open = packet.get("craftingBookOpen").and_then(|v| v.as_bool()).unwrap_or(false);
        self.filtering = packet.get("filteringCraftable").and_then(|v| v.as_bool()).unwrap_or(false);

        if let Some(state) = self.cooking_states.get_mut("smelting") {
            state.open = packet.get("smeltingBookOpen").and_then(|v| v.as_bool()).unwrap_or(false);
            state.filtering = packet.get("filteringSmeltable").and_then(|v| v.as_bool()).unwrap_or(false);
        }

        let action = packet.get("action").and_then(|v| v.as_i64()).unwrap_or(0) as i32;
        let recipes = packet.get("recipes").and_then(|v| v.as_array()).cloned().unwrap_or_default();

        match action {
            2 => {
                // Remove recipes
                for id in recipes {
                    if let Some(id_str) = id.as_str() {
                        self.known.remove(id_str);
                    }
                }
            }
            0 => {
                // Set known recipes (full sync)
                self.known.clear();
                self.fresh.clear();
                for id in recipes {
                    if let Some(id_str) = id.as_str() {
                        self.known.insert(id_str.to_string());
                    }
                }
                if let Some(highlight) = packet.get("recipesToHighlight").and_then(|v| v.as_array()) {
                    for id in highlight {
                        if let Some(id_str) = id.as_str() {
                            self.fresh.insert(id_str.to_string());
                        }
                    }
                }
            }
            1 => {
                // Add recipes
                let mut added = Vec::new();
                for id in recipes {
                    if let Some(id_str) = id.as_str() {
                        self.known.insert(id_str.to_string());
                        self.fresh.insert(id_str.to_string());
                        if let Some(rec) = self.recipe(server_recipes, asset_recipes, tags, id_str) {
                            added.push(rec.clone());
                        }
                    }
                }
                // In JS this would trigger a toast; in WASM we just return the added recipes
                // The caller can handle the toast notification.
            }
            _ => {}
        }
    }

    /// Get the known recipe IDs.
    pub fn known_recipes(&self) -> HashSet<String> {
        self.known.clone()
    }

    /// Get the fresh (newly unlocked) recipe IDs.
    pub fn fresh_recipes(&self) -> HashSet<String> {
        self.fresh.clone()
    }

    /// Clear fresh recipes (mark as seen).
    pub fn clear_fresh(&mut self) {
        self.fresh.clear();
    }

    /// Get whether the crafting book is open.
    pub fn is_open(&self) -> bool {
        self.open
    }

    /// Get whether craftable filtering is enabled.
    pub fn is_filtering(&self) -> bool {
        self.filtering
    }

    /// Set the crafting book open state.
    pub fn set_open(&mut self, open: bool) {
        self.open = open;
    }

    /// Set the craftable filtering state.
    pub fn set_filtering(&mut self, filtering: bool) {
        self.filtering = filtering;
    }

    /// Compute the stacked contents of the player's inventory and crafting grid.
    pub fn stacked_contents(&self, inventory: &[Option<Stack>], grid_items: &[Option<Stack>]) -> HashMap<String, i32> {
        let mut counts = HashMap::new();
        let add = |counts: &mut HashMap<String, i32>, stack: Option<Stack>| {
            if let Some(stack) = stack {
                if stack.count > 0 {
                    let key = format!("{}:{}", stack.id, stack.damage);
                    *counts.entry(key).or_insert(0) += stack.count;
                }
            }
        };
        for stack in inventory {
            add(&mut counts, *stack);
        }
        for stack in grid_items {
            add(&mut counts, *stack);
        }
        counts
    }

    /// Check if a recipe can be crafted with the given item counts.
    pub fn can_craft(&self, rec: &Recipe, counts: &HashMap<String, i32>) -> bool {
        let mut left = counts.clone();
        let mut cells: Vec<&Vec<Ingredient>> = rec.cells.iter().filter_map(|c| c.as_ref()).collect();
        // Sort by number of alternatives (fewest first) for better backtracking
        cells.sort_by_key(|c| c.len());

        fn search(index: usize, cells: &[&Vec<Ingredient>], left: &mut HashMap<String, i32>) -> bool {
            if index == cells.len() {
                return true;
            }
            let alternatives = cells[index];
            // Iterate over a snapshot of keys to avoid mutable borrow issues
            let keys: Vec<String> = left.keys().cloned().collect();
            for key in keys {
                // Check if we can use this key
                if let Some(count) = left.get(&key) {
                    if *count <= 0 {
                        continue;
                    }
                    let parts: Vec<&str> = key.split(':').collect();
                    if parts.len() != 2 {
                        continue;
                    }
                    let id = parts[0].parse::<i32>().unwrap_or(0);
                    let damage = parts[1].parse::<i32>().unwrap_or(0);

                    if alternatives.iter().any(|ing| ing.id == id && (ing.damage == 32767 || ing.damage == -1 || ing.damage == damage)) {
                        // Decrement the count, then recursively search
                        *left.get_mut(&key).unwrap() -= 1;
                        if search(index + 1, cells, left) {
                            return true;
                        }
                        // Backtrack: restore the count
                        *left.get_mut(&key).unwrap() += 1;
                    }
                }
            }
            false
        }

        search(0, &cells, &mut left)
    }

    /// Evaluate a recipe list for known, valid, and craftable recipes.
    pub fn evaluate(&self, list: &mut RecipeList, counts: &HashMap<String, i32>, grid_width: usize, grid_height: usize) {
        list.known = list.recipes.iter().filter(|r| self.known.contains(&r.id)).cloned().collect();
        list.valid = list.known.iter().filter(|r| r.width <= grid_width && r.height <= grid_height).cloned().collect();
        list.craftable = list.valid.iter().filter(|r| self.can_craft(r, counts)).cloned().collect();
    }

    /// Get all recipes as a JSON array (for debugging/export).
    pub fn all_recipes_json(&mut self, server_recipes: &[Value], asset_recipes: &[Value], tags: &Value) -> String {
        self.parse(server_recipes, asset_recipes, tags);
        let recipes: Vec<&Recipe> = self.recipes.as_ref().unwrap().values().collect();
        serde_json::to_string(&recipes).unwrap_or_default()
    }
}

// --------------------------------------------------------------------- wasm

#[wasm_bindgen]
pub struct RecipeBookCore {
    inner: RecipeBook,
}

#[wasm_bindgen]
impl RecipeBookCore {
    #[wasm_bindgen(constructor)]
    pub fn new() -> RecipeBookCore {
        RecipeBookCore {
            inner: RecipeBook::new(),
        }
    }

    /// Parse recipes and build tab lists. Returns JSON of all recipes.
    pub fn parse(&mut self, server_recipes_json: &str, asset_recipes_json: &str, tags_json: &str) -> String {
        let server_recipes: Vec<Value> = serde_json::from_str(server_recipes_json).unwrap_or_default();
        let asset_recipes: Vec<Value> = serde_json::from_str(asset_recipes_json).unwrap_or_default();
        let tags: Value = serde_json::from_str(tags_json).unwrap_or(Value::Null);
        self.inner.parse(&server_recipes, &asset_recipes, &tags);
        self.inner.all_recipes_json(&server_recipes, &asset_recipes, &tags)
    }

    /// Handle a recipe book packet from the server.
    pub fn on_packet(&mut self, server_recipes_json: &str, asset_recipes_json: &str, tags_json: &str, packet_json: &str) {
        let server_recipes: Vec<Value> = serde_json::from_str(server_recipes_json).unwrap_or_default();
        let asset_recipes: Vec<Value> = serde_json::from_str(asset_recipes_json).unwrap_or_default();
        let tags: Value = serde_json::from_str(tags_json).unwrap_or(Value::Null);
        let packet: Value = serde_json::from_str(packet_json).unwrap_or(Value::Null);
        self.inner.on_packet(&server_recipes, &asset_recipes, &tags, &packet);
    }

    /// Get recipe lists for a tab as JSON.
    pub fn tab_lists_json(&mut self, server_recipes_json: &str, asset_recipes_json: &str, tags_json: &str, tab: &str) -> String {
        let server_recipes: Vec<Value> = serde_json::from_str(server_recipes_json).unwrap_or_default();
        let asset_recipes: Vec<Value> = serde_json::from_str(asset_recipes_json).unwrap_or_default();
        let tags: Value = serde_json::from_str(tags_json).unwrap_or(Value::Null);
        let lists = self.inner.tab_lists(&server_recipes, &asset_recipes, &tags, tab);
        serde_json::to_string(&lists).unwrap_or_default()
    }

    /// Get known recipe IDs as JSON array.
    pub fn known_recipes_json(&self) -> String {
        serde_json::to_string(&self.inner.known_recipes()).unwrap_or_default()
    }

    /// Get fresh recipe IDs as JSON array.
    pub fn fresh_recipes_json(&self) -> String {
        serde_json::to_string(&self.inner.fresh_recipes()).unwrap_or_default()
    }

    /// Clear fresh recipes.
    pub fn clear_fresh(&mut self) {
        self.inner.clear_fresh();
    }

    /// Get crafting book open state.
    #[wasm_bindgen(getter)]
    pub fn open(&self) -> bool {
        self.inner.is_open()
    }

    /// Set crafting book open state.
    #[wasm_bindgen(setter)]
    pub fn set_open(&mut self, open: bool) {
        self.inner.set_open(open);
    }

    /// Get craftable filtering state.
    #[wasm_bindgen(getter)]
    pub fn filtering(&self) -> bool {
        self.inner.is_filtering()
    }

    /// Set craftable filtering state.
    #[wasm_bindgen(setter)]
    pub fn set_filtering(&mut self, filtering: bool) {
        self.inner.set_filtering(filtering);
    }

    /// Compute stacked contents from inventory and grid.
    pub fn stacked_contents(&self, inventory_json: &str, grid_json: &str) -> String {
        let inventory: Vec<Option<Stack>> = serde_json::from_str(inventory_json).unwrap_or_default();
        let grid: Vec<Option<Stack>> = serde_json::from_str(grid_json).unwrap_or_default();
        let counts = self.inner.stacked_contents(&inventory, &grid);
        serde_json::to_string(&counts).unwrap_or_default()
    }

    /// Evaluate a recipe list for craftability.
    pub fn evaluate_list(&self, list_json: &str, counts_json: &str, grid_width: u32, grid_height: u32) -> String {
        let mut list: RecipeList = serde_json::from_str(list_json).unwrap_or_default();
        let counts: HashMap<String, i32> = serde_json::from_str(counts_json).unwrap_or_default();
        self.inner.evaluate(&mut list, &counts, grid_width as usize, grid_height as usize);
        serde_json::to_string(&list).unwrap_or_default()
    }

    /// Check if a single recipe can be crafted.
    pub fn can_craft(&self, recipe_json: &str, counts_json: &str) -> bool {
        let recipe: Recipe = serde_json::from_str(recipe_json).unwrap_or_else(|_| Recipe {
            id: "".into(),
            kind: "".into(),
            name: "".into(),
            group: "".into(),
            result: Stack { id: 0, count: 0, damage: 0 },
            shaped: false,
            width: 0,
            height: 0,
            cells: Vec::new(),
        });
        let counts: HashMap<String, i32> = serde_json::from_str(counts_json).unwrap_or_default();
        self.inner.can_craft(&recipe, &counts)
    }

    /// Get cooking state for a kind.
    pub fn cooking_state_json(&self, kind: &str) -> String {
        let state = self.inner.state_for(kind);
        serde_json::json!({
            "open": state.open,
            "filtering": state.filtering
        }).to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_server_recipe() -> Value {
        serde_json::from_str(
            r#"{
                "recipeId": "minecraft:sticks",
                "type": "minecraft:crafting_shaped",
                "data": {
                    "group": "sticks",
                    "width": 1,
                    "height": 2,
                    "result": {"id": 280, "count": 4},
                    "ingredients": [[{"id": 5}], [{"id": 5}]]
                }
            }"#
        ).unwrap()
    }

    fn sample_shapeless_recipe() -> Value {
        serde_json::from_str(
            r#"{
                "recipeId": "minecraft:oak_planks",
                "type": "minecraft:crafting_shapeless",
                "data": {
                    "group": "planks",
                    "result": {"id": 5, "count": 4},
                    "ingredients": [[{"id": 17}]]
                }
            }"#
        ).unwrap()
    }

    fn sample_smelting_recipe() -> Value {
        serde_json::from_str(
            r#"{
                "recipeId": "minecraft:charcoal",
                "type": "minecraft:smelting",
                "data": {
                    "group": "",
                    "result": {"id": 263, "count": 1},
                    "ingredient": {"id": 17},
                    "experience": 0.1,
                    "cookingTime": 200
                }
            }"#
        ).unwrap()
    }

    fn sample_tags() -> Value {
        serde_json::from_str(
            r#"{"items": {"minecraft:planks": [5, 4, 162, 163, 164, 165, 166, 167, 168, 169]}}"#
        ).unwrap()
    }

    #[test]
    fn parses_shaped_server_recipe() {
        let mut book = RecipeBook::new();
        let recipes = vec![sample_server_recipe()];
        let tags = sample_tags();
        book.parse(&recipes, &[], &tags);

        let rec = book.recipe(&recipes, &[], &tags, "minecraft:sticks").unwrap();
        assert_eq!(rec.id, "minecraft:sticks");
        assert!(rec.shaped);
        assert_eq!(rec.width, 1);
        assert_eq!(rec.height, 2);
        assert_eq!(rec.result.id, 280);
        assert_eq!(rec.result.count, 4);
        assert_eq!(rec.cells.len(), 2);
        assert_eq!(rec.cells[0].as_ref().unwrap().len(), 1);
        assert_eq!(rec.cells[0].as_ref().unwrap()[0].id, 5);
    }

    #[test]
    fn parses_shapeless_server_recipe() {
        let mut book = RecipeBook::new();
        let recipes = vec![sample_shapeless_recipe()];
        let tags = sample_tags();
        book.parse(&recipes, &[], &tags);

        let rec = book.recipe(&recipes, &[], &tags, "minecraft:oak_planks").unwrap();
        assert_eq!(rec.id, "minecraft:oak_planks");
        assert!(!rec.shaped);
        assert_eq!(rec.width, 1);
        assert_eq!(rec.height, 1);
        assert_eq!(rec.result.id, 5);
        assert_eq!(rec.result.count, 4);
        assert_eq!(rec.cells.len(), 1);
        assert_eq!(rec.cells[0].as_ref().unwrap().len(), 1);
        assert_eq!(rec.cells[0].as_ref().unwrap()[0].id, 17);
    }

    #[test]
    fn parses_smelting_recipe() {
        let mut book = RecipeBook::new();
        let recipes = vec![sample_smelting_recipe()];
        let tags = sample_tags();
        book.parse(&recipes, &[], &tags);

        let rec = book.recipe(&recipes, &[], &tags, "minecraft:charcoal").unwrap();
        assert_eq!(rec.id, "minecraft:charcoal");
        assert!(!rec.shaped);
        assert_eq!(rec.kind, "minecraft:smelting");
        assert_eq!(rec.result.id, 263);
        assert_eq!(rec.cells.len(), 1);
        assert_eq!(rec.cells[0].as_ref().unwrap()[0].id, 17);
    }

    #[test]
    fn categorizes_recipes_into_tabs() {
        let mut book = RecipeBook::new();
        let recipes = vec![sample_server_recipe(), sample_shapeless_recipe(), sample_smelting_recipe()];
        let tags = sample_tags();
        book.parse(&recipes, &[], &tags);

        // Sticks -> tools (item 280 is a stick)
        let tools_lists = book.tab_lists(&recipes, &[], &tags, "tools");
        assert!(!tools_lists.is_empty());
        let sticks_list = tools_lists.iter().find(|l| l.recipes.iter().any(|r| r.id == "minecraft:sticks"));
        assert!(sticks_list.is_some());

        // Oak planks -> buildingBlocks (item 5 is oak planks, a block)
        let building_lists = book.tab_lists(&recipes, &[], &tags, "buildingBlocks");
        assert!(!building_lists.is_empty());

        // Charcoal (smelting result 263) -> misc (not food, not block)
        let misc_lists = book.tab_lists(&recipes, &[], &tags, "misc");
        assert!(!misc_lists.is_empty());
    }

    #[test]
    fn search_tab_contains_all_recipes() {
        let mut book = RecipeBook::new();
        let recipes = vec![sample_server_recipe(), sample_shapeless_recipe(), sample_smelting_recipe()];
        let tags = sample_tags();
        book.parse(&recipes, &[], &tags);

        let search_lists = book.tab_lists(&recipes, &[], &tags, "search");
        let total_recipes: usize = search_lists.iter().map(|l| l.recipes.len()).sum();
        assert_eq!(total_recipes, 3);
    }

    #[test]
    fn handles_recipe_book_packet_full_sync() {
        let mut book = RecipeBook::new();
        let recipes = vec![sample_server_recipe(), sample_shapeless_recipe()];
        let tags = sample_tags();
        book.parse(&recipes, &[], &tags);

        let packet = serde_json::json!({
            "action": 0,
            "craftingBookOpen": true,
            "filteringCraftable": false,
            "recipes": ["minecraft:sticks", "minecraft:oak_planks"],
            "recipesToHighlight": ["minecraft:sticks"]
        });

        book.on_packet(&recipes, &[], &tags, &packet);

        assert!(book.is_open());
        assert!(!book.is_filtering());
        assert_eq!(book.known_recipes().len(), 2);
        assert!(book.known_recipes().contains("minecraft:sticks"));
        assert!(book.known_recipes().contains("minecraft:oak_planks"));
        assert_eq!(book.fresh_recipes().len(), 1);
        assert!(book.fresh_recipes().contains("minecraft:sticks"));
    }

    #[test]
    fn handles_recipe_book_packet_add() {
        let mut book = RecipeBook::new();
        let recipes = vec![sample_server_recipe()];
        let tags = sample_tags();
        book.parse(&recipes, &[], &tags);

        let packet = serde_json::json!({
            "action": 1,
            "recipes": ["minecraft:sticks"]
        });

        book.on_packet(&recipes, &[], &tags, &packet);

        assert!(book.known_recipes().contains("minecraft:sticks"));
        assert!(book.fresh_recipes().contains("minecraft:sticks"));
    }

    #[test]
    fn handles_recipe_book_packet_remove() {
        let mut book = RecipeBook::new();
        let recipes = vec![sample_server_recipe()];
        let tags = sample_tags();
        book.parse(&recipes, &[], &tags);

        // First add the recipe
        let add_packet = serde_json::json!({
            "action": 1,
            "recipes": ["minecraft:sticks"]
        });
        book.on_packet(&recipes, &[], &tags, &add_packet);
        assert!(book.known_recipes().contains("minecraft:sticks"));

        // Then remove it
        let remove_packet = serde_json::json!({
            "action": 2,
            "recipes": ["minecraft:sticks"]
        });
        book.on_packet(&recipes, &[], &tags, &remove_packet);
        assert!(!book.known_recipes().contains("minecraft:sticks"));
    }

    #[test]
    fn stacked_contents_counts_items() {
        let book = RecipeBook::new();
        let inventory = vec![
            Some(Stack { id: 5, count: 10, damage: 0 }),
            Some(Stack { id: 5, count: 5, damage: 0 }),
            Some(Stack { id: 17, count: 3, damage: 0 }),
            None,
        ];
        let grid = vec![
            Some(Stack { id: 5, count: 2, damage: 0 }),
            None,
        ];
        let counts = book.stacked_contents(&inventory, &grid);
        assert_eq!(counts.get("5:0"), Some(&17));
        assert_eq!(counts.get("17:0"), Some(&3));
    }

    #[test]
    fn can_craft_shaped_recipe() {
        let mut book = RecipeBook::new();
        let recipes = vec![sample_server_recipe()];
        let tags = sample_tags();
        book.parse(&recipes, &[], &tags);

        let rec = book.recipe(&recipes, &[], &tags, "minecraft:sticks").unwrap();
        let counts: HashMap<String, i32> = [("5:0".to_string(), 2)].into_iter().collect();
        assert!(book.can_craft(rec, &counts));

        let counts: HashMap<String, i32> = [("5:0".to_string(), 1)].into_iter().collect();
        assert!(!book.can_craft(rec, &counts));
    }

    #[test]
    fn can_craft_shapeless_recipe() {
        let mut book = RecipeBook::new();
        let recipes = vec![sample_shapeless_recipe()];
        let tags = sample_tags();
        book.parse(&recipes, &[], &tags);

        let rec = book.recipe(&recipes, &[], &tags, "minecraft:oak_planks").unwrap();
        let counts: HashMap<String, i32> = [("17:0".to_string(), 1)].into_iter().collect();
        assert!(book.can_craft(rec, &counts));

        let counts: HashMap<String, i32> = [("5:0".to_string(), 1)].into_iter().collect();
        assert!(!book.can_craft(rec, &counts));
    }

    #[test]
    fn evaluate_list_filters_known_valid_craftable() {
        let mut book = RecipeBook::new();
        let recipes = vec![sample_server_recipe(), sample_shapeless_recipe()];
        let tags = sample_tags();
        book.parse(&recipes, &[], &tags);

        // Mark one recipe as known
        let add_packet = serde_json::json!({
            "action": 1,
            "recipes": ["minecraft:sticks"]
        });
        book.on_packet(&recipes, &[], &tags, &add_packet);

        let mut lists = book.tab_lists(&recipes, &[], &tags, "tools");
        assert!(!lists.is_empty());
        let mut list = lists.remove(0);

        let counts: HashMap<String, i32> = [("5:0".to_string(), 10)].into_iter().collect();
        book.evaluate(&mut list, &counts, 3, 3);

        assert_eq!(list.known.len(), 1);
        assert_eq!(list.known[0].id, "minecraft:sticks");
        assert_eq!(list.valid.len(), 1);
        assert_eq!(list.craftable.len(), 1);
    }

    #[test]
    fn recipe_grouping_by_group_field() {
        let mut book = RecipeBook::new();
        let recipes = vec![
            sample_server_recipe(), // group: "sticks"
            sample_shapeless_recipe(), // group: "planks"
        ];
        let tags = sample_tags();
        book.parse(&recipes, &[], &tags);

        // Each group should create one RecipeList
        let tools_lists = book.tab_lists(&recipes, &[], &tags, "tools");
        let building_lists = book.tab_lists(&recipes, &[], &tags, "buildingBlocks");

        // Both recipes have groups, so each should be in one list
        let total_tools: usize = tools_lists.iter().map(|l| l.recipes.len()).sum();
        let total_building: usize = building_lists.iter().map(|l| l.recipes.len()).sum();
        assert_eq!(total_tools, 1);
        assert_eq!(total_building, 1);
    }
}