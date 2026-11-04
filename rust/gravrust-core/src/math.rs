//! Port of `client/js/gfx/math.js`.
//!
//! Includes the column-major 4x4 matrix helpers and the frustum extraction /
//! AABB test. JavaScript computes in doubles and stores into `Float32Array`s,
//! so every helper here also accumulates in f64 and rounds once on store.
//! Planes stay in f64 to match JavaScript number arithmetic exactly.

use wasm_bindgen::prelude::*;

/// Six planes of four f64 values each.
pub const PLANE_COUNT: usize = 6;

/// Extract and normalise the six frustum planes from a column-major
/// view-projection matrix (16 floats). Same plane order as the JS:
/// left, right, bottom, top, near, far.
pub fn frustum_planes(matrix: &[f32]) -> [f64; PLANE_COUNT * 4] {
    let mut planes = [0f64; PLANE_COUNT * 4];
    if matrix.len() < 16 {
        return planes;
    }
    let m = |i: usize| matrix[i] as f64;
    let rows: [[f64; 4]; 6] = [
        [m(3) + m(0), m(7) + m(4), m(11) + m(8), m(15) + m(12)],
        [m(3) - m(0), m(7) - m(4), m(11) - m(8), m(15) - m(12)],
        [m(3) + m(1), m(7) + m(5), m(11) + m(9), m(15) + m(13)],
        [m(3) - m(1), m(7) - m(5), m(11) - m(9), m(15) - m(13)],
        [m(3) + m(2), m(7) + m(6), m(11) + m(10), m(15) + m(14)],
        [m(3) - m(2), m(7) - m(6), m(11) - m(10), m(15) - m(14)],
    ];
    for (index, plane) in rows.iter().enumerate() {
        let mut length = (plane[0] * plane[0] + plane[1] * plane[1] + plane[2] * plane[2]).sqrt();
        if length == 0.0 {
            length = 1.0;
        }
        let base = index * 4;
        planes[base] = plane[0] / length;
        planes[base + 1] = plane[1] / length;
        planes[base + 2] = plane[2] / length;
        planes[base + 3] = plane[3] / length;
    }
    planes
}

/// `aabbInFrustum`: the box is rejected only when its positive vertex is
/// behind a plane.
pub fn aabb_in_frustum(
    planes: &[f64],
    x0: f64,
    y0: f64,
    z0: f64,
    x1: f64,
    y1: f64,
    z1: f64,
) -> bool {
    for index in 0..PLANE_COUNT {
        let base = index * 4;
        let (px, py, pz, pw) = match (
            planes.get(base),
            planes.get(base + 1),
            planes.get(base + 2),
            planes.get(base + 3),
        ) {
            (Some(a), Some(b), Some(c), Some(d)) => (*a, *b, *c, *d),
            _ => return false,
        };
        let x = if px >= 0.0 { x1 } else { x0 };
        let y = if py >= 0.0 { y1 } else { y0 };
        let z = if pz >= 0.0 { z1 } else { z0 };
        if px * x + py * y + pz * z + pw < 0.0 {
            return false;
        }
    }
    true
}

/// Persistent frustum used by the renderer: `from_matrix` runs once per
/// camera change, then every culling call is just the box test.
#[wasm_bindgen]
pub struct Frustum {
    planes: Vec<f64>,
}

impl Default for Frustum {
    fn default() -> Self {
        Self {
            planes: vec![0.0; PLANE_COUNT * 4],
        }
    }
}

#[wasm_bindgen]
impl Frustum {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Frustum {
        Frustum::default()
    }

    /// Update from a column-major view-projection matrix (`Float32Array(16)`).
    pub fn from_matrix(&mut self, matrix: &[f32]) {
        let planes = frustum_planes(matrix);
        self.planes.clear();
        self.planes.extend_from_slice(&planes);
    }

    pub fn contains_aabb(&self, x0: f64, y0: f64, z0: f64, x1: f64, y1: f64, z1: f64) -> bool {
        aabb_in_frustum(&self.planes, x0, y0, z0, x1, y1, z1)
    }

