//! Port of `client/js/render/hand-renderer.js`.
//!
//! First-person hand/item rendering (port of vanilla 1.12+ ItemRenderer.renderItemInFirstPerson, both hands).
//! Handles view bobbing, hurt camera tilt, arm yaw/pitch lag, first-person transforms
//! for empty arms, maps (one- and two-handed), held items, eating/drinking, bows,
//! crossbows, and tridents/spears.

use std::f64::consts::PI;
use crate::math::{identity_matrix, multiply, perspective, rotate, scale, translate};

pub const D2R: f64 = PI / 180.0;

/// Item use action kinds matching vanilla / MinecraftJS `items.useAction(stack)`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum UseAction {
    None,
    Eat,
    Drink,
    Block,
    Bow,
    Spear,
    Crossbow,
}

impl UseAction {
    pub fn from_str(s: &str) -> Self {
        match s {
            "eat" => UseAction::Eat,
            "drink" => UseAction::Drink,
            "block" => UseAction::Block,
            "bow" => UseAction::Bow,
            "spear" => UseAction::Spear,
            "crossbow" => UseAction::Crossbow,
            _ => UseAction::None,
        }
    }
}

/// First-person hand state tracker for arm lag & animation.
#[derive(Debug, Clone)]
pub struct HandRendererState {
    pub render_arm_pitch: f64,
    pub prev_render_arm_pitch: f64,
    pub render_arm_yaw: f64,
    pub prev_render_arm_yaw: f64,
    pub skin_dirty: bool,
}

impl Default for HandRendererState {
    fn default() -> Self {
        Self {
            render_arm_pitch: 0.0,
            prev_render_arm_pitch: 0.0,
            render_arm_yaw: 0.0,
            prev_render_arm_yaw: 0.0,
            skin_dirty: false,
        }
    }
}

impl HandRendererState {
    pub fn new() -> Self {
        Self::default()
    }

    /// JS: `tick()` — updates arm yaw and pitch lag toward player angles.
    pub fn tick(&mut self, player_pitch: f64, player_yaw: f64) {
        self.prev_render_arm_pitch = self.render_arm_pitch;
        self.prev_render_arm_yaw = self.render_arm_yaw;
        self.render_arm_pitch += (player_pitch - self.render_arm_pitch) * 0.5;
        self.render_arm_yaw += (player_yaw - self.render_arm_yaw) * 0.5;
    }

    /// JS: `invalidateSkin()`
    pub fn invalidate_skin(&mut self) {
        self.skin_dirty = true;
    }

    /// JS: `reset()`
    pub fn reset(&mut self) {
        self.skin_dirty = false;
    }
}

/// JS: Hand projection matrix: fixed 70-degree FOV, near 0.05, far 10.0.
pub fn hand_projection_matrix(width: f64, height: f64) -> [f32; 16] {
    let aspect = if height > 0.0 { width / height } else { 1.0 };
    perspective(70.0 * D2R, aspect, 0.05, 10.0)
}

/// JS: `transformSideFirstPerson`
/// `mat4.translate(m, m, side * 0.56, -0.52 + equip * -0.6, -0.72)`
pub fn side_transform(m: &[f32; 16], side: f64, equip: f64) -> [f32; 16] {
    translate(m, side * 0.56, -0.52 + equip * -0.6, -0.72)
}

/// Parameters for constructing the hand base matrix (view bobbing, hurt tilt, arm lag).
#[derive(Debug, Clone, Copy)]
pub struct HandBaseParams {
    pub hurt_time: f64,
    pub partial: f64,
    pub view_bobbing: bool,
    pub distance_walked: f64,
    pub prev_distance_walked: f64,
    pub camera_yaw: f64,
    pub prev_camera_yaw: f64,
    pub camera_pitch: f64,
    pub prev_camera_pitch: f64,
    pub pitch: f64,
    pub prev_pitch: f64,
    pub yaw: f64,
    pub prev_yaw: f64,
    pub render_arm_pitch: f64,
    pub prev_render_arm_pitch: f64,
    pub render_arm_yaw: f64,
    pub prev_render_arm_yaw: f64,
}

