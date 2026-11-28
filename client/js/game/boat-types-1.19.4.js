// 26.3 registers each wood as its own boat/raft entity type; there is no
// Boat.Type metadata index any more. The list is the texture/model wood set.
export const BOAT_TYPES = [
  'oak', 'spruce', 'birch', 'jungle', 'acacia', 'cherry', 'dark_oak',
  'pale_oak', 'mangrove', 'poplar', 'bamboo'
];

export function boatWoodFor(entityName = '') {
  const name = String(entityName).replace(/^minecraft:/, '');
  const match = name.match(/^(.+?)_chest_(?:boat|raft)$/) || name.match(/^(.+?)_(?:boat|raft)$/);
  return match && BOAT_TYPES.includes(match[1]) ? match[1] : 'oak';
}
