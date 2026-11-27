import test from 'node:test';
import assert from 'node:assert/strict';
import {componentFromNbt} from '../client/js/net/component-nbt-1.20.6.js';
import {parseDialog263} from '../client/js/net/dialog-26.3.js';
import {chatSegments} from '../client/js/gui/chat.js';

const str=value=>({t:8,v:value});
const compound=value=>({t:10,v:value});
const component=(text,clickEvent)=>compound({text:str(text),clickEvent});

test('26.3 chat accepts every server-allowed click action shape', () => {
  const copy=componentFromNbt(component('copy',compound({action:str('copy_to_clipboard'),value:str('hello')})));
  assert.equal(copy.clickEvent.action,'copy_to_clipboard');
  const page=componentFromNbt(component('page',compound({action:str('change_page'),page:{t:3,v:2}})));
  assert.equal(page.clickEvent.page,2);
  assert.throws(()=>componentFromNbt(component('page',compound({action:str('change_page'),page:{t:3,v:0}}))),/change_page/);
  const custom=componentFromNbt(component('custom',compound({action:str('custom'),id:str('demo:action'),payload:compound({k:str('v')})})));
  assert.equal(custom.clickEvent.id,'demo:action');
  assert.equal(custom.clickEvent.payloadTag.t,10);
});

test('show_dialog keeps the tagged dialog holder for the native parser', () => {
  const dialog=compound({
    type:str('minecraft:notice'),
    title:str('Server dialog'),
    action:compound({label:str('OK'),action:compound({type:str('minecraft:run_command'),command:str('/say hi')})})
  });
  const parsedComponent=componentFromNbt(component('open',compound({action:str('show_dialog'),dialog})));
  const segment=chatSegments(parsedComponent).find(part=>part.click);
  assert.equal(segment.click.action,'show_dialog');
  const parsedDialog=parseDialog263(segment.click.dialogTag);
  assert.equal(parsedDialog.type,'notice');
  assert.equal(parsedDialog.title,'Server dialog');
  assert.equal(parsedDialog.buttons[0].action.command,'/say hi');
});
