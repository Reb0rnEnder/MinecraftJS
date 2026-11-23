// ScaledResolution (1.8.9/1.12.2): recomputed every frame; a Unicode font rounds odd scales down, except 1.
export function calculateGuiScale(width,height,requested=0,unicode=false){
  const max=requested===0?1000:requested;let scale=1;
  while(scale<max&&width/(scale+1)>=320&&height/(scale+1)>=240)scale++;
  if(unicode&&scale%2&&scale!==1)scale--;
  return scale;
}
