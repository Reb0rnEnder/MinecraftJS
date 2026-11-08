//! Port of `client/js/render/mesh-service.js`.
//!
//! Chunk meshing service and worker pool coordination.
//! Builds are routed to the least-busy worker; init and options are broadcast.

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct WorkerStats {
    pub id: usize,
    pub busy: usize,
}

/// Chooses the worker with minimum busy load.
pub fn select_least_busy_worker(workers: &[WorkerStats]) -> Option<usize> {
    workers.iter().min_by_key(|w| w.busy).map(|w| w.id)
}

/// Service message types for section mesh builds.
#[derive(Debug, Clone, PartialEq)]
pub struct MeshBuildTask {
    pub x: i32,
    pub y: i32,
    pub z: i32,
    pub gen: u32,
    pub token: u64,
    pub is_lod: bool,
}

#[derive(Debug, Clone, PartialEq)]
pub struct MeshBuildResult {
    pub x: i32,
    pub y: i32,
    pub z: i32,
    pub gen: u32,
    pub token: u64,
    pub duration_ms: u64,
    pub is_empty: bool,
    pub solid_bytes: usize,
    pub cutout_bytes: usize,
    pub translucent_bytes: usize,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_select_least_busy_worker() {
        let workers = vec![
            WorkerStats { id: 0, busy: 3 },
            WorkerStats { id: 1, busy: 1 },
            WorkerStats { id: 2, busy: 2 },
        ];
        let chosen = select_least_busy_worker(&workers);
        assert_eq!(chosen, Some(1));
    }
}
