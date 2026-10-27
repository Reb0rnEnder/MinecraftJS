// Fox DATA_FLAGS_ID is an unsigned bitfield, separate from generic entity flags.
export function applyFoxFlags(e,flags){
 e.foxFlags=flags&255;e.sitting=!!(flags&1);e.foxCrouching=!!(flags&4);e.foxInterested=!!(flags&8);
 e.foxPouncing=!!(flags&16);e.foxSleeping=!!(flags&32);e.foxFaceplanted=!!(flags&64);e.foxDefending=!!(flags&128);
}
export function tickFox(e){
 e.prevFoxInterested=e.foxInterestAmount||0;e.foxInterestAmount=e.prevFoxInterested+((e.foxInterested?1:0)-e.prevFoxInterested)*.4;
 e.prevFoxCrouchAmount=e.foxCrouchAmount||0;e.foxCrouchAmount=e.foxCrouching?Math.min(3,e.prevFoxCrouchAmount+.2):0;
}
export function foxAnimationArgs(e,partial){
 const interest=(e.prevFoxInterested||0)+((e.foxInterestAmount||0)-(e.prevFoxInterested||0))*partial;
 return {foxSleeping:!!e.foxSleeping,foxCrouching:!!e.foxCrouching,foxFaceplanted:!!e.foxFaceplanted,
 foxCrouchAmount:(e.prevFoxCrouchAmount||0)+((e.foxCrouchAmount||0)-(e.prevFoxCrouchAmount||0))*partial,foxHeadRoll:interest*.11*Math.PI};
}
