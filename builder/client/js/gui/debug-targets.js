// GuiOverlayDebug traces both block-only and any-fluid rays at 20 blocks, independently of interaction reach.
export function debugTargets(game) {
  const eye=game.eyePosition(0),look=game.lookVector(0);
  return {
    block:game.world.raycast(...eye,...look,20,false),
    fluid:game.world.raycast(...eye,...look,20,'any'),
  };
}
