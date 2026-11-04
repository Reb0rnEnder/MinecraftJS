//! Port of the read-only ZIP reader in `client/js/util/zip.js`.
//!
//! Used for the embedded asset pack, resource packs and shader packs. Supports
//! stored (0) and raw-deflate (8) entries, which is all the Java pack format
//! uses. ZIP64 and encrypted archives are rejected so the JavaScript reader can
//! handle them.

use miniz_oxide::inflate::decompress_to_vec_with_limit;
use wasm_bindgen::prelude::*;

const EOCD_SIGNATURE: u32 = 0x0605_4b50;
const CENTRAL_SIGNATURE: u32 = 0x0201_4b50;
const LOCAL_SIGNATURE: u32 = 0x0403_4b50;
const MAX_ENTRY_SIZE: usize = 512 * 1024 * 1024;

struct Entry {
    name: String,
    method: u16,
    compressed_size: usize,
    uncompressed_size: usize,
    local_offset: usize,
}

#[wasm_bindgen]
pub struct ZipArchive {
    data: Vec<u8>,
    entries: Vec<Entry>,
}

fn u16_at(data: &[u8], at: usize) -> Option<u16> {
    let bytes = data.get(at..at + 2)?;
    Some(u16::from_le_bytes([bytes[0], bytes[1]]))
}

fn u32_at(data: &[u8], at: usize) -> Option<u32> {
    let bytes = data.get(at..at + 4)?;
    Some(u32::from_le_bytes([bytes[0], bytes[1], bytes[2], bytes[3]]))
}

impl ZipArchive {
    fn parse(bytes: &[u8]) -> Option<ZipArchive> {
        if bytes.len() < 22 {
            return None;
        }
        // End of central directory: scan backwards over the maximum comment.
        let lowest = bytes.len().saturating_sub(65557);
        let mut eocd = None;
        for at in (lowest..=bytes.len() - 22).rev() {
            if u32_at(bytes, at) == Some(EOCD_SIGNATURE) {
                eocd = Some(at);
                break;
            }
        }
        let eocd = eocd?;
        let count = u16_at(bytes, eocd + 10)? as usize;
        let offset = u32_at(bytes, eocd + 16)? as usize;
        if offset == 0xffff_ffff || offset >= bytes.len() {
            return None; // ZIP64
        }

        let mut entries = Vec::with_capacity(count);
        let mut at = offset;
        for _ in 0..count {
            if u32_at(bytes, at) != Some(CENTRAL_SIGNATURE) {
                break;
            }
            let method = u16_at(bytes, at + 10)?;
            let compressed_size = u32_at(bytes, at + 20)? as usize;
            let uncompressed_size = u32_at(bytes, at + 24)? as usize;
            let name_len = u16_at(bytes, at + 28)? as usize;
            let extra_len = u16_at(bytes, at + 30)? as usize;
            let comment_len = u16_at(bytes, at + 32)? as usize;
            let local_offset = u32_at(bytes, at + 42)? as usize;
            if compressed_size == 0xffff_ffff
                || uncompressed_size == 0xffff_ffff
                || local_offset == 0xffff_ffff
            {
                return None; // ZIP64
            }
            let name_bytes = bytes.get(at + 46..at + 46 + name_len)?;
            let name = crate::utf8::decode(name_bytes).replace('\\', "/");
            if !name.ends_with('/') {
                entries.push(Entry {
                    name,
                    method,
                    compressed_size,
                    uncompressed_size,
                    local_offset,
                });
            }
            at = at.checked_add(46 + name_len + extra_len + comment_len)?;
        }

        Some(ZipArchive {
            data: bytes.to_vec(),
            entries,
        })
    }

    fn entry(&self, name: &str) -> Option<&Entry> {
        self.entries.iter().find(|entry| entry.name == name)
    }
}

#[wasm_bindgen]
impl ZipArchive {
    pub fn has(&self, name: &str) -> bool {
        self.entry(name).is_some()
    }

    pub fn list(&self, prefix: &str) -> Vec<String> {
        self.entries
            .iter()
            .filter(|entry| entry.name.starts_with(prefix))
            .map(|entry| entry.name.clone())
            .collect()
    }

    /// Some packs wrap everything in one top-level folder; find the one that
    /// contains pack.mcmeta (same rule as ZipArchive.rootPrefix).
    pub fn root_prefix(&self) -> String {
        if self.has("pack.mcmeta") {
            return String::new();
        }
        for entry in &self.entries {
            if let Some(folder) = entry.name.strip_suffix("/pack.mcmeta") {
                if !folder.is_empty() && !folder.contains('/') {
                    return format!("{folder}/");
                }
            }
        }
        String::new()
    }

    pub fn read(&self, name: &str) -> Option<Vec<u8>> {
        let entry = self.entry(name)?;
        let data = self.data.as_slice();
        let name_len = u16_at(data, entry.local_offset + 26)? as usize;
        let extra_len = u16_at(data, entry.local_offset + 28)? as usize;
        if u32_at(data, entry.local_offset) != Some(LOCAL_SIGNATURE) {
            return None;
        }
        let start = entry.local_offset.checked_add(30 + name_len + extra_len)?;
        let end = start.checked_add(entry.compressed_size)?;
        let raw = data.get(start..end)?;
        match entry.method {
            0 => Some(raw.to_vec()),
            8 => {
                if entry.uncompressed_size > MAX_ENTRY_SIZE {
                    return None;
                }
                decompress_to_vec_with_limit(raw, entry.uncompressed_size.saturating_add(1024))
                    .ok()
            }
            _ => None, // bzip2 and other methods stay on the JS path
        }
    }

