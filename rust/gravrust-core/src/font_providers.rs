// Port of `client/js/render/font-providers.js`
//!
//! Font provider systems: bitmap, legacy unicode, and TTF.
//! Providers are layered; higher-priority resources are used first,
//! while missing glyphs fall through to lower providers.

use wasm_bindgen::prelude::*;

/// Decoded font image: 8-bit RGBA, row-major.
/// Mirrors the JS image object passed to bitmapProvider.
#[wasm_bindgen]
pub struct FontImage {
    pub width: u32,
    pub height: u32,
    pub data: Vec<u8>,
}

/// PNG signature bytes for quick validation.
const PNG_SIG: [u8; 8] = [137, 80, 78, 71, 13, 10, 26, 10];

/// Check if bytes start with the PNG signature.
fn is_png(bytes: &[u8]) -> bool {
    bytes.len() >= 8 && bytes[0..8] == PNG_SIG
}

/// Read PNG bytes into a `FontImage`.  For now we just validate the signature
/// and return the raw data; a production build would call the full PNG decoder.
fn decode_png_to_image(_bytes: &[u8]) -> Option<FontImage> {
    if !is_png(_bytes) {
        return None;
    }
    // Stub: return a minimal placeholder image.
    // The JS version uses `decodePng` (pako inflate + filter handling);
    // here we defer to the JS side or a full Rust PNG crate.
    Some(FontImage {
        width: 16,
        height: 16,
        data: _bytes.to_vec(),
    })
}

/// Bitmap font definition parsed from JSON.
#[derive(Debug, Clone)]
pub struct BitmapDef {
    /// 2D array of character codes (rows of strings or char arrays)
    pub chars: Vec<Vec<char>>,
    /// Optional height per character (default 8)
    pub height: Option<u32>,
    /// Optional ascent offset (default 0)
    pub ascent: Option<u32>,
}

/// Legacy unicode font definition.
#[derive(Debug, Clone)]
pub struct LegacyDef {
    /// Template path with `%s` placeholder for page index
    pub template: String,
    /// Hex-encoded sizes table indexed by char code
    pub sizes: String,
}

/// TTF font definition.
#[derive(Debug, Clone)]
pub struct TtfDef {
    /// Font size in pixels
    pub size: Option<u32>,
    /// Oversample factor
    pub oversample: Option<u32>,
    /// Shift array [x, y]
    pub shift: Option<(i32, i32)>,
}

/// A glyph extracted from a font provider.
#[derive(Debug, Clone)]
pub struct Glyph {
    /// Advance width
    pub advance: f32,
    /// Glyph origin x
    pub x: f32,
    /// Glyph origin y
    pub y: f32,
    /// Glyph width
    pub width: f32,
    /// Glyph height
    pub height: f32,
    /// Texture coordinates (min UV)
    pub u0: f32,
    /// Texture coordinates (min UV)
    pub v0: f32,
    /// Texture coordinates (max UV)
    pub u1: f32,
    /// Texture coordinates (max UV)
    pub v1: f32,
    /// Bold offset compensation
    pub boldOffset: f32,
    /// Shadow offset compensation
    pub shadowOffset: f32,
    /// Associated texture (lazy-loaded)
    pub texture: Option<FontImage>,
}

/// A font provider that can return glyphs for characters.
/// Each provider has a `type` and internal data for glyph lookup.
#[derive(Debug, Clone)]
pub struct FontProvider {
    pub r#type: FontProviderType,
    /// Internal state for glyph lookup
    pub data: FontProviderData,
}

/// Enum classifying the type of font provider.
#[derive(Debug, Clone, PartialEq)]
pub enum FontProviderType {
    Bitmap,
    LegacyUnicode,
    Ttf,
}

/// Internal data for each provider type.
#[derive(Debug, Clone)]
enum FontProviderData {
    Bitmap {
        glyphs: std::collections::HashMap<char, Glyph>,
        image_width: f32,
        image_height: f32,
        scale: f32,
    },
    LegacyUnicode {
        cache: std::collections::HashMap<char, Option<Glyph>>,
        images: std::collections::HashMap<String, FontImage>,
        template: String,
        sizes: String, // hex-encoded sizes table
    },
    Ttf {
        skipped: std::collections::HashSet<char>,
        cache: std::collections::HashMap<char, Glyph>,
        bytes: Vec<u8>,
        size: u32,
        oversample: u32,
        shift: (i32, i32),
    },
}

