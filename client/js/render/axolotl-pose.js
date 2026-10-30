import {mcSin as sin, mcCos as cos} from '../game/physics.js';
const f=Math.fround, rad=f(Math.PI/180), names=['body','head','tail','rightFrontLeg','leftFrontLeg','rightHindLeg','leftHindLeg','topGills','leftGills','rightGills'];
// AxolotlModel uses Mth.rotLerp, storing rotations on the individual entity
// between rendered frames. Model rest poses alone cannot represent transitions.
const lerp=(a,b,t=.05)=>{let d=f(b-a);d=((d+180)%360+360)%360-180;return f(a+f(f(t)*d));};
export function animateAxolotl(model,a){
 const p=model.parts,history=a.axolotlRotations;
 for(const name of names){const part=p[name],saved=history?.[name];[part.rx,part.ry,part.rz]=saved||[0,0,0];}
 if(!history?.body){p.body.rx=f((a.pitch||0)*rad);p.body.ry=f((a.yaw||0)*rad);}
 p.body.px=0;p.body.py=20;p.head.py=0;
 const to=(part,x,y,z)=>{part.rx=lerp(part.rx,x);part.ry=lerp(part.ry,y);part.rz=lerp(part.rz,z);};
 const mirror=()=>{to(p.rightHindLeg,p.leftHindLeg.rx,-p.leftHindLeg.ry,-p.leftHindLeg.rz);to(p.rightFrontLeg,p.leftFrontLeg.rx,-p.leftFrontLeg.ry,-p.leftFrontLeg.rz);};
 const headReset=()=>{p.head.ry=lerp(p.head.ry,0);p.head.rz=lerp(p.head.rz,0);};
 const gills=()=>{p.leftGills.ry=lerp(p.leftGills.ry,-p.topGills.rx);p.rightGills.ry=lerp(p.rightGills.ry,-p.leftGills.ry);};
 const bodyGround=()=>{p.body.rx=lerp(p.body.rx,0,.2);p.body.ry=lerp(p.body.ry,f((a.yaw||0)*rad));p.body.rz=lerp(p.body.rz,0);};
 if(a.playingDead){
  to(p.leftHindLeg,1.4137167,1.0995574,.7853982);to(p.leftFrontLeg,.7853982,2.042035,0);
  p.body.rx=lerp(p.body.rx,-.15);p.body.rz=lerp(p.body.rz,.35);mirror();p.body.ry=lerp(p.body.ry,f((a.yaw||0)*rad));
  p.head.rx=lerp(p.head.rx,0);headReset();p.tail.ry=lerp(p.tail.ry,0);
  for(const name of ['topGills','leftGills','rightGills'])to(p[name],0,0,0);
 }else if(a.inWater){
  if(a.moving){
   const phase=f(a.age*f(.33)),s=sin(phase),c=cos(phase),wave=f(f(.13)*s);
   p.body.rx=lerp(p.body.rx,f(f((a.pitch||0)*rad)+wave),.1);p.head.rx=f(-wave*f(1.8));p.body.py=f(p.body.py-f(f(.45)*c));
   p.topGills.rx=lerp(p.topGills.rx,-.5*s-.8);p.leftGills.ry=lerp(p.leftGills.ry,.3*s+.9);p.rightGills.ry=lerp(p.rightGills.ry,-p.leftGills.ry);
   p.tail.ry=lerp(p.tail.ry,.3*cos(f(phase*f(.9))));
   to(p.leftHindLeg,1.8849558,-.4*s,1.5707964);to(p.leftFrontLeg,1.8849558,-.2*c-.1,1.5707964);mirror();headReset();
  }else{
   const phase=f(a.age*f(.075)),c=cos(phase),bob=f(sin(phase)*f(.15));
   p.body.rx=lerp(p.body.rx,-.15+.075*c);p.body.py=f(p.body.py-bob);p.head.rx=lerp(p.head.rx,-p.body.rx);
   p.topGills.rx=lerp(p.topGills.rx,.2*c);p.leftGills.ry=lerp(p.leftGills.ry,-.3*c-.19);p.rightGills.ry=lerp(p.rightGills.ry,-p.leftGills.ry);
   to(p.leftHindLeg,2.3561945-c*.11,.47123894,1.7278761);to(p.leftFrontLeg,.7853982-c*.2,2.042035,0);mirror();
   p.tail.ry=lerp(p.tail.ry,.5*c);headReset();
  }
 }else if(a.onGround){
  if(a.moving){
   const phase=f(a.age*f(.11)),c=cos(phase),bend=f(f(f(c*c)-f(2*c))/5),front=f(f(.7)*c);
   p.head.rx=lerp(p.head.rx,0);p.head.ry=lerp(p.head.ry,.09*c);p.head.rz=lerp(p.head.rz,0);p.tail.ry=lerp(p.tail.ry,p.head.ry);
   p.topGills.rx=lerp(p.topGills.rx,.6-.08*(c*c+2*sin(phase)));gills();
   to(p.leftHindLeg,.9424779,1.5-bend,-.1);to(p.leftFrontLeg,1.0995574,1.5707964-front,0);
   to(p.rightHindLeg,p.leftHindLeg.rx,-1-bend,0);to(p.rightFrontLeg,p.leftFrontLeg.rx,-1.5707964-front,0);bodyGround();
  }else{
   const phase=f(a.age*f(.09)),s=sin(phase),c=cos(phase),bend=f(f(s*s)-f(2*s)),gill=f(f(c*c)-f(3*s));
   p.head.rx=lerp(p.head.rx,-.09*bend);p.head.ry=lerp(p.head.ry,0);p.head.rz=lerp(p.head.rz,-.2);p.tail.ry=lerp(p.tail.ry,-.1+.1*bend);
   p.topGills.rx=lerp(p.topGills.rx,.6+.05*gill);gills();to(p.leftHindLeg,1.1,1,0);to(p.leftFrontLeg,.8,2.3,-.5);mirror();bodyGround();
  }
 }
 if(history)for(const name of names)history[name]=[p[name].rx,p[name].ry,p[name].rz];
}
