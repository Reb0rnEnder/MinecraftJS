//! Port of `client/js/gfx/webgl2.js`: WebGL 2 math functions and shader uniform operations.
//!
//! Pure algorithmic port - extracts the math operations from the WebGL context.
//! The actual WebGL calls (gl.drawArrays, gl.createShader, etc.) cannot be ported
//! without a full WebGL implementation, but the underlying math can be.

use std::f32::consts::PI;

// ------------------------------------------------------------ Matrix4 Operations

/// 4x4 matrix stored as [row0, row1, row2, row3] where each row is [m0,m1,m2,m3]
type Mat4 = [[f32; 4]; 4];

/// Identity matrix
pub fn mat4_identity() -> Mat4 {
    [
        [1.0, 0.0, 0.0, 0.0],
        [0.0, 1.0, 0.0, 0.0],
        [0.0, 0.0, 1.0, 0.0],
        [0.0, 0.0, 0.0, 1.0],
    ]
}

/// Multiply two 4x4 matrices: result = a * b
pub fn mat4_mul(a: &Mat4, b: &Mat4) -> Mat4 {
    let mut result = mat4_identity();
    for i in 0..4 {
        for j in 0..4 {
            result[i][j] = a[i][0] * b[0][j] + a[i][1] * b[1][j] + a[i][2] * b[2][j] + a[i][3] * b[3][j];
        }
    }
    result
}

/// Perspective projection matrix
/// Matches the JS perspective fovy, aspect, near, far
pub fn mat4_perspective(y_fov: f32, aspect: f32, near: f32, far: f32) -> Mat4 {
    let f = 1.0 / (y_fov / 2.0).tan();
    let nf = 1.0 / (near - far);
    [
        [aspect / f, 0.0, 0.0, 0.0],
        [0.0, f, 0.0, 0.0],
        [0.0, 0.0, (far + near) * nf, -1.0],
        [0.0, 0.0, (2.0 * far * near) * nf, 0.0],
    ]
}

/// Look-at matrix
pub fn mat4_look_at(eye: [f32; 3], center: [f32; 3], up: [f32; 3]) -> Mat4 {
    let f = [
        center[0] - eye[0],
        center[1] - eye[1],
        center[2] - eye[2],
    ];
    let len = (f[0] * f[0] + f[1] * f[1] + f[2] * f[2]).sqrt();
    let f = [f[0] / len, f[1] / len, f[2] / len];
    
    let s = [
        up[1] * f[2] - up[2] * f[1],
        up[2] * f[0] - up[0] * f[2],
        up[0] * f[1] - up[1] * f[0],
    ];
    let s_len = (s[0] * s[0] + s[1] * s[1] + s[2] * s[2]).sqrt();
    let s = [s[0] / s_len, s[1] / s_len, s[2] / s_len];
    
    let u = [
        f[1] * s[2] - f[2] * s[1],
        f[2] * s[0] - f[0] * s[2],
        f[0] * s[1] - f[1] * s[0],
    ];
    
    [
        [s[0], u[0], f[0], 0.0],
        [s[1], u[1], f[1], 0.0],
        [s[2], u[2], f[2], 0.0],
        [-eye[0] * s[0] - eye[1] * s[1] - eye[2] * s[2],
         -eye[0] * u[0] - eye[1] * u[1] - eye[2] * u[2],
         -eye[0] * f[0] - eye[1] * f[1] - eye[2] * f[2], 1.0],
    ]
}

// ------------------------------------------------------------ Quaternion Operations

/// Quaternion as [x, y, z, w]
type Quat = [f32; 4];

/// Multiply two quaternions: q1 * q2
pub fn quat_mul(q1: &Quat, q2: &Quat) -> Quat {
    [
        q1[3] * q2[0] + q1[0] * q2[3] + q1[1] * q2[2] - q1[2] * q2[1],
        q1[3] * q2[1] - q1[0] * q2[3] + q1[1] * q2[2] + q1[2] * q2[0],
        q1[3] * q2[2] - q1[0] * q2[2] + q1[1] * q2[1] - q1[2] * q2[3],
        q1[3] * q2[3] - q1[0] * q2[0] - q1[1] * q2[1] - q1[2] * q2[2],
    ]
}

/// Normalize a quaternion
pub fn quat_normalize(q: &Quat) -> Quat {
    let len = (q[0] * q[0] + q[1] * q[1] + q[2] * q[2] + q[3] * q[3]).sqrt();
    if len == 0.0 {
        return [0.0, 0.0, 0.0, 1.0];
    }
    [
        q[0] / len,
        q[1] / len,
        q[2] / len,
        q[3] / len,
    ]
}

// ------------------------------------------------------------ Vector Operations

/// 3D vector
type Vec3 = [f32; 3];

/// Cross product
pub fn vec3_cross(a: &Vec3, b: &Vec3) -> Vec3 {
    [
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0],
    ]
}

/// Dot product
pub fn vec3_dot(a: &Vec3, b: &Vec3) -> f32 {
    a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}

/// Length of vector
pub fn vec3_len(a: &Vec3) -> f32 {
    (a[0] * a[0] + a[1] * a[1] + a[2] * a[2]).sqrt()
}

/// Normalize vector
pub fn vec3_normalize(a: &Vec3) -> Vec3 {
    let len = vec3_len(a);
    if len == 0.0 {
        return [0.0, 0.0, 0.0];
    }
    [a[0] / len, a[1] / len, a[2] / len]
}

// ------------------------------------------------------------ Exports

/// JS: `export const v4 = () => new Array(4).fill(0);`
pub fn v4() -> Vec<f32> {
    vec![0.0, 0.0, 0.0, 0.0]
}

/// JS: `export const identity = () => mat4.identity();`
pub fn identity() -> Mat4 {
    mat4_identity()
}

/// JS: `export const perspective = (fovy, aspect, near, far) => mat4.perspective(fovy, aspect, near, far);`
pub fn perspective(y_fov: f32, aspect: f32, near: f32, far: f32) -> Mat4 {
    mat4_perspective(y_fov, aspect, near, far)
}

// ------------------------------------------------------------ Tests

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_mat4_identity() {
        let m = mat4_identity();
        assert!((m[0][0] - 1.0).abs() < 0.0001);
        assert!((m[1][1] - 1.0).abs() < 0.0001);
        assert!((m[2][2] - 1.0).abs() < 0.0001);
        assert!((m[3][3] - 1.0).abs() < 0.0001);
        assert!((m[0][1]).abs() < 0.0001); // off-diagonal should be 0
    }

    #[test]
    fn test_mat4_mul() {
        let a = mat4_identity();
        let b = mat4_identity();
        let r = mat4_mul(&a, &b);
        assert!((r[0][0] - 1.0).abs() < 0.0001);
    }

    #[test]
    fn test_mat4_perspective() {
        let p = mat4_perspective(45.0, 1.0, 0.1, 100.0);
        // Verify it's a valid perspective matrix (m11 should be positive)
        assert!(p[0][0] > 0.0);
    }

    #[test]
    fn test_quat_mul() {
        let q1: Quat = [0.0, 0.0, 0.0, 1.0]; // identity
        let q2: Quat = [0.0, 0.0, 0.0, 1.0];
        let r = quat_mul(&q1, &q2);
        assert!((r[3] - 1.0).abs() < 0.0001); // w component should be 1
    }
}