//! Port of `client/js/render/texture-preload.js` (upstream MinecraftJS 1.8.9).
//!
//! Decode/upload before first use, with bounded memory and request
//! concurrency. High-resolution packs cannot force every unused texture into
//! GPU memory. The JS async worker pool is a browser scheduling detail; the
//! Rust port processes entries in the same order with identical
//! budget/skip/failed accounting, calling the host's async loader from the
//! engine layer.

/// An entry: either a path (size unknown) or `(path, w, h)`.
pub type PreloadEntry = (String, Option<(i64, i64)>);

#[derive(Debug, Clone, Default)]
pub struct PreloadReport {
    pub total: usize,
    pub loaded: usize,
    pub skipped: usize,
    pub failed: Vec<String>,
    pub bytes: i64,
}

/// The asset surface the preloader needs. `image_size` returns the decoded
/// dimensions (the engine performs the actual async decode).
pub trait PreloadAssets {
    fn image_size(&mut self, path: &str) -> Result<(i64, i64), String>;
    fn texture(&mut self, path: &str, linear_filter: bool, wrap_repeat: bool);
}

/// JS: `preloadTextures(assets, entries, { budget = 64MiB, concurrency = 4 })`.
pub fn preload_textures<A: PreloadAssets>(
    assets: &mut A,
    entries: &[PreloadEntry],
    budget: i64,
    _concurrency: usize,
    progress_log: &mut Vec<(usize, usize)>,
) -> PreloadReport {
    let mut paths: Vec<PreloadEntry> = Vec::new();
    for e in entries {
        if !paths.iter().any(|(p, _)| p == &e.0) {
            paths.push(e.clone());
        }
    }
    let total = paths.len();
    let mut report = PreloadReport { total, ..Default::default() };
    for (path, dims) in paths {
        let (w, h) = dims.unwrap_or((0, 0));
        let estimate = w * h * 4;
        if report.bytes + estimate > budget {
            report.skipped += 1;
            continue;
        }
        report.bytes += estimate;
        match assets.image_size(&path) {
            Ok((iw, ih)) => {
                let bytes = iw * ih * 4;
                if estimate == 0 && report.bytes + bytes > budget {
                    report.skipped += 1;
                    continue;
                }
                report.bytes += bytes;
                let linear = path.contains("/panorama_");
                let wrap = path == "environment/clouds.png" || path.contains("glint");
                assets.texture(&path, linear, wrap);
                report.loaded += 1;
            }
            Err(_) => report.failed.push(path),
        }
        progress_log.push((report.loaded + report.skipped + report.failed.len(), report.total));
    }
    report
}