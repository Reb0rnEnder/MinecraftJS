//! Port of `client/js/render/culling.js`: the breadth-first section walk that
//! only passes through faces the visibility graph says are connected.
//!
//! Sections arrive as parallel arrays so the caller keeps ownership of the
//! object graph: keys (`i64`), flags (bit 0 solid, bit 1 cutout, bit 2
//! translucent) and a six-byte visibility mask per section.

use std::collections::HashMap;

use wasm_bindgen::prelude::*;

use crate::blocks::{DIR_OFFSETS, OPPOSITE};
use crate::math::aabb_in_frustum;

pub fn section_key(cx: i32, sy: i32, cz: i32) -> i64 {
    ((cx as i64 + 0x100000) * 0x200000 + (cz as i64 + 0x100000)) * 16 + sy as i64
}

pub struct SectionCuller {
    r: i32,
    w: i32,
    state: Vec<u8>,
    dirs: Vec<u8>,
    queue: Vec<i32>,
    columns: Vec<u8>,
    ccx: i32,
    ccz: i32,
    reached: usize,
}

impl Default for SectionCuller {
    fn default() -> Self {
        SectionCuller::new()
    }
}

impl SectionCuller {
    pub fn new() -> SectionCuller {
        SectionCuller {
            r: -1,
            w: 0,
            state: Vec::new(),
            dirs: Vec::new(),
            queue: Vec::new(),
            columns: Vec::new(),
            ccx: 0,
            ccz: 0,
            reached: 0,
        }
    }

    fn alloc(&mut self, r: i32) {
        self.r = r;
        self.w = 2 * r + 1;
        let n = (self.w * self.w * 16) as usize;
        self.state = vec![0; n];
        self.dirs = vec![0; n];
        self.queue = vec![0; n];
        self.columns = vec![0; (self.w * self.w) as usize];
    }

