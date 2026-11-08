const clone=stack=>stack?structuredClone(stack):null;
export function serverRecipe(record){
 const d=record.data,type=record.type.replace(/^minecraft:/,''),shaped=type==='crafting_shaped';
 if(!d.result)return null;const raw=shaped||type==='crafting_shapeless'?d.ingredients:[d.ingredient||[]];
 return {id:record.recipeId,name:record.recipeId,type:record.type,group:d.group||'',result:clone(d.result),shaped,
 width:shaped?d.width:type==='crafting_shapeless'?Math.ceil(Math.sqrt(raw.length)):1,
 height:shaped?d.height:type==='crafting_shapeless'?Math.ceil(Math.sqrt(raw.length)):1,
 cells:raw.map(alternatives=>alternatives.length?alternatives.filter(Boolean).map(s=>({...clone(s),data:0})):null),experience:d.experience,cookingTime:d.cookingTime};
}
const matches=(alternatives,item)=>!alternatives?!item:!!item&&alternatives.some(s=>s.id===item.id);
export function serverCraftResult(grid,n,recipes){
 const present=grid.filter(Boolean);if(!present.length)return null;
 for(const r of recipes){
  const kind=r.type.replace(/^minecraft:/,'');if(!['crafting_shaped','crafting_shapeless'].includes(kind))continue;
  if(r.shaped){
   for(let ox=0;ox<=n-r.width;ox++)for(let oy=0;oy<=n-r.height;oy++)for(const mirror of [false,true]){
    let ok=true;for(let y=0;y<n&&ok;y++)for(let x=0;x<n;x++){
     const rx=x-ox,ry=y-oy,inside=rx>=0&&rx<r.width&&ry>=0&&ry<r.height;
     if(!matches(inside?r.cells[ry*r.width+(mirror?r.width-1-rx:rx)]:null,grid[y*n+x])){ok=false;break;}
    }if(ok)return clone(r.result);
   }
  }else{
   const cells=r.cells.filter(Boolean);if(cells.length!==present.length)continue;
   // Overlapping Ingredient alternatives require a full matching, not a greedy choice.
   const used=new Set(),search=i=>{if(i===cells.length)return true;for(let j=0;j<present.length;j++)if(!used.has(j)&&matches(cells[i],present[j])){used.add(j);if(search(i+1))return true;used.delete(j);}return false;};
   if(search(0))return clone(r.result);
  }
 }return null;
}
export function replaceServerRecipes(game,recipes){
 game.serverRecipes=recipes;game.items.serverRecipes=recipes.map(serverRecipe).filter(Boolean);
 game.recipeBook.recipes=null;game.recipeBook.lists=null;
 const screen=game.screens?.current;if(screen?.recipeBook){screen.recipeBook.ghost=null;screen.recipeBook.overlay=null;screen.recipeBook.update?.(true);}
}
export function resetServerRecipes(game){
 game.serverRecipes=null;if(game.items)game.items.serverRecipes=null;if(game.recipeBook){game.recipeBook.recipes=null;game.recipeBook.lists=null;game.recipeBook.known.clear();game.recipeBook.fresh.clear();game.recipeBook.open=false;game.recipeBook.filtering=false;for(const state of Object.values(game.recipeBook.cookingStates||{})){state.open=false;state.filtering=false;}}
}
