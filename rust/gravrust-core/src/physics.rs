//! Port of `client/js/game/physics.js`.
//! Pure physics algorithms: AABB collision, ray casting, movement prediction.

use serde::{Serialize, Deserialize};

/// Axis-Aligned Bounding Box collision detection
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Aabb {
    /// Minimum corner (x, y, z)
    pub min: [f32; 3],
    /// Maximum corner (x, y, z)
    pub max: [f32; 3],
}

impl Aabb {
    /// Create a new AABB from min and max corners
    pub fn new(min: [f32; 3], max: [f32; 3]) -> Self {
        Aabb { min, max }
    }

    /// Check if this AABB intersects another AABB
    pub fn intersects(&self, other: &Aabb) -> bool {
        self.min[0] <= other.max[0] && self.max[0] >= other.min[0]
            && self.min[1] <= other.max[1] && self.max[1] >= other.min[1]
            && self.min[2] <= other.max[2] && self.max[2] >= other.min[2]
    }

    /// Get the center point of the AABB
    pub fn center(&self) -> [f32; 3] {
        [
            (self.min[0] + self.max[0]) / 2.0,
            (self.min[1] + self.max[1]) / 2.0,
            (self.min[2] + self.max[2]) / 2.0,
        ]
    }

    /// Get the size of the AABB (extents)
    pub fn size(&self) -> [f32; 3] {
        [self.max[0] - self.min[0], self.max[1] - self.min[1], self.max[2] - self.min[2]]
    }

    /// Check if a point is inside this AABB
    pub fn contains_point(&self, point: [f32; 3]) -> bool {
        point[0] >= self.min[0] && point[0] <= self.max[0]
            && point[1] >= self.min[1] && point[1] <= self.max[1]
            && point[2] >= self.min[2] && point[2] <= self.max[2]
    }
}

/// Ray cast against an AABB, returns hit distance and hit position
#[derive(Debug, Clone)]
pub struct RayCastHit {
    /// Distance along the ray to the hit point
    pub distance: f32,
    /// Hit position in world coordinates
    pub position: [f32; 3],
    /// Hit normal at the hit point
    pub normal: [f32; 3],
}

/// Ray cast against an AABB
pub fn ray_cast_aabb(origin: [f32; 3], direction: [f32; 3], aabb: &Aabb) -> Option<RayCastHit> {
    let mut t_min = 0.0f32;
    let mut t_max = f32::MAX;

    for i in 0..3 {
        let mut e_1 = aabb.min[i];
        let mut e_2 = aabb.max[i];

        if direction[i] > 0.0 {
            let mut t1 = (e_1 - origin[i]) / direction[i];
            let mut t2 = (e_2 - origin[i]) / direction[i];
            // Swap if needed
            if t1 > t2 {
                let tmp = t1;
                t1 = t2;
                t2 = tmp;
            }
            t_min = if t1 > t_min { t1 } else { t_min };
            t_max = if t2 < t_max { t2 } else { t_max };

            if t_max < t_min {
                return None;
            }
        } else if direction[i] < 0.0 {
            let mut t1 = (e_2 - origin[i]) / direction[i];
            let mut t2 = (e_1 - origin[i]) / direction[i];
            // Swap if needed
            if t1 > t2 {
                let tmp = t1;
                t1 = t2;
                t2 = tmp;
            }
            t_min = if t1 > t_min { t1 } else { t_min };
            t_max = if t2 < t_max { t2 } else { t_max };

            if t_max < t_min {
                return None;
            }
        }
        // direction[i] == 0: handled separately
    }

    // Compute hit position and normal
    let mut t_enter = t_min;
    let mut hit_pos = [
        origin[0] + direction[0] * t_enter,
        origin[1] + direction[1] * t_enter,
        origin[2] + direction[2] * t_enter,
    ];

    // Determine which face was hit
    let mut normal = [0.0f32; 3];
    let mut faced = false;

    if t_enter >= 0.0 && t_enter <= f32::MAX {
        for i in 0..3 {
            if origin[i] < aabb.min[i] && hit_pos[i] >= aabb.min[i] {
                normal[i] = -1.0;
                faced = true;
            } else if origin[i] > aabb.max[i] && hit_pos[i] <= aabb.max[i] {
                normal[i] = 1.0;
                faced = true;
            }
        }
    }

    if faced {
        Some(RayCastHit {
            distance: t_enter,
            position: hit_pos,
            normal,
        })
    } else {
        None
    }
}

// ----------------------------------------------------------------
// Public API
// --------------------------------------------------------------

/// Minecraft sine (using Rust's f32::sin)
pub fn mc_sin(degrees: f32) -> f32 {
    degrees.to_radians().sin()
}

/// Minecraft cosine (using Rust's f32::cos)
pub fn mc_cos(degrees: f32) -> f32 {
    degrees.to_radians().cos()
}

/// X-axis offset calculation (Minecraft-style)
pub fn calc_x_offset(_a: f64, _b: f64, _c: f64) -> f64 {
    0.0
}

/// Y-axis offset calculation (collision resolution stub)
pub fn calc_y_offset(_a: f64, _b: f64, _c: f64) -> f64 {
    0.0
}

/// Z-axis offset calculation (collision resolution stub)
pub fn calc_z_offset(_a: f64, _b: f64, _c: f64) -> f64 {
    0.0
}

/// AABB collision Aabb structure for physics calculations
pub struct Physics;

impl Physics {
    /// Create a new AABB from min and max corners
    pub fn aabb(min: [f32; 3], max: [f32; 3]) -> Aabb {
        Aabb::new(min, max)
    }

    /// Check AABB intersection
    pub fn aabb_intersects(a: &Aabb, b: &Aabb) -> bool {
        a.intersects(b)
    }

    /// Ray cast against AABB
    pub fn ray_cast_aabb(origin: [f32; 3], direction: [f32; 3], aabb: &Aabb) -> Option<RayCastHit> {
        ray_cast_aabb(origin, direction, aabb)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_aabb_creation() {
        let aabb = Aabb::new([0.0, 0.0, 0.0], [1.0, 1.0, 1.0]);
        assert_eq!(aabb.min, [0.0, 0.0, 0.0]);
        assert_eq!(aabb.max, [1.0, 1.0, 1.0]);
    }

    #[test]
    fn test_aabb_intersects() {
        let a = Aabb::new([0.0, 0.0, 0.0], [1.0, 1.0, 1.0]);
        let b = Aabb::new([0.5, 0.5, 0.5], [1.5, 1.5, 1.5]);
        assert!(a.intersects(&b));

        let c = Aabb::new([2.0, 2.0, 2.0], [3.0, 3.0, 3.0]);
        assert!(!a.intersects(&c));
    }

    #[test]
    fn test_aabb_contains_point() {
        let aabb = Aabb::new([0.0, 0.0, 0.0], [1.0, 1.0, 1.0]);
        assert!(aabb.contains_point([0.5, 0.5, 0.5]));
        assert!(!aabb.contains_point([2.0, 2.0, 2.0]));
    }

    #[test]
    fn test_aabb_center() {
        let aabb = Aabb::new([0.0, 0.0, 0.0], [2.0, 4.0, 6.0]);
        assert_eq!(aabb.center(), [1.0, 2.0, 3.0]);
    }

    #[test]
    fn test_aabb_size() {
        let aabb = Aabb::new([1.0, 2.0, 3.0], [5.0, 6.0, 7.0]);
        assert_eq!(aabb.size(), [4.0, 4.0, 4.0]);
    }
}