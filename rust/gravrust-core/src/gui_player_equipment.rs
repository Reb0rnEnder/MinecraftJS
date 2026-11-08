//! Port of `client/js/render/gui-player-equipment.js`.
//!
//! InventoryScreen equipment layers and GUI hand poses. Keeps a separate
//! visual representation so GUI lighting and inventory animations never
//! mutate the in-world player model or matrices.

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum HandPoseKind {
    Empty,
    Item,
}

#[derive(Debug, Clone, PartialEq)]
pub struct GuiHandPoses {
    pub held_right: bool,
    pub held_left: bool,
    pub right_pose: HandPoseKind,
    pub left_pose: HandPoseKind,
}

/// Evaluates first-person and GUI inventory hand poses based on handedness and held items.
pub fn gui_hand_poses(has_main: bool, has_off: bool, left_handed: bool) -> GuiHandPoses {
    let (right_item, left_item) = if left_handed {
        (has_off, has_main)
    } else {
        (has_main, has_off)
    };

    GuiHandPoses {
        held_right: right_item,
        held_left: left_item,
        right_pose: if right_item { HandPoseKind::Item } else { HandPoseKind::Empty },
        left_pose: if left_item { HandPoseKind::Item } else { HandPoseKind::Empty },
    }
}

/// State container for rendering player equipment in inventory menus.
#[derive(Debug, Clone, PartialEq)]
pub struct GuiEquipmentModel {
    pub scale: [f32; 3],
    pub full_bright: bool,
    pub inventory_lighting: bool,
    pub alpha_test: f32,
}

impl Default for GuiEquipmentModel {
    fn default() -> Self {
        Self {
            scale: [16.0, 16.0, 16.0],
            full_bright: true,
            inventory_lighting: true,
            alpha_test: 0.1,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_gui_hand_poses_right_handed() {
        let poses = gui_hand_poses(true, false, false);
        assert!(poses.held_right);
        assert!(!poses.held_left);
        assert_eq!(poses.right_pose, HandPoseKind::Item);
        assert_eq!(poses.left_pose, HandPoseKind::Empty);
    }

    #[test]
    fn test_gui_hand_poses_left_handed() {
        let poses = gui_hand_poses(true, false, true);
        assert!(!poses.held_right);
        assert!(poses.held_left);
        assert_eq!(poses.right_pose, HandPoseKind::Empty);
        assert_eq!(poses.left_pose, HandPoseKind::Item);
    }

    #[test]
    fn test_gui_hand_poses_empty() {
        let poses = gui_hand_poses(false, false, false);
        assert!(!poses.held_right);
        assert!(!poses.held_left);
        assert_eq!(poses.right_pose, HandPoseKind::Empty);
        assert_eq!(poses.left_pose, HandPoseKind::Empty);
    }
}
