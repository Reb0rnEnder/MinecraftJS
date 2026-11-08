//! Port of `client/js/render/mesh-worker.js`.
//!
//! Web Worker protocol and message types for offloading chunk meshing
//! to background Web Workers.

use serde::{Deserialize, Serialize};

/// Messages received by the mesh worker from the main thread.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum MeshWorkerRequest {
    #[serde(rename = "build")]
    Build {
        chunk_x: i32,
        chunk_z: i32,
        section_y: i32,
        priority: i32,
    },
    #[serde(rename = "cancel")]
    Cancel {
        chunk_x: i32,
        chunk_z: i32,
        section_y: i32,
    },
    #[serde(rename = "clear")]
    Clear,
}

/// Messages posted by the mesh worker back to the main thread.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum MeshWorkerResponse {
    #[serde(rename = "mesh_ready")]
    MeshReady {
        chunk_x: i32,
        chunk_z: i32,
        section_y: i32,
        vertex_count: usize,
        index_count: usize,
    },
    #[serde(rename = "empty")]
    Empty {
        chunk_x: i32,
        chunk_z: i32,
        section_y: i32,
    },
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_worker_message_serialization() {
        let req = MeshWorkerRequest::Build {
            chunk_x: 10,
            chunk_z: -5,
            section_y: 4,
            priority: 1,
        };
        let json = serde_json::to_string(&req).expect("serialize");
        assert!(json.contains("\"type\":\"build\""));
        assert!(json.contains("\"chunk_x\":10"));
    }
}