/// JS: `EntityRenderer.renderHand` — hurt camera effect + view bobbing, then `ItemRenderer.rotateArm`.
pub fn compute_base_matrix(p: &HandBaseParams) -> [f32; 16] {
    let mut base = identity_matrix();

    // Hurt camera effect
    if p.hurt_time > 0.0 {
        let mut f = (p.hurt_time - p.partial) / 10.0;
        f = (f * f * f * f * PI).sin();
        base = rotate(&base, -f * 14.0 * D2R, 0.0, 0.0, 1.0);
    }

    // View bobbing
    if p.view_bobbing {
        let f = p.distance_walked - p.prev_distance_walked;
        let f1 = -(p.distance_walked + f * p.partial);
        let f2 = p.prev_camera_yaw + (p.camera_yaw - p.prev_camera_yaw) * p.partial;
        let f3 = p.prev_camera_pitch + (p.camera_pitch - p.prev_camera_pitch) * p.partial;
        base = translate(
            &base,
            (f1 * PI).sin() * f2 * 0.5,
            -((f1 * PI).cos().abs() * f2),
            0.0,
        );
        base = rotate(&base, (f1 * PI).sin() * f2 * 3.0 * D2R, 0.0, 0.0, 1.0);
        base = rotate(
            &base,
            ((f1 * PI - 0.2).cos().abs() * f2 * 5.0) * D2R,
            1.0,
            0.0,
            0.0,
        );
        base = rotate(&base, f3 * D2R, 1.0, 0.0, 0.0);
    }

    // Arm rotation lag
    let pitch = p.prev_pitch + (p.pitch - p.prev_pitch) * p.partial;
    let yaw = p.prev_yaw + (p.yaw - p.prev_yaw) * p.partial;
    let arm_pitch = p.prev_render_arm_pitch
        + (p.render_arm_pitch - p.prev_render_arm_pitch) * p.partial;
    let arm_yaw = p.prev_render_arm_yaw
        + (p.render_arm_yaw - p.prev_render_arm_yaw) * p.partial;
    base = rotate(&base, (pitch - arm_pitch) * 0.1 * D2R, 1.0, 0.0, 0.0);
    base = rotate(&base, (yaw - arm_yaw) * 0.1 * D2R, 0.0, 1.0, 0.0);

    base
}

/// JS: `_armMatrix(m, equip, sw, side)` — empty hand first-person matrix.
pub fn compute_arm_matrix(equip: f64, sw: f64, side: f64) -> [f32; 16] {
    let mut m = identity_matrix();
    let f1 = sw.sqrt();
    let f2 = -0.3 * (f1 * PI).sin();
    let f3 = 0.4 * (f1 * PI * 2.0).sin();
    let f4 = -0.4 * (sw * PI).sin();

    m = translate(
        &m,
        side * (f2 + 0.64000005),
        f3 - 0.6 + equip * -0.6,
        f4 - 0.71999997,
    );
    m = rotate(&m, side * 45.0 * D2R, 0.0, 1.0, 0.0);

    let f5 = (sw * sw * PI).sin();
    let f6 = (f1 * PI).sin();
    m = rotate(&m, side * f6 * 70.0 * D2R, 0.0, 1.0, 0.0);
    m = rotate(&m, side * f5 * -20.0 * D2R, 0.0, 0.0, 1.0);

    m = translate(&m, side * -1.0, 3.6, 3.5);
    m = rotate(&m, side * 120.0 * D2R, 0.0, 0.0, 1.0);
    m = rotate(&m, 200.0 * D2R, 1.0, 0.0, 0.0);
    m = rotate(&m, side * -135.0 * D2R, 0.0, 1.0, 0.0);
    m = translate(&m, side * 5.6, 0.0, 0.0);

    m
}

