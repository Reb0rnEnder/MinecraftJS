// Native 26.3 SmithingScreen (ItemCombinerScreen): template, base and addition slots with cycling
// container/slot/* sprites, the error sprite and onboarding tooltips, and an armor stand wearing the result.
const TEMPLATE_ICONS = ['container/slot/smithing_template_armor_trim', 'container/slot/smithing_template_netherite_upgrade'];
const slot = (name) => 'container/slot/' + name;
// SmithingTemplateItem.create*IconList in the pinned 26.3 jar
const ICONS = {
  upgrade: {
    base: ['helmet', 'sword', 'chestplate', 'pickaxe', 'leggings', 'axe', 'boots', 'hoe', 'shovel', 'nautilus_armor', 'spear'].map(slot),
    addition: [slot('ingot')],
    baseTooltip: 'item.minecraft.smithing_template.netherite_upgrade.base_slot_description',
    additionTooltip: 'item.minecraft.smithing_template.netherite_upgrade.additions_slot_description',
  },
  trim: {
    base: ['helmet', 'chestplate', 'leggings', 'boots'].map(slot),
    addition: ['ingot', 'redstone_dust', 'lapis_lazuli', 'quartz', 'diamond', 'emerald', 'amethyst_shard'].map(slot),
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

export function createSmithingScreen26_3(game, win, SimpleScreen) {
  class SmithingScreen extends SimpleScreen {
    constructor() {
      super(game, win, 'gui/container/smithing.png', SMITHING_SLOTS, { titleX: 44, titleY: 15 });
      this.cycles = [new CyclingSlotBackground(0), new CyclingSlotBackground(1), new CyclingSlotBackground(2)];
      this.partial = 0;
    }
    template() { return smithingTemplateKind(game, win.get(0)); }
    tick() {
      super.tick();
      const kind = this.template();
      this.cycles[0].update(TEMPLATE_ICONS);
      this.cycles[1].update(kind ? ICONS[kind].base : []);
      this.cycles[2].update(kind ? ICONS[kind].addition : []);
    }
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
      for (const [sprite, alpha] of cycle.layers(this.partial)) {
        gui.drawImage('gui/sprites/' + sprite + '.png', 0, 0, 16, 16, x, y, 16, 16, [1, 1, 1, alpha]);
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
