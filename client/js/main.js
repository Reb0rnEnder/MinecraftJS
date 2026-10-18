// MinecraftJS boot: pick the platform + graphics device, load assets, then start at the title screen.
import { setPlatform, platform } from './platform/platform.js';
import { BrowserPlatform } from './platform/browser.js';
import { Assets } from './assets.js';
import { Settings } from './game/settings.js';
import { Game } from './game/game.js';
import { initRecipes } from './game/crafting.js';
import { TitleScreen } from './gui/screens/menus.js';
import { Splash } from './render/splash.js';

async function boot() {
  setPlatform(new BrowserPlatform());
  const P = platform();
  const settings = new Settings();
  const assets = new Assets();
  try {
    const device = await P.createGraphicsDevice(settings.graphicsApi);
    if ((device.name === 'WebGPU') !== (settings.graphicsApi === 'webgpu')) {
      settings.graphicsApi = device.name === 'WebGPU' ? 'webgpu' : 'webgl2';
      settings.save();
    }
    assets.setDevice(device);
    assets.language = settings.language || 'en_US';
    try { await assets.activatePacks(settings.resourcePacks || []); } catch (e) { console.warn('Resource packs unavailable', e); }
    // Vanilla startup splash (Mojang logo on white) while everything loads
    const splash = new Splash(device);
    await splash.load(await assets.readBytes('textures/gui/title/mojang.png').catch(() => null));
    splash.start();
    P.hideLoading();
    await assets.load((msg) => console.log('[loading]', msg));
    splash.stop();
    if (assets.data.recipes) initRecipes(assets.data.recipes);
    const game = new Game(assets, settings, device);
    globalThis.game = game; // debugging handle
    const params = P.launchParams ? P.launchParams() : {};
    if (params.connect) {
      const [host, port] = params.connect.split(':');
      game.connect(host || 'localhost', parseInt(port, 10) || 25565, params.user || null);
    } else {
      game.screens.open(new TitleScreen(game));
    }
  } catch (e) {
    console.error(e);
    P.setLoadingError('Failed to load: ' + e.message);
  }
}

boot();
