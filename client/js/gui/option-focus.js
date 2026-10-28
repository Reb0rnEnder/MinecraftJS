// Native ContainerObjectSelectionList: Tab visits widgets inside each row and
// scrolls the focused row into view, skipping category headings and disabled resets.
export function focusOptionWidgets(screen,event,widgets) {
  if(event.code!=='Tab')return false;
  if(!widgets.some(b=>b.visible!==false&&b.enabled!==false))return false;
  const step=event.shift||event.shiftKey?-1:1;
  let index=widgets.indexOf(screen.focusedWidget);
  if(index<0)index=step<0?0:-1;
  do {index=(index+step+widgets.length)%widgets.length;}
  while(widgets[index].visible===false||widgets[index].enabled===false);
  for(const b of widgets)b.focused=false;
  const target=screen.focusedWidget=widgets[index];target.focused=true;
  if(target.optionRow!==undefined){
    const list=screen.list;
    let y=list.slotTop(target.optionRow),delta=y-list.top-4-list.slotHeight;
    if(delta<0)list.amountScrolled+=delta;
    y=list.slotTop(target.optionRow);delta=list.bottom-y-list.slotHeight*2;
    if(delta<0)list.amountScrolled-=delta;
    list.clamp();
  }
  return true;
}
