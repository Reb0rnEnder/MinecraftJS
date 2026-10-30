// Native Fabulous six-layer depth composition. Color targets hold premultiplied
// RGB from normal SRC_ALPHA blending; do not multiply source RGB a second time.
export function compositeLayers(colors,depths){
 const order=[0];for(let i=1;i<6;i++)if(colors[i][3]!==0){let j=order.length;order.push(i);while(j>0&&depths[order[j]]>depths[order[j-1]]){[order[j],order[j-1]]=[order[j-1],order[j]];j--;}}
 let rgb=colors[order[0]].slice(0,3);for(let i=1;i<order.length;i++){const c=colors[order[i]],a=order[i]===0?1:c[3];rgb=rgb.map((v,k)=>v*(1-a)+c[k]);}return [...rgb,1];
}
const declarations=Array.from({length:6},(_,i)=>`uniform sampler2D c${i}; uniform sampler2D d${i};`).join('\n');
export const TRANSPARENCY_GLSL={
 vs:`layout(location=0) in vec3 unused;void main(){vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2));gl_Position=vec4(p*2.0-1.0,0.0,1.0);}`,
 fs:`${declarations}
out vec4 outColor;
void main(){ivec2 p=ivec2(gl_FragCoord.xy);vec4 colors[6];float depths[6];int n=1;
colors[0]=vec4(texelFetch(c0,p,0).rgb,1.0);depths[0]=texelFetch(d0,p,0).r;
${Array.from({length:5},(_,k)=>{const i=k+1;return `{vec4 c=texelFetch(c${i},p,0);if(c.a!=0.0){int j=n++;colors[j]=c;depths[j]=texelFetch(d${i},p,0).r;while(j>0){if(depths[j]<=depths[j-1])break;vec4 t=colors[j-1];colors[j-1]=colors[j];colors[j]=t;float z=depths[j-1];depths[j-1]=depths[j];depths[j]=z;j--;}}}`;}).join('\n')}
vec3 rgb=colors[0].rgb;for(int i=1;i<n;i++)rgb=rgb*(1.0-colors[i].a)+colors[i].rgb;outColor=vec4(rgb,1.0);}`,
};
export const TRANSPARENCY_WGSL=`
${Array.from({length:6},(_,i)=>`@group(0) @binding(${i*2}) var c${i}:texture_2d<f32>;@group(0) @binding(${i*2+1}) var d${i}:texture_depth_2d;`).join('\n')}
@vertex fn vs(@builtin(vertex_index) i:u32)->@builtin(position) vec4f{let p=vec2f(f32((i<<1u)&2u),f32(i&2u));return vec4f(p*2.0-1.0,0.0,1.0);}
@fragment fn fs(@builtin(position) pos:vec4f)->@location(0) vec4f{
 let p=vec2i(pos.xy);var colors:array<vec4f,6>;var depths:array<f32,6>;var n=1u;
 colors[0]=vec4f(textureLoad(c0,p,0).rgb,1.0);depths[0]=textureLoad(d0,p,0);
 ${Array.from({length:5},(_,k)=>{const i=k+1;return `{let c=textureLoad(c${i},p,0);if(c.a!=0.0){var j=n;n++;colors[j]=c;depths[j]=textureLoad(d${i},p,0);loop{if(j==0u){break;}if(depths[j]<=depths[j-1u]){break;}let t=colors[j-1u];colors[j-1u]=colors[j];colors[j]=t;let z=depths[j-1u];depths[j-1u]=depths[j];depths[j]=z;j--;}}}`;}).join('\n')}
 var rgb=colors[0].rgb;for(var i=1u;i<n;i++){rgb=rgb*(1.0-colors[i].a)+colors[i].rgb;}return vec4f(rgb,1.0);
}`;
export function compositeWebGL(device,layers,output){
 const gl=device.gl;let cache=device.transparencyProgram;
 if(!cache){const program=device._program('transparency',TRANSPARENCY_GLSL);cache=device.transparencyProgram={program,vao:gl.createVertexArray(),samplers:Array.from({length:6},(_,i)=>[gl.getUniformLocation(program.p,'c'+i),gl.getUniformLocation(program.p,'d'+i)])};}
 device.setRenderTarget(output);gl.useProgram(cache.program.p);gl.bindVertexArray(cache.vao);gl.disable(gl.DEPTH_TEST);gl.depthMask(false);gl.disable(gl.BLEND);gl.disable(gl.CULL_FACE);gl.colorMask(true,true,true,true);
 layers.forEach((t,i)=>{for(let j=0;j<2;j++){const unit=i*2+j;gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,j?t.depthTexture:t.tex);gl.uniform1i(cache.samplers[i][j],unit);}});
 gl.drawArrays(gl.TRIANGLES,0,3);gl.activeTexture(gl.TEXTURE0);device.curProgram=null;device.curVao=null;device.curState='';device.curStateObj=null;device.boundTex.fill(null);
}
export function compositeWebGPU(device,layers,output){
 let cache=device.transparencyProgram;const gpu=device.device;
 if(!cache){const module=gpu.createShaderModule({code:TRANSPARENCY_WGSL});const pipeline=gpu.createRenderPipeline({layout:'auto',vertex:{module,entryPoint:'vs'},fragment:{module,entryPoint:'fs',targets:[{format:'rgba8unorm'}]},primitive:{topology:'triangle-list'}});cache=device.transparencyProgram={pipeline,groups:new WeakMap()};}
 let entry=cache.groups.get(layers[0]);if(!entry){const group=gpu.createBindGroup({layout:cache.pipeline.getBindGroupLayout(0),entries:layers.flatMap((t,i)=>[{binding:i*2,resource:t.view},{binding:i*2+1,resource:t.depthView}])});entry={group};cache.groups.set(layers[0],entry);}
 if(device.pass)device.pass.end();device.pass=null;device.target=output;
 const pass=device.encoder.beginRenderPass({colorAttachments:[{view:output.view,loadOp:'load',storeOp:'store'}]});pass.setPipeline(cache.pipeline);pass.setBindGroup(0,entry.group);pass.draw(3);pass.end();device._beginPass(null,false);
}
export function compositeSoftware(device,layers,output){
 const colors=Array.from({length:6},()=>[0,0,0,0]),depths=new Array(6);
 for(let p=0;p<output.u32.length;p++){for(let i=0;i<6;i++){const c=layers[i].u32[p];colors[i][0]=(c&255)/255;colors[i][1]=(c>>>8&255)/255;colors[i][2]=(c>>>16&255)/255;colors[i][3]=(c>>>24)/255;depths[i]=layers[i].rt.depth[p];}const c=compositeLayers(colors,depths);output.u32[p]=(255<<24)|(Math.round(Math.min(1,c[2])*255)<<16)|(Math.round(Math.min(1,c[1])*255)<<8)|Math.round(Math.min(1,c[0])*255);}
 device.setRenderTarget(output);
}
