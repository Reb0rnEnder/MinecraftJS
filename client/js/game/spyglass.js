// Native 1.17.1 Player.isScoping / Gui.renderSpyglassOverlay.
export function usingSpyglass(game) {
  const held = game.inventory?.getHand(game.interaction?.activeHand || 0);
  return !!(game.player?.usingItem && held && game.items.name(held.id) === 'spyglass');
}
export const isScoping = game => game.thirdPerson === 0 && usingSpyglass(game);
export function renderSpyglass(gui, scale) {
  const w = gui.width, h = gui.height, size = Math.min(w, h) * scale;
  const x = (w - size) / 2, y = (h - size) / 2;
  const tex = gui.tex('misc/spyglass_scope.png');
  if (tex) gui.quad(tex, x, y, x + size, y + size, 0, 0, 1, 1, [1, 1, 1, 1]);
  if (y > 0) { gui.rect(0, 0, w, y, 0xff000000); gui.rect(0, y + size, w, h, 0xff000000); }
  if (x > 0) { gui.rect(0, Math.max(0, y), x, Math.min(h, y + size), 0xff000000); gui.rect(x + size, Math.max(0, y), w, Math.min(h, y + size), 0xff000000); }
}
