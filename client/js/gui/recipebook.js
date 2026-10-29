// GuiRecipeBook (1.12): the recipe book panel beside the inventory / crafting table. Search field, category tabs,
// a 5 x 4 page of recipe buttons with arrows, the "show craftable" toggle, the alternatives overlay and the ghost
// recipe the server asks for when the items are missing.
import { tr } from './i18n.js';
import { TextField } from './widgets.js';
import { C } from '../net/packets.js';
import { BOOK_TABS } from '../game/recipebook.js';

const TEX = 'gui/recipe_book.png';
// GuiButtonRecipeTab icons: [main, second] (tools shows the combat icon too, misc the food icon)
const TAB_ICONS={search:['compass'],tools:['iron_axe','golden_sword'],buildingBlocks:['bricks'],misc:['lava_bucket','apple'],redstone:['redstone'],food:['cooked_porkchop']};

export class RecipeBookGui {
  // opts: { gridW, gridH, slots: [result, ...grid slot indices], windowId, button: { x(guiLeft, width, height), y(...), u, v, tex } }
  constructor(screen, opts) {
    this.screen = screen;
    this.game = screen.game;
    this.book = this.game.recipeBook;
    this.opts = opts;
    this.state=this.book.stateFor(opts.kind||'crafting');this.tabs=opts.tabs||BOOK_TABS;
    this.tab = 'search';
    this.page = 0;
    this.time = 0;
    this.ghost = null;   // { recipe, ingredients: [{ alts, slot }] }
    this.overlay = null; // { list, x, y, buttons: [{ rec, x, y, craftable }] }
    this.search = new TextField(0, 0, 80, 14, { maxLength: 50, background: false, onChange: () => this.update(true) });
  }

  get visible() { return this.state.open; }
  get narrow() { return this.screen.width < 379; }

  // GuiRecipeBook.initVisuals / updateScreenPosition
  layout() {
    const s = this.screen;
    this.xOffset = this.narrow ? 0 : 86;
    this.left = Math.floor((s.width - 147) / 2) - this.xOffset;
    this.top = Math.floor((s.height - 166) / 2);
    this.search.x = this.left + 25; this.search.y = this.top + 14;
    this.update(false);
  }
  screenLeft(xSize) {
    const s = this.screen;
    return this.visible && !this.narrow ? 177 + Math.floor((s.width - xSize - 200) / 2) : Math.floor((s.width - xSize) / 2);
  }

  toggle() {
    this.state.open = !this.state.open;
    if (!this.state.open) this.overlay = null;
    this._sendSettings();
  }
  _sendSettings() { this.game.send(C.recipeBookSettings(0,this.book.open,this.book.filtering));for(const [i,key]of ['smelting','blasting','smoking'].entries()){const state=this.book.cookingStates[key];this.game.send(C.recipeBookSettings(i+1,state.open,state.filtering));} }

  _gridItems() { return this.opts.slots.slice(1).map((i) => this.screen.container.get(i)); }

  contextLists(tab){const allowed=this.opts.kind?[this.opts.kind]:['crafting_shaped','crafting_shapeless'];return this.book.tabLists(tab).map(list=>({...list,recipes:list.recipes.filter(r=>allowed.includes(r.type?.replace(/^minecraft:/,'')))}));}

  // GuiRecipeBook.updateCollections
  update(resetPage) {
    const counts = this.book.stackedContents(this._gridItems());
    const q = this.search.text.trim().toLowerCase();
    this.tabsVisible = {};
    for (const t of this.tabs) {
      this.tabsVisible[t] = t === 'search' || this.contextLists(t).some((l) => this.book.evaluate(l, counts, this.opts.gridW, this.opts.gridH).valid.length > 0);
    }
    if (!this.tabsVisible[this.tab]) this.tab = 'search';
    let lists = this.contextLists(this.tab).map((l) => this.book.evaluate(l, counts, this.opts.gridW, this.opts.gridH)).filter((l) => l.valid.length > 0);
    if (q) lists = lists.filter((l) => l.valid.some((r) => this.game.items.displayName(this._stack(r)).toLowerCase().includes(q)));
    if (this.state.filtering) lists = lists.filter((l) => l.craftable.length > 0);
    this.lists = lists;
    this.pages = Math.max(1, Math.ceil(lists.length / 20));
    if (resetPage || this.page >= this.pages) this.page = 0;
  }

