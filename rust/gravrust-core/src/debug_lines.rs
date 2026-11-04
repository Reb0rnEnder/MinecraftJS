// Port of `client/js/game/debug-lines.js`
//!
//! Debug line geometry generation for hitboxes, block outlines, and chunk borders.
//! The JavaScript implementation uses a LineBatch that accumulates vertices into a
//! Float32Array with 9 floats per vertex: (x, y, z, 0, 0, r, g, b, a).
//! This port provides standalone functions that return vertex buffers directly.

use wasm_bindgen::prelude::*;

/// Vertex stride: 9 floats per vertex (x, y, z, _pad1, _pad2, r, g, b, a).
const VERTEX_STRIDE: usize = 9;

/// Maximum number of line segments per batch (matches JS MAX_SEGS = 4096).
const MAX_SEGS: usize = 4096;
const MAX_VERTS: usize = MAX_SEGS * 2;

/// Returns `null` sentinel for JS fallback when WASM is unavailable or input is invalid.
/// In Rust we return `Option<Vec<f32>>` which wasm_bindgen converts to a Float32Array or undefined.
fn js_null<T>() -> Option<T> {
    None
}

/// Append a single line segment's two vertices to the buffer.
/// Vertex format: [x, y, z, 0.0, 0.0, r, g, b, a] per vertex.
#[inline]
fn push_line(buf: &mut Vec<f32>, x0: f32, y0: f32, z0: f32, x1: f32, y1: f32, z1: f32, r: f32, g: f32, b: f32, a: f32) {
    // Vertex 0
    buf.push(x0);
    buf.push(y0);
    buf.push(z0);
    buf.push(0.0);
    buf.push(0.0);
    buf.push(r);
    buf.push(g);
    buf.push(b);
    buf.push(a);
    // Vertex 1
    buf.push(x1);
    buf.push(y1);
    buf.push(z1);
    buf.push(0.0);
    buf.push(0.0);
    buf.push(r);
    buf.push(g);
    buf.push(b);
    buf.push(a);
}

/// Generate vertices for a single line segment.
///
/// # Arguments
/// * `start` - [x, y, z] start point
/// * `end`   - [x, y, z] end point
/// * `color` - [r, g, b, a] color (alpha defaults to 1.0)
///
/// Returns a Float32Array with 18 floats (2 vertices × 9 floats) or null on failure.
#[wasm_bindgen]
pub fn debug_lines_line(start: &[f32], end: &[f32], color: &[f32]) -> Option<Vec<f32>> {
    if start.len() < 3 || end.len() < 3 || color.len() < 3 {
        return js_null();
    }
    let r = color[0];
    let g = color[1];
    let b = color[2];
    let a = color.get(3).copied().unwrap_or(1.0);

    let mut buf = Vec::with_capacity(VERTEX_STRIDE * 2);
    push_line(&mut buf, start[0], start[1], start[2], end[0], end[1], end[2], r, g, b, a);
    Some(buf)
}

/// Generate vertices for an axis-aligned box outline (12 edges, 24 vertices).
///
/// # Arguments
/// * `min`   - [x, y, z] minimum corner
/// * `max`   - [x, y, z] maximum corner
/// * `color` - [r, g, b, a] color (alpha defaults to 1.0)
///
/// Returns a Float32Array with 216 floats (24 vertices × 9 floats) or null on failure.
#[wasm_bindgen]
pub fn debug_lines_box(min: &[f32], max: &[f32], color: &[f32]) -> Option<Vec<f32>> {
    if min.len() < 3 || max.len() < 3 || color.len() < 3 {
        return js_null();
    }
    let x0 = min[0];
    let y0 = min[1];
    let z0 = min[2];
    let x1 = max[0];
    let y1 = max[1];
    let z1 = max[2];

    let r = color[0];
    let g = color[1];
    let b = color[2];
    let a = color.get(3).copied().unwrap_or(1.0);

    // 12 edges = 24 vertices = 216 floats
    let mut buf = Vec::with_capacity(VERTEX_STRIDE * 24);

    // Bottom face (y = y0)
    push_line(&mut buf, x0, y0, z0, x1, y0, z0, r, g, b, a);
    push_line(&mut buf, x1, y0, z0, x1, y0, z1, r, g, b, a);
    push_line(&mut buf, x1, y0, z1, x0, y0, z1, r, g, b, a);
    push_line(&mut buf, x0, y0, z1, x0, y0, z0, r, g, b, a);

    // Top face (y = y1)
    push_line(&mut buf, x0, y1, z0, x1, y1, z0, r, g, b, a);
    push_line(&mut buf, x1, y1, z0, x1, y1, z1, r, g, b, a);
    push_line(&mut buf, x1, y1, z1, x0, y1, z1, r, g, b, a);
    push_line(&mut buf, x0, y1, z1, x0, y1, z0, r, g, b, a);

    // Vertical edges
    push_line(&mut buf, x0, y0, z0, x0, y1, z0, r, g, b, a);
    push_line(&mut buf, x1, y0, z0, x1, y1, z0, r, g, b, a);
    push_line(&mut buf, x1, y0, z1, x1, y1, z1, r, g, b, a);
    push_line(&mut buf, x0, y0, z1, x0, y1, z1, r, g, b, a);

    Some(buf)
}