    /// Flattened planes, for tests and debugging.
    pub fn planes(&self) -> Vec<f64> {
        self.planes.clone()
    }
}

// --------------------------------------------------------------- mat4 helpers

/// Column-major 4x4 identity matrix.
pub fn identity_matrix() -> [f32; 16] {
    let mut m = [0f32; 16];
    m[0] = 1.0;
    m[5] = 1.0;
    m[10] = 1.0;
    m[15] = 1.0;
    m
}

/// `mat4.multiply(out, a, b)` with `out` as the return value.
pub fn multiply(a: &[f32], b: &[f32]) -> [f32; 16] {
    let mut out = [0f32; 16];
    let g = |v: &[f32], i: usize| v.get(i).copied().unwrap_or(0.0) as f64;
    let (a00, a01, a02, a03) = (g(a, 0), g(a, 1), g(a, 2), g(a, 3));
    let (a10, a11, a12, a13) = (g(a, 4), g(a, 5), g(a, 6), g(a, 7));
    let (a20, a21, a22, a23) = (g(a, 8), g(a, 9), g(a, 10), g(a, 11));
    let (a30, a31, a32, a33) = (g(a, 12), g(a, 13), g(a, 14), g(a, 15));
    for i in 0..4 {
        let b0 = g(b, i * 4);
        let b1 = g(b, i * 4 + 1);
        let b2 = g(b, i * 4 + 2);
        let b3 = g(b, i * 4 + 3);
        out[i * 4] = (b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30) as f32;
        out[i * 4 + 1] = (b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31) as f32;
        out[i * 4 + 2] = (b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32) as f32;
        out[i * 4 + 3] = (b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33) as f32;
    }
    out
}

/// `mat4.translate`: post-multiplies by a translation, like glTranslate.
pub fn translate(a: &[f32], x: f64, y: f64, z: f64) -> [f32; 16] {
    let mut out = [0f32; 16];
    for i in 0..16 {
        out[i] = a.get(i).copied().unwrap_or(0.0);
    }
    let g = |i: usize| a.get(i).copied().unwrap_or(0.0) as f64;
    out[12] = (g(0) * x + g(4) * y + g(8) * z + g(12)) as f32;
    out[13] = (g(1) * x + g(5) * y + g(9) * z + g(13)) as f32;
    out[14] = (g(2) * x + g(6) * y + g(10) * z + g(14)) as f32;
    out[15] = (g(3) * x + g(7) * y + g(11) * z + g(15)) as f32;
    out
}

/// `mat4.scale`: scales the basis columns, leaving the translation column.
pub fn scale(a: &[f32], x: f64, y: f64, z: f64) -> [f32; 16] {
    let mut out = [0f32; 16];
    for i in 0..4 {
        out[i] = (a.get(i).copied().unwrap_or(0.0) as f64 * x) as f32;
        out[4 + i] = (a.get(4 + i).copied().unwrap_or(0.0) as f64 * y) as f32;
        out[8 + i] = (a.get(8 + i).copied().unwrap_or(0.0) as f64 * z) as f32;
        out[12 + i] = a.get(12 + i).copied().unwrap_or(0.0);
    }
    out
}

/// `mat4.rotate` about an arbitrary axis (radians), like glRotate.
pub fn rotate(a: &[f32], radians: f64, x: f64, y: f64, z: f64) -> [f32; 16] {
    let length = (x * x + y * y + z * z).sqrt();
    if length < 1e-8 {
        let mut out = [0f32; 16];
        for i in 0..16 {
            out[i] = a.get(i).copied().unwrap_or(0.0);
        }
        return out;
    }
    let (x, y, z) = (x / length, y / length, z / length);
    let s = radians.sin();
    let c = radians.cos();
    let t = 1.0 - c;
    let mut r = [0f32; 16];
    r[0] = (x * x * t + c) as f32;
    r[1] = (y * x * t + z * s) as f32;
    r[2] = (z * x * t - y * s) as f32;
    r[4] = (x * y * t - z * s) as f32;
    r[5] = (y * y * t + c) as f32;
    r[6] = (z * y * t + x * s) as f32;
    r[8] = (x * z * t + y * s) as f32;
    r[9] = (y * z * t - x * s) as f32;
    r[10] = (z * z * t + c) as f32;
    r[15] = 1.0;
    multiply(a, &r)
}

