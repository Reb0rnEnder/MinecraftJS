import { usingSpyglass } from '../game/spyglass.js';
// First-person hand/item rendering (port of vanilla 1.12 ItemRenderer.renderItemInFirstPerson, both hands).
import { playerModel } from './entity-models.js';
import { applyTransform } from './item-renderer.js';
import { entityMaterial } from './boxmodel.js';
import { FORMAT, EntityParams } from '../gfx/device.js';
import { material } from '../gfx/scene.js';
import { Node, drawTree } from '../gfx/scene.js';
import { mat4, D2R } from '../gfx/math.js';
import { platform } from '../platform/platform.js';

const sin = Math.sin, cos = Math.cos, sqrt = Math.sqrt;

export class HandRenderer {
  constructor(game) {
    this.game = game;
    this.root = new Node();
    this.proj = mat4.create();
    this.view = mat4.create();
    // items render with blending on (RenderItem), so translucent blocks stay translucent in the hand
    this.atlasMat = entityMaterial(() => game.assets.atlasTexture, { alphaTest: 0.1, transparent: true });
    this.renderArmPitch = 0; this.prevRenderArmPitch = 0;
    this.renderArmYaw = 0; this.prevRenderArmYaw = 0;
    this.skinDirty = false;
    this.content = new Node();
    this.root.add(this.content);
  }

  tick() {
    const p = this.game.player;
    this.prevRenderArmPitch = this.renderArmPitch;
    this.prevRenderArmYaw = this.renderArmYaw;
    this.renderArmPitch += (p.pitch - this.renderArmPitch) * 0.5;
    this.renderArmYaw += (p.yaw - this.renderArmYaw) * 0.5;
  }

  _itemObject(item) {
    return this.game.itemRenderer.objectFor(item, this.atlasMat, true);
  }

  _mapMeshes() {
    if (this._mapBg) return;
    const d = this.game.device;
    // pos(3) uv(2) normal(3) colour(3); normal (0, 0, -1) like the GL11.glNormal3f call
    const quad = (x0, y0, x1, y1, z) => d.createMesh(FORMAT.entity, new Float32Array([
      x0, y1, z, 0, 1, 0, 0, -1, 1, 1, 1,
      x1, y1, z, 1, 1, 0, 0, -1, 1, 1, 1,
      x1, y0, z, 1, 0, 0, 0, -1, 1, 1, 1,
      x0, y0, z, 0, 0, 0, 0, -1, 1, 1, 1,
    ]), { quads: true });
    this._mapBg = quad(-7, -7, 135, 135, 0);
    this._mapFg = quad(0, 0, 128, 128, -0.01);
    this.mapParams = new EntityParams().setNoLighting(true).setAlphaTest(0.01);
  }

  // Arm of one side for the empty hand (RenderPlayer.renderRightArm / renderLeftArm)
  _armFor(side) {
    this._armNodes = this._armNodes || {};
    if (this._armNodes[side]) return this._armNodes[side];
    const g = this.game, er = g.entityRenderer;
    const skin = er.skinFor({ uuid: g.playerUuid || '00000000-0000-0000-0000-000000000000' });
    const m = playerModel(skin.slim, 64, 64);
    const mat = this.armMat || (this.armMat = entityMaterial(er.skinTex(skin), { alphaTest: 0.1 }));
    m.animate(m, { ls: 0, lsa: 0, age: 0, yaw: 0, pitch: 0, swing: -9999 });
    const arm = side > 0 ? m.parts.rightArm : m.parts.leftArm;
    const wear = side > 0 ? m.parts.rightArmwear : m.parts.leftArmwear;
    arm.rx = 0; // RenderPlayer.renderRightArm: rotateAngleX = 0
    const holder = new Node();
    holder.scale.set(1 / 16, 1 / 16, 1 / 16);
    holder.add(arm.build()); arm.setMaterial(mat); arm.sync();
    if (wear) { holder.add(wear.build()); wear.setMaterial(mat); wear.copyAngles(arm); wear.sync(); }
    const n = new Node(); n.add(holder);
    this._armNodes[side] = n;
    return n;
  }

  _mapNodes(mapId) {
    const g = this.game;
    this._mapMeshes();
    const n = new Node();
    n.addDrawable(this._mapBg, material('entity', 'map/map_background.png', this.mapParams.p, { cull: false }));
    n.addDrawable(this._mapFg, material('entity', () => g.entityRenderer.mapTexture(mapId), this.mapParams.p, { blend: 'alpha', cull: false, polygonOffset: true }), { order: 1 });
    return n;
  }

