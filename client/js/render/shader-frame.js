import {celestialAngle} from './sky.js';
import {mat4} from '../gfx/math.js';
import {biomeInfo} from '../world/biomes.js';
export const FINAL_UNIFORMS=new Set('viewWidth viewHeight aspectRatio frameTimeCounter frameTime worldTime frameCounter isEyeInWater screenBrightness rainStrength eyeBrightnessSmooth mcjsEyeBrightness sunAngle gbufferModelView gbufferModelViewInverse blindness sprintingSmooth sneakSmooth burningSmooth rainStrengthS rainStrengthS2 biomeHasRainSmooth biomeisNotColdSmooth biomeHasHeatSmooth biomeHasHeatSmooth2 biomeHasHeatSmooth3 moonPhase wetness isEyeInCave nightVision starter touchmybody'.split(' '));
export function shaderFrameUniforms(game){
 const p=game.player||{},w=game.world||{},eye=game.eyePosition?.(game.partial||0)||[p.x||0,(p.y||0)+(p.eyeHeight?.()||1.62),p.z||0],at=eye.map(Math.floor);
 const sky=w.getSkyLight?.(...at)??15,block=w.getBlockLight?.(...at)??0,brightness=[block*16,sky*16],rain=w.rainStrength||0;
 const view=new Float32Array(game.renderer?.view||mat4.create());view[12]=view[13]=view[14]=0;
 const biome=biomeInfo(w.getBiome?.(at[0],at[2],at[1])??1),temp=biome.temperature;
 return {eyeBrightnessSmooth:brightness,mcjsEyeBrightness:brightness,sunAngle:celestialAngle(w.timeOfDay||0,0),gbufferModelView:view,gbufferModelViewInverse:mat4.invert(mat4.create(),view),blindness:game.effects?.has?.(15)?1:0,sprintingSmooth:p.sprinting?1:0,sneakSmooth:p.sneaking?1:0,burningSmooth:game.selfMetadata?.[0]&1?1:0,rainStrength:rain,rainStrengthS:rain,rainStrengthS2:rain,wetness:rain,biomeHasRainSmooth:biome.precipitation==='rain'?1:0,biomeisNotColdSmooth:temp>=.15?1:0,biomeHasHeatSmooth:temp>=1.5?1:0,biomeHasHeatSmooth2:temp>=1.5?1:0,biomeHasHeatSmooth3:game.dimension===-1?1:0,moonPhase:Math.floor((w.timeOfDay||0)/24000)%8,isEyeInCave:1-sky/15,nightVision:game.effects?.has?.(16)?1:0,starter:1,touchmybody:game.hurtTime>0?.4:0};
}
