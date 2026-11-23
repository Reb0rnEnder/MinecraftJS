import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ZipFile} from '../lib/zip.js';
import {OptionsScreen,AccessibilityScreen,OnlineOptionsScreen,CreditsAndAttributionScreen,ControlsScreen,MouseSettingsScreen,KeyBindsScreen} from '../client/js/gui/screens/options.js';
import {ResourcePacksScreen} from '../client/js/gui/screens/packs.js';
import {packCompatibility} from '../client/js/resource-pack-compatibility.js';
import {TitleScreen} from '../client/js/gui/screens/menus.js';
import {CreditsScreen,creditLines} from '../client/js/gui/screens/credits.js';
import {MENU_BLUR,MenuBlur} from '../client/js/render/menu-blur.js';
import {VANILLA_UI} from '../client/js/gui/vanilla-layout.js';
import {setPlatform} from '../client/js/platform/platform.js';
import {C} from '../client/js/net/packets.js';
import {C766} from '../client/js/net/configuration-1.20.6.js';
import {Reader} from '../client/js/net/buffer.js';
const fixture=JSON.parse(readFileSync(new URL('./port-1.20.6/ui-layout-fixtures.json',import.meta.url))),jar=new ZipFile(new URL('../cache/port-1.20.6/client.jar',import.meta.url));
setPlatform({now:()=>0});
function game(width=640,height=360){return {inWorld:false,settings:{fov:70,menuBackgroundBlur:.5,realmsNotifications:true,allowServerListing:true,save(){}},gui:{width,height,textWidth:s=>s.length*6,font:{wrap:s=>[s]}},assets:{readText:async p=>p.endsWith('credits.json')?'[]':'',splashes:[]},screens:{open(s){this.current=s;}},socialBlocking:{sync(){}},send(){},sound:{playUi(){}}};}

test('Options layout matches exact native Java HeaderAndFooterLayout/GridLayout at all recorded sizes',()=>{
  assert.equal(fixture.clientJarSha1,VANILLA_UI.clientJarSha1);
  const box=b=>[b.x,b.y,b.w,b.h];
  for(const expected of fixture.cases){const g=game(...expected.size),s=new OptionsScreen(g,null);s.init();assert.deepEqual(box(s.buttons[0]),expected.fov);assert.deepEqual(box(s.buttons[1]),expected.online);assert.deepEqual(s.buttons.slice(2,12).map(box),expected.buttons);assert.deepEqual(box(s.buttons.at(-1)),expected.done);assert.equal(s.buttons[10].enabled,false);}
});
test('new Accessibility options construct, retain native order and expose the real blur and shortcut settings',()=>{
  const g=game(),s=new AccessibilityScreen(g,null);g.narrator={label:()=>'',active:false};s.init();
  assert.deepEqual(s.rows.flat().map(b=>b.optionKey),VANILLA_UI.accessibilityOptions);
  const blur=s.rows.flat().find(b=>b.optionKey.endsWith('menu_background_blurriness'));blur.onChange(.9);assert.equal(g.settings.menuBackgroundBlur,.9);
  s.rows.flat().find(b=>b.optionKey==='options.hideSplashTexts').onClick();assert.equal(g.settings.hideSplashTexts,true);
  s.rows.flat().find(b=>b.optionKey==='options.accessibility.narrator_hotkey').onClick();assert.equal(g.settings.narratorHotkey,true);
  assert.equal(s.list.top,33);assert.equal(s.list.bottom,g.gui.height-33);
});
test('Online options includes disabled difficulty only in a world and sends server-listing preference in both phases',()=>{
  for(const inWorld of [false,true]){const g=game();g.inWorld=inWorld;g.difficulty=2;const s=new OnlineOptionsScreen(g,null);s.init();assert.equal(s.rows.flat().length,inWorld?3:2);if(inWorld)assert.equal(s.rows.flat()[2].enabled,false);}
  for(const build of [C.settings,C766.settings]){const r=new Reader(build('en_us',8,0,true,127,1,false));r.varint();assert.equal(r.string(),'en_us');r.i8();r.varint();r.bool();r.u8();r.varint();assert.equal(r.bool(),false);assert.equal(r.bool(),false);}
});
test('Title credits opens attribution menu and menu credits return without sending a respawn',async()=>{
  const g=game(),title=new TitleScreen(g);title.init();assert.ok(title.buttons.some(b=>b.label==='title.credits'));assert.equal(title.usesMenuBackground,false);
  const s=new CreditsAndAttributionScreen(g,title);s.init();assert.equal(s.buttons.length,4);assert.deepEqual(s.buttons.slice(0,3).map(b=>b.w),[210,210,210]);
  let returned=0;g.send=()=>assert.fail('Menu credits must not send a respawn packet');const credits=new CreditsScreen(g,{poem:false,onFinished:()=>returned++});await credits._load();assert.equal(credits.baseSpeed,.75);credits.key({code:'Space'});assert.equal(credits.speed,3.75);credits.key({code:'ControlLeft'});assert.equal(credits.speed,15);credits.key({code:'ArrowUp'});assert.equal(credits.speed,-15);credits.finish();credits.finish();assert.equal(returned,1);
  const native=JSON.parse(jar.read('assets/minecraft/texts/credits.json'));assert.ok(creditLines(native).length>1000);
});
test('menu blur reproduces the native six box_blur passes and skips disabled blur without allocating targets',()=>{
 const native=JSON.parse(jar.read('assets/minecraft/shaders/post/blur.json'));
 assert.deepEqual(MENU_BLUR.passes,native.passes.map(p=>({...p,uniforms:p.uniforms.map(({name,values})=>({name,values}))})));
 const blur=new MenuBlur({createMesh:()=>assert.fail('Disabled blur allocated a mesh')});blur.render(0);blur.render(.09);assert.equal(blur.chain,null);
});

