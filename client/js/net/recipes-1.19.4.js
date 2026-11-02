function array(r,read,max=65536){const n=r.varint();if(n<0||n>max||n>r.remaining())throw Error('Invalid 762 recipe array');return Array.from({length:n},read);}
export function readRecipes762(r){return array(r,()=>{
 const type=r.string(),recipeId=r.string(),kind=type.replace(/^minecraft:/,''),data={},ingredient=()=>array(r,()=>r.slot());
 if(kind==='crafting_shaped'){data.width=r.varint();data.height=r.varint();if(data.width<1||data.width>3||data.height<1||data.height>3)throw Error('Invalid 762 recipe dimensions');data.group=r.string();data.category=r.varint();data.ingredients=Array.from({length:data.width*data.height},ingredient);data.result=r.slot();data.showNotification=r.bool();}
 else if(kind==='crafting_shapeless'){data.group=r.string();data.category=r.varint();data.ingredients=array(r,ingredient,9);data.result=r.slot();}
 else if(['smelting','blasting','smoking','campfire_cooking'].includes(kind)){data.group=r.string();data.category=r.varint();data.ingredient=ingredient();data.result=r.slot();data.experience=r.f32();data.cookingTime=r.varint();}
 else if(kind==='stonecutting'){data.group=r.string();data.ingredient=ingredient();data.result=r.slot();}
 else if(kind==='smithing'){data.base=ingredient();data.addition=ingredient();data.result=r.slot();}
 else if(kind==='smithing_transform'||kind==='smithing_trim'){data.template=ingredient();data.base=ingredient();data.addition=ingredient();if(kind==='smithing_transform')data.result=r.slot();}
 else if(kind.startsWith('crafting_special_')||kind==='crafting_decorated_pot')data.category=r.varint();
 else throw Error('Unknown 762 recipe serializer '+type);
 return{type,recipeId,data};
});}
