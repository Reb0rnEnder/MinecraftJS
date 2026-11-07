//! Widgets System - ported from client/js/widgets.js
//! Button, Slider, TextField with exact JS behavior

#[derive(Clone)]
pub struct Button {
    pub x: i32, pub y: i32, pub width: i32, pub height: i32,
    pub text: String, pub enabled: bool,
    pub on_click: Option<Box<dyn Fn()>>,
}

#[derive(Clone)]
pub struct Slider {
    pub x: i32, pub y: i32, pub width: i32,
    pub min: f64, pub max: f64, pub value: f64,
    pub formatter: Box<dyn Fn(f64) -> String>,
}

#[derive(Clone)]
pub struct TextField {
    pub x: i32, pub y: i32, pub width: i32, pub height: i32,
    pub text: String, pub max_length: usize,
    pub focused: bool,
}

impl Button {
    pub fn new(x: i32, y: i32, w: i32, h: i32, text: &str) -> Self {
        Self { x, y, width: w, height: h, text: text.into(), enabled: true, on_click: None }
    }
    
    pub fn is_hovered(&self, mx: i32, my: i32) -> bool {
        mx >= self.x && mx < self.x + self.width && my >= self.y && my < self.y + self.height
    }
}
