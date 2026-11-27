// Native 1.20.6 keyboard focus (Screen / ContainerEventHandler / AbstractWidget): Tab walks the widgets in the
// order they were added, wrapping by clearing focus; arrow keys move to the nearest widget in that direction;
// a screen gives its first widget focus on open only when the last input was the keyboard.

// Widgets are stamped in construction order, which is the order screens add them in.
let nextOrder = 0;
export function stampWidget(w) { w.focusOrder = nextOrder++; return w; }

// Minecraft.lastInputType: MOUSE on any press in a screen, KEYBOARD_ARROW / KEYBOARD_TAB from KeyboardHandler
export const INPUT = { NONE: 'none', MOUSE: 'mouse', ARROW: 'keyboard_arrow', TAB: 'keyboard_tab' };
export const isKeyboard = (type) => type === INPUT.ARROW || type === INPUT.TAB;
let inputType = INPUT.NONE;
export function lastInputType() { return inputType; }
export function setLastInputType(type) { if (type) inputType = type; }
export function inputTypeForKey(code) {
  if (code === 'Tab') return INPUT.TAB;
  return /^Arrow(Left|Right|Up|Down)$/.test(code) ? INPUT.ARROW : null;
}

// ScreenRectangle of a widget or selection list
export function rectOf(w) {
  if (w.left !== undefined && w.right !== undefined && w.top !== undefined && w.bottom !== undefined && w.slotHeight !== undefined) {
    return { x: w.left, y: w.top, w: w.right - w.left, h: w.bottom - w.top };
  }
  return { x: w.x, y: w.y, w: w.w, h: w.h };
}

// The screen's children in add order (fields and buttons kept in separate arrays here)
export function children(screen) {
  const all = [...(screen.fields || []), ...(screen.buttons || [])];
  if (screen.list && !all.includes(screen.list)) all.push(screen.list);
  return all.map((w, i) => [w, i]).sort((a, b) => (a[0].focusOrder ?? Infinity) - (b[0].focusOrder ?? Infinity) || a[1] - b[1]).map((p) => p[0]);
}

// AbstractWidget.nextFocusPath: active, visible and not already focused; an empty list has no entry to focus
function focusable(w) {
  if (w.visible === false || w.enabled === false || w.active === false) return false;
  if (typeof w.size === 'function' && w.size() <= 0) return false;
  return !w.focused;
}

export function focused(screen) { return children(screen).find((w) => w.focused) ?? null; }

// Screen.changeFocus / clearFocus (EditBox.setFocused ignores false when it cannot lose focus)
export function clearFocus(screen) {
  for (const w of children(screen)) if (w.canLoseFocus !== false) w.focused = false;
  screen.focusedWidget = focused(screen);
}
export function changeFocus(screen, w) {
  clearFocus(screen);
  if (!w) return;
  w.focused = true; screen.focusedWidget = w;
  if (w.cursorCounter !== undefined) w.cursorCounter = 0; // EditBox.setFocused restarts the cursor blink
}

// ContainerEventHandler.handleTabNavigation
export function nextTab(screen, forward) {
  const list = children(screen);
  const cur = list.indexOf(focused(screen));
  let i = cur >= 0 ? cur + (forward ? 1 : 0) : forward ? 0 : list.length;
  if (forward) { for (; i < list.length; i++) if (focusable(list[i])) return list[i]; }
  else { for (i--; i >= 0; i--) if (focusable(list[i])) return list[i]; }
  return null;
}

const DIR = {
  ArrowUp: { axis: 'y', positive: false }, ArrowDown: { axis: 'y', positive: true },
  ArrowLeft: { axis: 'x', positive: false }, ArrowRight: { axis: 'x', positive: true },
};
const len = (r, axis) => (axis === 'x' ? r.w : r.h);
const pos = (r, axis) => (axis === 'x' ? r.x : r.y);
// getBoundInDirection: first or last pixel on the axis
const bound = (r, axis, positive) => (positive ? pos(r, axis) + len(r, axis) - 1 : pos(r, axis));
const after = (positive, a, b) => (positive ? a > b : b > a);
const ortho = (axis) => (axis === 'x' ? 'y' : 'x');
const overlapsIn = (a, b, axis) => Math.max(bound(a, axis, false), bound(b, axis, false)) <= Math.min(bound(a, axis, true), bound(b, axis, true));
const center = (r, axis) => Math.trunc((bound(r, axis, true) + bound(r, axis, false)) / 2);

