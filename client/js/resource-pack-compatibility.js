// 1.20.2+ PackMetadataSection.supported_formats uses InclusiveRange's int,
// two-element list or {min_inclusive,max_inclusive} codec. Invalid optional
// ranges are ignored (lenientOptionalFieldOf), falling back to pack_format.
export function packCompatibility(pack,format){
  if(!pack)return 'compatible';
  const range=pack.supportedFormats;
  let min,max;
  if(Number.isInteger(range))min=max=range;
  else if(Array.isArray(range)&&range.length===2)[min,max]=range;
  else if(range&&typeof range==='object')({min_inclusive:min,max_inclusive:max}=range);
  if(!Number.isInteger(min)||!Number.isInteger(max)||min>max)min=max=pack.format;
  return max<format?'old':min>format?'new':'compatible';
}
