import{test}from'node:test';import assert from'node:assert/strict';
import{captureText}from'../client/js/debug/text-capture.js';import{setPlatform}from'../client/js/platform/platform.js';
import{Scoreboard}from'../client/js/game/scoreboard.js';
test('text capture preserves packets and formatting, exports locally, then restores dispatch methods',()=>{
 let downloaded,calls=0;setPlatform({saveFile:(name,data,mime)=>downloaded={name,data,mime}});
 const prototype={on_chat(p){calls++;this.last=p.message;},on_scoreboard_team(p){this.scoreboard.onTeam(p);}};
 const g=Object.assign(Object.create(prototype),{assets:{translate:()=> 'MinecraftJS',lang:{greeting:'Hello %s'}},hud:{chat:[]},secret:'excluded'});g.scoreboard=new Scoreboard(g);
 const capture=captureText(g,{limit:2}),packet={message:JSON.stringify({translate:'greeting',with:[{text:'world'}]})};g.on_chat(packet);packet.message='changed';g.on_scoreboard_team({mode:0,team:'a',players:['Me'],prefix:'prefix',suffix:'suffix'});
 const data=capture.dump();assert.equal(calls,1);assert.notEqual(data.packets[0].packet.message,packet.message);assert.equal(data.translations.greeting,'Hello %s');assert.ok(data.packets[1].scoreboard.teams.length);assert.equal(data.secret,undefined);
 capture.download();assert.equal(downloaded.name,'minecraftjs-text-capture.json');assert.ok(JSON.parse(new TextDecoder().decode(downloaded.data)).packets.length===2);
 capture.stop();assert.equal(Object.hasOwn(g,'on_chat'),false);assert.equal(g.on_chat,prototype.on_chat);
});