  recipesUpdated() { if (this.visible) this.update(false); }
  tick() { this.time++; if (this.visible) this.update(false); }

  // GuiButtonRecipe.getOrderedRecipes: craftable first (only craftable when filtering)
  _ordered(l) { return this.state.filtering ? l.craftable.slice() : [...l.craftable, ...l.valid.filter((r) => !l.craftable.includes(r))]; }
  _shown(l) { const o = this._ordered(l); return o.length ? o[Math.floor(this.time / 30) % o.length] : null; }
  _stack(rec) { return {...structuredClone(rec.result),damage:rec.result.damage??(rec.result.data===32767?0:rec.result.data??0)}; }

  _buttons() {
    const out = [];
    (this.lists || []).slice(this.page * 20, this.page * 20 + 20).forEach((l, i) => out.push({ l, x: this.left + 11 + 25 * (i % 5), y: this.top + 31 + 25 * Math.floor(i / 5) }));
    return out;
  }
  _tabs() {
    const out = [];
    let k = 0;
    for (const t of this.tabs) if (this.tabsVisible && this.tabsVisible[t]) out.push({ t, x: this.left - 30, y: this.top + 3 + 27 * k++ });
    return out;
  }

  render(gui, mx, my, partial) {
    if (!this.visible) return;
    const g = this.game, L = this.left, T = this.top;
    gui.blit(TEX, L, T, 1, 1, 147, 166);
    this.search.render(gui);
    for (const tb of this._tabs()) {
      const sel = tb.t === this.tab;
      gui.blit(TEX, tb.x - (sel ? 2 : 0), tb.y, sel ? 188 : 153, 2, 35, 27);
      const ic = TAB_ICONS[tb.t].map(name=>({id:g.items.byName.get(name)?.id||1})), dx = sel ? -2 : 0;
      if (ic.length === 2) { g.itemRenderer.drawItem(gui, { ...ic[0], count: 1, damage: 0 }, tb.x + 3 + dx, tb.y + 5, false); g.itemRenderer.drawItem(gui, { ...ic[1], count: 1, damage: 0 }, tb.x + 14 + dx, tb.y + 5, false); }
      else g.itemRenderer.drawItem(gui, { ...ic[0], count: 1, damage: 0 }, tb.x + 9 + dx, tb.y + 5, false);
    }
    // toggle (152, 41): +28 when filtering, +18 when hovered
    const tx = L + 110, ty = T + 12, th = mx >= tx && mx < tx + 26 && my >= ty && my < ty + 16;
    gui.blit(TEX, tx, ty, 152 + (this.state.filtering ? 28 : 0), 41 + (th ? 18 : 0), 26, 16);
    // RecipeBookPage.render
    if (this.pages > 1) {
      const s = (this.page + 1) + '/' + this.pages;
      gui.text(s, L - Math.floor(gui.textWidth(s) / 2) + 73, T + 141, 0xffffff, false);
    }
    const shownRecipes = [];
    for (const b of this._buttons()) {
      const u = 29 + (b.l.craftable.length ? 0 : 25);
      const v = 206 + ((this.state.filtering ? b.l.craftable : b.l.valid).length > 1 ? 25 : 0);
      gui.blit(TEX, b.x, b.y, u, v, 25, 25);
      const rec = this._shown(b.l);
      if (rec) { g.itemRenderer.drawItem(gui, this._stack(rec), b.x + 4, b.y + 4, true); shownRecipes.push(...this._ordered(b.l)); }
    }
    // arrows: forward (1, 208), back (+13); hovered +18
    const arrow = (x, y, back) => { const h = mx >= x && mx < x + 12 && my >= y && my < y + 17; gui.blit(TEX, x, y, 1 + (back ? 13 : 0), 208 + (h ? 18 : 0), 12, 17); };
    if (this.pages > 1 && this.page < this.pages - 1) arrow(L + 93, T + 137, false);
    if (this.pages > 1 && this.page > 0) arrow(L + 38, T + 137, true);
    this._overlay(gui, mx, my);
    // GuiRecipeBook.recipesShown: new recipes on screen are marked seen
    for (const r of shownRecipes) if (this.book.fresh.has(r.id)) { this.book.fresh.delete(r.id); g.send(C.recipeInfoShown(r.id)); }
  }