/// JS: `_mapArm(side)` — rotate 92 Y, 45 X, -41 Z, translate(0.3, -1.1, 0.45).
pub fn compute_map_arm(side: f64) -> [f32; 16] {
    let mut a = identity_matrix();
    a = rotate(&a, 92.0 * D2R, 0.0, 1.0, 0.0);
    a = rotate(&a, 45.0 * D2R, 1.0, 0.0, 0.0);
    a = rotate(&a, side * -41.0 * D2R, 0.0, 0.0, 1.0);
    translate(&a, side * 0.3, -1.1, 0.45)
}

/// JS: `_mapItem(m)` — turn to face, scale 0.38, then 1/128 per map pixel.
pub fn compute_map_item(m: &[f32; 16]) -> [f32; 16] {
    let mut out = rotate(m, PI, 0.0, 1.0, 0.0);
    out = rotate(&out, PI, 0.0, 0.0, 1.0);
    out = scale(&out, 0.38, 0.38, 0.38);
    out = translate(&out, -0.5, -0.5, 0.0);
    scale(&out, 0.0078125, 0.0078125, 0.0078125)
}

/// JS: `_mapMatrix(h, m, pitch, equip, sw)` — two-handed map view matrices.
/// Returns `(main_matrix, right_arm_matrix, left_arm_matrix, map_matrix)`.
pub fn compute_map_matrices(pitch: f64, equip: f64, sw: f64) -> ([f32; 16], [f32; 16], [f32; 16], [f32; 16]) {
    let f = sw.sqrt();
    let f1 = -0.2 * (sw * PI).sin();
    let f2 = -0.4 * (f * PI).sin();
    let mut m = identity_matrix();
    m = translate(&m, 0.0, -f1 / 2.0, f2);

    let mut f3 = 1.0 - pitch / 45.0 + 0.1;
    f3 = f3.clamp(0.0, 1.0);
    f3 = -(f3 * PI).cos() * 0.5 + 0.5;

    m = translate(&m, 0.0, 0.04 + equip * -1.2 + f3 * -0.5, -0.72);
    m = rotate(&m, f3 * -85.0 * D2R, 1.0, 0.0, 0.0);

    let arms = rotate(&identity_matrix(), 90.0 * D2R, 0.0, 1.0, 0.0);
    let right_arm = multiply(&arms, &compute_map_arm(1.0));
    let left_arm = multiply(&arms, &compute_map_arm(-1.0));

    let mut mm = identity_matrix();
    mm = rotate(&mm, (f * PI).sin() * 20.0 * D2R, 1.0, 0.0, 0.0);
    mm = scale(&mm, 2.0, 2.0, 2.0);
    let map = compute_map_item(&mm);

    (m, right_arm, left_arm, map)
}

/// JS: `_mapSideMatrix(h, m, equip, sw, side)` — one-handed map view matrices.
/// Returns `(main_matrix, arm_matrix, map_matrix)`.
pub fn compute_map_side_matrices(equip: f64, sw: f64, side: f64) -> ([f32; 16], [f32; 16], [f32; 16]) {
    let mut m = identity_matrix();
    m = translate(&m, side * 0.125, -0.125, 0.0);

    let mut am = identity_matrix();
    am = rotate(&am, side * 10.0 * D2R, 0.0, 0.0, 1.0);
    let arm_m = compute_arm_matrix(equip, sw, side);
    am = multiply(&am, &arm_m);

    let mut mm = identity_matrix();
    mm = translate(&mm, side * 0.51, -0.08 + equip * -1.2, -0.75);
    let f1 = sw.sqrt();
    let f2 = (f1 * PI).sin();
    mm = translate(
        &mm,
        side * -0.5 * f2,
        0.4 * (f1 * PI * 2.0).sin() - 0.3 * f2,
        -0.3 * (sw * PI).sin(),
    );
    mm = rotate(&mm, f2 * -45.0 * D2R, 1.0, 0.0, 0.0);
    mm = rotate(&mm, side * f2 * -30.0 * D2R, 0.0, 1.0, 0.0);
    let map = compute_map_item(&mm);

    (m, am, map)
}

