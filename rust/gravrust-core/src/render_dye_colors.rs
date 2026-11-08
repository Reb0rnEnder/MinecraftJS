//! Port of `client/js/render/dye-colors.js` (upstream MinecraftJS 1.8.9).
//!
//! Native 1.8.9 dye texture RGB, in the jar enum order (white first).

/// JS: `DYE_TEXTURE_COLORS` — 16 entries, jar `EnumDyeColor` order.
pub const DYE_TEXTURE_COLORS: [[f64; 3]; 16] = [
    [1.0, 1.0, 1.0],
    [0.84705883, 0.49803922, 0.2],
    [0.69803923, 0.29803923, 0.84705883],
    [0.4, 0.6, 0.84705883],
    [0.8980392, 0.8980392, 0.2],
    [0.49803922, 0.8, 0.09803922],
    [0.9490196, 0.49803922, 0.64705884],
    [0.29803923, 0.29803923, 0.29803923],
    [0.6, 0.6, 0.6],
    [0.29803923, 0.49803922, 0.6],
    [0.49803922, 0.24705882, 0.69803923],
    [0.2, 0.29803923, 0.69803923],
    [0.4, 0.29803923, 0.2],
    [0.4, 0.49803922, 0.2],
    [0.6, 0.2, 0.2],
    [0.09803922, 0.09803922, 0.09803922],
];

#[cfg(test)]
mod tests {
    #[test]
    fn white_first_black_last() {
        assert_eq!(super::DYE_TEXTURE_COLORS[0], [1.0, 1.0, 1.0]);
        assert_eq!(super::DYE_TEXTURE_COLORS[15], [0.09803922, 0.09803922, 0.09803922]);
    }
}
