// Vanilla recipe serializers shared by 404/498/578; 404 writes id before type.
function array(r,read,max=65536){const n=r.varint();if(n<0||n>max||n>r.remaining())throw new RangeError('Invalid recipe array length');return Array.from({length:n},()=>read());}
export function readRecipes(r,protocol){
 return array(r,()=>{
  const first=r.string(),second=r.string(),type=protocol===404?second:first,recipeId=protocol===404?first:second,kind=type.replace(/^minecraft:/,''),data={};
  const ingredient=()=>array(r,()=>r.slot(),65536);
  if(kind==='crafting_shaped'){
   data.width=r.varint();data.height=r.varint();if(data.width<1||data.width>3||data.height<1||data.height>3)throw Error('Invalid recipe dimensions');
   data.group=r.string();data.ingredients=Array.from({length:data.width*data.height},ingredient);data.result=r.slot();
  }else if(kind==='crafting_shapeless'){data.group=r.string();data.ingredients=array(r,ingredient,9);data.result=r.slot();}
  else if(['smelting','blasting','smoking','campfire_cooking'].includes(kind)){
   data.group=r.string();data.ingredient=ingredient();data.result=r.slot();data.experience=r.f32();data.cookingTime=r.varint();
  }else if(protocol!==404&&kind==='stonecutting'){data.group=r.string();data.ingredient=ingredient();data.result=r.slot();}
  else if(protocol>=735&&kind==='smithing'){data.base=ingredient();data.addition=ingredient();data.result=r.slot();}
  else if(!kind.startsWith('crafting_special_'))throw Error('Unsupported recipe serializer '+type);
  return {type,recipeId,data};
 });
}
