import test from 'node:test';
import assert from 'node:assert/strict';
import {componentFromNbt} from '../client/js/net/component-nbt-1.20.6.js';
import {parseDialog263} from '../client/js/net/dialog-26.3.js';
import {chatSegments} from '../client/js/gui/chat.js';
import {ChatScreen} from '../client/js/gui/screens/chat.js';
import {C} from '../client/js/net/packets.js';
import {PLAY_SERVERBOUND_26_3 as OUT} from '../client/js/net/protocol-26.3-ids.js';
import {Reader26_3} from '../client/js/net/configuration-26.3.js';

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

test('insertion is inherited into chat segments for shift-click', () => {
  const styled=componentFromNbt(compound({text:str('insert'),insertion:str('say hi'),clickEvent:compound({action:str('run_command'),value:str('/say hi')})}));
  const segment=chatSegments(styled).find(part=>part.click);
  assert.equal(segment.style.insertion,'say hi');
});

function chatFixture() {
  const sent=[];
  const comp={click:{action:'run_command',value:'say hi'},style:{}};
  const game={
    hud:{chatComponentAt:()=>comp,queuedChatClick:()=>false,processQueuedChat:()=>true},
    settings:{},screens:{open(){}},send:bytes=>sent.push(bytes),gui:{width:320,height:240}
  };
  const screen=new ChatScreen(game);
  screen.input={text:'',cursor:0,insert(text){this.text+=text;},setText(text){this.text=text;this.cursor=text.length;this.selEnd=text.length;}};
  return {screen,game,sent,comp};
}

test('chat clickable styles are right-click only and send unattended commands', () => {
  const {screen,sent}=chatFixture();
  assert.equal(screen.mouseDown(10,10,0,{shift:false}),false);
  assert.equal(sent.length,0);
  assert.equal(screen.mouseDown(10,10,1,{shift:false}),true);
  assert.equal(sent.length,1);
  const r=new Reader26_3(sent[0]);
  assert.equal(r.varint(),OUT.chat_command);
  assert.equal(r.string(),'say hi');
  assert.equal(r.remaining(),0);
});

test('shift-right-click inserts the style insertion text', () => {
  const {screen,comp}=chatFixture();
  comp.click=null;comp.style={insertion:'inserted'};
  assert.equal(screen.mouseDown(10,10,1,{shift:true}),true);
  assert.equal(screen.input.text,'inserted');
});

test('suggestions apply from any mouse button and consume their rect', () => {
  const {screen}=chatFixture();
  screen.tabMatches=[{match:'foo',tooltip:null}];
  screen.tabBox={x:0,y:0,width:50,rows:1};
  screen.tabBase='';screen.tabReplaceStart=0;screen.tabReplaceEnd=0;screen.tabIndex=0;
  assert.equal(screen.mouseDown(1,1,2,{}),true);
  assert.equal(screen.input.text,'foo');
  screen.tabMatches=[{match:'foo',tooltip:null}];
  screen.tabBox={x:0,y:0,width:50,rows:1};
  assert.equal(screen.mouseDown(60,1,0,{}),false);
});

test('clicked commands trim an optional slash', () => {
  const r=new Reader26_3(C.command('/say hi'));
  assert.equal(r.varint(),OUT.chat_command);
  assert.equal(r.string(),'say hi');
  assert.equal(r.remaining(),0);
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