    pub fn read_text(&self, name: &str) -> Option<String> {
        self.read(name)
            .map(|bytes| crate::utf8::decode(&bytes))
    }

    pub fn entry_count(&self) -> usize {
        self.entries.len()
    }
}

#[wasm_bindgen]
pub fn zip_open(bytes: &[u8]) -> Option<ZipArchive> {
    ZipArchive::parse(bytes)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn zip(entries: &[(&str, &[u8], u16)]) -> Vec<u8> {
        let mut out = Vec::new();
        let mut central = Vec::new();
        for (name, data, method) in entries {
            let payload = match method {
                0 => data.to_vec(),
                8 => miniz_oxide::deflate::compress_to_vec(data, 6),
                _ => unreachable!(),
            };
            let local_offset = out.len();
            out.extend_from_slice(&LOCAL_SIGNATURE.to_le_bytes());
            out.extend_from_slice(&20u16.to_le_bytes());
            out.extend_from_slice(&0u16.to_le_bytes());
            out.extend_from_slice(&method.to_le_bytes());
            out.extend_from_slice(&0u16.to_le_bytes());
            out.extend_from_slice(&0u16.to_le_bytes());
            out.extend_from_slice(&0u32.to_le_bytes());
            out.extend_from_slice(&(payload.len() as u32).to_le_bytes());
            out.extend_from_slice(&(data.len() as u32).to_le_bytes());
            out.extend_from_slice(&(name.len() as u16).to_le_bytes());
            out.extend_from_slice(&0u16.to_le_bytes());
            out.extend_from_slice(name.as_bytes());
            out.extend_from_slice(&payload);

            central.extend_from_slice(&CENTRAL_SIGNATURE.to_le_bytes());
            central.extend_from_slice(&20u16.to_le_bytes());
            central.extend_from_slice(&20u16.to_le_bytes());
            central.extend_from_slice(&0u16.to_le_bytes());
            central.extend_from_slice(&method.to_le_bytes());
            central.extend_from_slice(&0u16.to_le_bytes());
            central.extend_from_slice(&0u16.to_le_bytes());
            central.extend_from_slice(&0u32.to_le_bytes());
            central.extend_from_slice(&(payload.len() as u32).to_le_bytes());
            central.extend_from_slice(&(data.len() as u32).to_le_bytes());
            central.extend_from_slice(&(name.len() as u16).to_le_bytes());
            central.extend_from_slice(&0u16.to_le_bytes());
            central.extend_from_slice(&0u16.to_le_bytes());
            central.extend_from_slice(&0u16.to_le_bytes());
            central.extend_from_slice(&0u16.to_le_bytes());
            central.extend_from_slice(&0u32.to_le_bytes());
            central.extend_from_slice(&(local_offset as u32).to_le_bytes());
            central.extend_from_slice(name.as_bytes());
        }
        let central_offset = out.len();
        out.extend_from_slice(&central);
        out.extend_from_slice(&EOCD_SIGNATURE.to_le_bytes());
        out.extend_from_slice(&0u16.to_le_bytes());
        out.extend_from_slice(&0u16.to_le_bytes());
        out.extend_from_slice(&(entries.len() as u16).to_le_bytes());
        out.extend_from_slice(&(entries.len() as u16).to_le_bytes());
        out.extend_from_slice(&(central.len() as u32).to_le_bytes());
        out.extend_from_slice(&(central_offset as u32).to_le_bytes());
        out.extend_from_slice(&0u16.to_le_bytes());
        out
    }

    #[test]
    fn reads_stored_and_deflated_entries() {
        let archive_bytes = zip(&[
            ("pack.mcmeta", b"{\"pack\":{}}", 8),
            ("assets/a.txt", b"hello world", 0),
            ("assets/deep/b.bin", &[0, 1, 2, 3, 255], 8),
        ]);
        let archive = zip_open(&archive_bytes).expect("open");
        assert_eq!(archive.entry_count(), 3);
        assert_eq!(archive.read("assets/a.txt").unwrap(), b"hello world");
        assert_eq!(archive.read("assets/deep/b.bin").unwrap(), vec![0, 1, 2, 3, 255]);
        assert_eq!(archive.read_text("pack.mcmeta").unwrap(), "{\"pack\":{}}");
        assert!(archive.read("missing").is_none());
        assert_eq!(archive.root_prefix(), "");
        assert_eq!(archive.list("assets/").len(), 2);
    }

    #[test]
    fn finds_a_single_root_folder() {
        let archive_bytes = zip(&[("MyPack/pack.mcmeta", b"{}", 0), ("MyPack/x.txt", b"x", 0)]);
        let archive = zip_open(&archive_bytes).expect("open");
        assert_eq!(archive.root_prefix(), "MyPack/");
    }

    #[test]
    fn normalises_backslashes_and_skips_directories() {
        let archive_bytes = zip(&[
            ("dir\\file.txt", b"value", 0),
            ("dir/", b"", 0),
        ]);
        let archive = zip_open(&archive_bytes).expect("open");
        assert!(archive.has("dir/file.txt"));
        assert_eq!(archive.read_text("dir/file.txt").unwrap(), "value");
        assert_eq!(archive.entry_count(), 1);
    }

    #[test]
    fn rejects_garbage_and_truncated_archives() {
        assert!(zip_open(b"not a zip file at all").is_none());
        let bytes = zip(&[("a", b"hello", 8)]);
        assert!(zip_open(&bytes[..20]).is_none());
    }
}
