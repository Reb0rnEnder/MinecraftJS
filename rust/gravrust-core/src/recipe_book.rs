//! Recipe book state management
use wasm_bindgen::prelude::*;
use std::collections::HashMap;
use serde::{Serialize, Deserialize};

/// Recipe book state
#[wasm_bindgen]
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct RecipeBookState {
    unlocked: Vec<String>,
    highlighted: Vec<String>,
    is_open: bool,
    is_filtering: bool,
    book_type: String, // "crafting", "furnace", "blasting", "smoking"
    search_query: String,
}

#[wasm_bindgen]
impl RecipeBookState {
    #[wasm_bindgen(constructor)]
    pub fn new() -> RecipeBookState {
        RecipeBookState {
            unlocked: Vec::new(),
            highlighted: Vec::new(),
            is_open: false,
            is_filtering: false,
            book_type: "crafting".to_string(),
            search_query: String::new(),
        }
    }
    
    #[wasm_bindgen(getter_with_clone)]
    pub fn unlocked(&self) -> Vec<String> { self.unlocked.clone() }
    
    #[wasm_bindgen(getter_with_clone)]
    pub fn highlighted(&self) -> Vec<String> { self.highlighted.clone() }
    
    #[wasm_bindgen(getter)]
    pub fn is_open(&self) -> bool { self.is_open }
    
    #[wasm_bindgen(setter)]
    pub fn set_is_open(&mut self, val: bool) { self.is_open = val; }
    
    #[wasm_bindgen(getter)]
    pub fn is_filtering(&self) -> bool { self.is_filtering }
    
    #[wasm_bindgen(setter)]
    pub fn set_is_filtering(&mut self, val: bool) { self.is_filtering = val; }
    
    #[wasm_bindgen(getter_with_clone)]
    pub fn book_type(&self) -> String { self.book_type.clone() }
    
    #[wasm_bindgen(setter)]
    pub fn set_book_type(&mut self, val: String) { self.book_type = val; }
    
    #[wasm_bindgen(getter_with_clone)]
    pub fn search_query(&self) -> String { self.search_query.clone() }
    
    #[wasm_bindgen(setter)]
    pub fn set_search_query(&mut self, val: String) { self.search_query = val; }
}

/// Update recipe book state
#[wasm_bindgen]
pub fn update_recipe_book(
    recipe_book: &mut RecipeBookState,
    unlocked_recipes: Vec<String>,
    highlighted_recipes: Vec<String>,
) {
    // Add new unlocked recipes
    for recipe in unlocked_recipes {
        if !recipe_book.unlocked.contains(&recipe) {
            recipe_book.unlocked.push(recipe);
        }
    }
    
    // Update highlighted recipes
    recipe_book.highlighted = highlighted_recipes;
}

/// Check if recipe is unlocked
#[wasm_bindgen]
pub fn is_recipe_unlocked(recipe_book: &RecipeBookState, recipe_id: &str) -> bool {
    recipe_book.unlocked.contains(&recipe_id.to_string())
}

/// Check if recipe is highlighted (can be crafted)
#[wasm_bindgen]
pub fn is_recipe_highlighted(recipe_book: &RecipeBookState, recipe_id: &str) -> bool {
    recipe_book.highlighted.contains(&recipe_id.to_string())
}

/// Add unlocked recipe
#[wasm_bindgen]
pub fn unlock_recipe(recipe_book: &mut RecipeBookState, recipe_id: &str) {
    if !recipe_book.unlocked.contains(&recipe_id.to_string()) {
        recipe_book.unlocked.push(recipe_id.to_string());
    }
}

/// Remove unlocked recipe
#[wasm_bindgen]
pub fn remove_recipe(recipe_book: &mut RecipeBookState, recipe_id: &str) {
    recipe_book.unlocked.retain(|r| r != recipe_id);
}

/// Clear all recipes
#[wasm_bindgen]
pub fn clear_recipes(recipe_book: &mut RecipeBookState) {
    recipe_book.unlocked.clear();
    recipe_book.highlighted.clear();
}

/// Get recipe count
#[wasm_bindgen]
pub fn get_unlocked_count(recipe_book: &RecipeBookState) -> usize {
    recipe_book.unlocked.len()
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_recipe_book() {
        let mut book = RecipeBookState::new();
        
        update_recipe_book(&mut book, vec!["recipe1".to_string(), "recipe2".to_string()], vec!["recipe1".to_string()]);
        
        assert_eq!(book.unlocked.len(), 2);
        assert!(is_recipe_unlocked(&book, "recipe1"));
        assert!(is_recipe_unlocked(&book, "recipe2"));
        assert!(!is_recipe_unlocked(&book, "recipe3"));
        
        assert!(is_recipe_highlighted(&book, "recipe1"));
        assert!(!is_recipe_highlighted(&book, "recipe2"));
        
        unlock_recipe(&mut book, "recipe3");
        assert!(is_recipe_unlocked(&book, "recipe3"));
        
        remove_recipe(&mut book, "recipe1");
        assert!(!is_recipe_unlocked(&book, "recipe1"));
        
        clear_recipes(&mut book);
        assert_eq!(book.unlocked.len(), 0);
    }
}