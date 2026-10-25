import {platform} from '../platform/platform.js';

// Cursor/selection state shared by book pages and titles. Offsets are UTF-16, like Java strings.
export class TextEditor {
  constructor(get,set,validate=()=>true){this.get=get;this.set=set;this.validate=validate;this.cursor=this.anchor=get().length;}
  selection(){return [Math.min(this.cursor,this.anchor),Math.max(this.cursor,this.anchor)];}
  move(position,select=false){this.cursor=Math.max(0,Math.min(this.get().length,position));if(!select)this.anchor=this.cursor;}
  replace(text){
    text=text.replace(/\r\n?/g,'\n').replace(/\t/g,'    ').replace(/[\u0000-\u0008\u000b-\u001f\u007f§]/g,'');
    const s=this.get(),[a,b]=this.selection(),next=s.slice(0,a)+text+s.slice(b);
    if(!this.validate(next))return false;
    this.set(next);this.cursor=this.anchor=a+text.length;return true;
  }
  boundary(direction){const s=this.get();let i=this.cursor;if(direction<0){while(i&&/\s/.test(s[i-1]))i--;while(i&&!/\s/.test(s[i-1]))i--;}else{while(i<s.length&&!/\s/.test(s[i]))i++;while(i<s.length&&/\s/.test(s[i]))i++;}return i;}
  key(e,lines){
    const s=this.get(),[a,b]=this.selection();
    if(e.ctrl){
      if(e.code==='KeyA'){this.anchor=0;this.cursor=s.length;return true;}
      if(e.code==='KeyC'||e.code==='KeyX'){platform().setClipboard(s.slice(a,b));if(e.code==='KeyX')this.replace('');return true;}
      if(e.code==='KeyV')return true; // Clipboard paste arrives through char.
    }
    const step=dir=>{if(e.ctrl)return this.boundary(dir);if(dir<0)return this.cursor-(this.cursor>1&&/[\uDC00-\uDFFF]/.test(s[this.cursor-1])?2:1);return this.cursor+(this.cursor+1<s.length&&/[\uD800-\uDBFF]/.test(s[this.cursor])?2:1);};
    if(e.code==='Backspace'||e.code==='Delete'){if(a===b)this.anchor=Math.max(0,Math.min(s.length,step(e.code==='Backspace'?-1:1)));this.replace('');return true;}
    if(e.code==='ArrowLeft'||e.code==='ArrowRight'){this.move(!e.shift&&a!==b?(e.code==='ArrowLeft'?a:b):step(e.code==='ArrowLeft'?-1:1),e.shift);return true;}
    const row=lines?.findIndex((l,i)=>this.cursor<=l.end||i===lines.length-1),line=row>=0?lines[row]:null;
    if(e.code==='Home'||e.code==='End'){this.move(e.ctrl||!line?(e.code==='Home'?0:s.length):(e.code==='Home'?line.start:line.end),e.shift);return true;}
    if((e.code==='ArrowUp'||e.code==='ArrowDown')&&line){const next=lines[Math.max(0,Math.min(lines.length-1,row+(e.code==='ArrowUp'?-1:1)))];this.move(Math.min(next.end,next.start+this.cursor-line.start),e.shift);return true;}
    return false;
  }
}

export function textLines(text,font,width){
  const lines=[];let start=0;
  do{
    let end=start,lastSpace=-1;
    while(end<text.length&&text[end]!=='\n'&&font.width(text.slice(start,end+1))<=width){if(text[end]===' ')lastSpace=end;end++;}
    let next=end;
    if(text[end]==='\n')next=end+1;
    else if(end<text.length&&lastSpace>=start){end=lastSpace;next=lastSpace+1;}
    else if(end===start&&end<text.length)next=++end;
    lines.push({start,end,text:text.slice(start,end)});start=next;
  }while(start<text.length);
  if(text.endsWith('\n'))lines.push({start:text.length,end:text.length,text:''});
  return lines;
}
