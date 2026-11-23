// Tutorial (1.13+): the hint toasts for a new player (move, look, find a tree, punch it, open the inventory, craft
// planks). The current step is the "tutorialStep" option, saved so the hints only ever run once. Only survival goes
// past the movement step. Trees, logs and planks are recognised the native way for this release: logs and planks by
// their block/item tags, trees by #minecraft:completes_find_tree_tutorial.
import { tr } from '../gui/i18n.js';
import { DEFAULT_TAGS } from './default-tags.js';
import { getBlock } from '../world/blocks.js';

// FindTreeTutorialStepInstance.TREE_BLOCKS (null: the completes_find_tree_tutorial tags decide)
const TREE_BLOCKS = null;
const FIND_TREE_TAG = 'minecraft:completes_find_tree_tutorial';

// TutorialToast.Icons sprites
const ICONS = { movement: 'toast/movement_keys', mouse: 'toast/mouse', tree: 'toast/tree', recipeBook: 'toast/recipe_book', planks: 'toast/wooden_planks' };

class Toast {
  constructor(icon, title, subtitle, progressBar) {
    this.type = 'tutorial';
    this.icon = ICONS[icon]; this.title = title; this.subtitle = subtitle; this.progressBar = progressBar;
    this.visibility = 'show';
    this.displayed = 0; this.current = 0; this.lastDelta = 0;
  }
  hide() { this.visibility = 'hide'; }
  setProgress(f) { this.current = f; }

  // TutorialToast.draw
  draw(gui, delta) {
    gui.sprite('toast/tutorial', 0, 0, 160, 32);
    gui.sprite(this.icon, 6, 6, 20, 20);
    if (this.subtitle == null) gui.text(this.title, 30, 12, 0x500050, false);
    else { gui.text(this.title, 30, 7, 0x500050, false); gui.text(this.subtitle, 30, 18, 0x000000, false); }
    if (this.progressBar) {
      gui.rect(3, 28, 157, 29, 0xffffffff);
      const t = Math.max(0, Math.min(1, (delta - this.lastDelta) / 100));
      const f = this.displayed + (this.current - this.displayed) * t; // MathHelper.clampedLerp
      gui.rect(3, 28, Math.trunc(3 + 154 * f), 29, this.current >= this.displayed ? 0xff005500 : 0xff550000);
      this.displayed = f;
      this.lastDelta = delta;
    }
    return this.visibility;
  }
}

export class Tutorial {
  constructor(game) {
    this.game = game;
    this.step = null;
  }

  // Tutorial.createKeybindComponent: the bound key's name in bold
  key(name) { const s = this.game.settings; return '§l' + s.keyName(s.keys[name]) + '§r'; }
  survival() { return this.game.gameMode === 0; }
  toast(t) { this.game.hud.addToast(t); return t; }

  // Inventory.contains: any non-empty stack in the main, armour or offhand compartments matching the test
  hasItem(test) {
    const inv = this.game.inventory;
    return [...inv.main, ...inv.armor, inv.offhand].some((it) => it && it.id && test(it));
  }
  tagged(kind, tag, id) {
    const tags = this.game.world?.registryTags;
    return tags?.contains ? tags.contains(kind, tag, id) : (DEFAULT_TAGS[kind]?.[tag] || []).includes(id);
  }
  itemName(item) { return this.game.items.def?.(item.id)?.name || this.game.assets.data.items.find((d) => d.id === item.id)?.name; }
  isLog(item) { return this.tagged('items', 'minecraft:logs', item.id); }
  isPlanks(item) { return this.tagged('items', 'minecraft:planks', item.id); }
  isLogBlock(state) { const b = getBlock(state); return !!b && this.tagged('blocks', 'minecraft:logs', b.id); }
  // the blocks/items that complete the find-tree step
  isTreeBlock(state) { const b = getBlock(state); return !!b && b.id !== 0 && (TREE_BLOCKS ? TREE_BLOCKS.includes(b.name) : this.tagged('blocks', FIND_TREE_TAG, b.id)); }
  isTreeItem(item) { return TREE_BLOCKS ? TREE_BLOCKS.includes(this.itemName(item)) : this.tagged('items', FIND_TREE_TAG, item.id); }

  // FindTreeTutorialStepInstance.hasPunchedTreesPreviously: any tree block mined
  punchedTrees() {
    const stats = this.game.statsCounter; if (!stats) return false;
    return (this.game.assets.data.blocks || []).some((b) => (TREE_BLOCKS ? TREE_BLOCKS.includes(b.name) : this.tagged('blocks', FIND_TREE_TAG, b.id)) && stats.get('mined', b.name) > 0);
  }

  // CraftPlanksTutorialStep.hasCraftedPlanksPreviously: any #minecraft:planks item crafted
  craftedPlanks() {
    const stats = this.game.statsCounter; if (!stats) return false;
    return (this.game.assets.data.items || []).some((it) => this.tagged('items', 'minecraft:planks', it.id) && stats.get('crafted', it.name) > 0);
  }

  update() {
    if (this.step) {
      if (this.game.inWorld) this.step.update(); else this.stop();
    } else if (this.game.inWorld) this.reload();
  }

  reload() {
    if (this.step) this.stop();
    this.step = this.create(this.game.settings.tutorialStep);
  }

  stop() {
    if (!this.step) return;
    this.step.onStop();
    this.step = null;
  }

  setStep(name) {
    const s = this.game.settings;
    s.tutorialStep = name;
    s.save();
    if (this.step) { this.step.onStop(); this.step = this.create(name); }
  }