  // Skin changes can be reported while prepare() is building the hand tree; defer the destructive reset.
  invalidateSkin() { this.skinDirty = true; }

  // Drop cached objects (skin / resource changes)
  reset() {
    this.skinDirty = false;
    this._armObj = null; this._armsObj = null; this._armNodes = null; this.armMat = null;
    this.hands = null; this.content.clear();
  }

  // ItemRenderer.renderItemInFirstPerson (1.9+): both hands. Returns { draw(device) } or null.
  prepare(partial) {
    const g = this.game, pl = g.player, it = g.interaction;
    if (g.sleeping || usingSpyglass(g)) return null;
    if (this.skinDirty) this.reset();
    // the hand renders with a fixed 70-degree FOV independent of the game FOV
    mat4.perspective(this.proj, 70 * D2R, platform().width / platform().height, 0.05, 10);
    if (!this.hands) {
      this.hands = [{ node: new Node(), key: undefined, obj: null }, { node: new Node(), key: undefined, obj: null }];
      this.content.clear();
      this.content.add(this.hands[0].node); this.content.add(this.hands[1].node);
    }
    const eye = g.eyePosition(partial);
    const sky = g.world.getSkyLight(Math.floor(eye[0]), Math.floor(eye[1]), Math.floor(eye[2]));
    const blk = g.world.getBlockLight(Math.floor(eye[0]), Math.floor(eye[1]), Math.floor(eye[2]));
    this.atlasMat.params.setLight(sky, blk);
    if (this.armMat) this.armMat.params.setLight(sky, blk);
    if (this.mapParams) this.mapParams.setLight(sky, blk);

    // EntityRenderer.renderHand: hurt camera effect + view bobbing, then ItemRenderer.rotateArm
    const base = mat4.create();
    const T = (m, x, y, z) => mat4.translate(m, m, x, y, z);
    const R = (m, a, x, y, z) => mat4.rotate(m, m, a * D2R, x, y, z);
    const S = (m, x, y, z) => mat4.scale(m, m, x, y, z);
    if (g.hurtTime > 0) { let f = (g.hurtTime - partial) / 10; f = sin(f * f * f * f * Math.PI); R(base, -f * 14, 0, 0, 1); }
    if (g.settings.viewBobbing) {
      const f = pl.distanceWalked - pl.prevDistanceWalked, f1 = -(pl.distanceWalked + f * partial);
      const f2 = pl.prevCameraYaw + (pl.cameraYaw - pl.prevCameraYaw) * partial, f3 = pl.prevCameraPitch + (pl.cameraPitch - pl.prevCameraPitch) * partial;
      T(base, sin(f1 * Math.PI) * f2 * 0.5, -Math.abs(cos(f1 * Math.PI) * f2), 0);
      R(base, sin(f1 * Math.PI) * f2 * 3, 0, 0, 1); R(base, Math.abs(cos(f1 * Math.PI - 0.2) * f2) * 5, 1, 0, 0); R(base, f3, 1, 0, 0);
    }
    const pitch = pl.prevPitch + (pl.pitch - pl.prevPitch) * partial, yaw = pl.prevYaw + (pl.yaw - pl.prevYaw) * partial;
    const armPitch = this.prevRenderArmPitch + (this.renderArmPitch - this.prevRenderArmPitch) * partial;
    const armYaw = this.prevRenderArmYaw + (this.renderArmYaw - this.prevRenderArmYaw) * partial;
    R(base, (pitch - armPitch) * 0.1, 1, 0, 0);
    R(base, (yaw - armYaw) * 0.1, 0, 1, 0);
    this.content.matrix = base;

    // EntityLivingBase.getSwingProgress, applied to the hand that swung
    let sd = it.swingProgress - it.prevSwingProgress;
    if (sd < 0) sd += 1;
    const swing = it.prevSwingProgress + sd * partial;
    const stacks = [g.inventory.held(), g.inventory.offhand];
    const primary = g.settings.mainHand === 'left' ? -1 : 1; // EnumHandSide of the main hand: 1 right, -1 left
    let drawMain = true, drawOff = true;
    if (pl.usingItem) {
      const active = stacks[it.activeHand || 0];
      if (active && ['bow','crossbow'].includes(g.items.name(active.id))) { drawMain = (it.activeHand || 0) === 0; drawOff = !drawMain; }
    }
    else if(stacks[0]&&g.items.name(stacks[0].id)==='crossbow'&&g.items.crossbowCharged(stacks[0]))drawOff=false;
    for (let hand = 0; hand < 2; hand++) {
      const h = this.hands[hand];
      const draw = hand === 0 ? drawMain : drawOff;
      const sw = (it.swingHand || 0) === hand ? swing : 0;
      const equip = 1 - (hand === 0
        ? it.prevEquipProgress + (it.equipProgress - it.prevEquipProgress) * partial
        : it.prevEquipProgressOff + (it.equipProgressOff - it.prevEquipProgressOff) * partial);
      h.node.visible = draw;
      if (!draw) continue;
      const stack = stacks[hand];
      const side = hand === 0 ? primary : -primary;
      const m = mat4.create();
      let key;
      if (!stack) key = hand === 0 && !pl.invisible ? 'arm' + side : null;
      else if (g.items.name(stack.id) === 'filled_map') {const mapId=g.items.nbt(stack)?.map??0;key = hand === 0 && !stacks[1] ? 'map2:' + mapId : 'mapside' + side + ':' + mapId;}
      else key = 'item' + side + ':' + g.itemRenderer.iconKey(stack, true);
      if (key !== h.key) this._buildHand(h, key, stack, side);
      if (!stack) {
        if (key) this._armMatrix(m, equip, sw, side);
      } else if (g.items.name(stack.id) === 'filled_map') {
        if (key.startsWith('map2')) this._mapMatrix(h, m, pitch, equip, sw);
        else this._mapSideMatrix(h, m, equip, sw, side);
      } else {
        this._itemMatrix(m, stack, hand, side, equip, sw, partial);
      }
      h.node.matrix = m;
    }
    const r = g.renderer;
    return {
      draw: (device) => {
        device.setGlobals({ view: this.view, proj: this.proj, fogMode: 2, lightmap: r.lightmap });
        drawTree(device, this.root, { resolve: g.entityRenderer.resolve });
        for (const h of this.hands) if (h.node.visible && h.glint) g.entityRenderer.drawGlint(device, h.glint, this.atlasMat);
      },
    };
  }