/// Parameters for computing item hand matrix.
#[derive(Debug, Clone, Copy)]
pub struct ItemMatrixParams {
    pub using_item: bool,
    pub is_active_hand: bool,
    pub use_ticks: f64,
    pub use_action: UseAction,
    pub use_duration: f64,
    pub crossbow_charge_duration: f64,
    pub crossbow_charged: bool,
    pub is_crossbow: bool,
    pub hand: usize,
    pub side: f64,
    pub equip: f64,
    pub sw: f64,
    pub partial: f64,
}

/// JS: `_itemMatrix(m, stack, hand, side, equip, sw, partial)`
pub fn compute_item_matrix(p: &ItemMatrixParams) -> [f32; 16] {
    let mut m = identity_matrix();

    if p.using_item && p.is_active_hand && p.use_ticks > 0.0 {
        match p.use_action {
            UseAction::Eat | UseAction::Drink => {
                // transformEatFirstPerson
                let f = p.use_duration - p.use_ticks - p.partial + 1.0;
                let f1 = f / p.use_duration.max(1.0);
                if f1 < 0.8 {
                    m = translate(&m, 0.0, (f / 4.0 * PI).cos().abs() * 0.1, 0.0);
                }
                let f3 = 1.0 - f1.powi(27);
                m = translate(&m, f3 * 0.6 * p.side, f3 * -0.5, 0.0);
                m = rotate(&m, p.side * f3 * 90.0 * D2R, 0.0, 1.0, 0.0);
                m = rotate(&m, f3 * 10.0 * D2R, 1.0, 0.0, 0.0);
                m = rotate(&m, p.side * f3 * 30.0 * D2R, 0.0, 0.0, 1.0);
                m = side_transform(&m, p.side, p.equip);
            }
            UseAction::Bow => {
                m = side_transform(&m, p.side, p.equip);
                m = translate(&m, p.side * -0.2785682, 0.18344387, 0.15731531);
                m = rotate(&m, -13.935 * D2R, 1.0, 0.0, 0.0);
                m = rotate(&m, p.side * 35.3 * D2R, 0.0, 1.0, 0.0);
                m = rotate(&m, p.side * -9.785 * D2R, 0.0, 0.0, 1.0);

                let f5 = p.use_ticks + p.partial;
                let mut f6 = f5 / 20.0;
                f6 = (f6 * f6 + f6 * 2.0) / 3.0;
                if f6 > 1.0 {
                    f6 = 1.0;
                }
                if f6 > 0.1 {
                    let f4 = ((f5 - 0.1) * 1.3).sin() * (f6 - 0.1);
                    m = translate(&m, 0.0, f4 * 0.004, 0.0);
                }
                m = translate(&m, 0.0, 0.0, f6 * 0.04);
                m = scale(&m, 1.0, 1.0, 1.0 + f6 * 0.2);
                m = rotate(&m, p.side * 45.0 * D2R, 0.0, -1.0, 0.0);
            }
            UseAction::Crossbow => {
                m = side_transform(&m, p.side, p.equip);
                m = translate(&m, p.side * -0.4785682, -0.094387, 0.05731531);
                m = rotate(&m, -11.935 * D2R, 1.0, 0.0, 0.0);
                m = rotate(&m, p.side * 65.3 * D2R, 0.0, 1.0, 0.0);
                m = rotate(&m, p.side * -9.785 * D2R, 0.0, 0.0, 1.0);

                let ticks = p.use_ticks + p.partial;
                let charge = (ticks / p.crossbow_charge_duration.max(1.0)).min(1.0);
                if charge > 0.1 {
                    m = translate(&m, 0.0, ((ticks - 0.1) * 1.3).sin() * (charge - 0.1) * 0.004, 0.0);
                }
                m = translate(&m, 0.0, 0.0, charge * 0.04);
                m = scale(&m, 1.0, 1.0, 1.0 + charge * 0.2);
                m = rotate(&m, p.side * 45.0 * D2R, 0.0, -1.0, 0.0);
            }
            UseAction::Spear => {
                m = side_transform(&m, p.side, p.equip);
                m = translate(&m, p.side * -0.5, 0.7, 0.1);
                m = rotate(&m, -55.0 * D2R, 1.0, 0.0, 0.0);
                m = rotate(&m, p.side * 35.3 * D2R, 0.0, 1.0, 0.0);
                m = rotate(&m, p.side * -9.785 * D2R, 0.0, 0.0, 1.0);

                let charge = ((p.use_ticks + p.partial) / 10.0).min(1.0);
                if charge > 0.1 {
                    m = translate(&m, 0.0, ((charge - 0.1) * 1.3).sin() * (charge - 0.1) * 0.004, 0.0);
                }
                m = translate(&m, 0.0, 0.0, charge * 0.2);
                m = scale(&m, 1.0, 1.0, 1.0 + charge * 0.2);
                m = rotate(&m, p.side * 45.0 * D2R, 0.0, -1.0, 0.0);
            }
            UseAction::None | UseAction::Block => {
                m = side_transform(&m, p.side, p.equip);
            }
        }
        return m;
    }

    // Default item swing & hold animation
    let f = -0.4 * (p.sw.sqrt() * PI).sin();
    let f1 = 0.2 * (p.sw.sqrt() * PI * 2.0).sin();
    let f2 = -0.2 * (p.sw * PI).sin();
    m = translate(&m, p.side * f, f1, f2);
    m = side_transform(&m, p.side, p.equip);

    // transformFirstPerson
    let a = (p.sw * p.sw * PI).sin();
    m = rotate(&m, p.side * (45.0 + a * -20.0) * D2R, 0.0, 1.0, 0.0);
    let b = (p.sw.sqrt() * PI).sin();
    m = rotate(&m, p.side * b * -20.0 * D2R, 0.0, 0.0, 1.0);
    m = rotate(&m, b * -80.0 * D2R, 1.0, 0.0, 0.0);

    if p.hand == 0 && p.is_crossbow && p.crossbow_charged && p.sw < 0.001 {
        m = translate(&m, p.side * -0.641864, 0.0, 0.0);
        m = rotate(&m, p.side * 10.0 * D2R, 0.0, 1.0, 0.0);
    }
    m = rotate(&m, p.side * -45.0 * D2R, 0.0, 1.0, 0.0);

    m
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_hand_projection() {
        let proj = hand_projection_matrix(800.0, 600.0);
        assert_eq!(proj.len(), 16);
        assert!(proj[0] > 0.0);
        assert!(proj[5] > 0.0);
        assert_eq!(proj[11], -1.0);
    }

    #[test]
    fn test_hand_state_tick() {
        let mut state = HandRendererState::new();
        state.tick(30.0, 60.0);
        assert!((state.render_arm_pitch - 15.0).abs() < 1e-6);
        assert!((state.render_arm_yaw - 30.0).abs() < 1e-6);
        state.tick(30.0, 60.0);
        assert!((state.render_arm_pitch - 22.5).abs() < 1e-6);
        assert!((state.render_arm_yaw - 45.0).abs() < 1e-6);
    }

    #[test]
    fn test_arm_matrix_not_identity() {
        let arm = compute_arm_matrix(0.0, 0.0, 1.0);
        assert_ne!(arm, identity_matrix());
    }

    #[test]
    fn test_map_matrices() {
        let (m, right, left, map) = compute_map_matrices(0.0, 0.0, 0.0);
        assert_ne!(m, identity_matrix());
        assert_ne!(right, identity_matrix());
        assert_ne!(left, identity_matrix());
        assert_ne!(map, identity_matrix());
    }

    #[test]
    fn test_item_matrix_default_hold() {
        let p = ItemMatrixParams {
            using_item: false,
            is_active_hand: false,
            use_ticks: 0.0,
            use_action: UseAction::None,
            use_duration: 0.0,
            crossbow_charge_duration: 25.0,
            crossbow_charged: false,
            is_crossbow: false,
            hand: 0,
            side: 1.0,
            equip: 0.0,
            sw: 0.0,
            partial: 0.0,
        };
        let m = compute_item_matrix(&p);
        assert_ne!(m, identity_matrix());
    }
}
