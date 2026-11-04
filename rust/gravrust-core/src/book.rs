// Port of `client/js/game/book.js`

//! Port of `client/js/game/book.js`:
//! - Written book page management
//! - Enchanting book functionality
//! - Signing and editing books
//!
//! Note: GUI drawing (gui.blit, gui.text, gui.rect, etc.) and widget interactions
//! remain in JavaScript. This module provides the algorithmic/data-handling parts.

use serde_json::{json, Value};
use wasm_bindgen::prelude::*;

/// Represents a single page of a written book, containing text content.
#[derive(Clone, Debug, Default)]
pub struct BookPage {
    /// The text content of the page.
    pub text: String,
}

/// Represents the state of a book (written or enchanted).
#[derive(Clone, Debug, Default)]
pub struct BookState {
    /// The pages of the book.
    pub pages: Vec<BookPage>,
    /// The author of the book (for written books).
    pub author: String,
    /// The title of the book (for written books).
    pub title: String,
    /// Whether the book has been modified since last save.
    pub modified: bool,
}

/// Creates a new empty book state.
/// Equivalent to `new BookScreen(game, item, editable, hand)` logic ported to Rust.
pub fn new_book_state(pages: Option<Vec<BookPage>>, author: Option<String>, title: Option<String>) -> BookState {
    BookState {
        pages: pages.unwrap_or_default(),
        author: author.unwrap_or_default(),
        title: title.unwrap_or_default(),
        modified: false,
    }
}

/// Adds a new empty page to the book.
/// Equivalent to pushing a page in the JS version.
pub fn add_page(state: &mut BookState) {
    state.pages.push(BookPage::default());
    state.modified = true;
}

/// Removes trailing empty pages from the book.
/// Equivalent to the `while (this.pages.length > 1 && !this.pages[this.pages.length - 1]) this.pages.pop();` logic.
pub fn remove_trailing_empty_pages(state: &mut BookState) {
    while state.pages.len() > 1 && state.pages.last().map_or(true, |p| p.text.is_empty()) {
        state.pages.pop();
    }
    state.modified = true;
}

/// Sets the author of the book.
pub fn set_author(state: &mut BookState, author: String) {
    state.author = author;
    state.modified = true;
}

/// Sets the title of the book.
pub fn set_title(state: &mut BookState, title: String) {
    state.title = title;
    state.modified = true;
}

/// Returns whether the book has any pages.
pub fn has_pages(state: &BookState) -> bool {
    !state.pages.is_empty()
}

/// Returns the number of pages in the book.
pub fn page_count(state: &BookState) -> usize {
    state.pages.len()
}

/// Serializes the book state into an NBT compound tag.
/// Equivalent to the JS `sendBook` function's tagObj construction.
pub fn to_nbt_compound(state: &BookState) -> Value {
    let pages: Vec<Value> = state.pages.iter().map(|p| json!(p.text)).collect();
    let mut tag_obj = json!({
        "pages": pages,
    });
    if !state.author.is_empty() {
        tag_obj["author"] = json!(state.author);
    }
    if !state.title.is_empty() {
        tag_obj["title"] = json!(state.title);
    }
    json!({
        "t": "compound",
        "name": "",
        "v": tag_obj,
    })
}

/// Deserializes an NBT compound tag into a BookState.
/// Equivalent to reading NBT data when opening a book.
pub fn from_nbt_compound(tag: &Value) -> BookState {
    let mut pages = Vec::new();
    if let Some(pages_arr) = tag.get("pages").and_then(|p| p.as_array()) {
        for page_val in pages_arr {
            let text = page_val.as_str().unwrap_or("").to_string();
            pages.push(BookPage { text });
        }
    }

    let author = tag.get("author").and_then(|a| a.as_str()).unwrap_or("").to_string();
    let title = tag.get("title").and_then(|t| t.as_str()).unwrap_or("").to_string();

    BookState {
        pages,
        author,
        title,
        modified: false,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_new_book_state() {
        let state = new_book_state(
            Some(vec![BookPage { text: "Hello".to_string() }]),
            Some("Author".to_string()),
            Some("Title".to_string()),
        );
        assert_eq!(state.pages.len(), 1);
        assert_eq!(state.author, "Author");
        assert_eq!(state.title, "Title");
        assert!(!state.modified);
    }

    #[test]
    fn test_add_page() {
        let mut state = BookState::default();
        add_page(&mut state);
        assert_eq!(state.pages.len(), 1);
        assert!(state.modified);
    }

    #[test]
    fn test_remove_trailing_empty_pages() {
        let mut state = BookState::default();
        state.pages.push(BookPage { text: "First".to_string() });
        state.pages.push(BookPage { text: "".to_string() });
        state.pages.push(BookPage { text: "".to_string() });
        remove_trailing_empty_pages(&mut state);
        assert_eq!(state.pages.len(), 1);
    }

    #[test]
    fn test_to_from_nbt() {
        let state = BookState {
            pages: vec![BookPage { text: "Page 1".to_string() }],
            author: "Test Author".to_string(),
            title: "Test Title".to_string(),
            modified: true,
        };
        let nbt = to_nbt_compound(&state);
        let recovered = from_nbt_compound(&nbt);
        assert_eq!(recovered.pages.len(), 1);
        assert_eq!(recovered.pages[0].text, "Page 1");
        assert_eq!(recovered.author, "Test Author");
        assert_eq!(recovered.title, "Test Title");
    }
}
