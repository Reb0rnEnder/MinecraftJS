// Ports of the pinned 1.16.5 HoglinModel, StriderModel and PiglinModel.setupAnim.
const PI=Math.PI,rad=PI/180;
export function animateHoglin(m,a){
 const p=m.parts,attack=1-Math.abs(10-2*(a.attackTicks||0))/10;
 p.rightEar.rz=-.6981317-a.lsa*Math.sin(a.ls);p.leftEar.rz=.6981317+a.lsa*Math.sin(a.ls);
 p.head.ry=a.yaw*rad;p.head.rx=.87266463+attack*(-.34906584-.87266463);
 p.head.py=a.child?2+attack*3:2;p.mane.pz=a.child?-3:-7;
 p.frontRightLeg.rx=p.backLeftLeg.rx=Math.cos(a.ls)*1.2*a.lsa;
 p.frontLeftLeg.rx=p.backRightLeg.rx=Math.cos(a.ls+PI)*1.2*a.lsa;
}
export function animateStrider(m,a){
 const p=m.parts,amount=Math.min(.25,a.lsa),phase=a.ls*1.5;
 p.body.rx=a.hasRider?0:a.pitch*rad;p.body.ry=a.hasRider?0:a.yaw*rad;
 p.body.rz=.4*Math.sin(phase)*amount;p.body.py=2-4*Math.cos(phase)*amount;
 p.leftLeg.rx=Math.sin(phase*.5)*2*amount;p.rightLeg.rx=Math.sin(phase*.5+PI)*2*amount;
 p.leftLeg.rz=.17453292*Math.cos(phase*.5)*amount;p.rightLeg.rz=.17453292*Math.cos(phase*.5+PI)*amount;
 p.leftLeg.py=8+4*Math.sin(phase*.5+PI)*amount;p.rightLeg.py=8+4*Math.sin(phase*.5)*amount;
 const angles=[-1.2217305,-1.134464,-.87266463,.87266463,1.134464,1.2217305],walk=[1.3,1.2,.6,.6,1.2,1.3],idle=[-.4,.2,.4,.4,.2,-.4],scale=[.05,.1,.1,.1,.1,.05];
 for(let i=0;i<6;i++)p['bristle'+i].rz=angles[i]+Math.cos(phase+PI)*amount*walk[i]+scale[i]*Math.sin(a.age*idle[i]);
}
function swingWeapon(p,a){
 const f=Math.sin(a.swing*PI),g=Math.sin((1-(1-a.swing)**2)*PI);
 p.rightArm.rz=p.leftArm.rz=0;p.rightArm.ry=.15707964;p.leftArm.ry=-.15707964;
 p.rightArm.rx=a.leftHanded?Math.cos(a.age*.19)*.5:-1.8849558+Math.cos(a.age*.09)*.15;
 p.leftArm.rx=a.leftHanded?-1.8849558+Math.cos(a.age*.09)*.15:Math.cos(a.age*.19)*.5;
 p.rightArm.rx+=f*(a.leftHanded?1.2:2.2)-g*.4;p.leftArm.rx+=f*(a.leftHanded?2.2:1.2)-g*.4;
 p.rightArm.rz+=Math.cos(a.age*.09)*.05+.05;p.leftArm.rz-=Math.cos(a.age*.09)*.05+.05;
 p.rightArm.rx+=Math.sin(a.age*.067)*.05;p.leftArm.rx-=Math.sin(a.age*.067)*.05;
}
export function animatePiglin(m,a,biped){
 biped(m,a);const p=m.parts,phase=a.age*.1+a.ls*.5,amount=.08+a.lsa*.4;
 p.earRight.rz=-.5235988-Math.cos(phase*1.2)*amount;p.earLeft.rz=.5235988+Math.cos(phase)*amount;
 if(a.zombified){
  const f=Math.sin(Math.max(0,a.swing)*PI),g=Math.sin((1-(1-Math.max(0,a.swing))**2)*PI),base=-PI/(a.aggressive?1.5:2.25);
  p.leftArm.rz=p.rightArm.rz=0;p.leftArm.ry=-(.1-f*.6);p.rightArm.ry=.1-f*.6;
  p.leftArm.rx=p.rightArm.rx=base+f*1.2-g*.4;
  p.rightArm.rz+=Math.cos(a.age*.09)*.05+.05;p.leftArm.rz-=Math.cos(a.age*.09)*.05+.05;
  p.rightArm.rx+=Math.sin(a.age*.067)*.05;p.leftArm.rx-=Math.sin(a.age*.067)*.05;
 }else if(a.piglinPose==='dancing'){
  const f=a.age/60;
  p.earLeft.rz=.5235988+rad*Math.sin(f*30)*10;p.earRight.rz=-.5235988-rad*Math.cos(f*30)*10;
  p.head.px=Math.sin(f*10);p.head.py=Math.sin(f*40)+.4;
  p.rightArm.rz=rad*(70+Math.cos(f*40)*10);p.leftArm.rz=-p.rightArm.rz;
  p.rightArm.py=p.leftArm.py=Math.sin(f*40)*.5+1.5;p.body.py=Math.sin(f*40)*.35;
 }else if(a.piglinPose==='attacking'){
  if(a.swing>0)swingWeapon(p,a);else p[a.leftHanded?'leftArm':'rightArm'].rx=-1.8;
 }else if(a.piglinPose==='admiring'){
  p.head.rx=.5;p.head.ry=0;const arm=p[a.leftHanded?'rightArm':'leftArm'];arm.ry=a.leftHanded?-.5:.5;arm.rx=-.9;
 }else if(a.piglinPose==='crossbow_hold'){
  const main=p[a.leftHanded?'leftArm':'rightArm'],off=p[a.leftHanded?'rightArm':'leftArm'];
  main.ry=(a.leftHanded?.3:-.3)+p.head.ry;off.ry=(a.leftHanded?-.6:.6)+p.head.ry;
  main.rx=-PI/2+p.head.rx+.1;off.rx=-1.5+p.head.rx;
 }else if(a.piglinPose==='crossbow_charge'){
  const main=p[a.leftHanded?'leftArm':'rightArm'],off=p[a.leftHanded?'rightArm':'leftArm'],t=Math.min(1,(a.useTicks||0)/(a.crossbowChargeDuration||25));
  main.ry=a.leftHanded?.8:-.8;main.rx=-.97079635;off.ry=(.4+t*.45)*(a.leftHanded?-1:1);off.rx=-.97079635+t*(-PI/2+.97079635);
 }
 for(const [target,source]of[['headwear','head'],['leftSleeve','leftArm'],['rightSleeve','rightArm'],['leftPants','leftLeg'],['rightPants','rightLeg'],['jacket','body']])for(const key of['px','py','pz','rx','ry','rz'])p[target][key]=p[source][key];
}
export function scaleHoglinChild(groups,child){
 const headScale=child?1.5/1.9:1;groups.head.scale.setScalar(headScale);groups.head.position.set(0,child?8*headScale:0,child?6*headScale:0);
 groups.body.scale.setScalar(child?.5:1);groups.body.position.set(0,child?12:0,0);
}

export function scalePiglinChild(groups,child){
 groups.head.scale.setScalar(child?.75:1);groups.head.position.set(0,child?12:0,0);
 groups.body.scale.setScalar(child?.5:1);groups.body.position.set(0,child?12:0,0);
}
