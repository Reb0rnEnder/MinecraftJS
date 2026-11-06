// Mth.atan2's lookup approximation and float degree wrapping, used by
// Entity.lookAt. Math.atan2 alone gives different native float rotations.
const bits=new DataView(new ArrayBuffer(8));
bits.setBigInt64(0,4805340802404319232n);
const bias=bits.getFloat64(0),asin=new Float64Array(257),cos=new Float64Array(257);
for(let i=0;i<257;i++){asin[i]=Math.asin(i/256);cos[i]=Math.cos(asin[i]);}
function invSqrt(n){const half=.5*n;bits.setFloat64(0,n);bits.setBigInt64(0,6910469410427058090n-(bits.getBigInt64(0)>>1n));let v=bits.getFloat64(0);return v*(1.5-half*v*v);}
export function nativeAtan2(y,x){
  const length=x*x+y*y;if(Number.isNaN(length))return NaN;
  const negativeY=y<0,negativeX=x<0;if(negativeY)y=-y;if(negativeX)x=-x;
  const swapped=y>x;if(swapped)[x,y]=[y,x];
  const inv=invSqrt(length);x*=inv;y*=inv;
  const biased=bias+y;bits.setFloat64(0,biased);const index=bits.getUint32(4);
  const sampled=biased-bias,error=y*cos[index]-x*sampled;
  let angle=asin[index]+(6+error*error)*error*(1/6);
  if(swapped)angle=Math.PI/2-angle;if(negativeX)angle=Math.PI-angle;if(negativeY)angle=-angle;
  return angle;
}
export function wrapNativeDegrees(n){let v=Math.fround(n%360);if(v>=180)v=Math.fround(v-360);if(v< -180)v=Math.fround(v+360);return v;}
