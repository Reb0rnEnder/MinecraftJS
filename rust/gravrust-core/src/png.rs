//! Port of the decoder in `client/js/util/png.js`.
//!
//! The JavaScript decoder was already pure (pako inflate + PNG filters), so
//! this is a direct translation: same chunk parsing, same filter arithmetic,
//! same sample scaling, same Adam7 pass handling, same RGBA output. Encoding
//! `encodePng` is ported too and produces a standard 8-bit RGBA PNG using zlib
//! deflate; the screenshot button now calls the WASM encoder.

use miniz_oxide::deflate::compress_to_vec_zlib;
use miniz_oxide::inflate::decompress_to_vec_zlib_with_limit;
use wasm_bindgen::prelude::*;

const SIGNATURE: [u8; 8] = [137, 80, 78, 71, 13, 10, 26, 10];

/// Decoded image: 8-bit RGBA, row-major.
#[wasm_bindgen]
pub struct PngImage {
    width: u32,
    height: u32,
    data: Vec<u8>,
}

#[wasm_bindgen]
impl PngImage {
    #[wasm_bindgen(getter)]
    pub fn width(&self) -> u32 {
        self.width
    }

    #[wasm_bindgen(getter)]
    pub fn height(&self) -> u32 {
        self.height
    }

    /// RGBA bytes (`Uint8Array` in JavaScript; copied out of WASM memory).
    #[wasm_bindgen(getter)]
    pub fn data(&self) -> Vec<u8> {
        self.data.clone()
    }

    pub fn data_len(&self) -> usize {
        self.data.len()
    }
}

fn crc32(bytes: &[u8]) -> u32 {
    let mut crc = 0xffff_ffffu32;
    for byte in bytes {
        crc ^= *byte as u32;
        for _ in 0..8 {
            crc = if crc & 1 != 0 {
                0xedb8_8320 ^ (crc >> 1)
            } else {
                crc >> 1
            };
        }
    }
    crc ^ 0xffff_ffff
}

fn write_chunk(out: &mut Vec<u8>, kind: &[u8; 4], data: &[u8]) {
    out.extend_from_slice(&(data.len() as u32).to_be_bytes());
    let crc_start = out.len();
    out.extend_from_slice(kind);
    out.extend_from_slice(data);
    out.extend_from_slice(&crc32(&out[crc_start..]).to_be_bytes());
}

/// Encode 8-bit RGBA pixels as a PNG (filter 0 on every row).
#[wasm_bindgen]
pub fn encode_png(width: u32, height: u32, rgba: &[u8]) -> Option<Vec<u8>> {
    let pixels = (width as usize).checked_mul(height as usize)?;
    let row_bytes = (width as usize).checked_mul(4)?;
    if rgba.len() != pixels.checked_mul(4)? || row_bytes.checked_add(1)?.checked_mul(height as usize)? > usize::MAX {
        return None;
    }
    let stride = row_bytes + 1;
    let mut raw = vec![0u8; stride * height as usize];
    for y in 0..height as usize {
        raw[y * stride] = 0;
        raw[y * stride + 1..(y + 1) * stride]
            .copy_from_slice(&rgba[y * row_bytes..(y + 1) * row_bytes]);
    }
    let compressed = compress_to_vec_zlib(&raw, 6);

    let mut out = Vec::with_capacity(compressed.len() + 128);
    out.extend_from_slice(&SIGNATURE);
    let mut ihdr = Vec::with_capacity(13);
    ihdr.extend_from_slice(&width.to_be_bytes());
    ihdr.extend_from_slice(&height.to_be_bytes());
    ihdr.extend_from_slice(&[8, 6, 0, 0, 0]);
    write_chunk(&mut out, b"IHDR", &ihdr);
    write_chunk(&mut out, b"IDAT", &compressed);
    write_chunk(&mut out, b"IEND", &[]);
    Some(out)
}

fn be_u32(bytes: &[u8], at: usize) -> Option<u32> {
    let slice = bytes.get(at..at + 4)?;
    Some(u32::from_be_bytes([slice[0], slice[1], slice[2], slice[3]]))
}

struct Header {
    width: usize,
    height: usize,
    depth: u8,
    color_type: u8,
    interlace: u8,
}

fn channels(color_type: u8) -> Option<usize> {
    match color_type {
        0 => Some(1),
        2 => Some(3),
        3 => Some(1),
        4 => Some(2),
        6 => Some(4),
        _ => None,
    }
}

/// Decode a PNG into RGBA. Returns `None` for malformed or unsupported data,
/// in which case the JavaScript caller uses its own decoder.
#[wasm_bindgen]
pub fn decode_png(bytes: &[u8]) -> Option<PngImage> {
    let (width, height, data) = decode_png_rgba(bytes)?;
    Some(PngImage {
        width,
        height,
        data,
    })
}

