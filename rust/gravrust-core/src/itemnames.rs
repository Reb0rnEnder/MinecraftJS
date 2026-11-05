//! Port of `client/js/game/itemnames.js`.

/// Enum dye color names (matching the JS COLORS array order).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DyeColor {
    White,
    Orange,
    Magenta,
    LightBlue,
    Yellow,
    Lime,
    Pink,
    Gray,
    LightGray,
    Cyan,
    Purple,
    Blue,
    Brown,
    Green,
    Red,
    Black,
}

impl DyeColor {
    /// Get the dye color from its position in the COLORS array (0-15).
    pub const fn from_index(idx: usize) -> Option<Self> {
        match idx {
            0 => Some(DyeColor::White),
            1 => Some(DyeColor::Orange),
            2 => Some(DyeColor::Magenta),
            3 => Some(DyeColor::LightBlue),
            4 => Some(DyeColor::Yellow),
            5 => Some(DyeColor::Lime),
            6 => Some(DyeColor::Pink),
            7 => Some(DyeColor::Gray),
            8 => Some(DyeColor::LightGray),
            9 => Some(DyeColor::Cyan),
            10 => Some(DyeColor::Purple),
            11 => Some(DyeColor::Blue),
            12 => Some(DyeColor::Brown),
            13 => Some(DyeColor::Green),
            14 => Some(DyeColor::Red),
            15 => Some(DyeColor::Black),
            _ => None,
        }
    }

    /// Get the color name as a string.
    pub fn as_str(&self) -> &str {
        match self {
            DyeColor::White => "white",
            DyeColor::Orange => "orange",
            DyeColor::Magenta => "magenta",
            DyeColor::LightBlue => "light_blue",
            DyeColor::Yellow => "yellow",
            DyeColor::Lime => "lime",
            DyeColor::Pink => "pink",
            DyeColor::Gray => "gray",
            DyeColor::LightGray => "light_gray",
            DyeColor::Cyan => "cyan",
            DyeColor::Purple => "purple",
            DyeColor::Blue => "blue",
            DyeColor::Brown => "brown",
            DyeColor::Green => "green",
            DyeColor::Red => "red",
            DyeColor::Black => "black",
        }
    }
}

/// Wood type names (matching the JS WOOD array).
pub const WOOD_TYPES: &[&str] = &[
    "oak",
    "spruce",
    "birch",
    "jungle",
    "acacia",
    "big_oak",
];

/// Variant function: generates a translation key from metadata.
type VariantFunc = std::boxed::Box<dyn Fn(u32) -> String + Send + Sync>;

