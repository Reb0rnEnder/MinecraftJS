//! Port of `client/js/gui/screens/shaders.js`.
//!
//! Shader pack selection screen: shader library list layout, unavailable option buttons,
//! folder import button, and pipeline limitation tooltips.

pub const SHADER_PACK_KEY: &str = "shaderpacks/final-stage";

pub const UNAVAILABLE_SETTINGS: &[&str] = &[
    "Antialiasing: OFF",
    "Normal Map: OFF",
    "Specular Map: OFF",
    "Render Quality: 1x",
    "Shadow Quality: 1x",
    "Hand Depth: 1x",
    "Old Hand Light: Default",
    "Old Lighting: Default",
];

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ShaderScreenLayout {
    pub list_width: i32,
    pub right_column_x: i32,
    pub folder_width: i32,
    pub folder_x: i32,
    pub options_btn: (i32, i32, i32, i32),
    pub folder_btn: (i32, i32, i32, i32),
    pub download_btn: (i32, i32, i32, i32),
    pub done_btn: (i32, i32, i32, i32),
}

pub fn compute_shader_screen_layout(screen_width: i32, screen_height: i32) -> ShaderScreenLayout {
    let width = screen_width - 140;
    let right = screen_width - 130;
    let folder_width = 150.min(width / 2 - 10);
    let folder_x = width / 4 - folder_width / 2;

    ShaderScreenLayout {
        list_width: width,
        right_column_x: right,
        folder_width,
        folder_x,
        options_btn: (right, screen_height - 25, 120, 20),
        folder_btn: (folder_x, screen_height - 25, folder_width - 21, 20),
        download_btn: (folder_x + folder_width - 23, screen_height - 25, 22, 20),
        done_btn: ((width / 4) * 3 - folder_width / 2, screen_height - 25, folder_width, 20),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_shader_layout() {
        let l = compute_shader_screen_layout(800, 600);
        assert_eq!(l.list_width, 660);
        assert_eq!(l.right_column_x, 670);
        assert_eq!(l.options_btn.2, 120);
        assert_eq!(l.download_btn.2, 22);
    }
}
