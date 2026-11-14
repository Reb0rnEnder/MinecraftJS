import{test}from'node:test';import assert from'node:assert/strict';import{FontRenderer}from'../client/js/gui/font.js';import{FontSet}from'../client/js/gui/font-providers.js';
test('native provider advances retain negative spacing and bold offsets for zero-width glyphs',()=>{
 const glyph=advance=>({advance,width:0,height:0,boldOffset:1,shadowOffset:1,texture:()=>null}),assets={version:1,image:()=>null,texture:()=>null};assets.fontSets={default:new FontSet(assets,[{type:'ttf',get:ch=>glyph(ch==='A'?-8:0)}])};const f=new FontRenderer({assets});
 for(const [text,width]of[['A',-8],['§lA',-7],['B',0],['§lB',1],['A§lB',-7]]){assert.equal(f.width(text),width,text);assert.equal(f.layout(text,0,0,0xffffff,false).width,width,text);}
});
