import assert from 'node:assert/strict';
import {test} from 'node:test';
import {ChatScreen} from '../client/js/gui/screens/chat.js';
function fixture(){const sent=[],screen=new ChatScreen({gui:{width:320,height:240},hud:{sentHistory:[],chatScroll:0,addChat(){},chatComponentAt:()=>null},interaction:{target:null},screens:{close(){}},send:p=>sent.push(p)},'');screen.init();return {screen,sent};}
test('legacy completion preserves text after the cursor and cycles names',()=>{
 const {screen,sent}=fixture();screen.input.setText('/tell Al suffix');screen.input.cursor=screen.input.selEnd=8;screen.tabComplete();assert.equal(sent.length,1);
 screen.onTabComplete(['Alex','Alice']);assert.equal(screen.input.text,'/tell Alex suffix');assert.equal(screen.input.cursor,10);
 screen.tabComplete();assert.equal(screen.input.text,'/tell Alice suffix');assert.equal(screen.input.cursor,11);
});
test('legacy completion ignores responses after editing or moving the cursor',()=>{
 const {screen}=fixture();screen.input.setText('/tell Al');screen.tabComplete();screen.input.char('x');screen.onTabComplete(['Alex']);assert.equal(screen.input.text,'/tell Alx');assert.equal(screen.tabMatches,null);
 screen.tabComplete();screen.input.cursor=2;screen.onTabComplete(['wrong']);assert.equal(screen.input.text,'/tell Alx');assert.equal(screen.tabMatches,null);
});
