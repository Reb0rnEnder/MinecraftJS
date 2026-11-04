// Registry names are native: silver through 1.12, light_gray from 1.13.
export const isShulkerBox=name=>name==='shulker_box'||name.endsWith('_shulker_box');
export function shulkerTexture(name){return 'entity/shulker/shulker'+(name==='shulker_box'?'':'_'+name.slice(0,-'_shulker_box'.length))+'.png';}
