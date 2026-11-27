import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Reader} from '../client/js/net/buffer.js';
import {Writer26_3} from '../client/js/net/configuration-26.3.js';
import {COMPONENT_READERS_26_3} from '../client/js/net/item-components-26.3.js';
import {readComponentNbt,writeComponentNbt} from '../client/js/net/component-nbt-1.20.6.js';

const samples=JSON.parse(readFileSync(new URL('./port-26.3/fixtures/components-26.3.json',import.meta.url),'utf8'));

test('every native 26.3 component sample re-reads from its own consumed bytes', () => {
  let checked=0;
  for(const [name,{hex}] of Object.entries(samples)){
    const read=COMPONENT_READERS_26_3[name];
    if(!read)continue;
    const bytes=Buffer.from(hex,'hex');
    const first=new Reader(bytes);
    const value=read(first);
    assert.equal(first.remaining(),0,name+' consumed its native sample');
    const consumed=bytes.subarray(0,first.offset);
    const second=new Reader(consumed);
    assert.deepEqual(read(second),value,name+' re-reads the same value from its consumed bytes');
    assert.equal(second.remaining(),0,name+' re-read consumed every byte');
    checked++;
  }
  assert.equal(checked,61,'checked every readable component sample');
});

function roundTrip(component){
  const w=new Writer26_3();
  writeComponentNbt(w,component);
  const bytes=w.build();
  const r=new Reader(bytes);
  const value=readComponentNbt(r);
  assert.equal(r.remaining(),0,'text component consumed exactly');
  const w2=new Writer26_3();
  writeComponentNbt(w2,value);
  assert.deepEqual(w2.build(),bytes,'text component re-encodes to the same native bytes');
  return value;
}

test('26.3 outbound text components round-trip through the anonymous NBT codec', () => {
  assert.equal(roundTrip('hello'),'hello');
  const styled=roundTrip({
    text:'Click me',color:'#ff0000',bold:true,italic:false,underlined:true,
    font:'minecraft:uniform',insertion:'insert',clickEvent:{action:'run_command',value:'/say hi'},
    hoverEvent:{action:'show_text',contents:'a tooltip'}
  });
  assert.equal(styled.text,'Click me');
  assert.equal(styled.clickEvent.action,'run_command');
  assert.equal(styled.hoverEvent.contents,'a tooltip');
  const translated=roundTrip({translate:'chat.type.text',fallback:'%s: %s',with:['Steve','hello']});
  assert.equal(translated.translate,'chat.type.text');
  const scored=roundTrip({score:{name:'Steve',objective:'points'}});
  assert.equal(scored.score.objective,'points');
  assert.equal(roundTrip({selector:'@a'}).selector,'@a');
  assert.equal(roundTrip({nbt:'Inventory[0]',interpret:true}).nbt,'Inventory[0]');
  assert.equal(roundTrip({keybind:'key.jump'}).keybind,'key.jump');
  const nested=roundTrip({text:'root',extra:[{text:' child',color:'red'},{text:' tail'}],separator:{text:'|'}});
  assert.equal(nested.extra.length,2);
  assert.equal(roundTrip([{text:'first'},{text:'second'}]).extra[0].text,'second');
  assert.deepEqual(roundTrip({text:'',clickEvent:{action:'change_page',page:3}}).clickEvent,{action:'change_page',page:3});
  assert.deepEqual(roundTrip({text:'copy',clickEvent:{action:'copy_to_clipboard',value:'text'}}).clickEvent,{action:'copy_to_clipboard',value:'text'});
  assert.deepEqual(roundTrip({text:'suggest',clickEvent:{action:'suggest_command',value:'/help'}}).clickEvent,{action:'suggest_command',value:'/help'});
  assert.deepEqual(roundTrip({text:'url',clickEvent:{action:'open_url',value:'https://example.invalid'}}).clickEvent,{action:'open_url',value:'https://example.invalid'});
});
