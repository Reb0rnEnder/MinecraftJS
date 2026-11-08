//! Port of `client/js/audio/client-sound-triggers.js`.
//!
//! Native collection-packet and locally activated block sounds (buttons, comparators, XP/item pickups).

#[derive(Debug, Clone, PartialEq)]
pub struct SoundTriggerEvent {
    pub sound_id: &'static str,
    pub volume: f32,
    pub pitch: f32,
    pub category: &'static str,
}

pub fn get_pickup_sound(is_xp_orb: bool, rand_a: f32, rand_b: f32) -> SoundTriggerEvent {
    if is_xp_orb {
        let volume = 0.1;
        let pitch = (rand_a - rand_b) * 0.35 + 0.9;
        SoundTriggerEvent {
            sound_id: "entity.experience_orb.pickup",
            volume,
            pitch,
            category: "player",
        }
    } else {
        let volume = 0.2;
        let pitch = (rand_a - rand_b) * 1.4 + 2.0;
        SoundTriggerEvent {
            sound_id: "entity.item.pickup",
            volume,
            pitch,
            category: "player",
        }
    }
}

pub fn get_activated_block_sound(block_name: &str, is_powered: bool, is_subtract: bool) -> Option<SoundTriggerEvent> {
    if block_name == "stone_button" || block_name == "polished_blackstone_button" {
        if is_powered {
            return None;
        }
        Some(SoundTriggerEvent {
            sound_id: "block.stone_button.click_on",
            volume: 0.3,
            pitch: 0.6,
            category: "block",
        })
    } else if block_name == "wooden_button" || block_name.ends_with("_button") {
        if is_powered {
            return None;
        }
        Some(SoundTriggerEvent {
            sound_id: "block.wooden_button.click_on",
            volume: 0.3,
            pitch: 0.6,
            category: "block",
        })
    } else if block_name == "comparator" || block_name == "unpowered_comparator" || block_name == "powered_comparator" {
        Some(SoundTriggerEvent {
            sound_id: "block.comparator.click",
            volume: 0.3,
            pitch: if is_subtract { 0.5 } else { 0.55 },
            category: "block",
        })
    } else {
        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_pickup_sound() {
        let xp = get_pickup_sound(true, 0.5, 0.5);
        assert_eq!(xp.sound_id, "entity.experience_orb.pickup");
        assert_eq!(xp.volume, 0.1);

        let item = get_pickup_sound(false, 0.5, 0.5);
        assert_eq!(item.sound_id, "entity.item.pickup");
        assert_eq!(item.volume, 0.2);
    }

    #[test]
    fn test_button_sound() {
        let stone = get_activated_block_sound("stone_button", false, false);
        assert!(stone.is_some());
        assert_eq!(stone.unwrap().sound_id, "block.stone_button.click_on");

        let wood = get_activated_block_sound("oak_button", false, false);
        assert!(wood.is_some());
        assert_eq!(wood.unwrap().sound_id, "block.wooden_button.click_on");

        let already_powered = get_activated_block_sound("stone_button", true, false);
        assert!(already_powered.is_none());
    }
}
