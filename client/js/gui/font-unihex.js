import{ZipArchive}from'../util/zip.js';
// UnihexProvider: 16-row 8/16/24/32-bit glyphs, packed into shared typed arrays.
// Images/atlas cells are only allocated for glyphs actually drawn.
export function unihexProvider(assets,def,bytes,key){
 const files=new ZipArchive(bytes),sources=files.list('').filter(n=>n.endsWith('.hex')).map(n=>files.read(n));
 const nibble=v=>{if(v>=48&&v<=57)return v-48;if(v>=65&&v<=70)return v-55;throw Error('Invalid Unihex hex digit');};
 let count=0;for(const b of sources){for(const v of b)if(v===10)count++;if(b.length&&b.at(-1)!==10)count++;}
 if(count>0x110000)throw Error('Too many Unihex entries');
 const rows=new Uint32Array(count*16),widths=new Uint8Array(count),entries=new Map();let at=0;
 for(const b of sources){let start=0;while(start<b.length){
  const colon=b.indexOf(58,start);if(colon<0||colon-start<4||colon-start>6)throw Error('Invalid Unihex code point');
  let code=0;for(let i=start;i<colon;i++)code=(code<<4)|nibble(b[i]);if(code>0x10ffff)throw Error('Invalid Unihex code point');
  let end=b.indexOf(10,colon+1);if(end<0)end=b.length;const length=end-colon-1,width=length/4;
  if(![8,16,24,32].includes(width))throw Error('Invalid Unihex bitmap width');
  const digits=width/4;for(let row=0;row<16;row++){let bits=0;for(let n=0;n<digits;n++)bits=(bits<<4)|nibble(b[colon+1+row*digits+n]);rows[at*16+row]=(bits<<(32-width))>>>0;}
  widths[at]=width;entries.set(code,at++);start=end+1;
 }}
 const overrides=(def.size_overrides||[]).map(o=>{
  if(Array.from(o.from||'').length!==1||Array.from(o.to||'').length!==1||!Number.isInteger(o.left)||!Number.isInteger(o.right)||o.right-o.left+1<0||o.right-o.left+1>1024)throw Error('Invalid Unihex size override');
  const from=o.from.codePointAt(0),to=o.to.codePointAt(0);if(from>=to)throw Error('Invalid Unihex range');return{...o,from,to};
 });
 let atlas=null,page=0,x=1,y=1,rowHeight=0;
 function bake(glyph,index,left,right){
  const width=right-left+1,height=16;if(width<=0)return null;
  if(!atlas){const side=Math.max(256,2**Math.ceil(Math.log2(width+2)));atlas=assets.makeTexture(key+':'+page++,side,side,new Uint8Array(side*side*4),{filter:'nearest'});x=y=1;rowHeight=0;}
  if(x+width+1>atlas.width){x=1;y+=rowHeight+1;rowHeight=0;}
  if(y+height+1>atlas.height){atlas=null;return bake(glyph,index,left,right);}
  const rgba=new Uint8Array(width*height*4);for(let row=0;row<16;row++)for(let px=0;px<width;px++){const bit=left+px;if(bit>=0&&bit<32&&(rows[index*16+row]>>>(31-bit)&1))rgba.fill(255,(row*width+px)*4,(row*width+px+1)*4);}
  assets.device.updateTexture(atlas,rgba,x,y,width,height);glyph.u0=x/atlas.width;glyph.v0=y/atlas.height;glyph.u1=(x+width)/atlas.width;glyph.v1=(y+height)/atlas.height;
  const texture=atlas;x+=width+1;rowHeight=Math.max(rowHeight,height);return texture;
 }
 const cache=new Map();return{type:'unihex',get(ch){
  if(cache.has(ch))return cache.get(ch);const code=ch.codePointAt(0),index=entries.get(code);if(index===undefined)return null;
  let mask=0;for(let row=0;row<16;row++)mask|=rows[index*16+row];
  const override=overrides.find(o=>code>=o.from&&code<=o.to),left=override?.left??(mask?Math.clz32(mask):0),right=override?.right??(mask?Math.clz32((mask&-mask)>>>0):widths[index]);
  const width=right-left+1;let texture;const glyph={advance:Math.trunc(width/2)+1,x:0,y:0,width:width/2,height:8,boldOffset:.5,shadowOffset:.5,texture:()=>texture||(texture=bake(glyph,index,left,right))};
  cache.set(ch,glyph);return glyph;
 }};
}
