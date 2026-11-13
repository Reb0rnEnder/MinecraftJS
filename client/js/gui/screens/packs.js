import {ResourceLoadingScreen} from './loading.js';
import { VANILLA_UI } from '../vanilla-layout.js';
import { ConfirmScreen } from './menus.js';
// GuiScreenResourcePacks: available / selected pack lists, adding packs from files.
import { tr } from '../i18n.js';
import { Screen } from './manager.js';
import { Button } from '../widgets.js';
import { platform } from '../../platform/platform.js';
import { decodePng } from '../../util/png.js';
import { ListOf } from '../slot-list.js';
import {packCompatibility} from '../../resource-pack-compatibility.js';

const ENTRY_W = 200, ENTRY_H = 36;

export class ResourcePacksScreen extends Screen {
  constructor(game, parent) {
    super(game);
    this.parent = parent;
    this.background = 'dirt';
    this.available = [];
    this.selected = [];
    this.loaded = false;
    this.message = '';
    this.icons = new Map();
    this._load();
  }

  async _load() {
    const A = this.game.assets;
    const all = await A.listPacks();
    const active = this.game.settings.resourcePacks || [];
    this.selected = active.map((id) => all.find((p) => p.id === id)).filter(Boolean);
    this.available = all.filter((p) => !active.includes(p.id));
    this.initial = this.selected.map((p) => p.id).join('\n');
    this.loaded = true;
  }

  init() {
    const cx = Math.floor(this.width / 2);
    this.buttons.push(new Button(2, cx - 154, this.height - 26, 150, 20, tr('pack.openFolder'), () => this._add()));
    this.buttons.push(new Button(1, cx + 4, this.height - 26, 150, 20, tr('gui.done'), () => this.done()));
    // Native TransferableSelectionList: 200 wide, 33-pixel header/footer, 36-pixel rows.
    const old = this.lists;
    this.lists = [0, 1].map((side) => {
      const items = () => (side ? [...this.selected, null] : this.available);
      const L = { side, title: tr(side ? 'pack.selected.title' : 'pack.available.title') };
      L.list = new ListOf(this, 33, this.height - 33, ENTRY_H, {
        size: () => (this.loaded ? items().length : 0),
        draw: (gui, i, x, y, h, mx, my) => this._entry(gui, L, items()[i], i, x, y, mx, my),
        click: (i, dbl, mx, my, rx, ry, e) => this._click(L, items()[i], i, rx, ry, e),
        header: (gui, x, y) => {
          const t = '§n§l' + L.title;
          gui.text(t, x + ENTRY_W / 2 - Math.floor(gui.textWidth(t) / 2), Math.min(L.list.top + 3, y), 0xffffff, false);
        },
      }, { left: side ? cx + 15 : cx - 15 - ENTRY_W, width: ENTRY_W, listWidth: ENTRY_W, scrollBarRight: true, header: 13, selectionBox: true, scrollbarDragOnly:true });
      if (old) { L.list.amountScrolled = old[side].list.amountScrolled; L.list.clamp(); }
      return L;
    });
  }

  async _add() {
    const files = await platform().pickFiles({ accept: '.zip', multiple: true });
    for (const f of files) {
      try {
        const pack = await this.game.assets.addPack(f.name, f.bytes);
        this.available = this.available.filter((p) => p.id !== pack.id);
        this.selected = this.selected.filter((p) => p.id !== pack.id);
        this.available.unshift(pack);
        this.message = '§a' + tr('minecraftjs.packs.added', pack.name);
      } catch (e) {
        this.message = '§c' + f.name + ': ' + e.message;
      }
    }
  }

  async done() {
    const ids = this.selected.map((p) => p.id);
    const g = this.game;
    if (ids.join('\n') === this.initial) { g.screens.open(this.parent); return; }
    g.settings.resourcePacks = ids;
    g.settings.save();
    const loading = new ResourceLoadingScreen(g, this.parent);
    g.screens.open(loading);
    try {
      await g.assets.activatePacks(ids);
      await g.reloadResources((msg, pct) => { loading.status = msg; loading.pct = pct; });
    } catch (e) {
      console.error(e);
      this.message = '§c' + tr('minecraftjs.packs.failed', e.message);
    }
    await loading.finish();
    g.screens.open(this.parent);
  }

