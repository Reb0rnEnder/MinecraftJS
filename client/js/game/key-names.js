// InputMappings names in 1.13.2 use translated GLFW names; persisted bindings still use browser codes.
import { tr } from '../gui/i18n.js';
const NAMES = {
  ShiftLeft:'left.shift',ShiftRight:'right.shift',ControlLeft:'left.control',ControlRight:'right.control',
  AltLeft:'left.alt',AltRight:'right.alt',MetaLeft:'left.win',MetaRight:'right.win',
  Space:'space',Tab:'tab',Enter:'enter',Escape:'escape',Backspace:'backspace',Delete:'delete',Insert:'insert',
  Home:'home',End:'end',PageUp:'page.up',PageDown:'page.down',CapsLock:'caps.lock',NumLock:'num.lock',ScrollLock:'scroll.lock',
  ArrowUp:'up',ArrowDown:'down',ArrowLeft:'left',ArrowRight:'right',Pause:'pause',PrintScreen:'print.screen',
  Slash:'slash',Backslash:'backslash',Backquote:'grave.accent',Minus:'minus',Equal:'equal',
  BracketLeft:'left.bracket',BracketRight:'right.bracket',Semicolon:'semicolon',Quote:'apostrophe',Comma:'comma',Period:'period',
  NumpadAdd:'keypad.add',NumpadSubtract:'keypad.subtract',NumpadMultiply:'keypad.multiply',NumpadDivide:'keypad.divide',
  NumpadDecimal:'keypad.decimal',NumpadEnter:'keypad.enter',NumpadEqual:'keypad.equal',
};
export function keyName(code) {
  if(!code)return tr('key.keyboard.unknown');
  if(code.startsWith('mouse')) {
    const n=Number(code.slice(5)),name=['left','middle','right'][n]||String(n+1);
    return n < 3 ? tr('key.mouse.'+name) : tr('key.mouse', n+1);
  }
  const name=NAMES[code] || (/^Key[A-Z]$/.test(code)?code.slice(3).toLowerCase():/^Digit[0-9]$/.test(code)?code.slice(5):/^Numpad[0-9]$/.test(code)?'keypad.'+code.slice(6):/^F\d+$/.test(code)?code.toLowerCase():null);
  return name?tr('key.keyboard.'+name):code;
}
