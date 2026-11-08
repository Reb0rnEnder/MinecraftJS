// FoxModel.prepareMobModel/setupAnim, compared with the pinned 1.15.2 client.
export function animateFox(model,a){
 const p=model.parts,legs=[p.rightHindLeg,p.leftHindLeg,p.rightFrontLeg,p.leftFrontLeg];
 p.body.rx=Math.PI/2;p.tail.rx=-.05235988;p.head.rz=a.foxHeadRoll||0;
 for(const [i,leg]of legs.entries())leg.rx=Math.cos(a.ls*.6662+(i===1||i===2?Math.PI:0))*1.4*a.lsa;
 if(a.foxCrouching){const amount=a.foxCrouchAmount||0;p.body.rx=1.6755161;p.body.py=16+amount;p.head.py=16.5+amount;}
 else if(a.foxSleeping){
  p.body.rz=-Math.PI/2;p.body.py=21;p.tail.rx=a.child?-2.1816616:-2.6179938;if(a.child)p.body.pz=-2;
  p.head.px=1;p.head.py=19.49;p.head.rx=0;p.head.ry=-2.0943952;p.head.rz=0;
  for(const leg of legs)leg.visible=false;
 }else if(a.sitting){
  p.body.rx=.5235988;p.body.py=9;p.body.pz=-3;p.tail.rx=.7853982;p.tail.pz=-2;
  p.head.py=a.child?13:10;p.head.pz=a.child?-3.75:-.25;
  p.rightHindLeg.rx=p.leftHindLeg.rx=-1.3089969;p.rightHindLeg.py=p.leftHindLeg.py=21.5;p.rightHindLeg.pz=p.leftHindLeg.pz=6.75;
  p.rightFrontLeg.rx=p.leftFrontLeg.rx=-.2617994;
 }
 if(!a.foxSleeping&&!a.foxFaceplanted&&!a.foxCrouching){p.head.rx=a.pitch*Math.PI/180;p.head.ry=a.yaw*Math.PI/180;}
 if(a.foxSleeping)p.head.rz=Math.cos(a.age*.027)/22;
 if(a.foxCrouching){const sway=Math.cos(a.age)*.01;p.body.ry=sway;legs.forEach((leg,i)=>leg.rz=sway*(i<2?1:.5));}
 if(a.foxFaceplanted){
  // Express the native per-render phase in elapsed ticks so LOD/FPS do not change its speed.
  const phase=a.age*.67;legs.forEach((leg,i)=>leg.rx=Math.cos(phase*.4662+(i===1||i===2?Math.PI:0))*.1);
 }
}
export function scaleFoxChild(groups,child){
 if(!groups)return;
 groups.head.scale.setScalar(child?.75:1);groups.head.position.set(0,child?6:0,child?3.35*.75:0);
 groups.body.scale.setScalar(child?.5:1);groups.body.position.set(0,child?12:0,0);
}