  _buildHand(h, key, stack, side) {
    h.key = key;
    h.node.clear();
    h.glint = null;
    h.parts = null;
    if (!key) return;
    if (!stack) { h.node.add(this._armFor(side)); return; }
    if (this.game.items.name(stack.id) === 'filled_map') {
      const map = this._mapNodes(this.game.items.nbt(stack)?.map??0);
      if (key.startsWith('map2')) {
        const right = new Node(); right.add(this._armFor(1));
        const left = new Node(); left.add(this._armFor(-1));
        h.parts = { right, left, map };
        h.node.add(right); h.node.add(left); h.node.add(map);
      } else {
        const arm = new Node(); arm.add(this._armFor(side));
        h.parts = { arm, map };
        h.node.add(arm); h.node.add(map);
      }
      return;
    }
    const io = this._itemObject(stack);
    if (!io) return;
    // renderItemSide: FIRST_PERSON_RIGHT_HAND / LEFT_HAND transform (mirrored for the left hand)
    const t = new Node();
    const d = io.model.display || {};
    applyTransform(t, side > 0 ? d.firstperson_righthand : d.firstperson_lefthand || d.firstperson_righthand, side < 0);
    t.add(io.obj);
    h.node.add(t);
    if (io.obj.userData.glint) h.glint = t;
  }

  // transformSideFirstPerson
  _side(m, side, equip) { mat4.translate(m, m, side * 0.56, -0.52 + equip * -0.6, -0.72); }

