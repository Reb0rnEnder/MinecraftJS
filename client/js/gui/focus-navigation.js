// Keyboard focus behavior shared by screens and focusable UI widgets.
let nextOrder = 0;
export function stampWidget(widget) { widget.focusOrder = nextOrder++; return widget; }

export const INPUT = { NONE: 'none', MOUSE: 'mouse', ARROW: 'keyboard_arrow', TAB: 'keyboard_tab' };
export const isKeyboard = (type) => type === INPUT.ARROW || type === INPUT.TAB;
let inputType = INPUT.NONE;
export function lastInputType() { return inputType; }
export function setLastInputType(type) { if (type) inputType = type; }
export function inputTypeForKey(code) {
  if (code === 'Tab') return INPUT.TAB;
  return /^Arrow(Left|Right|Up|Down)$/.test(code) ? INPUT.ARROW : null;
}

export function rectOf(widget) {
  if (widget.left !== undefined && widget.right !== undefined && widget.top !== undefined && widget.bottom !== undefined && widget.slotHeight !== undefined) {
    return { x: widget.left, y: widget.top, w: widget.right - widget.left, h: widget.bottom - widget.top };
  }
  return { x: widget.x, y: widget.y, w: widget.w, h: widget.h };
}

export function children(screen) {
  const all = [...(screen.fields || []), ...(screen.buttons || [])];
  const listed = Array.isArray(screen.lists) ? screen.lists : Object.values(screen.lists || {});
  const lists = [screen.list, screen.slots, ...listed.map((entry) => entry?.list || entry)]
    .filter((widget, index, candidates) => widget && candidates.indexOf(widget) === index && widget.slotHeight !== undefined);
  for (const widget of lists) if (!all.includes(widget)) all.push(widget);
  return all.map((widget, index) => [widget, index])
    .sort((a, b) => (a[0].focusOrder ?? Infinity) - (b[0].focusOrder ?? Infinity) || a[1] - b[1])
    .map(([widget]) => widget);
}

function focusable(widget) {
  if (widget.visible === false || widget.enabled === false || widget.active === false) return false;
  if (typeof widget.size === 'function' && widget.size() <= 0) return false;
  return !widget.focused;
}

export function focused(screen) { return children(screen).find((widget) => widget.focused) ?? null; }

export function clearFocus(screen) {
  for (const widget of children(screen)) if (widget.canLoseFocus !== false) widget.focused = false;
  screen.focusedWidget = focused(screen);
}

export function changeFocus(screen, widget) {
  clearFocus(screen);
  if (!widget) return;
  widget.focused = true;
  screen.focusedWidget = widget;
  if (widget.cursorCounter !== undefined) widget.cursorCounter = 0;
}

export function nextTab(screen, forward) {
  const list = children(screen);
  const current = list.indexOf(focused(screen));
  let index = current >= 0 ? current + (forward ? 1 : 0) : forward ? 0 : list.length;
  if (forward) {
    for (; index < list.length; index++) if (focusable(list[index])) return list[index];
  } else {
    for (index--; index >= 0; index--) if (focusable(list[index])) return list[index];
  }
  return null;
}

const DIR = {
  ArrowUp: { axis: 'y', positive: false }, ArrowDown: { axis: 'y', positive: true },
  ArrowLeft: { axis: 'x', positive: false }, ArrowRight: { axis: 'x', positive: true },
};
const len = (rect, axis) => axis === 'x' ? rect.w : rect.h;
const pos = (rect, axis) => axis === 'x' ? rect.x : rect.y;
const bound = (rect, axis, positive) => positive ? pos(rect, axis) + len(rect, axis) - 1 : pos(rect, axis);
const after = (positive, a, b) => positive ? a > b : b > a;
const ortho = (axis) => axis === 'x' ? 'y' : 'x';
const overlapsIn = (a, b, axis) => Math.max(bound(a, axis, false), bound(b, axis, false)) <= Math.min(bound(a, axis, true), bound(b, axis, true));
const center = (rect, axis) => Math.trunc((bound(rect, axis, true) + bound(rect, axis, false)) / 2);

export function nextArrow(screen, code) {
  const direction = DIR[code];
  if (!direction) return null;
  const list = children(screen), current = focused(screen);
  let from;
  if (current) from = rectOf(current);
  else {
    const bounds = { x: 0, y: 0, w: screen.width, h: screen.height }, axis = ortho(direction.axis);
    const at = bound(bounds, direction.axis, !direction.positive) + (direction.positive ? -1 : 1);
    from = direction.axis === 'x'
      ? { x: at, y: bound(bounds, axis, false), w: 1, h: len(bounds, axis) }
      : { x: bound(bounds, axis, false), y: at, w: len(bounds, axis), h: 1 };
  }
  const axis = ortho(direction.axis), edge = bound(from, direction.axis, !direction.positive), near = [];
  for (const widget of list) {
    if (widget === current) continue;
    const rect = rectOf(widget);
    if (!overlapsIn(rect, from, axis)) continue;
    const candidateEdge = bound(rect, direction.axis, !direction.positive);
    if (after(direction.positive, candidateEdge, edge)) near.push(widget);
    else if (candidateEdge === edge && after(direction.positive, bound(rect, direction.axis, direction.positive), bound(from, direction.axis, direction.positive))) near.push(widget);
  }
  const compare = (a, b, positive) => a === b ? 0 : (positive ? a < b : b < a) ? -1 : 1;
  near.sort((a, b) => compare(bound(rectOf(a), direction.axis, !direction.positive), bound(rectOf(b), direction.axis, !direction.positive), direction.positive)
    || compare(bound(rectOf(a), axis, false), bound(rectOf(b), axis, false), true));
  for (const widget of near) if (focusable(widget)) return widget;

  const px = direction.axis === 'x' ? bound(from, 'x', direction.positive) : center(from, 'x');
  const py = direction.axis === 'y' ? bound(from, 'y', direction.positive) : center(from, 'y');
  const vague = [];
  for (const widget of list) {
    if (widget === current) continue;
    const rect = rectOf(widget);
    const qx = direction.axis === 'x' ? bound(rect, 'x', !direction.positive) : center(rect, 'x');
    const qy = direction.axis === 'y' ? bound(rect, 'y', !direction.positive) : center(rect, 'y');
    if (!after(direction.positive, direction.axis === 'x' ? qx : qy, direction.axis === 'x' ? px : py)) continue;
    vague.push([widget, (px - qx) ** 2 + (py - qy) ** 2]);
  }
  vague.sort((a, b) => a[1] - b[1]);
  for (const [widget] of vague) if (focusable(widget)) return widget;
  return null;
}

export function navigate(screen, event) {
  if (event.code === 'Tab') {
    const forward = !(event.shift || event.shiftKey);
    let widget = nextTab(screen, forward);
    if (!widget) { clearFocus(screen); widget = nextTab(screen, forward); }
    if (widget) changeFocus(screen, widget);
    return true;
  }
  if (DIR[event.code]) {
    const widget = nextArrow(screen, event.code);
    if (widget) { changeFocus(screen, widget); return true; }
  }
  return false;
}

export function setInitialFocus(screen, type = inputType) {
  const current = focused(screen);
  if (current) { screen.focusedWidget = current; return; }
  screen.focusedWidget = null;
  if (!isKeyboard(type)) return;
  const widget = nextTab(screen, true);
  if (widget) changeFocus(screen, widget);
}
