//! Port of `client/js/render/villager-layers.js`.
//!
//! Generates texture layer paths for vanilla 1.14+ villagers and zombie villagers,
//! taking into account biome type, profession, profession level badge, and hat visibility.

use crate::villager_data::{VILLAGER_HATS, VILLAGER_PROFESSIONS, VILLAGER_TYPES};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct VillagerLayer {
    pub texture: String,
    pub hide_hat: bool,
}

/// Computes the layered textures for a villager or zombie villager.
pub fn villager_layers(
    villager_zombie: bool,
    villager_type: usize,
    profession: usize,
    level: i32,
    child: bool,
) -> Vec<VillagerLayer> {
    let dir = if villager_zombie {
        "zombie_villager"
    } else {
        "villager"
    };

    let type_name = VILLAGER_TYPES.get(villager_type).copied().unwrap_or("plains");
    let prof_name = VILLAGER_PROFESSIONS.get(profession).copied().unwrap_or("none");

    let type_texture = format!("entity/{dir}/type/{type_name}.png");
    let profession_texture = format!("entity/{dir}/profession/{prof_name}.png");

    let hat = VILLAGER_HATS
        .iter()
        .find(|(k, _)| *k == profession_texture)
        .map(|(_, v)| *v)
        .unwrap_or("none");

    let type_hat = VILLAGER_HATS
        .iter()
        .find(|(k, _)| *k == type_texture)
        .map(|(_, v)| *v)
        .unwrap_or("none");

    let hide_hat = hat == "full" || (hat == "partial" && type_hat == "full");

    let mut layers = vec![VillagerLayer {
        texture: type_texture,
        hide_hat,
    }];

    if prof_name != "none" && !child {
        layers.push(VillagerLayer {
            texture: profession_texture,
            hide_hat: false,
        });

        let levels = ["stone", "iron", "gold", "emerald", "diamond"];
        let lvl_idx = (level - 1).clamp(0, 4) as usize;
        let badge_name = levels[lvl_idx];
        layers.push(VillagerLayer {
            texture: format!("entity/{dir}/profession_level/{badge_name}.png"),
            hide_hat: false,
        });
    }

    layers
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_plains_farmer_villager() {
        // type 2 is plains, profession 5 is farmer
        let layers = villager_layers(false, 2, 5, 1, false);
        assert_eq!(layers.len(), 3);
        assert_eq!(layers[0].texture, "entity/villager/type/plains.png");
        assert!(layers[0].hide_hat); // farmer hat is "full"
        assert_eq!(layers[1].texture, "entity/villager/profession/farmer.png");
        assert_eq!(layers[2].texture, "entity/villager/profession_level/stone.png");
    }

    #[test]
    fn test_child_villager_has_no_profession_layer() {
        let layers = villager_layers(false, 0, 1, 1, true);
        assert_eq!(layers.len(), 1);
        assert_eq!(layers[0].texture, "entity/villager/type/desert.png");
    }
}