    /// `columns` must be `W * W` bytes in `columnLoaded(ccx - R + j, ccz - R + i)`
    /// order, exactly as the JavaScript builds it.
    pub fn update(
        &mut self,
        keys: &[i64],
        flags: &[u8],
        vis: &[u8],
        planes: &[f64],
        cam: [f64; 3],
        render_distance: i32,
        columns: &[u8],
        camera_in_opaque: bool,
        max_dist: f64,
        enabled: bool,
    ) -> Vec<usize> {
        let r = render_distance + 1;
        if r != self.r {
            self.alloc(r);
        }
        let w = self.w;
        self.state.fill(0);
        let ccx = (cam[0] / 16.0).floor() as i32;
        let ccy = (cam[1] / 16.0).floor() as i32;
        let ccz = (cam[2] / 16.0).floor() as i32;
        self.ccx = ccx;
        self.ccz = ccz;
        let column_len = (w * w) as usize;
        if columns.len() >= column_len {
            self.columns[..column_len].copy_from_slice(&columns[..column_len]);
        } else {
            self.columns.fill(0);
        }

        let mut by_key: HashMap<i64, usize> = HashMap::with_capacity(keys.len());
        for (index, key) in keys.iter().enumerate() {
            by_key.insert(*key, index);
        }

        let idx = |cx: i32, sy: i32, cz: i32| {
            ((cz - ccz + r) * w + (cx - ccx + r)) * 16 + sy
        };
        let md2 = max_dist * max_dist;
        let in_view = |cx: i32, sy: i32, cz: i32| {
            let x0 = (cx * 16) as f64;
            let y0 = (sy * 16) as f64;
            let z0 = (cz * 16) as f64;
            let dx = (x0 - cam[0]).max(0.0).max(cam[0] - x0 - 16.0);
            let dy = (y0 - cam[1]).max(0.0).max(cam[1] - y0 - 16.0);
            let dz = (z0 - cam[2]).max(0.0).max(cam[2] - z0 - 16.0);
            if dx * dx + dy * dy + dz * dz > md2 {
                return false;
            }
            aabb_in_frustum(planes, x0, y0, z0, x0 + 16.0, y0 + 16.0, z0 + 16.0)
        };

        let occlude = enabled && !camera_in_opaque;
        let mut out = Vec::new();
        let mut head = 0usize;
        let mut tail = 0usize;
        {
            let state = &mut self.state;
            let dirs = &mut self.dirs;
            let queue = &mut self.queue;
            let columns = &self.columns;
            if (0..16).contains(&ccy) && columns[(r * w + r) as usize] != 0 {
                let i = idx(ccx, ccy, ccz) as usize;
                state[i] = 7;
                dirs[i] = 0;
                queue[tail] = i as i32;
                tail += 1;
            } else {
                let sy = if ccy >= 16 { 15 } else { 0 };
                let entry: u8 = if ccy >= 16 { 1 } else { 0 };
                for dz in -r..=r {
                    for dx in -r..=r {
                        if columns[((dz + r) * w + dx + r) as usize] == 0 {
                            continue;
                        }
                        let cx = ccx + dx;
                        let cz = ccz + dz;
                        if !in_view(cx, sy, cz) {
                            continue;
                        }
                        let i = idx(cx, sy, cz) as usize;
                        state[i] = 1 + entry;
                        dirs[i] = 0;
                        queue[tail] = i as i32;
                        tail += 1;
                    }
                }
            }
        }

        while head < tail {
            let i = self.queue[head] as usize;
            head += 1;
            let sy = (i as i32) & 15;
            let col = (i as i32) >> 4;
            let cz = col / w - r + ccz;
            let cx = col % w - r + ccx;
            let key = section_key(cx, sy, cz);
            let section = by_key.get(&key).copied();
            if let Some(index) = section {
                let bits = flags.get(index).copied().unwrap_or(0);
                if bits & 0b111 != 0 {
                    out.push(index);
                }
            }
            let entry = self.state[i] - 1;
            // A section that is not in the map has no mask at all in the JS
            // (`s` is undefined, so `vis` is null) and therefore cannot block
            // the walk. Only a section that really carries one occludes.
            let mask = if occlude {
                section.and_then(|index| vis.get(index * 6 + entry as usize).copied())
            } else {
                None
            };
            for d in 0..6usize {
                if occlude && (self.dirs[i] & (1 << OPPOSITE[d])) != 0 {
                    continue;
                }
                if let Some(bits) = mask {
                    if entry < 6 && (bits & (1 << d)) == 0 {
                        continue;
                    }
                }
                let offset = DIR_OFFSETS[d];
                let nx = cx + offset[0];
                let ny = sy + offset[1];
                let nz = cz + offset[2];
                if ny < 0 || ny > 15 || (nx - ccx).abs() > r || (nz - ccz).abs() > r {
                    continue;
                }
                let col2 = (nz - ccz + r) * w + (nx - ccx + r);
                if self.columns[col2 as usize] == 0 {
                    continue;
                }
                let j = (col2 * 16 + ny) as usize;
                if self.state[j] != 0 {
                    continue;
                }
                if !in_view(nx, ny, nz) {
                    continue;
                }
                self.state[j] = 1 + OPPOSITE[d] as u8;
                self.dirs[j] = self.dirs[i] | (1 << d);
                self.queue[tail] = j as i32;
                tail += 1;
            }
        }
        self.reached = tail;
        out
    }

    pub fn is_visible(&self, x: f64, y: f64, z: f64) -> bool {
        if self.r < 0 || self.state.is_empty() {
            return true;
        }
        let sy = (y / 16.0).floor() as i32;
        if !(0..16).contains(&sy) {
            return true;
        }
        let cx = (x / 16.0).floor() as i32;
        let cz = (z / 16.0).floor() as i32;
        let r = self.r;
        if (cx - self.ccx).abs() > r || (cz - self.ccz).abs() > r {
            return false;
        }
        let index = ((cz - self.ccz + r) * self.w + (cx - self.ccx + r)) * 16 + sy;
        self.state[index as usize] != 0
    }

    pub fn reached_count(&self) -> usize {
        self.reached
    }
}

// --------------------------------------------------------------------- wasm

#[wasm_bindgen]
pub struct SectionCullerCore {
    inner: SectionCuller,
}

