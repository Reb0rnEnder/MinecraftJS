import {ConfirmLinkScreen}from'./chat.js';
import {Screen}from'./manager.js';import {Button,TextField}from'../widgets.js';import {tr}from'../i18n.js';import {platform}from'../../platform/platform.js';
const TEX='gui/social_interactions.png';
export class SocialInteractionsScreen extends Screen {
 constructor(game){super(game);game.hiddenPlayers||=new Set();game.socialNames||=new Map();this.page='all';this.scroll=0;}
 init(){
  this.left=Math.floor((this.width-238)/2);this.count=Math.floor(Math.max(52,this.height-144)/16);this.bottom=72+this.count*16;
  this.search=new TextField(this.left+28,78,196,16,{maxLength:16,background:false,onChange:()=>{this.scroll=0;}});this.search.textColor=0xffffff;this.fields=[this.search];
  this.buttons=['all','hidden','blocked'].map((name,i)=>new Button(i,this.left+6+i*76,45,74,20,()=>((name===this.page)?'§n':'')+tr('gui.socialInteractions.tab_'+name),()=>{this.page=name;this.scroll=0;}));
  const label=tr('gui.socialInteractions.blocking_hint'),width=Math.min(310,this.gui.textWidth(label)+40);
  this.manage=new Button(3,(this.width-width)/2,64+this.count*16,width,20,label,()=>this.game.screens.open(new ConfirmLinkScreen(this.game,this,'https://aka.ms/javablocking')));this.buttons.push(this.manage);
 }
 entries(){
  const g=this.game;for(const [uuid,p]of g.scoreboard.players)g.socialNames.set(uuid,p.name);
  const hidden=g.hiddenPlayers,blocked=g.blockedPlayers||new Set(),uuids=this.page==='all'?[...g.scoreboard.players.keys()]:[...(this.page==='hidden'?hidden:blocked)];
  const query=this.search.text.toLowerCase();return uuids.map(uuid=>({uuid,name:g.socialNames.get(uuid)||uuid,player:g.scoreboard.players.get(uuid),hidden:hidden.has(uuid),blocked:blocked.has(uuid)})).filter(e=>e.name.toLowerCase().includes(query)).sort((a,b)=>a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
 }
 hide(entry){const g=this.game;if(entry.hidden)g.hiddenPlayers.delete(entry.uuid);else g.hiddenPlayers.add(entry.uuid);g.sound.playUi('ui.button.click');g.hud.addChat(tr(entry.hidden?'gui.socialInteractions.shown_in_chat':'gui.socialInteractions.hidden_in_chat',entry.name),null,true);}
 renderContent(gui,mx,my){
  const x=this.left+3;gui.blit(TEX,x,64,1,1,236,8);for(let i=0;i<this.count;i++)gui.blit(TEX,x,72+i*16,1,10,236,16);gui.blit(TEX,x,this.bottom,1,27,236,8);gui.blit(TEX,x+10,76,243,1,12,12);
  const total=this.game.scoreboard.players.size;gui.text(tr('gui.socialInteractions.server_label.'+(total===1?'single':'multiple'),this.game.serverAddress?.host||'',String(total)),this.left+8,35,0xffffff);
  if(!this.search.focused&&!this.search.text)gui.text('§o'+tr('gui.socialInteractions.search_hint'),this.search.x,this.search.y+4,0x808080);
  const entries=this.entries(),height=this.bottom-88;this.scroll=Math.max(0,Math.min(this.scroll,entries.length*36-height));this.manage.visible=this.page==='blocked';this.rows=[];let tooltip=null;
  gui.scissor(this.left+9,88,220,height);
  for(const [i,e]of entries.entries()){
   const y=88+i*36-this.scroll;if(y+36<88||y>this.bottom)continue;
   gui.rect(this.left+9,y,this.left+229,y+36,e.hidden||e.blocked||!e.player?0xff303030:0xff4a4a4a);
   const skin=gui.tex(this.game.entityRenderer.skinImage(e.player||{uuid:e.uuid,name:e.name}));if(skin){const k=skin.width/64;gui.drawImage(skin,8*k,8*k,8*k,8*k,this.left+13,y+6,24,24);gui.drawImage(skin,40*k,8*k,8*k,8*k,this.left+13,y+6,24,24);}
   const state=e.blocked?'blocked':e.hidden?'hidden':'';gui.text(e.name,this.left+41,y+(state||!e.player?9:14),0xffffff);
   if(state||!e.player)gui.text('§o'+tr('gui.socialInteractions.status_'+(state?state+(!e.player?'_offline':''):'offline')),this.left+41,y+21,0x8cffffff);
   if(e.uuid!==this.game.playerUuid&&!e.blocked){const bx=this.left+205,by=y+8,hover=mx>=bx&&mx<bx+20&&my>=by&&my<by+20;gui.blit(TEX,bx,by,e.hidden?20:0,38+(hover?20:0),20,20);this.rows.push({entry:e,x:bx,y:by});if(hover)tooltip=tr(e.hidden?'gui.socialInteractions.tooltip.show':'gui.socialInteractions.tooltip.hide',e.name);}
  }
  gui.clearScissor();
  if(!entries.length)gui.textCentered('§o'+tr(this.search.text?'gui.socialInteractions.search_empty':'gui.socialInteractions.empty_'+this.page),this.width/2,(78+this.bottom)/2,0xffffff);
  this.tooltip=tooltip;
 }
 render(gui,mx,my,partial){super.render(gui,mx,my,partial);if(this.tooltip)gui.tooltip(gui.font.wrap(this.tooltip,150),mx,my);}
 mouseDown(mx,my,button){if(button===0&&my>=88&&my<this.bottom){const row=this.rows?.find(r=>mx>=r.x&&mx<r.x+20&&my>=r.y&&my<r.y+20);if(row){this.hide(row.entry);return true;}}return super.mouseDown(mx,my,button);}
 wheel(delta){this.scroll+=delta*18;}
 key(e){if(!this.search.focused&&e.code===this.game.settings.keys.socialInteractions){this.close();return true;}return super.key(e);}
}
