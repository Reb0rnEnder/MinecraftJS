import {tickPortal,portalWarp} from './portal.js';
import {EaglerTextures} from '../net/eagler-textures.js';
import {zoomFov,smoothCameraActive} from './zoom.js';
import {captureText} from '../debug/text-capture.js';
import {pushLocalPlayer} from './entity-pushing.js';
import {ShaderPackFinal} from '../render/shader-pack.js';
import { startSleeping, stopSleeping, sleepingCamera } from './bed-sleep.js';
import { jarSelectionBox } from '../world/blocks.js';
import { sectionLod, lodDistance } from '../render/lod.js';
// MinecraftJS game core: networking, world sync, ticking, input, camera.
import { buildCrashReport, showCrashScreen } from '../crash.js';
import { mat4 } from '../gfx/math.js';
import { DebugLines } from '../render/debug-lines.js';
import { Profiler } from './profiler.js';
import { celestialAngle } from '../render/sky.js';
import { tr } from '../gui/i18n.js';
import { Connection } from '../net/connection.js';
import { isEaglerAddress } from '../net/address.js';
import { C } from '../net/packets.js';
import { Reader, Writer } from '../net/buffer.js';
import { simplify } from '../net/nbt.js';
import { World } from '../world/world.js';
import { blocks } from '../world/blocks.js';
import { resolveState } from '../world/blockstates.js';
import { biomeInfo } from '../world/biomes.js';
import { LocalPlayer } from './physics.js';
import { BoatController, HorseController } from './vehicle.js';
import { Advancements } from './advancements.js';
import { RecipeBook } from './recipebook.js';
import { Input } from './input.js';
import { Renderer } from '../render/renderer.js';
import { Gui } from '../gui/gui.js';
import { chatToLegacy, setTranslator } from '../gui/chat.js';
import { Hud } from '../gui/hud.js';
import { Narrator } from '../gui/narrator.js';
import { Tutorial } from './tutorial.js';
import { ScreenManager } from '../gui/screens/manager.js';
import { DownloadingTerrainScreen, DisconnectedScreen, ConnectingScreen } from '../gui/screens/menus.js';
import { ChatScreen } from '../gui/screens/chat.js';
import { PauseScreen } from '../gui/screens/pause.js';
import { DeathScreen } from '../gui/screens/death.js';
import { SignEditScreen } from '../gui/screens/sign.js';
import { openContainerScreen, InventoryScreen, CreativeScreen, handleHotbarSnapshots } from '../gui/screens/containers.js';
import { BookScreen, SleepScreen } from '../gui/screens/book.js';
import { CommandBlockScreen } from '../gui/screens/commandblock.js';
import { Inventory, ContainerWindow } from './container.js';
import { Items } from './items.js';
import { EntityManager, shulkerBox } from './entities.js';
import { EntityRenderer } from '../render/entity-renderer.js';
import { ItemRenderer } from '../render/item-renderer.js';
import { HandRenderer } from '../render/hand-renderer.js';
import { Pistons } from './pistons.js';
import { ServerPacks } from './serverpacks.js';
import { PostEffects, entityShaderName } from '../render/post.js';
import { TileEntityRenderer } from '../render/tile-renderer.js';
import { Particles } from '../render/particles.js';
import { Weather } from '../render/weather.js';
import { SoundManager } from '../audio/sound.js';
import { Scoreboard } from './scoreboard.js';
import { Interaction } from './interaction.js';
import { Accounts } from './accounts.js';
import { platform } from '../platform/platform.js';
import { buildSlice } from '../world/slice.js';
import { setModelDevice } from '../render/boxmodel.js';
import { encodePng } from '../util/png.js';

// IAttributeInstance.getAttributeValue: base, + op 0 amounts, x (1 + sum of op 1), x (1 + each op 2)
function attributeValue(prop) {
  let v = prop.value;
  for (const m of prop.modifiers) if (m.operation === 0) v += m.amount;
  let base = v;
  for (const m of prop.modifiers) if (m.operation === 1) v += base * m.amount;
  for (const m of prop.modifiers) if (m.operation === 2) v *= 1 + m.amount;
  return v;
}

// SPacketUpdateTileEntity action per block entity id (signs are handled by applyBlockEntity)
const BLOCK_ENTITY_ACTIONS = {
  mob_spawner: 1, command_block: 2, beacon: 3, skull: 4, flower_pot: 5, banner: 6, structure_block: 7, end_gateway: 8,
  shulker_box: 10, bed: 11,
};

const TICK_MS = 50;
// SoundCategory names (SoundCategory.getByName)
const SOUND_CATEGORIES = ['master', 'music', 'record', 'weather', 'block', 'hostile', 'neutral', 'player', 'ambient', 'voice'];

export class Game {
  constructor(assets, settings, device) {
    this.assets = assets;
    this.settings = settings;
    this.device = device;
    setModelDevice(device);
    setTranslator((k, a) => assets.translate(k, a));

    this.input = new Input(settings);
    this.gui = new Gui(device, assets);
    this.gui.guiScaleSetting = settings.guiScale;
    this.applyLanguage();
    this.gui.resize();
    this.items = new Items(assets);
    this.accounts = new Accounts(settings);
    this.renderer = new Renderer(device, assets);
    this.renderer.renderDistance = settings.renderDistance;
    this.renderer.gamma = settings.gamma;
    this.sound = new SoundManager(this);
    this.screens = new ScreenManager(this);
    this.hud = new Hud(this);
    this.narrator = new Narrator(this);
    this.tutorial = new Tutorial(this);
    this.itemRenderer = new ItemRenderer(this);
    this.entityRenderer = new EntityRenderer(this);
    this.eaglerTextures = new EaglerTextures(this);
    this.handRenderer = new HandRenderer(this);
    this.tileRenderer = new TileEntityRenderer(this);
    this.renderer.breakContext=()=>({world:this.world,tileRenderer:this.tileRenderer,tileProps:this.tileProps,alternatives:this.settings.blockAlternatives!==false,fancy:!!this.settings.fancyGraphics});
    this.structureBlocks = new Map(); // "x,y,z" -> structure block tile entity data
    this.pistons = new Pistons(this);
    this.serverPacks = new ServerPacks(this);
    this.postEffects = new PostEffects(this);
    this.shaderPack = new ShaderPackFinal(this);
    this.particles = new Particles(this);
    this.debugLines = new DebugLines(this);
    this.weather = new Weather(this);
    this.renderer.drawEntities = (d, camRot) => this.entityRenderer.draw(d, camRot);
    this.renderer.columnLoaded = (cx, cz) => !!this.world.getChunk(cx, cz);
    this.renderer.opaqueAt = (x, y, z) => { const b = blocks[this.world.getState(Math.floor(x), Math.floor(y), Math.floor(z)) >> 4]; return !!(b && b.opaque); };
    platform().on('resize', () => { this.gui.resize(); this.renderer.resize(); });

    this.world = new World();
    this.world.selectionProvider = (state, x, y, z) => this.selectionBox(state, x, y, z);
    this.player = new LocalPlayer();
    this.player.onStep = (x, y, z, state) => this.sound.playStep(x, y, z, state, [this.player.x, this.player.y, this.player.z]);
    this.player.onFall = (dmg, state) => this.sound.playFall(dmg, this.player.x, this.player.y, this.player.z, state);
    this.player.onWaterEnter = () => this._waterSplash();
    this.player.onSwim = (vol) => this.sound.playAtPlayer('entity.player.swim', vol, 1 + (Math.random() - Math.random()) * 0.4);
    this.entities = new EntityManager(this);
    this.scoreboard = new Scoreboard(this);
    this.advancements = new Advancements(this);
    this.recipeBook = new RecipeBook(this);
    this.inventory = new Inventory(this);
    this.interaction = new Interaction(this);
    this.conn = null;
    this.reset();

    this._setupWorker();
    this._setupWorldListeners();
    this.applyGraphicsSettings(true);
    this.input.on('key', (e) => this.onKey(e));
    this.input.on('char', (c) => this.screens.onChar(c));
    this.input.on('mouse', (e) => this.onMouse(e));
    this.input.on('wheel', (d) => this.screens.onWheel(d));
    this.input.on('lock', (l) => this.onLockChange(l));
    this.input.on('move', () => this.screens.onMove());

    this.profiler = new Profiler();
    this.frameTimes = new Float32Array(240); // lagometer (FrameTimer)
    this.frameTimeIndex = 0;
    this.showHitboxes = false;
    this.showProfiler = false;
    this.showLagometer = false;
    platform().on('blur', () => {
      // GameSettings.pauseOnLostFocus (F3+P)
      if (this.settings.pauseOnLostFocus !== false && this.inWorld && !this.screens.current) this.screens.open(new PauseScreen(this));
    });
    this.lastFrame = platform().now();
    this.tickAccumulator = 0;
    this.partial = 0;
    this.fps = 0;
    this.frames = 0;
    this.fpsTimer = platform().now();
    platform().requestFrame((t) => this.frame(t));
  }

