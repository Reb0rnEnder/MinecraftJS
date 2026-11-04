import {ConfirmLinkScreen}from'./chat.js';
import {Screen}from'./manager.js';import {Button,TextField}from'../widgets.js';import {tr}from'../i18n.js';
const TEX='gui/social_interactions.png';
export class SocialInteractionsScreen extends Screen {
 constructor(game){super(game);game.hiddenPlayers||=new Set();game.socialNames||=new Map();this.page='all';this.scroll=0;}
 init(){
  this.game.socialBlocking?.sync();
  this.left=Math.floor((this.width-238)/2);this.count=Math.floor(Math.max(52,this.height-144)/16);this.panelHeight=this.count*16;this.bottom=72+this.panelHeight;this.rowLeft=Math.floor(this.width/2)-108;
  const query=this.search?.text||'';this.search=new TextField(this.left+28,78,196,16,{text:query,maxLength:16,background:false,onChange:()=>{this.scroll=0;}});this.search.textColor=0xffffff;this.fields=[this.search];
  this.buttons=['all','hidden','blocked'].map((name,i)=>new Button(i,[this.rowLeft,Math.floor((this.rowLeft*2+220-73)/2)+1,this.rowLeft+220-73+1][i],45,73,20,()=>((name===this.page)?'§n':'')+tr('gui.socialInteractions.tab_'+name),()=>{this.page=name;this.scroll=0;}));
  const label=tr('gui.socialInteractions.blocking_hint'),width=this.gui.textWidth(label)+40;
  this.manage=new Button(3,Math.floor((this.width-width)/2),64+this.panelHeight,width,20,label,()=>this.game.screens.open(new ConfirmLinkScreen(this.game,this,'https://aka.ms/javablocking')));this.buttons.push(this.manage);
 }
 entries(){
  const g=this.game;for(const [uuid,p]of g.scoreboard.players)g.socialNames.set(uuid,p.name);
  const hidden=g.hiddenPlayers,blocked=g.blockedPlayers||new Set(),uuids=this.page==='all'?[...g.scoreboard.players.keys()]:this.page==='hidden'?[...hidden]:[...g.scoreboard.players.keys()].filter(id=>g.socialBlocking?.isBlocked(id)||blocked.has(id));
  const query=this.search.text.toLowerCase();return uuids.map(uuid=>({uuid,name:g.socialNames.get(uuid)||uuid,player:g.scoreboard.players.get(uuid),hidden:hidden.has(uuid),blocked:!!(g.socialBlocking?.isBlocked(uuid)||blocked.has(uuid))})).filter(e=>e.name.toLowerCase().includes(query)).sort((a,b)=>{const an=a.name.toLowerCase(),bn=b.name.toLowerCase();return an<bn?-1:an>bn?1:0;});
 }
 hide(entry){const g=this.game;if(entry.hidden)g.hiddenPlayers.delete(entry.uuid);else g.hiddenPlayers.add(entry.uuid);g.sound.playUi('ui.button.click');g.hud.addChat(tr(entry.hidden?'gui.socialInteractions.shown_in_chat':'gui.socialInteractions.hidden_in_chat',entry.name),null,true);}
 renderContent(gui,mx,my){
  const x=this.left+3;gui.blit(TEX,x,64,1,1,236,8);for(let i=0;i<this.count;i++)gui.blit(TEX,x,72+i*16,1,10,236,16);gui.blit(TEX,x,this.bottom,1,27,236,8);gui.blit(TEX,x+10,76,243,1,12,12);
  const total=this.game.scoreboard.players.size;gui.text(tr('gui.socialInteractions.server_label.'+(total===1?'single':'multiple'),this.game.serverAddress?.host||'',String(total)),this.left+8,35,0xffffff);
  const entries=this.entries(),height=this.bottom-88;this.scroll=Math.max(0,Math.min(this.scroll,entries.length*36-height+4));this.manage.visible=this.page==='blocked';this.rows=[];let tooltip=null;
  gui.scissor(this.rowLeft,88,220,height);
  for(const [i,e]of entries.entries()){
   const y=92+i*36-Math.floor(this.scroll);if(y+32<88||y>this.bottom)continue;
   gui.rect(this.rowLeft,y,this.rowLeft+220,y+32,e.hidden||e.blocked||!e.player?0xff303030:0xff4a4a4a);
   const skin=gui.tex(this.game.entityRenderer.skinImage(e.player||{uuid:e.uuid,name:e.name}));if(skin){const k=skin.width/64;gui.drawImage(skin,8*k,8*k,8*k,8*k,this.rowLeft+4,y+4,24,24);gui.drawImage(skin,40*k,8*k,8*k,8*k,this.rowLeft+4,y+4,24,24);}
   if(!e.player)gui.rect(this.rowLeft+4,y+4,this.rowLeft+28,y+28,0xbe000000);
   const state=e.blocked?'blocked':e.hidden?'hidden':'';gui.text(e.name,this.rowLeft+32,y+(state||!e.player?7:11),0xffffff);
   if(state||!e.player)gui.text('§o'+tr('gui.socialInteractions.status_'+(state?state+(!e.player?'_offline':''):'offline')),this.rowLeft+32,y+19,0x8cffffff);
   if(e.uuid!==this.game.playerUuid&&!e.blocked){const bx=this.rowLeft+196,by=y+6,hover=mx>=bx&&mx<bx+20&&my>=by&&my<by+20;gui.blit(TEX,bx,by,e.hidden?20:0,38+(hover?20:0),20,20);this.rows.push({entry:e,x:bx,y:by});if(hover)tooltip=tr(e.hidden?'gui.socialInteractions.tooltip.show':'gui.socialInteractions.tooltip.hide',e.name);}
  }
  gui.clearScissor();
  const maxScroll=Math.max(0,entries.length*36-height+4);this.scrollbar=null;if(maxScroll>0){const sx=Math.floor(this.width/2)+124,thumb=Math.max(32,Math.min(height-8,Math.floor(height*height/(entries.length*36)))),ty=88+Math.floor(this.scroll)*(height-thumb)/maxScroll;this.scrollbar={x:sx,height,thumb,max:maxScroll};gui.rect(sx,88,sx+6,this.bottom,0xff000000);gui.rect(sx,Math.floor(ty),sx+6,Math.floor(ty)+thumb,0xff808080);gui.rect(sx,Math.floor(ty),sx+5,Math.floor(ty)+thumb-1,0xffc0c0c0);}

  if(!entries.length&&(this.search.text||this.page!=='all'))gui.textCentered('§o'+tr(this.search.text?'gui.socialInteractions.search_empty':'gui.socialInteractions.empty_'+this.page),this.width/2,(78+this.bottom)/2,0xffffff);
  this.tooltip=tooltip;
 }
 render(gui,mx,my,partial){super.render(gui,mx,my,partial);if(!this.search.focused&&!this.search.text)gui.text('§o'+tr('gui.socialInteractions.search_hint'),this.search.x+0,this.search.y+0,0x808080);if(this.tooltip)gui.tooltip(gui.font.wrap(this.tooltip,150),mx,my);}
 mouseDown(mx,my,button){if(button===0&&this.scrollbar&&mx>=this.scrollbar.x&&mx<this.scrollbar.x+6&&my>=88&&my<this.bottom){this.dragY=my;return true;}if(button===0&&my>=88&&my<this.bottom){const row=this.rows?.find(r=>mx>=r.x&&mx<r.x+20&&my>=r.y&&my<r.y+20);if(row){this.hide(row.entry);return true;}}return super.mouseDown(mx,my,button);}
 mouseUp(mx,my,button){delete this.dragY;super.mouseUp(mx,my,button);}
 mouseMove(mx,my){if(this.dragY===undefined||!this.scrollbar)return;const delta=my-this.dragY;this.dragY=my;const b=this.scrollbar;this.scroll=my<88?0:my>this.bottom?b.max:Math.max(0,Math.min(b.max,this.scroll+delta*Math.max(1,b.max/(b.height-b.thumb))));}
 wheel(delta){this.scroll+=delta*18;}
 key(e){if(!this.search.focused&&e.code===this.game.settings.keys.socialInteractions){this.close();return true;}return super.key(e);}
}
