import { DEFAULT_TAGS } from './default-tags.js';
export class RegistryTags {
  constructor(tags=DEFAULT_TAGS) { this.replace(tags); }
  replace(tags) {
    this.registries={};this.byEntry={};
    for(const kind of ['blocks','items','fluids','entities']) {
      const entries=new Map(Object.entries(tags[kind]||{})),index=new Map();
      for(const [name,ids] of entries)for(const id of ids){if(!index.has(id))index.set(id,[]);index.get(id).push(name);}
      for(const names of index.values())names.sort();
      this.registries[kind]=entries;this.byEntry[kind]=index;
    }
  }
  names(kind) { return [...(this.registries[kind]?.keys()||[])].sort(); }
  forEntry(kind,id) { return this.byEntry[kind]?.get(id)||[]; }
  contains(kind,name,id) { return this.registries[kind]?.get(name)?.includes(id)||false; }
}
