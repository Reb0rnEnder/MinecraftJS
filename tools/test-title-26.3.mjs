import {test} from 'node:test';
import assert from 'node:assert/strict';
import {TitleScreen,titleLayout} from '../client/js/gui/screens/menus.js';
import {titleFade263} from '../client/js/gui/title-fade.js';
import {setPlatform} from '../client/js/platform/platform.js';

setPlatform({now:()=>0});

function game(width=640,height=360){
  return {
    inWorld:false,
    settings:{hideSplashTexts:false,skipMultiplayerWarning:true,save(){}},
    gui:{width,height,textWidth:s=>s.length*6,font:{wrap:s=>[s]}},
    assets:{splashes:[],readText:async()=>''},
    screens:{open(s){this.current=s;}},
    socialBlocking:{sync(){}},
    accounts:{active:()=>({name:'Dev',type:'offline'})},
    proxies:{current:()=>null},
    sound:{playUi(){}},
    updateWindowTitle(){},
  };
}

test('title screen uses the native 26.3 row and icon-column layout',()=>{
  assert.deepEqual(titleLayout(640,360),{
    singleplayer:[220,138,200,20],
    multiplayer:[220,162,200,20],
    realms:[220,186,200,20],
    friends:[286,210,20,20],
    language:[310,210,20,20],
    accessibility:[334,210,20,20],
    options:[220,234,98,20],
    quit:[322,234,98,20],
  });

  const s=new TitleScreen(game());s.init();
  const box=id=>{const b=s.buttons.find(b=>b.id===id);return [b.x,b.y,b.w,b.h];};
  assert.deepEqual(box(1),[220,138,200,20]);
  assert.deepEqual(box(2),[220,162,200,20]);
  assert.deepEqual(box(14),[220,186,200,20]);
  assert.deepEqual(box(3),[286,210,20,20]);
  assert.deepEqual(box(5),[310,210,20,20]);
  assert.deepEqual(box(6),[334,210,20,20]);
  assert.deepEqual(box(0),[220,234,98,20]);
  assert.deepEqual(box(4),[322,234,98,20]);
  assert.equal(s.buttons.find(b=>b.id===3).enabled,false);
});

test('title screen leaves the panorama up and fades widgets over the native two seconds',()=>{
  const at=t=>titleFade263(t);
  assert.deepEqual(at(0),{panorama:1,widgets:0,fading:true});
  assert.deepEqual(at(500),{panorama:1,widgets:0,fading:true});
  assert.deepEqual(at(1000),{panorama:1,widgets:0,fading:true});
  assert.deepEqual(at(1500),{panorama:1,widgets:0.5,fading:true});
  assert.deepEqual(at(2000),{panorama:1,widgets:1,fading:true});
  assert.deepEqual(at(2001),{panorama:1,widgets:1,fading:false});
});
