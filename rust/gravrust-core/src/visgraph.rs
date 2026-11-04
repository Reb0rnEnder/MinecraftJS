// Port of `client/js/render/visgraph.js`
//! Decides which of the six section faces can see each other through
//! non-opaque blocks. The result is six bytes: bit `b` of entry `a` is set
//! when face `a` connects to face `b` (direction order matches
//! `DIR_OFFSETS` in `world/blocks.js`).

use wasm_bindgen::prelude::*;

/// Per-state flags supplied by JavaScript:
/// bit 0 = opaque, bit 1 = leaf block (`*_leaves`).
pub const FLAG_OPAQUE: u8 = 1;
pub const FLAG_LEAVES: u8 = 2;

const ALL_VISIBLE: [u8; 6] = [63, 63, 63, 63, 63, 63];

/// Compute the visibility mask of one 16^3 section.
///
/// `states` is the section's `Uint16Array(4096)` in `(y << 8) | (z << 4) | x`
/// order. `state_flags` is indexed by block-state id and is built once per
/// block registry (see `client/js/render/visgraph.js`).
pub fn compute_visibility(states: &[u16], state_flags: &[u8], fancy_leaves: bool) -> [u8; 6] {
    let mut seen = [0u8; 4096];
    let mut stack = [0i32; 4096];
    let mut opaque_count = 0usize;

    for i in 0..4096 {
        let state = states.get(i).copied().unwrap_or(0) as usize;
        let flags = state_flags.get(state).copied().unwrap_or(0);
        if flags & FLAG_OPAQUE != 0 && !(fancy_leaves && flags & FLAG_LEAVES != 0) {
            seen[i] = 1;
            opaque_count += 1;
        }
    }

    // Vanilla shortcut: nearly empty sections connect everything.
    if opaque_count < 256 {
        return ALL_VISIBLE;
    }
    if opaque_count == 4096 {
        return [0u8; 6];
    }

    let mut vis = [0u8; 6];
    for i in 0..4096usize {
        if seen[i] != 0 {
            continue;
        }
        let x = i & 15;
        let z = (i >> 4) & 15;
        let y = i >> 8;
        if x != 0 && x != 15 && y != 0 && y != 15 && z != 0 && z != 15 {
            continue;
        }

        let mut faces: u8 = 0;
        let mut sp = 0usize;
        stack[sp] = i as i32;
        sp += 1;
        seen[i] = 1;

        while sp > 0 {
            sp -= 1;
            let j = stack[sp] as usize;
            let jx = j & 15;
            let jz = (j >> 4) & 15;
            let jy = j >> 8;

            if jy == 0 {
                faces |= 1;
            } else if seen[j - 256] == 0 {
                seen[j - 256] = 1;
                stack[sp] = (j - 256) as i32;
                sp += 1;
            }
            if jy == 15 {
                faces |= 2;
            } else if seen[j + 256] == 0 {
                seen[j + 256] = 1;
                stack[sp] = (j + 256) as i32;
                sp += 1;
            }
            if jz == 0 {
                faces |= 4;
            } else if seen[j - 16] == 0 {
                seen[j - 16] = 1;
                stack[sp] = (j - 16) as i32;
                sp += 1;
            }
            if jz == 15 {
                faces |= 8;
            } else if seen[j + 16] == 0 {
                seen[j + 16] = 1;
                stack[sp] = (j + 16) as i32;
                sp += 1;
            }
            if jx == 0 {
                faces |= 16;
            } else if seen[j - 1] == 0 {
                seen[j - 1] = 1;
                stack[sp] = (j - 1) as i32;
                sp += 1;
            }
            if jx == 15 {
                faces |= 32;
            } else if seen[j + 1] == 0 {
                seen[j + 1] = 1;
                stack[sp] = (j + 1) as i32;
                sp += 1;
            }
        }

        for a in 0..6 {
            if faces & (1 << a) != 0 {
                vis[a] |= faces;
            }
        }
    }
    vis
}