fn decode_png_rgba(bytes: &[u8]) -> Option<(u32, u32, Vec<u8>)> {
    if bytes.len() < 8 || bytes[0..8] != SIGNATURE {
        return None;
    }

    let mut header: Option<Header> = None;
    let mut palette: Vec<u8> = Vec::new();
    let mut trns: Vec<u8> = Vec::new();
    let mut compressed: Vec<u8> = Vec::new();
    let mut pos = 8usize;

    while pos + 8 <= bytes.len() {
        let length = be_u32(bytes, pos)? as usize;
        let kind = &bytes[pos + 4..pos + 8];
        let data_start = pos + 8;
        let data_end = data_start.checked_add(length)?;
        if data_end > bytes.len() {
            return None;
        }
        let data = &bytes[data_start..data_end];
        match kind {
            b"IHDR" => {
                if data.len() < 13 {
                    return None;
                }
                let width = be_u32(data, 0)? as usize;
                let height = be_u32(data, 4)? as usize;
                header = Some(Header {
                    width,
                    height,
                    depth: data[8],
                    color_type: data[9],
                    interlace: data[12],
                });
            }
            b"PLTE" => palette = data.to_vec(),
            b"tRNS" => trns = data.to_vec(),
            b"IDAT" => compressed.extend_from_slice(data),
            b"IEND" => break,
            _ => {}
        }
        pos = data_end + 4; // skip CRC
    }

    let header = header?;
    let width = header.width;
    let height = header.height;
    if width == 0 || height == 0 || width > 32768 || height > 32768 {
        return None;
    }
    if !matches!(header.depth, 1 | 2 | 4 | 8 | 16) {
        return None;
    }
    let channel_count = channels(header.color_type)?;
    if header.color_type == 3 && palette.len() < 3 {
        return None;
    }

    let pixel_count = width.checked_mul(height)?;
    let output_len = pixel_count.checked_mul(4)?;
    if output_len > 512 * 1024 * 1024 {
        return None;
    }

    // The inflated stream is at most (stride + filter byte) per row over all
    // Adam7 passes; allow a little slack for encoders that pad.
    let raw_pixels = pixel_count
        .checked_mul(channel_count)?
        .checked_mul(header.depth as usize)?
        / 8;
    let max_raw = raw_pixels
        .checked_add(height.checked_mul(8)?)?
        .checked_add(4096)?;
    let raw = decompress_to_vec_zlib_with_limit(&compressed, max_raw).ok()?;

    let mut out = vec![0u8; output_len];
    let bpp = ((channel_count * header.depth as usize) >> 3).max(1);
    let scale = if header.depth < 8 && header.color_type != 3 {
        255.0f32 / (((1u16 << header.depth) - 1) as f32)
    } else {
        1.0f32
    };

    let mut offset = 0usize;
    if header.interlace == 0 {
        decode_pass(
            &raw,
            &mut offset,
            width,
            height,
            width,
            &mut out,
            &header,
            &palette,
            &trns,
            bpp,
            scale,
            |x| x,
            |y| y,
        )?;
    } else {
        // Adam7: x0, y0, dx, dy
        const PASSES: [[usize; 4]; 7] = [
            [0, 0, 8, 8],
            [4, 0, 8, 8],
            [0, 4, 4, 8],
            [2, 0, 4, 4],
            [0, 2, 2, 4],
            [1, 0, 2, 2],
            [0, 1, 1, 2],
        ];
        for [x0, y0, dx, dy] in PASSES {
            let pw = width.saturating_sub(x0).div_ceil(dx);
            let ph = height.saturating_sub(y0).div_ceil(dy);
            if pw == 0 || ph == 0 {
                continue;
            }
            decode_pass(
                &raw,
                &mut offset,
                pw,
                ph,
                width,
                &mut out,
                &header,
                &palette,
                &trns,
                bpp,
                scale,
                |x| x0 + x * dx,
                |y| y0 + y * dy,
            )?;
        }
    }

    Some((width as u32, height as u32, out))
}

#[allow(clippy::too_many_arguments)]
fn decode_pass<FX, FY>(
    raw: &[u8],
    offset: &mut usize,
    pass_width: usize,
    pass_height: usize,
    image_width: usize,
    out: &mut [u8],
    header: &Header,
    palette: &[u8],
    trns: &[u8],
    bpp: usize,
    scale: f32,
    map_x: FX,
    map_y: FY,
) -> Option<()>
where
    FX: Fn(usize) -> usize,
    FY: Fn(usize) -> usize,
{
    let channel_count = channels(header.color_type)?;
    let stride = pass_width
        .checked_mul(channel_count)?
        .checked_mul(header.depth as usize)?
        .div_ceil(8);
    let mut prev = vec![0u8; stride];
    let mut cur = vec![0u8; stride];
    let mut p = *offset;

    for y in 0..pass_height {
        let filter = *raw.get(p)?;
        p += 1;
        for i in 0..stride {
            let x = *raw.get(p)? as i32;
            p += 1;
            let a = if i >= bpp { cur[i - bpp] as i32 } else { 0 };
            let up = prev[i] as i32;
            let c = if i >= bpp { prev[i - bpp] as i32 } else { 0 };
            let value = match filter {
                0 => x,
                1 => x + a,
                2 => x + up,
                3 => x + ((a + up) >> 1),
                4 => {
                    let pp = a + up - c;
                    let pa = (pp - a).abs();
                    let pb = (pp - up).abs();
                    let pc = (pp - c).abs();
                    x + if pa <= pb && pa <= pc {
                        a
                    } else if pb <= pc {
                        up
                    } else {
                        c
                    }
                }
                _ => x,
            };
            cur[i] = (value & 255) as u8;
        }

        for x in 0..pass_width {
            let ox = map_x(x);
            let oy = map_y(y);
            write_pixel(out, image_width, header, palette, trns, scale, &cur, x, ox, oy)?;
        }

        std::mem::swap(&mut prev, &mut cur);
    }

    *offset = p;
    Some(())
}

