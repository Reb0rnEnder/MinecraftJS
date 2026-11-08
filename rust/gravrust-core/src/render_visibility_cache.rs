//! Port of `client/js/render/visibility-cache.js` (upstream MinecraftJS 1.8.9).
//!
//! Reuse a completed visibility walk/sort only when every geometric input and
//! the chunk/mesh revision is identical. Moving entities do not change this
//! graph.

/// JS `Object.is` on the inputs â€” Rust f64 bit-equality via `==` on copies is
/// equivalent here because inputs are copied into the cache (NaN is
/// normalised away by the walk in practice; documented deviation none).
#[derive(Debug, Default)]
pub struct VisibilityCache {
    inputs: Option<Vec<f64>>,
    revision: i64,
    stats_walks: u64,
    stats_hits: u64,
    stats_sorts: u64,
    list: Option<Vec<u64>>,
}

impl VisibilityCache {
    pub fn new() -> Self {
        VisibilityCache { inputs: None, revision: -1, stats_walks: 0, stats_hits: 0, stats_sorts: 0, list: None }
    }

    pub fn invalidate(&mut self) {
        self.inputs = None;
    }

    pub fn stats(&self) -> (u64, u64, u64) {
        (self.stats_walks, self.stats_hits, self.stats_sorts)
    }

    /// JS: `get(inputs, revision, build)` — sets `out` to the list, cached
    /// when every input matches bit-for-bit and the revision is unchanged;
    /// otherwise rebuilds, stores, and counts a walk + sort. (Out-param
    /// instead of a returned shared slice: Rust ownership vs the JS closure.)
    pub fn get(&mut self, inputs: &[f64], revision: i64, build: impl FnOnce() -> Vec<u64>, out: &mut Vec<u64>) -> bool {
        if let (Some(cached), Some(list)) = (&self.inputs, &self.list) {
            if revision == self.revision
                && inputs.len() == cached.len()
                && inputs.iter().zip(cached.iter()).all(|(a, b)| a.to_bits() == b.to_bits())
            {
                self.stats_hits += 1;
                *out = list.clone();
                return true;
            }
        }
        self.inputs = None;
        let list = build();
        self.inputs = Some(inputs.to_vec());
        self.revision = revision;
        self.stats_walks += 1;
        self.stats_sorts += 1;
        self.list = Some(list.clone());
        *out = list;
        false
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn hit_only_on_identical_inputs_and_revision() {
        let mut c = VisibilityCache::new();
        let mut builds = 0;
        let inputs = [1.0, 2.0, 3.0];
        let mut out = Vec::new(); c.get(&inputs, 5, || { builds += 1; vec![9] }, &mut out);
        let mut out = Vec::new(); c.get(&inputs, 5, || { builds += 1; vec![9] }, &mut out); // hit
        assert_eq!(builds, 1);
        c.get(&inputs, 6, || { builds += 1; vec![8] }, &mut out); // revision change: rebuild
        assert_eq!(builds, 2);
        c.get(&[1.0, 2.0], 6, || { builds += 1; vec![7] }, &mut out); // input change: rebuild
        assert_eq!(builds, 3);
        let (walks, hits, _sorts) = c.stats();
        assert_eq!((walks, hits), (3, 1));
    }
}