// ContainerEventHandler.handleArrowNavigation / nextFocusPathInDirection / nextFocusPathVaguelyInDirection
export function nextArrow(screen, code) {
  const d = DIR[code];
  if (!d) return null;
  const list = children(screen), cur = focused(screen);
  let from;
  if (cur) from = rectOf(cur);
  else {
    // the screen rectangle's border on the opposite side, stepped one pixel outward
    const sr = { x: 0, y: 0, w: screen.width, h: screen.height }, o = ortho(d.axis);
    const at = bound(sr, d.axis, !d.positive) + (d.positive ? -1 : 1);
    from = d.axis === 'x' ? { x: at, y: bound(sr, o, false), w: 1, h: len(sr, o) } : { x: bound(sr, o, false), y: at, w: len(sr, o), h: 1 };
  }
  const o = ortho(d.axis), edge = bound(from, d.axis, !d.positive);
  const near = [];
  for (const w of list) {
    if (w === cur) continue;
    const r = rectOf(w);
    if (!overlapsIn(r, from, o)) continue;
    const b = bound(r, d.axis, !d.positive);
    if (after(d.positive, b, edge)) near.push(w);
    else if (b === edge && after(d.positive, bound(r, d.axis, d.positive), bound(from, d.axis, d.positive))) near.push(w);
  }
  const cmp = (a, b, positive) => (a === b ? 0 : (positive ? a < b : b < a) ? -1 : 1);
  near.sort((a, b) => cmp(bound(rectOf(a), d.axis, !d.positive), bound(rectOf(b), d.axis, !d.positive), d.positive)
    || cmp(bound(rectOf(a), o, false), bound(rectOf(b), o, false), true));
  for (const w of near) if (focusable(w)) return w;
  // vaguely: anything past the edge, nearest by squared distance between edge midpoints
  const px = d.axis === 'x' ? bound(from, 'x', d.positive) : center(from, 'x');
  const py = d.axis === 'y' ? bound(from, 'y', d.positive) : center(from, 'y');
  const vague = [];
  for (const w of list) {
    if (w === cur) continue;
    const r = rectOf(w);
    const qx = d.axis === 'x' ? bound(r, 'x', !d.positive) : center(r, 'x');
    const qy = d.axis === 'y' ? bound(r, 'y', !d.positive) : center(r, 'y');
    if (!after(d.positive, d.axis === 'x' ? qx : qy, d.axis === 'x' ? px : py)) continue;
    vague.push([w, (px - qx) ** 2 + (py - qy) ** 2]);
  }
  vague.sort((a, b) => a[1] - b[1]);
  for (const [w] of vague) if (focusable(w)) return w;
  return null;
}

// Screen.keyPressed after the focused widget declined the key; true when focus moved
export function navigate(screen, e) {
  if (e.code === 'Tab') {
    const forward = !(e.shift || e.shiftKey);
    let w = nextTab(screen, forward);
    if (!w) { clearFocus(screen); w = nextTab(screen, forward); }
    if (w) changeFocus(screen, w);
    return true;
  }
  if (DIR[e.code]) {
    const w = nextArrow(screen, e.code);
    if (w) { changeFocus(screen, w); return true; }
  }
  return false;
}

// Screen.setInitialFocus(): an explicitly focused widget (setInitialFocus(widget)) wins; otherwise the first Tab
// target, only after keyboard input
export function setInitialFocus(screen, type = inputType) {
  const already = focused(screen);
  if (already) { screen.focusedWidget = already; return; }
  screen.focusedWidget = null;
  if (!isKeyboard(type)) return;
  const w = nextTab(screen, true);
  if (w) changeFocus(screen, w);
}
