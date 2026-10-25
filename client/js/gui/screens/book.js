// GuiScreenBook: read written books, edit/sign book & quill (MC|BEdit / MC|BSign)
import { tr } from '../i18n.js';
import { Screen } from './manager.js';
import { Button } from '../widgets.js';
import { C } from '../../net/packets.js';
import { nbt, TAG } from '../../net/nbt.js';
import { chatToLegacy } from '../chat.js';
import {TextEditor,textLines} from '../text-editor.js';
import {platform} from '../../platform/platform.js';

const W = 192, H = 192;

class PageButton {
  constructor(x, y, next, onClick) { this.x = x; this.y = y; this.next = next; this.onClick = onClick; this.visible = true; this.enabled = true; }
  hovered(mx, my) { return mx >= this.x && my >= this.y && mx < this.x + 23 && my < this.y + 13; }
  render(gui, mx, my) {
    if (!this.visible) return;
    const u = this.hovered(mx, my) ? 23 : 0;
    gui.blit('gui/book.png', this.x, this.y, u, this.next ? 192 : 205, 23, 13);
  }
  mouseDown(mx, my, game) {
    if (this.visible && this.hovered(mx, my)) { game.sound.playUi('ui.button.click', 1); this.onClick(); return true; }
    return false;
  }
}

export class BookScreen extends Screen {
  constructor(game, item, editable, hand = 0) {
    super(game);
    this.background = 'none';
    this.item = item;
    this.hand = hand;
    this.editable = editable === undefined ? game.items.name(item.id) === 'writable_book' : editable;
    const tag = game.items.nbt(item) || {};
    this.pages = (tag.pages && tag.pages.length ? tag.pages.slice() : ['']).map((p) => p);
    if (!this.editable) this.pages = this.pages.map((p) => { try { return chatToLegacy(p); } catch (e) { return p; } });
    this.page = 0;
    this.signing = false;
    this.title = '';
    this.modified = false;
    this.counter = 0;
    this.author = tag.author || '';
    this.editor=new TextEditor(()=>this.pages[this.page],s=>{this.pages[this.page]=s;this.modified=true;},s=>s.length<1024&&textLines(s,this.gui.font,114).length*9<=128);
    this.titleEditor=new TextEditor(()=>this.title,s=>{this.title=s;this.updateButtons();},s=>s.length<=16&&!s.includes('\n'));
  }

  init() {
    const g = this.game;
    const x = (this.width - W) / 2, y = 2;
    this.left = x; this.top = y;
    if (this.editable) {
      this.signBtn = new Button(3, this.width / 2 - 100, 4 + H, 98, 20, tr('book.signButton'), () => { this.signing = true; this.updateButtons(); });
      this.doneBtn = new Button(0, this.width / 2 + 2, 4 + H, 98, 20, tr('gui.done'), () => { this.sendBook(false); this.close(); });
      this.finalBtn = new Button(5, this.width / 2 - 100, 4 + H, 98, 20, tr('book.finalizeButton'), () => { if (this.title.trim()) { this.sendBook(true); this.close(); } });
      this.cancelBtn = new Button(4, this.width / 2 + 2, 4 + H, 98, 20, tr('gui.cancel'), () => { this.signing = false; this.updateButtons(); });
      this.buttons.push(this.signBtn, this.doneBtn, this.finalBtn, this.cancelBtn);
    } else {
      this.buttons.push(new Button(0, this.width / 2 - 100, 4 + H, 200, 20, tr('gui.done'), () => this.close()));
    }
    this.nextBtn = new PageButton(x + 120, y + 154, true, () => this.nextPage());
    this.prevBtn = new PageButton(x + 38, y + 154, false, () => { if (this.page > 0) this.page--; this.updateButtons(); });
    this.buttons.push(this.nextBtn, this.prevBtn);
    this.updateButtons();
    void g;
  }

  nextPage() {
    if (this.page < this.pages.length - 1) this.page++;
    else if (this.editable && this.pages.length < 100) { this.pages.push(''); this.page++; this.modified = true; }
    this.updateButtons();
  }

  updateButtons() {
    if(this.editedPage!==this.page){this.editor?.move(this.pages[this.page]?.length||0);this.editedPage=this.page;}
    this.nextBtn.visible = !this.signing && (this.page < this.pages.length - 1 || this.editable);
    this.prevBtn.visible = !this.signing && this.page > 0;
    if (this.editable) {
      this.signBtn.visible = this.doneBtn.visible = !this.signing;
      this.finalBtn.visible = this.cancelBtn.visible = this.signing;
      this.finalBtn.enabled = this.title.trim().length > 0;
    }
  }

  tick() { this.counter++; }

  sendBook(sign) {
    if (!this.modified && !sign) return;
    while (this.pages.length > 1 && !this.pages[this.pages.length - 1]) this.pages.pop();
    const g = this.game;
    const tagObj = { pages: nbt.list(TAG.STRING, this.pages.map((p) => p)) };
    if (sign) {
      tagObj.author = nbt.string(g.username);
      tagObj.title = nbt.string(this.title.trim());
    }
    const root = { t: TAG.COMPOUND, name: '', v: tagObj };
    // The edit_book stack is writable even when signing; the server creates the written book.
    const item = { id:g.items.byName.get('writable_book').id,count:1,nbt:root };
    g.send(C.editBook(item,sign,this.hand));
    const held = g.inventory.getHand(this.hand);
    if (held && g.items.name(held.id) === 'writable_book') { held.nbt = root; held.nbtRaw = null; held._simple = null; }
    this.modified = false;
  }

