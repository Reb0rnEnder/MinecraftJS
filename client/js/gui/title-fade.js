// TitleScreen.render: panorama fades for one second, then widgets for one second.
export function titleFade(elapsed){
  return {panorama:Math.max(0,Math.min(1,elapsed/1000)),widgets:Math.max(0,Math.min(1,(elapsed-1000)/1000)),fading:elapsed<=2000};
}
