// Native 1.14-1.19.3 Tab focus (Screen.keyPressed / ContainerEventHandler.changeFocus): Tab walks the widgets in the
// order they were added (Shift reverses), each toggling its focus, and wraps through no focus. No arrow navigation.

// Widgets are stamped in construction order, which is the order screens add them in.
let nextOrder = 0;
export function stampWidget(w) { w.focusOrder = nextOrder++; return w; }

// The screen's children in add order (fields and buttons kept in separate arrays here)
export function children(screen) {
  const all = [...(screen.fields || []), ...(screen.buttons || [])];
  if (screen.list && !all.includes(screen.list)) all.push(screen.list);
  return all.map((w, i) => [w, i]).sort((a, b) => (a[0].focusOrder ?? Infinity) - (b[0].focusOrder ?? Infinity) || a[1] - b[1]).map((p) => p[0]);
}

// AbstractWidget.changeFocus: active and visible (EditBox also editable); an empty list has nothing to focus
const focusable = (w) => w.visible !== false && w.enabled !== false && w.active !== false && !(typeof w.size === 'function' && w.size() <= 0);

// Screen.keyPressed(Tab): changeFocus(forward), and again from the start when it ran off the end
export function tabFocus(screen, forward) {
  const list = children(screen);
  const step = () => {
    const cur = list.findIndex((w) => w.focused);
    if (cur >= 0) list[cur].focused = false; // the focused widget toggles off
    let i = cur >= 0 ? cur + (forward ? 1 : 0) : forward ? 0 : list.length;
    if (forward) { for (; i < list.length; i++) if (focusable(list[i])) return list[i]; }
    else { for (i--; i >= 0; i--) if (focusable(list[i])) return list[i]; }
    return null;
  };
  const w = step() ?? step();
  screen.focusedWidget = w;
  if (w) { w.focused = true; if (w.cursorCounter !== undefined) w.cursorCounter = 0; }
  return true;
}
