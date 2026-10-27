import{test}from'node:test';import assert from'node:assert/strict';
import{Scoreboard}from'../client/js/game/scoreboard.js';
const make=()=>new Scoreboard({username:'Me',entities:{all:()=>[]}});
const team=(team,players,color=12,collisionRule='never')=>({team,mode:0,players,color,collisionRule,prefix:'',suffix:'',displayName:team});
test('colored sidebars work regardless of packet order and follow team color changes with default fallback',()=>{
 const s=make();s.onDisplay({position:1,objective:'default'});s.onDisplay({position:15,objective:'red'});s.onDisplay({position:12,objective:'blue'});assert.equal(s.sidebar,'default');
 s.onTeam(team('a',['Me']));assert.equal(s.sidebar,'red');s.onTeam({...team('a',[],9),mode:2});assert.equal(s.sidebar,'blue');
 s.onDisplay({position:12,objective:''});assert.equal(s.sidebar,'default');s.onTeam({team:'a',mode:1});assert.equal(s.sidebar,'default');
});
