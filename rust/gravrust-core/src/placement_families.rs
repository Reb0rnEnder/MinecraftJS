//! Port of `client/js/game/placement-families.js`.
//!
//! Placement family rules: classified from native canSurvive ownership
//! (plates, rails, carpets, hanging roots, spore blossoms, bushes).

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PlacementRuleKind {
    Plate,
    Rail,
    Carpet,
    HangingRoots,
    SporeBlossom,
    Bush,
    DoubleBush,
}

pub fn get_placement_rule(block_name: &str) -> Option<PlacementRuleKind> {
    if block_name.ends_with("_pressure_plate") {
        Some(PlacementRuleKind::Plate)
    } else if block_name.ends_with("_rail") || block_name == "rail" {
        Some(PlacementRuleKind::Rail)
    } else if block_name.ends_with("_carpet") {
        Some(PlacementRuleKind::Carpet)
    } else if block_name == "hanging_roots" {
        Some(PlacementRuleKind::HangingRoots)
    } else if block_name == "spore_blossom" {
        Some(PlacementRuleKind::SporeBlossom)
    } else if block_name.ends_with("_bush") || block_name == "fern" || block_name == "grass" {
        Some(PlacementRuleKind::Bush)
    } else {
        None
    }
}

pub fn can_survive(
    kind: PlacementRuleKind,
    below_solid: bool,
    below_is_air: bool,
    above_solid: bool,
    is_water: bool,
) -> bool {
    match kind {
        PlacementRuleKind::Plate => below_solid,
        PlacementRuleKind::Rail => below_solid,
        PlacementRuleKind::Carpet => !below_is_air,
        PlacementRuleKind::HangingRoots => above_solid,
        PlacementRuleKind::SporeBlossom => above_solid && !is_water,
        PlacementRuleKind::Bush | PlacementRuleKind::DoubleBush => below_solid,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_placement_rule_lookup() {
        assert_eq!(get_placement_rule("stone_pressure_plate"), Some(PlacementRuleKind::Plate));
        assert_eq!(get_placement_rule("powered_rail"), Some(PlacementRuleKind::Rail));
        assert_eq!(get_placement_rule("red_carpet"), Some(PlacementRuleKind::Carpet));
        assert_eq!(get_placement_rule("diamond_block"), None);
    }

    #[test]
    fn test_can_survive_rules() {
        assert!(can_survive(PlacementRuleKind::Plate, true, false, false, false));
        assert!(!can_survive(PlacementRuleKind::Plate, false, true, false, false));
        assert!(can_survive(PlacementRuleKind::Carpet, false, false, false, false));
        assert!(!can_survive(PlacementRuleKind::Carpet, false, true, false, false));
    }
}
