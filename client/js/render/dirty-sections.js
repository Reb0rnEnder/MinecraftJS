import {MeshBuildQueue} from './mesh-build-queue.js';
// Pending mesh dirtiness retains Set semantics, with a column index for the
// active camera range. Server-sent terrain outside that range is kept pending
// without scanning or parsing it on every rendered frame.
export class DirtySections extends Set {
  constructor(keys) {
    super();
    this.columns = new Map();
    this.range = null;
    if (keys) for (const key of keys) this.add(key);
  }
  _invalidate(cx, cz) {
    const r = this.range;
    if (r && Math.abs(cx-r.cx)<=r.radius && Math.abs(cz-r.cz)<=r.radius) this.range = null;
  }
  add(key) {
    if (this.has(key)) return this;
    const [cx,sy,cz] = key.split(',').map(Number);
    let zs = this.columns.get(cx);
    if (!zs) this.columns.set(cx, zs = new Map());
    let column = zs.get(cz);
    if (!column) zs.set(cz, column = new Map());
    const entry=[key,cx,sy,cz];
    column.set(key, entry);
    this.priority?.add(entry);
    super.add(key);
    this._invalidate(cx,cz);
    return this;
  }
  delete(key) {
    if (!super.delete(key)) return false;
    const [cx,,cz] = key.split(',').map(Number),zs=this.columns.get(cx),column=zs.get(cz);
    column.delete(key);
    if (!column.size) zs.delete(cz);
    if (!zs.size) this.columns.delete(cx);
    this._invalidate(cx,cz);
    return true;
  }
  clear() {
    super.clear();
    this.columns.clear();
    this.range = null;
    this.priority = null;
  }
  prioritized(x,y,z,radius){
    if(!this.priority?.matches(x,y,z,radius))this.priority=new MeshBuildQueue(this,x,y,z,radius);
    return this.priority;
  }
  within(cx,cz,radius) {
    const r=this.range;
    if (r && r.cx===cx && r.cz===cz && r.radius===radius) return r.entries;
    const entries=[];
    for(let x=cx-radius;x<=cx+radius;x++) {
      const zs=this.columns.get(x);
      if(!zs)continue;
      for(let z=cz-radius;z<=cz+radius;z++) {
        const column=zs.get(z);
        if(column)for(const entry of column.values())entries.push(entry);
      }
    }
    this.range={cx,cz,radius,entries};
    return entries;
  }
}