  close() { this.done(); }

  // Default pack: vanilla shows pack.png from the root of the game jar
  _defaultIcon() {
    const A = this.game.assets;
    const k = 'default@' + A.version;
    if (!this.icons.has(k)) {
      this.icons.set(k, null);
      A.source.bytes('pack.png').then((bytes) => {
        if (!bytes) return;
        const img = decodePng(bytes);
        this.icons.set(k, A.makeTexture('packicon:default', img.width, img.height, img.data, { filter: 'linear' }));
      }).catch(() => {});
    }
    return this.icons.get(k) || 'misc/unknown_pack.png';
  }

  _icon(pack) {
    const A = this.game.assets;
    if (!pack) return this._defaultIcon();
    const k = pack.id + '@' + A.version;
    if (!this.icons.has(k)) {
      this.icons.set(k, pack.icon ? A.makeTexture('packicon:' + pack.id, pack.icon.width, pack.icon.height, pack.icon.data, { filter: 'linear' }) : null);
    }
    return this.icons.get(k) || 'misc/unknown_pack.png';
  }

  render(gui, mx, my) {
    gui.menuBackground(this.game.inWorld);
    for (const L of this.lists) L.list.render(gui, mx, my);
    gui.textCentered(tr('resourcePack.title'), Math.floor(this.width / 2), 5, 0xffffff);
    if (!this.loaded) gui.textCentered(tr('minecraftjs.loading'), this.width / 2, this.height / 2, 0xa0a0a0);
    if (this.message) gui.textCentered(this.message, this.width / 2, this.height - 60, 0xffffff);
    gui.textCentered('§7'+tr('pack.dropInfo'), Math.floor(this.width/2), 19, 0xffffff);
    for (const b of this.buttons) b.render(gui, mx, my);
    const open=this.buttons.find(b=>b.id===2);if(open?.hovered(mx,my))gui.tooltip(gui.font.wrap(tr('pack.folderInfo'),Math.min(300,this.width-20)),mx,my);
  }

  _entry(gui, L, pack, idx, x, y, mx, my) {
    const name = pack ? pack.name : tr('resourcePack.vanilla.name');
    const desc = pack ? pack.builtin ? tr('pack.nameAndSource',pack.description || '',tr('pack.source.builtin')) : pack.description || '' : tr('pack.nameAndSource',tr('resourcePack.vanilla.description'),tr('pack.source.builtin'));
    const compatibility=packCompatibility(pack,VANILLA_UI.packFormat),incompatible=compatibility!=='compatible';
    if (incompatible) gui.rect(x - 1, y - 1, x + ENTRY_W - 3 - (L.list.maxScroll()>0?7:0), y + ENTRY_H - 3, 0xff770000);
    const icon = gui.tex(this._icon(pack));
    if (icon) gui.drawImage(icon, 0, 0, icon.width, icon.height, x, y, 32, 32);
    const overEntry = (!L.list || L.list.inside(my,mx)) && mx >= x && mx < x + ENTRY_W && my >= y && my < y + ENTRY_H;
        if (pack && (overEntry || L.list.focused && L.list.focusedIndex===idx || this.game.settings.touchscreen)) {
      gui.rect(x, y, x + 32, y + 32, 0xa0909090);
      const rx = mx - x, ry = my - y;
      if (L.side === 0) gui.sprite('transferable_list/select'+(rx<32?'_highlighted':''),x,y,32,32);
      else {
        gui.sprite('transferable_list/unselect'+(rx<16?'_highlighted':''),x,y,32,32);
        if (idx > 0) gui.sprite('transferable_list/move_up'+(rx<32&&rx>16&&ry<16?'_highlighted':''),x,y,32,32);
        if (idx < this.selected.length - 1) gui.sprite('transferable_list/move_down'+(rx<32&&rx>16&&ry>16?'_highlighted':''),x,y,32,32);
      }
    }
    const warning = incompatible && (overEntry || L.list.focused && L.list.focusedIndex===idx || this.game.settings.touchscreen);
    let title = warning ? tr('pack.incompatible') : name;
    if (gui.textWidth(title) > 157) title = gui.font.trimToWidth(title, 157 - gui.textWidth('...')) + '...';
    gui.text(title, x + 32 + 2, y + 1, 0xffffff, true);
    const lines = gui.font.wrap(warning ? tr('pack.incompatible.'+compatibility) : desc, 157);
    for (let i = 0; i < Math.min(2, lines.length); i++) gui.text(lines[i], x + 32 + 2, y + 12 + 10 * i, 0x808080, true);
  }