  // GuiRecipeOverlay: the recipes of a list, 4 (or 5) per row, green when craftable
  _overlay(gui, mx, my) {
    const o = this.overlay;
    if (!o) return;
    gui.rect(o.x - 1, o.y - 1, o.x + o.w + 1, o.y + o.h + 1, 0xff000000);
    gui.rect(o.x, o.y, o.x + o.w, o.y + o.h, 0xffc6c6c6);
    for (const b of o.buttons) {
      const h = mx >= b.x && mx < b.x + 24 && my >= b.y && my < b.y + 24;
      gui.blit(TEX, b.x, b.y, 152 + (b.craftable ? 0 : 26), 78 + (h ? 26 : 0), 24, 24);
      this.game.itemRenderer.drawItem(gui, this._stack(b.rec), b.x + 4, b.y + 4, false);
    }
  }

  _openOverlay(l, bx, by) {
    const list = this._ordered(l);
    const n = list.length, per = n <= 16 ? 4 : 5, rows = Math.ceil(n / per);
    const o = { list, x: bx, y: by, w: Math.min(n, per) * 25 + 8, h: rows * 25 + 10, buttons: [] };
    list.forEach((rec, i) => o.buttons.push({ rec, craftable: l.craftable.includes(rec), x: o.x + 4 + 25 * (i % per), y: o.y + 5 + 25 * Math.floor(i / per) }));
    this.overlay = o;
  }

  _place(rec, all) {
    this.ghost = null;
    this.game.send(C.placeRecipe(this.opts.windowId(), rec.id, !!all));
  }

  renderTooltip(gui, mx, my) {
    if (!this.visible) return;
    if (this.overlay) {
      for (const b of this.overlay.buttons) if (mx >= b.x && mx < b.x + 24 && my >= b.y && my < b.y + 24) { gui.tooltip(this.game.items.tooltip(this._stack(b.rec)), mx, my); return; }
      return;
    }
    const tx = this.left + 110, ty = this.top + 12;
    if (mx >= tx && mx < tx + 26 && my >= ty && my < ty + 16) { gui.tooltip([tr(this.state.filtering ? 'gui.recipebook.toggleRecipes.craftable' : 'gui.recipebook.toggleRecipes.all')], mx, my); return; }
    for (const b of this._buttons()) {
      if (mx >= b.x && mx < b.x + 25 && my >= b.y && my < b.y + 25) {
        const rec = this._shown(b.l);
        if (!rec) return;
        const lines = this.game.items.tooltip(this._stack(rec));
        if (this._ordered(b.l).length > 1) lines.push(tr('gui.recipebook.moreRecipes'));
        gui.tooltip(lines, mx, my);
        return;
      }
    }
  }

  // Ghost recipe (GhostRecipe.render): red-tinted, washed-out items in the grid, cycling through alternatives
  renderGhost(gui, guiLeft, guiTop) {
    const gh = this.ghost;
    if (!gh) return;
    gh.ingredients.forEach((ing, i) => {
      const pos = this.screen.slotPos.find((p) => p[0] === ing.slot);
      if (!pos) return;
      const x = guiLeft + pos[1], y = guiTop + pos[2];
      if (i === 0) gui.rect(x - 4, y - 4, x + 20, y + 20, 0x30ff0000); else gui.rect(x, y, x + 16, y + 16, 0x30ff0000);
      const alt = ing.alts[Math.floor(this.time / 30) % ing.alts.length];
      this.game.itemRenderer.drawItem(gui, {...this._stack({result:alt}),count:i===0?ing.count:1}, x, y, i === 0);
      gui.rect(x, y, x + 16, y + 16, 0x30ffffff);
    });
  }

