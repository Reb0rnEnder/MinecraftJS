// Window.calculateScale (1.20.6): the Unicode font rounds odd scales up.
export function calculateGuiScale(width,height,requested=0,unicode=false){
  let scale=1;
  while(scale!==requested&&scale<width&&scale<height&&width/(scale+1)>=320&&height/(scale+1)>=240)scale++;
  if(unicode&&scale%2)scale++;
  return scale;
}
// GUI scale CycleButton (ClampingLazyMaxIntRange): values 0..calculateScale(0, forceUnicode); out of range restarts at 0.
export function nextGuiScale(width,height,current,unicode=false){
  const max=calculateGuiScale(width,height,0,unicode);
  return current>=max?0:current+1;
}