/// `mat4.perspective`, OpenGL conventions, column-major.
pub fn perspective(fovy_radians: f64, aspect: f64, near: f64, far: f64) -> [f32; 16] {
    let f = 1.0 / (fovy_radians / 2.0).tan();
    let mut out = [0f32; 16];
    out[0] = (f / aspect) as f32;
    out[5] = f as f32;
    out[10] = ((far + near) / (near - far)) as f32;
    out[11] = -1.0;
    out[14] = ((2.0 * far * near) / (near - far)) as f32;
    out
}

/// `mat4.ortho`, column-major.
pub fn ortho(left: f64, right: f64, bottom: f64, top: f64, near: f64, far: f64) -> [f32; 16] {
    let (l, r, b, t, n, f) = (left, right, bottom, top, near, far);
    let mut out = [0f32; 16];
    out[0] = (2.0 / (r - l)) as f32;
    out[5] = (2.0 / (t - b)) as f32;
    out[10] = (-2.0 / (f - n)) as f32;
    out[12] = (-(r + l) / (r - l)) as f32;
    out[13] = (-(t + b) / (t - b)) as f32;
    out[14] = (-(f + n) / (f - n)) as f32;
    out[15] = 1.0;
    out
}

/// `mat4.invert`; `None` for singular matrices, like the JS returning null.
pub fn invert(a: &[f32]) -> Option<[f32; 16]> {
    let g = |i: usize| a.get(i).copied().unwrap_or(0.0) as f64;
    let (a00, a01, a02, a03) = (g(0), g(1), g(2), g(3));
    let (a10, a11, a12, a13) = (g(4), g(5), g(6), g(7));
    let (a20, a21, a22, a23) = (g(8), g(9), g(10), g(11));
    let (a30, a31, a32, a33) = (g(12), g(13), g(14), g(15));
    let b00 = a00 * a11 - a01 * a10;
    let b01 = a00 * a12 - a02 * a10;
    let b02 = a00 * a13 - a03 * a10;
    let b03 = a01 * a12 - a02 * a11;
    let b04 = a01 * a13 - a03 * a11;
    let b05 = a02 * a13 - a03 * a12;
    let b06 = a20 * a31 - a21 * a30;
    let b07 = a20 * a32 - a22 * a30;
    let b08 = a20 * a33 - a23 * a30;
    let b09 = a21 * a32 - a22 * a31;
    let b10 = a21 * a33 - a23 * a31;
    let b11 = a22 * a33 - a23 * a32;
    let mut det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
    if det == 0.0 {
        return None;
    }
    det = 1.0 / det;
    let mut out = [0f32; 16];
    out[0] = ((a11 * b11 - a12 * b10 + a13 * b09) * det) as f32;
    out[1] = ((a02 * b10 - a01 * b11 - a03 * b09) * det) as f32;
    out[2] = ((a31 * b05 - a32 * b04 + a33 * b03) * det) as f32;
    out[3] = ((a22 * b04 - a21 * b05 - a23 * b03) * det) as f32;
    out[4] = ((a12 * b08 - a10 * b11 - a13 * b07) * det) as f32;
    out[5] = ((a00 * b11 - a02 * b08 + a03 * b07) * det) as f32;
    out[6] = ((a32 * b02 - a30 * b05 - a33 * b01) * det) as f32;
    out[7] = ((a20 * b05 - a22 * b02 + a23 * b01) * det) as f32;
    out[8] = ((a10 * b10 - a11 * b08 + a13 * b06) * det) as f32;
    out[9] = ((a01 * b08 - a00 * b10 - a03 * b06) * det) as f32;
    out[10] = ((a30 * b04 - a31 * b02 + a33 * b00) * det) as f32;
    out[11] = ((a21 * b02 - a20 * b04 - a23 * b00) * det) as f32;
    out[12] = ((a11 * b07 - a10 * b09 - a12 * b06) * det) as f32;
    out[13] = ((a00 * b09 - a01 * b07 + a02 * b06) * det) as f32;
    out[14] = ((a31 * b01 - a30 * b03 - a32 * b00) * det) as f32;
    out[15] = ((a20 * b03 - a21 * b01 + a22 * b00) * det) as f32;
    Some(out)
}

