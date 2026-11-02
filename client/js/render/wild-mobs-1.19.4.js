import{ANIMATIONS_762}from'./animations-1.19.4.js';import{animateKeyframes762}from'./keyframes-1.19.4.js';
const pi=Math.PI,D=pi/180,cos=Math.cos,sin=Math.sin;
export function animateWildMob(model,a){
 const p=model.parts,e=a.entity||{},name=model.jarModel,clips=ANIMATIONS_762[name],play=(key,time=(a.age-(e.wildAnimationStart||0))*50,weight=1)=>animateKeyframes762(p,clips?.[key],time,weight);
 if(p.head){p.head.rx=a.pitch*D;p.head.ry=a.yaw*D;}
 if(name==='tadpole'){p.tail.ry=-(a.inWater?1:1.5)*.25*sin(.3*a.age);return;}
 if(name==='allay'){
  const movement=Math.min(a.lsa/.3,1),idle=1-movement,wing=cos(a.age*20*D+a.ls)*pi*.15+a.lsa,bob=a.age*9*D,holding=e.equipment?.[0]?1:0;
  p.right_wing.rx=p.left_wing.rx=.43633232*idle;p.right_wing.ry=-.7853982+wing;p.left_wing.ry=.7853982-wing;p.body.rx=movement*.7853982;
  p.root.py+=cos(bob)*.25*idle;
  p.right_arm.rx=p.left_arm.rx=holding*(-1.0471976+(-1.134464+1.0471976)*movement);
  const roll=.43633232-cos(bob+4.712389)*pi*.075*idle*(1-holding);p.right_arm.rz=roll;p.left_arm.rz=-roll;p.right_arm.ry=.27925268*holding;p.left_arm.ry=-.27925268*holding;
  if(e.dancing){const t=a.age*8*D+a.lsa;p.root.rz=cos(t)*16*D;p.head.rz=cos(t)*14*D;p.head.ry=cos(t)*30*D;}return;
 }
 if(name==='frog'){
  if(a.lsa>0)play(a.inWater?'FROG_SWIM':'FROG_WALK',a.ls*50*(a.inWater?1:1.5),Math.min(a.lsa*2.5,1));
  if(e.pose===6)play('FROG_JUMP');if(e.pose===8)play('FROG_CROAK');if(e.pose===9)play('FROG_TONGUE');if(a.inWater&&!a.moving)play('FROG_IDLE_WATER');p.croaking_body.visible=e.pose===8;return;
 }
 if(name==='camel'){
  p.head.ry=Math.max(-30,Math.min(30,a.yaw))*D;p.head.rx=Math.max(-25,Math.min(45,a.pitch))*D;
  play('CAMEL_WALK',a.ls*100,Math.min(a.lsa*2.5,1));
  if(e.pose===10)play('CAMEL_SIT_POSE');else if(e.dashing)play('CAMEL_DASH');
  if(!a.moving)play('CAMEL_IDLE');return;
 }
 if(name==='sniffer'){
  if(a.moving)play('SNIFFER_WALK',a.age*50,Math.min(1,Math.hypot(e.motionX||0,e.motionZ||0)**2*9000));
  const states={1:'SNIFFER_HAPPY',2:'SNIFFER_SNIFFSNIFF',3:'SNIFFER_LONGSNIFF',4:'SNIFFER_SNIFF_SEARCH',5:'SNIFFER_DIG',6:'SNIFFER_STAND_UP'};if(states[e.snifferState])play(states[e.snifferState]);return;
 }
 if(name==='warden'){
  const weight=Math.min(.5,3*a.lsa),phase=a.ls*.8662,c=cos(phase),s=sin(phase),small=Math.min(.35,weight),idle=a.age*.1;
  p.head.rz+=.3*s*weight+.06*cos(idle);p.head.rx+=1.2*cos(phase+pi/2)*small+.06*sin(idle);p.body.rz=.1*s*weight+.025*sin(idle);p.body.rx=cos(phase)*small+.025*cos(idle);
  p.left_leg.rx=cos(phase)*weight;p.right_leg.rx=cos(phase+pi)*weight;p.left_arm.rx=-.8*cos(phase)*weight;p.right_arm.rx=-.8*sin(phase)*weight;
  const clipsByPose={11:'WARDEN_ROAR',12:'WARDEN_SNIFF',13:'WARDEN_EMERGE',14:'WARDEN_DIG'};if(clipsByPose[e.pose])play(clipsByPose[e.pose]);if(e.wildAttackStart!==undefined&&a.age-e.wildAttackStart<40)play('WARDEN_ATTACK',(a.age-e.wildAttackStart)*50);if(e.sonicBoomStart!==undefined&&a.age-e.sonicBoomStart<60)play('WARDEN_SONIC_BOOM',(a.age-e.sonicBoomStart)*50);
 }
}
