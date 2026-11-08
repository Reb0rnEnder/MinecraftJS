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
  get gui() { return this.game.gui; }
  get width() { return this.game.gui.width; }
  get height() { return this.game.gui.height; }
  init() {}
  onResize() { this.buttons = []; this.fields = []; this.init(); }
  tick() { for (const f of this.fields) f.tick(); }
  render(gui, mx, my, partial) {
    if (this.background === 'world') gui.worldBackground();
    else if (this.background === 'dirt') gui.dirtBackground();
    this.renderContent(gui, mx, my, partial);
    for (const b of this.buttons) b.render(gui, mx, my);
    for (const f of this.fields) f.render(gui);
  }
  renderContent() {}
  mouseDown(mx, my, button) {
    if (button === 0) {
      for (const b of this.buttons) if (b.mouseDown(mx, my, this.game)) return true;
    }
    let any = false;
    for (const f of this.fields) if (f.mouseDown(mx, my, this.gui)) any = true;
    return any;
  }
  mouseUp(mx, my, button) { for (const b of this.buttons) if (b.mouseUp) b.mouseUp(); }
  mouseMove() {}
  key(e) {
    if(e.code==='Tab') {
      const widgets=[...this.fields.filter(w=>w.enabled!==false),...this.buttons.filter(w=>w.visible!==false&&w.enabled!==false),...(this.list?[this.list]:[])];
      if(!widgets.length)return false;
      const i=widgets.findIndex(w=>w.focused),next=(i+(e.shift?-1:1)+widgets.length)%widgets.length;
      widgets.forEach(w=>{w.focused=false;});this.focusedWidget=widgets[next];this.focusedWidget.focused=true;
      return true;
    }
    for (const f of this.fields) if (f.key(e)) return true;
    if(this.focusedWidget&&!this.fields.includes(this.focusedWidget)&&this.focusedWidget.key?.(e,this.game))return true;
    if (e.code === 'Escape') { this.close(); return true; }
    return false;
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
      screen.buttons = []; screen.fields = [];
      screen.init();
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

  onKey(e) { if (this.current) this.current.key(e); }
  onKeyUp(e) { if (this.current) this.current.keyUp(e); }
  onChar(c) { if (this.current) this.current.char(c); }
  onMove() { if (this.current && this.current.mouseMove) { const [mx, my] = this._mouse(); this.current.mouseMove(mx, my); } }
  onWheel(d) { if (this.current) this.current.wheel(d); }
  onMouse(e) {
    if (!this.current) return;
    const [mx, my] = this._mouse();
    if (e.down) this.current.mouseDown(mx, my, e.button, e);
    else this.current.mouseUp(mx, my, e.button, e);
  }
}