  // renderItemInFirstPerson for one hand holding an item
  _itemMatrix(m, stack, hand, side, equip, sw, partial) {
    const g = this.game, pl = g.player, it = g.interaction;
    const R = (a, x, y, z) => mat4.rotate(m, m, a * D2R, x, y, z);
    if (pl.usingItem && (it.activeHand || 0) === hand && it.useTicks > 0) {
      const act = g.items.useAction(stack);
      const maxDur = g.items.useDuration(stack);
      if (act === 'eat' || act === 'drink') {
        // transformEatFirstPerson
        const f = maxDur - it.useTicks - partial + 1;
        const f1 = f / maxDur;
        if (f1 < 0.8) mat4.translate(m, m, 0, Math.abs(cos(f / 4 * Math.PI) * 0.1), 0);
        const f3 = 1 - Math.pow(f1, 27);
        mat4.translate(m, m, f3 * 0.6 * side, f3 * -0.5, 0);
        R(side * f3 * 90, 0, 1, 0); R(f3 * 10, 1, 0, 0); R(side * f3 * 30, 0, 0, 1);
        this._side(m, side, equip);
      } else if (act === 'bow') {
        this._side(m, side, equip);
        mat4.translate(m, m, side * -0.2785682, 0.18344387, 0.15731531);
        R(-13.935, 1, 0, 0); R(side * 35.3, 0, 1, 0); R(side * -9.785, 0, 0, 1);
        const f5 = it.useTicks + partial;
        let f6 = f5 / 20;
        f6 = (f6 * f6 + f6 * 2) / 3;
        if (f6 > 1) f6 = 1;
        if (f6 > 0.1) {
          const f4 = sin((f5 - 0.1) * 1.3) * (f6 - 0.1);
          mat4.translate(m, m, 0, f4 * 0.004, 0);
        }
        mat4.translate(m, m, 0, 0, f6 * 0.04);
        mat4.scale(m, m, 1, 1, 1 + f6 * 0.2);
        R(side * 45, 0, -1, 0);
      } else if (act === 'crossbow') {
        this._side(m,side,equip);
        mat4.translate(m,m,side*-.4785682,-.094387,.05731531);
        R(-11.935,1,0,0);R(side*65.3,0,1,0);R(side*-9.785,0,0,1);
        const ticks=it.useTicks+partial,charge=Math.min(1,ticks/g.items.crossbowChargeDuration(stack));
        if(charge>.1)mat4.translate(m,m,0,sin((ticks-.1)*1.3)*(charge-.1)*.004,0);
        mat4.translate(m,m,0,0,charge*.04);mat4.scale(m,m,1,1,1+charge*.2);R(side*45,0,-1,0);
      } else if (act === 'spear') {
        // ItemRenderer (cuc): ten ticks to charge the throw, then hold it back.
        this._side(m, side, equip);
        mat4.translate(m, m, side * -0.5, 0.7, 0.1);
        R(-55, 1, 0, 0); R(side * 35.3, 0, 1, 0); R(side * -9.785, 0, 0, 1);
        const charge = Math.min(1, (it.useTicks + partial) / 10);
        if (charge > 0.1) mat4.translate(m, m, 0, sin((charge - 0.1) * 1.3) * (charge - 0.1) * 0.004, 0);
        mat4.translate(m, m, 0, 0, charge * 0.2);
        mat4.scale(m, m, 1, 1, 1 + charge * 0.2);
        R(side * 45, 0, -1, 0);
      } else this._side(m, side, equip); // NONE and BLOCK (shields)
      return;
    }
    const f = -0.4 * sin(sqrt(sw) * Math.PI);
    const f1 = 0.2 * sin(sqrt(sw) * Math.PI * 2);
    const f2 = -0.2 * sin(sw * Math.PI);
    mat4.translate(m, m, side * f, f1, f2);
    this._side(m, side, equip);
    // transformFirstPerson
    const a = sin(sw * sw * Math.PI);
    R(side * (45 + a * -20), 0, 1, 0);
    const b = sin(sqrt(sw) * Math.PI);
    R(side * b * -20, 0, 0, 1);
    R(b * -80, 1, 0, 0);
    if(hand===0&&g.items.name(stack.id)==='crossbow'&&g.items.crossbowCharged(stack)&&sw<.001){mat4.translate(m,m,side*-.641864,0,0);R(side*10,0,1,0);}
    R(side * -45, 0, 1, 0);
  }

