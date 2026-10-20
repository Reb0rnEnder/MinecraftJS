// Game options (vanilla defaults), persisted through the platform settings store.
import { platform } from '../platform/platform.js';
import { parseAddress } from '../net/address.js';

export const DEFAULT_KEYS = {
  forward: 'KeyW', left: 'KeyA', back: 'KeyS', right: 'KeyD', jump: 'Space', sneak: 'ShiftLeft', sprint: 'ControlLeft',
  inventory: 'KeyE', drop: 'KeyQ', chat: 'KeyT', command: 'Slash', playerlist: 'Tab', pickItem: 'mouse1',
  attack: 'mouse0', use: 'mouse2', perspective: 'F5', smoothCamera: '', screenshot: 'F2', hideGui: 'F1',
  hotbar1: 'Digit1', hotbar2: 'Digit2', hotbar3: 'Digit3', hotbar4: 'Digit4', hotbar5: 'Digit5',
  hotbar6: 'Digit6', hotbar7: 'Digit7', hotbar8: 'Digit8', hotbar9: 'Digit9', fullscreen: 'F11', spectatorOutlines: '',
  swapHands: 'KeyF', advancements: 'KeyL', saveToolbarActivator: 'KeyC', loadToolbarActivator: 'KeyX', // 1.9 - 1.12
};

const DEFAULTS = {
  fov: 70,
  sensitivity: 0.5,
  invertMouse: false,
  renderDistance: 8,
  guiScale: 0,
  gamma: 0.5,
  viewBobbing: true,
  clouds: 2, // 0 off, 1 fast, 2 fancy
  fancyGraphics: true,
  smoothLighting: 2, // ambient occlusion: 0 off, 1 minimum, 2 maximum
  enableVsync: true,
  mipmapLevels: 4,
  blockAlternatives: true,
  useVbo: true,
  touchscreen: false,
  snooperEnabled: true,
  pauseOnLostFocus: true,
  chatHeightFocused: 1,
  chatHeightUnfocused: 0.44366196,
  particles: 0, // 0 all, 1 decreased, 2 minimal
  chatOpacity: 1,
  chatScale: 1,
  chatWidth: 1,
  chatVisibility: 0, // 0 shown, 1 commands only, 2 hidden
  chatColors: true,
  masterVolume: 1,
  soundVolumes: { music: 0, record: 1, weather: 1, block: 1, hostile: 1, neutral: 1, player: 1, ambient: 1, voice: 1 },
  showSubtitles: false,
  realmsNotifications: true,
  showDebugInfo: false,
  reducedDebugInfo: false,
  narrator: 0, // 0 off, 1 all, 2 chat, 3 system (narrator.js)
  advancedItemTooltips: false,
  skinParts: 0x7f,
  mainHand: 'right',
  attackIndicator: 1, // 0 off, 1 crosshair, 2 hotbar (1.9)
  autoJump: true,     // GameSettings.autoJump (1.11+)
  maxFps: 0,
  graphicsApi: 'webgl2', // 'webgl2' | 'webgpu' | 'software'
  superPotato: false, // lower internal resolution, single-pass menu panorama (always on with the CPU rasteriser)
  resourcePacks: [], // active pack ids, highest priority first
  entityShadows: true,
  lodChunks: 8, // MinecraftJS: past this many chunks terrain is simplified and mobs re-pose less often (0 = off)
  language: 'en_us',
  forceUnicodeFont: false,
  keys: { ...DEFAULT_KEYS },
  lastServer: { host: 'localhost', port: 25565 },
  username: 'WebPlayer',
  servers: [{ name: 'Local Server', host: 'localhost', port: 25565 }],
  proxies: null, // [{ name, url }]; null until first use, then filled from config.json (net/proxies.js)
  proxy: 0,      // selected proxy
};

// config.json "servers": [{ name, address }] (or { name, host, port }) -> settings entries
function configServers(list) {
  const out = [];
  for (const s of list) {
    if (!s) continue;
    const text = s.address || (s.host ? (s.port ? `${s.host}:${s.port}` : s.host) : '');
    const a = parseAddress(text);
    if (!a) { console.warn('config.json: bad server address', text); continue; }
    out.push(a.kind === 'eagler' ? { name: String(s.name || text), host: String(text).trim(), port: 0 } : { name: String(s.name || text), host: a.host, port: a.port });
  }
  return out;
}

export class Settings {
  // config: site configuration (config.json); its servers and proxies are the defaults for new players
  constructor(config = {}) {
    this.config = config;
    let saved = {};
    try { saved = JSON.parse((platform().loadSetting('minecraftjs.settings') || platform().loadSetting('minekampf.settings')) || '{}'); } catch (e) { saved = {}; }
    const defaults = JSON.parse(JSON.stringify(DEFAULTS));
    if (Array.isArray(config.servers)) defaults.servers = configServers(config.servers);
    Object.assign(this, defaults, saved);
    this.keys = { ...DEFAULT_KEYS, ...(saved.keys || {}) };
    this.soundVolumes = { ...DEFAULTS.soundVolumes, ...(saved.soundVolumes || {}) };
    if (Array.isArray(this.servers)) {
      for (const s of this.servers) delete s._icon;
    }
    // language codes are lowercase since 1.11 (older saves: en_US)
    if (typeof this.language === 'string') this.language = this.language.toLowerCase();
    // older saves stored these as booleans
    if (typeof this.clouds === 'boolean') this.clouds = this.clouds ? 2 : 0;
    if (typeof this.smoothLighting === 'boolean') this.smoothLighting = this.smoothLighting ? 2 : 0;
  }

  save() {
    const out = {};
    for (const k of Object.keys(DEFAULTS)) out[k] = this[k];
    if (Array.isArray(this.servers)) {
      out.servers = this.servers.map((s) => ({ name: s.name, host: s.host, port: s.port, ...(s._iconSrc ? { _iconSrc: s._iconSrc } : {}) }));
    }
    platform().saveSetting('minecraftjs.settings', JSON.stringify(out));
  }

  keyName(code) {
    if (!code) return 'NONE';
    if (code === 'mouse0') return 'Button 1';
    if (code === 'mouse1') return 'Button 3';
    if (code === 'mouse2') return 'Button 2';
    if (code.startsWith('mouse')) return 'Button ' + (parseInt(code.slice(5), 10) + 1);
    return code.replace(/^Key/, '').replace(/^Digit/, '').replace('ShiftLeft', 'LSHIFT').replace('ControlLeft', 'LCONTROL')
      .replace('ShiftRight', 'RSHIFT').replace('ControlRight', 'RCONTROL').replace('AltLeft', 'LMENU').replace('Space', 'SPACE')
      .replace('Slash', '/').replace('Tab', 'TAB');
  }
}
