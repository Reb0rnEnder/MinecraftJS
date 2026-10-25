// DefaultPack reads externally indexed resources before the copy left in the jar.
async function readDefaultAsset(jar,index,rel) {
  if(index?.objects?.[rel])return index.read(rel);
  const bytes=jar.read('assets/'+rel);
  return bytes||null;
}
function indexedClientAssets(index) {
  return Object.keys(index.objects).filter(name=>name.startsWith('minecraft/')&&!name.startsWith('minecraft/resourcepacks/'));
}
function builtAssetsMatch(manifest,version,jarSha1,indexId) {
 return manifest?.layoutVersion===2&&manifest.minecraftVersion===version&&manifest.clientJarSha1===jarSha1&&manifest.assetIndex===indexId;
}
module.exports={readDefaultAsset,indexedClientAssets,builtAssetsMatch};