/// Allocation-free convenience wrapper for the JS glue.
#[wasm_bindgen]
pub fn compute_visibility_mask(states: &[u16], state_flags: &[u8], fancy_leaves: bool) -> Vec<u8> {
    compute_visibility(states, state_flags, fancy_leaves).to_vec()
}

/// Reusable visibility tracer: the per-state flag table is built once when the
/// block registry is initialised, so meshing only copies the 8 KiB section.
#[wasm_bindgen]
pub struct VisGraph {
    state_flags: Vec<u8>,
}

#[wasm_bindgen]
impl VisGraph {
    #[wasm_bindgen(constructor)]
    pub fn new(state_flags: &[u8]) -> VisGraph {
        VisGraph {
            state_flags: state_flags.to_vec(),
        }
    }

    pub fn update_flags(&mut self, state_flags: &[u8]) {
        self.state_flags.clear();
        self.state_flags.extend_from_slice(state_flags);
    }

    pub fn compute(&self, states: &[u16], fancy_leaves: bool) -> Vec<u8> {
        compute_visibility(states, &self.state_flags, fancy_leaves).to_vec()
    }

    pub fn flags_len(&self) -> usize {
        self.state_flags.len()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn flags_from(names: &[bool]) -> Vec<u8> {
        names
            .iter()
            .map(|opaque| if *opaque { FLAG_OPAQUE } else { 0 })
            .collect()
    }

    fn states(solid: bool) -> Vec<u16> {
        vec![if solid { 1 } else { 0 }; 4096]
    }

    #[test]
    fn open_section_connects_every_face() {
        assert_eq!(compute_visibility(&states(false), &flags_from(&[false, true]), true), ALL_VISIBLE);
        assert_eq!(compute_visibility(&states(false), &flags_from(&[false, true]), false), ALL_VISIBLE);
    }

    #[test]
    fn completely_solid_section_is_opaque() {
        assert_eq!(compute_visibility(&states(true), &flags_from(&[false, true]), true), [0; 6]);
    }

    #[test]
    fn floor_connects_side_faces_but_not_through_the_floor() {
        let flags = flags_from(&[false, true]);
        let mut section = states(false);
        // Solid floor at y = 0: the four sides still see each other above it.
        for z in 0..16 {
            for x in 0..16 {
                section[z * 16 + x] = 1;
            }
        }
        let vis = compute_visibility(&section, &flags, true);
        // The four sides and the top stay connected above the floor; the floor
        // itself sees nothing.
        for a in [1usize, 2, 3, 4, 5] {
            for b in [1usize, 2, 3, 4, 5] {
                assert!(vis[a] & (1 << b) != 0, "faces {} and {} must connect", a, b);
            }
        }
        assert_eq!(vis[0], 0);
        assert_eq!(vis[1], 62);
    }

    #[test]
    fn leaves_are_see_through_in_fancy_mode() {
        let flags = vec![0u8, FLAG_OPAQUE | FLAG_LEAVES];
        let mut section = vec![0u16; 4096];
        // A full wall at x = 7 splits the section into a west and an east half.
        for y in 0..16 {
            for z in 0..16 {
                section[(y << 8) | (z << 4) | 7] = 1;
            }
        }
        let solid = compute_visibility(&section, &flags, false);
        let fancy = compute_visibility(&section, &flags, true);
        // Opaque leaves hide the wall: west (4) and east (5) cannot see each other.
        assert_eq!(solid[4] & (1 << 5), 0);
        assert_eq!(solid[5] & (1 << 4), 0);
        assert_eq!(solid[0], 63);
        assert_eq!(fancy, ALL_VISIBLE);
    }

    #[test]
    fn visgraph_class_matches_free_function() {
        let flags = flags_from(&[false, true, true]);
        let mut section = states(false);
        for i in 0..1024 {
            section[i] = 2;
        }
        let graph = VisGraph::new(&flags);
        assert_eq!(graph.compute(&section, true), compute_visibility(&section, &flags, true).to_vec());
        assert_eq!(graph.flags_len(), 3);
    }
}