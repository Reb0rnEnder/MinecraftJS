// ModelOcelot / OcelotModel + CatModel sitting pose, from the pinned client jars.
// Assign pivots every frame so standing up and repeated renders cannot accumulate translations.
export function animateOcelot(m,a={}) {
 const p=m.parts, cat=m.jarModel==='cat', frontY=cat?14.1:13.8;
 for(const [name,y,z] of [['body',12,-10],['head',15,-9],['tail',15,8],['tail2',20,14],['frontLeft',frontY,-5],['frontRight',frontY,-5],['backLeft',18,5],['backRight',18,5]]){p[name].py=y;p[name].pz=z;}
 p.head.rx=(a.pitch||0)*Math.PI/180;p.head.ry=(a.yaw||0)*Math.PI/180;
 p.body.rx=Math.PI/2;p.tail.rx=.9;
 if(a.sitting){
  p.body.rx=.7853982;p.body.py=8;p.body.pz=-5;
  p.head.py=11.7;p.head.pz=-8;
  p.tail.py=23;p.tail.pz=6;p.tail.rx=1.7278761;
  p.tail2.py=22;p.tail2.pz=13.2;p.tail2.rx=2.670354;
  for(const k of ['frontLeft','frontRight']){p[k].rx=-.15707964;p[k].py=frontY+2;p[k].pz=-7;}
  for(const k of ['backLeft','backRight']){p[k].rx=-1.5707964;p[k].py=21;p[k].pz=1;}
 }else{
  const phase=(a.ls||0)*.6662,amp=a.lsa||0;
  p.backLeft.rx=Math.cos(phase)*amp;p.backRight.rx=Math.cos(phase+.3)*amp;
  p.frontLeft.rx=Math.cos(phase+Math.PI+.3)*amp;p.frontRight.rx=Math.cos(phase+Math.PI)*amp;
  p.tail2.rx=1.7278761+Math.PI/4*Math.cos(a.ls||0)*amp;
 }
}
