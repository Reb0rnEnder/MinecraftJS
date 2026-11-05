// Persistent nearest-first heap. Dirtiness removals are lazy; additions enter the
// active heap immediately. Re-anchor after camera section/range changes, not after
// every completed mesh. Priority within a camera section is scheduling only.
export class MeshBuildQueue {
  constructor(dirty, x, y, z, radius) {
    this.dirty=dirty;this.x=x;this.y=y;this.z=z;this.radius=radius;
    this.cx=Math.floor(x);this.cz=Math.floor(z);
    this.anchor=[Math.floor(x),Math.floor(y),Math.floor(z)];
    this.heap=[];this.queued=new Set();
    for(const entry of dirty.within(this.cx,this.cz,radius)){
      const [key,cx,sy,cz]=entry,dx=cx+.5-x,dy=sy+.5-y,dz=cz+.5-z;
      this.heap.push([dx*dx+dy*dy*.5+dz*dz,entry]);this.queued.add(key);
    }
    // Heapify a fresh range in linear time; individual changes stay logarithmic.
    for(let i=(this.heap.length>>1)-1;i>=0;i--)this.siftDown(i,this.heap[i]);
  }
  matches(x,y,z,radius){return this.radius===radius&&this.anchor[0]===Math.floor(x)&&this.anchor[1]===Math.floor(y)&&this.anchor[2]===Math.floor(z);}
  add(entry){
    const [key,cx,sy,cz]=entry;
    if(this.queued.has(key)||Math.abs(cx-this.cx)>this.radius||Math.abs(cz-this.cz)>this.radius)return;
    const dx=cx+.5-this.x,dy=sy+.5-this.y,dz=cz+.5-this.z,item=[dx*dx+dy*dy*.5+dz*dz,entry];
    this.queued.add(key);let i=this.heap.length;this.heap.push(item);
    while(i){const p=(i-1)>>1;if(this.heap[p][0]<=item[0])break;this.heap[i]=this.heap[p];i=p;}this.heap[i]=item;
  }
  siftDown(i,item){
    while(i*2+1<this.heap.length){let c=i*2+1;if(c+1<this.heap.length&&this.heap[c+1][0]<this.heap[c][0])c++;if(this.heap[c][0]>=item[0])break;this.heap[i]=this.heap[c];i=c;}this.heap[i]=item;
  }
  pop(){
    while(this.heap.length){
      const top=this.heap[0],tail=this.heap.pop();
      if(this.heap.length)this.siftDown(0,tail);
      this.queued.delete(top[1][0]);if(this.dirty.has(top[1][0]))return top[1];
    }
    return null;
  }
}
