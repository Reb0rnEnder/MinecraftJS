//! Port of `client/js/render/iron-golem-cracks.js`.
//!
//! IronGolem.Crackiness.byFraction and CrackinessLayer textures (1.15.2).

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum GolemCrackStage {
    Low,
    Medium,
    High,
}

pub fn golem_crack_stage(health: f32, max_health: f32) -> Option<GolemCrackStage> {
    if max_health <= 0.0 {
        return None;
    }
    let fraction = health / max_health;
    if fraction < 0.25 {
        Some(GolemCrackStage::High)
    } else if fraction < 0.5 {
        Some(GolemCrackStage::Medium)
    } else if fraction < 0.75 {
        Some(GolemCrackStage::Low)
    } else {
        None
    }
}

pub fn golem_crack_texture(health: f32, max_health: f32) -> Option<&'static str> {
    match golem_crack_stage(health, max_health) {
        Some(GolemCrackStage::High) => Some("entity/iron_golem/iron_golem_crackiness_high.png"),
        Some(GolemCrackStage::Medium) => Some("entity/iron_golem/iron_golem_crackiness_medium.png"),
        Some(GolemCrackStage::Low) => Some("entity/iron_golem/iron_golem_crackiness_low.png"),
        None => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_golem_crack_stages() {
        assert_eq!(golem_crack_stage(100.0, 100.0), None);
        assert_eq!(golem_crack_stage(74.0, 100.0), Some(GolemCrackStage::Low));
        assert_eq!(golem_crack_stage(49.0, 100.0), Some(GolemCrackStage::Medium));
        assert_eq!(golem_crack_stage(24.0, 100.0), Some(GolemCrackStage::High));
    }

    #[test]
    fn test_golem_crack_texture() {
        assert_eq!(golem_crack_texture(10.0, 100.0), Some("entity/iron_golem/iron_golem_crackiness_high.png"));
        assert_eq!(golem_crack_texture(90.0, 100.0), None);
    }
}
