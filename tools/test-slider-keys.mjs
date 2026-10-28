import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Slider} from '../client/js/gui/widgets.js';

test('focused sliders apply native arrow-key steps, clamp, and respect disabled state',()=>{
 let value=.5,changes=0;const slider=new Slider(0,10,20,150,20,String,value,v=>{value=v;changes++;});
 assert.equal(slider.key({code:'ArrowRight'}),true);assert.equal(value,.5+1/142);
 slider.key({code:'ArrowLeft'});assert.ok(Math.abs(value-.5)<1e-9);
 for(let i=0;i<200;i++)slider.key({code:'ArrowLeft'});
 assert.equal(value,0);const count=changes;slider.key({code:'ArrowLeft'});assert.equal(changes,count);
 slider.enabled=false;assert.equal(slider.key({code:'ArrowRight'}),false);assert.equal(value,0);
 slider.enabled=true;for(let i=0;i<200;i++)slider.key({code:'ArrowRight'});assert.equal(value,1);
});
