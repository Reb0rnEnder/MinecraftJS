// Native 1.20 SmithingScreen (ItemCombinerScreen): template, base and addition slots with cycling empty-slot icons,
// the error sprite and tooltips, and an armor stand wearing the result.
const TEMPLATE_ICONS = ['item/empty_slot_smithing_template_armor_trim', 'item/empty_slot_smithing_template_netherite_upgrade'];
// SmithingTemplateItem base / addition slot icons
const ICONS = {
  upgrade: {
    base: ['item/empty_armor_slot_helmet', 'item/empty_slot_sword', 'item/empty_armor_slot_chestplate', 'item/empty_slot_pickaxe', 'item/empty_armor_slot_leggings', 'item/empty_slot_axe', 'item/empty_armor_slot_boots', 'item/empty_slot_hoe', 'item/empty_slot_shovel'],
    addition: ['item/empty_slot_ingot'],
    baseTooltip: 'item.minecraft.smithing_template.netherite_upgrade.base_slot_description',
    additionTooltip: 'item.minecraft.smithing_template.netherite_upgrade.additions_slot_description',
  },
  trim: {
    base: ['item/empty_armor_slot_helmet', 'item/empty_armor_slot_chestplate', 'item/empty_armor_slot_leggings', 'item/empty_armor_slot_boots'],
    addition: ['item/empty_slot_ingot', 'item/empty_slot_redstone_dust', 'item/empty_slot_lapis_lazuli', 'item/empty_slot_quartz', 'item/empty_slot_diamond', 'item/empty_slot_emerald', 'item/empty_slot_amethyst_shard'],
    baseTooltip: 'item.minecraft.smithing_template.armor_trim.base_slot_description',
    additionTooltip: 'item.minecraft.smithing_template.armor_trim.additions_slot_description',
  },
};
export const SMITHING_SLOTS = [[0, 8, 48], [1, 26, 48], [2, 44, 48], [3, 98, 48]];

// CyclingSlotBackground: the icon advances every 30 ticks, cross-fading over 4
export class CyclingSlotBackground {
  constructor(slot) { this.slot = slot; this.icons = []; this.tick = 0; this.index = 0; }
  update(icons) {
    if (this.icons.join() !== icons.join()) { this.icons = icons; this.index = 0; }
    if (this.icons.length && ++this.tick % 30 === 0) this.index = (this.index + 1) % this.icons.length;
  }
  // [[sprite, alpha], ...] to draw under an empty slot
  layers(partial) {
    if (!this.icons.length) return [];
    const fading = this.icons.length > 1 && this.tick >= 30;
    const alpha = fading ? Math.min(this.tick % 30 + partial, 4) / 4 : 1;
    const out = [];
    if (alpha < 1) out.push([this.icons[((this.index - 1) % this.icons.length + this.icons.length) % this.icons.length], 1 - alpha]);
    out.push([this.icons[this.index], alpha]);
    return out;
  }
}

export function smithingTemplateKind(game, item) {
  if (!item) return null;
  const name = String(game.items.name?.(item.id) ?? '').replace(/^minecraft:/, '');
  if (name === 'netherite_upgrade_smithing_template') return 'upgrade';
  if (name.endsWith('_armor_trim_smithing_template')) return 'trim';
  return null;
}

export function createSmithingScreen766(game, win, SimpleScreen) {
  class SmithingScreen extends SimpleScreen {
    constructor() {
      super(game, win, 'gui/container/smithing.png', SMITHING_SLOTS, { titleX: 44, titleY: 15 });
      this.cycles = [new CyclingSlotBackground(0), new CyclingSlotBackground(1), new CyclingSlotBackground(2)];
      this.partial = 0;
    }
    template() { return smithingTemplateKind(game, win.get(0)); }
    // containerTick
    tick() {
      super.tick();
      const kind = this.template();
      this.cycles[0].update(TEMPLATE_ICONS);
      this.cycles[1].update(kind ? ICONS[kind].base : []);
      this.cycles[2].update(kind ? ICONS[kind].addition : []);
    }
    // ItemCombinerScreen: all inputs present but no result
    hasRecipeError() { return !!(win.get(0) && win.get(1) && win.get(2) && !win.get(3)); }
    drawBackground(gui, mx, my, partial = 0) {
      super.drawBackground(gui);
      this.partial = partial;
      const x = this.guiLeft, y = this.guiTop;
      if (this.hasRecipeError()) gui.sprite('container/smithing/error', x + 65, y + 46, 28, 21);
      game.entityRenderer?.drawArmorStandPreview?.(gui, x + 141, y + 75, 25, win.get(3), partial);
    }
    drawEmptySlot(gui, i, x, y) {
      const cycle = this.cycles[i];
      if (!cycle) return;
      const A = game.assets;
      for (const [sprite, alpha] of cycle.layers(this.partial)) {
        const e = A.atlas?.entries.get(sprite);
        if (e) gui.quad(A.atlasTexture, x, y, x + 16, y + 16, e.uv[0], e.uv[1], e.uv[2], e.uv[3], [1, 1, 1, alpha]);
      }
    }
    // SmithingScreen.renderOnboardingTooltips
    renderExtraTooltip(gui, mx, my) {
      if (this.game.inventory?.cursor) return;
      let key = null;
      const lx = mx - this.guiLeft, ly = my - this.guiTop;
      if (this.hasRecipeError() && lx >= 65 && lx < 65 + 28 && ly >= 46 && ly < 46 + 21) key = 'container.upgrade.error_tooltip';
      if (this.hovered !== null && this.hovered !== undefined) {
        const kind = this.template(), hoveredItem = win.get(this.hovered);
        if (!win.get(0)) { if (this.hovered === 0) key = 'container.upgrade.missing_template_tooltip'; }
        else if (kind && !hoveredItem) {
          if (this.hovered === 1) key = ICONS[kind].baseTooltip;
          else if (this.hovered === 2) key = ICONS[kind].additionTooltip;
        }
      }
      if (key) gui.tooltip(gui.font.wrap(game.assets.translate(key), 115), mx, my);
    }
  }
  return new SmithingScreen();
}
