// Keyboard/mouse input on top of the platform events. Codes: KeyboardEvent.code names or 'mouseN'.
import { platform } from '../platform/platform.js';

export class Input {
  constructor(settings) {
    const P = platform();
    this.settings = settings;
    this.down = new Set();
    this.heldKeys = new Set(); // Physical keys survive pointer unlock; gameplay bindings are reset.
    this.toggled = {};
    this.pressed = []; // queued presses for the next tick: codes
    this.dx = 0;
    this.dy = 0;
    this.wheel = 0;
    this.locked = false;
    this.justLocked = false;
    this.mouseX = 0; // GUI coords set by game
    this.mouseY = 0;
    this.rawX = 0;
    this.rawY = 0;
    this.listeners = { key: [], char: [], mouse: [], wheel: [], move: [], lock: [] };

    P.on('pointerlock', (locked) => {
      this.locked = locked;
      if (locked) { this.justLocked = true; this.dx = 0; this.dy = 0; } else {this.down.clear();this.toggled={};}
      this.emit('lock', locked);
    });
    P.on('mousemove', (e) => {
      this.rawX = e.x; this.rawY = e.y;
      if (this.locked) {
        if (this.justLocked) this.justLocked = false; // first delta after locking can be a warp
        else {
          // Guard against recenter / boundary delta spikes
          this.dx += Math.abs(e.dx) > 300 ? 0 : e.dx;
          this.dy += Math.abs(e.dy) > 300 ? 0 : e.dy;
        }
      }
      this.emit('move', e);
    });
    P.on('mousedown', (e) => {
      const code = 'mouse' + e.button;
      this.rawX = e.x; this.rawY = e.y;
      if (this.locked) { this.togglePress(code); this.down.add(code); this.pressed.push(code); }
      this.emit('mouse', { code, button: e.button, down: true, shift: e.shift });
    });
    P.on('mouseup', (e) => {
      const code = 'mouse' + e.button;
      this.down.delete(code);
      this.emit('mouse', { code, button: e.button, down: false, shift: e.shift });
    });
    P.on('wheel', (d) => {
      d=(this.settings.discreteMouseScroll?Math.sign(d):d)*(this.settings.mouseWheelSensitivity??1);
      this.emit('wheel', d);
      if (this.locked){if(Math.sign(d)!==Math.sign(this.wheelCarry||0))this.wheelCarry=0;this.wheelCarry=(this.wheelCarry||0)+d;const steps=Math.trunc(this.wheelCarry);this.wheel+=steps;this.wheelCarry-=steps;}
    });
    P.on('keydown', (e) => {
      this.heldKeys.add(e.code);
      if (!e.repeat) { if(this.locked)this.togglePress(e.code); this.down.add(e.code); this.pressed.push(e.code); }
      this.emit('key', { ...e, down: true });
    });
    P.on('char', (text) => {
      // A key that opened a screen (e.g. T for chat) must not also type into it
      if (this.suppressNextChar) { this.suppressNextChar = false; if (text.length === 1) return; }
      const allowed=[...text].filter(ch=>ch>=' '||ch==='\n'||ch==='\r'||ch==='\t').join('');
      if(allowed)this.emit('char',allowed);
    });
    P.on('keyup', (e) => {
      this.heldKeys.delete(e.code);
      this.down.delete(e.code);
      this.emit('key', { ...e, down: false });
    });
    P.on('blur', () => {this.heldKeys.clear();this.down.clear();this.toggled={};});
  }

  on(ev, fn) { this.listeners[ev].push(fn); }
  emit(ev, a) { for (const fn of this.listeners[ev]) fn(a); }

  togglePress(code){
    for(const [bind,field] of [['sneak','toggleCrouch'],['sprint','toggleSprint']]){
      if(this.settings[field]&&this.settings.keys[bind]===code)this.toggled[bind]=!this.toggled[bind];
    }
  }

  isKeyHeld(code) { return this.heldKeys.has(code); }

  isDown(bind) {
    const field=bind==='sneak'?'toggleCrouch':bind==='sprint'?'toggleSprint':null;
    if(field&&this.settings[field])return !!this.toggled[bind];
    if(field)delete this.toggled[bind];
    const code = this.settings.keys[bind];
    return !!code && this.down.has(code);
  }

  consumePresses() {
    const p = this.pressed;
    this.pressed = [];
    return p;
  }

  isBind(bind, code) { return this.settings.keys[bind] === code; }

  lock() { if (!this.locked) platform().lockPointer(); }
  unlock() { platform().unlockPointer(); }

  takeMouseDelta() {
    const r = [this.dx, this.dy];
    this.dx = 0; this.dy = 0;
    return r;
  }
}
