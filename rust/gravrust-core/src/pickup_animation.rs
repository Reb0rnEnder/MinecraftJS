//! Port of `client/js/game/pickup-animation.js` (upstream MinecraftJS 1.8.9).
//!
//! Native hotbar set-slot packets animate a newly filled/increased stack, not
//! every matching stack mentioned by an item-entity collection packet.

/// One inventory stack (only the fields this module reads/writes).
#[derive(Debug, Clone, Copy, Default, PartialEq)]
pub struct Stack {
    pub count: i64,
    /// JS: `item.popTime` (undefined when unset; 0 behaves the same here).
    pub pop_time: i64,
}

/// JS: `inventory` surface: `{ main: [...], armor: [...], offhand }`.
#[derive(Debug, Clone, Default)]
pub struct Inventory {
    pub main: Vec<Stack>,
    pub armor: Vec<Stack>,
    pub offhand: Option<Stack>,
}

/// JS: `markHotbarPickup(previous, item)` — sets `popTime = 5` only when the
/// stack is new or grew (a set-slot animation, not a collection echo).
pub fn mark_hotbar_pickup(previous: Option<&Stack>, item: &mut Stack) {
    if item.count > 0 && previous.map_or(true, |p| p.count < item.count) {
        item.pop_time = 5;
    }
}

/// JS: `tickPickupAnimations(inventory)` — decrements `popTime` on every
/// stack in main + armor + offhand.
pub fn tick_pickup_animations(inventory: &mut Inventory) {
    for item in inventory.main.iter_mut().chain(inventory.armor.iter_mut()) {
        if item.pop_time > 0 {
            item.pop_time -= 1;
        }
    }
    if let Some(off) = inventory.offhand.as_mut() {
        if off.pop_time > 0 {
            off.pop_time -= 1;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn pop_time_set_only_on_new_or_grown_stack() {
        let mut item = Stack { count: 3, pop_time: 0 };
        mark_hotbar_pickup(None, &mut item); // new stack
        assert_eq!(item.pop_time, 5);
        let prev = Stack { count: 3, pop_time: 0 };
        mark_hotbar_pickup(Some(&prev), &mut item); // same count: no animation
        assert_eq!(item.pop_time, 5); // unchanged (already 5, but not re-set)
        let mut grown = Stack { count: 5, pop_time: 0 };
        mark_hotbar_pickup(Some(&prev), &mut grown);
        assert_eq!(grown.pop_time, 5);
        let mut empty = Stack { count: 0, pop_time: 0 };
        mark_hotbar_pickup(None, &mut empty);
        assert_eq!(empty.pop_time, 0); // count <= 0 never animates
    }

    #[test]
    fn tick_decrements_all_slots() {
        let mut inv = Inventory {
            main: vec![Stack { count: 1, pop_time: 2 }, Stack { count: 1, pop_time: 0 }],
            armor: vec![Stack { count: 1, pop_time: 1 }],
            offhand: Some(Stack { count: 1, pop_time: 3 }),
        };
        tick_pickup_animations(&mut inv);
        assert_eq!(inv.main[0].pop_time, 1);
        assert_eq!(inv.main[1].pop_time, 0);
        assert_eq!(inv.armor[0].pop_time, 0);
        assert_eq!(inv.offhand.as_ref().unwrap().pop_time, 2);
    }
}