test('resource-pack header and footer match native Java, and the two lists use native bounds',async()=>{
 for(const expected of fixture.cases){
  const g=game(...expected.size);g.assets.listPacks=async()=>[];const s=new ResourcePacksScreen(g,null);await s._load();s.init();
  const box=b=>[b.x,b.y,b.w,b.h];assert.deepEqual(box(s.buttons[0]),expected.packs.folder);assert.deepEqual(box(s.buttons[1]),expected.packs.done);
  assert.equal(s.lists[0].list.left,Math.floor(s.width/2)-215);assert.equal(s.lists[1].list.left,Math.floor(s.width/2)+15);
  for(const L of s.lists){assert.equal(L.list.top,33);assert.equal(L.list.bottom,s.height-33);assert.equal(L.list.slotTop(0),50);}
 }
});
test('resource-pack compatibility supports native optional InclusiveRange formats',()=>{
 for(const supportedFormats of [32,[22,34],{min_inclusive:22,max_inclusive:34}])assert.equal(packCompatibility({format:18,supportedFormats},32),'compatible');
 for(const supportedFormats of [[],[1,2,3],[40,20],{min_inclusive:2}])assert.equal(packCompatibility({format:18,supportedFormats},32),'old');
 assert.equal(packCompatibility({format:32,supportedFormats:[40,50]},32),'new');
 assert.equal(packCompatibility({format:32,supportedFormats:[20,25]},32),'old');
});
test('pack arrows use real sprites on entry hover, warn only for incompatible packs, and keyboard actions move packs',async()=>{
 const g=game();g.settings.resourcePacks=[];g.settings.touchscreen=false;g.assets.listPacks=async()=>[];
 const s=new ResourcePacksScreen(g,null);await s._load();s.init();const pack={id:'custom',name:'custom',format:32,description:'test'};s.available=[pack];
 const sprites=[],gui={rect(){},tex:()=>null,textWidth:s=>s.length,font:{wrap:s=>[s]},text(){},sprite:name=>sprites.push(name)};
 const x=s.lists[0].list.slotLeft();s._entry(gui,s.lists[0],pack,0,x,50,x+90,60);assert.deepEqual(sprites,['transferable_list/select']);
 sprites.length=0;s._entry(gui,s.lists[0],pack,0,x,50,x+5,60);assert.deepEqual(sprites,['transferable_list/select_highlighted']);
 s.key({code:'Tab'});s.key({code:'Enter'});assert.deepEqual(s.selected,[pack]);assert.deepEqual(s.available,[]);
 assert.ok(jar.read('assets/minecraft/textures/gui/sprites/transferable_list/select.png'));assert.equal(jar.read('assets/minecraft/textures/gui/resource_packs.png'),null);
});

test('15px title icons use native integer centering inside their 20px buttons',()=>{
 const g=game(),s=new TitleScreen(g);s.init();const calls=[];
 for(const id of [5,6]){const b=s.buttons.find(b=>b.id===id);b.render({button(){},sprite:(...args)=>calls.push(args)},-1,-1);assert.equal(calls.at(-1)[1],b.x+3);assert.equal(calls.at(-1)[2],b.y+3);}
});

test('Controls uses the native option-list layout and routes its first row to mouse/key-bind screens',()=>{const g=game(),s=new ControlsScreen(g,null);s.init();assert.deepEqual(s.rows.flat().map(b=>b.optionKey),['options.mouse_settings','controls.keybinds','key.sneak','key.sprint','options.autoJump','options.operatorItemsTab']);assert.deepEqual([s.list.top,s.list.bottom],[33,g.gui.height-33]);assert.equal(s.buttons[0].y,g.gui.height-26);s.rows[0][0].onClick();assert.ok(g.screens.current instanceof MouseSettingsScreen);assert.equal(g.screens.current.parent,s);s.rows[0][1].onClick();assert.ok(g.screens.current instanceof KeyBindsScreen);assert.equal(g.screens.current.parent,s);});

