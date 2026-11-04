//! Port of `client/js/render/leash.js` (and the other client-side entity pose
//! helpers as they move over).
//!
//! These are pure geometry functions: the renderer still owns the model part
//! objects, but the numbers come from here.

use std::f64::consts::PI;
use wasm_bindgen::prelude::*;

fn lerp(a: f64, b: f64, t: f64) -> f64 {
    a + (b - a) * t
}

fn angle(a: f64, b: f64, t: f64) -> f64 {
    a + (((b - a) % 360.0 + 540.0) % 360.0 - 180.0) * t
}

/// `leashEndpoints`: returns `[startX, startY, startZ, endX, endY, endZ, height]`.
#[wasm_bindgen]
#[allow(clippy::too_many_arguments)]
pub fn leash_endpoints(
    mob_x: f64,
    mob_y: f64,
    mob_z: f64,
    mob_prev_x: f64,
    mob_prev_y: f64,
    mob_prev_z: f64,
    mob_width: f64,
    mob_body_yaw: f64,
    mob_prev_body_yaw: f64,
    mob_height: f64,
    holder_x: f64,
    holder_y: f64,
    holder_z: f64,
    holder_prev_x: f64,
    holder_prev_y: f64,
    holder_prev_z: f64,
    holder_yaw: f64,
    holder_prev_yaw: f64,
    holder_pitch: f64,
    holder_prev_pitch: f64,
    holder_eye_height: f64,
    holder_is_leash: bool,
    partial: f64,
) -> Vec<f64> {
    let radians = PI / 180.0;
    let mut start = [
        lerp(mob_prev_x, mob_x, partial),
        lerp(mob_prev_y, mob_y, partial),
        lerp(mob_prev_z, mob_z, partial),
    ];
    let mut end = [
        lerp(holder_prev_x, holder_x, partial),
        lerp(holder_prev_y, holder_y, partial),
        lerp(holder_prev_z, holder_z, partial),
    ];
    let yaw = angle(mob_prev_body_yaw, mob_body_yaw, partial) * radians + PI / 2.0;
    start[0] += yaw.cos() * mob_width * 0.4;
    start[2] += yaw.sin() * mob_width * 0.4;

    let half = partial * 0.5;
    let holder_yaw_rad = angle(holder_prev_yaw, holder_yaw, half) * radians;
    let holder_pitch_rad = lerp(holder_prev_pitch, holder_pitch, half) * radians;
    let knot = holder_is_leash;
    let c = if knot { 0.0 } else { holder_yaw_rad.cos() };
    let s = if knot { 0.0 } else { holder_yaw_rad.sin() };
    let sp = if knot { -1.0 } else { holder_pitch_rad.sin() };
    end[0] -= c * 0.7 + s * 0.5 * holder_pitch_rad.cos();
    end[1] += holder_eye_height * 0.7 - sp * 0.5 - 0.25;
    end[2] += -s * 0.7 + c * 0.5 * holder_pitch_rad.cos();

    vec![
        start[0], start[1], start[2], end[0], end[1], end[2], mob_height,
    ]
}

/// `leashGeometry`: two crossed 24-segment strips, 8 floats per vertex.
#[wasm_bindgen]
pub fn leash_geometry(
    start_x: f64,
    start_y: f64,
    start_z: f64,
    end_x: f64,
    end_y: f64,
    end_z: f64,
    height: f64,
) -> Vec<f32> {
    let a = [start_x, start_y, start_z];
    let dx = (end_x - start_x) as f32 as f64;
    let dy = (end_y - start_y) as f32 as f64;
    let dz = (end_z - start_z) as f32 as f64;
    let mut out = Vec::with_capacity(2 * 24 * 4 * 9);
    let at = |i: usize, strip: usize, side: bool| -> [f64; 3] {
        let t = i as f64 / 24.0;
        let x = a[0] + dx * t;
        let y = a[1] - (1.6 - height) * 0.5
            + dy * (t * t + t) * 0.5
            + (24 - i) as f64 / 18.0
            + 0.125;
        let z = a[2] + dz * t;
        [
            x + if side { 0.025 } else { 0.0 },
            y + match strip {
                0 => {
                    if side {
                        0.025
                    } else {
                        0.0
                    }
                }
                _ => {
                    if side {
                        0.0
                    } else {
                        0.025
                    }
                }
            },
            z + if strip == 1 && side { 0.025 } else { 0.0 },
        ]
    };
    let mut vertex = |i: usize, strip: usize, side: bool| {
        let c = if i % 2 == 0 { 0.7 } else { 1.0 };
        let position = at(i, strip, side);
        out.extend_from_slice(&[
            position[0] as f32,
            position[1] as f32,
            position[2] as f32,
            0.0,
            0.0,
            (0.5 * c) as f32,
            (0.4 * c) as f32,
            (0.3 * c) as f32,
            1.0,
        ]);
    };
    for strip in 0..2 {
        for i in 0..24 {
            vertex(i, strip, false);
            vertex(i, strip, true);
            vertex(i + 1, strip, true);
            vertex(i + 1, strip, false);
        }
    }
    out
}

