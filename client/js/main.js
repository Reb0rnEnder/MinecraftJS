import {ResourceLoadingScreen} from './gui/screens/loading.js';
import {ShaderLibrary} from './render/shader-library.js';
// Gravrust boot: pick the platform + graphics device, load assets, then start at the title screen.
import { buildCrashReport, showCrashScreen } from './crash.js';
import { setPlatform, platform } from './platform/platform.js';
import { BrowserPlatform } from './platform/browser.js';
import { Assets } from './assets.js';
import { Settings } from './game/settings.js';
import { Game } from './game/game.js';
import { initRecipes } from './game/crafting.js';
import { TitleScreen } from './gui/screens/menus.js';
import { Splash } from './render/splash.js';
import { ProxyList } from './net/proxies.js';
import { parseAddress } from './net/address.js';

import * as wasmCore from './wasm/pkg/gravrust.js';
import { wasmBase64 } from './wasm/pkg/wasm-bytes.js';

async function boot() {
  // 1. Initialize Rust/WASM Core
  try {
    if (typeof wasmBase64 === 'string' && wasmBase64.length > 0 && typeof wasmCore.initSync === 'function') {
      const binStr = atob(wasmBase64);
      const wasmBytes = new Uint8Array(binStr.length);
      for (let i = 0; i < binStr.length; i++) wasmBytes[i] = binStr.charCodeAt(i);
      wasmCore.initSync({ module: wasmBytes });
      globalThis.gravrust = wasmCore;
      console.log('[Gravrust] Rust/WASM Core v' + wasmCore.core_version() + ' initialized (' + (wasmBytes.length / 1024).toFixed(1) + ' KB)');
    }
  } catch (err) {
    console.warn('[Gravrust] WASM core init warning:', err);
  }

  setPlatform(new BrowserPlatform());
  const P = platform();
  let config = {};
  try { config = P.loadConfig ? await P.loadConfig() : {}; } catch (e) { console.warn('Config unavailable', e); }
  const settings = new Settings(config);
  const proxies = new ProxyList(settings);
  try {
    const assets = new Assets();
    const device = await P.createGraphicsDevice(settings.graphicsApi);
    // Super Potato Mode: the setting, and always with the CPU rasteriser
    if (P.setPotato) P.setPotato(!!settings.superPotato || device.name === 'Software');
    assets.setDevice(device);
    assets.language = settings.language || 'en_us';
    try { await assets.activatePacks(settings.resourcePacks || []); } catch (e) { console.warn('Resource packs unavailable', e); }
    // Vanilla startup splash (Mojang logo on white) while everything loads
    const splash = new Splash(device, settings);
    await splash.load(await assets.readBytes('textures/gui/title/mojang.png').catch(() => null));
    splash.start();
    P.hideLoading();
    await assets.load((msg, pct) => { splash.setProgress(pct); console.log('[loading]', msg); });
    splash.stop();
    if (assets.data.recipes) initRecipes(assets.data.recipes);
    const game = new Game(assets, settings, device);
    game.proxies = proxies;
    game.shaderLibrary=new ShaderLibrary(game.shaderPack);
    try { await game.shaderLibrary.load(); } catch(e) { game.shaderPack.error=e.message; console.warn('Shader pack unavailable',e.message); }
    const title = new TitleScreen(game), loading = new ResourceLoadingScreen(game,title,{startup:true,progress:splash.progress});
    game.screens.open(loading);
    await loading.finish();
    globalThis.game = game; // debugging handle
    const params = P.launchParams ? P.launchParams() : {};
    if (params.connect) {
      const a = parseAddress(params.connect);
      if (a && a.kind === 'eagler') game.connect(params.connect, 0, params.user || null);
      else game.connect(a ? a.host : 'localhost', a ? a.port : 25565, params.user || null);
    } else {
      game.screens.open(title);
    }
  } catch (e) {
    console.error(e);
    P.setLoadingError('Failed to load: ' + e.message);
    showCrashScreen(buildCrashReport(e, 'Starting the game', globalThis.game || null));
  }
}

boot();