const uiState=JSON.parse(readFileSync(new URL('./fixtures/ui-state-1.20.6.json',import.meta.url)));
test('GUI scale matches native Window.calculateScale, including Unicode rounding, and cycles over its dynamic range',async()=>{
 const {calculateGuiScale,nextGuiScale}=await import('../client/js/gui/gui-scale.js');
 assert.equal(uiState.clientJarSha1,VANILLA_UI.clientJarSha1);assert.equal(uiState.scales.length,72);
 for(const c of uiState.scales)assert.equal(calculateGuiScale(c.size[0],c.size[1],c.requested,c.unicode),c.scale,JSON.stringify(c));
 const max=calculateGuiScale(3840,2160);assert.ok(max>3);
 const seen=[];let v=0;do{seen.push(v);v=nextGuiScale(3840,2160,v);}while(v!==0);assert.deepEqual(seen,[...Array(max+1).keys()]);
 assert.equal(nextGuiScale(320,240,4),0);assert.equal(nextGuiScale(640,480,1,true),2);assert.equal(nextGuiScale(640,480,2,true),0);
});
test('title screen fades the panorama, then the widgets, over the native two seconds',async()=>{
 const {titleFade}=await import('../client/js/gui/title-fade.js');
 for(const f of uiState.titleFade){const s=titleFade(f.elapsed);assert.ok(Math.abs(s.panorama-f.panorama)<1e-6,'panorama '+f.elapsed);assert.ok(Math.abs(s.widgets-f.widgets)<1e-6,'widgets '+f.elapsed);assert.equal(s.fading,f.fading,'fading '+f.elapsed);}
 const g=game(),first=new TitleScreen(g),second=new TitleScreen(g);assert.equal(first.fading,true);assert.equal(second.fading,false);
});
test('Language and Pause match native HeaderAndFooterLayout/GridLayout at all recorded sizes',async()=>{
 const {LanguageScreen}=await import('../client/js/gui/screens/options.js'),{PauseScreen}=await import('../client/js/gui/screens/pause.js');
 const box=b=>[b.x,b.y,b.w,b.h];
 for(const expected of fixture.cases){
  const g=game(...expected.size);g.assets.languages={en_us:{name:'English',region:'US'},pl_pl:{name:'Polski',region:'Polska'}};g.assets.language='en_us';
  const l=new LanguageScreen(g,null);l.init();assert.deepEqual(box(l.buttons[0]),expected.language.font);assert.deepEqual(box(l.buttons[1]),expected.language.done);
  assert.equal(l.list.top,33);assert.equal(l.list.bottom,g.gui.height-53);
  const p=new PauseScreen(g);p.init();assert.deepEqual(p.buttons.map(box),expected.pause);
  assert.deepEqual(p.buttons.map(b=>b.label),['menu.returnToGame','gui.advancements','gui.stats','menu.sendFeedback','menu.reportBugs','menu.options','menu.playerReporting','menu.disconnect']);
 }
});
test('multiplayer warning uses the native centred WarningScreen layout and real checkbox sprites',async()=>{
 const {warningLayout,MultiplayerSafetyScreen}=await import('../client/js/gui/screens/menus.js');
 const w=s=>s.length*6,measure=Object.assign(w,{title:60});
 const l=warningLayout(320,240,measure,['a'.repeat(20),'b'.repeat(30)],w('x'.repeat(10)));
 // 9 title + 8 + (18 text + 24 padding) + 8 + (17 checkbox + 8 + 20 row) = 112, centred vertically: (240-112)/2.
 assert.deepEqual(l.title,[130,64,60,9]);assert.deepEqual(l.text,[70,93,180,18]);assert.deepEqual(l.checkbox,[119,131,81,17]);
 assert.deepEqual(l.proceed,[6,156,150,20]);assert.deepEqual(l.back,[164,156,150,20]);
 const g=game(320,240);g.gui.font={wrap:s=>[s]};const s=new MultiplayerSafetyScreen(g,null);s.init();
 const sprites=[];s.buttons[0].render({sprite:n=>sprites.push(n),text(){}},-1,-1);s.buttons[0].onClick();s.buttons[0].render({sprite:n=>sprites.push(n),text(){}},s.buttons[0].x,s.buttons[0].y);
 assert.deepEqual(sprites,['widget/checkbox','widget/checkbox_selected_highlighted']);for(const n of sprites)assert.ok(jar.read('assets/minecraft/textures/gui/sprites/'+n+'.png'));
});
