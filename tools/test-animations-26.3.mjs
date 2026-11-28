import test from 'node:test';
import assert from 'node:assert/strict';
import {animatePiglin} from '../client/js/render/nether-poses.js';
import {dragonHeadOffset} from '../client/js/render/entity-effects.js';

const part = () => ({px:0,py:0,pz:0,rx:0,ry:0,rz:0});
function piglinPose(extra = {}) {
  const names=['head','headwear','body','rightArm','leftArm','rightLeg','leftLeg','leftSleeve','rightSleeve','leftPants','rightPants','jacket','earRight','earLeft'];
  const parts=Object.fromEntries(names.map(name=>[name,part()]));
  parts.rightArm.py=parts.leftArm.py=2;
  let bipedCalls=0;
  animatePiglin({parts}, {age:0,ls:0,lsa:0,swing:-9999,...extra}, () => {
    bipedCalls++;
    for(const p of Object.values(parts)) Object.assign(p,{px:0,py:0,pz:0,rx:0,ry:0,rz:0});
    parts.rightArm.py=parts.leftArm.py=2;
  });
  return {parts,bipedCalls};
}

const near=(actual,expected,message)=>assert.ok(Math.abs(actual-expected)<1e-6,`${message}: ${actual} != ${expected}`);

test('26.3 piglin ears use the native 30/5 degree rest and left/right signs', () => {
  const adult=piglinPose({age:10,ls:4,lsa:0.5}).parts;
  const phase=10*.1+4*.5, amount=.08+.5*.4;
  near(adult.earLeft.rz,-Math.PI/6-Math.cos(phase*1.2)*amount,'adult left ear');
  near(adult.earRight.rz,Math.PI/6+Math.cos(phase)*amount,'adult right ear');
  const baby=piglinPose({age:10,ls:4,lsa:0.5,child:true}).parts;
  near(baby.earLeft.rz,-5*Math.PI/180-Math.cos(phase*1.2)*amount,'baby left ear');
  near(baby.earRight.rz,5*Math.PI/180+Math.cos(phase)*amount,'baby right ear');
});

test('26.3 piglin dance keeps native ear, head, arm and body offsets', () => {
  const {parts,bipedCalls}=piglinPose({age:60,ls:0,lsa:0,piglinPose:'dancing'});
  assert.equal(bipedCalls,1);
  const f=1;
  near(parts.earRight.rz,Math.PI/6+Math.PI/180*Math.sin(f*30)*10,'dance right ear');
  near(parts.earLeft.rz,-Math.PI/6-Math.PI/180*Math.cos(f*30)*10,'dance left ear');
  near(parts.head.px,Math.sin(f*10),'dance head x');
  near(parts.head.py,Math.sin(f*40)+.4,'dance head y');
  near(parts.rightArm.py,2+Math.sin(f*40)*.5-.5,'dance right arm y');
  near(parts.leftArm.py,2+Math.sin(f*40)*.5+.5,'dance left arm y');
  near(parts.body.py,Math.sin(f*40)*.35,'dance body y');
});

test('26.3 zombified piglin arms follow animateZombieArms and the baby held-item branch', () => {
  const swing=.25, age=7;
  const f=Math.sin(swing*Math.PI), g=Math.sin((1-(1-swing)**2)*Math.PI);
  const adult=piglinPose({age,swing,zombified:true,held:{id:1},aggressive:true}).parts;
  const base=-Math.PI/1.5, x=base+f*1.2-g*.4, y=.1-f*.6;
  near(adult.rightArm.rx,x+Math.sin(age*.067)*.05,'adult right arm x');
  near(adult.leftArm.rx,x-Math.sin(age*.067)*.05,'adult left arm x');
  near(adult.rightArm.ry,-y,'adult right arm y');
  near(adult.leftArm.ry,y,'adult left arm y');
  const baby=piglinPose({age,swing,zombified:true,child:true,held:{id:1},aggressive:false}).parts;
  const bx=-f*1.2-g*.4, by=.1+f*.6;
  near(baby.rightArm.rx,bx+Math.sin(age*.067)*.05,'baby right arm x');
  near(baby.rightArm.ry,by,'baby right arm y');
  near(baby.leftArm.ry,-by,'baby left arm y');
  const spear=piglinPose({age,swing,zombified:true,held:{id:1},rightPose:'spear'}).parts;
  near(spear.rightArm.rx,0,'spear pose leaves the arm alone');
  near(spear.leftArm.rx,0,'spear pose leaves the off arm alone');
});

test('26.3 dragon head-part offset follows the native phase branches', () => {
  assert.equal(dragonHeadOffset(0,6,64,70),0,'normal flight head has no offset');
  assert.equal(dragonHeadOffset(0,2,64,70),6,'normal flight neck uses the history delta');
  assert.equal(dragonHeadOffset(5,6,64,70),6,'sitting uses the part index');
  assert.equal(dragonHeadOffset(10,3,0,0),3,'hovering is sitting');
  assert.equal(dragonHeadOffset(3,4,0,0,8),2,'landing divides the part by distance/4');
  assert.equal(dragonHeadOffset(4,4,0,0,16),1,'takeoff uses the same term');
  assert.equal(dragonHeadOffset(3,4,0,0),0,'no fight origin means a zero landing term');
});
