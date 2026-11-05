// Native entity packet coordinate codec. Zero deltas preserve the exact base,
// including its sub-packet precision. Only changed axes are quantized.
export const encodeEntityPosition=value=>Math.round(value*4096)||0;
export const relativeEntityPosition=(base,delta)=>delta===0?base:(encodeEntityPosition(base)+Math.round(delta*4096))/4096;
