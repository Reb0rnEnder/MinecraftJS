// Screen.keyPressed(Tab) / ContainerEventHandler.changeFocus (1.14-1.19.3): add order, Shift reverses, wraps.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Button,TextField} from '../client/js/gui/widgets.js';
import {tabFocus} from '../client/js/gui/focus-tab.js';
const at=(y)=>new Button(0,10,y,98,20,'b',()=>{});
test('Tab follows add order with fields among buttons and wraps through no focus',()=>{
  const a=at(10),f=new TextField(10,40,200,20),b=at(70),s={buttons:[a,b],fields:[f]};
  tabFocus(s,true);assert.equal(s.focusedWidget,a);
  tabFocus(s,true);assert.equal(s.focusedWidget,f);assert.equal(a.focused,false);
  tabFocus(s,true);assert.equal(s.focusedWidget,b);
  tabFocus(s,true);assert.equal(s.focusedWidget,a);
});
test('Shift+Tab from nothing starts at the last widget and skips inactive ones',()=>{
  const a=at(10),b=at(40),c=at(70),s={buttons:[a,b,c],fields:[]};
  tabFocus(s,false);assert.equal(s.focusedWidget,c);
  b.enabled=false;tabFocus(s,false);assert.equal(s.focusedWidget,a);
});
