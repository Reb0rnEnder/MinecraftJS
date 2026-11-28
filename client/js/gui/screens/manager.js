// Screen stack (GuiScreen equivalent): routes input and rendering to the active screen.
import { navigate, children, focused, rectOf, changeFocus, clearFocus, setInitialFocus, inputTypeForKey, INPUT, setLastInputType } from '../focus-navigation.js';

export class Screen {
  constructor(game) {
    this.game = game;
    this.buttons = [];
    this.fields = [];
    this.allowsMovement = false;
    this.pausesGame = false;
    this.background = 'world';
  }
  // Screen.renderBackground; containers/books/chat override their background.
  get usesMenuBackground() { return !this.isContainer && (this.background === 'world' || this.background === 'dirt'); }
  get gui() { return this.game.gui; }
  get width() { return this.game.gui.width; }
  get height() { return this.game.gui.height; }
  init() {}
  onResize() { clearFocus(this); this.buttons = []; this.fields = []; this.init(); setInitialFocus(this); }
  tick() { for (const f of this.fields) f.tick(); }
  render(gui, mx, my, partial) {
    if (this.background === 'world') gui.menuBackground(this.game.inWorld);
    else if (this.background === 'dirt') gui.dirtBackground();
    this.renderContent(gui, mx, my, partial);
    for (const b of this.buttons) b.render(gui, mx, my);
    for (const f of this.fields) f.render(gui);
  }
  renderContent() {}
  mouseDown(mx, my, button) {
    setLastInputType(INPUT.MOUSE);
    if (button !== 0) return false;
    for (const widget of children(this)) {
      if (widget.visible === false || widget.enabled === false || widget.active === false) continue;
      let hit = false;
      if (this.fields.includes(widget)) hit = widget.mouseDown(mx, my, this.gui);
      else if (this.buttons.includes(widget)) hit = widget.mouseDown(mx, my, this.game);
      else if (widget === this.list && this.mouseDown === Screen.prototype.mouseDown && widget.mouseDown) {
        const r = rectOf(widget);
        if (mx >= r.x && mx < r.x + r.w && my >= r.y && my < r.y + r.h) hit = widget.mouseDown(mx, my, button);
      }
      if (hit) { changeFocus(this, widget); return true; }
    }
    clearFocus(this);
    return false;
  }
  mouseUp(mx, my, button) { for (const b of this.buttons) if (b.mouseUp) b.mouseUp(); }
  mouseMove() {}
  key(e) {
    setLastInputType(inputTypeForKey(e.code));
    if (e.code === 'Escape') { this.close(); return true; }
    const active = focused(this);
    if (active?.key?.(e, this.game)) return true;
    return navigate(this, e);
  }
  keyUp() {}
  char(c) { for (const f of this.fields) if (f.char(c)) return true; return false; }
  wheel() {}
  close() { this.game.screens.close(); }
  onClose() {}
}

export class ScreenManager {
  constructor(game) {
    this.game = game;
    this.current = null;
    this.ignoreUnlock = false;
    this.lastSize = '';
  }

  open(screen) {
    const g = this.game;
    if (this.current) this.current.onClose();
    this.current = screen;
    if (screen) {
      clearFocus(screen);
      screen.buttons = []; screen.fields = [];
      screen.init();
      setInitialFocus(screen);
      if (g.input.locked) { this.ignoreUnlock = true; g.input.unlock(); }
    } else if (g.inWorld) {
      g.input.lock();
    }
  }

  close() {
    const g = this.game;
    if (this.current) this.current.onClose();
    this.current = null;
    if (g.inWorld) g.input.lock();
    else this.openMainMenu();
  }

  closeContainer() {
    if (this.current && this.current.isContainer) {
      this.current.onClose();
      this.current = null;
      if (this.game.inWorld) this.game.input.lock();
    }
  }

  openMainMenu(reason) {
    // Lazily imported to avoid circular deps
    import('./menus.js').then((m) => this.open(new m.TitleScreen(this.game, reason)));
  }

  _mouse() {
    const g = this.game.gui;
    const inp = this.game.input;
    return [inp.rawX / g.scale, inp.rawY / g.scale];
  }

  tick() { if (this.current) this.current.tick(); }

  render(gui, partial) {
    const s = this.current;
    if (!s) return;
    const size = gui.width + 'x' + gui.height;
    if (size !== this.lastSize) { this.lastSize = size; s.onResize(); }
    const [mx, my] = this._mouse();
    s.render(gui, mx, my, partial);
    for(const b of s.buttons)gui.narrator?.widget(b,b.hovered?.(mx,my)??false,typeof b.label==='function'?b.label():b.label);
    for(const field of s.fields)gui.narrator?.widget(field,false,field.label||field.narrationLabel||'', 'editBox');
  }

  onKey(e) { setLastInputType(inputTypeForKey(e.code)); if (this.current) this.current.key(e); }
  onKeyUp(e) { if (this.current) this.current.keyUp(e); }
  onChar(c) { if (this.current) this.current.char(c); }
  onMove() { if (this.current && this.current.mouseMove) { const [mx, my] = this._mouse(); this.current.mouseMove(mx, my); } }
  onWheel(d) { if (this.current) this.current.wheel(d); }
  onMouse(e) {
    if (!this.current) return;
    if (e.down) setLastInputType(INPUT.MOUSE);
    const [mx, my] = this._mouse();
    if (e.down) {
      const screen = this.current;
      const handled = screen.mouseDown(mx, my, e.button, e);
      // Many screens route list clicks in their own mouseDown override. Keep
      // those lists in the same focus system after their row handler succeeds.
      if (handled && e.button === 0) {
        const within = (widget) => {
          const r = rectOf(widget);
          return Number.isFinite(r.x) && Number.isFinite(r.y) && mx >= r.x && mx < r.x + r.w && my >= r.y && my < r.y + r.h;
        };
        const currentFocus = focused(screen);
        if (!currentFocus || !within(currentFocus)) {
          const list = children(screen).find((widget) => widget.slotHeight !== undefined && within(widget));
          if (list) changeFocus(screen, list);
        }
      }
    } else this.current.mouseUp(mx, my, e.button, e);
  }
}
