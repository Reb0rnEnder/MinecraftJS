import{DYE_TEXTURE_COLORS}from'./dye-colors.js';
// Native WolfCollarLayer: old dye-damage IDs are distinct from flattened dye IDs.
export function wolfCollarColor(e){const raw=e.collar??14;return DYE_TEXTURE_COLORS[raw>=0&&raw<16?raw:0];}
export function updateWolfCollar(e,layer){layer.obj.visible=!!e.tamed&&!e.invisible;layer.mat.params.setTint(...wolfCollarColor(e),1);}
// Native pre-1.20.5 tail rule uses an absolute health deficit; 1.20.6 uses a ratio.
export function wolfTailAngle(e){const f=Math.fround;if(e.angry)return f(1.5393804);if(!e.tamed)return f(.62831855);const max=f(e.maxHealth??20),health=f(e.wolfHealth??max);return f(f(f(.55)-f(f(max-health)*f(.02)))*f(Math.PI));}