/// Generate vertices for multiple line segments at once (batch API).
///
/// # Arguments
/// * `lines` - Flat array of [x0, y0, z0, x1, y1, z1, r, g, b, a, ...] per segment.
///             Length must be a multiple of 10 (or 9 with implicit alpha=1).
///             If 9 floats per segment, alpha defaults to 1.0.
///
/// Returns a Float32Array with all vertices or null on failure.
#[wasm_bindgen]
pub fn debug_lines_batch(lines: &[f32]) -> Option<Vec<f32>> {
    if lines.is_empty() || lines.len() % 10 != 0 && lines.len() % 9 != 0 {
        return js_null();
    }

    let segs = if lines.len() % 10 == 0 {
        lines.len() / 10
    } else {
        lines.len() / 9
    };

    if segs > MAX_SEGS {
        return js_null();
    }

    let mut buf = Vec::with_capacity(VERTEX_STRIDE * 2 * segs);

    for i in 0..segs {
        let base = if lines.len() % 10 == 0 { i * 10 } else { i * 9 };
        let x0 = lines[base];
        let y0 = lines[base + 1];
        let z0 = lines[base + 2];
        let x1 = lines[base + 3];
        let y1 = lines[base + 4];
        let z1 = lines[base + 5];
        let r = lines[base + 6];
        let g = lines[base + 7];
        let b = lines[base + 8];
        let a = if lines.len() % 10 == 0 { lines[base + 9] } else { 1.0 };

        push_line(&mut buf, x0, y0, z0, x1, y1, z1, r, g, b, a);
    }

    Some(buf)
}

