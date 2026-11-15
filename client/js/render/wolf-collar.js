const DYE_TEXTURE_COLORS=[[1, 1, 1], [0.85, 0.5, 0.2], [0.7, 0.3, 0.85], [0.4, 0.6, 0.85], [0.9, 0.9, 0.2], [0.5, 0.8, 0.1], [0.95, 0.5, 0.65], [0.3, 0.3, 0.3], [0.6, 0.6, 0.6], [0.3, 0.5, 0.6], [0.5, 0.25, 0.7], [0.2, 0.3, 0.7], [0.4, 0.3, 0.2], [0.4, 0.5, 0.2], [0.6, 0.2, 0.2], [0.1, 0.1, 0.1]];
// Native WolfCollarLayer: old dye-damage IDs are distinct from flattened dye IDs.
export function wolfCollarColor(e){const raw=e.collar??14;return DYE_TEXTURE_COLORS[15-(raw&15)];}
export function updateWolfCollar(e,layer){layer.obj.visible=!!e.tamed&&!e.invisible;layer.mat.params.setTint(...wolfCollarColor(e),1);}
// Native pre-1.20.5 tail rule uses an absolute health deficit; 1.20.6 uses a ratio.
export function wolfTailAngle(e){const f=Math.fround;if(e.angry)return f(1.5393804);if(!e.tamed)return f(.62831855);const max=f(20),health=f(e.wolfHealth??max);return f(f(f(.55)-f(f(max-health)*f(.02)))*f(Math.PI));}
