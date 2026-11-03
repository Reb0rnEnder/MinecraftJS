// Optional Chromebook function keys. Delay a plain F press until release so a
// chord cannot swap hands before its number arrives. Text editors are untouched.
const FUNCTION_CODES={Digit1:'F1',Digit2:'F2',Digit3:'F3',Digit4:'F4',Digit5:'F5',Digit6:'F6',Digit7:'F7',Digit8:'F8',Digit9:'F9',Digit0:'F10',Minus:'F11',Equal:'F12'};
export class FunctionKeyChords{
 constructor(){this.reset();}
 reset(){this.prefix=null;this.used=false;this.keys=new Map();}
 keyDown(e,enabled){
  if(e.code==='KeyF'&&this.prefix)return [];
  if(this.keys.has(e.code)){const code=this.keys.get(e.code);return code?[{...e,code,key:code}]:[];}
  if(e.code==='KeyF'&&enabled&&!e.ctrl&&!e.alt){if(!e.repeat){this.prefix=e;this.used=false;}return [];}
  if(this.prefix&&FUNCTION_CODES[e.code]){const code=FUNCTION_CODES[e.code];this.used=true;this.keys.set(e.code,code);return[{...e,code,key:code}];}
  if(this.prefix&&!this.used&&e.code!=='KeyF'){const f=this.prefix;this.prefix=null;return[f,e];}
  return[e];
 }
 keyUp(e){
  if(this.keys.has(e.code)){const code=this.keys.get(e.code);this.keys.delete(e.code);return code?[{...e,code,key:code}]:[];}
  if(e.code==='KeyF'&&this.prefix){const f=this.prefix,events=[];if(!this.used)events.push({...f,repeat:false,chordReplay:true},{...e});else for(const[physical,code]of this.keys){if(code)events.push({...e,code,key:code});this.keys.set(physical,null);}this.prefix=null;this.used=false;return events;}
  return[e];
 }
}