/// Generate chunk border debug lines (port of `_chunkBorders`).
///
/// # Arguments
/// * `player_x` - Player X position
/// * `player_z` - Player Z position
/// * `max_y`    - Maximum Y for vertical lines (default 256)
///
/// Returns a Float32Array with all chunk border vertices or null on failure.
#[wasm_bindgen]
pub fn debug_lines_chunk_borders(player_x: f32, player_z: f32, max_y: f32) -> Option<Vec<f32>> {
    let cx = (player_x / 16.0).floor() * 16.0;
    let cz = (player_z / 16.0).floor() * 16.0;

    // Estimate: 9 corner lines × 2 + 14 edge lines × 2 × 2 + rings × 4 × 2 + corner verticals × 4 + ring verticals × 4 × 16
    // Roughly ~200 segments = 400 vertices = 3600 floats
    let mut buf = Vec::with_capacity(VERTEX_STRIDE * 500);

    // Red lines at neighbouring chunk corners (-16 to 32 step 16)
    for n in [-16.0, 0.0, 16.0, 32.0] {
        for m in [-16.0, 0.0, 16.0, 32.0] {
            push_line(&mut buf, cx + n, 0.0, cz + m, cx + n, max_y, cz + m, 1.0, 0.0, 0.0, 1.0);
        }
    }

    // Yellow lines every 2 blocks along this chunk's edges
    let yellow = [1.0, 1.0, 0.0, 1.0];
    for n in (2..16).step_by(2) {
        let nf = n as f32;
        push_line(&mut buf, cx + nf, 0.0, cz, cx + nf, max_y, cz, yellow[0], yellow[1], yellow[2], yellow[3]);
        push_line(&mut buf, cx + nf, 0.0, cz + 16.0, cx + nf, max_y, cz + 16.0, yellow[0], yellow[1], yellow[2], yellow[3]);
        push_line(&mut buf, cx, 0.0, cz + nf, cx, max_y, cz + nf, yellow[0], yellow[1], yellow[2], yellow[3]);
        push_line(&mut buf, cx + 16.0, 0.0, cz + nf, cx + 16.0, max_y, cz + nf, yellow[0], yellow[1], yellow[2], yellow[3]);
    }

    // Yellow rings every 2 blocks up (except multiples of 16)
    let ring = |buf: &mut Vec<f32>, y: f32, color: [f32; 4]| {
        push_line(buf, cx, y, cz, cx, y, cz + 16.0, color[0], color[1], color[2], color[3]);
        push_line(buf, cx, y, cz + 16.0, cx + 16.0, y, cz + 16.0, color[0], color[1], color[2], color[3]);
        push_line(buf, cx + 16.0, y, cz + 16.0, cx + 16.0, y, cz, color[0], color[1], color[2], color[3]);
        push_line(buf, cx + 16.0, y, cz, cx, y, cz, color[0], color[1], color[2], color[3]);
    };

    for y in (2..=max_y as i32).step_by(2) {
        let yf = y as f32;
        if y % 16 != 0 {
            ring(&mut buf, yf, yellow);
        }
    }

    // Blue lines at chunk corners and every 16 blocks up
    let blue = [0.25, 0.25, 1.0, 1.0];
    for n in [0.0, 16.0] {
        for m in [0.0, 16.0] {
            push_line(&mut buf, cx + n, 0.0, cz + m, cx + n, max_y, cz + m, blue[0], blue[1], blue[2], blue[3]);
        }
    }
    for y in (0..=max_y as i32).step_by(16) {
        ring(&mut buf, y as f32, blue);
    }

    Some(buf)
}

