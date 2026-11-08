//! Port of `client/js/render/text-mesh.js`.
//!
//! World-space text: FontRenderer glyph quads turned into vertex arrays (FORMAT.color: pos(3) uv(2) color(4)).
//! Coordinates are in font pixels with y pointing down, like the GUI.

/// Single quad in world-space text: 4 vertices of 9 floats each.
/// Vertex format: [x, y, z, u, v, r, g, b, a].
#[derive(Debug, Clone, PartialEq)]
pub struct TextQuad {
    pub tex: Option<String>,
    pub vertices: [[f32; 9]; 4],
}

/// Generates a single colored rectangle quad for text backgrounds/boxes.
pub fn text_background_rect(
    x0: f32,
    y0: f32,
    x1: f32,
    y1: f32,
    color: [f32; 4],
    z: f32,
) -> TextQuad {
    let zz = z + 0.01;
    TextQuad {
        tex: None,
        vertices: [
            [x0, y0, zz, 0.0, 0.0, color[0], color[1], color[2], color[3]],
            [x0, y1, zz, 0.0, 1.0, color[0], color[1], color[2], color[3]],
            [x1, y1, zz, 1.0, 1.0, color[0], color[1], color[2], color[3]],
            [x1, y0, zz, 1.0, 0.0, color[0], color[1], color[2], color[3]],
        ],
    }
}

/// Helper to build vertex data for italic/skewed glyphs.
pub fn glyph_quad(
    tex: Option<String>,
    x0: f32,
    y0: f32,
    x1: f32,
    y1: f32,
    u0: f32,
    v0: f32,
    u1: f32,
    v1: f32,
    color: [f32; 4],
    skew: bool,
    origin_y: f32,
    z: f32,
) -> TextQuad {
    let top = if skew { (origin_y + 4.0 - y0) * 0.25 } else { 0.0 };
    let bottom = if skew { (origin_y + 4.0 - y1) * 0.25 } else { 0.0 };

    TextQuad {
        tex,
        vertices: [
            [x0 + top, y0, z, u0, v0, color[0], color[1], color[2], color[3]],
            [x0 + bottom, y1, z, u0, v1, color[0], color[1], color[2], color[3]],
            [x1 + bottom, y1, z, u1, v1, color[0], color[1], color[2], color[3]],
            [x1 + top, y0, z, u1, v0, color[0], color[1], color[2], color[3]],
        ],
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_text_background_rect() {
        let q = text_background_rect(0.0, 0.0, 10.0, 10.0, [1.0, 1.0, 1.0, 1.0], 0.0);
        assert_eq!(q.tex, None);
        assert_eq!(q.vertices[0][0], 0.0);
        assert_eq!(q.vertices[2][0], 10.0);
    }

    #[test]
    fn test_glyph_quad_italic_skew() {
        let q = glyph_quad(Some("font.png".into()), 0.0, 0.0, 8.0, 8.0, 0.0, 0.0, 1.0, 1.0, [1.0, 1.0, 1.0, 1.0], true, 0.0, 0.0);
        assert!(q.vertices[0][0] > 0.0); // italic shifts top
    }
}
