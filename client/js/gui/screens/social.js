import {ConfirmLinkScreen}from'./chat.js';
import {Screen}from'./manager.js';import {Button,TextField}from'../widgets.js';import {tr}from'../i18n.js';import {platform}from'../../platform/platform.js';
// Native 1.20.6 SocialInteractionsScreen: title header and Done footer, the social_interactions/background panel,
// a bordered search box, All/Hidden/Blocked tabs and a ContainerObjectSelectionList of 36-pixel player rows.
const ROW_W=220,ROW_H=36,TOOLTIP_DELAY=500;
export class SocialInteractionsScreen extends Screen {
 constructor(game,parent=null){super(game);this.parent=parent;game.hiddenPlayers||=new Set();game.socialNames||=new Map();this.page='all';this.scroll=0;}
 // listHeight(): max(52, height - 128 - 16)
 get listHeight(){return Math.max(52,this.height-144);}
 init(){
  this.game.socialBlocking?.sync();
  const W=this.width,H=this.height,m=this.listHeight;
  this.left=Math.floor((W-238)/2);this.listTop=88;this.bottom=88+m;this.rowLeft=Math.floor(W/2)-Math.floor(ROW_W/2)+2;
  const query=this.search?.text||'';this.search=new TextField(this.left+28,74,200,15,{text:query,maxLength:16,background:true,onChange:()=>{this.scroll=0;}});this.search.textColor=0xffffff;this.fields=[this.search];
  const rowRight=this.rowLeft+ROW_W,tab=Math.floor(ROW_W/3);
  this.buttons=['all','hidden','blocked'].map((name,i)=>new Button(i,[this.rowLeft,Math.floor((this.rowLeft+rowRight-tab)/2)+1,rowRight-tab+1][i],45,tab,20,()=>((name===this.page)?'\u00a7n':'')+tr('gui.socialInteractions.tab_'+name),()=>{this.page=name;this.scroll=0;}));
  this.manage=new Button(3,Math.floor(W/2)-100,64+m,200,20,tr('gui.socialInteractions.blocking_hint'),()=>this.game.screens.open(new ConfirmLinkScreen(this.game,this,'https://aka.ms/javablocking')));this.buttons.push(this.manage);
  this.buttons.push(new Button(4,Math.floor(W/2)-100,H-26,200,20,tr('gui.done'),()=>this.close()));
 }
 close(){if(this.parent)this.game.screens.open(this.parent);else this.game.screens.close();}
 entries(){
  const g=this.game;for(const [uuid,p]of g.scoreboard.players)g.socialNames.set(uuid,p.name);
  const hidden=g.hiddenPlayers,blocked=g.blockedPlayers||new Set(),uuids=this.page==='all'?[...g.scoreboard.players.keys()]:this.page==='hidden'?[...hidden]:[...g.scoreboard.players.keys()].filter(id=>g.socialBlocking?.isBlocked(id)||blocked.has(id));
  const query=this.search.text.toLowerCase();return uuids.map(uuid=>({uuid,name:g.socialNames.get(uuid)||uuid,player:g.scoreboard.players.get(uuid),hidden:hidden.has(uuid),blocked:!!(g.socialBlocking?.isBlocked(uuid)||blocked.has(uuid))})).filter(e=>e.name.toLowerCase().includes(query)).sort((a,b)=>{const rank=e=>e.uuid===g.playerUuid?0:String(e.uuid).replace(/-/g,'')[12]==='2'?4:3,ar=rank(a),br=rank(b);if(ar!==br)return ar-br;const valid=e=>/^[a-z0-9_]/i.test(e.name)?0:1;if(valid(a)!==valid(b))return valid(a)-valid(b);const an=a.name.toLowerCase(),bn=b.name.toLowerCase();return an<bn?-1:an>bn?1:0;});
 }
 hide(entry){const g=this.game;if(entry.hidden)g.hiddenPlayers.delete(entry.uuid);else g.hiddenPlayers.add(entry.uuid);g.sound.playUi('ui.button.click');g.hud.addChat(tr(entry.hidden?'gui.socialInteractions.shown_in_chat':'gui.socialInteractions.hidden_in_chat',entry.name),null,true);}
 maxScroll(n){return Math.max(0,n*ROW_H-(this.bottom-this.listTop-4));}
 scrollBarX(){return Math.floor(this.width/2)-Math.floor(ROW_W/2)+ROW_W+10;}
 renderContent(gui,mx,my){
  const W=this.width,m=this.listHeight;
  gui.textCentered(tr('gui.socialInteractions.title'),Math.floor(W/2),12,0xffffff);
  gui.sprite('social_interactions/background',this.left+3,64,236,m+16);gui.sprite('icon/search',this.left+13,76,12,12);
  const total=this.game.scoreboard.players.size;gui.text(tr('gui.socialInteractions.server_label.'+(total>1?'multiple':'single'),this.game.serverAddress?.host||'',String(total)),this.left+8,35,0xffffff,true);
  const entries=this.entries(),max=this.maxScroll(entries.length);this.scroll=Math.max(0,Math.min(this.scroll,max));this.manage.visible=this.page==='blocked';this.rows=[];let tip=null;
  const inList=my>=this.listTop&&my<this.bottom;
  gui.scissor(this.rowLeft-2,this.listTop+4,W,this.bottom-this.listTop-4);
  for(const [i,e]of entries.entries()){
   const y=this.listTop+4+i*ROW_H-Math.floor(this.scroll),h=ROW_H-4,x=this.rowLeft;if(y+h<this.listTop||y>this.bottom)continue;
   const status=e.blocked?(e.player?'blocked':'blocked_offline'):e.hidden?(e.player?'hidden':'hidden_offline'):e.player?'':'offline';
   gui.rect(x,y,x+ROW_W,y+h,status?0xff303030:0xff4a4a4a);
   const fy=y+Math.floor((h-24)/2),skin=gui.tex(this.game.entityRenderer.skinImage(e.player||{uuid:e.uuid,name:e.name}));
   if(skin){const k=skin.width/64;gui.drawImage(skin,8*k,8*k,8*k,8*k,x+4,fy,24,24);gui.drawImage(skin,40*k,8*k,8*k,8*k,x+4,fy,24,24);}
   if(!e.player)gui.rect(x+4,fy,x+28,fy+24,0xbe000000);
   if(status){const ty=y+Math.floor((h-18)/2);gui.text(e.name,x+32,ty,0xffffff,false);gui.text('\u00a7o'+tr('gui.socialInteractions.status_'+status),x+32,ty+12,0x8cffffff,false);}
   else gui.text(e.name,x+32,y+Math.floor((h-9)/2),0xffffff,false);
   if(e.uuid!==this.game.playerUuid&&!e.blocked){
    const by=y+Math.floor((h-20)/2),hx=x+(ROW_W-20-4)-20-4,rx=x+ROW_W-20-4,over=(bx)=>inList&&mx>=bx&&mx<bx+20&&my>=by&&my<by+20;
    gui.sprite('social_interactions/'+(e.hidden?'unmute':'mute')+'_button'+(over(hx)?'_highlighted':''),hx,by,20,20);this.rows.push({entry:e,x:hx,y:by});
    // Reporting needs a signed Microsoft session, which this client does not have: the native disabled state.
    gui.sprite('social_interactions/report_button_disabled',rx,by,20,20);
    if(over(rx))tip=['report',tr('gui.socialInteractions.tooltip.report.disabled')];
    if(over(hx))tip=[e.uuid+(e.hidden?'show':'hide'),tr(e.hidden?'gui.socialInteractions.tooltip.show':'gui.socialInteractions.tooltip.hide',e.name)];
   }
  }
  gui.clearScissor();
  this.scrollbar=null;
  if(max>0){const sx=this.scrollBarX(),lh=this.bottom-this.listTop,content=entries.length*ROW_H,thumb=Math.max(32,Math.min(lh-8,Math.floor(lh*lh/content))),ty=Math.max(this.listTop,Math.floor(Math.floor(this.scroll)*(lh-thumb)/max)+this.listTop);this.scrollbar={x:sx,height:lh,thumb,max};gui.sprite('widget/scroller_background',sx,this.listTop,6,lh);gui.sprite('widget/scroller',sx,ty,6,thumb);}
  const mid=Math.floor((72+72+m)/2);
  if(!entries.length&&this.search.text)gui.textCentered('\u00a77'+tr('gui.socialInteractions.search_empty'),Math.floor(W/2),mid,0xffffff);
  else if(!entries.length&&this.page!=='all')gui.textCentered('\u00a77'+tr('gui.socialInteractions.empty_'+this.page),Math.floor(W/2),mid,0xffffff);
  // Button tooltips appear after the native 500 ms delay
  const now=platform().now();if(!tip||tip[0]!==this.tipKey){this.tipKey=tip?.[0];this.tipSince=now;}
  this.tooltip=tip&&now-this.tipSince>=TOOLTIP_DELAY?tip[1]:null;
 }
 render(gui,mx,my,partial){super.render(gui,mx,my,partial);if(!this.search.focused&&!this.search.text)gui.text('\u00a77\u00a7o'+tr('gui.socialInteractions.search_hint'),this.search.x+4,this.search.y+3,0xffffff,true);if(this.tooltip)gui.tooltip(this.tooltip.split('\n').flatMap(l=>gui.font.wrap(l,170)),mx,my);}
 mouseDown(mx,my,button){if(button===0&&this.scrollbar&&mx>=this.scrollbar.x&&mx<this.scrollbar.x+6&&my>=this.listTop&&my<this.bottom){this.dragY=my;return true;}if(button===0&&my>=this.listTop&&my<this.bottom){const row=this.rows?.find(r=>mx>=r.x&&mx<r.x+20&&my>=r.y&&my<r.y+20);if(row){this.hide(row.entry);return true;}}return super.mouseDown(mx,my,button);}
 mouseUp(mx,my,button){delete this.dragY;super.mouseUp(mx,my,button);}
 mouseMove(mx,my){if(this.dragY===undefined||!this.scrollbar)return;const delta=my-this.dragY;this.dragY=my;const b=this.scrollbar;this.scroll=my<this.listTop?0:my>this.bottom?b.max:Math.max(0,Math.min(b.max,this.scroll+delta*Math.max(1,b.max/(b.height-b.thumb))));}
 wheel(delta){this.scroll+=delta*ROW_H/2;}
 key(e){if(!this.search.focused&&e.code===this.game.settings.keys.socialInteractions){this.close();return true;}return super.key(e);}
}