/// `animateFox`: 33 values in a fixed order — body(rx,ry,py,pz,rz),
/// tail(rx,pz), head(rx,ry,rz,px,py,pz), then legs rightHind, leftHind,
/// rightFront, leftFront with (rx,rz,py,pz,visible).
#[wasm_bindgen]
#[allow(clippy::too_many_arguments)]
pub fn fox_pose(
    ls: f64,
    lsa: f64,
    head_roll: f64,
    crouching: bool,
    crouch_amount: f64,
    sleeping: bool,
    child: bool,
    sitting: bool,
    pitch: f64,
    yaw: f64,
    age: f64,
    faceplanted: bool,
) -> Vec<f64> {
    let radians = PI / 180.0;
    let mut body = [PI / 2.0, 0.0, 0.0, 0.0, 0.0];
    let mut tail = [-0.05235988, 0.0];
    let mut head = [0.0, 0.0, head_roll, 0.0, 0.0, 0.0];
    let legs_order = [0usize, 1, 2, 3];
    let mut legs = [[0.0f64; 5]; 4];
    for (i, leg) in legs.iter_mut().enumerate() {
        let offset = if i == 1 || i == 2 { PI } else { 0.0 };
        leg[0] = (ls * 0.6662 + offset).cos() * 1.4 * lsa;
        leg[4] = 1.0;
    }
    if crouching {
        body[0] = 1.6755161;
        body[2] = 16.0 + crouch_amount;
        head[4] = 16.5 + crouch_amount;
    } else if sleeping {
        body[4] = -PI / 2.0;
        body[2] = 21.0;
        tail[0] = if child { -2.1816616 } else { -2.6179938 };
        if child {
            body[3] = -2.0;
        }
        head[3] = 1.0;
        head[4] = 19.49;
        head[0] = 0.0;
        head[1] = -2.0943952;
        head[2] = 0.0;
        for leg in legs.iter_mut() {
            leg[4] = 0.0;
        }
    } else if sitting {
        body[0] = 0.5235988;
        body[2] = 9.0;
        body[3] = -3.0;
        tail[0] = 0.7853982;
        tail[1] = -2.0;
        head[4] = if child { 13.0 } else { 10.0 };
        head[5] = if child { -3.75 } else { -0.25 };
        legs[0][0] = -1.3089969;
        legs[1][0] = -1.3089969;
        legs[0][2] = 21.5;
        legs[1][2] = 21.5;
        legs[0][3] = 6.75;
        legs[1][3] = 6.75;
        legs[2][0] = -0.2617994;
        legs[3][0] = -0.2617994;
    }
    if !sleeping && !faceplanted && !crouching {
        head[0] = pitch * radians;
        head[1] = yaw * radians;
    }
    if sleeping {
        head[2] = (age * 0.027).cos() / 22.0;
    }
    if crouching {
        let sway = age.cos() * 0.01;
        body[1] = sway;
        for (i, leg) in legs.iter_mut().enumerate() {
            leg[1] = sway * if i < 2 { 1.0 } else { 0.5 };
        }
    }
    if faceplanted {
        let phase = age * 0.67;
        for (i, leg) in legs.iter_mut().enumerate() {
            let offset = if i == 1 || i == 2 { PI } else { 0.0 };
            leg[0] = (phase * 0.4662 + offset).cos() * 0.1;
        }
    }
    let mut out = Vec::with_capacity(33);
    out.extend_from_slice(&body);
    out.extend_from_slice(&tail);
    out.extend_from_slice(&head);
    for index in legs_order {
        out.extend_from_slice(&legs[index]);
    }
    out
}

/// `scaleFoxChild`: head scale/position and body scale/position.
#[wasm_bindgen]
pub fn fox_scale(child: bool) -> Vec<f64> {
    vec![
        if child { 0.75 } else { 1.0 },
        0.0,
        if child { 6.0 } else { 0.0 },
        if child { 3.35 * 0.75 } else { 0.0 },
        if child { 0.5 } else { 1.0 },
        0.0,
        if child { 12.0 } else { 0.0 },
        0.0,
    ]
}

