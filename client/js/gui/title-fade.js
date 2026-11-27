// 1.20.6 TitleScreen: panorama fades for one second, then widgets for one second. Kept for
// the legacy layout fixture; the 26.3 screen uses titleFade263 below.
export function titleFade(elapsed){
  return {panorama:Math.max(0,Math.min(1,elapsed/1000)),widgets:Math.max(0,Math.min(1,(elapsed-1000)/1000)),fading:elapsed<=2000};
}

// 26.3 TitleScreen.extractRenderState: the panorama is always at full brightness. Over the
// two-second fade, widgets stay hidden for the first second, then clampedMap(fade, 0.5, 1, 0, 1).
export function titleFade263(elapsed){
  const fade=Math.max(0,Math.min(1,elapsed/2000));
  return {panorama:1,widgets:Math.max(0,Math.min(1,(fade-0.5)/0.5)),fading:elapsed<=2000};
}