  reset() {
    this.connected = false;
    this.inWorld = false;
    this.entityId = 0;
    this.gameMode = 0;
    this.dimension = 0;
    this.difficulty = 1;
    this.levelType = 'default';
    this.reducedDebug = false;
    this.health = 20;
    this.prevHealth = 20;
    this.food = 20;
    this.saturation = 5;
    this.xpBar = 0;
    this.xpLevel = 0;
    this.xpTotal = 0;
    this.heldSlot = 0;
    this.spawnPos = null;
    this.doneLoadingTerrain = false;
    this.lastReported = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, sneak: false, sprint: false };
    this.positionUpdateTicks = 0;
    this.thirdPerson = 0;
    this.hideGui = false;
    this.showDebug = false;
    this.effects = new Map();
    this.dead = false;
    this.ticks = 0;
    this.worldBorder = { x: 0, z: 0, radius: 29999984, warningTime: 15, warningBlocks: 5 };
    this.cameraEntity = null;
    this.ridingEntityId = -1;
    this.pendingTeleport = false;
    this.hurtTime = 0;
    this.lastDamageTime = 0;
    this.portalTime = 0;
    this.fovModifier = 1;
    this.prevFovModifier = 1;
    this.sleeping = false;
    this.horseJumpCounter = 0;
    this.horseJump = undefined;
    this.inventoryOpen = false;
    this.window = null;
    if (this.inventory) this.inventory.reset();
    if (this.player) {
      const p = new LocalPlayer();
      p.onStep = this.player.onStep;
      p.onWaterEnter = this.player.onWaterEnter;
      p.onFall = this.player.onFall;
      p.onSwim = this.player.onSwim;
      this.player = p;
    }
  }

  // TextureCompass.updateCompass / TextureClock.updateAnimation: needle and dial follow the world, with
  // vanilla's damped swing. Returns the atlas entries that changed.
  // ItemCompass "angle" / ItemClock "time" item model predicates (1.9+ picks compass_NN / clock_NN models by these);
  // both wobble towards their target like vanilla's held compass and clock
  _updateCompassClock() {
    const surface = this.dimension === 0;
    const cs = this._compass || (this._compass = { angle: 0, delta: 0, clock: 0, clockDelta: 0 });
    let d0 = 0;
    if (this.inWorld) {
      if (surface) {
        const sp = this.spawnPos || { x: 0, z: 0 };
        const d1 = sp.x - this.player.x, d2 = sp.z - this.player.z;
        const yaw = ((this.player.yaw % 360) + 360) % 360;
        d0 = -((yaw - 90) * Math.PI / 180 - Math.atan2(d2, d1));
      } else d0 = Math.random() * Math.PI * 2;
    }
    let d3 = d0 - cs.angle;
    while (d3 < -Math.PI) d3 += Math.PI * 2;
    while (d3 >= Math.PI) d3 -= Math.PI * 2;
    d3 = Math.max(-1, Math.min(1, d3));
    cs.delta += d3 * 0.1;
    cs.delta *= 0.8;
    cs.angle += cs.delta;
    const mod1 = (v) => ((v % 1) + 1) % 1;
    this.compassAngle = mod1(cs.angle / (Math.PI * 2) - 0.5); // compass model (frame 16) points at the target
    let t0 = 0;
    if (this.inWorld) t0 = surface ? celestialAngle(this.world.timeOfDay, 1) : Math.random();
    let t1 = t0 - cs.clock;
    while (t1 < -0.5) t1 += 1;
    while (t1 >= 0.5) t1 -= 1;
    t1 = Math.max(-1, Math.min(1, t1));
    cs.clockDelta += t1 * 0.1;
    cs.clockDelta *= 0.8;
    cs.clock += cs.clockDelta;
    this.clockTime = mod1(cs.clock);
    return [];
  }

  // Minecraft.debugFeedbackTranslated: a bold yellow "[Debug]:" then the message, as a local chat line
  debugFeedback(key, ...args) {
    const t = this.assets.translate;
    this.hud.addChat('§e§l' + t.call(this.assets, 'debug.prefix') + '§r ' + t.call(this.assets, key, args), null, true);
  }

  // F3 + key combinations (Minecraft.processKeyF3, 1.12). Returns true when the key was used.
  _debugCombo(e) {
    const s = this.settings;
    switch (e.code) {
      case 'KeyA': // RenderGlobal.loadRenderers
        for (const c of this.world.chunks.values()) for (let y = 0; y < 16; y++) if (c.sections[y]) this.dirty.add(c.x + ',' + y + ',' + c.z);
        this.debugFeedback('debug.reload_chunks.message');
        return true;
      case 'KeyB':
        this.showHitboxes = !this.showHitboxes; // RenderManager.setDebugBoundingBox
        this.debugFeedback(this.showHitboxes ? 'debug.show_hitboxes.on' : 'debug.show_hitboxes.off');
        return true;
      case 'KeyD': this.hud.clearChat(); return true;
      case 'KeyF': // render distance +1 (Shift: -1)
        s.renderDistance = Math.max(2, Math.min(32, s.renderDistance + (e.shift ? -1 : 1)));
        this.renderer.renderDistance = s.renderDistance;
        s.save();
        if (this.inWorld) this.sendSettings();
        this.debugFeedback('debug.cycle_renderdistance.message', s.renderDistance);
        return true;
      case 'KeyG': // DebugRenderer.toggleChunkBorders
        this.showChunkBorders = !this.showChunkBorders;
        this.debugFeedback(this.showChunkBorders ? 'debug.chunk_boundaries.on' : 'debug.chunk_boundaries.off');
        return true;
      case 'KeyH':
        s.advancedItemTooltips = !s.advancedItemTooltips; s.save();
        this.debugFeedback(s.advancedItemTooltips ? 'debug.advanced_tooltips.on' : 'debug.advanced_tooltips.off');
        return true;
      case 'KeyN': // creative <-> spectator, needs permission level 2
        if ((this.permissionLevel | 0) < 2) this.debugFeedback('debug.creative_spectator.error');
        else if (this.gameMode === 1) this.send(C.chat('/gamemode spectator'));
        else if (this.gameMode === 3) this.send(C.chat('/gamemode creative'));
        return true;
      case 'KeyP':
        s.pauseOnLostFocus = s.pauseOnLostFocus === false; s.save();
        this.debugFeedback(s.pauseOnLostFocus ? 'debug.pause_focus.on' : 'debug.pause_focus.off');
        return true;
      case 'KeyQ':
        this.debugFeedback('debug.help.message');
        for (const k of ['reload_chunks', 'show_hitboxes', 'clear_chat', 'cycle_renderdistance', 'chunk_boundaries', 'advanced_tooltips',
          'creative_spectator', 'pause_focus', 'help', 'reload_resourcepacks']) this.hud.addChat(this.assets.translate('debug.' + k + '.help'), null, true);
        return true;
      case 'KeyT':
        this.debugFeedback('debug.reload_resourcepacks.message');
        this.reloadResources().catch((err) => console.error(err)); // refreshResources
        return true;
      default: return false;
    }
  }

  // "Super Secret Settings...": vanilla cycles post-processing shaders (and back to none). The renderer has no
  // post-processing chain, so these are the full-screen colour effects that can be done with blending.
  cycleSuperSecret() {
    this.superSecret = ((this.superSecret || 0) + 1) % 4;
  }

  _drawSuperSecret(gui) {
    const m = this.superSecret || 0;
    if (!m || this.superSecretOff) return;
    const W = gui.width, H = gui.height;
    if (m === 1) { gui.setBlend('invert'); gui.rect(0, 0, W, H, 0xffffffff); }          // invert
    else if (m === 2) { gui.setBlend('multiply'); gui.rect(0, 0, W, H, 0xff70ff70); }   // green
    else if (m === 3) { gui.rect(0, 0, W, H, 0x80808080); }                             // desaturate-ish wash
    gui.setBlend('alpha');
  }

  // Font flags for the current language (LanguageManager.isCurrentLocaleUnicode / isCurrentLanguageBidirectional)
  applyLanguage() {
    const f = this.gui.font;
    f.unicode = !!(this.assets.langUnicode || this.settings.forceUnicodeFont);
    f.bidi = !!this.assets.langBidi;
  }

  // Switch language (GuiLanguage): reload the strings, update the font and tell the server
  async setLanguage(code) {
    const c = await this.assets.loadLanguage(code);
    this.settings.language = c;
    this.settings.save();
    this.applyLanguage();
    if (this.inWorld) this.sendSettings();
    return c;
  }

  // Rebuild everything that depends on resource packs (textures, models, sounds, fonts)
  async reloadResources(progress) {
    await this.assets.loadResources(progress);
    this.eaglerTextures?.clear();
    this.applyLanguage();
    this.itemRenderer.reset();
    this.entityRenderer.reset();
    this.handRenderer.reset();
    this.tileRenderer.clear();
    this.pistons.clear();
    this.postEffects.clear();
    this.sound.reload();
    this.worker = this.assets.worker;
    this._setupWorker();
    this._meshOptsKey = null;
    this.applyGraphicsSettings(true);
    // Rebuild every loaded section with the new models / atlas
    this.renderer.clearSections();
    if(this._meshUploads)this._meshUploads.length=0;
    for (const c of this.world.chunks.values()) {
      for (let y = 0; y < 16; y++) if (c.sections[y]) this.dirty.add(c.x + ',' + y + ',' + c.z);
      this.tileRenderer.scanChunk(c);
    }
  }

  // ---------------------------------------------------------------- Worker / meshing

  _setupWorker() {
    this.worker = this.assets.worker;
    this.dirty = new Set();
    this.inFlight = new Map();
    this.buildTokens = new Map(); this.buildSerial = 0;
    this.maxInFlight = 3 * (this.worker.size || 1) + 2;
    this._meshUploads=[];
    this.meshedChunks = new Set();
    this._chunkWaitStart = new Map();
    this.meshGen = (this.meshGen || 0) + 1;
    if (!this.tileProps) this.tileProps = new Map();
    this.worker.onmessage = (e) => {
      const m = e.data;
      if (m.type !== 'built') return;
      const key = m.x + ',' + m.y + ',' + m.z;
      if (m.gen !== this.meshGen || m.token !== this.buildTokens.get(key)) return;
      if (!this.world.getChunk(m.x,m.z) || this.dirty.has(key)){this.inFlight.delete(key);return;}
      this._meshUploads.push(m);

    };
    this.meshStats = { builds: 0, ms: 0 };
  }

  // Apply completed worker meshes within a per-frame upload budget. Keep each
  // lease until it is consumed so workers cannot flood the main thread queue.
  _uploadMeshes(){
    const start=platform().now();let applied=0;
    while(this._meshUploads?.length){
      if(applied&&platform().now()-start>=2)break;
      const m=this._meshUploads.shift(),key=m.x+','+m.y+','+m.z;
      if(m.gen!==this.meshGen||m.token!==this.buildTokens.get(key))continue;
      this.inFlight.delete(key);
      if(!this.world.getChunk(m.x,m.z)||this.dirty.has(key))continue;
      this.meshStats.builds++;this.meshStats.ms+=m.ms||0;
      this._chunkUpdatesCount=(this._chunkUpdatesCount||0)+1;
      this.renderer.setSectionMesh(m.x,m.y,m.z,m);this._lodKey=null;applied++;
    }
  }

  // Forget all meshing state (world change)
  _resetMeshing() {
    if(this._meshUploads)this._meshUploads.length=0;
    this.renderer.clearSections();
    this.dirty.clear(); this.inFlight.clear(); this.meshedChunks.clear();
    this.buildTokens.clear();
    this.tileProps.clear();
    this.meshGen++;
  }

  _setupWorldListeners() {
    const w = this.world;
    w.on('chunkLoaded', (c, bitMap, groundUp) => {
      void bitMap; void groundUp;
      for (let y = 0; y < 16; y++) if (c.sections[y]) this.dirty.add(c.x + ',' + y + ',' + c.z);
      this.tileRenderer.scanChunk(c);
      // Neighbours that were already meshed need their edges rebuilt
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nk = (c.x + dx) + ',' + (c.z + dz);
        if (this.meshedChunks.has(nk)) {
          const n = w.getChunk(c.x + dx, c.z + dz);
          if (n) for (let y = 0; y < 16; y++) if (n.sections[y]) this.dirty.add(n.x + ',' + y + ',' + n.z);
        }
      }
    });
    w.on('chunkUnloaded', (c) => {
      this.renderer.removeChunk(c.x, c.z);
      this.meshedChunks.delete(c.x + ',' + c.z);
      for (let y = 0; y < 16; y++) { const key=c.x+','+y+','+c.z;this.dirty.delete(key);this.inFlight.delete(key);this.buildTokens.delete(key); }
      this.tileRenderer.removeChunk(c.x, c.z);
    });
    w.on('sectionDirty', (cx, sy, cz) => {
      if (!w.getChunk(cx, cz)) return;
      this.dirty.add(cx + ',' + sy + ',' + cz);
    });
    // World.getCollisionBoxes' entity part (1.12): boats and live shulkers are solid to every mover
    // (getCollisionBoundingBox); a moving boat also collides with pushable entities (EntityBoat.getCollisionBox).
    // Passengers of the same vehicle never collide (isRidingSameEntity).
    w.movingCollider = (bb, out) => this.pistons.collision(bb, out);
    w.shulkerCollider = (x, y, z, state, out) => this.tileRenderer.shulkerCollision(x, y, z, state, out);
    w.entityCollider = (bb, mover) => {
      const out = [];
      const self = mover.entity || null; // the vehicle being steered, or null for the player
      const g = [bb[0] - 0.25, bb[1] - 0.25, bb[2] - 0.25, bb[3] + 0.25, bb[4] + 0.25, bb[5] + 0.25];
      for (const e of this.entities.map.values()) {
        if (e === self || e.dead) continue;
        if (self ? e.riding === self.id : e.id === this.ridingEntityId) continue;
        const hw = (e.width || 0) / 2;
        const eb = e.kind === 'mob' && e.type === 69 ? shulkerBox(e) : [e.x - hw, e.y, e.z - hw, e.x + hw, e.y + (e.height || 0), e.z + hw];
        if (!(eb[3] > g[0] && eb[0] < g[3] && eb[4] > g[1] && eb[1] < g[4] && eb[5] > g[2] && eb[2] < g[5])) continue;
        const solid = e.kind === 'boat' || (e.kind === 'mob' && e.type === 69);
        const pushable = self && self.kind === 'boat' && (e.kind === 'player' || e.kind === 'mob' || e.kind === 'boat' || e.kind === 'minecart') && e.riding < 0;
        if (!solid && !pushable) continue;
        if (eb[3] > bb[0] && eb[0] < bb[3] && eb[4] > bb[1] && eb[1] < bb[4] && eb[5] > bb[2] && eb[2] < bb[5]) out.push(eb);
      }
      return out;
    };
    w.on('blockChanged', (x, y, z, oldState, newState) => {
      this.pistons.onBlockChanged(x, y, z);
      this.tileRenderer.onBlockChanged(x, y, z, oldState, newState);
    });
  }

  // Graphics options that affect meshing (fancy leaves, smooth lighting)
  applyGraphicsSettings(initial = false) {
    const s = this.settings;
    // Minimum and Maximum smooth lighting render the same in 1.8.9 (only 'ambient occlusion on' is checked)
    const opts = { fancy: !!s.fancyGraphics, smooth: (s.smoothLighting | 0) > 0 ? 2 : 0, alt: s.blockAlternatives !== false };
    this.assets.setMipmapLevels(s.mipmapLevels === undefined ? 4 : s.mipmapLevels);
    platform().vsync = s.enableVsync !== false;
    const key = JSON.stringify(opts);
    if (key === this._meshOptsKey) return;
    this._meshOptsKey = key;
    this.worker.postMessage({ type: 'options', options: opts });
    if (!initial) {
      for (const c of this.world.chunks.values()) for (let y = 0; y < 16; y++) if (c.sections[y]) this.dirty.add(c.x + ',' + y + ',' + c.z);
    }
  }

  _lodCamera() {
    return this.renderer.camPos || [this.player.x, this.player.y, this.player.z];
  }

  _lodFor(cx, cz, sy = 0) {
    const previous = !!this.renderer.sections.get(cx + ',' + sy + ',' + cz)?.lod;
    return sectionLod(this.settings, this._lodCamera(), cx, sy, cz, previous);
  }

  // Recheck at block boundaries and after sections arrive, rather than chunk borders.
  _updateLod() {
    const camera = this._lodCamera();
    const key = Math.floor(camera[0]) + ',' + Math.floor(camera[1]) + ',' + Math.floor(camera[2]) + ',' + lodDistance(this.settings) + ',' + this.renderer.sections.size;
    if (key === this._lodKey) return;
    this._lodKey = key;
    for (const section of this.renderer.sections.values()) {
      if (section.lod !== this._lodFor(section.cx, section.cz, section.sy)) this.dirty.add(section.cx + ',' + section.sy + ',' + section.cz);
    }
  }

  _scheduleMeshes() {
    if(this._meshUploads?.length)this._uploadMeshes();
    const started=platform().now();let posted=0;
    this._updateLod();
    if (!this.dirty.size || this.inFlight.size >= this.maxInFlight) return;
    const camera = this._lodCamera();
    const px = camera[0] / 16, py = camera[1] / 16, pz = camera[2] / 16;
    const rd = this.settings.renderDistance + 1;
    const candidates = [];
    for (const key of this.dirty) {
      if (this.inFlight.has(key)) continue;
      const parts = key.split(',');
      const cx = +parts[0], sy = +parts[1], cz = +parts[2];
      if (Math.abs(cx - Math.floor(px)) > rd || Math.abs(cz - Math.floor(pz)) > rd) continue;
      // Wait for horizontal neighbours so edge faces are culled correctly
      let ready = true;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        if (!this.world.getChunk(cx + dx, cz + dz)) {
          const age = this._chunkWaitStart.get(cx + ',' + cz) || 0;
          if (!age) { this._chunkWaitStart.set(cx + ',' + cz, platform().now()); ready = false; }
          else if (platform().now() - age < 1500) ready = false;
          break;
        }
      }
      if (!ready) continue;
      const dx = cx + 0.5 - px, dy = sy + 0.5 - py, dz = cz + 0.5 - pz;
      candidates.push([dx * dx + dy * dy * 0.5 + dz * dz, key, cx, sy, cz]);
    }
    candidates.sort((a, b) => a[0] - b[0]);
    for (const [, key, cx, sy, cz] of candidates) {
      if (this.inFlight.size >= this.maxInFlight || posted&&platform().now()-started>=2) break;
      this.dirty.delete(key);
      this.inFlight.set(key, platform().now());
      this.meshedChunks.add(cx + ',' + cz);
      const sec = this.world.getChunk(cx, cz).sections[sy];
      if (!sec || sec.nonAir === 0) { this.inFlight.delete(key); this.renderer.removeSection(key); continue; }
      const slice = buildSlice(this.world, cx, sy, cz, this.tileProps);
      const token=++this.buildSerial;this.buildTokens.set(key,token);
      this.worker.postMessage({ type: 'build', gen: this.meshGen, token, slice, lod: this._lodFor(cx, cz, sy) }, [slice.states.buffer, slice.light.buffer, slice.biomes.buffer]);
      posted++;
    }
    // Recover from lost builds
    for (const [k, t] of this.inFlight) if (platform().now() - t > 10000) this.inFlight.delete(k);
  }

  // ---------------------------------------------------------------- Connection

  // Connect as the active account (or as an explicit offline username)
  async connect(host, port, username = null) {
    this.disconnect(true);
    const attempt=this.connectAttempt=(this.connectAttempt||0)+1;
    this.reset();
    this.serverAddress = { host, port };
    this.screens.open(new ConnectingScreen(this, host, port));
    let auth = null;
    if (!username) {
      let acc = this.accounts.active();
      // Eaglercraft servers log in by name only (no Mojang session check)
      if (acc.type === 'microsoft' && !isEaglerAddress(host)) {
        try { acc = await this.accounts.ensureFresh(acc); } catch (e) {
          if(attempt!==this.connectAttempt)return;
          this.screens.open(new DisconnectedScreen(this, tr('disconnect.loginFailed'), e.message));
          return;
        }
        auth = { accessToken: acc.accessToken, uuid: acc.uuid };
      }
      username = acc.name;
    }
    if(attempt!==this.connectAttempt)return;
    this.username = username;
    const conn = this.conn = new Connection();
    conn.on('control', (m) => this.onControl(m, conn));
    conn.on('packet', (p) => { if (this.conn === conn) this.handlePacket(p); });
    conn.on('close', () => { if (this.conn === conn) this.onConnectionClosed(); });
    try {
      await conn.connect(host, port, username, auth);
    } catch (e) {
      if(this.conn!==conn)return;
      this.screens.open(new DisconnectedScreen(this, tr('connect.failed'), e.message));
    }
  }

  disconnect(silent = false, reason) {
    this.connectAttempt=(this.connectAttempt||0)+1;
    if (this.conn) {
      const c = this.conn;
      this.conn = null;
      c.close();
    }
    this.leaveWorld();
    if (!silent) this.screens.openMainMenu(reason);
  }

  // NetHandlerPlayClient.handleChangeGameState(5): a demo server's welcome screen (0) and control hints (101-103)
  onDemoMessage(value) {
    const s = this.settings, key = (k) => s.keyName(s.keys[k]);
    const say = (k, ...args) => this.hud.addChat(this.assets.translate(k, args), null, true);
    if (value === 0) import('../gui/screens/demo.js').then((m) => this.screens.open(new m.DemoScreen(this)));
    else if (value === 101) say('demo.help.movement', key('forward'), key('left'), key('back'), key('right'));
    else if (value === 102) say('demo.help.jump', key('jump'));
    else if (value === 103) say('demo.help.inventory', key('inventory'));
  }

  // EntityPlayer.canUseCommandBlock: creative and op level 2
  canUseCommandBlock() { return this.gameMode === 1 && (this.permissionLevel | 0) >= 2; }

  leaveWorld() {
    this.structureBlocks.clear();
    if (this.tutorial) this.tutorial.stop();
    this.eaglerTextures?.clear();
    this.inWorld = false;
    this.connected = false;
    this.world.clear();
    this._resetMeshing();
    this.entities.clear();
    this.tileRenderer.clear();
    this.pistons.clear();
    this.particles.clear();
    this.sound.stopAll();
    this.input.unlock();
    // Per-server state: tab list, teams, objectives/sidebar, header/footer, titles, action bar
    this.scoreboard.reset();
    if (this.advancements) this.advancements.clear();
    this.hud.resetServerState();
    this.statValues = null; this.stats = null;
    if (this.serverPacks) this.serverPacks.clear();
  }

  onControl(m, conn) {
    if (this.conn !== conn) return;
    switch (m.type) {
      case 'status':
        if (this.screens.current instanceof ConnectingScreen) this.screens.current.status = m.key ? tr(m.key) : m.message;
        break;
      case 'login_success':
        this.connected = true;
        this.playerUuid = m.uuid;
        this.username = m.username;
        this.screens.open(new DownloadingTerrainScreen(this));
        break;
      case 'kicked':
        this.kickReason = chatToLegacy(m.reason);
        break;
      case 'error':
        this.lastError = m.message;
        break;
      default: break;
    }
  }

  onConnectionClosed() {
    const reason = this.kickReason || (this.lastError ? this.lastError : tr('disconnect.closed'));
    const title = this.inWorld || this.connected ? tr('disconnect.lost') : tr('connect.failed');
    this.conn = null;
    this.leaveWorld();
    this.kickReason = null;
    this.lastError = null;
    this.screens.open(new DisconnectedScreen(this, title, reason));
  }

  send(bytes) { if (this.conn) this.conn.send(bytes); }

  // ---------------------------------------------------------------- Packet handling

  handlePacket(p) {
    const h = this['on_' + p.name];
    if (h) {
      try { h.call(this, p); } catch (e) { console.error('Error handling', p.name, e); }
    }
  }

  on_keep_alive(p) { this.send(C.keepAlive(p.keepAliveId)); }

  on_login(p) {
    this.eaglerTextures?.clear();
    // handleJoinGame always starts a new WorldClient (proxies may send another Join Game on server switch)
    if (this.inWorld) {
      this.world.clear();
      this._resetMeshing();
      this.entities.clear();
      this.tileRenderer.clear();
    this.pistons.clear();
    }
    this.entityId = p.entityId;
    this.selfMetadata = {};
    this.maxHealth = 20;
    if (this.gameMode !== (p.gameMode & 7)) this.previousGameMode = this.gameMode;
    this.gameMode = p.gameMode & 7;
    this.hardcore = !!(p.gameMode & 8);
    this.dimension = p.dimension;
    this.difficulty = p.difficulty;
    this.maxPlayers = p.maxPlayers;
    this.levelType = p.levelType;
    this.reducedDebug = p.reducedDebugInfo;
    this.world.setDimension(p.dimension);
    this.applyGameMode();
    this.inWorld = true;
    this.sendSettings();
    this.send(C.customPayload('MC|Brand', new Writer().string('vanilla').build()));
  }

  sendSettings() {
    const s = this.settings;
    this.send(C.settings(this.assets.language || 'en_us', s.renderDistance, s.chatVisibility, s.chatColors, s.skinParts, s.mainHand === 'left' ? 0 : 1));
  }

  applyGameMode() {
    const gm = this.gameMode;
    const p = this.player;
    p.creative = gm === 1;
    p.spectator = gm === 3;
    p.allowFlying = gm === 1 || gm === 3;
    if (gm === 3) p.flying = true;
    if (gm === 0 || gm === 2) p.flying = false;
  }

  captureText(options) { return captureText(this,options); }


  on_chat(p) {
    const text = chatToLegacy(p.message);
    if (p.position === 2) this.hud.setActionBar(text);
    else this.hud.addChat(text, p.message);
    this.narrator.onChat(p.position, p.message);
  }

  on_update_time(p) {
    this.world.worldAge = Number(p.age);
    let t = Number(p.time);
    this.world.doDaylightCycle = t >= 0;
    this.world.timeOfDay = Math.abs(t);
  }

  on_entity_equipment(p) { this.entities.setEquipment(p.entityId, p.slot, p.item); }

  on_spawn_position(p) { this.spawnPos = p.location; }

  on_update_health(p) {
    const wasAlive = this.health > 0;
    if (p.health < this.health) {
      this.hurtTime = 10;
      this.hud.healthFlash = this.ticks + 20;
    } else if (p.health > this.health) this.hud.healthFlash = this.ticks + 10;
    this.prevHealth = this.health;
    this.health = p.health;
    this.food = p.food;
    this.player.food = p.food;
    this.player.health = p.health;
    this.saturation = p.foodSaturation;
    if (this.health <= 0 && wasAlive) {
      this.dead = true;
      this.deathTick = this.ticks; // EntityLivingBase.deathTime counts from here
      this.screens.open(new DeathScreen(this, this.deathMessage));
    } else if (this.health > 0) this.dead = false;
  }

  on_respawn(p) {
    stopSleeping(this);
    if(this.screens.current instanceof SleepScreen)this.screens.close();
    if (p.dimension !== this.dimension) {
      this.world.clear();
      this._resetMeshing();
      this.entities.clear();
      this.tileRenderer.clear();
    this.pistons.clear();
      this.doneLoadingTerrain = false;
      this.screens.open(new DownloadingTerrainScreen(this));
    }
    this.dimension = p.dimension;
    this.world.setDimension(p.dimension);
    this.difficulty = p.difficulty;
    if (this.gameMode !== (p.gamemode)) this.previousGameMode = this.gameMode;
    this.gameMode = p.gamemode;
    this.levelType = p.levelType;
    this.applyGameMode();
    this.dead = false;
    this.health = 20;
    this.player.motionX = this.player.motionY = this.player.motionZ = 0;
    if (this.screens.current instanceof DeathScreen) this.screens.close();
  }

  on_position(p) {
    const pl = this.player;
    // NetHandlerPlayClient.handlePlayerPosLook (relative flags add to the current values, float angles)
    let x = p.x, y = p.y, z = p.z, yaw = Math.fround(p.yaw), pitch = Math.fround(p.pitch);
    if (p.flags & 1) x += pl.x; else pl.motionX = 0;
    if (p.flags & 2) y += pl.y; else pl.motionY = 0;
    if (p.flags & 4) z += pl.z; else pl.motionZ = 0;
    if (p.flags & 8) yaw = Math.fround(yaw + pl.yaw);
    if (p.flags & 16) pitch = Math.fround(pitch + pl.pitch);
    // Entity.setPositionAndRotation: x / z clamped to the world, pitch to +-90, then setRotation keeps angle % 360
    x = Math.max(-3e7, Math.min(3e7, x)); z = Math.max(-3e7, Math.min(3e7, z));
    pitch = Math.max(-90, Math.min(90, pitch));
    pl.setPosition(x, y, z);
    pl.prevX = x; pl.prevY = y; pl.prevZ = z;
    pl.prevYaw = yaw; pl.prevPitch = pitch;
    pl.yaw = Math.fround(yaw % 360); pl.pitch = Math.fround(pitch % 360);
    this.send(C.teleportConfirm(p.teleportId));
    this.send(C.positionLook(pl.x, pl.y, pl.z, pl.yaw, pl.pitch, false));
    // the last reported position stays: the next tick reports the new position again (onUpdateWalkingPlayer)
    if (!this.doneLoadingTerrain) {
      this.doneLoadingTerrain = true;
      pl.prevX = pl.x; pl.prevY = pl.y; pl.prevZ = pl.z;
      if (this.screens.current instanceof DownloadingTerrainScreen) this.screens.current.terrainReady = true;
    }
  }

  on_held_item_slot(p) {
    if (p.slot >= 0 && p.slot < 9) this.heldSlot = p.slot;
  }

  on_bed(p) {
    if (p.entityId === this.entityId) {
      startSleeping(this, p.location);
      this.screens.open(new SleepScreen(this));
      return;
    }
    this.entities.onBed(p);
  }

  on_animation(p) {
    if (p.entityId === this.entityId && p.animation === 2) {
      stopSleeping(this);
      if (this.screens.current instanceof SleepScreen) this.screens.close();
      return;
    }
    this.entities.onAnimation(p);
  }

  on_named_entity_spawn(p) { this.entities.spawnPlayer(p); }

  on_collect(p) { this.entities.onCollect(p); }

  on_spawn_entity(p) { this.entities.spawnObject(p); }

  on_spawn_entity_living(p) { this.entities.spawnMob(p); }

  on_spawn_entity_painting(p) { this.entities.spawnPainting(p); }

  on_spawn_entity_experience_orb(p) { this.entities.spawnXpOrb(p); }

  on_entity_velocity(p) {
    if (p.entityId === this.entityId) {
      this.player.motionX = p.velocity.x / 8000;
      this.player.motionY = p.velocity.y / 8000;
      this.player.motionZ = p.velocity.z / 8000;
    } else this.entities.setVelocity(p);
  }

  on_entity_destroy(p) { this.entities.destroy(p.entityIds); }

  on_rel_entity_move(p) { this.entities.relMove(p, true, false); }
  on_entity_look(p) { this.entities.look(p); }
  on_entity_move_look(p) { this.entities.relMove(p, true, true); }
  on_entity_teleport(p) { this.entities.teleport(p); }
  on_entity_head_rotation(p) { this.entities.headLook(p); }

  on_entity_status(p) {
    if (p.entityId === this.entityId) {
      if (p.entityStatus === 2) { this.hurtTime = 10; this.sound.playAtPlayer('entity.player.hurt', 1, 1); }
      else if (p.entityStatus === 9) this.player.usingItem = false; // item use finished
      else if (p.entityStatus === 22) this.reducedDebug = true;
      else if (p.entityStatus === 23) this.reducedDebug = false;
      else if (p.entityStatus >= 24 && p.entityStatus <= 28) this.permissionLevel = p.entityStatus - 24; // EntityPlayer op level
    }
    this.entities.onStatus(p);
  }

  // leash (riding is set_passengers since 1.9)
  on_attach_entity(p) { this.entities.setLeash(p.entityId, p.vehicleId); }

  // SPacketSetPassengers: the full passenger list of a vehicle
  on_set_passengers(p) {
    const before = this.entities.passengersOf(p.entityId);
    const v = this.entities.get(p.entityId);
    if (v) v.passengerList = p.passengers.slice(); // the server's order: the first passenger steers
    for (const id of before) if (!p.passengers.includes(id)) this._ride(id, -1);
    for (const id of p.passengers) if (!before.includes(id)) this._ride(id, p.entityId);
  }

  _ride(entityId, vehicleId) {
    if (entityId === this.entityId) {
      this.ridingEntityId = vehicleId;
      this.player.ridingEntity = vehicleId >= 0 ? this.entities.get(vehicleId) : null;
      this.player.ridingBoat = !!(this.player.ridingEntity && this.player.ridingEntity.kind === 'boat');
      if (vehicleId < 0) this._dropVehicle();
      if (vehicleId >= 0) this.hud.setActionBar(this.assets.translate('mount.onboard', [this.settings.keyName(this.settings.keys.sneak)]));
    }
    this.entities.attach(entityId, vehicleId);
  }

  on_entity_metadata(p) {
    if (p.entityId === this.entityId) {
      this.selfMetadata = Object.assign(this.selfMetadata || {}, p.metadata);
      if (p.metadata[0] !== undefined) this.player.elytraFlying = !!(p.metadata[0] & 0x80); // flag 7: elytra flying
    }
    this.entities.setMetadata(p.entityId, p.metadata);
  }

  on_entity_effect(p) {
    if (p.entityId === this.entityId) {
      this.effects.set(p.effectId, { amplifier: p.amplifier, duration: p.duration, hideParticles: p.hideParticles, start: this.ticks });
      this._applyEffects();
    }
    this.entities.addEffect(p);
  }

  on_remove_entity_effect(p) {
    if (p.entityId === this.entityId) { this.effects.delete(p.effectId); this._applyEffects(); }
  }

  _applyEffects() {
    const jb = this.effects.get(8);
    this.player.jumpBoost = jb ? jb.amplifier : -1;
    this.player.blind = this.effects.has(15);
    const lev = this.effects.get(25);
    this.player.levitation = lev ? lev.amplifier : -1;
  }

  on_experience(p) { this.xpBar = p.experienceBar; this.xpLevel = p.level; this.xpTotal = p.totalExperience; }

  on_update_attributes(p) {
    if (p.entityId === this.entityId) {
      for (const prop of p.properties) {
        if (prop.key === 'generic.movementSpeed') this.player.speedAttr = { base: prop.value, modifiers: prop.modifiers };
        if (prop.key === 'generic.maxHealth') this.maxHealth = prop.value;
        if (prop.key === 'generic.attackSpeed') this.player.attackSpeed = attributeValue(prop);
      }
    }
    this.entities.setAttributes(p);
  }

  on_map_chunk(p) {
    this.world.loadChunk(p.x, p.z, p.groundUp, p.bitMap, p.chunkData, 0, this.world.hasSky);
    for (const nbt of p.blockEntities) this.applyBlockEntity(nbt);
  }

  on_unload_chunk(p) { this.world.unloadChunk(p.chunkX, p.chunkZ); }

  // Block entity NBT (from chunk data or the update packet): signs carry their text, the rest goes to the renderer
  // with the update action vanilla uses for that block entity
  applyBlockEntity(nbt, action) {
    const data = simplify(nbt);
    if (!data || data.x === undefined) return;
    const pos = { x: data.x, y: data.y, z: data.z };
    const id = String(data.id || '').replace(/^minecraft:/, '');
    if (id === 'sign') {
      this.tileRenderer.setSign(pos, [data.Text1, data.Text2, data.Text3, data.Text4].map((l) => chatToLegacy(l || '')));
      return;
    }
    if (id === 'structure_block') this.structureBlocks.set(pos.x + ',' + pos.y + ',' + pos.z, data); // for GuiEditStructure
    // GuiCommandBlock.updateGui once the opened block's data (action 2) arrives
    if (id === 'command_block' && action === 2) {
      const s = this.screens.current;
      if (s instanceof CommandBlockScreen && s.pos.x === pos.x && s.pos.y === pos.y && s.pos.z === pos.z) s.updateGui(data);
    }
    if (action === undefined) action = BLOCK_ENTITY_ACTIONS[id];
    if (action !== undefined) this.tileRenderer.setTileEntity(pos, action, data, nbt);
  }

  on_multi_block_change(p) {
    // Relight all changed blocks together in one pass
    this.world.beginBatch();
    try { for (const r of p.records) this.world.setState(p.chunkX * 16 + r.x, r.y, p.chunkZ * 16 + r.z, r.state); } finally { this.world.endBatch(); }
  }

  on_block_change(p) {
    this.world.setState(p.location.x, p.location.y, p.location.z, p.state);
    this.interaction.onBlockChange(p.location, p.state);
  }

  on_block_action(p) {
    // BlockPistonBase.eventReceived runs on the client too: the moving blocks start sliding right away
    const n = blocks[p.blockId] && blocks[p.blockId].name;
    if (n === 'piston' || n === 'sticky_piston') this.pistons.onBlockEvent(p.location, p.byte1, p.byte2, p.blockId);
    this.tileRenderer.onBlockAction(p);
    this.sound.onBlockAction(p);
  }

  on_block_break_animation(p) { this.interaction.setRemoteBreak(p.entityId, p.location, p.destroyStage); }

  on_explosion(p) {
    this.sound.playExplosion(p.x, p.y, p.z);
    for (const r of p.records) this.world.setState(Math.floor(p.x) + r.x, Math.floor(p.y) + r.y, Math.floor(p.z) + r.z, 0);
    this.player.motionX += p.motionX;
    this.player.motionY += p.motionY;
    this.player.motionZ += p.motionZ;
    this.particles.explosion(p.x, p.y, p.z, p.radius);
  }

  on_world_event(p) { this.sound.onWorldEvent(p); this.particles.onWorldEvent(p); }

  on_named_sound_effect(p) { this.sound.play(p.soundName.replace(/^minecraft:/, ''), p.x, p.y, p.z, p.volume, p.pitch, { category: p.soundCategory }); }

  // SoundEvent registry id (data/sounds.json)
  on_sound_effect(p) {
    const name = this.assets.soundNames[p.soundId];
    if (name) this.sound.play(name, p.x, p.y, p.z, p.volume, p.pitch, { category: p.soundCategory });
  }

  on_world_particles(p) { this.particles.onPacket(p); }

  on_game_state_change(p) {
    switch (p.reason) {
      case 0: this.hud.addChat(this.assets.translate('tile.bed.notValid')); break;
      // World.setRainStrength sets the previous and current strength
      case 1: this.world.raining = true; this.world.rainStrength = this.world.prevRain = 0; break;
      case 2: this.world.raining = false; this.world.rainStrength = this.world.prevRain = 1; break;
      case 3: { const gm = Math.floor(p.value + 0.5); if (gm !== this.gameMode) this.previousGameMode = this.gameMode; this.gameMode = gm; this.applyGameMode(); break; }
      case 4: {
        const value=Math.floor(p.value+.5);
        if(value===0){this.send(C.clientCommand(0));this.screens.open(new DownloadingTerrainScreen(this));}
        else if(value===1){const conn=this.conn;import('../gui/screens/credits.js').then(m=>{if(this.conn===conn&&this.inWorld)this.screens.open(new m.CreditsScreen(this));});}
        break;
      }
      case 5: this.onDemoMessage(p.value); break;
      case 6: this.sound.playAtPlayer('entity.arrow.hit_player', 0.18, 0.45); break;
      case 7: this.world.rainStrength = p.value; this.world.prevRain = p.value; break;
      case 8: this.world.thunderStrength = p.value; break;
      case 10: this.sound.playAtPlayer('entity.elder_guardian.curse', 1, 1); this.hud.elderGuardianTime = 60; break;
      default: break;
    }
  }

  on_spawn_entity_weather(p) {
    this.renderer.lightningTicks = 2;
    this.entities.spawnLightning(p);
    // thunder / explosion sounds arrive from the server (EntityLightningBolt plays them through playSoundEffect)
  }

  on_open_window(p) {
    const win = new ContainerWindow(this, p.windowId, p.inventoryType, chatToLegacy(p.windowTitle), p.slotCount, p.entityId);
    this.window = win;
    openContainerScreen(this, win);
  }

  on_close_window(p) {
    if (this.window && this.window.id === p.windowId) {
      this.window = null;
      this.inventory.cursor = null;
      this.screens.closeContainer();
    }
  }

  on_set_slot(p) {
    this.tutorial.handleSetSlot(p.item);
    if (p.windowId === -1 && p.slot === -1) { this.inventory.cursor = p.item; return; }
    if (p.windowId === 0 || p.windowId === -2) {
      if (p.windowId === -2) this.inventory.setPlayerSlotByInventoryIndex(p.slot, p.item);
      else this.inventory.setSlot(p.slot, p.item);
      if (this.window && p.windowId === 0) return;
      return;
    }
    if (this.window && this.window.id === p.windowId) this.window.setSlot(p.slot, p.item);
  }

  on_window_items(p) {
    if (p.windowId === 0) this.inventory.setAll(p.items);
    else if (this.window && this.window.id === p.windowId) this.window.setAll(p.items);
  }

  on_craft_progress_bar(p) {
    if (this.window && this.window.id === p.windowId) this.window.properties[p.property] = p.value;
  }

  on_transaction(p) {
    if (!p.accepted) this.send(C.transaction(p.windowId, p.action, true));
  }

  on_map(p) { this.items.updateMap(p); }

  // CooldownTracker (ender pearls, chorus fruit, shields disabled by an axe)
  on_set_cooldown(p) {
    if (!this.cooldowns) this.cooldowns = new Map();
    if (p.cooldownTicks > 0) this.cooldowns.set(p.itemId, { start: this.ticks, end: this.ticks + p.cooldownTicks });
    else this.cooldowns.delete(p.itemId);
  }

  // CooldownTracker.getCooldown: fraction of the cooldown left (0 = ready)
  cooldownFraction(itemId, partial) {
    const c = this.cooldowns && this.cooldowns.get(itemId);
    if (!c) return 0;
    const t = this.ticks + partial;
    if (t >= c.end) { this.cooldowns.delete(itemId); return 0; }
    return Math.max(0, Math.min(1, (c.end - t) / (c.end - c.start)));
  }

  on_tile_entity_data(p) { if (p.nbtData) this.applyBlockEntity(p.nbtData, p.action === 9 ? undefined : p.action); }

  on_open_sign_entity(p) { this.screens.open(new SignEditScreen(this, p.location)); }

  // S37PacketStatistics only carries stats that changed since the last one, so keep a running copy
  // (StatFileWriter) and hand screens the whole map
  on_statistics(p) {
    if (!this.statValues) this.statValues = new Map();
    for (const e of p.entries) this.statValues.set(e.name, e.value);
    this.stats = [...this.statValues].map(([name, value]) => ({ name, value }));
    if (this.screens.current && this.screens.current.onStats) this.screens.current.onStats(this.stats);
  }

  on_player_info(p) {
    this.scoreboard.onPlayerInfo(p);
    // skins and capes follow the tab list's textures property (it can arrive after the player is first drawn)
    for (const d of p.data || []) if (d.uuid) {
      if(p.action===4)this.eaglerTextures?.drop(d.uuid);
      else if(d.properties&&!this.eaglerTextures?.active)this.entityRenderer.skinFor({uuid:d.uuid});
    }
  }

  on_abilities(p) {
    const pl = this.player;
    pl.invulnerable = !!(p.flags & 1);
    pl.flying = !!(p.flags & 2);
    pl.allowFlying = !!(p.flags & 4);
    pl.creative = !!(p.flags & 8);
    pl.flySpeed = p.flyingSpeed;
    pl.walkSpeed = p.walkingSpeed;
  }

  on_tab_complete(p) { if (this.screens.current && this.screens.current.onTabComplete) this.screens.current.onTabComplete(p.matches); }

  on_scoreboard_objective(p) { this.scoreboard.onObjective(p); }
  on_scoreboard_score(p) { this.scoreboard.onScore(p); }
  on_scoreboard_display_objective(p) { this.scoreboard.onDisplay(p); }
  on_scoreboard_team(p) { this.scoreboard.onTeam(p); }

  on_custom_payload(p) {
    this.eaglerTextures?.handle(p.channel,p.data);
    if (p.channel === 'MC|TrList') {
      if (this.screens.current && this.screens.current.onTradeList) this.screens.current.onTradeList(p.data);
      else this.pendingTrades = p.data;
    } else if (p.channel === 'MC|StopSound') {
      // category name ("" for all), then the sound event ("" for all)
      const r = new Reader(p.data);
      const category = r.string(), sound = r.string();
      this.sound.stop(sound, SOUND_CATEGORIES.includes(category) ? category : null);
    } else if (p.channel === 'MC|BOpen') {
      const held = this.inventory.held();
      if (held && held.id === 387) this.screens.open(new BookScreen(this, held, false));
    }
  }

  on_kick_disconnect(p) {
    this.kickReason = chatToLegacy(p.reason);
    if (this.conn) this.conn.close();
  }

  on_difficulty(p) { this.difficulty = p.difficulty; }

  on_combat_event(p) {
    if (p.event === 2 && p.playerId === this.entityId) {
      this.deathMessage = chatToLegacy(p.message);
      if (this.screens.current instanceof DeathScreen) this.screens.current.message = this.deathMessage;
    }
  }

  on_camera(p) {
    this.cameraEntity = p.cameraId === this.entityId ? null : p.cameraId;
  }

  on_world_border(p) {
    const b = this.worldBorder;
    switch (p.action) {
      case 0: b.radius = p.radius / 2; break;
      case 1: b.radius = p.newRadius / 2; break;
      case 2: b.x = p.x; b.z = p.z; break;
      case 3: b.x = p.x; b.z = p.z; b.radius = p.newRadius / 2; b.warningTime = p.warningTime; b.warningBlocks = p.warningBlocks; break;
      case 4: b.warningTime = p.warningTime; break;
      case 5: b.warningBlocks = p.warningBlocks; break;
      default: break;
    }
  }

  on_title(p) { this.hud.onTitle(p); }

  on_boss_bar(p) { this.hud.onBossBar(p); }

  on_advancements(p) { this.advancements.onPacket(p); }

  on_unlock_recipes(p) { this.recipeBook.onPacket(p); }

  // SPacketPlaceGhostRecipe: the server could not fill the grid; show what the recipe needs
  on_craft_recipe_response(p) {
    const s = this.screens.current;
    const win = s && s.container;
    const id = win ? (win.windowId !== undefined ? win.windowId : win.id) : -1;
    if (s && s.recipeBook && id === p.windowId) s.recipeBook.setupGhost(p.recipe);
  }
  on_select_advancement_tab(p) { this.advancements.onSelectTab(p.id); }

  openAdvancements(parent = null) {
    import('../gui/screens/advancements.js').then((m) => this.screens.open(new m.AdvancementsScreen(this, parent)));
  }

  on_set_compression() { /* handled by the proxy */ }

  on_playerlist_header(p) { this.scoreboard.header = chatToLegacy(p.header); this.scoreboard.footer = chatToLegacy(p.footer); }

  on_resource_pack_send(p) {
    const conn = this.conn;
    this.serverPacks.handle(p.url, p.hash, (status) => { if (this.conn === conn) this.send(C.resourcePackStatus(status)); });
  }

  on_update_entity_nbt() { /* unused by vanilla client */ }

  // ---------------------------------------------------------------- Selection boxes

  // Entity.resetHeight for the local player: splash sound scaled by speed, bubbles + splash particles
  _waterSplash() {
    const pl = this.player;
    const f = Math.min(1, Math.sqrt(pl.motionX * pl.motionX * 0.2 + pl.motionY * pl.motionY + pl.motionZ * pl.motionZ * 0.2) * 0.2);
    this.sound.playAtPlayer('entity.player.splash', f, 1 + (Math.random() - Math.random()) * 0.4);
    const y = Math.floor(pl.y) + 1, w = 0.6, n = 1 + w * 20;
    // RenderGlobal.spawnEntityFX: "decreased" drops a third of particles, "minimal" drops them all
    const show = () => { const s = this.settings.particles || 0; return s === 0 || (s === 1 && Math.random() * 3 >= 1); };
    for (let i = 0; i < n; i++) {
      if (show()) this.particles.bubble(pl.x + (Math.random() * 2 - 1) * w, y, pl.z + (Math.random() * 2 - 1) * w, pl.motionX, pl.motionY - Math.random() * 0.2, pl.motionZ);
    }
    for (let i = 0; i < n; i++) {
      if (show()) this.particles.splash(pl.x + (Math.random() * 2 - 1) * w, y, pl.z + (Math.random() * 2 - 1) * w, pl.motionX, pl.motionY, pl.motionZ);
    }
  }

  selectionBox(state, x, y, z) {
    const b = blocks[state >> 4];
    if (!b) return null;
    const n = b.name;
    if (n === 'barrier') return this.player.creative ? [0, 0, 0, 1, 1, 1] : null;
    if (n === 'fire' || n === 'nether_portal' || n === 'portal' || n === 'end_portal' || n === 'moving_piston' || n === 'piston_extension') return null;
    const extracted = jarSelectionBox(state);
    if (extracted !== undefined) return extracted;

    if (n === 'chest' || n === 'trapped_chest' || n === 'ender_chest') return [0.0625, 0, 0.0625, 0.9375, 0.875, 0.9375];
    if (n === 'standing_sign') return [0.25, 0, 0.25, 0.75, 1, 0.75];
    if (n === 'wall_sign') {
      const m = state & 15;
      switch (m) {
        case 2: return [0, 0.28125, 0.875, 1, 0.78125, 1];
        case 3: return [0, 0.28125, 0, 1, 0.78125, 0.125];
        case 4: return [0.875, 0.28125, 0, 1, 0.78125, 1];
        default: return [0, 0.28125, 0, 0.125, 0.78125, 1];
      }
    }
    if (n === 'skull') return [0.25, 0, 0.25, 0.75, 0.5, 0.75];
    if (n === 'standing_banner') return [0.25, 0, 0.25, 0.75, 1, 0.75];
    if (n === 'wall_banner') return [0, 0, 0, 1, 1, 1];
    if (n === 'barrier') return this.player.creative ? [0, 0, 0, 1, 1, 1] : null;
    if (n === 'tallgrass' || n === 'deadbush') return [0.1, 0, 0.1, 0.9, 0.8, 0.9];
    if (n === 'fire' || n === 'portal' || n === 'end_portal' || n === 'piston_extension') return null;
    // Blocks whose vanilla bounds (setBlockBoundsBasedOnState) differ from their (rotated/cross) models
    const m = state & 15;
    if (n === 'torch' || n === 'redstone_torch' || n === 'unlit_redstone_torch') { // BlockTorch, meta 1 E 2 W 3 S 4 N 5 up
      const f = 0.15;
      switch (m) {
        case 1: return [0, 0.2, 0.5 - f, f * 2, 0.8, 0.5 + f];
        case 2: return [1 - f * 2, 0.2, 0.5 - f, 1, 0.8, 0.5 + f];
        case 3: return [0.5 - f, 0.2, 0, 0.5 + f, 0.8, f * 2];
        case 4: return [0.5 - f, 0.2, 1 - f * 2, 0.5 + f, 0.8, 1];
        default: return [0.4, 0, 0.4, 0.6, 0.6, 0.6];
      }
    }
    if (n === 'lever') { // BlockLever, meta & 7: 0 down_x 1 E 2 W 3 S 4 N 5 up_z 6 up_x 7 down_z
      const f = 0.1875;
      switch (m & 7) {
        case 1: return [0, 0.2, 0.5 - f, f * 2, 0.8, 0.5 + f];
        case 2: return [1 - f * 2, 0.2, 0.5 - f, 1, 0.8, 0.5 + f];
        case 3: return [0.5 - f, 0.2, 0, 0.5 + f, 0.8, f * 2];
        case 4: return [0.5 - f, 0.2, 1 - f * 2, 0.5 + f, 0.8, 1];
        case 5: case 6: return [0.25, 0, 0.25, 0.75, 0.6, 0.75];
        default: return [0.25, 0.4, 0.25, 0.75, 1, 0.75];
      }
    }
    if (n === 'yellow_flower' || n === 'red_flower') return [0.3, 0, 0.3, 0.7, 0.6, 0.7]; // BlockBush
    if (n === 'sapling') return [0.1, 0, 0.1, 0.9, 0.8, 0.9];
    if (n === 'brown_mushroom' || n === 'red_mushroom') return [0.3, 0, 0.3, 0.7, 0.4, 0.7];
    if (n === 'wheat' || n === 'carrots' || n === 'potatoes' || n === 'nether_wart') return [0, 0, 0, 1, 0.25, 1];
    if (n === 'reeds') return [0.125, 0, 0.125, 0.875, 1, 0.875];
    if (b.boundingBox === 'block' && !b.isFence && !b.isPane && !b.isWall && !b.isStairs && !b.isDoor && !b.isFenceGate) {
      // Prefer model bounds, which match vanilla selection for most blocks
    }
    const rs = resolveState(state, (a, bb, c) => this.world.getState(a, bb, c), x, y, z);
    if (!rs) return [0, 0, 0, 1, 1, 1];
    const bm = this.assets.modelStore.bakeVariant(rs.file, rs.props, rs.variant, 0);
    if (!bm || !bm.bounds) return [0, 0, 0, 1, 1, 1];
    const bb = bm.bounds;
    if (b.isFence || b.isWall) return [bb[0], 0, bb[2], bb[3], 1, bb[5]];
    return [Math.max(0, bb[0]), Math.max(0, bb[1]), Math.max(0, bb[2]), Math.min(1, bb[3]), Math.min(1, bb[4]), Math.min(1, bb[5])];
  }

  // ---------------------------------------------------------------- Input

  onLockChange(locked) {
    if (!locked && this.inWorld && !this.screens.current && !this.screens.ignoreUnlock) {
      this.screens.open(new PauseScreen(this));
    }
    this.screens.ignoreUnlock = false;
  }

  onKey(e) {
    // Minecraft.dispatchKeypresses: Ctrl+B cycles the narrator (in 1.12 even while typing: no screen is ever "focused")
    if (e.down && !e.repeat && e.ctrl && e.code === 'KeyB') {
      this.narrator.cycle();
      return;
    }
    if (this.screens.current) {
      if (e.down) this.screens.onKey(e);
      else this.screens.onKeyUp(e);
      return;
    }
    // F3 is a modifier: F3+H toggles advanced tooltips, F3 alone toggles the debug screen on release
    if (e.code === 'F3' && !e.down && this.inWorld) { if (!this.f3Combo) this.showDebug = !this.showDebug; this.f3Combo = false; return; }
    if (!e.down || !this.inWorld) return;
    const k = this.settings.keys;
    if (this.input.down.has('F3') && e.code !== 'F3') {
      this.f3Combo = true;
      if (this._debugCombo(e)) return;
    }
    if (e.code === 'Escape') { this.screens.open(new PauseScreen(this)); return; }
    if (e.code === k.chat) { this.input.suppressNextChar = true; this.screens.open(new ChatScreen(this, '')); return; }
    if (e.code === k.command) { this.input.suppressNextChar = true; this.screens.open(new ChatScreen(this, '/')); return; }
    if (e.code === k.inventory) { this.input.suppressNextChar = true; this.openInventory(); return; }
    if (e.code === 'F3') {
      // Shift+F3: profiler pie chart, Alt+F3: lagometer (applied when the debug screen opens)
      this.f3Combo = false;
      this.showProfiler = !!e.shift;
      this.showLagometer = !!e.alt;
      return;
    }
    if (this.showDebug && this.showProfiler && /^Digit[0-9]$/.test(e.code)) this.profiler.navigate(+e.code.slice(5));
    if (e.code === 'F4') { if (this.superSecret) this.superSecretOff = !this.superSecretOff; return; } // switchUseShader
    if (e.code === 'F1') { this.hideGui = !this.hideGui; return; } // not rebindable in 1.8.9
    if (e.code === k.smoothCamera) { this.smoothCamera = !this.smoothCamera; return; }
    if (e.code === k.perspective) { this.thirdPerson = (this.thirdPerson + 1) % 3; return; }
    if (e.code === k.screenshot) { this.takeScreenshot(); return; }
    if (e.code === k.drop) { this.interaction.dropItem(e.ctrl); return; }
    if (e.code === k.advancements) { this.openAdvancements(); return; } // GuiScreenAdvancements
    // Minecraft.processKeyBinds: swap hands (CPacketPlayerDigging SWAP_HELD_ITEMS); not in spectator mode
    if (e.code === k.swapHands && this.gameMode !== 3) { this.send(C.blockDig(6, 0, 0, 0, 0)); return; }
    if (e.code === k.fullscreen) { platform().toggleFullscreen(); return; }
    for (let i = 1; i <= 9; i++) {
      if (e.code === k['hotbar' + i]) {
        const load = this.input.isDown('loadToolbarActivator'), save = this.input.isDown('saveToolbarActivator');
        if (this.gameMode === 3) this.hud.spectatorGui.onHotbarSelected(i - 1);
        else if (this.gameMode === 1 && !this.screens.current && (load || save)) handleHotbarSnapshots(this, i - 1, load, save);
        else this.selectSlot(i - 1);
        return;
      }
    }
    if (!this.input.locked) this.input.lock();
  }

  onMouse(e) {
    if (this.screens.current) {
      this.screens.onMouse(e);
      return;
    }
    if (e.down && this.inWorld && !this.input.locked) {
      this.input.lock();
      return;
    }
    // Minecraft.runTickMouse: middle click in spectator mode goes to the spectator menu
    if (e.down && this.inWorld && this.gameMode === 3 && e.button === 1) this.hud.spectatorGui.onMiddleClick();
  }

  openInventory() {
    if (this.gameMode === 3) return;
    if (this.player.ridingEntity && this.entities.isHorse(this.ridingEntityId)) {
      this.send(C.entityAction(this.entityId, 7));
      return;
    }
    this.tutorial.openInventory();
    if (this.gameMode === 1) this.screens.open(new CreativeScreen(this));
    else this.screens.open(new InventoryScreen(this));
  }

  selectSlot(i) {
    if (i === this.heldSlot) return;
    this.heldSlot = i;
    this.send(C.heldItemSlot(i));
    this.interaction.onSlotChanged();
  }

  takeScreenshot() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const name = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}.${pad(d.getMinutes())}.${pad(d.getSeconds())}.png`;
    this.device.capture().then((img) => {
      platform().saveFile(name, encodePng(img.width, img.height, img.data), 'image/png');
      this.hud.addChat('Saved screenshot as ' + name);
    }).catch((e) => this.hud.addChat('§cCouldn\'t save screenshot: ' + e.message));
  }

  // ---------------------------------------------------------------- Tick

  tick() {
    this.ticks++;
    if (smoothCameraActive(this) && this._smoothCam) {
      // EntityRenderer.updateRenderer: MouseFilter.smooth(accumulated, 0.05 * f)
      const sc = this._smoothCam;
      const s = this.settings.sensitivity * 0.6 + 0.2, f = s * s * s * 8;
      const smooth = (mf, x, k) => {
        mf.target += x; x = (mf.target - mf.remaining) * k;
        mf.last += (x - mf.last) * 0.5;
        if ((x > 0 && x > mf.last) || (x < 0 && x < mf.last)) x = mf.last;
        mf.remaining += x;
        return x;
      };
      sc.mx = sc.mx || { target: 0, remaining: 0, last: 0 };
      sc.my = sc.my || { target: 0, remaining: 0, last: 0 };
      sc.fx = smooth(sc.mx, sc.yaw, 0.05 * f);
      sc.fy = smooth(sc.my, sc.pitch, 0.05 * f);
      sc.partial = 0; sc.yaw = 0; sc.pitch = 0;
    }
    this.renderer.tick();
    const A = this.assets;
    const changed = A.atlas.tick();
    for (const e of this._updateCompassClock()) changed.push(e);
    for (const e of changed) this.device.updateTexture(A.atlasTexture, A.atlas.region(e), e.x, e.y, e.w, e.h);
    this.screens.tick();
    this.hud.tick();
    if (!this.inWorld || !this.doneLoadingTerrain) { this.sound.tick(); return; } // menus still run the MusicTicker
    const pl = this.player;
    const world = this.world;

    // No client-side weather fade: World.updateWeather only moves the strengths on the server, which sends each
    // change (game state 7 / 8). "Begin raining" alone stays at strength 0, so nothing is visible.
    if (world.doDaylightCycle) world.timeOfDay++;
    world.worldAge++;

    if (this.hurtTime > 0) this.hurtTime--;

    // Mouse wheel hotbar scroll
    if (this.input.wheel !== 0 && !this.screens.current) {
      let s = this.heldSlot + this.input.wheel;
      s = ((s % 9) + 9) % 9;
      if (this.gameMode === 3) {
        // Minecraft.runTickMouse: the spectator menu, else the flying speed (client side only)
        if (this.hud.spectatorGui.active) this.hud.spectatorGui.onMouseScroll(Math.sign(this.input.wheel));
        else this.player.flySpeed = Math.min(0.2, Math.max(0, Math.fround(this.player.flySpeed - Math.sign(this.input.wheel) * Math.fround(0.005))));
      }
      else this.selectSlot(s);
    }
    this.input.wheel = 0;

    const canMove = !this.screens.current || this.screens.current.allowsMovement;
    const inp = canMove && this.input.locked ? {
      forward: this.input.isDown('forward'), back: this.input.isDown('back'),
      left: this.input.isDown('left'), right: this.input.isDown('right'),
      jump: this.input.isDown('jump'), sneak: this.input.isDown('sneak'), sprint: this.input.isDown('sprint'),
    } : {};

    // Interaction (dig/use/attack) before movement like vanilla runTick
    const presses = this.input.consumePresses();
    // Minecraft.runTick: Tutorial.update, then (EntityPlayerSP.onLivingUpdate) the movement keys and the hovered block
    this.tutorial.update();
    this.tutorial.handleMovement(inp);
    this.tutorial.onMouseHover(this.interaction.target);
    if (!this.screens.current && this.input.locked && !this.dead) this.interaction.tick(presses);
    else this.interaction.tickIdle();

    // EntityPlayerSP.onUpdate: nothing at all happens (no movement, no packets) while the chunk under the player is
    // not loaded
    if (!world.isLoaded(Math.floor(pl.x), Math.floor(pl.z))) {
      // skip the player update
    } else if (this.player.ridingEntity) {
      this._tickRiding(inp);
    } else {
      // GameSettings.autoJump; ItemElytra.isUsable on the chest slot. Dead or sleeping: isMovementBlocked, so the
      // player still falls but takes no input
      const blocked = this.dead || !!this.sleeping;
      const tin = blocked ? {} : inp;
      const chest = this.inventory.armor[2];
      tin.autoJump = this.settings.autoJump;
      tin.elytraUsable = !!(chest && chest.id === 443 && chest.damage < this.items.maxDurability(443) - 1);
      pl.sleeping = !!this.sleeping;
      const res = pl.tick(world, tin);
      if (res.abilitiesChanged) this.sendAbilities();
      if (res.startFallFlying) this.send(C.entityAction(this.entityId, 8)); // START_FALL_FLYING
      this._sendMovement();
    }

    this.entities.tick();
    pushLocalPlayer(this);
    // World.updateEntityWithOptionalForce: passengers update after their vehicle, so a server-driven vehicle
    // (minecart, pig, someone else's boat) has moved before we are put back on it (Entity.updatePassenger)
    if (this.player.ridingEntity) {
      const v = this.entities.get(this.ridingEntityId);
      if (v && !v.controlled) this.player.setPosition(...this.entities.riderPos(v, this.entityId, 'player'));
    }
    this.particles.tick();
    this.weather.tick();
    this.sound.tick();
    this.tileRenderer.tick();
    this.pistons.tick();
    this.entityRenderer.tick();
    this.handRenderer.tick();
    this.portalTick();

    // FOV modifier (AbstractClientPlayer.getFovModifier)
    let f = 1;
    if (pl.flying) f *= 1.1;
    const speed = pl.aiMoveSpeed();
    const walk = pl.walkSpeed || 0.1;
    f = f * ((speed / walk + 1) / 2);
    if (walk === 0 || !isFinite(f)) f = 1;
    if (pl.usingItem) {
      const held = this.inventory.held();
      if (held && held.id === 261) {
        const ticks = this.interaction.useTicks;
        let f1 = ticks / 20;
        f1 = f1 > 1 ? 1 : f1 * f1;
        f *= 1 - f1 * 0.15;
      }
    }
    this.prevFovModifier = this.fovModifier;
    this.fovModifier += (f - this.fovModifier) * 0.5;
    if (this.fovModifier > 1.5) this.fovModifier = 1.5;
    if (this.fovModifier < 0.1) this.fovModifier = 0.1;

    for (const [id, e] of this.effects) {
      if (e.duration > 0) e.duration--;
    }
  }

  portalTick() { tickPortal(this); }

  // The vehicle the local player steers itself (1.9+: boats, saddled horses), or null
  _vehicleController(v) {
    const passengers = this.entities.passengersOf(v.id);
    const first = passengers.length ? passengers[0] : this.entityId;
    if (first !== this.entityId) return null; // only the first passenger steers
    const horse = v.kind === 'mob' && v.type === 100 && !!((v.horseFlags || 0) & 4);
    if (v.kind !== 'boat' && !horse) return null;
    if (!this.vehicle || this.vehicle.e !== v) {
      if (this.vehicle) this.vehicle.e.controlled = false;
      this.vehicle = v.kind === 'boat' ? new BoatController(this.world, v) : new HorseController(this.world, v);
      v.controlled = true;
    }
    return this.vehicle;
  }

  _dropVehicle() { if (this.vehicle) { this.vehicle.e.controlled = false; this.vehicle = null; } }

  // SPacketMoveVehicle: the server's correction of the vehicle we steer
  on_vehicle_move(p) { if (this.vehicle) this.vehicle.setFromServer(p.x, p.y, p.z, p.yaw); }

  // EntityPlayerSP while riding: the vehicle moves first (boats send their paddles), then the rider sends rotation,
  // input and, when steering, the vehicle's position. Horse jumps charge while space is held.
  _tickRiding(inp) {
    const pl = this.player;
    pl.prevX = pl.x; pl.prevY = pl.y; pl.prevZ = pl.z;
    pl.prevYaw = pl.yaw; pl.prevPitch = pl.pitch;
    const v = this.entities.get(this.ridingEntityId);
    let forward = 0, strafe = 0;
    if (inp.forward) forward++; if (inp.back) forward--;
    if (inp.left) strafe++; if (inp.right) strafe--;
    if (inp.sneak) { forward *= 0.3; strafe *= 0.3; }
    forward = Math.fround(forward * 0.98); strafe = Math.fround(strafe * 0.98);
    const jump = !!inp.jump;
    const ctl = v ? this._vehicleController(v) : null;
    if (!ctl) this._dropVehicle();
    if (v && v.kind === 'mob' && v.type === 100) {
      const was = this._rideJump;
      if (this.horseJumpCounter < 0) { this.horseJumpCounter++; if (this.horseJumpCounter === 0) this.horseJump = 0; }
      if (was && !jump) {
        this.horseJumpCounter = -10;
        const power = Math.floor(this.horseJump * 100);
        if (ctl && ctl.setJumpPower) ctl.setJumpPower(power);
        // start + stop horse jump (1.9+)
        this.send(C.entityAction(this.entityId, 5, power));
        this.send(C.entityAction(this.entityId, 6));
      } else if (!was && jump) { this.horseJumpCounter = 0; this.horseJump = 0; }
      else if (was) {
        this.horseJumpCounter++;
        this.horseJump = this.horseJumpCounter < 10 ? this.horseJumpCounter * 0.1 : 0.8 + 2 / (this.horseJumpCounter - 9) * 0.1;
      }
    } else this.horseJump = undefined;
    this._rideJump = jump;
    if (ctl) {
      if (ctl instanceof BoatController) {
        const r = ctl.tick(inp);
        this.send(C.steerBoat(r.paddles[0], r.paddles[1]));
        ctl.applyToRider(pl);
      } else {
        const a = v.attributes || {};
        const val = (k, d) => (a[k] ? attributeValue(a[k]) : d);
        const jb = this.effects.get(8);
        ctl.tick(pl, strafe, forward, { speed: val('generic.movementSpeed', 0.225), jumpStrength: val('horse.jumpStrength', 0.7), jumpBoost: jb ? jb.amplifier : -1 });
      }
      // the vehicle entity follows the simulation
      const b = ctl.body;
      v.prevX = v.x; v.prevY = v.y; v.prevZ = v.z; v.prevYaw = v.yaw;
      v.x = v.newX = b.x; v.y = v.newY = b.y; v.z = v.newZ = b.z; v.inc = 0;
      v.yaw = v.newYaw = ctl instanceof BoatController ? ctl.yaw : b.yaw;
    }
    if (v) {
      pl.setPosition(...this.entities.riderPos(v, this.entityId, 'player'));
    }
    this.send(C.look(pl.yaw, pl.pitch, pl.onGround));
    this.send(C.steerVehicle(strafe, forward, (jump ? 1 : 0) | (inp.sneak ? 2 : 0)));
    if (ctl) this.send(C.vehicleMove(v.x, v.y, v.z, v.yaw, ctl.body.pitch || 0));
  }

  sendAbilities() {
    const pl = this.player;
    let flags = 0;
    if (pl.invulnerable) flags |= 1;
    if (pl.flying) flags |= 2;
    if (pl.allowFlying) flags |= 4;
    if (pl.creative) flags |= 8;
    this.send(C.abilities(flags, pl.flySpeed, pl.walkSpeed));
  }

  // EntityPlayerSP.onUpdateWalkingPlayer
  _sendMovement() {
    const pl = this.player;
    const lr = this.lastReported;
    if (pl.sprinting !== lr.sprint) {
      this.send(C.entityAction(this.entityId, pl.sprinting ? 3 : 4));
      lr.sprint = pl.sprinting;
    }
    const sneak = pl.sneaking && !this.player.ridingEntity;
    if (pl.sneaking !== lr.sneak) {
      this.send(C.entityAction(this.entityId, pl.sneaking ? 0 : 1));
      lr.sneak = pl.sneaking;
    }
    void sneak;
    if (this.cameraEntity !== null && this.cameraEntity !== undefined) return;
    // 1.9+: counted before the check, and with nothing else to send only an on-ground change is reported
    const d0 = pl.x - lr.x, d1 = pl.y - lr.y, d2 = pl.z - lr.z;
    const d3 = pl.yaw - lr.yaw, d4 = pl.pitch - lr.pitch;
    this.positionUpdateTicks++;
    const moved = d0 * d0 + d1 * d1 + d2 * d2 > 9.0e-4 || this.positionUpdateTicks >= 20;
    const rotated = d3 !== 0 || d4 !== 0;
    if (moved && rotated) this.send(C.positionLook(pl.x, pl.y, pl.z, pl.yaw, pl.pitch, pl.onGround));
    else if (moved) this.send(C.position(pl.x, pl.y, pl.z, pl.onGround));
    else if (rotated) this.send(C.look(pl.yaw, pl.pitch, pl.onGround));
    else if (lr.onGround !== pl.onGround) this.send(C.flying(pl.onGround));
    if (moved) { lr.x = pl.x; lr.y = pl.y; lr.z = pl.z; this.positionUpdateTicks = 0; }
    if (rotated) { lr.yaw = pl.yaw; lr.pitch = pl.pitch; }
    lr.onGround = pl.onGround; // prevOnGround
  }

  // ---------------------------------------------------------------- Frame

  // One frame of the game loop; an exception in it is a crash (crash.js), like vanilla's Minecraft.run catching
  // everything thrown by runGameLoop
  frame(t) {
    if (this.crashed) return;
    try { this._frame(t); } catch (e) { this.crash(e, 'Running the game loop'); }
  }

  crash(error, description) {
    if (this.crashed) return;
    this.crashed = true;
    let report;
    try { report = buildCrashReport(error, description, this); } catch (e) { report = String(error && error.stack || error); }
    try { if (this.conn) this.conn.close(); } catch (e) { /* already gone */ }
    try { this.sound.stopAll(); } catch (e) { /* no audio */ }
    showCrashScreen(report);
  }

  _frame(t) {
    platform().requestFrame((tt) => this.frame(tt));
    const now = platform().now();
    const P = this.profiler;
    P.enabled = this.showDebug && this.showProfiler;
    P.start('root');
    let dt = now - this.lastFrame;
    this.lastFrame = now;
    if (dt > 1000) dt = 1000;
    this.tickAccumulator += dt;
    let n = 0;
    P.start('tick');
    while (this.tickAccumulator >= TICK_MS && n < 10) {
      this.tickAccumulator -= TICK_MS;
      this.tick();
      n++;
    }
    P.end();
    if (n >= 10) this.tickAccumulator = 0;
    this.partial = this.tickAccumulator / TICK_MS;

    // Mouse look (applied per frame like vanilla)
    const [mdx, mdy] = this.input.takeMouseDelta();
    if (this.inWorld && this.input.locked && !this.screens.current) {
      this.tutorial.handleMouse(mdx, mdy);
      const s = this.settings.sensitivity * 0.6 + 0.2;
      const f = s * s * s * 8;
      let dx = mdx * f * 0.15, dy = mdy * f * 0.15 * (this.settings.invertMouse ? -1 : 1);
      if (smoothCameraActive(this)) {
        // EntityRenderer: accumulate input, filtered once per tick and spread over the frames of that tick
        const sc = this._smoothCam || (this._smoothCam = { yaw: 0, pitch: 0, fx: 0, fy: 0, partial: 0 });
        sc.yaw += mdx * f; sc.pitch += mdy * f * (this.settings.invertMouse ? -1 : 1);
        const step = this.partial - sc.partial;
        sc.partial = this.partial;
        dx = sc.fx * Math.max(0, step) * 0.15; dy = sc.fy * Math.max(0, step) * 0.15;
      }
      if (this.cameraEntity === null || this.cameraEntity === undefined || true) {
        // Entity.setAngles: rotations are floats
        this.player.yaw = Math.fround(this.player.yaw + dx);
        this.player.pitch = Math.fround(this.player.pitch + dy);
        if (this.player.pitch < -90) this.player.pitch = -90;
        if (this.player.pitch > 90) this.player.pitch = 90;
      }
    }

    P.start('chunkScheduling');
    this._scheduleMeshes();
    P.end();
    const maxFps = this.settings.maxFps;
    if (maxFps > 0 && now - (this._lastRender || 0) < 1000 / maxFps - 1) { P.end(); P.endFrame(); return; }
    // VSync off runs frames from a message loop; never queue more than ~2 frames on the GPU or the
    // browser can't present them (and input starves) - frames beyond that would never be seen anyway
    if (platform().vsync === false && this.device.busy && this.device.busy()) { P.end(); P.endFrame(); return; }
    // FrameTimer: time between rendered frames, for the lagometer
    if (this._lastRender) { this.frameTimes[this.frameTimeIndex] = now - this._lastRender; this.frameTimeIndex = (this.frameTimeIndex + 1) % this.frameTimes.length; }
    this._lastRender = now;
    P.start('gameRenderer');
    this.renderFrame();
    P.end();
    P.end();
    P.endFrame();

    this.frames++;
    if (now - this.fpsTimer >= 1000) {
      this.fps = this.frames;
      this.frames = 0;
      this.fpsTimer = now;
      this.chunkUpdates = this._chunkUpdatesCount || 0;
      this._chunkUpdatesCount = 0;
    }
  }

  // Interpolated camera / eye position
  eyePosition(partial = this.partial) {
    const pl = this.player;
    let x = pl.prevX + (pl.x - pl.prevX) * partial;
    let y = pl.prevY + (pl.y - pl.prevY) * partial;
    let z = pl.prevZ + (pl.z - pl.prevZ) * partial;
    if (this.cameraEntity !== null && this.cameraEntity !== undefined) {
      const e = this.entities.get(this.cameraEntity);
      if (e) { const ip = this.entities.interp(e, partial); x = ip.x; y = ip.y; z = ip.z; return [x, y + e.eyeHeight, z]; }
    }
    return [x, y + pl.eyeHeight(), z]; // EntityPlayer.getEyeHeight
  }

  lookVector(partial = this.partial) {
    const pl = this.player;
    const yaw = pl.prevYaw + (pl.yaw - pl.prevYaw) * partial;
    const pitch = pl.prevPitch + (pl.pitch - pl.prevPitch) * partial;
    const f = Math.cos(-yaw * 0.017453292 - Math.PI), f1 = Math.sin(-yaw * 0.017453292 - Math.PI);
    const f2 = -Math.cos(-pitch * 0.017453292), f3 = Math.sin(-pitch * 0.017453292);
    return [f1 * f2, f3, f * f2];
  }

  renderFrame() {
    const r = this.renderer;
    const partial = this.partial;
    const gui = this.gui;
    if (!this.inWorld || !this.doneLoadingTerrain) {
      if (this.screens.current && this.screens.current.panorama) r.renderPanorama(platform().now());
      else r.renderBlank();
      gui.begin();
      this.screens.render(gui, partial);
      if (!this.hideGui) this.hud.renderToast(gui); // GuiToast.drawToast: on top of every screen
      gui.end();
      this.device.endFrame();
      return;
    }
    const pl = this.player;
    let [ex, ey, ez] = this.eyePosition(partial);
    const yaw = pl.prevYaw + (pl.yaw - pl.prevYaw) * partial;
    const pitch = pl.prevPitch + (pl.pitch - pl.prevPitch) * partial;
    let camYaw = yaw, camPitch = pitch, roll = 0;
    const sleepView = sleepingCamera(this, partial);
    if (sleepView) { ex=sleepView.x; ey=sleepView.y; ez=sleepView.z; camYaw=sleepView.yaw; camPitch=sleepView.pitch; }

    if (this.debugCam) { [ex, ey, ez] = [this.debugCam.x, this.debugCam.y, this.debugCam.z]; camYaw = this.debugCam.yaw; camPitch = this.debugCam.pitch; }
    // EntityRenderer.setupCameraTransform, view-space part before orientCamera:
    // hurtCameraEffect, setupViewBobbing, then the first-person 0.1 pull-back from orientCamera
    const pre = mat4.create();
    if (this.dead) {
      const dt = (this.ticks - (this.deathTick || this.ticks)) + partial;
      mat4.rotateZ(pre, pre, (40 - 8000 / (dt + 200)) * Math.PI / 180);
    }
    if (this.hurtTime > 0) {
      let f = (this.hurtTime - partial) / 10; // maxHurtTime; attackedAtYaw is always 0 on the client
      f = Math.sin(f * f * f * f * Math.PI);
      mat4.rotateZ(pre, pre, -f * 14 * Math.PI / 180);
    }
    if (this.settings.viewBobbing && !sleepView) {
      const f = pl.distanceWalked - pl.prevDistanceWalked;
      const f1 = -(pl.distanceWalked + f * partial);
      const f2 = pl.prevCameraYaw + (pl.cameraYaw - pl.prevCameraYaw) * partial;
      const f3 = pl.prevCameraPitch + (pl.cameraPitch - pl.prevCameraPitch) * partial;
      mat4.translate(pre, pre, Math.sin(f1 * Math.PI) * f2 * 0.5, -Math.abs(Math.cos(f1 * Math.PI) * f2), 0);
      mat4.rotateZ(pre, pre, Math.sin(f1 * Math.PI) * f2 * 3 * Math.PI / 180);
      mat4.rotateX(pre, pre, Math.abs(Math.cos(f1 * Math.PI - 0.2) * f2) * 5 * Math.PI / 180);
      mat4.rotateX(pre, pre, f3 * Math.PI / 180);
    }
    if (this.thirdPerson === 0 && !this.debugCam && !sleepView) mat4.translate(pre, pre, 0, 0, -0.1);
    const look = this.lookVector(partial);
    if (this.thirdPerson > 0 && !sleepView) {
      let dist = 4;
      const dir = this.thirdPerson === 2 ? -1 : 1;
      const lx = -look[0] * dir, ly = -look[1] * dir, lz = -look[2] * dir;
      for (let i = 0; i < 8; i++) {
        const ox = ((i & 1) * 2 - 1) * 0.1, oy = (((i >> 1) & 1) * 2 - 1) * 0.1, oz = (((i >> 2) & 1) * 2 - 1) * 0.1;
        const hit = this.world.raycast(ex + ox, ey + oy, ez + oz, lx, ly, lz, dist);
        if (hit && hit.dist < dist) dist = hit.dist;
      }
      ex += lx * dist; ey += ly * dist; ez += lz * dist;
      this._thirdPersonDist = dist;
      if (this.thirdPerson === 2) { camYaw += 180; camPitch = -camPitch; }
    }
    let fov = this.settings.fov;
    fov *= this.prevFovModifier + (this.fovModifier - this.prevFovModifier) * partial;
    const eyeBlock = blocks[this.world.getState(Math.floor(ex), Math.floor(ey), Math.floor(ez)) >> 4];
    const underwater = eyeBlock && eyeBlock.isWater && ey < Math.floor(ey) + 1 - this._fluidPct(ex, ey, ez) + 0.11;
    const inLava = eyeBlock && eyeBlock.isLava;
    if (underwater || inLava) fov = fov * 60 / 70;
    if (this.dead) fov /= (1 - 500 / (500 + 20)) * 2 + 1;
    // Portal nausea warp
    const portal = (this.prevPortalTime||0) + ((this.portalTime||0) - (this.prevPortalTime||0)) * partial;

    fov = zoomFov(this,fov);
    r.renderDistance = this.settings.renderDistance;
    r.setCamera(ex, ey, ez, camYaw, camPitch, roll, fov, pre,portalWarp(portal,this.ticks+partial,this.effects.has(9)));
    const temp = biomeInfo(this.world.getBiome(Math.floor(ex), Math.floor(ez))).temperature;
    const rain = this.world.prevRain !== undefined ? this.world.prevRain + (this.world.rainStrength - this.world.prevRain) * partial : this.world.rainStrength;
    r.updateEnvironment({
      worldTime: this.world.timeOfDay, partial, rain, thunder: this.world.thunderStrength * rain, temperature: temp,
      camPos: [ex, ey, ez], lookDir: look, dimension: this.dimension, underwater, inLava,
      blindness: this.effects.has(15), nightVision: this.effects.has(16) ? 1 : 0, clouds: this.settings.clouds,
      horizon: String(this.levelType).toLowerCase() === 'flat' ? 0 : 63,
    });
    // Sky light for the world (night vision etc.) is folded into the lightmap
    this.profiler.start('culling');
    r.cull(); // frustum + occlusion + fog culling, before entities so they can use the result
    this.profiler.endStart('entities');
    this.entityRenderer.render(partial);
    this.tileRenderer.render(partial);
    this.debugLines.update(partial);
    this.profiler.endStart('particles');
    this.particles.render(partial, ex, ey, ez);
    this.weather.render(partial, ex, ey, ez);
    this.interaction.renderSelection(partial);
    const hand = this.thirdPerson === 0 && !this.hideGui && this.gameMode !== 3 ? this.handRenderer.prepare(partial, fov) : null;
    this.profiler.endStart('level');
    // EntityRenderer.loadEntityShader: spectating a creeper, spider or enderman in first person
    const viewed = this.cameraEntity != null && this.thirdPerson === 0 ? this.entities.get(this.cameraEntity) : null;
    const post = viewed && this.device.createRenderTarget ? this.postEffects.get(entityShaderName(viewed)) : null;
    this.debugShaderName=post?'minecraft:shaders/post/'+entityShaderName(viewed)+'.json':null;
    const packPost = !post && this.shaderPack.active ? this.shaderPack : null;
    this.shaderPack.prepareTerrain(r.camPos,this.eyePosition(partial));
    r.render(hand, post || packPost);
    if(packPost)packPost.render();
    if (post) post.render(r.lightmap, ((this.ticks + partial) % 20) / 20);
    this.profiler.endStart('gui');
    gui.begin();
    this._drawSuperSecret(gui);
    this.hud.render(gui,partial,{underwater,inLava,portal});
    this.screens.render(gui, partial);
    if (!this.hideGui) this.hud.renderToast(gui); // GuiToast.drawToast: on top of every screen
    gui.end();
    this.profiler.end();
    this.device.endFrame();
  }

  _fluidPct(x, y, z) {
    const s = this.world.getState(Math.floor(x), Math.floor(y), Math.floor(z));
    const l = s & 15;
    return ((l >= 8 ? 0 : l) + 1) / 9 - 0.11111111;
  }
}