/// `animateOcelot`: 22 values — body(rx,py,pz), head(rx,ry,py,pz),
/// tail(rx,py,pz), tail2(rx,py,pz), then frontLeft, frontRight, backLeft,
/// backRight with (rx,py,pz).
#[wasm_bindgen]
#[allow(clippy::too_many_arguments)]
pub fn ocelot_pose(
    cat: bool,
    pitch: f64,
    yaw: f64,
    sitting: bool,
    ls: f64,
    lsa: f64,
) -> Vec<f64> {
    let radians = PI / 180.0;
    let front_y = if cat { 14.1 } else { 13.8 };
    let mut body = [PI / 2.0, 12.0, -10.0];
    let mut head = [pitch * radians, yaw * radians, 15.0, -9.0];
    let mut tail = [0.9, 15.0, 8.0];
    let mut tail2 = [0.0, 20.0, 14.0];
    let mut front_left = [0.0, front_y, -5.0];
    let mut front_right = [0.0, front_y, -5.0];
    let mut back_left = [0.0, 18.0, 5.0];
    let mut back_right = [0.0, 18.0, 5.0];
    if sitting {
        body = [0.7853982, 8.0, -5.0];
        head[2] = 11.7;
        head[3] = -8.0;
        tail = [1.7278761, 23.0, 6.0];
        tail2 = [2.670354, 22.0, 13.2];
        front_left = [-0.15707964, front_y + 2.0, -7.0];
        front_right = [-0.15707964, front_y + 2.0, -7.0];
        back_left = [-1.5707964, 21.0, 1.0];
        back_right = [-1.5707964, 21.0, 1.0];
    } else {
        let phase = ls * 0.6662;
        back_left[0] = phase.cos() * lsa;
        back_right[0] = (phase + 0.3).cos() * lsa;
        front_left[0] = (phase + PI + 0.3).cos() * lsa;
        front_right[0] = (phase + PI).cos() * lsa;
        tail2[0] = 1.7278761 + PI / 4.0 * ls.cos() * lsa;
    }
    let mut out = Vec::with_capacity(25);
    out.extend_from_slice(&body);
    out.extend_from_slice(&head);
    out.extend_from_slice(&tail);
    out.extend_from_slice(&tail2);
    out.extend_from_slice(&front_left);
    out.extend_from_slice(&front_right);
    out.extend_from_slice(&back_left);
    out.extend_from_slice(&back_right);
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn endpoints_place_the_start_on_the_mob_shoulder() {
        let values = leash_endpoints(
            0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.6, 0.0, 0.0, 1.4, 8.0, 0.0, 0.0, 8.0, 0.0, 0.0, 0.0,
            0.0, 0.0, 0.0, 1.62, false, 1.0,
        );
        assert_eq!(values.len(), 7);
        assert!((values[0] - 0.0).abs() < 1e-12);
        assert!((values[2] - 0.6 * 0.4).abs() < 1e-12);
        assert!((values[6] - 1.4).abs() < 1e-12);
    }

    #[test]
    fn fox_sitting_places_the_head_and_sets_leg_pivots() {
        let pose = fox_pose(0.0, 0.0, 0.0, false, 0.0, false, false, true, 0.0, 0.0, 0.0, false);
        assert_eq!(pose.len(), 33);
        assert_eq!(pose[0], 0.5235988);
        assert_eq!(pose[2], 9.0);
        assert_eq!(pose[12], -0.25);
        // rightHindLeg rx/py/pz
        assert_eq!(pose[13], -1.3089969);
        assert_eq!(pose[15], 21.5);
        assert_eq!(pose[16], 6.75);
    }

    #[test]
    fn fox_sleeping_hides_the_legs() {
        let pose = fox_pose(0.0, 0.0, 0.0, false, 0.0, true, false, false, 0.0, 0.0, 0.0, false);
        assert_eq!(pose[4], -PI / 2.0);
        for leg in 0..4 {
            assert_eq!(pose[13 + leg * 5 + 4], 0.0);
        }
    }

    #[test]
    fn ocelot_sitting_and_standing_pivots() {
        let sitting = ocelot_pose(false, 10.0, 20.0, true, 0.0, 0.0);
        assert_eq!(sitting.len(), 25);
        assert_eq!(sitting[0], 0.7853982);
        assert_eq!(sitting[5], 11.7);
        assert_eq!(sitting[6], -8.0);
        let standing = ocelot_pose(true, 0.0, 0.0, false, 0.0, 1.0);
        assert_eq!(standing[5], 15.0);
        assert_eq!(standing[6], -9.0);
        assert_eq!(sitting[19], -1.5707964);
    }

    #[test]
    fn geometry_has_the_native_vertex_count_and_colors() {
        let vertices = leash_geometry(0.0, 1.0, 0.0, 5.0, 2.0, 3.0, 1.4);
        assert_eq!(vertices.len(), 2 * 24 * 4 * 9);
        assert_eq!(&vertices[3..8], &[0.0, 0.0, 0.35, 0.28, 0.21]);
        assert_eq!(vertices[8], 1.0);
    }
}
