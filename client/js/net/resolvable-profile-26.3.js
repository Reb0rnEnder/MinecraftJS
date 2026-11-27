// ResolvableProfile.STREAM_CODEC (26.3): Either<GameProfile, Partial> followed by
// PlayerSkin.Patch. Bytecode sources: ByteBufCodecs.either/GAME_PROFILE/GAME_PROFILE_PROPERTIES,
// ResolvableProfile.Partial.STREAM_CODEC and PlayerSkin.Patch.STREAM_CODEC.
import {nameUuid} from '../util/uuid-md5.js';

const NIL_UUID='00000000-0000-0000-0000-000000000000';

function readProperties(r){
  const count=r.varint();
  if(count<0||count>16)throw Error('26.3 profile property count '+count+' exceeds 16');
  const properties=[];
  for(let i=0;i<count;i++){
    const name=r.string(),value=r.string();
    const signature=r.bool()?r.string():null;
    properties.push({name,value,signature});
  }
  return properties;
}

function readOptionalUuid(r){
  return r.bool()?r.uuid():null;
}

// Returns a profile in the same split shape the native codec produces. A left-hand full
// GameProfile has a UUID and a name; a right-hand Partial may omit either. `dynamic` records
// whether the native create() keeps the unresolved name/ID rather than a Static profile.
export function readResolvableProfile26_3(r){
  const full=r.bool();
  let profile;
  if(full){
    profile={id:r.uuid(),name:r.string(),properties:readProperties(r)};
  }else{
    const name=r.bool()?r.string():null;
    const id=readOptionalUuid(r);
    const properties=readProperties(r);
    profile={id,name,properties};
  }
  const skinPatch={body:r.bool()?r.string():null,cape:r.bool()?r.string():null,
    elytra:r.bool()?r.string():null,model:r.bool()?(r.bool()?'slim':'wide'):null};
  const dynamic=!full&&profile.properties.length===0&&(profile.id===null)!==(profile.name===null);
  return {profile,skinPatch,dynamic};
}

// GameProfile defaults for a profile whose ID was never resolved (ResolvableProfile.createPartialProfile).
export function profileUuid(profile){
  if(profile?.id)return String(profile.id);
  if(profile?.name)return nameUuid(new TextEncoder().encode(profile.name));
  return NIL_UUID;
}

export function profileName(profile){
  return profile?.name||'';
}

export function profileTextureValue(profile){
  const property=(profile?.properties||[]).find(p=>p.name==='textures');
  return property?.value||null;
}

// ClientAsset.ResourceTexture.STREAM_CODEC writes the resource id; `texturePath` is
// textures/<id path>.png. The asset store keys omit the textures/ prefix and .png suffix.
export function skinPatchAsset(id){
  if(!id)return null;
  const path=String(id).replace(/^minecraft:/,'');
  // ClientAsset.ResourceTexture.texturePath = textures/<id>.png; the asset store keys
  // already include the .png suffix but omit the textures/ prefix.
  return path.endsWith('.png')?path:path+'.png';
}

