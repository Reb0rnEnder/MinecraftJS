// Window.calculateScale (1.13+): the Unicode font rounds odd scales up.
export function calculateGuiScale(width,height,requested=0,unicode=false){
  let scale=1;
  while(scale!==requested&&scale<width&&scale<height&&width/(scale+1)>=320&&height/(scale+1)>=240)scale++;
  if(unicode&&scale%2)scale++;
  return scale;
}
// GUI_SCALE option (1.13-1.16): Integer.remainderUnsigned(value + 1, calculateScale(0, forceUnicode) + 1).
export function nextGuiScale(width,height,current,unicode=false){
  return (current+1)%(calculateGuiScale(width,height,0,unicode)+1);
}