#[wasm_bindgen]
impl SectionCullerCore {
    #[wasm_bindgen(constructor)]
    pub fn new() -> SectionCullerCore {
        SectionCullerCore { inner: SectionCuller::new() }
    }

    /// Returns the reached section indices in walk order.
    pub fn update(
        &mut self,
        keys: &[i64],
        flags: &[u8],
        vis: &[u8],
        planes: &[f64],
        cam: &[f64],
        render_distance: i32,
        columns: &[u8],
        camera_in_opaque: bool,
        max_dist: f64,
        enabled: bool,
    ) -> Vec<i32> {
        if cam.len() < 3 || planes.len() < 24 {
            return Vec::new();
        }
        self.inner
            .update(
                keys,
                flags,
                vis,
                planes,
                [cam[0], cam[1], cam[2]],
                render_distance,
                columns,
                camera_in_opaque,
                max_dist,
                enabled,
            )
            .into_iter()
            .map(|index| index as i32)
            .collect()
    }

    pub fn is_visible(&self, x: f64, y: f64, z: f64) -> bool {
        self.inner.is_visible(x, y, z)
    }

    pub fn reached_count(&self) -> u32 {
        self.inner.reached_count() as u32
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::math::frustum_planes;

    #[test]
    fn keys_are_distinct_per_section() {
        assert_ne!(section_key(0, 0, 0), section_key(1, 0, 0));
        assert_ne!(section_key(0, 0, 0), section_key(0, 1, 0));
        assert_eq!(section_key(0, 0, 0), section_key(0, 0, 0));
    }

    /// Six planes with a zero normal and a large positive distance accept every
    /// box, which isolates the walk from the camera orientation.
    fn open_planes() -> [f64; 24] {
        let mut planes = [0f64; 24];
        for index in 0..6 {
            planes[index * 4 + 3] = 1e9;
        }
        planes
    }

    #[test]
    fn reaches_straight_down_through_an_open_column() {
        let planes = open_planes();
        // W = 3 (R = 1); every column loaded.
        let columns = vec![1u8; 9];
        let keys = vec![section_key(0, 0, 0), section_key(0, 1, 0)];
        let flags = vec![1u8, 1u8];
        let vis = vec![0u8; 12];
        let mut culler = SectionCuller::new();
        let reached = culler.update(
            &keys,
            &flags,
            &vis,
            &planes,
            [8.0, 0.0, 8.0],
            0,
            &columns,
            false,
            1000.0,
            false,
        );
        assert_eq!(reached, vec![0, 1]);
        assert!(culler.is_visible(8.0, 8.0, 8.0));
        assert!(!culler.is_visible(48.0, 8.0, 8.0));
    }

    #[test]
    fn a_closed_mask_stops_the_walk() {
        let planes = open_planes();
        let columns = vec![1u8; 9];
        let keys = vec![
            section_key(0, 0, 0),
            section_key(0, 1, 0),
            section_key(0, 2, 0),
        ];
        let flags = vec![1u8, 1u8, 1u8];
        // Every mask is closed: the start section is unmasked (entry face 6),
        // so one step up succeeds, but that section allows no further direction.
        let vis = vec![0u8; 18];
        let mut culler = SectionCuller::new();
        let reached = culler.update(
            &keys,
            &flags,
            &vis,
            &planes,
            [8.0, 8.0, 8.0],
            0,
            &columns,
            false,
            1000.0,
            true,
        );
        assert_eq!(reached, vec![0, 1]);
        // The reached section is visible, the third one never was.
        assert!(culler.is_visible(8.0, 24.0, 8.0));
        assert!(!culler.is_visible(8.0, 40.0, 8.0));

        // Opening the step through the first section reaches the third one.
        let mut open = vec![0u8; 18];
        open[0] = 1 << 1; // entry face 0 (down) connects to direction 1 (up)
        open[6] = 1 << 1;
        let mut culler = SectionCuller::new();
        let reached = culler.update(
            &keys,
            &flags,
            &open,
            &planes,
            [8.0, 8.0, 8.0],
            0,
            &columns,
            false,
            1000.0,
            true,
        );
        assert_eq!(reached, vec![0, 1, 2]);
    }
}