/// `mat4.transformPoint`.
pub fn transform_point(m: &[f32], x: f64, y: f64, z: f64) -> [f32; 3] {
    let g = |i: usize| m.get(i).copied().unwrap_or(0.0) as f64;
    [
        (g(0) * x + g(4) * y + g(8) * z + g(12)) as f32,
        (g(1) * x + g(5) * y + g(9) * z + g(13)) as f32,
        (g(2) * x + g(6) * y + g(10) * z + g(14)) as f32,
    ]
}

/// `mat4.transformDir`.
pub fn transform_dir(m: &[f32], x: f64, y: f64, z: f64) -> [f32; 3] {
    let g = |i: usize| m.get(i).copied().unwrap_or(0.0) as f64;
    [
        (g(0) * x + g(4) * y + g(8) * z) as f32,
        (g(1) * x + g(5) * y + g(9) * z) as f32,
        (g(2) * x + g(6) * y + g(10) * z) as f32,
    ]
}

#[wasm_bindgen]
pub fn mat4_multiply(a: &[f32], b: &[f32]) -> Vec<f32> {
    multiply(a, b).to_vec()
}

#[wasm_bindgen]
pub fn mat4_translate(a: &[f32], x: f64, y: f64, z: f64) -> Vec<f32> {
    translate(a, x, y, z).to_vec()
}

#[wasm_bindgen]
pub fn mat4_scale(a: &[f32], x: f64, y: f64, z: f64) -> Vec<f32> {
    scale(a, x, y, z).to_vec()
}

#[wasm_bindgen]
pub fn mat4_rotate(a: &[f32], radians: f64, x: f64, y: f64, z: f64) -> Vec<f32> {
    rotate(a, radians, x, y, z).to_vec()
}

#[wasm_bindgen]
pub fn mat4_perspective(fovy_radians: f64, aspect: f64, near: f64, far: f64) -> Vec<f32> {
    perspective(fovy_radians, aspect, near, far).to_vec()
}

#[wasm_bindgen]
pub fn mat4_ortho(
    left: f64,
    right: f64,
    bottom: f64,
    top: f64,
    near: f64,
    far: f64,
) -> Vec<f32> {
    ortho(left, right, bottom, top, near, far).to_vec()
}

#[wasm_bindgen]
pub fn mat4_invert(a: &[f32]) -> Option<Vec<f32>> {
    invert(a).map(|m| m.to_vec())
}

#[wasm_bindgen]
pub fn mat4_transform_point(m: &[f32], x: f64, y: f64, z: f64) -> Vec<f32> {
    transform_point(m, x, y, z).to_vec()
}