  // renderArmFirstPerson
  _armMatrix(m, equip, sw, side) {
    const R = (a, x, y, z) => mat4.rotate(m, m, a * D2R, x, y, z);
    const f1 = sqrt(sw);
    const f2 = -0.3 * sin(f1 * Math.PI), f3 = 0.4 * sin(f1 * Math.PI * 2), f4 = -0.4 * sin(sw * Math.PI);
    mat4.translate(m, m, side * (f2 + 0.64000005), f3 - 0.6 + equip * -0.6, f4 - 0.71999997);
    R(side * 45, 0, 1, 0);
    const f5 = sin(sw * sw * Math.PI), f6 = sin(f1 * Math.PI);
    R(side * f6 * 70, 0, 1, 0);
    R(side * f5 * -20, 0, 0, 1);
    mat4.translate(m, m, side * -1, 3.6, 3.5);
    R(side * 120, 0, 0, 1);
    R(200, 1, 0, 0);
    R(side * -135, 0, 1, 0);
    mat4.translate(m, m, side * 5.6, 0, 0);
  }

  // renderArm (map arms): rotate 92 Y, 45 X, -41 Z, translate(0.3, -1.1, 0.45)
  _mapArm(side) {
    const a = mat4.create();
    mat4.rotate(a, a, 92 * D2R, 0, 1, 0); mat4.rotate(a, a, 45 * D2R, 1, 0, 0); mat4.rotate(a, a, side * -41 * D2R, 0, 0, 1);
    mat4.translate(a, a, side * 0.3, -1.1, 0.45);
    return a;
  }

  // ItemRenderer.renderMapFirstPerson(ItemStack): turn to face, scale 0.38, then 1/128 per map pixel
  _mapItem(m) {
    mat4.rotate(m, m, Math.PI, 0, 1, 0); mat4.rotate(m, m, Math.PI, 0, 0, 1);
    mat4.scale(m, m, 0.38, 0.38, 0.38);
    mat4.translate(m, m, -0.5, -0.5, 0);
    mat4.scale(m, m, 0.0078125, 0.0078125, 0.0078125);
    return m;
  }

  // renderMapFirstPerson(pitch, equip, swing): both hands
  _mapMatrix(h, m, pitch, equip, sw) {
    const f = sqrt(sw);
    const f1 = -0.2 * sin(sw * Math.PI), f2 = -0.4 * sin(f * Math.PI);
    mat4.translate(m, m, 0, -f1 / 2, f2);
    let f3 = 1 - pitch / 45 + 0.1; // getMapAngleFromPitch
    f3 = Math.max(0, Math.min(1, f3));
    f3 = -cos(f3 * Math.PI) * 0.5 + 0.5;
    mat4.translate(m, m, 0, 0.04 + equip * -1.2 + f3 * -0.5, -0.72);
    mat4.rotate(m, m, f3 * -85 * D2R, 1, 0, 0);
    if (!h.parts) return;
    const visible = !this.game.player.invisible;
    h.parts.right.visible = h.parts.left.visible = visible;
    const arms = mat4.create(); mat4.rotate(arms, arms, 90 * D2R, 0, 1, 0);
    h.parts.right.matrix = mat4.multiply(mat4.create(), arms, this._mapArm(1));
    h.parts.left.matrix = mat4.multiply(mat4.create(), arms, this._mapArm(-1));
    const mm = mat4.create();
    mat4.rotate(mm, mm, sin(f * Math.PI) * 20 * D2R, 1, 0, 0);
    mat4.scale(mm, mm, 2, 2, 2);
    h.parts.map.matrix = this._mapItem(mm);
  }

  // renderMapFirstPersonSide: the map in one hand
  _mapSideMatrix(h, m, equip, sw, side) {
    mat4.translate(m, m, side * 0.125, -0.125, 0);
    if (!h.parts) return;
    h.parts.arm.visible = !this.game.player.invisible;
    const am = mat4.create(); mat4.rotate(am, am, side * 10 * D2R, 0, 0, 1);
    this._armMatrix(am, equip, sw, side);
    h.parts.arm.matrix = am;
    const mm = mat4.create();
    mat4.translate(mm, mm, side * 0.51, -0.08 + equip * -1.2, -0.75);
    const f1 = sqrt(sw), f2 = sin(f1 * Math.PI);
    mat4.translate(mm, mm, side * -0.5 * f2, 0.4 * sin(f1 * Math.PI * 2) - 0.3 * f2, -0.3 * sin(sw * Math.PI));
    mat4.rotate(mm, mm, f2 * -45 * D2R, 1, 0, 0);
    mat4.rotate(mm, mm, side * f2 * -30 * D2R, 0, 1, 0);
    h.parts.map.matrix = this._mapItem(mm);
  }
}