  key(e) {
    if (e.code === 'Escape') { if (this.editable) this.sendBook(false); this.close(); return true; }
    if (!this.editable) return true;
    if (this.signing) {
      if (e.code === 'Enter' || e.code === 'NumpadEnter') { if (this.title.trim()) { this.sendBook(true); this.close(); } return true; }
      return this.titleEditor.key(e)||super.key(e);
    }
    if (e.code === 'Enter' || e.code === 'NumpadEnter') { this._insert('\n'); return true; }
    return this.editor.key(e,textLines(this.pages[this.page],this.gui.font,114))||super.key(e);
  }

  char(c) {
    if (!this.editable) return true;
    if (this.signing) {this.titleEditor.replace(c);return true;}
    this._insert(c);
    return true;
  }

  _insert(s) {
    this.editor.replace(s);
  }

  _cursorAt(mx,my){const lines=textLines(this.pages[this.page],this.gui.font,114),line=lines[Math.max(0,Math.min(lines.length-1,Math.floor((my-this.top-32)/9)))];let i=line.start;while(i<line.end&&this.gui.textWidth(this.pages[this.page].slice(line.start,i+1))<mx-this.left-36)i++;return i;}
  mouseDown(mx,my,button,e){
    if(super.mouseDown(mx,my,button))return true;
    if(!this.editable||this.signing||button!==0||mx<this.left+36||mx>this.left+150||my<this.top+32||my>this.top+160)return false;
    const now=platform().now(),index=this._cursorAt(mx,my);this.clickCount=now-(this.clickTime||0)<250?(this.clickCount||0)+1:1;this.clickTime=now;
    this.editor.move(index,!!e?.shift);this.dragging=true;
    if(this.clickCount===2){this.editor.move(this.editor.boundary(-1));this.editor.anchor=this.editor.cursor;this.editor.move(this.editor.boundary(1),true);}
    if(this.clickCount>=3){this.editor.anchor=0;this.editor.cursor=this.pages[this.page].length;this.clickCount=0;}
    return true;
  }
  mouseMove(mx,my){if(this.dragging)this.editor.move(this._cursorAt(mx,my),true);}
  mouseUp(mx,my,button){this.dragging=false;super.mouseUp(mx,my,button);}

  render(gui, mx, my) {
    const x = this.left, y = this.top;
    gui.blit('gui/book.png', x, y, 0, 0, W, H);
    if (this.signing) {
      let t = this.title;
      if (Math.floor(this.counter / 6) % 2 === 0) t += '§0_'; else t += '§7_';
      const editTitle = tr('book.editTitle');
      gui.text(editTitle, x + 36 + (116 - gui.textWidth(editTitle)) / 2, y + 16 + 16, 0, false);
      gui.text(t, x + 36 + (116 - gui.textWidth(t)) / 2, y + 48, 0, false);
      const by = tr('book.byAuthor', this.game.username);
      gui.text('§8' + by, x + 36 + (116 - gui.textWidth(by)) / 2, y + 48 + 10, 0, false);
      const lines = gui.font.wrap(tr('book.finalizeWarning'), 116);
      lines.forEach((l, i) => gui.text(l, x + 36, y + 80 + i * 9, 0, false));
    } else {
      const ind = tr('book.pageIndicator', this.page + 1, this.pages.length);
      gui.text(ind, x - gui.textWidth(ind) + W - 44, y + 16, 0, false);
      const text=this.pages[this.page]||'',lines=textLines(text,gui.font,114),[a,b]=this.editor.selection();
      lines.slice(0,14).forEach((l,i)=>{
        const lx=x+36,ly=y+32+i*9;gui.text(l.text,lx,ly,0,false);
        if(this.editable&&a<l.end&&b>l.start){gui.setBlend('invert');gui.rect(lx+gui.textWidth(text.slice(l.start,Math.max(a,l.start))),ly,lx+gui.textWidth(text.slice(l.start,Math.min(b,l.end))),ly+9,0xffffffff);gui.setBlend('alpha');}
        if(this.editable&&this.editor.cursor>=l.start&&this.editor.cursor<=l.end&&Math.floor(this.counter/6)%2===0){const cx=lx+gui.textWidth(text.slice(l.start,this.editor.cursor));gui.rect(cx,ly-1,cx+1,ly+9,0xff000000);}
      });
    }
    for (const b of this.buttons) b.render(gui, mx, my);
  }
}

// GuiSleepMP: chat + "Leave Bed"
export class SleepScreen extends Screen {
  constructor(game) { super(game); this.background = 'none'; this.allowsMovement = false; }
  init() {
    this.buttons.push(new Button(1, this.width / 2 - 100, this.height - 40, 200, 20, tr('multiplayer.stopSleeping'), () => this.wake()));
  }
  wake() {
    const g = this.game;
    g.send(C.entityAction(g.entityId, 2));
  }
  key(e) {
    if (e.code === 'Escape') { this.wake(); return true; }
    if (e.code === this.game.settings.keys.chat) {
      import('./chat.js').then((m) => this.game.screens.open(new m.ChatScreen(this.game, '')));
      return true;
    }
    return true;
  }
  render(gui, mx, my) { for (const b of this.buttons) b.render(gui, mx, my); }
}