#[wasm_bindgen]
pub fn mat4_transform_dir(m: &[f32], x: f64, y: f64, z: f64) -> Vec<f32> {
    transform_dir(m, x, y, z).to_vec()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn identity() -> Vec<f32> {
        let mut m = vec![0f32; 16];
        m[0] = 1.0;
        m[5] = 1.0;
        m[10] = 1.0;
        m[15] = 1.0;
        m
    }

    fn perspective(aspect: f32, fov: f32, near: f32, far: f32) -> Vec<f32> {
        let f = 1.0 / (fov / 2.0).tan();
        let mut m = vec![0f32; 16];
        m[0] = f / aspect;
        m[5] = f;
        m[10] = (far + near) / (near - far);
        m[11] = -1.0;
        m[14] = (2.0 * far * near) / (near - far);
        m
    }

    #[test]
    fn planes_are_normalised() {
        let planes = frustum_planes(&perspective(16.0 / 9.0, 1.2, 0.05, 512.0));
        for i in 0..PLANE_COUNT {
            let a = planes[i * 4];
            let b = planes[i * 4 + 1];
            let c = planes[i * 4 + 2];
            let length = (a * a + b * b + c * c).sqrt();
            assert!((length - 1.0).abs() < 1e-9, "plane {} not normalised: {}", i, length);
        }
    }

    #[test]
    fn a_box_at_the_camera_is_visible() {
        let planes = frustum_planes(&perspective(1.0, 1.0, 0.05, 100.0));
        assert!(aabb_in_frustum(&planes, -0.5, -0.5, -1.0, 0.5, 0.5, 1.0));
    }

    #[test]
    fn a_box_far_behind_the_camera_is_culled() {
        let planes = frustum_planes(&perspective(1.0, 1.0, 0.05, 100.0));
        assert!(!aabb_in_frustum(&planes, -1.0, -1.0, 2.0, 1.0, 1.0, 4.0));
        assert!(!aabb_in_frustum(&planes, 1000.0, 0.0, -1.0, 1016.0, 16.0, 1.0));
    }

    #[test]
    fn frustum_object_matches_free_functions() {
        let matrix = perspective(1.5, 1.1, 0.05, 256.0);
        let mut frustum = Frustum::new();
        frustum.from_matrix(&matrix);
        let planes = frustum_planes(&matrix);
        for (index, expected) in planes.iter().enumerate() {
            assert!((frustum.planes()[index] - expected).abs() < 1e-12);
        }
        assert_eq!(
            frustum.contains_aabb(-8.0, 0.0, -1.0, 8.0, 16.0, 1.0),
            aabb_in_frustum(&planes, -8.0, 0.0, -1.0, 8.0, 16.0, 1.0)
        );
    }

    #[test]
    fn identity_matrix_keeps_the_positive_octant() {
        let planes = frustum_planes(&identity());
        assert!(aabb_in_frustum(&planes, 0.0, 0.0, 0.0, 1.0, 1.0, 1.0));
    }

    #[test]
    fn multiply_matches_identity() {
        let m = perspective(1.2, 1.6, 0.05, 100.0);
        assert_eq!(&multiply(&m, &identity_matrix())[..], &m[..]);
        assert_eq!(&multiply(&identity_matrix(), &m)[..], &m[..]);
    }

    #[test]
    fn translate_moves_the_origin() {
        let m = translate(&identity_matrix(), 2.0, 3.0, 4.0);
        assert_eq!(transform_point(&m, 0.0, 0.0, 0.0), [2.0, 3.0, 4.0]);
        assert_eq!(transform_dir(&m, 0.0, 0.0, 0.0), [0.0, 0.0, 0.0]);
    }

    #[test]
    fn scale_and_rotate_roundtrip() {
        let scaled = scale(&identity_matrix(), 2.0, 4.0, 8.0);
        assert_eq!(transform_point(&scaled, 1.0, 1.0, 1.0), [2.0, 4.0, 8.0]);
        let rotated = rotate(&identity_matrix(), std::f64::consts::FRAC_PI_2, 0.0, 1.0, 0.0);
        let p = transform_point(&rotated, 1.0, 0.0, 0.0);
        assert!(p[0].abs() < 1e-6 && (p[2] + 1.0).abs() < 1e-6, "{:?}", p);
    }

    #[test]
    fn invert_undoes_a_perspective_transform() {
        let m = perspective(1.1, 1.5, 0.05, 256.0);
        let inv = invert(&m).expect("invertible");
        let product = multiply(&m, &inv);
        for i in 0..4 {
            for j in 0..4 {
                let expected = if i == j { 1.0 } else { 0.0 };
                assert!((product[i * 4 + j] - expected).abs() < 1e-4, "{} {}", i, j);
            }
        }
    }

    #[test]
    fn singular_matrices_have_no_inverse() {
        assert!(invert(&[0.0; 16]).is_none());
    }

    #[test]
    fn ortho_maps_the_corners() {
        let m = ortho(-1.0, 1.0, -1.0, 1.0, 0.0, 10.0);
        assert_eq!(transform_point(&m, -1.0, -1.0, -10.0), [-1.0, -1.0, 1.0]);
        assert_eq!(transform_point(&m, 1.0, 1.0, 0.0), [1.0, 1.0, -1.0]);
    }
}
