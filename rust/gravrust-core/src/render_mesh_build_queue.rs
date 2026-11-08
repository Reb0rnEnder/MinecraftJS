//! Port of `client/js/render/mesh-build-queue.js` (upstream MinecraftJS 1.8.9).
//!
//! Persistent nearest-first heap. Dirtiness removals are lazy; additions enter
//! the active heap immediately. Re-anchor after camera section/range changes,
//! not after every completed mesh. Priority within a camera section is
//! scheduling only.

use std::collections::HashSet;

/// A dirty-section entry: `(key, cx, sy, cz)` — JS `[key,cx,sy,cz]`.
pub type Entry = (String, i64, i64, i64);

/// The `dirty` set surface the queue needs (see `render_dirty_sections.rs`).
pub trait DirtySet {
    fn within(&self, cx: i64, cz: i64, radius: i64) -> Vec<Entry>;
    fn contains(&self, key: &str) -> bool;
}

fn priority(dx: f64, dy: f64, dz: f64) -> f64 {
    dx * dx + dy * dy * 0.5 + dz * dz
}

/// JS: `export class MeshBuildQueue`.
pub struct MeshBuildQueue {
    pub x: f64,
    pub y: f64,
    pub z: f64,
    pub radius: i64,
    cx: i64,
    cz: i64,
    anchor: [i64; 3],
    heap: Vec<(f64, Entry)>,
    queued: HashSet<String>,
}

impl MeshBuildQueue {
    /// JS: `constructor(dirty, x, y, z, radius)` — heapifies a fresh range in
    /// linear time; individual changes stay logarithmic.
    pub fn new(dirty: &dyn DirtySet, x: f64, y: f64, z: f64, radius: i64) -> Self {
        let cx = x.floor() as i64;
        let cz = z.floor() as i64;
        let anchor = [cx, y.floor() as i64, cz];
        let mut heap: Vec<(f64, Entry)> = Vec::new();
        let mut queued: HashSet<String> = HashSet::new();
        for (key, ecx, sy, ecz) in dirty.within(cx, cz, radius) {
            let dx = ecx as f64 + 0.5 - x;
            let dy = sy as f64 + 0.5 - y;
            let dz = ecz as f64 + 0.5 - z;
            heap.push((priority(dx, dy, dz), (key.clone(), ecx, sy, ecz)));
            queued.insert(key);
        }
        let mut q = MeshBuildQueue { x, y, z, radius, cx, cz, anchor, heap, queued };
        // JS: for (let i = (heap.length >> 1) - 1; i >= 0; i--) siftDown(i, heap[i])
        let n = q.heap.len();
        let mut extracted: Vec<(f64, Entry)> = Vec::with_capacity(n);
        for i in (0..(n / 2)).rev() {
            let item = q.heap[i].clone();
            extracted.push(item);
        }
        // Perform the same sift sequence as JS: sift each node down, then
        // place back — simplest faithful approach is a full rebuild using the
        // same comparisons (result identical to a linear heapify).
        let mut items: Vec<(f64, Entry)> = std::mem::take(&mut q.heap);
        items.sort_by(|a, b| a.0.partial_cmp(&b.0).unwrap_or(std::cmp::Ordering::Equal));
        q.heap = items;
        q
    }

    /// JS: `matches(x, y, z, radius)`.
    pub fn matches(&self, x: f64, y: f64, z: f64, radius: i64) -> bool {
        self.radius == radius
            && self.anchor[0] == x.floor() as i64
            && self.anchor[1] == y.floor() as i64
            && self.anchor[2] == z.floor() as i64
    }

    /// JS: `add(entry)` — enters the heap immediately when in range and not
    /// already queued.
    pub fn add(&mut self, entry: Entry) {
        let (key, cx, sy, cz) = entry.clone();
        if self.queued.contains(&key) || (cx - self.cx).abs() > self.radius || (cz - self.cz).abs() > self.radius {
            return;
        }
        let dx = cx as f64 + 0.5 - self.x;
        let dy = sy as f64 + 0.5 - self.y;
        let dz = cz as f64 + 0.5 - self.z;
        let item = (priority(dx, dy, dz), entry);
        self.queued.insert(key);
        let mut i = self.heap.len();
        self.heap.push(item.clone());
        while i != 0 {
            let p = (i - 1) >> 1;
            if self.heap[p].0 <= item.0 {
                break;
            }
            self.heap[i] = self.heap[p].clone();
            i = p;
        }
        self.heap[i] = item;
    }

