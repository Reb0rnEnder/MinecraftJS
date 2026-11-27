// NarratorChatListener with the browser's speech synthesis standing in for Mojang's text2speech. Modes
// (GameSettings.narrator): 0 off, 1 all, 2 chat, 3 system. Ctrl+B cycles them and shows the narrator toast.
import {platform} from '../platform/platform.js';
import { tr } from './i18n.js';
import { chatToPlain, parseLenientJson } from './chat.js';

export const NARRATOR_MODES = ['options.narrator.off', 'options.narrator.all', 'options.narrator.chat', 'options.narrator.system'];

export class Narrator {
  constructor(game) { this.game = game;this.widgets=new WeakMap(); }

  // Narrator.active(): speech is available
  get active() { return typeof speechSynthesis !== 'undefined' && typeof SpeechSynthesisUtterance !== 'undefined'; }

  say(text,interrupt=false) {
    if (!this.active || !text) return;
    try {
      if(interrupt)this.clear();
      text=String(text).replace(/§./g,'');
      const u = new SpeechSynthesisUtterance(text);
      const lang = String(this.game.settings.language || 'en_us').split('_');
      u.lang = lang[0] + (lang[1] ? '-' + lang[1].toUpperCase() : '');
      speechSynthesis.speak(u);
    } catch (e) { /* speech unavailable */ }
  }

  // Widgets report their narration label, kind and hover state each frame; Screen narration reads them.
  widget(widget,hovered,label,kind='button'){this.widgets.set(widget,{hovered:!!hovered,label,kind,frame:this.frame|0});}

  // AbstractWidget.updateWidgetNarration: depth-1 TITLE and USAGE
  _widgetEntries(widget,state,focused){
    const label=state.label,kind=state.kind,out={};
    out.title=widget.narration?.()||(kind==='editBox'?tr('gui.narrate.editBox',label,widget.text??''):label?tr('gui.narrate.'+kind,label):'');
    if(kind==='button')out.usage=tr(focused?'narration.button.usage.focused':'narration.button.usage.hovered');
    else if(kind==='slider')out.usage=tr(focused?'narration.slider.usage.focused':'narration.slider.usage.hovered');
    return out;
  }

  // Screen.updateNarrationState / updateNarratedWidget collected as ScreenNarrationCollector does: entries keyed by
  // (type, depth), spoken TITLE, POSITION, HINT, USAGE in depth order and joined with ". ". Opening a screen speaks
  // everything at once and suppresses narration for 2 s; later only changed entries are spoken, 750 ms after the
  // mouse or 200 ms after the keyboard changed them.
  screenFrame(screen,children,lastInputKeyboard){
    const frame=this.frame|0;this.frame=frame+1; // widgets recorded `frame` while this screen rendered
    if(![1,3].includes(this.game.settings.narrator|0)||!this.active)return;
    const now=platform().now();
    const entries=new Map(),add=(type,depth,text)=>{if(text)entries.set(type+':'+depth,{type,depth,text});};
    add('title',0,screen.narrationTitle?.()??(typeof screen.title==='string'?screen.title:''));
    add('usage',0,tr('narrator.screen.usage'));
    const list=children.filter(w=>w.visible!==false&&w.enabled!==false&&this.widgets.get(w)?.frame===frame);
    const focused=list.find(w=>w.focused),hovered=list.find(w=>this.widgets.get(w).hovered);
    const pick=focused||(this.lastNarratable&&list.includes(this.lastNarratable)&&this.widgets.get(this.lastNarratable).hovered?this.lastNarratable:hovered);
    if(pick){
      this.lastNarratable=pick;
      if(list.length>1){add('position',0,tr('narrator.position.screen',list.indexOf(pick)+1,list.length));if(pick===focused)add('usage',0,tr('narration.component_list.usage'));}
      const w=this._widgetEntries(pick,this.widgets.get(pick),pick===focused);add('title',1,w.title);add('usage',1,w.usage);
    }
    const order=['title','position','hint','usage'],speak=(changedOnly)=>[...entries.values()].filter(e=>!changedOnly||this.spoken?.get(e.type+':'+e.depth)!==e.text).sort((x,y)=>order.indexOf(x.type)-order.indexOf(y.type)||x.depth-y.depth).map(e=>e.text).join('. ');
    if(this.narratedScreen!==screen){
      this.narratedScreen=screen;this.spoken=new Map([...entries].map(([k,e])=>[k,e.text]));this.suppressUntil=now+2000;this.pendingAt=null;
      this.saySystem(speak(false));return;
    }
    const changed=[...entries].some(([k,e])=>this.spoken.get(k)!==e.text);
    if(!changed){this.pendingAt=null;return;}
    if(this.pendingAt===null||this.pendingAt===undefined)this.pendingAt=now+(lastInputKeyboard?200:750);
    if(now<this.pendingAt||now<this.suppressUntil)return;
    const text=speak(true);this.spoken=new Map([...entries].map(([k,e])=>[k,e.text]));this.pendingAt=null;
    if(text)this.saySystem(text);
  }
  saySystem(text){
    if(![1,3].includes(this.game.settings.narrator|0)||!text)return;
    this.clear();this.say(text);
  }

  clear() { try { if (this.active) speechSynthesis.cancel(); } catch (e) { /* speech unavailable */ } }

  // NarratorChatListener.say: chat (position 0) and system (1) messages; "chat.type.text" reads as "<name> says <text>"
  onChat(position, json) {
    const n = this.game.settings.narrator | 0;
    if (n === 0 || !this.active) return;
    if(typeof json==='string'){try{json=parseLenientJson(json);}catch{ /* Plain server text. */ }}
    const type = position === 0 ? 'chat' : position === 1 ? 'system' : null;
    if (!type || !(n === 1 || (n === 2 && type === 'chat') || (n === 3 && type === 'system'))) return;
    if (json && typeof json === 'object' && json.translate === 'chat.type.text') {
      const args = (json.with || []).map((a) => chatToPlain(a, { parsed: true }));
      this.say(this.game.assets.translate('chat.type.text.narrate', args),position===1);
    } else this.say(chatToPlain(json,{parsed:true}),position===1);
  }

  // GameSettings.setOptionValue(NARRATOR): next mode (stays off without speech), then announceMode
  cycle() {
    const s = this.game.settings;
    s.narrator = this.active ? ((s.narrator | 0) + 1) % NARRATOR_MODES.length : 0;
    s.save();
    this.announceMode(s.narrator);
  }

  announceMode(n) {
    this.clear();
    this.say(tr('options.narrator') + ' : ' + tr(NARRATOR_MODES[n]));
    const hud = this.game.hud;
    if (!this.active) hud.systemToast('narrator', tr('narrator.toast.disabled'), tr('options.narrator.notavailable'));
    else if (n === 0) hud.systemToast('narrator', tr('narrator.toast.disabled'), null);
    else hud.systemToast('narrator', tr('narrator.toast.enabled'), tr(NARRATOR_MODES[n]));
  }

  label() {
    const s = this.game.settings;
    return tr('options.narrator') + ': ' + (this.active ? tr(NARRATOR_MODES[s.narrator | 0]) : tr('options.narrator.notavailable'));
  }
}
