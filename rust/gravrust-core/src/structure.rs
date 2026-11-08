//! Port of `client/js/gui/screens/structure.js`.
//!
//! StructureBlockScreen: modes (SAVE, LOAD, CORNER, DATA), rotations, mirrors,
//! coordinate/size clamping, integrity parsing, and structure block update action codes.

use std::collections::HashSet;
use once_cell::sync::Lazy;

pub const STRUCTURE_MODES: &[&str] = &["SAVE", "LOAD", "CORNER", "DATA"];
pub const STRUCTURE_ROTATIONS: &[&str] = &["NONE", "CLOCKWISE_90", "CLOCKWISE_180", "COUNTERCLOCKWISE_90"];
pub const STRUCTURE_MIRRORS: &[&str] = &["NONE", "LEFT_RIGHT", "FRONT_BACK"];

pub static ILLEGAL_STRUCTURE_CHARS: Lazy<HashSet<char>> = Lazy::new(|| {
    ['.', '\n', '\r', '\t', '\0', '\x0c', '`', '?', '*', '\\', '<', '>', '|', '"'].into_iter().collect()
});

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum StructureAction {
    Update = 1,
    Save = 2,
    Load = 3,
    DetectSize = 4,
}

#[derive(Debug, Clone, PartialEq)]
pub struct StructureTileData {
    pub name: String,
    pub metadata: String,
    pub pos_x: i32,
    pub pos_y: i32,
    pub pos_z: i32,
    pub size_x: i32,
    pub size_y: i32,
    pub size_z: i32,
    pub rotation: String,
    pub mirror: String,
    pub mode: String,
    pub ignore_entities: bool,
    pub show_air: bool,
    pub show_bounding_box: bool,
    pub integrity: f32,
    pub seed: i64,
}

impl Default for StructureTileData {
    fn default() -> Self {
        Self {
            name: String::new(),
            metadata: String::new(),
            pos_x: 0,
            pos_y: 1,
            pos_z: 0,
            size_x: 0,
            size_y: 0,
            size_z: 0,
            rotation: "NONE".into(),
            mirror: "NONE".into(),
            mode: "DATA".into(),
            ignore_entities: false,
            show_air: false,
            show_bounding_box: true,
            integrity: 1.0,
            seed: 0,
        }
    }
}

impl StructureTileData {
    pub fn clamp_coords(&mut self) {
        self.pos_x = self.pos_x.clamp(-32, 32);
        self.pos_y = self.pos_y.clamp(-32, 32);
        self.pos_z = self.pos_z.clamp(-32, 32);
        self.size_x = self.size_x.clamp(0, 32);
        self.size_y = self.size_y.clamp(0, 32);
        self.size_z = self.size_z.clamp(0, 32);
    }
}

pub fn is_valid_structure_name(name: &str) -> bool {
    !name.chars().any(|c| ILLEGAL_STRUCTURE_CHARS.contains(&c))
}

pub fn format_integrity(integrity: f32) -> String {
    let mut s = format!("{:.4}", integrity);
    while s.ends_with('0') && !s.ends_with(".0") {
        s.pop();
    }
    s
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_structure_data_clamping() {
        let mut d = StructureTileData::default();
        d.pos_x = 50;
        d.size_y = -5;
        d.clamp_coords();
        assert_eq!(d.pos_x, 32);
        assert_eq!(d.size_y, 0);
    }

    #[test]
    fn test_is_valid_structure_name() {
        assert!(is_valid_structure_name("house_1"));
        assert!(is_valid_structure_name("house/1")); // '/' is NOT in ILLEGAL set
        assert!(!is_valid_structure_name("house.1")); // '.' is illegal
        assert!(!is_valid_structure_name("house?1")); // '?' is illegal
    }

    #[test]
    fn test_format_integrity() {
        assert_eq!(format_integrity(1.0), "1.0");
        assert_eq!(format_integrity(0.75), "0.75");
    }
}
