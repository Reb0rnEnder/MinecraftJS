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

  // AbstractWidget queues mouse hover after 750 ms and focused widgets after
  // 200 ms; changing a hovered label queues a fresh 200 ms announcement.
  widget(widget,hovered,label,kind='button'){
    const focused=!!widget.focused,active=widget.enabled!==false&&widget.visible!==false&&(hovered||focused);
    const now=platform().now(),previous=this.widgets.get(widget);
    if(!active){this.widgets.delete(widget);return;}
    if(!label&&!widget.narration){this.widgets.delete(widget);return;}
    const text=widget.narration?.()||(kind==='editBox'?tr('gui.narrate.editBox',label,widget.text):tr('gui.narrate.'+kind,label));
    let state=previous;
    if(!state||state.text!==text||state.focused!==focused){state={text,focused,at:now+(focused||state?200:750),said:false};this.widgets.set(widget,state);}
    if(!state.said&&now>=state.at){this.saySystem(text);state.said=true;}
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