  // GuiRecipeBook.setupGhostRecipe (SPacketPlaceGhostRecipe)
  setupGhost(id) {
    const rec = this.book.recipe(id);
    if (!rec) return;
    const { gridW, slots } = this.opts;
    const ingredients = [{ alts: [rec.result], slot: slots[0], count: rec.result.count }];
    const k = rec.shaped ? rec.width : gridW;
    let l = 1, n = 0;
    for (let row = 0; row < this.opts.gridH; row++) {
      for (let col = 0; col < k; col++) {
        if (n >= rec.cells.length) { this.ghost = { recipe: rec, ingredients }; return; }
        const cell = rec.cells[n++];
        if (cell && cell.length) ingredients.push({ alts: cell, slot: slots[l] });
        l++;
      }
      if (k < gridW) l += gridW - k;
    }
    this.ghost = { recipe: rec, ingredients };
  }

  slotClicked(slot) { if (slot !== null && this.opts.slots.includes(slot)) this.ghost = null; }

  // true when the click belongs to the book
  mouseDown(mx, my, button, e) {
    if (!this.visible) return false;
    if (this.overlay) {
      for (const b of this.overlay.buttons) {
        if (mx >= b.x && mx < b.x + 24 && my >= b.y && my < b.y + 24) { this._place(b.rec, false); this.overlay = null; return true; }
      }
      this.overlay = null;
      return true;
    }
    const L = this.left, T = this.top;
    if (mx >= L + 25 && mx < L + 105 && my >= T + 14 && my < T + 28) { this.search.focused = true; return true; }
    this.search.focused = false;
    if (mx >= L + 110 && mx < L + 136 && my >= T + 12 && my < T + 28) {
      this.state.filtering = !this.state.filtering;
      this._sendSettings();
      this.update(true);
      return true;
    }
    for (const tb of this._tabs()) {
      if (mx >= tb.x && mx < tb.x + 35 && my >= tb.y && my < tb.y + 27) {
        if (this.tab !== tb.t) { this.tab = tb.t; this.update(true); this.game.sound.playUi('ui.button.click', 1); }
        return true;
      }
    }
    if (this.pages > 1 && this.page < this.pages - 1 && mx >= L + 93 && mx < L + 105 && my >= T + 137 && my < T + 154) { this.page++; return true; }
    if (this.pages > 1 && this.page > 0 && mx >= L + 38 && mx < L + 50 && my >= T + 137 && my < T + 154) { this.page--; return true; }
    for (const b of this._buttons()) {
      if (mx >= b.x && mx < b.x + 25 && my >= b.y && my < b.y + 25) {
        const ordered = this._ordered(b.l);
        // a single recipe places straight away (shift: as many as possible), more open the overlay
        if (button === 0 && ordered.length === 1) this._place(ordered[0], e && e.shift);
        else if (ordered.length) this._openOverlay(b.l, b.x, b.y);
        return true;
      }
    }
    return mx >= L && mx < L + 147 && my >= T && my < T + 166;
  }

  // keys go to the search field while it is focused
  // GuiRecipeBook.keyPressed: a focused search field takes every key but Escape (so 'E' doesn't close the screen)
  key(e) {
    if (!this.visible || !this.search.focused) return false;
    if (this.search.key(e)) return true;
    return e.code !== 'Escape';
  }
  char(c) {
    if (!this.visible || !this.search.focused) return false;
    return this.search.char(c);
  }

  // the book's area is not "outside" the container
  contains(mx, my) { return this.visible && mx >= this.left - 30 && mx < this.left + 147 && my >= this.top && my < this.top + 166; }
}
