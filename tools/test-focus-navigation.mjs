// Screen.keyPressed and ContainerEventHandler tab + arrow navigation (1.19.4: no automatic initial focus).
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Button,TextField} from '../client/js/gui/widgets.js';
import {navigate,setInitialFocus,nextArrow,changeFocus} from '../client/js/gui/focus-navigation.js';
const screen=(widgets,fields=[])=>({width:320,height:240,buttons:widgets,fields});
const at=(x,y,w=98,h=20)=>new Button(0,x,y,w,h,'b',()=>{});
test('Tab follows add order (fields mixed with buttons), wraps through no focus, Shift+Tab reverses',()=>{
  const a=at(10,10),f=new TextField(10,40,200,20),b=at(10,70);
  const s=screen([a,b],[f]);
  navigate(s,{code:'Tab'});assert.equal(s.focusedWidget,a);
  navigate(s,{code:'Tab'});assert.equal(s.focusedWidget,f);
  navigate(s,{code:'Tab'});assert.equal(s.focusedWidget,b);
  navigate(s,{code:'Tab'});assert.equal(s.focusedWidget,a);
  navigate(s,{code:'Tab',shift:true});assert.equal(s.focusedWidget,b);
  b.enabled=false;navigate(s,{code:'Tab',shift:true});assert.equal(s.focusedWidget,f);
});
test('no automatic initial focus in 1.19.4; an explicitly focused box keeps it',()=>{
  const a=at(10,10),b=at(10,40);let s=screen([a,b]);
  setInitialFocus(s);assert.equal(s.focusedWidget,null);assert.equal(a.focused,undefined);
  const f=new TextField(0,0,10,10,{focused:true});s=screen([at(0,50)],[f]);
  setInitialFocus(s);assert.equal(s.focusedWidget,f);
});
test('arrows pick the nearest overlapping widget in the direction, then the vaguely nearest',()=>{
  // title-screen style grid: one wide row, then two half buttons
  const wide=at(60,100,200),left=at(60,124,98),right=at(162,124,98),quit=at(162,148,98);
  const s=screen([wide,left,right,quit]);
  assert.equal(nextArrow(s,'ArrowDown'),wide); // nothing focused: from the top border
  changeFocus(s,wide);assert.equal(nextArrow(s,'ArrowDown'),left);
  changeFocus(s,left);assert.equal(nextArrow(s,'ArrowRight'),right);
  assert.equal(nextArrow(s,'ArrowDown'),quit); // no overlap below: nearest edge midpoint
  changeFocus(s,quit);assert.equal(nextArrow(s,'ArrowUp'),right);
  assert.equal(nextArrow(s,'ArrowLeft'),left);
});
test('click focus keeps a box that cannot lose focus',()=>{
  const f=new TextField(0,0,50,10,{focused:true,canLoseFocus:false}),b=at(0,40);const s=screen([b],[f]);
  changeFocus(s,b);assert.equal(f.focused,true);assert.equal(b.focused,true);
});
