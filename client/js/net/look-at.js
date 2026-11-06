export function readLookAt(r){
  const anchor=()=>{const n=r.varint();if(n!==0&&n!==1)throw Error('Invalid entity anchor');return n;};
  const p={name:'face_player',fromAnchor:anchor(),x:r.f64(),y:r.f64(),z:r.f64(),isEntity:r.bool()};
  if(p.isEntity){p.entityId=r.varint();p.toAnchor=anchor();}
  return p;
}
