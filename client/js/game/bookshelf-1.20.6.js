import{DEFAULT_TAGS}from'./default-tags.js';
export function bookshelfSlot766(target,facing){
  const face={north:2,south:3,west:4,east:5}[facing];if(face===undefined||target.face!==face)return -1;
  const x=target.hit[0]-target.x,y=Math.fround(target.hit[1]-target.y),z=target.hit[2]-target.z;
  const u=Math.fround(face===2?1-x:face===3?x:face===4?z:1-z);
  return(u<.375?0:u<.6875?1:2)+(y>=.5?0:3);
}
// null means continue normal use/placement. Occupancy, inventory and feedback
// are server-owned: ChiseledBookShelfBlock's client add/remove helpers do nothing.
export function bookshelfUse766(game,target,properties,held,hand=0){
  const slot=bookshelfSlot766(target,properties.facing);if(slot<0)return null;
  const occupied=properties['slot_'+slot+'_occupied']==='true';
  const book=!!held&&(game.tags?game.tags.contains('items','minecraft:bookshelf_books',held.id):(DEFAULT_TAGS.items['minecraft:bookshelf_books']||[]).includes(held.id));
  if(book&&!occupied)return true;
  if(hand!==0)return null; // default block interaction only runs for the main hand
  return occupied?true:'consume';
}
