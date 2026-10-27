import{test}from'node:test';import assert from'node:assert/strict';
import{decodePacket578,Writer578}from'../client/js/net/protocol-1.15.2.js';import{Game}from'../client/js/game/game.js';import{Scoreboard}from'../client/js/game/scoreboard.js';import{teamsCanPush}from'../client/js/game/entity-pushing.js';import{chatToPlain}from'../client/js/gui/chat.js';
test('wire team packets keep their runtime dispatch name, restore sidebar text and honor collision=never',()=>{
 const bytes=new Writer578().varint(76).string('line').i8(0).string('{"text":"Line"}').i8(0).string('always').string('never').varint(6).string('{"text":"Rank: ","color":"yellow"}').string('{"text":" Player","color":"white"}').varint(2).string('§6§f§6§6§l┃§6 §7').string('Local').build();
 const packet=decodePacket578(bytes);assert.equal(packet.name,'scoreboard_team');const g={username:'Local',entities:{all:()=>[]}};g.scoreboard=new Scoreboard(g);Game.prototype['on_'+packet.name].call(g,packet);
 assert.equal(chatToPlain(g.scoreboard.formatName('§6§f§6§6§l┃§6 §7')),'Rank: ┃  Player');assert.equal(teamsCanPush(g.scoreboard.playerTeam.get('Local'),null),false);
});
