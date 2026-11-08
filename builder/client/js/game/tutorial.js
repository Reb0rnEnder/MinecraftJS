// Tutorial (1.12): the hint toasts for a new player (move, look, find a tree, punch it, open the inventory, craft
// planks). The current step is the "tutorialStep" option, saved so the hints only ever run once. Only survival goes
// past the movement step.
import { tr } from '../gui/i18n.js';

const LOGS = new Set([17, 162]);
const TREES = new Set([17, 162, 18, 161]);
const PLANKS = 5;

// TutorialToast.Icons (column, row in toasts.png from u 176)
const ICONS = { movement: [0, 0], mouse: [1, 0], tree: [2, 0], recipeBook: [0, 1], planks: [1, 1] };

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
    gui.blit('gui/toasts.png', 0, 0, 0, 96, 160, 32);
    gui.blit('gui/toasts.png', 6, 6, 176 + this.icon[0] * 20, this.icon[1] * 20, 20, 20);
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

  // InventoryPlayer.hasItemStack(new ItemStack(block)): same item and damage 0
  hasItem(ids) {
    const inv = this.game.inventory;
    const all = [...inv.main, ...inv.armor, inv.offhand];
    return all.some((it) => it && ids.has(it.id) && (it.damage | 0) === 0);
  }

  // The statistics the server has sent (from the stats screen)
  stat(name) { const v = this.game.statValues; return v ? v.get(name) || 0 : 0; }
  punchedTrees() { return ['log', 'log2', 'leaves', 'leaves2'].some((b) => this.stat('stat.mineBlock.minecraft.' + b) > 0); }

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
      if (waiting === 1 && (t.hasItem(TREES) || t.punchedTrees())) { t.setStep('craft_planks'); return; }
      if (waiting >= 6000 && !toast) toast = t.toast(new Toast('tree', tr('tutorial.find_tree.title'), tr('tutorial.find_tree.description'), false));
    },
    onStop() { if (toast) { toast.hide(); toast = null; } },
    onMouseHover(target) { if (target.type === 'block' && TREES.has(t.game.world.getState(target.x, target.y, target.z) >> 4)) t.setStep('punch_tree'); },
    handleSetSlot(item) { if (TREES.has(item.id)) t.setStep('craft_planks'); },
  };
}

function punchTreeStep(t) {
  let waiting = 0, resets = 0, toast = null;
  return {
    update() {
      waiting++;
      if (!t.survival()) { t.setStep('none'); return; }
      if (waiting === 1 && (t.hasItem(LOGS) || t.punchedTrees())) { t.setStep('craft_planks'); return; }
      if ((waiting >= 600 || resets > 3) && !toast) toast = t.toast(new Toast('tree', tr('tutorial.punch_tree.title'), tr('tutorial.punch_tree.description', t.key('attack')), true));
    },
    onStop() { if (toast) { toast.hide(); toast = null; } },
    onHitBlock(state, f) {
      const log = LOGS.has(state >> 4);
      if (log && f > 0) {
        if (toast) toast.setProgress(f);
        if (f >= 1) t.setStep('open_inventory');
      } else if (toast) toast.setProgress(0);
      else if (log) resets++;
    },
    handleSetSlot(item) { if (LOGS.has(item.id)) t.setStep('craft_planks'); },
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
      if (waiting === 1 && (t.hasItem(new Set([PLANKS])) || t.stat('stat.craftItem.minecraft.planks') > 0)) { t.setStep('none'); return; }
      if (waiting >= 1200 && !toast) toast = t.toast(new Toast('planks', tr('tutorial.craft_planks.title'), tr('tutorial.craft_planks.description'), false));
    },
    onStop() { if (toast) { toast.hide(); toast = null; } },
    handleSetSlot(item) { if (item.id === PLANKS) t.setStep('none'); },
  };
}
