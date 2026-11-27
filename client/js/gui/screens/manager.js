import { navigate, changeFocus, clearFocus, setInitialFocus, inputTypeForKey, children, INPUT, setLastInputType, lastInputType, isKeyboard } from '../focus-navigation.js';
// Screen stack (GuiScreen equivalent): routes input and rendering to the active screen.

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
  // Screen.rebuildWidgets: clearFocus, init, setInitialFocus
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
  // ContainerEventHandler.mouseClicked: the first child that takes a left click becomes the focused one
  mouseDown(mx, my, button) {
    setLastInputType(INPUT.MOUSE);
    if (button !== 0) return false;
    for (const w of children(this)) {
      if (w === this.list) continue;
      const hit = this.fields.includes(w) ? w.click(mx, my, this.gui) : w.mouseDown(mx, my, this.game);
      if (hit) { changeFocus(this, w); return true; }
    }
    return false;
  }
  mouseUp(mx, my, button) { for (const b of this.buttons) if (b.mouseUp) b.mouseUp(); }
  mouseMove() {}
  // Screen.keyPressed: Escape closes first, then the focused widget, then Tab / arrow focus navigation
  key(e) {
    setLastInputType(inputTypeForKey(e.code));
    if (e.code === 'Escape' && this.shouldCloseOnEsc()) { this.close(); return true; }
    for (const f of this.fields) if (f.key(e)) return true;
    if(this.focusedWidget&&!this.fields.includes(this.focusedWidget)&&this.focusedWidget.key?.(e,this.game))return true;
    return navigate(this, e);
  }
  shouldCloseOnEsc() { return true; }
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
    for(const field of s.fields)gui.narrator?.widget(field,false,field.label||field.narrationLabel||'', 'editBox');
    gui.narrator?.screenFrame?.(s,children(s),isKeyboard(lastInputType()));
  }

  // KeyboardHandler.keyPress: arrows and Tab in a screen make the keyboard the last input type
  onKey(e) { if (!this.current) return; setLastInputType(inputTypeForKey(e.code)); this.current.key(e); }
  onKeyUp(e) { if (this.current) this.current.keyUp(e); }
  onChar(c) { if (this.current) this.current.char(c); }
  onMove() { if (this.current && this.current.mouseMove) { const [mx, my] = this._mouse(); this.current.mouseMove(mx, my); } }
  onWheel(d) { if (this.current) this.current.wheel(d); }
  onMouse(e) {
    if (!this.current) return;
    if (e.down) setLastInputType(INPUT.MOUSE); // MouseHandler.onPress
    const [mx, my] = this._mouse();
    if (e.down) this.current.mouseDown(mx, my, e.button, e);
    else this.current.mouseUp(mx, my, e.button, e);
  }
}
