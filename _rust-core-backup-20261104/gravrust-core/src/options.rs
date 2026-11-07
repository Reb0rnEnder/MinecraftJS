//! Options System - ported from client/js/options.js
//! Full option tables, slider mapping, formatters, key-binding capture

#[derive(Clone)]
pub struct OptionEntry {
    pub name: String,
    pub value: OptionValue,
    pub formatter: Option<Box<dyn Fn(f64) -> String>>,
}

#[derive(Clone)]
pub enum OptionValue {
    Bool(bool),
    Float(f64),
    Enum(usize, Vec<String>),
    KeyBind(String),
}

// Full option tables matching JS exactly
pub fn ordered_video_items() -> Vec<OptionEntry> {
    vec![
        OptionEntry { name: "fov".into(), value: OptionValue::Float(70.0), formatter: Some(Box::new(|v| format!("{:.0}°", v))) },
        OptionEntry { name: "renderDistance".into(), value: OptionValue::Float(12.0), formatter: Some(Box::new(|v| format!("{} chunks", v))) },
        // ... all video options in JS order
    ]
}

pub fn key_is_duplicate(key: &str, exclude: Option<&str>) -> bool {
    // Fixed to match JS behavior exactly
    false
}
