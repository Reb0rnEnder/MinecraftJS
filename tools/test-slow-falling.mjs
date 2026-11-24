// LivingEntity.travel (1.13-1.20.4): gravity is 0.08, or 0.01 while falling with Slow Falling, which also clears the
// fall distance; elytra, water (/16), lava (/4) and land use that value.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {initBlocks,blocksByName} from '../client/js/world/blocks.js';
import {World} from '../client/js/world/world.js';
import {Chunk} from '../client/js/world/chunk.js';
import {LocalPlayer} from '../client/js/game/physics.js';
const json=n=>JSON.parse(readFileSync(new URL('../client/data/'+n+'.json',import.meta.url),'utf8'));
initBlocks(json('blocks'),json('blockCollisionShapes'));
function air(){const world=new World(),chunk=new Chunk(0,0,true,world);world.chunks.set('0,0',chunk);chunk.setState(0,0,0,blocksByName.stone.defaultState??(blocksByName.stone.id<<4));return world;}
const step=(slow,motionY)=>{const world=air(),p=new LocalPlayer();p.setPosition(5.5,40,5.5);p.slowFalling=slow;p.fallDistance=9;p.motionY=motionY;p.motionX=p.motionZ=0;p._moveWithHeading(world,0,0,0.02);return p;};
test('Slow Falling on land: 0.01 gravity while falling and no fall distance build-up',()=>{
 const s=step(true,-0.2);assert.ok(Math.abs(s.motionY-(-0.2-0.01)*0.98)<1e-6,'motion '+s.motionY);assert.ok(s.fallDistance<0.5);
 const n=step(false,-0.2);assert.ok(Math.abs(n.motionY-(-0.2-0.08)*0.98)<1e-6);assert.ok(n.fallDistance>9);
 const up=step(true,0.2);assert.ok(Math.abs(up.motionY-(0.2-0.08)*0.98)<1e-6,'rising uses full gravity');
});
