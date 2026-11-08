//! Port of `client/js/gfx/water-reflections.js` (upstream MinecraftJS 1.8.9).
//!
//! A bounded screen-space water reflection pass. The opaque scene is copied
//! once before translucent terrain; water samples this copy, never its own
//! framebuffer. The Rust port ships the shader source verbatim (it executes on
//! the GPU); the pass is toggled through the WebGL2 device module.

pub const WATER_REFLECTION_VERTEX: &str = "out vec3 vReflectionPosition;
flat out float vReflectionWater;
";

pub const WATER_REFLECTION_FRAGMENT: &str = "in vec3 vReflectionPosition;
flat in float vReflectionWater;
uniform float uReflectionActive;
uniform sampler2D uReflectionScene,uReflectionDepth;
uniform mat4 uReflectionInverseProj;
uniform vec3 uReflectionSky;
vec3 mcjsViewPosition(vec2 uv,float depth){vec4 p=uReflectionInverseProj*vec4(uv*2.0-1.0,depth*2.0-1.0,1.0);return p.xyz/p.w;}
vec4 mcjsWaterReflection(vec3 color,float alpha){
 if(uReflectionActive<.5||vReflectionWater<.5)return vec4(color,alpha);
 vec3 normal=normalize(cross(dFdx(vReflectionPosition),dFdy(vReflectionPosition)));
 vec3 eye=normalize(-vReflectionPosition);if(dot(normal,eye)<0.0)normal=-normal;
 vec3 ray=reflect(-eye,normal),origin=vReflectionPosition+normal*.08;
 vec3 reflected=uReflectionSky*clamp(vLight.x/15.0,0.0,1.0);float distanceAlong=.2;
 for(int i=0;i<32;i++){
  float previousDistance=distanceAlong;distanceAlong+=.2+float(i)*.12;vec3 point=origin+ray*distanceAlong;
  vec4 projected=uProj*vec4(point,1.0);if(projected.w<=0.0)break;
  vec2 uv=projected.xy/projected.w*.5+.5;if(any(lessThan(uv,vec2(.003)))||any(greaterThan(uv,vec2(.997))))break;
  float depth=texture(uReflectionDepth,uv).r;
  if(depth>=.999999){if(i>2)reflected=texture(uReflectionScene,uv).rgb;continue;}
  vec3 scene=mcjsViewPosition(uv,depth);float behind=scene.z-point.z;
  if(behind>0.0){
   float low=previousDistance,high=distanceAlong;
   for(int refine=0;refine<6;refine++){
    float middle=(low+high)*.5;vec3 testPoint=origin+ray*middle;vec4 clip=uProj*vec4(testPoint,1.0);vec2 testUV=clip.xy/clip.w*.5+.5;
    float testDepth=texture(uReflectionDepth,testUV).r;float delta=mcjsViewPosition(testUV,testDepth).z-testPoint.z;
    if(testDepth<.999999&&delta>0.0)high=middle;else low=middle;
   }
   vec3 hitPoint=origin+ray*high;vec4 clip=uProj*vec4(hitPoint,1.0);vec2 hitUV=clip.xy/clip.w*.5+.5;
   float hitDepth=texture(uReflectionDepth,hitUV).r;float error=abs(mcjsViewPosition(hitUV,hitDepth).z-hitPoint.z);
   if(hitDepth<.999999&&error<.1+high*.01){
    float edge=smoothstep(0.0,.08,min(min(hitUV.x,hitUV.y),min(1.0-hitUV.x,1.0-hitUV.y)));
    reflected=mix(reflected,texture(uReflectionScene,hitUV).rgb,edge);break;
   }
  }
 }
 float fresnel=.02+.98*pow(1.0-max(dot(eye,normal),0.0),5.0);
 return vec4(mix(color,reflected,fresnel),max(alpha,fresnel));
}
";
