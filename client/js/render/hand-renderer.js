// First-person hand/item rendering (port of vanilla ItemRenderer.renderItemInFirstPerson).
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
    this.itemKey = undefined;
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

  _arm() {
    if (this._armObj) return this._armObj;
    const g = this.game;
    const er = g.entityRenderer;
    const skin = er.skinFor({ uuid: g.playerUuid || '00000000-0000-0000-0000-000000000000' });
    const m = playerModel(skin.slim, 64, 64);
    const mat = entityMaterial(er.skinTex(skin), { alphaTest: 0.1 });
    this.armMat = mat;
    const holder = new Node();
    holder.scale.set(1 / 16, 1 / 16, 1 / 16);
    const arm = m.parts.rightArm;
    const wear = m.parts.rightArmwear;
    holder.add(arm.build());
    arm.setMaterial(mat);
    if (wear) { holder.add(wear.build()); wear.setMaterial(mat); }
    // ModelPlayer.renderRightArm: setRotationAngles with zeroes (idle sway at age 0)
    m.animate(m, { ls: 0, lsa: 0, age: 0, yaw: 0, pitch: 0, swing: -9999 });
    arm.sync();
    if (wear) { wear.copyAngles(arm); wear.sync(); }
    this._armObj = holder;
    return holder;
  }

  _itemObject(item) {
    return this.game.itemRenderer.objectFor(item, this.atlasMat);
  }

  // Both arms (RenderPlayer.renderRightArm / renderLeftArm) for holding a map
  _arms() {
    if (this._armsObj) return this._armsObj;
    const g = this.game, er = g.entityRenderer;
    const skin = er.skinFor({ uuid: g.playerUuid || '00000000-0000-0000-0000-000000000000' });
    const m = playerModel(skin.slim, 64, 64);
    const mat = entityMaterial(er.skinTex(skin), { alphaTest: 0.1 });
    this.armsMat = mat;
    m.animate(m, { ls: 0, lsa: 0, age: 0, yaw: 0, pitch: 0, swing: -9999 });
    const side = (arm, wear) => {
      const n = new Node();
      const holder = new Node(); holder.scale.set(1 / 16, 1 / 16, 1 / 16);
      holder.add(arm.build()); arm.setMaterial(mat); arm.sync();
      if (wear) { holder.add(wear.build()); wear.setMaterial(mat); wear.copyAngles(arm); wear.sync(); }
      n.add(holder);
      return n;
    };
    this._armsObj = { right: side(m.parts.rightArm, m.parts.rightArmwear), left: side(m.parts.leftArm, m.parts.leftArmwear) };
    return this._armsObj;
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

  // ItemRenderer.renderItemMap: both arms holding the map in front, tilting with the view pitch
  _prepareMap(partial, held) {
    const g = this.game, pl = g.player, it = g.interaction;
    this._mapMeshes();
    const arms = this._arms();
    if (!this.mapMode || this.itemKey !== 'map:' + held.damage) {
      this.mapMode = true; this.itemKey = 'map:' + held.damage;
      this.itemObj = null;
      this.content.clear();
      this.mapNode = new Node();
      const mapId = held.damage;
      this.mapNode.addDrawable(this._mapBg, material('entity', 'map/map_background.png', this.mapParams.p, { cull: false }));
      this.mapNode.addDrawable(this._mapFg, material('entity', () => g.entityRenderer.mapTexture(mapId), this.mapParams.p, { blend: 'alpha', cull: false, polygonOffset: true }), { order: 1 });
      this.content.add(arms.right); this.content.add(arms.left); this.content.add(this.mapNode);
    }
    const eye = g.eyePosition(partial);
    const sky = g.world.getSkyLight(Math.floor(eye[0]), Math.floor(eye[1]), Math.floor(eye[2]));
    const blk = g.world.getBlockLight(Math.floor(eye[0]), Math.floor(eye[1]), Math.floor(eye[2]));
    this.mapParams.setLight(sky, blk);
    if (this.armsMat) this.armsMat.params.setLight(sky, blk);
    arms.right.visible = arms.left.visible = !pl.invisible;

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
    const equip = 1 - (it.prevEquipProgress + (it.equipProgress - it.prevEquipProgress) * partial);
    let swd = it.swingProgress - it.prevSwingProgress;
    if (swd < 0) swd += 1;
    const sw = it.prevSwingProgress + swd * partial;
    T(base, -0.4 * sin(sqrt(sw) * Math.PI), 0.2 * sin(sqrt(sw) * Math.PI * 2), -0.2 * sin(sw * Math.PI));
    // getMapAngleFromPitch
    let f3 = 1 - pitch / 45 + 0.1;
    f3 = Math.max(0, Math.min(1, f3));
    f3 = -cos(f3 * Math.PI) * 0.5 + 0.5;
    T(base, 0, 0.04, -0.72);
    T(base, 0, equip * -1.2, 0);
    T(base, 0, f3 * -0.5, 0);
    R(base, 90, 0, 1, 0);
    R(base, f3 * -85, 0, 0, 1);
    this.content.matrix = base;
    const ra = mat4.create(); R(ra, 54, 0, 1, 0); R(ra, 64, 1, 0, 0); R(ra, -62, 0, 0, 1); T(ra, 0.25, -0.85, 0.75);
    arms.right.matrix = ra;
    const la = mat4.create(); R(la, 42, 0, 1, 0); R(la, -55, 0, 0, 1); T(la, -0.3, -1.1, 0.45);
    arms.left.matrix = la;
    const mm = mat4.create();
    const f4 = sin(sw * sw * Math.PI), f5 = sin(sqrt(sw) * Math.PI);
    R(mm, f4 * -20, 0, 1, 0); R(mm, f5 * -20, 0, 0, 1); R(mm, f5 * -80, 1, 0, 0);
    S(mm, 0.38, 0.38, 0.38);
    R(mm, 90, 0, 1, 0); R(mm, 180, 0, 0, 1);
    T(mm, -1, -1, 0);
    S(mm, 0.015625, 0.015625, 0.015625);
    this.mapNode.matrix = mm;
    mat4.perspective(this.proj, 70 * D2R, platform().width / platform().height, 0.05, 10);
    const r = g.renderer;
    return {
      draw: (device) => {
        device.setGlobals({ view: this.view, proj: this.proj, fogMode: 2, lightmap: r.lightmap });
        drawTree(device, this.root, { resolve: g.entityRenderer.resolve });
      },
    };
  }

  // Drop cached objects (skin / resource changes)
  invalidateSkin() { this.skinDirty = true; }

  reset() { this.skinDirty = false; this._armObj = null; this._armsObj = null; this.mapMode = false; this.itemKey = undefined; this.content.clear(); }

  // Returns { draw(device) } to render after the world, or null
  prepare(partial, fov) {
    const g = this.game;
    const pl = g.player;
    const it = g.interaction;
    if (g.sleeping) return null;
    if (this.skinDirty) this.reset();
    // Vanilla renders first-person hand/item with a fixed 70-degree FOV independent of game FOV
    mat4.perspective(this.proj, 70 * D2R, platform().width / platform().height, 0.05, 10);
    const held = g.inventory.held();
    const key = held ? held.id + ':' + held.damage + ':' + (held.id === 261 ? g.itemRenderer.modelFor(held).name : '') : null;
    if (held && held.id === 358) return this._prepareMap(partial, held);
    if (this.mapMode) { this.mapMode = false; this.itemKey = undefined; this.content.matrix = null; }
    if (key !== this.itemKey) {
      this.itemKey = key;
      this.content.clear();
      this.itemObj = null;
      if (held) {
        const io = this._itemObject(held);
        if (io) {
          const s2 = new Node(); s2.scale.setScalar(2);
          const t = new Node();
          applyTransform(t, io.model.display && io.model.display.firstperson);
          const s05 = new Node(); s05.scale.setScalar(0.5);
          s05.add(io.obj); t.add(s05); s2.add(t);
          this.itemObj = s2;
          this.content.add(s2);
        }
      } else if (!pl.invisible) {
        this.content.add(this._arm());
      }
    }
    // Light from the player's position
    const eye = g.eyePosition(partial);
    const sky = g.world.getSkyLight(Math.floor(eye[0]), Math.floor(eye[1]), Math.floor(eye[2]));
    const blk = g.world.getBlockLight(Math.floor(eye[0]), Math.floor(eye[1]), Math.floor(eye[2]));
    if (this.armMat) this.armMat.params.setLight(sky, blk);
    this.atlasMat.params.setLight(sky, blk);

    // Build transform chain each frame (as GL matrix ops, in order)
    const ops = [];
    const T = (x, y, z) => ops.push(['t', x, y, z]);
    const R = (a, x, y, z) => ops.push(['r', a, x, y, z]);
    const S = (x, y, z) => ops.push(['s', x, y, z]);
    // hurtCameraEffect
    if (g.hurtTime > 0) {
      let f = (g.hurtTime - partial) / 10;
      f = sin(f * f * f * f * Math.PI);
      R(-f * 14, 0, 0, 1);
    }
    // view bobbing
    if (g.settings.viewBobbing) {
      const f = pl.distanceWalked - pl.prevDistanceWalked;
      const f1 = -(pl.distanceWalked + f * partial);
      const f2 = pl.prevCameraYaw + (pl.cameraYaw - pl.prevCameraYaw) * partial;
      const f3 = pl.prevCameraPitch + (pl.cameraPitch - pl.prevCameraPitch) * partial;
      T(sin(f1 * Math.PI) * f2 * 0.5, -Math.abs(cos(f1 * Math.PI) * f2), 0);
      R(sin(f1 * Math.PI) * f2 * 3, 0, 0, 1);
      R(Math.abs(cos(f1 * Math.PI - 0.2) * f2) * 5, 1, 0, 0);
      R(f3, 1, 0, 0);
    }
    const equip = 1 - (it.prevEquipProgress + (it.equipProgress - it.prevEquipProgress) * partial);
    // EntityLivingBase.getSwingProgress: when the swing wraps to 0 the arm finishes forward instead of snapping back
    let sd = it.swingProgress - it.prevSwingProgress;
    if (sd < 0) sd += 1;
    const swing = it.prevSwingProgress + sd * partial;
    const armPitch = this.prevRenderArmPitch + (this.renderArmPitch - this.prevRenderArmPitch) * partial;
    const armYaw = this.prevRenderArmYaw + (this.renderArmYaw - this.prevRenderArmYaw) * partial;
    const pitch = pl.prevPitch + (pl.pitch - pl.prevPitch) * partial;
    const yaw = pl.prevYaw + (pl.yaw - pl.prevYaw) * partial;
    R((pitch - armPitch) * 0.1, 1, 0, 0);
    R((yaw - armYaw) * 0.1, 0, 1, 0);
    const transformFP = (eq, sw) => {
      T(0.56, -0.52, -0.71999997);
      T(0, eq * -0.6, 0);
      R(45, 0, 1, 0);
      const f = sin(sw * sw * Math.PI);
      const f1 = sin(sqrt(sw) * Math.PI);
      R(f * -20, 0, 1, 0);
      R(f1 * -20, 0, 0, 1);
      R(f1 * -80, 1, 0, 0);
      S(0.4, 0.4, 0.4);
    };
    if (held) {
      if (held.id === 358) {
        // Maps: simplified as a held item
        transformFP(equip, swing);
      } else if (pl.usingItem) {
        const act = g.items.useAction(held);
        const maxDur = g.items.useDuration(held);
        const inUse = maxDur - it.useTicks;
        if (act === 'eat' || act === 'drink') {
          const f = inUse - partial + 1;
          const f1 = f / maxDur;
          let f2 = Math.abs(cos(f / 4 * Math.PI) * 0.1);
          if (f1 >= 0.8) f2 = 0;
          T(0, f2, 0);
          const f3 = 1 - Math.pow(f1, 27);
          T(f3 * 0.6, f3 * -0.5, 0);
          R(f3 * 90, 0, 1, 0);
          R(f3 * 10, 1, 0, 0);
          R(f3 * 30, 0, 0, 1);
          transformFP(equip, 0);
        } else if (act === 'block') {
          transformFP(equip, 0);
          T(-0.5, 0.2, 0);
          R(30, 0, 1, 0);
          R(-80, 1, 0, 0);
          R(60, 0, 1, 0);
        } else if (act === 'bow') {
          transformFP(equip, 0);
          R(-18, 0, 0, 1);
          R(-12, 0, 1, 0);
          R(-8, 1, 0, 0);
          T(-0.9, 0.2, 0);
          const f = it.useTicks + partial;
          let f1 = f / 20;
          f1 = (f1 * f1 + f1 * 2) / 3;
          if (f1 > 1) f1 = 1;
          if (f1 > 0.1) {
            const f2 = sin((f - 0.1) * 1.3);
            const f3 = f1 - 0.1;
            T(0, f2 * f3 * 0.01, 0);
          }
          T(0, 0, f1 * 0.1);
          S(1, 1, 1 + f1 * 0.2);
        } else transformFP(equip, 0);
      } else {
        const f = -0.4 * sin(sqrt(swing) * Math.PI);
        const f1 = 0.2 * sin(sqrt(swing) * Math.PI * 2);
        const f2 = -0.2 * sin(swing * Math.PI);
        T(f, f1, f2);
        transformFP(equip, swing);
      }
    } else {
      // renderPlayerArm
      const f = -0.3 * sin(sqrt(swing) * Math.PI);
      const f1 = 0.4 * sin(sqrt(swing) * Math.PI * 2);
      const f2 = -0.4 * sin(swing * Math.PI);
      T(f, f1, f2);
      T(0.64000005, -0.6, -0.71999997);
      T(0, equip * -0.6, 0);
      R(45, 0, 1, 0);
      const f3 = sin(swing * swing * Math.PI);
      const f4 = sin(sqrt(swing) * Math.PI);
      R(f4 * 70, 0, 1, 0);
      R(f3 * -20, 0, 0, 1);
      T(-1, 3.6, 3.5);
      R(120, 0, 0, 1);
      R(200, 1, 0, 0);
      R(-135, 0, 1, 0);
      S(1, 1, 1);
      T(5.6, 0, 0);
    }
    // Compose into a matrix
    const m = mat4.create();
    for (const op of ops) {
      if (op[0] === 't') mat4.translate(m, m, op[1], op[2], op[3]);
      else if (op[0] === 's') mat4.scale(m, m, op[1], op[2], op[3]);
      else mat4.rotate(m, m, op[1] * D2R, op[2], op[3], op[4]);
    }
    this.content.matrix = m;
    // Arm scale: the arm model is in pixel units scaled 1/16 inside the holder, matching vanilla
    if (!held && this._armObj) this._armObj.scale.set(1 / 16, 1 / 16, 1 / 16);
    void fov;
    const r = g.renderer;
    return {
      draw: (device) => {
        device.setGlobals({ view: this.view, proj: this.proj, fogMode: 2, lightmap: r.lightmap });
        drawTree(device, this.root, { resolve: g.entityRenderer.resolve });
        if (this.itemObj) g.entityRenderer.drawGlint(device, this.itemObj, this.atlasMat);
      },
    };
  }
}