/// FontSet manages a collection of font providers and resolves glyphs.
/// This mirrors the JS `FontSet` class.
#[derive(Debug)]
pub struct FontSet {
    assets: wasm_bindgen::JsValue, // the GRAVRUST Assets object
    providers: Vec<FontProvider>,
    normal: std::collections::HashMap<char, Glyph>,
    unicode: std::collections::HashMap<char, Glyph>,
}

impl FontSet {
    /// Create a new `FontSet` from a list of providers.
    pub fn new(assets: &wasm_bindgen::JsValue, providers: Vec<FontProvider>) -> Self {
        Self {
            assets: assets.clone(),
            providers,
            normal: std::collections::HashMap::new(),
            unicode: std::collections::HashMap::new(),
        }
    }

    /// Get a glyph for character `ch`.
    /// If `unicode` is `true`, only `legacy_unicode` providers are searched.
    pub fn glyph(&mut self, ch: char, unicode: bool) -> Glyph {
        let cache = if unicode {
            &mut self.unicode
        } else {
            &mut self.normal
        };

        if let Some(cached) = cache.get(&ch) {
            return cached.clone();
        }

        let mut glyph: Option<Glyph> = None;

        // Space has a dedicated glyph
        if ch == ' ' {
            glyph = Some(Glyph {
                advance: 4.0,
                x: 0.0,
                y: 0.0,
                width: 5.0,
                height: 8.0,
                u0: 0.0,
                v0: 0.0,
                u1: 1.0,
                v1: 1.0,
                boldOffset: 1.0,
                shadowOffset: 1.0,
                texture: None,
            });
        }

        // Try each provider in priority order
        if glyph.is_none() {
            for provider in &self.providers {
                if unicode && provider.r#type != FontProviderType::LegacyUnicode {
                    continue;
                }
                if let Some(g) = provider.get_glyph(ch) {
                    glyph = Some(g);
                    break;
                }
            }
        }

        // Fallback: missing glyph - a basic 5x8 solid rectangle
        let fallback = |_: char| -> Glyph {
            Glyph {
                advance: 6.0,
                x: 0.0,
                y: 0.0,
                width: 5.0,
                height: 8.0,
                u0: 0.0,
                v0: 0.0,
                u1: 1.0,
                v1: 1.0,
                boldOffset: 1.0,
                shadowOffset: 1.0,
                texture: None,
            }
        };

        let glyph = glyph.unwrap_or_else(fallback);

        cache.insert(ch, glyph.clone());
        glyph
    }
}

/// Resolve a resource location string.
/// Same semantics as the `location` helper in font-providers.js.
pub fn resolve_location(value: &str, prefix: &str) -> String {
    if let Some(i) = value.find(':') {
        format!("{}:{}", &value[..=i], &value[i + 1..])
    } else {
        format!("minecraft:{}{}", prefix, value)
    }
}

/// Port of `fontBytes(assets, id)` from font-providers.js.
/// Reads font resource bytes from packs or the source cache.
/// In this Rust port the `assets` argument is the WASM `JsValue` representing
/// the GRAVRUST `Assets` object; the actual pack/source lookup depends on the
/// host ECS/JS integration.
pub async fn font_bytes(assets: &wasm_bindgen::JsValue, id: &str) -> Option<Vec<u8>> {
    let parts: Vec<&str> = id.split(':').collect();
    if parts.len() < 2 {
        return None;
    }
    let namespace = parts[0];
    let path = parts[1..].join(":");

    // Check resource packs - in the full JS implementation:
    //   for (const pack of assets.packs) {
    //       const name = pack.prefix + "assets/" + namespace + "/" + path;
    //       if (pack.zip?.has(name)) return pack.zip.read(name);
    //   }
    //   return assets.source.bytes(namespace + "/" + path);

    // Stub: return None - the actual assets API is host-bound.
    // The JS version is async; we keep the signature async for compatibility.
    None
}

