// Reuse a completed visibility walk/sort only when every geometric input and
// the chunk/mesh revision is identical. Moving entities do not change this graph.
export class VisibilityCache{
 constructor(){this.inputs=null;this.revision=-1;this.stats={walks:0,hits:0,sorts:0};}
 invalidate(){this.inputs=null;}
 get(inputs,revision,build){if(this.inputs&&revision===this.revision&&inputs.length===this.inputs.length&&inputs.every((v,i)=>Object.is(v,this.inputs[i]))){this.stats.hits++;return this.list;}this.inputs=null;const list=build();this.inputs=Float64Array.from(inputs);this.revision=revision;this.list=list;this.stats.walks++;this.stats.sorts++;return this.list;}
}
