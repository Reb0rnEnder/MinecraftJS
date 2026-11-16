export function bookshelfSlot762(target,facing){
  const face={north:2,south:3,west:4,east:5}[facing];if(face===undefined||target.face!==face)return -1;
  const x=target.hit[0]-target.x,y=Math.fround(target.hit[1]-target.y),z=target.hit[2]-target.z;
  const u=Math.fround(face===2?1-x:face===3?x:face===4?z:1-z);
  return(u<.375?0:u<.6875?1:2)+(y>=.5?0:3);
}
// The 1.19.4 update_1_20 prototype uses one block-use method for both
// hands. Its tag has four book types, without the later knowledge-book entry.
const DEFAULT_BOOKS_762=['book','written_book','enchanted_book','writable_book'];
export const bookshelfEnabled762=game=>!!game.enabledFeatures?.has('minecraft:update_1_20');
export function bookshelfUse762(game,target,properties,held){
  const slot=bookshelfSlot762(target,properties.facing);if(slot<0)return null;
  const occupied=properties['slot_'+slot+'_occupied']==='true';
  const book=!!held&&(game.tags?game.tags.contains('items','minecraft:bookshelf_books',held.id):DEFAULT_BOOKS_762.includes(game.items.name(held.id)));
  return occupied||book?true:'consume';
}