/// Port of `bitmapProvider(assets, def, image, key)` from font-providers.js.
/// Creates a bitmap glyph provider from a grid of characters in an image.
pub fn bitmap_provider(
    _assets: &wasm_bindgen::JsValue,
    def: &BitmapDef,
    image: &FontImage,
    key: &str,
) -> FontProvider {
    let rows = &def.chars;
    if rows.is_empty()
        || rows[0].is_empty()
        || rows.iter().any(|s| s.len() != rows[0].len())
    {
        // Invalid character rows - return empty provider that yields nothing
        return FontProvider {
            r#type: FontProviderType::Bitmap,
            data: FontProviderData::Bitmap {
                glyphs: std::collections::HashMap::new(),
                image_width: image.width as f32,
                image_height: image.height as f32,
                scale: 1.0,
            },
        };
    }

    let height = def.height.unwrap_or(8);
    let ascent = def.ascent.unwrap_or(0);

    if height == 0 {
        // Avoid division by zero
        return FontProvider {
            r#type: FontProviderType::Bitmap,
            data: FontProviderData::Bitmap {
                glyphs: std::collections::HashMap::new(),
                image_width: image.width as f32,
                image_height: image.height as f32,
                scale: 1.0,
            },
        };
    }

    if ascent > height {
        // Invalid ascent
        return FontProvider {
            r#type: FontProviderType::Bitmap,
            data: FontProviderData::Bitmap {
                glyphs: std::collections::HashMap::new(),
                image_width: image.width as f32,
                image_height: image.height as f32,
                scale: 1.0,
            },
        };
    }

    let cw = (image.width as f32 / rows[0].len() as f32).floor() as u32;
    let ch = (image.height as f32 / rows.len() as f32).floor() as u32;
    let scale = height as f32 / ch.max(1) as f32;

    if cw == 0 || ch == 0 {
        return FontProvider {
            r#type: FontProviderType::Bitmap,
            data: FontProviderData::Bitmap {
                glyphs: std::collections::HashMap::new(),
                image_width: image.width as f32,
                image_height: image.height as f32,
                scale: 1.0,
            },
        };
    }

    // Build glyph map by scanning the image grid
    let mut glyphs: std::collections::HashMap<char, Glyph> = std::collections::HashMap::new();

    for row_idx in 0..rows.len() {
        for col_idx in 0..rows[row_idx].len() {
            let ch = rows[row_idx][col_idx];
            if ch == '\0' || ch == ' ' {
                continue;
            }

            // Sample ink: find the first non-transparent pixel from the left
            // in the current glyph cell.  The JS version iterates from cw-1 downwards.
            let mut ink = 0u32;
            for x in (0..cw).rev() {
                for y in 0..ch {
                    // Pixel position in the RGBA data
                    let px = (row_idx * ch as usize + y) * image.width as usize
                        + col_idx * cw as usize
                        + x as usize;
                    if px < image.data.len() && image.data[px * 4 + 3] != 0 {
                        ink = x + 1;
                        break;
                    }
                }
                if ink != 0 {
                    break;
                }
            }

            let advance = (ink as f32 * scale + 0.5).floor() as u32 + 1;

            glyphs.insert(
                ch,
                Glyph {
                    advance: advance as f32,
                    x: 0.0,
                    y: (height - ascent) as f32,
                    width: (cw as f32 * scale).max(1.0),
                    height: height as f32,
                    u0: col_idx as f32 / image.width as f32,
                    v0: row_idx as f32 / image.height as f32,
                    u1: (col_idx + 1) as f32 / image.width as f32,
                    v1: (row_idx + 1) as f32 / image.height as f32,
                    boldOffset: 1.0,
                    shadowOffset: 1.0,
                    texture: None, // texture lazily created by the renderer
                },
            );
        }
    }

    FontProvider {
        r#type: FontProviderType::Bitmap,
        data: FontProviderData::Bitmap {
            glyphs,
            image_width: image.width as f32,
            image_height: image.height as f32,
            scale,
        },
    }
}

/// Port of `legacyProvider(assets, def, sizes)` from font-providers.js.
/// Creates a legacy unicode font provider using the old Minecraft format
/// with per-character size indices and texture pages.
pub fn legacy_provider(
    _assets: &wasm_bindgen::JsValue,
    def: &LegacyDef,
    _sizes: &[u16],
) -> FontProvider {
    let mut cache: std::collections::HashMap<char, Option<Glyph>> = std::collections::HashMap::new();
    let mut images: std::collections::HashMap<String, FontImage> = std::collections::HashMap::new();

    FontProvider {
        r#type: FontProviderType::LegacyUnicode,
        data: FontProviderData::LegacyUnicode {
            cache,
            images,
            template: def.template.clone(),
            sizes: def.sizes.clone(),
        },
    }
}

