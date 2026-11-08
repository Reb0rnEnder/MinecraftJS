//! Port of `client/js/render/dirty-sections.js`.
//!
//! Spatial index for sections marked dirty for remeshing. Uses a column index
//! (cx -> cz -> entries) so terrain received outside the active render distance
//! stays pending without linear scans on every rendered frame.

use std::collections::{HashMap, HashSet};

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct SectionKey {
    pub cx: i32,
    pub sy: i32,
    pub cz: i32,
}

impl SectionKey {
    pub fn new(cx: i32, sy: i32, cz: i32) -> Self {
        Self { cx, sy, cz }
    }

    pub fn to_key_string(&self) -> String {
        format!("{},{},{}", self.cx, self.sy, self.cz)
    }

    pub fn parse(s: &str) -> Option<Self> {
        let mut parts = s.split(',');
        let cx = parts.next()?.parse().ok()?;
        let sy = parts.next()?.parse().ok()?;
        let cz = parts.next()?.parse().ok()?;
        Some(Self { cx, sy, cz })
    }
}

#[derive(Debug, Clone)]
struct CachedRange {
    cx: i32,
    cz: i32,
    radius: i32,
    entries: Vec<SectionKey>,
}

#[derive(Debug, Clone, Default)]
pub struct DirtySections {
    set: HashSet<SectionKey>,
    columns: HashMap<i32, HashMap<i32, Vec<SectionKey>>>,
    range: Option<CachedRange>,
}

impl DirtySections {
    pub fn new() -> Self {
        Self::default()
    }

    fn invalidate(&mut self, cx: i32, cz: i32) {
        if let Some(r) = &self.range {
            if (cx - r.cx).abs() <= r.radius && (cz - r.cz).abs() <= r.radius {
                self.range = None;
            }
        }
    }

    pub fn contains(&self, key: &SectionKey) -> bool {
        self.set.contains(key)
    }

    pub fn len(&self) -> usize {
        self.set.len()
    }

    pub fn is_empty(&self) -> bool {
        self.set.is_empty()
    }

    pub fn add(&mut self, key: SectionKey) -> bool {
        if !self.set.insert(key.clone()) {
            return false;
        }

        let cx = key.cx;
        let cz = key.cz;
        self.columns
            .entry(cx)
            .or_default()
            .entry(cz)
            .or_default()
            .push(key);

        self.invalidate(cx, cz);
        true
    }

    pub fn remove(&mut self, key: &SectionKey) -> bool {
        if !self.set.remove(key) {
            return false;
        }

        let cx = key.cx;
        let cz = key.cz;
        if let Some(zs) = self.columns.get_mut(&cx) {
            if let Some(column) = zs.get_mut(&cz) {
                column.retain(|k| k != key);
                if column.is_empty() {
                    zs.remove(&cz);
                }
            }
            if zs.is_empty() {
                self.columns.remove(&cx);
            }
        }

        self.invalidate(cx, cz);
        true
    }

    pub fn clear(&mut self) {
        self.set.clear();
        self.columns.clear();
        self.range = None;
    }

    pub fn within(&mut self, cx: i32, cz: i32, radius: i32) -> &[SectionKey] {
        let is_cached = self.range.as_ref().map_or(false, |r| {
            r.cx == cx && r.cz == cz && r.radius == radius
        });

        if !is_cached {
            let mut entries = Vec::new();
            for x in (cx - radius)..=(cx + radius) {
                if let Some(zs) = self.columns.get(&x) {
                    for z in (cz - radius)..=(cz + radius) {
                        if let Some(col) = zs.get(&z) {
                            entries.extend(col.iter().cloned());
                        }
                    }
                }
            }

            self.range = Some(CachedRange {
                cx,
                cz,
                radius,
                entries,
            });
        }

        &self.range.as_ref().unwrap().entries
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_dirty_sections_add_remove() {
        let mut ds = DirtySections::new();
        let k1 = SectionKey::new(0, 1, 0);
        let k2 = SectionKey::new(0, 2, 0);
        let k3 = SectionKey::new(5, 1, 5);

        assert!(ds.add(k1.clone()));
        assert!(ds.add(k2.clone()));
        assert!(ds.add(k3.clone()));
        assert_eq!(ds.len(), 3);

        assert!(!ds.add(k1.clone())); // duplicate

        assert!(ds.remove(&k1));
        assert_eq!(ds.len(), 2);
        assert!(!ds.contains(&k1));
    }

    #[test]
    fn test_dirty_sections_within_radius() {
        let mut ds = DirtySections::new();
        ds.add(SectionKey::new(0, 0, 0));
        ds.add(SectionKey::new(1, 0, 1));
        ds.add(SectionKey::new(5, 0, 5)); // outside radius 2

        let near = ds.within(0, 0, 2);
        assert_eq!(near.len(), 2);
        assert!(near.contains(&SectionKey::new(0, 0, 0)));
        assert!(near.contains(&SectionKey::new(1, 0, 1)));
        assert!(!near.contains(&SectionKey::new(5, 0, 5)));
    }
}
