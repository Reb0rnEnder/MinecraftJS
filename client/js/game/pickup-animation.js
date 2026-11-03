// Native hotbar set-slot packets animate a newly filled/increased stack, not
// every matching stack mentioned by an item-entity collection packet.
export function markHotbarPickup(previous,item){if(item&&item.count>0&&(!previous||previous.count<item.count))item.popTime=5;}
export function tickPickupAnimations(inventory){for(const item of[...inventory.main,...inventory.armor,inventory.offhand])if(item?.popTime>0)item.popTime--;}
