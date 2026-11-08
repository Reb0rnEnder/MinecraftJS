//! Port of `client/js/gfx/dirty-mips.js` (upstream MinecraftJS 1.8.9).
//!
//! Rebuild only the mip texels affected by a base-level atlas edit. Alignment
//! to the coarsest grid makes local box-filtering identical to a full-atlas
//! rebuild. `buildMips` comes from the device module (already ported in
//! `crate::webgl2_alg::build_mips`).

/// A generated mip: `{ width, height, data }` from buildMips, plus placement.
#[derive(Debug, Clone)]
pub struct DirtyMip {
    pub width: i64,
    pub height: i64,
    pub data: Vec<u8>,
    pub x: i64,
    pub y: i64,
    pub level: i64,
}

/// JS: `buildMips(pw, ph, patch, levels)` Ã¢â‚¬â€ box-filter halving. Lives in
/// upstream `device.js`; reproduced here 1:1 (RGBA8).
pub fn build_mips(width: i64, height: i64, src: &[u8], levels: i64) -> Vec<(i64, i64, Vec<u8>)> {
    let mut out = Vec::new();
    let (mut w, mut h) = (width, height);
    let mut data = src.to_vec();
    for _ in 0..levels {
        let (nw, nh) = ((w / 2).max(1), (h / 2).max(1));
        let mut dst = vec![0u8; (nw * nh * 4) as usize];
        for y in 0..nh {
            for x in 0..nw {
                for c in 0..4 {
                    // 2x2 box average; edge taps clamp (canvas-like)
                    let x0 = (x * 2).min(w - 1);
                    let y0 = (y * 2).min(h - 1);
                    let x1 = (x * 2 + 1).min(w - 1);
                    let y1 = (y * 2 + 1).min(h - 1);
                    let s00 = &data[((y0 * w + x0) * 4 + c) as usize];
                    let s01 = &data[((y0 * w + x1) * 4 + c) as usize];
                    let s10 = &data[((y1 * w + x0) * 4 + c) as usize];
                    let s11 = &data[((y1 * w + x1) * 4 + c) as usize];
                    dst[((y * nw + x) * 4 + c) as usize] = ((*s00 as u32 + *s01 as u32 + *s10 as u32 + *s11 as u32) / 4) as u8;
                }
            }
        }
        out.push((nw, nh, dst));
        w = nw;
        h = nh;
        data = out.last().unwrap().2.clone();
    }
    out
}

/// JS: `dirtyMipRegions(width, height, source, x, y, w, h, maxLevels = 4)`.
pub fn dirty_mip_regions(
    width: i64,
    height: i64,
    source: &[u8],
    x: i64,
    y: i64,
    w: i64,
    h: i64,
    max_levels: i64,
) -> Vec<DirtyMip> {
    let levels = max_levels.min((width.max(height) as f64).log2().floor() as i64);
    if levels <= 0 || w <= 0 || h <= 0 {
        return vec![];
    }
    let grid = 1i64 << levels;
    let x0 = (x / grid).max(0) * grid;
    let y0 = (y / grid).max(0) * grid;
    let x1 = ((x + w + grid - 1) / grid).min((width + grid - 1) / grid) * grid;
    let y1 = ((y + h + grid - 1) / grid).min((height + grid - 1) / grid) * grid;
    let (x1, y1) = (x1.min(width), y1.min(height));
    let (pw, ph) = (x1 - x0, y1 - y0);
    if pw <= 0 || ph <= 0 {
        return vec![];
    }
    let mut patch = vec![0u8; (pw * ph * 4) as usize];
    for row in 0..ph {
        let src_start = (((y0 + row) * width + x0) * 4) as usize;
        let src_end = (((y0 + row) * width + x1) * 4) as usize;
        patch[(row * pw * 4) as usize..((row * pw * 4) as usize) + (src_end - src_start)]
            .copy_from_slice(&source[src_start..src_end]);
    }
    let mut out = Vec::new();
    for (i, (mw, mh, mdata)) in build_mips(pw, ph, &patch, levels).into_iter().enumerate() {
        let level = i as i64 + 1;
        let scale = 1i64 << level;
        let mx = x0 / scale;
        let my = y0 / scale;
        let fw = (width as f64 / scale as f64).floor().max(1.0) as i64;
        let fh = (height as f64 / scale as f64).floor().max(1.0) as i64;
        if mx + mw <= fw && my + mh <= fh {
            out.push(DirtyMip { width: mw, height: mh, data: mdata, x: mx, y: my, level });
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn grid_alignment_produces_expected_mips() {
        // 64x64 atlas, edit 16x16 at (16,16): coarsest grid = 2^4 = 16
        let src = vec![255u8; 64 * 64 * 4];
        let mips = dirty_mip_regions(64, 64, &src, 16, 16, 16, 16, 4);
        assert!(!mips.is_empty());
        assert_eq!(mips[0].level, 1);
        assert_eq!(mips[0].width, 8); // 16/2
    }

    #[test]
    fn rejects_empty_region() {
        let src = vec![0u8; 64 * 64 * 4];
        assert!(dirty_mip_regions(64, 64, &src, 0, 0, 0, 0, 4).is_empty());
    }
}