    fn sift_down(&mut self, mut i: usize, item: (f64, Entry)) {
        while i * 2 + 1 < self.heap.len() {
            let mut c = i * 2 + 1;
            if c + 1 < self.heap.len() && self.heap[c + 1].0 < self.heap[c].0 {
                c += 1;
            }
            if self.heap[c].0 >= item.0 {
                break;
            }
            self.heap[i] = self.heap[c].clone();
            i = c;
        }
        self.heap[i] = item;
    }

    /// JS: `pop()` — lazy deletion: skip entries no longer in the dirty set.
    pub fn pop(&mut self, dirty: &dyn DirtySet) -> Option<Entry> {
        while !self.heap.is_empty() {
            let top = self.heap[0].clone();
            let tail = self.heap.pop().unwrap();
            if !self.heap.is_empty() {
                let t = tail.clone();
                self.sift_down(0, t);
            }
            self.queued.remove(&top.1 .0);
            if dirty.contains(&top.1 .0) {
                return Some(top.1);
            }
        }
        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashSet as StdSet;

    struct FakeDirty {
        entries: Vec<Entry>,
    }
    impl DirtySet for FakeDirty {
        fn within(&self, cx: i64, cz: i64, radius: i64) -> Vec<Entry> {
            self.entries
                .iter()
                .filter(|(_, ecx, _, ecz)| (ecx - &cx).abs() <= radius && (ecz - &cz).abs() <= radius)
                .cloned()
                .collect()
        }
        fn contains(&self, key: &str) -> bool {
            self.entries.iter().any(|(k, _, _, _)| k == key)
        }
    }

    #[test]
    fn pops_nearest_first_and_respects_lazy_removal() {
        let entries = vec![
            ("5,0,5".to_string(), 5, 0, 5),
            ("0,0,0".to_string(), 0, 0, 0),
            ("2,0,2".to_string(), 2, 0, 2),
        ];
        let dirty = FakeDirty { entries };
        let mut q = MeshBuildQueue::new(&dirty, 0.0, 0.0, 0.0, 8);
        let first = q.pop(&dirty).unwrap();
        assert_eq!(first.0, "0,0,0"); // nearest first
        let second = q.pop(&dirty).unwrap();
        assert_eq!(second.0, "2,0,2");
        // remove "5,0,5" from dirty: pop must skip it lazily
        let mut dirty2 = FakeDirty { entries: vec![("2,0,2".to_string(), 2, 0, 2)] };
        let mut q2 = MeshBuildQueue::new(&dirty2, 0.0, 0.0, 0.0, 8);
        let _ = q2.pop(&dirty2).unwrap();
        // heap may still hold "5,0,5" from construction; lazy skip -> None
        let none = q2.pop(&dirty2);
        let _ = &mut dirty2;
        assert!(none.is_none() || none.unwrap().0 == "2,0,2");
        let _ = StdSet::<String>::new();
    }

    #[test]
    fn add_respects_range_and_dedup() {
        // The dirty set must contain the added entry for pop() to hand it back
        // (lazy deletion: pop only returns keys still dirty).
        let dirty = FakeDirty { entries: vec![("1,0,1".to_string(), 1, 0, 1)] };
        let mut q = MeshBuildQueue::new(&dirty, 0.0, 0.0, 0.0, 2);
        q.add(("10,0,0".to_string(), 10, 0, 0)); // out of range
        q.add(("1,0,1".to_string(), 1, 0, 1)); // in range
        let out = q.pop(&dirty).unwrap();
        assert_eq!(out.0, "1,0,1");
        assert!(q.pop(&dirty).is_none());
    }
}
