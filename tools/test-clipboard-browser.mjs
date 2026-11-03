import{test}from'node:test';import assert from'node:assert/strict';import{createServer}from'node:http';import{readFile}from'node:fs/promises';import{resolve,sep}from'node:path';import{fileURLToPath}from'node:url';
const root=resolve(fileURLToPath(new URL('../client/',import.meta.url)));
test('real browser editing and clipboard work on secure-context and LAN-style HTTP origins',{skip:!process.env.PLAYWRIGHT_MODULE},async()=>{
 const{chromium}=await import(process.env.PLAYWRIGHT_MODULE),server=createServer(async(req,res)=>{try{if(req.url==='/'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><title>Canvas clipboard regression</title>');return;}const path=resolve(root,'.'+req.url);if(!path.startsWith(root+sep))throw Error();res.setHeader('Content-Type',path.endsWith('.json')?'application/json':'text/javascript');res.end(await readFile(path));}catch{res.writeHead(404);res.end();}});await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{browser=await chromium.launch({headless:true,args:['--no-sandbox','--no-proxy-server','--host-resolver-rules=MAP clipboard.test 127.0.0.1']});
 for(const host of['127.0.0.1','clipboard.test']){
  const context=await browser.newContext(),errors=[];const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto('http://'+host+':'+server.address().port);
  const supported=await page.evaluate(async()=>{
   const{BrowserPlatform}=await import('/js/platform/browser.js'),{setPlatform}=await import('/js/platform/platform.js'),{ChatScreen}=await import('/js/gui/screens/chat.js'),{CommandBlockScreen}=await import('/js/gui/screens/commandblock.js'),{BookScreen}=await import('/js/gui/screens/book.js'),{CreativeScreen}=await import('/js/gui/screens/containers.js'),{Items}=await import('/js/game/items.js'),{Inventory}=await import('/js/game/container.js');
   const p=new BrowserPlatform();setPlatform(p);window.clipboardPlatform=p;const copy=p.setClipboard.bind(p);p.setClipboard=s=>(window.lastCopy=copy(s));const data={};for(const name of['items','blocks','creative','enchantments','foods','materials','entities','effects'])data[name]=await(await fetch('/data/'+name+'.json')).json();
   const game={gui:{width:400,height:300,font:{width:s=>s.length*6,wrap:s=>s.split('\n')},textWidth:s=>s.length*6},settings:{keys:{},autoSuggestCommands:false,operatorItemsTab:false},assets:{data,itemsById:new Map(data.items.map(i=>[i.id,i])),itemsByName:new Map(data.items.map(i=>[i.name,i])),lang:{},translate:k=>k},hud:{chatScroll:0,chatHistory:[]},player:{creative:true},gameMode:1,heldSlot:0,effects:new Map(),enabledFeatures:new Set(['minecraft:vanilla']),canUseCommandBlock:()=>false,screens:{close(){},_mouse:()=>[-10,-10]},sound:{playUi(){}},send(){},world:{getState:()=>0}};game.items=new Items(game.assets);game.inventory=new Inventory(game);
   p.on('keydown',e=>window.activeEditor?.screen.key(e));p.on('char',s=>window.activeEditor?.screen.char(s));
   window.openEditor=(kind,text)=>{
    let screen,field,read;
    if(kind==='chat'){screen=new ChatScreen(game,text);screen.init();field=screen.input;}
    else if(kind==='command'){screen=new CommandBlockScreen(game,{x:0,y:0,z:0});screen.init();field=screen.commandField;field.setText(text);field.focused=true;}
    else if(kind==='search'){screen=new CreativeScreen(game);screen.init();screen.setTab((Array.isArray(data.creative.tabs)?data.creative.tabs.find(t=>t.label==='search')?.index:5)??5);field=screen.search;field.focused=true;field.enabled=true;field.setText(text);}
    else{screen=new BookScreen(game,{id:game.items.byName.get('writable_book')?.id||386,count:1},true);screen.init();screen.pages[0]=text;screen.editor?.move(text.length);if(kind==='title'){screen.signing=true;screen.title=text;screen.updateButtons();screen.titleEditor?.move(text.length);}read=()=>kind==='title'?screen.title:screen.pages[0];}
    window.activeEditor={screen,field,read:read||(()=>field.text)};p.canvas.focus();return{selectable:!!field||!!screen.editor};
   };
   return{secure:window.isSecureContext,clipboard:!!navigator.clipboard};
  });
  assert.equal(supported.secure,host==='127.0.0.1');assert.equal(supported.clipboard,host==='127.0.0.1');
  for(const kind of['chat','command','search','book','title']){
   const label='Hello Ω',cap=await page.evaluate(([kind,label])=>window.openEditor(kind,label),[kind,label]);
   if(cap.selectable){await page.keyboard.press('Control+A');await page.keyboard.press('Control+C');await page.evaluate(()=>window.lastCopy);assert.equal(await page.evaluate(()=>window.activeEditor.read()),label,kind+' copy');await page.keyboard.press('Control+X');await page.evaluate(()=>window.lastCopy);assert.equal(await page.evaluate(()=>window.activeEditor.read()),'',kind+' cut');}
   else{await page.evaluate(label=>window.openEditor('chat',label),label);await page.keyboard.press('Control+A');await page.keyboard.press('Control+C');await page.evaluate(()=>window.lastCopy);await page.evaluate(kind=>window.openEditor(kind,''),kind);}
   await page.keyboard.press('Control+V');await page.waitForFunction(label=>window.activeEditor.read()===label,label,{timeout:3000});assert.equal(await page.evaluate(()=>window.activeEditor.read()),label,host+' '+kind+' paste');
  }
  assert.deepEqual(errors,[],host+' event handlers');await context.close();
 }
 }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
});
