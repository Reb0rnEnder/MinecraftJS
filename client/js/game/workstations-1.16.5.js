import {WORKSTATIONS_498} from './workstations-1.14.4.js';
export const WORKSTATIONS_754={...WORKSTATIONS_498,
 // ItemCombinerMenu slots and SmithingScreen title coordinates from the target jar.
 'minecraft:smithing':{texture:'smithing',slots:[[0,27,47],[1,76,47],[2,134,47]],titleX:60,titleY:18},
};
export function smithingRecipes(game){return (game.serverRecipes||[]).filter(r=>r.type==='minecraft:smithing');}
export function smithingRecipe(game,base,addition){
 if(!base||!addition)return null;
 return smithingRecipes(game).find(r=>r.data.base.some(s=>s?.id===base.id)&&r.data.addition.some(s=>s?.id===addition.id))||null;
}
export function smithingResult(game,base,addition){
 const recipe=smithingRecipe(game,base,addition);if(!recipe)return null;
 const result=structuredClone(recipe.data.result);
 // UpgradeRecipe.assemble copies the base's complete tag, including name, damage and enchantments.
 if(base.nbt){result.nbt=structuredClone(base.nbt);result.nbtRaw=base.nbtRaw?.slice();}
 return result;
}