/// Generate hitbox debug lines for an entity (port of the hitbox rendering in `update`).
///
/// # Arguments
/// * `x, y, z`      - Entity position (interpolated)
/// * `width`        - Entity width
/// * `height`       - Entity height
/// * `eye_height`   - Entity eye height (optional, defaults to height * 0.85)
/// * `yaw`          - Head yaw in degrees (optional)
/// * `pitch`        - Head pitch in degrees (optional)
/// * `show_eyes`    - Whether to render eye height box and look vector
///
/// Returns a Float32Array with hitbox vertices or null on failure.
#[wasm_bindgen]
pub fn debug_lines_entity_hitbox(
    x: f32,
    y: f32,
    z: f32,
    width: f32,
    height: f32,
    eye_height: Option<f32>,
    yaw: Option<f32>,
    pitch: Option<f32>,
    show_eyes: bool,
) -> Option<Vec<f32>> {
    let hw = width / 2.0;
    let h = height;
    let ey = y + eye_height.unwrap_or(h * 0.85);

    // Main box: 12 edges = 24 vertices
    // Eye box (if show_eyes): 12 edges = 24 vertices
    // Look vector (if show_eyes): 1 edge = 2 vertices
    let est_segs = 12 + if show_eyes { 13 } else { 0 };
    let mut buf = Vec::with_capacity(VERTEX_STRIDE * 2 * est_segs);

    // Main hitbox (white)
    let white = [1.0, 1.0, 1.0, 1.0];
    let min = [x - hw, y, z - hw];
    let max = [x + hw, y + h, z + hw];
    if let Some(box_buf) = debug_lines_box(&min, &max, &white) {
        buf.extend(box_buf);
    }

    if show_eyes {
        // Eye height box (red, thin at eye level)
        let red = [1.0, 0.0, 0.0, 1.0];
        let eye_min = [x - hw, ey - 0.01, z - hw];
        let eye_max = [x + hw, ey + 0.01, z + hw];
        if let Some(eye_buf) = debug_lines_box(&eye_min, &eye_max, &red) {
            buf.extend(eye_buf);
        }

        // Look vector (blue, length 2)
        if let (Some(yaw_deg), Some(pitch_deg)) = (yaw, pitch) {
            let yaw_rad = yaw_deg.to_radians();
            let pitch_rad = pitch_deg.to_radians();
            let lx = -yaw_rad.sin() * pitch_rad.cos();
            let ly = -pitch_rad.sin();
            let lz = yaw_rad.cos() * pitch_rad.cos();
            let blue = [0.0, 0.0, 1.0, 1.0];
            push_line(&mut buf, x, ey, z, x + lx * 2.0, ey + ly * 2.0, z + lz * 2.0, blue[0], blue[1], blue[2], blue[3]);
        }
    }

    Some(buf)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_debug_lines_line() {
        let start = [0.0, 0.0, 0.0];
        let end = [1.0, 1.0, 1.0];
        let color = [1.0, 0.0, 0.0, 1.0];
        let result = debug_lines_line(&start, &end, &color).unwrap();
        assert_eq!(result.len(), 18); // 2 vertices × 9 floats
        // Check vertex 0
        assert_eq!(&result[0..9], &[0.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0]);
        // Check vertex 1
        assert_eq!(&result[9..18], &[1.0, 1.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0]);
    }

    #[test]
    fn test_debug_lines_box() {
        let min = [0.0, 0.0, 0.0];
        let max = [1.0, 1.0, 1.0];
        let color = [1.0, 1.0, 1.0, 1.0];
        let result = debug_lines_box(&min, &max, &color).unwrap();
        assert_eq!(result.len(), 216); // 24 vertices × 9 floats = 12 edges × 2 verts × 9
    }

    #[test]
    fn test_debug_lines_batch() {
        // 2 segments with alpha
        let lines = [
            0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0,
            0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 1.0,
        ];
        let result = debug_lines_batch(&lines).unwrap();
        assert_eq!(result.len(), 36); // 4 vertices × 9 floats
    }

    #[test]
    fn test_debug_lines_batch_implicit_alpha() {
        // 2 segments without alpha (9 floats each)
        let lines = [
            0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0,
            0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0,
        ];
        let result = debug_lines_batch(&lines).unwrap();
        assert_eq!(result.len(), 36);
        // Check alpha defaults to 1.0
        assert_eq!(result[8], 1.0);
        assert_eq!(result[17], 1.0);
        assert_eq!(result[26], 1.0);
        assert_eq!(result[35], 1.0);
    }

    #[test]
    fn test_debug_lines_chunk_borders() {
        let result = debug_lines_chunk_borders(100.0, 100.0, 256.0).unwrap();
        assert!(!result.is_empty());
        assert_eq!(result.len() % VERTEX_STRIDE, 0);
    }

    #[test]
    fn test_debug_lines_entity_hitbox() {
        let result = debug_lines_entity_hitbox(100.0, 64.0, 100.0, 0.6, 1.8, None, None, None, false).unwrap();
        assert_eq!(result.len(), 216); // Just the main box

        let result = debug_lines_entity_hitbox(100.0, 64.0, 100.0, 0.6, 1.8, Some(1.62), Some(0.0), Some(0.0), true).unwrap();
        // Main box (12 edges) + eye box (12 edges) + look vector (1 edge) = 25 edges = 50 vertices = 450 floats
        assert_eq!(result.len(), 450);
    }

    #[test]
    fn test_invalid_inputs() {
        assert!(debug_lines_line(&[0.0, 0.0], &[1.0, 1.0, 1.0], &[1.0, 1.0, 1.0]).is_none());
        assert!(debug_lines_line(&[0.0, 0.0, 0.0], &[1.0, 1.0, 1.0], &[1.0, 1.0]).is_none());
        assert!(debug_lines_box(&[0.0, 0.0], &[1.0, 1.0, 1.0], &[1.0, 1.0, 1.0]).is_none());
        assert!(debug_lines_batch(&[]).is_none());
        assert!(debug_lines_batch(&[1.0, 2.0, 3.0]).is_none());
    }
}