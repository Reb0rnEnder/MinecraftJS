// Decode/upload before first use, with bounded memory and request concurrency.
// High-resolution packs cannot force every unused texture into GPU memory.
export async function preloadTextures(assets,entries,{budget=64*1024*1024,concurrency=4,yieldFrame=()=>Promise.resolve(),progress=()=>{}}={}){
 const paths=[...new Map(entries.map(e=>[typeof e==='string'?e:e[0],typeof e==='string'?[e]:e])).values()];
 const report={total:paths.length,loaded:0,skipped:0,failed:[],bytes:0};let next=0;
 async function worker(){while(next<paths.length){const[path,w,h]=paths[next++],estimate=(w||0)*(h||0)*4;if(report.bytes+estimate>budget){report.skipped++;continue;}report.bytes+=estimate;
  try{const image=await assets.imageAsync(path),bytes=image.width*image.height*4;if(!estimate){if(report.bytes+bytes>budget){report.skipped++;continue;}report.bytes+=bytes;}
   const options=path.includes('/panorama_')?{filter:'linear'}:path==='environment/clouds.png'||/glint/.test(path)?{wrap:'repeat'}:{};assets.texture(path,options);report.loaded++;
  }catch(e){report.failed.push(path);}progress(report.loaded+report.skipped+report.failed.length,report.total);await yieldFrame();
 }}await Promise.all(Array.from({length:Math.min(concurrency,paths.length)},worker));return report;
}
