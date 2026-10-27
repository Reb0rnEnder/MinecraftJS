import {test} from 'node:test';import assert from 'node:assert/strict';
import {FontRenderer,stripCodes} from '../client/js/gui/font.js';
import {Scoreboard} from '../client/js/game/scoreboard.js';
const font=Object.assign(Object.create(FontRenderer.prototype),{_ready(){return true;},_providerSet(){return null;},charW:c=>c==='§'?-1:6});
test('wrapping and trimming keep formatting pairs intact at the width boundary',()=>{
 for(const text of ['abcd§aefghijkl','§labcd efgh ijkl','§aabc§ldefghijk','§lone\ntwo']){
  const lines=font.wrap(text,25);assert.equal(lines.map(stripCodes).join('').replaceAll(' ',''),stripCodes(text).replace(/[ \n]/g,''));
  for(const line of lines){assert.ok(!line.endsWith('§'),line);assert.ok(font.width(line)<=25,line);}
 }
 assert.equal(font.trimToWidth('abcd§aef',24),'abcd§a');assert.ok(font.wrap('§lone\ntwo',25)[1].startsWith('§l'));
});