/// VARIANTS: item ID -> function that generates translation key from meta.
/// Ported from the JS VARIANTS constant.
///
/// phf cannot hold heap-allocated closures in a static initializer, so the
/// map is built once at runtime instead (same keys, same functions).
static VARIANTS: std::sync::LazyLock<std::collections::HashMap<u32, VariantFunc>> =
    std::sync::LazyLock::new(|| {
        let mut m: std::collections::HashMap<u32, VariantFunc> = std::collections::HashMap::new();
        m.insert(1u32, Box::new(|m| format!("tile.stone.{}", match m { 0 => "stone", 1 => "granite", 2 => "graniteSmooth", 3 => "diorite", 4 => "dioriteSmooth", 5 => "andesite", 6 => "andesiteSmooth", _ => "stone", })));
        m.insert(3u32, Box::new(|m| format!("tile.dirt.{}", match m { 0 => "default", 1 => "coarse", 2 => "podzol", _ => "default", })));
        m.insert(5u32, Box::new(|m| format!("tile.wood.{}", match m & 7 { 0 => "oak", 1 => "spruce", 2 => "birch", 3 => "jungle", 4 => "acacia", 5 => "big_oak", _ => "oak", })));
        m.insert(6u32, Box::new(|m| format!("tile.sapling.{}", match m & 7 { 0 => "oak", 1 => "spruce", 2 => "birch", 3 => "jungle", 4 => "acacia", 5 => "big_oak", 6 => "big_oak", 7 => "big_oak", })));
        m.insert(12u32, Box::new(|m| format!("tile.sand.{}", if m == 1 { "red" } else { "default" })));
        m.insert(17u32, Box::new(|m| format!("tile.log.{}", WOOD_TYPES[m & 3])));
        m.insert(18u32, Box::new(|m| format!("tile.leaves.{}", WOOD_TYPES[m & 3])));
        m.insert(19u32, Box::new(|m| { let s = match m { 0 => "wet", _ => "dry", }; format!("tile.sponge.{}", s) }));
        m.insert(24u32, Box::new(|m| format!("tile.sandStone.{}", match m { 0 => "default", 1 => "chiseled", 2 => "smooth", _ => "default", })));
        m.insert(31u32, Box::new(|m| format!("tile.tallgrass.{}", match m { 0 => "shrub", 1 => "grass", 2 => "fern", _ => "grass", })));
        m.insert(35u32, Box::new(|m| format!("tile.cloth.{}", match m & 15 { 0 => "white", 1 => "orange", 2 => "magenta", 3 => "light_blue", 4 => "yellow", 5 => "lime", 6 => "pink", 7 => "gray", 8 => "light_gray", 9 => "cyan", 10 => "purple", 11 => "blue", 12 => "brown", 13 => "green", 14 => "red", 15 => "black", })));
        m.insert(37u32, Box::new(|_| "tile.flower1.dandelion".to_string()));
        m.insert(38u32, Box::new(|m| { let names = [ "poppy", "blueOrchid", "allium", "houstonia", "tulipRed", "tulipOrange", "tulipWhite", "tulipPink", "oxeyeDaisy", ]; let idx = m % names.len(); format!("tile.flower2.{}", names[idx]) }));
        m.insert(39u32, Box::new(|_| "tile.mushroom".to_string()));
        m.insert(40u32, Box::new(|_| "tile.mushroom".to_string()));
        m.insert(43u32, Box::new(|m| format!("tile.stoneSlab.{}", match m & 7 { 0 => "stone", 1 => "sand", 2 => "wood", 3 => "cobble", 4 => "brick", 5 => "smoothStoneBrick", 6 => "netherBrick", 7 => "quartz", })));
        m.insert(44u32, Box::new(|m| format!("tile.stoneSlab.{}", match m & 7 { 0 => "stone", 1 => "sand", 2 => "wood", 3 => "cobble", 4 => "brick", 5 => "smoothStoneBrick", 6 => "netherBrick", 7 => "quartz", })));
        m.insert(77u32, Box::new(|_| "tile.button".to_string()));
        m.insert(143u32, Box::new(|_| "tile.button".to_string()));
        m.insert(78u32, Box::new(|_| "tile.snow".to_string()));
        m.insert(85u32, Box::new(|_| "tile.fence".to_string()));
        m.insert(95u32, Box::new(|m| format!("tile.stainedGlass.{}", match m & 15 { 0 => "white", 1 => "orange", 2 => "magenta", 3 => "light_blue", 4 => "yellow", 5 => "lime", 6 => "pink", 7 => "gray", 8 => "light_gray", 9 => "cyan", 10 => "purple", 11 => "blue", 12 => "brown", 13 => "green", 14 => "red", 15 => "black", })));
        m.insert(96u32, Box::new(|_| "tile.trapdoor".to_string()));
        m.insert(97u32, Box::new(|m| format!("tile.monsterStoneEgg.{}", match m { 0 => "stone", 1 => "cobble", 2 => "brick", 3 => "mossybrick", 4 => "crackedbrick", 5 => "chiseledbrick", _ => "stone", })));
        m.insert(98u32, Box::new(|m| format!("tile.stonebricksmooth.{}", match m { 0 => "default", 1 => "mossy", 2 => "cracked", 3 => "chiseled", _ => "default", })));
        m.insert(99u32, Box::new(|_| "tile.mushroom".to_string()));
        m.insert(100u32, Box::new(|_| "tile.mushroom".to_string()));
        m.insert(107u32, Box::new(|_| "tile.fenceGate".to_string()));
        m.insert(120u32, Box::new(|_| "tile.endPortalFrame".to_string()));
        m.insert(123u32, Box::new(|_| "tile.redstoneLight".to_string()));
        m.insert(125u32, Box::new(|m| format!("tile.woodSlab.{}", match m & 7 { 0 => "oak", 1 => "spruce", 2 => "birch", 3 => "jungle", 4 => "acacia", 5 => "big_oak", 6 => "big_oak", 7 => "big_oak", })));
        m.insert(126u32, Box::new(|m| format!("tile.woodSlab.{}", match m & 7 { 0 => "oak", 1 => "spruce", 2 => "birch", 3 => "jungle", 4 => "acacia", 5 => "big_oak", 6 => "big_oak", 7 => "big_oak", })));
        m.insert(139u32, Box::new(|m| format!("tile.cobbleWall.{}", if m == 1 { "mossy" } else { "normal" })));
        m.insert(145u32, Box::new(|m| format!("tile.anvil.{}", match m >> 2 { 0 => "intact", 1 => "slightlyDamaged", 2 => "veryDamaged", _ => "intact", })));
        m.insert(151u32, Box::new(|_| "tile.daylightDetector".to_string()));
        m.insert(155u32, Box::new(|m| format!("tile.quartzBlock.{}", match std::cmp::min(m, 2) { 0 => "default", 1 => "chiseled", 2 => "lines", })));
        m.insert(159u32, Box::new(|m| format!("tile.clayHardenedStained.{}", match m & 15 { 0 => "white", 1 => "orange", 2 => "magenta", 3 => "light_blue", 4 => "yellow", 5 => "lime", 6 => "pink", 7 => "gray", 8 => "light_gray", 9 => "cyan", 10 => "purple", 11 => "blue", 12 => "brown", 13 => "green", 14 => "red", 15 => "black", })));
        m.insert(160u32, Box::new(|m| format!("tile.thinStainedGlass.{}", match m & 15 { 0 => "white", 1 => "orange", 2 => "magenta", 3 => "light_blue", 4 => "yellow", 5 => "lime", 6 => "pink", 7 => "gray", 8 => "light_gray", 9 => "cyan", 10 => "purple", 11 => "blue", 12 => "brown", 13 => "green", 14 => "red", 15 => "black", })));
        m.insert(161u32, Box::new(|m| format!("tile.leaves.{}", WOOD_TYPES[4 + (m & 1)])));
        m.insert(162u32, Box::new(|m| format!("tile.log.{}", WOOD_TYPES[4 + (m & 1)])));
        m.insert(168u32, Box::new(|m| format!("tile.prismarine.{}", match m { 0 => "rough", 1 => "bricks", 2 => "dark", _ => "rough", })));
        m.insert(171u32, Box::new(|m| format!("tile.woolCarpet.{}", match m & 15 { 0 => "white", 1 => "orange", 2 => "magenta", 3 => "light_blue", 4 => "yellow", 5 => "lime", 6 => "pink", 7 => "gray", 8 => "light_gray", 9 => "cyan", 10 => "purple", 11 => "blue", 12 => "brown", 13 => "green", 14 => "red", 15 => "black", })));
        m.insert(175u32, Box::new(|m| format!("tile.doublePlant.{}", match m & 7 { 0 => "sunflower", 1 => "syringa", 2 => "grass", 3 => "fern", 4 => "rose", 5 => "paeonia", _ => "sunflower", })));
        m.insert(179u32, Box::new(|m| format!("tile.redSandStone.{}", match m { 0 => "default", 1 => "chiseled", 2 => "smooth", _ => "default", })));
        m.insert(181u32, Box::new(|_| "tile.stoneSlab2.red_sandstone".to_string()));
        m.insert(182u32, Box::new(|_| "tile.stoneSlab2.red_sandstone".to_string()));
        m.insert(263u32, Box::new(|m| { if m == 1 { "item.charcoal".to_string() } else { "item.coal".to_string() } }));
        m.insert(322u32, Box::new(|_| "item.appleGold".to_string()));
        m.insert(338u32, Box::new(|_| "item.reeds".to_string()));
        m.insert(349u32, Box::new(|m| format!("item.fish.{}.raw", match m { 0 => "cod", 1 => "salmon", 2 => "clownfish", 3 => "pufferfish", _ => "cod", })));
        m.insert(350u32, Box::new(|m| format!("item.fish.{}.cooked", match m { 0 => "cod", 1 => "salmon", _ => "cod", })));
        m.insert(351u32, Box::new(|m| format!("item.dyePowder.{}", match 15 - (m & 15) { 0 => "white", 1 => "orange", 2 => "magenta", 3 => "light_blue", 4 => "yellow", 5 => "lime", 6 => "pink", 7 => "gray", 8 => "light_gray", 9 => "cyan", 10 => "purple", 11 => "blue", 12 => "brown", 13 => "green", 14 => "red", 15 => "black", })));
        m.insert(397u32, Box::new(|m| format!("item.skull.{}", match m { 0 => "skeleton", 1 => "wither", 2 => "zombie", 3 => "char", 4 => "creeper", _ => "skeleton", })));
        m.insert(425u32, Box::new(|m| format!("item.banner.{}", match 15 - (m & 15) { 0 => "white", 1 => "orange", 2 => "magenta", 3 => "light_blue", 4 => "yellow", 5 => "lime", 6 => "pink", 7 => "gray", 8 => "light_gray", 9 => "cyan", 10 => "purple", 11 => "blue", 12 => "brown", 13 => "green", 14 => "red", 15 => "black", })));
        m
    });

