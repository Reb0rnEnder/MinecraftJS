//! Port of `client/js/asset-source.js`.
//!
//! Asset resolution layer: supports both standalone HTTP folder hosting (`assets/`)
//! and embedded zip bundles (for single-file offline HTML builds).

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum AssetSourceKind {
    Folder,
    Embedded,
}

#[derive(Debug, Clone)]
pub struct FolderSource {
    pub base: String,
}

impl Default for FolderSource {
    fn default() -> Self {
        Self {
            base: "assets/".to_string(),
        }
    }
}

impl FolderSource {
    pub fn new(base: &str) -> Self {
        Self {
            base: base.to_string(),
        }
    }

    /// Appends the native asset version query string.
    pub fn url(&self, rel: &str) -> String {
        format!("{}{}{}", self.base, rel, "?v=1.15.2-native-v1")
    }

    pub fn data_url(&self, name: &str) -> String {
        format!("data/{}.json", name)
    }

    pub fn models_url(&self) -> String {
        self.url("bundles/models.json")
    }

    pub fn recipes_url(&self) -> String {
        self.url("bundles/recipes.json")
    }

    pub fn entity_models_url(&self) -> String {
        self.url("bundles/entity-models.json")
    }

    pub fn textures_bin_url(&self) -> String {
        self.url("bundles/textures.bin")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_folder_source_urls() {
        let src = FolderSource::default();
        assert_eq!(src.url("pack.png"), "assets/pack.png?v=1.15.2-native-v1");
        assert_eq!(src.data_url("blocks"), "data/blocks.json");
    }
}