#[allow(clippy::too_many_arguments)]
fn write_pixel(
    out: &mut [u8],
    image_width: usize,
    header: &Header,
    palette: &[u8],
    trns: &[u8],
    scale: f32,
    row: &[u8],
    x: usize,
    ox: usize,
    oy: usize,
) -> Option<()> {
    let out_index = (oy.checked_mul(image_width)? + ox).checked_mul(4)?;
    if out_index + 4 > out.len() {
        return None;
    }
    let sample = |index: usize| sample(row, header.depth, index);
    match header.color_type {
        0 => {
            let raw = sample(x);
            let gray = (raw as f32 * scale) as u8;
            out[out_index] = gray;
            out[out_index + 1] = gray;
            out[out_index + 2] = gray;
            let transparent = trns.len() >= 2
                && (((trns[0] as u32) << 8) | trns[1] as u32) == raw as u32;
            out[out_index + 3] = if transparent { 0 } else { 255 };
        }
        2 => {
            out[out_index] = sample(x * 3);
            out[out_index + 1] = sample(x * 3 + 1);
            out[out_index + 2] = sample(x * 3 + 2);
            out[out_index + 3] = 255;
        }
        3 => {
            let index = sample(x) as usize;
            let base = index.checked_mul(3)?;
            out[out_index] = palette.get(base).copied().unwrap_or(0);
            out[out_index + 1] = palette.get(base + 1).copied().unwrap_or(0);
            out[out_index + 2] = palette.get(base + 2).copied().unwrap_or(0);
            out[out_index + 3] = if index < trns.len() { trns[index] } else { 255 };
        }
        4 => {
            let gray = (sample(x * 2) as f32 * scale) as u8;
            out[out_index] = gray;
            out[out_index + 1] = gray;
            out[out_index + 2] = gray;
            out[out_index + 3] = sample(x * 2 + 1);
        }
        _ => {
            out[out_index] = sample(x * 4);
            out[out_index + 1] = sample(x * 4 + 1);
            out[out_index + 2] = sample(x * 4 + 2);
            out[out_index + 3] = sample(x * 4 + 3);
        }
    }
    Some(())
}

fn sample(row: &[u8], depth: u8, index: usize) -> u8 {
    match depth {
        8 => row.get(index).copied().unwrap_or(0),
        16 => row.get(index * 2).copied().unwrap_or(0),
        _ => {
            let per_byte = 8 / depth as usize;
            let byte = row.get(index / per_byte).copied().unwrap_or(0);
            let shift = 8 - depth as usize * (index % per_byte + 1);
            (byte >> shift) & (((1u16 << depth) - 1) as u8)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // 2x2 RGBA8 image (hand-built PNG).
    const TINY_PNG: &[u8] = include_bytes!("../tests/fixtures/tiny-rgba.png");
    const TINY_RGBA: &[u8] = include_bytes!("../tests/fixtures/tiny-rgba.rgba");

    #[test]
    fn decodes_rgba_png() {
        let (w, h, data) = decode_png_rgba(TINY_PNG).expect("decode");
        assert_eq!((w, h), (2, 2));
        assert_eq!(data, TINY_RGBA);
    }

    #[test]
    fn rejects_non_png() {
        assert!(decode_png_rgba(b"not a png").is_none());
        assert!(decode_png_rgba(&[]).is_none());
    }

    #[test]
    fn encoded_png_decodes_back_to_the_pixels() {
        let rgba: Vec<u8> = (0..4 * 3 * 2).map(|i| (i * 19 + 7) as u8).collect();
        let png = encode_png(3, 2, &rgba).expect("encode");
        assert_eq!(&png[..8], &SIGNATURE);
        let (w, h, data) = decode_png_rgba(&png).expect("decode");
        assert_eq!((w, h), (3, 2));
        assert_eq!(data, rgba);
    }

    #[test]
    fn encoder_rejects_wrong_pixel_count() {
        assert!(encode_png(2, 2, &[0; 15]).is_none());
    }

    #[test]
    fn samples_sub_byte_depths() {
        let row = [0b1010_0101u8];
        assert_eq!(sample(&row, 1, 0), 1);
        assert_eq!(sample(&row, 1, 1), 0);
        assert_eq!(sample(&row, 4, 0), 10);
        assert_eq!(sample(&row, 4, 1), 5);
        assert_eq!(sample(&[1, 2, 3, 4, 5, 6, 7], 16, 2), 5);
    }
}