  handleMovement(input) { if (this.step && this.step.handleMovement) this.step.handleMovement(input); }
  handleMouse(dx, dy) { if (this.step && this.step.handleMouse) this.step.handleMouse(dx, dy); }
  onMouseHover(target) { if (this.step && this.step.onMouseHover && target) this.step.onMouseHover(target); }
  onHitBlock(state, f) { if (this.step && this.step.onHitBlock) this.step.onHitBlock(state, f); }
  openInventory() { if (this.step && this.step.openInventory) this.step.openInventory(); }
  handleSetSlot(item) { if (this.step && this.step.handleSetSlot && item) this.step.handleSetSlot(item); }

  // TutorialSteps
  create(name) {
    const make = { movement: movementStep, find_tree: findTreeStep, punch_tree: punchTreeStep, open_inventory: openInventoryStep, craft_planks: craftPlanksStep }[name];
    return make ? make(this) : { update() {}, onStop() {} };
  }
}

function movementStep(t) {
  let waiting = 0, moved = 0, looked = 0, didMove = false, didTurn = false, moveDone = -1, lookDone = -1, moveToast = null, lookToast = null;
  return {
    update() {
      waiting++;
      if (didMove) { moved++; didMove = false; }
      if (didTurn) { looked++; didTurn = false; }
      if (moveDone === -1 && moved > 40) { if (moveToast) { moveToast.hide(); moveToast = null; } moveDone = waiting; }
      if (lookDone === -1 && looked > 40) { if (lookToast) { lookToast.hide(); lookToast = null; } lookDone = waiting; }
      if (moveDone !== -1 && lookDone !== -1) t.setStep(t.survival() ? 'find_tree' : 'none');
      if (moveToast) moveToast.setProgress(moved / 40);
      if (lookToast) lookToast.setProgress(looked / 40);
      if (waiting >= 100) {
        if (moveDone === -1 && !moveToast) {
          moveToast = t.toast(new Toast('movement', tr('tutorial.move.title', t.key('forward'), t.key('left'), t.key('back'), t.key('right')), tr('tutorial.move.description', t.key('jump')), true));
        } else if (moveDone !== -1 && waiting - moveDone >= 20 && lookDone === -1 && !lookToast) {
          lookToast = t.toast(new Toast('mouse', tr('tutorial.look.title'), tr('tutorial.look.description'), true));
        }
      }
    },
    onStop() { if (moveToast) moveToast.hide(); if (lookToast) lookToast.hide(); moveToast = lookToast = null; },
    handleMovement(i) { if (i.forward || i.back || i.left || i.right || i.jump) didMove = true; },
    handleMouse(dx, dy) { if (Math.abs(dx) > 0.01 || Math.abs(dy) > 0.01) didTurn = true; },
  };
}

function findTreeStep(t) {
  let waiting = 0, toast = null;
  return {
    update() {
      waiting++;
      if (!t.survival()) { t.setStep('none'); return; }
      if (waiting === 1 && (t.hasItem((it) => t.isTreeItem(it)) || t.punchedTrees())) { t.setStep('craft_planks'); return; }
      if (waiting >= 6000 && !toast) toast = t.toast(new Toast('tree', tr('tutorial.find_tree.title'), tr('tutorial.find_tree.description'), false));
    },
    onStop() { if (toast) { toast.hide(); toast = null; } },
    onMouseHover(target) { if (target.type === 'block' && t.isTreeBlock(t.game.world.getState(target.x, target.y, target.z))) t.setStep('punch_tree'); },
    handleSetSlot(item) { if (t.isTreeItem(item)) t.setStep('craft_planks'); },
  };
}

function punchTreeStep(t) {
  let waiting = 0, resets = 0, toast = null;
  return {
    update() {
      waiting++;
      if (!t.survival()) { t.setStep('none'); return; }
      if (waiting === 1 && (t.hasItem((it) => t.isLog(it)) || t.punchedTrees())) { t.setStep('craft_planks'); return; }
      if ((waiting >= 600 || resets > 3) && !toast) toast = t.toast(new Toast('tree', tr('tutorial.punch_tree.title'), tr('tutorial.punch_tree.description', t.key('attack')), true));
    },
    onStop() { if (toast) { toast.hide(); toast = null; } },
    onHitBlock(state, f) {
      const log = t.isLogBlock(state);
      if (log && f > 0) {
        if (toast) toast.setProgress(f);
        if (f >= 1) t.setStep('open_inventory');
      } else if (toast) toast.setProgress(0);
      else if (log) resets++;
    },
    handleSetSlot(item) { if (t.isLog(item)) t.setStep('craft_planks'); },
  };
}

function openInventoryStep(t) {
  let waiting = 0, toast = null;
  return {
    update() {
      waiting++;
      if (!t.survival()) { t.setStep('none'); return; }
      if (waiting >= 600 && !toast) toast = t.toast(new Toast('recipeBook', tr('tutorial.open_inventory.title'), tr('tutorial.open_inventory.description', t.key('inventory')), false));
    },
    onStop() { if (toast) { toast.hide(); toast = null; } },
    openInventory() { t.setStep('craft_planks'); },
  };
}

function craftPlanksStep(t) {
  let waiting = 0, toast = null;
  return {
    update() {
      waiting++;
      if (!t.survival()) { t.setStep('none'); return; }
      if (waiting === 1 && (t.hasItem((it) => t.isPlanks(it)) || t.craftedPlanks())) { t.setStep('none'); return; }
      if (waiting >= 1200 && !toast) toast = t.toast(new Toast('planks', tr('tutorial.craft_planks.title'), tr('tutorial.craft_planks.description'), false));
    },
    onStop() { if (toast) { toast.hide(); toast = null; } },
    handleSetSlot(item) { if (t.isPlanks(item)) t.setStep('none'); },
  };
}