  // ResourcePackListEntry.mousePressed: the icon's arrows move packs between / within the lists
  _click(L, pack, idx, rx, ry, e) {
    this._focus(L.list,idx);
    if (!pack) return false;
    if (L.side === 0) {
      if (e && e.shift) { this._delete(pack); return true; }
      if (rx > 32) return false;
      const add = () => {
        const index=this.available.findIndex(p=>p.id===pack.id);
        if(index>=0){this.available.splice(index,1);this.selected.unshift(pack);}
      };
      if(packCompatibility(pack,VANILLA_UI.packFormat)!=='compatible') {
        this.game.screens.open(new ConfirmScreen(this.game, yes => {
          if(yes)add();
          this.game.screens.open(this);
        },tr('pack.incompatible.confirm.title'),tr('pack.incompatible.confirm.'+packCompatibility(pack,VANILLA_UI.packFormat))));
      } else add();
    } else {
      if (rx > 32) return false;
      if (rx < 16) { this.selected.splice(idx, 1); this.available.unshift(pack); }
      else if (rx>16 && ry < 16 && idx > 0) { this.selected.splice(idx, 1); this.selected.splice(idx - 1, 0, pack); }
      else if (rx>16 && ry > 16 && idx < this.selected.length - 1) { this.selected.splice(idx, 1); this.selected.splice(idx + 1, 0, pack); }
      else return false;
    }
    return true;
  }

  _focus(widget,index){
    for(const L of this.lists)L.list.focused=false;
    for(const b of this.buttons)b.focused=false;
    this.focusedWidget=widget;widget.focused=true;
    if(index!==undefined)widget.focusedIndex=index;
  }
  key(e){
    const widgets=[...this.lists.map(L=>L.list),...this.buttons];
    if(e.code==='Tab'){
      const i=widgets.findIndex(w=>w.focused),next=(i+(e.shift?-1:1)+widgets.length)%widgets.length;
      this._focus(widgets[next]);if(widgets[next].size?.()&&widgets[next].focusedIndex===undefined)widgets[next].focusedIndex=0;
      return true;
    }
    const L=this.lists.find(L=>L.list.focused);
    if(L){
      const i=L.list.focusedIndex??0,items=L.side?[...this.selected,null]:this.available,pack=items[i];
      if(e.shift&&L.side&&pack&&['ArrowUp','ArrowDown'].includes(e.code)){
        const to=i+(e.code==='ArrowUp'?-1:1);
        if(to>=0&&to<this.selected.length){this.selected.splice(i,1);this.selected.splice(to,0,pack);L.list.focusedIndex=to;}
        return true;
      }
      if(['Enter','NumpadEnter','Space'].includes(e.code)){
        if(pack)this._click(L,pack,i,0,0,e);
        return true;
      }
      if(L.list.key(e))return true;
    }
    return super.key(e);
  }

  mouseDown(mx, my, button, e) {
    if (super.mouseDown(mx, my, button)) return true;
    if (!this.loaded) return false;
    for (const L of this.lists) if (L.list.mouseDown(mx, my, button, e)) return true;
    return false;
  }
  mouseUp(mx, my, button) { super.mouseUp(mx, my, button); for (const L of this.lists) L.list.mouseUp(); }
  mouseMove(mx, my) { for (const L of this.lists) L.list.mouseMove(mx, my); }

  async _delete(pack) {
    if(pack.builtin)return;
    await this.game.assets.removePack(pack.id);
    this.available = this.available.filter((p) => p !== pack);
    this.message = '§e' + tr('minecraftjs.packs.deleted', pack.name);
  }

  wheel(d) {
    const [mx, my] = this.game.screens._mouse();
    for (const L of this.lists) if (L.list.inside(my, mx)) L.list.wheel(d);
  }
}