/// Port of `trueTypeProvider(assets, def, bytes, key)` from font-providers.js.
/// Creates a TTF font provider using the WebAssembly rasterizer.
/// The JS version uses a `WebAssembly.Module` with a custom `math` import
/// (`pow`, `cos`, `acos`, `fmod`).  Here we store the bytes and defer
/// actual rasterization to a later stage or to JS.
pub fn true_type_provider(
    _assets: &wasm_bindgen::JsValue,
    def: &TtfDef,
    bytes: &[u8],
    _key: &str,
) -> FontProvider {
    let size = def.size.unwrap_or(11);
    let over = def.oversample.unwrap_or(1);
    let shift = def.shift.unwrap_or((0, 0));

    // Basic validation (mirrors the JS checks)
    if size < 1 || size > 256 || over < 1 || over > 64 {
        // Invalid parameters - return empty provider
        return FontProvider {
            r#type: FontProviderType::Ttf,
            data: FontProviderData::Ttf {
                skipped: std::collections::HashSet::new(),
                cache: std::collections::HashMap::new(),
                bytes: bytes.to_vec(),
                size: 0,
                oversample: 0,
                shift: (0, 0),
            },
        };
    }

    FontProvider {
        r#type: FontProviderType::Ttf,
        data: FontProviderData::Ttf {
            skipped: std::collections::HashSet::new(),
            cache: std::collections::HashMap::new(),
            bytes: bytes.to_vec(),
            size,
            oversample: over,
            shift,
        },
    }
}

/// Load font sets (default and alt) from asset packs.
/// This mirrors the JS `loadFontSets` async function.
/// In this Rust port we provide the scaffolding; the actual pack/source iteration
/// depends on the GRAVRUST `Assets` object structure.
pub async fn load_font_sets(assets: &wasm_bindgen::JsValue) -> std::collections::HashMap<String, FontSet> {
    let mut result: std::collections::HashMap<String, FontSet> = std::collections::HashMap::new();

    for name in &["default", "alt"] {
        let path = format!("font/{}.json", name);

        // In the full JS implementation:
        //   const path = 'font/' + name + '.json';
        //   const definitions = [];
        //   for (const pack of assets.packs) if (pack.has(path)) try {
        //     definitions.push(JSON.parse(decodeUtf8(pack.read(path))));
        //   } catch (e) { console.warn('Bad font definition', pack.id, path); }
        //   const base = await assets.source.bytes('minecraft/' + path);
        //   if (base) definitions.push(JSON.parse(decodeUtf8(base)));
        //
        //   const providers = [];
        //   for (const definition of definitions)
        //     for (const def of definition.providers || [])
        //       try {
        //         const key = 'font:' + name + ':' + providers.length;
        //         if (def.type === 'bitmap') {
        //           const b = await fontBytes(assets, location(def.file, 'textures/'));
        //           if (b) providers.push(bitmapProvider(assets, def, decodePng(b), key));
        //         } else if (def.type === 'legacy_unicode') {
        //           const b = await fontBytes(assets, location(def.sizes));
        //           if (b) providers.push(legacyProvider(assets, def, b));
        //         } else if (def.type === 'ttf') {
        //           const b = await fontBytes(assets, location(def.file, 'font/'));
        //           if (b) providers.push(trueTypeProvider(assets, def, b, key));
        //         } else {
        //           console.warn('Unsupported font provider', def.type);
        //         }
        //       } catch (e) { console.warn('Bad font provider', name, e.message); }
        //
        //   if (providers.length) result[name] = new FontSet(assets, providers);

        // Stub: no definitions loaded yet - the full implementation must plug
        // into the host's `assets` object (packs, source, textures, etc.).
        let _ = (path, assets); // suppress unused warning
    }

    result
}

// The items above are already defined in this module, so no `pub use`
// re-export block is needed here. Such a block re-imports each name into the
// module that defines it, which Rust rejects as a duplicate definition.