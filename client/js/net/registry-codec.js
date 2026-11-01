// ResourceLocation.CODEC defaults an omitted or empty namespace to minecraft.
// Keep custom namespaces distinct; do not infer a registry from a matching suffix.
export function registryEntries(codec, name) {
 const qualified=name.includes(':')?name:'minecraft:'+name;
 let registry=codec?.[qualified];
 if(registry==null&&qualified.startsWith('minecraft:')) {
  const path=qualified.slice(10);
  registry=codec?.[path]??codec?.[':'+path];
 }
 return registry?.value||[];
}