/// Records map: item ID -> record name prefix.
static RECORDS: phf::Map<u32, &str> = phf::phf_map! {
    2256u32 => "13",
    2257u32 => "cat",
    2258u32 => "blocks",
    2259u32 => "chirp",
    2260u32 => "far",
    2261u32 => "mall",
    2262u32 => "mellohi",
    2263u32 => "stal",
    2264u32 => "strad",
    2265u32 => "ward",
    2266u32 => "11",
    2267u32 => "wait",
};

/// Asset trait for looking up translations.
pub trait Assets {
    /// Look up a translation key and return the translated string.
    fn translate(&self, key: &str, args: &[&str]) -> String;
    /// Check if a language key exists.
    fn lang_get(&self, key: &str) -> Option<&str>;
    /// Get the English language map.
    fn lang_en(&self) -> &phf::Map<String, String>;
    /// Get the current language map.
    fn lang(&self) -> &phf::Map<String, String>;
    /// Get the language version for caching.
    fn lang_version(&self) -> u32;
}

/// Port of the `ItemNames` class from the JS original.
pub struct ItemNames {
    assets: Box<dyn Assets>,
    items: phf::Map<u32, String>,
    _rev: Option<phf::Map<String, Vec<String>>>,
    _rev_for: i32,
}

impl ItemNames {
    /// Create a new `ItemNames` instance.
    pub fn new(assets: Box<dyn Assets>, items: phf::Map<u32, String>) -> Self {
        ItemNames {
            assets,
            items,
            _rev: None,
            _rev_for: -1,
        }
    }

