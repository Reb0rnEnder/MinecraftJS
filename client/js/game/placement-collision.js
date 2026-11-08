// A block's broad registry category is not its collision shape. Touching a face
// is allowed; strict overlap with any occupied shape box blocks placement.
export function placementIntersects(boxes,pos,entityBox){
 return boxes.some(b=>entityBox[3]>pos.x+b[0]&&entityBox[0]<pos.x+b[3]&&entityBox[4]>pos.y+b[1]&&entityBox[1]<pos.y+b[4]&&entityBox[5]>pos.z+b[2]&&entityBox[2]<pos.z+b[5]);
}