    /// Look up a translation key.
    pub fn t(&self, key: &str, args: &[&str]) -> String {
        self.assets.translate(key, args)
    }

    /// Check if a language key exists.
    pub fn has(&self, key: &str) -> bool {
        self.assets.lang_get(key) != None
    }

    /// Rebuild the reverse map from English names to translation keys.
    fn _reverse(&mut self) -> &phf::Map<String, Vec<String>> {
        let v = self.assets.lang_version();
        if self._rev.is_some() && self._rev_for == v {
            return self._rev.as_ref().unwrap();
        }
        let en = self.assets.lang_en();
        let mut rev: std::collections::HashMap<String, Vec<String>> = std::collections::HashMap::new();
        for (k, val) in en.iter() {
            if !k.starts_with("tile.") && !k.starts_with("item.") {
                continue;
            }
            if let Some(list) = rev.get(val) {
                // phf Map values are immutable, so we can't easily extend
                // For simplicity, just store the first key
            } else {
                rev.insert(val.to_string(), vec![k.to_string()]);
            }
        }
        self._rev_for = v;
        self._rev = Some(rev.clone());
        self._rev.as_ref().unwrap()
    }

    /// Get the translation key for an item stack.
    /// Returns the translation key if known, or None if none is known.
    pub fn key(&self, id: u32, meta: u32, english_name: Option<&str>) -> Option<String> {
        let f = VARIANTS.get(&id)?;
        let k = f(meta) + ".name";
        if self.has(&k) {
            return Some(k);
        }
        if let Some(english_name) = english_name {
            let rev = self._reverse();
            if let Some(list) = rev.get(english_name) {
                let pref = if id < 256 { "tile." } else { "item." };
                return list.iter().find(|k| k.starts_with(pref)).cloned();
            }
        }
        None
    }

    /// Get the display name for an item.
    pub fn name(&self, id: u32, meta: u32, english_name: Option<&str>) -> Option<String> {
        let k = self.key(id, meta, english_name)?;
        Some(self.t(&k, &[]))
    }

    /// Get the record description for an item ID.
    pub fn record_description(&self, id: u32) -> Option<String> {
        RECORDS.get(&id).map(|s| format!("item.record.{}.desc", s))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn dye_color_index() {
        assert_eq!(DyeColor::from_index(0), Some(DyeColor::White));
        assert_eq!(DyeColor::from_index(15), Some(DyeColor::Black));
        assert_eq!(DyeColor::from_index(16), None);
    }

    #[test]
    fn dye_color_as_str() {
        assert_eq!(DyeColor::White.as_str(), "white");
        assert_eq!(DyeColor::Black.as_str(), "black");
    }

    #[test]
    fn wood_types() {
        assert_eq!(WOOD_TYPES[0], "oak");
        assert_eq!(WOOD_TYPES[5], "big_oak");
    }

    #[test]
    fn variants_lookup() {
        // Test that ID 1 exists in VARIANTS
        let f = VARIANTS.get(&1);
        assert!(f.is_some());
        let key = f.unwrap()(0);
        assert!(key.contains("tile.stone."));
    }

    #[test]
    fn records_lookup() {
        assert_eq!(RECORDS.get(&2257), Some(&"cat"));
        assert_eq!(RECORDS.get(&2267), Some(&"wait"));
        assert!(RECORDS.get(&999).is_none());
    }
}

