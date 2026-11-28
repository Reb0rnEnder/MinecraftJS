import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import WebSocket from 'ws';

import { cache, target, verify } from './port-1.21.11/prepare.mjs';
import { setPlatform } from '../client/js/platform/platform.js';
import { Assets } from '../client/js/assets.js';
import { NullDevice } from '../client/js/gfx/device.js';
import { Settings } from '../client/js/game/settings.js';
import { Game } from '../client/js/game/game.js';
import { initRecipes } from '../client/js/game/crafting.js';
import { ProxyList } from '../client/js/net/proxies.js';
import { C, PROTOCOL_VERSION } from '../client/js/net/packets.js';
import { PLAY_SCHEMA_774 } from '../client/js/net/play-schema-1.21.11.js';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const CLIENT_DIR = join(ROOT, 'client');
const MC_HOST = '127.0.0.1';
const MC_PORT = 25571;
const PROXY_PORT = 3011;
const USERNAME = 'PresentProbe';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function assertPortFree(port, host = '127.0.0.1') {
  const probe = createServer();
  await new Promise((resolvePromise, reject) => {
    probe.once('error', (err) => reject(new Error(`Port ${host}:${port} is not free: ${err.message}`)));
    probe.listen(port, host, resolvePromise);
  });
  await new Promise((resolvePromise) => probe.close(resolvePromise));
}

function offlineUuid(name) {
  const bytes = createHash('md5').update('OfflinePlayer:' + name).digest();
  bytes[6] = (bytes[6] & 0x0f) | 0x30;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20)].join('-');
}

class SocketEmitter {
  constructor() {
    this.handlers = {};
    this.pending = {};
  }
  on(ev, fn) {
    (this.handlers[ev] ||= []).push(fn);
    const pending = this.pending[ev];
    delete this.pending[ev];
    if (pending) for (const value of pending) fn(value);
  }
  emit(ev, value) {
    if (this.handlers[ev]?.length) {
      for (const fn of this.handlers[ev]) fn(value);
    } else {
      (this.pending[ev] ||= []).push(value);
    }
  }
}

function createHeadlessPlatform() {
  const listeners = {};
  const settingsStore = new Map();
  const fileStore = new Map();
  const activeSockets = new Set();
  const pendingFrames = new Set();
  let locked = false;

  return {
    name: 'node-headless-e2e',
    width: 854,
    height: 480,
    vsync: true,
    cpuCount: 2,
    on(ev, fn) { (listeners[ev] ||= []).push(fn); },
    emit(ev, val) { for (const fn of listeners[ev] || []) fn(val); },
    lockPointer() {
      if (locked) return;
      locked = true;
      this.emit('pointerlock', true);
    },
    unlockPointer() {
      if (!locked) return;
      locked = false;
      this.emit('pointerlock', false);
    },
    isPointerLocked() { return locked; },
    toggleFullscreen() {},
    isFullscreen() { return false; },
    setClipboard() {},
    loadSetting(key) { return settingsStore.has(key) ? settingsStore.get(key) : null; },
    saveSetting(key, value) { settingsStore.set(key, String(value)); },
    files: {
      async put(name, bytes) { fileStore.set(name, new Uint8Array(bytes)); },
      async get(name) { return fileStore.get(name) || null; },
      async list(prefix = '') { return [...fileStore.keys()].filter((k) => k.startsWith(prefix)); },
      async delete(name) { fileStore.delete(name); }
    },
    saveFile() {},
    openUrl() {},
    async fetchBytes(relPath) {
      const clean = String(relPath).split('?')[0].replace(/^\/+/, '');
      const full = resolve(CLIENT_DIR, clean);
      if (!full.startsWith(CLIENT_DIR + sep)) throw new Error('Path escape blocked: ' + relPath);
      try {
        return new Uint8Array(await readFile(full));
      } catch (err) {
        if (err.code === 'ENOENT') return null;
        throw err;
      }
    },
    async fetchText(relPath) {
      const bytes = await this.fetchBytes(relPath);
      return bytes ? Buffer.from(bytes).toString('utf8') : null;
    },
    async fetchJson(relPath) {
      const text = await this.fetchText(relPath);
      if (text === null) throw new Error(`Missing local asset ${relPath}`);
      return JSON.parse(text);
    },
    async postJson() {
      throw new Error('Unexpected remote auth request in offline E2E');
    },
    openSocket(url) {
      return new Promise((resolvePromise, reject) => {
        const ws = new WebSocket(url);
        ws.binaryType = 'arraybuffer';
        activeSockets.add(ws);
        let opened = false;
        const sock = new SocketEmitter();
        sock.sendText = (s) => { if (ws.readyState === WebSocket.OPEN) ws.send(s); };
        sock.sendBinary = (b) => { if (ws.readyState === WebSocket.OPEN) ws.send(b); };
        sock.close = () => {
          try { if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) ws.close(); } catch {}
        };
        ws.on('open', () => {
          opened = true;
          resolvePromise(sock);
        });
        ws.on('error', (err) => {
          if (!opened) reject(err instanceof Error ? err : new Error('Could not connect to ' + url));
        });
        ws.on('close', (code, reason) => {
          activeSockets.delete(ws);
          sock.emit('close', { code, reason: reason?.toString?.() || '' });
        });
        ws.on('message', (data, isBinary) => {
          if (!isBinary) sock.emit('text', data.toString('utf8'));
          else sock.emit('binary', new Uint8Array(data));
        });
      });
    },
    embeddedAssets() { return null; },
    now() { return performance.now(); },
    requestFrame(fn) {
      const id = setTimeout(() => {
        pendingFrames.delete(id);
        fn(performance.now());
      }, 16);
      pendingFrames.add(id);
    },
    createAudio() { return null; },
    createWorker() { return null; },
    setLoading() {},
    hideLoading() {},
    setTitle() {},
    closeAll() {
      for (const id of pendingFrames) clearTimeout(id);
      pendingFrames.clear();
      for (const ws of [...activeSockets]) {
        try { ws.terminate(); } catch {}
      }
      activeSockets.clear();
    }
  };
}

async function prepareFixtureServerDir() {
  const jar = join(cache, 'server.jar');
  verify(await readFile(jar), target.downloads.server, 'server.jar');
  const directory = join(cache, 'fixture-server');
  await mkdir(directory, { recursive: true });
  await writeFile(join(directory, 'eula.txt'), 'eula=true\n');
  await writeFile(
    join(directory, 'ops.json'),
    JSON.stringify([{ uuid: offlineUuid(USERNAME), name: USERNAME, level: 4, bypassesPlayerLimit: true }], null, 2) + '\n'
  );
  await writeFile(
    join(directory, 'server.properties'),
    [
      `server-ip=${MC_HOST}`,
      `server-port=${MC_PORT}`,
      'online-mode=false',
      'enforce-secure-profile=false',
      'spawn-protection=0',
      'view-distance=2',
      'simulation-distance=2',
      'difficulty=peaceful',
      'gamemode=survival',
      'allow-flight=true',
      'level-name=protocol-fixture',
      'level-type=minecraft:flat',
      'generator-settings={"layers":[{"block":"minecraft:bedrock","height":1},{"block":"minecraft:stone","height":2}],"biome":"minecraft:plains","structure_overrides":[]}',
      'initial-enabled-packs=vanilla',
      'motd=MCJS isolated 1.21.11 protocol fixture',
      ''
    ].join('\n')
  );
  return { jar, directory };
}

function startChildAndWait(cmd, args, opts, readyPattern, timeoutMs, label) {
  const child = spawn(cmd, args, opts);
  const logs = [];
  let readyResolved = false;
  let exitInfo = null;
  const exitPromise = new Promise((resolvePromise) => {
    child.once('exit', (code, signal) => {
      exitInfo = { code, signal };
      resolvePromise(exitInfo);
    });
  });

  const readyPromise = new Promise((resolvePromise, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} timed out waiting for readiness.\nLogs:\n${logs.join('')}`));
    }, timeoutMs);

    const onChunk = (chunk) => {
      const text = chunk.toString('utf8');
      logs.push(text);
      if (logs.length > 200) logs.shift();
      if (!readyResolved && readyPattern.test(logs.join(''))) {
        readyResolved = true;
        clearTimeout(timer);
        resolvePromise();
      }
    };

    child.stdout?.on('data', onChunk);
    child.stderr?.on('data', onChunk);
    child.once('error', (err) => {
      if (!readyResolved) {
        clearTimeout(timer);
        reject(new Error(`${label} failed to spawn: ${err.message}`));
      }
    });
    child.once('exit', (code, signal) => {
      if (!readyResolved) {
        clearTimeout(timer);
        reject(new Error(`${label} exited prematurely (code=${code}, signal=${signal}).\nLogs:\n${logs.join('')}`));
      }
    });
  });

  return { child, logs, exitPromise, readyPromise, get exitInfo() { return exitInfo; } };
}

async function stopChild(proc, { gracefulCommand = null, gracefulMs = 5000, termMs = 3000 } = {}) {
  if (!proc || proc.exitInfo) return;
  const { child, exitPromise } = proc;
  const waitExit = (ms) => Promise.race([exitPromise.then(() => true), sleep(ms).then(() => false)]);

  if (gracefulCommand && child.stdin?.writable) {
    try { child.stdin.write(gracefulCommand); } catch {}
    if (await waitExit(gracefulMs)) return;
  }
  if (!proc.exitInfo) {
    try { child.kill('SIGTERM'); } catch {}
    if (await waitExit(termMs)) return;
  }
  if (!proc.exitInfo) {
    try { child.kill('SIGKILL'); } catch {}
    await waitExit(2000);
  }
}

async function waitFor(predicate, timeoutMs, label, tickFn = null) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (tickFn) tickFn();
    const val = predicate();
    if (val) return val;
    await sleep(25);
  }
  throw new Error('Timed out waiting for: ' + label);
}

test('Live isolated 1.21.11 server + proxy + real Connection & Game E2E verification', { timeout: 120000 }, async (t) => {
  assert.equal(PROTOCOL_VERSION, 774);
  await assertPortFree(MC_PORT, MC_HOST);
  await assertPortFree(PROXY_PORT, MC_HOST);

  const { jar, directory } = await prepareFixtureServerDir();
  const headless = createHeadlessPlatform();
  setPlatform(headless);

  let mcServer = null;
  let proxyProc = null;
  let game = null;
  let intentionalClose = false;

  try {
    mcServer = startChildAndWait(
      process.env.JAVA || 'java',
      ['-Xms256M', '-Xmx512M', '-jar', jar, '--nogui'],
      { cwd: directory, stdio: ['pipe', 'pipe', 'pipe'] },
      /Done \([^)]+\)! For help, type "help"/,
      60000,
      'Mojang 1.21.11 server'
    );
    await mcServer.readyPromise;

    proxyProc = startChildAndWait(
      process.execPath,
      ['proxy.js'],
      {
        cwd: ROOT,
        env: { ...process.env, PORT: String(PROXY_PORT), ALLOW_LOOPBACK: '1' },
        stdio: ['ignore', 'pipe', 'pipe']
      },
      new RegExp(`MinecraftJS server running at http://localhost:${PROXY_PORT}`),
      15000,
      'MinecraftJS proxy.js'
    );
    await proxyProc.readyPromise;

    const assets = new Assets();
    const device = new NullDevice();
    device.resize(headless.width, headless.height);
    assets.setDevice(device);
    assets.preloadWorldTextures = false;
    assets.language = 'en_us';
    await assets.load();
    if (assets.data.recipes) initRecipes(assets.data.recipes);

    const settings = new Settings({
      proxies: [{ name: 'E2E Proxy', url: `ws://${MC_HOST}:${PROXY_PORT}`, type: 'minecraftjs' }],
      servers: [{ name: 'E2E Fixture', host: MC_HOST, port: MC_PORT }]
    });
    settings.renderDistance = 2;
    settings.simulationDistance = 2;
    settings.menuBackgroundBlur = 0;
    settings.tutorialStep = 'none';
    settings.username = USERNAME;
    new ProxyList(settings);

    game = new Game(assets, settings, device, { deferStart: true });

    const handlerErrors = [];
    const origHandlePacket = game.handlePacket.bind(game);
    const playPackets = {};
    game.handlePacket = (p) => {
      playPackets[p.name] = (playPackets[p.name] || 0) + 1;
      const h = game['on_' + p.name];
      if (h) {
        try { h.call(game, p); }
        catch (err) {
          handlerErrors.push({ packet: p.name, message: err?.stack || String(err) });
          throw err;
        }
      } else {
        origHandlePacket(p);
      }
    };

    const configPackets = {};
    let configResult = null;
    const decodeErrors = [];
    const controlErrors = [];
    const unexpectedDisconnects = [];

    await game.connect(MC_HOST, MC_PORT, USERNAME);
    const conn = game.conn;
    assert.ok(conn, 'Game.connect must create Connection');

    conn.on('configuration', (p) => {
      configPackets[p.name] = (configPackets[p.name] || 0) + 1;
    });
    conn.on('configuration_complete', (cfg) => {
      configResult = cfg;
    });
    conn.on('decode_error', (err) => {
      decodeErrors.push(err);
    });
    conn.on('control', (msg) => {
      if (msg.type === 'error' || msg.type === 'kicked') controlErrors.push(msg);
    });
    conn.on('close', (was) => {
      if (!intentionalClose) unexpectedDisconnects.push(was);
    });

    const checkNoFailures = () => {
      if (handlerErrors.length) throw new Error('Packet handler error: ' + JSON.stringify(handlerErrors[0]));
      if (decodeErrors.length) throw new Error('decode_error received: ' + JSON.stringify(decodeErrors[0]));
      if (controlErrors.length) throw new Error('Control error/kick: ' + JSON.stringify(controlErrors[0]));
      if (unexpectedDisconnects.length) throw new Error('Unexpected disconnect from state: ' + unexpectedDisconnects.join(','));
      if (game.crashed) throw new Error('Game crashed');
    };

    // 1. Wait for configuration + play entry + initial world/data packets
    await waitFor(() => {
      checkNoFailures();
      return (
        configResult &&
        game.inWorld &&
        game.doneLoadingTerrain &&
        game.world.chunks.size > 0 &&
        game.player.attributes?.size > 0 &&
        game.commands &&
        playPackets.login &&
        playPackets.position &&
        playPackets.update_attributes &&
        playPackets.map_chunk &&
        playPackets.declare_commands &&
        playPackets.declare_recipes &&
        playPackets.advancements &&
        playPackets.set_ticking_state &&
        playPackets.chunk_batch_finished
      );
    }, 35000, 'configuration and initial play state', () => game.tick());

    // Verify configuration state
    assert.ok(configPackets.select_known_packs >= 1, 'select_known_packs received');
    assert.ok(configPackets.registry_data >= 1, 'registry_data received');
    assert.ok(configPackets.tags >= 1, 'tags received');
    assert.ok(configPackets.finish_configuration >= 1, 'finish_configuration received');
    assert.deepEqual(configResult.selectedKnownPacks, [
      { namespace: 'minecraft', id: 'core', version: '1.21.11' }
    ]);
    assert.ok(configResult.cachedRegistryValues > 0, 'known pack omitted registry values cached');
    assert.ok(configResult.registries.get('minecraft:dimension_type')?.length > 0);
    assert.ok(configResult.registries.get('minecraft:worldgen/biome')?.length > 0);
    assert.ok(configResult.tags.size > 0);

    // Verify world chunks, biomes, block states, player spawn & attributes
    assert.equal(game.world.blockStateRegistrySize, PLAY_SCHEMA_774.blockStateCount);
    assert.ok(Number.isFinite(game.player.x) && Number.isFinite(game.player.y) && Number.isFinite(game.player.z));
    assert.ok(game.maxHealth > 0);
    assert.ok(game.player.speedAttr && game.player.speedAttr.base > 0);
    assert.ok(game.commands.nodes.length > 0);
    assert.ok(game.recipePropertySets instanceof Map && game.recipePropertySets.size > 0);
    assert.ok(game.advancements.map.size > 0, 'Expected advancements received on join');
    assert.equal(game.serverTickRate, 20);

    let nonEmptyChunks = 0;
    let totalNonAirBlocks = 0;
    let chunksWithBiomes = 0;
    for (const chunk of game.world.chunks.values()) {
      if (chunk.biomes && chunk.biomes.length > 0) chunksWithBiomes++;
      let chunkNonAir = 0;
      for (let sy = chunk.minSection; sy < chunk.maxSection; sy++) {
        const sec = chunk.getSection(sy);
        if (sec && sec.nonAir > 0) chunkNonAir += sec.nonAir;
      }
      if (chunkNonAir > 0) {
        nonEmptyChunks++;
        totalNonAirBlocks += chunkNonAir;
      }
    }
    assert.ok(nonEmptyChunks > 0, 'Expected non-empty loaded chunks');
    assert.ok(totalNonAirBlocks > 0, 'Expected non-air blocks in loaded chunks');
    assert.ok(chunksWithBiomes > 0, 'Expected loaded chunks with biomes');
    const bedrockDef = game.world.getBlockDef(Math.floor(game.player.x), -64, Math.floor(game.player.z));
    assert.equal(bedrockDef?.name, 'bedrock', 'Expected flat world bedrock layer at y=-64');

    // Close DownloadingTerrainScreen via game.tick() once standing chunk is loaded
    await waitFor(() => {
      checkNoFailures();
      return game.world.isLoaded(Math.floor(game.player.x), Math.floor(game.player.z)) && !game.screens.current;
    }, 10000, 'DownloadingTerrainScreen close and pointer lock', () => game.tick());
    assert.equal(game.input.locked, true, 'Game input should lock once DownloadingTerrainScreen closes');

    // 2. Test ping request/response
    const pingBefore = game.pingSamples.length;
    game.send(C.pingRequest(BigInt(Math.floor(headless.now()))));
    await waitFor(() => {
      checkNoFailures();
      return game.pingSamples.length > pingBefore;
    }, 5000, 'ping_response', () => game.tick());

    // 3. Test chat command (/say) + /summon (entities) + /fillbiome (chunk_biomes) + /give & inventory click
    const marker = 'e2e_probe_ok_' + Date.now();
    game.send(C.chat('/say ' + marker));
    await waitFor(() => {
      checkNoFailures();
      return game.hud.chat.some((entry) => entry.text.includes(marker));
    }, 5000, 'chat command echo', () => game.tick());

    const pigsBefore = [...game.entities.map.values()].filter((e) => e.entityName === 'pig').length;
    game.send(C.chat('/summon minecraft:pig ~2 ~ ~2'));
    await waitFor(() => {
      checkNoFailures();
      return [...game.entities.map.values()].filter((e) => e.entityName === 'pig').length > pigsBefore;
    }, 5000, 'summoned pig entity', () => game.tick());

    const chunkBiomesBefore = playPackets.chunk_biomes || 0;
    game.send(C.chat('/fillbiome ~-1 ~-1 ~-1 ~1 ~1 ~1 minecraft:desert'));
    await waitFor(() => {
      checkNoFailures();
      return (playPackets.chunk_biomes || 0) > chunkBiomesBefore;
    }, 5000, 'chunk_biomes update', () => game.tick());

    // Clear inventory first for idempotency across repeated E2E runs
    game.send(C.chat('/clear @s'));
    await waitFor(() => {
      checkNoFailures();
      return game.inventory.main.every((s) => !s);
    }, 5000, 'clear inventory before /give', () => game.tick());

    game.send(C.chat('/give @s minecraft:stone 4'));
    const stoneWindowSlot = await waitFor(() => {
      checkNoFailures();
      for (let i = 36; i < 45; i++) {
        const it = game.inventory.get(i);
        if (it && game.items.name(it.id) === 'stone') return i;
      }
      return null;
    }, 5000, 'set_slot stone in hotbar', () => game.tick());

    const destWindowSlot = stoneWindowSlot === 36 ? 37 : 36;
    const outBeforeClick = conn.packetsOut;
    game.inventory.click(stoneWindowSlot, 0, 0);
    assert.equal(game.items.name(game.inventory.cursor?.id), 'stone');
    game.inventory.click(destWindowSlot, 0, 0);
    assert.equal(game.inventory.cursor, null);
    assert.equal(game.items.name(game.inventory.get(destWindowSlot)?.id), 'stone');
    assert.ok(conn.packetsOut >= outBeforeClick + 2, 'inventory clicks sent window_click packets');
    for (let i = 0; i < 4; i++) {
      game.tick();
      await sleep(25);
      checkNoFailures();
    }
    assert.equal(game.items.name(game.inventory.get(destWindowSlot)?.id), 'stone');

    // 4. Tick game loop with movement input and verify player movement + packetsOut
    const startX = game.player.x;
    const startY = game.player.y;
    const startZ = game.player.z;
    const outBeforeMove = conn.packetsOut;
    const ticksBefore = game.ticks;

    headless.emit('keydown', { code: 'KeyW', key: 'w', repeat: false, ctrl: false, shift: false, alt: false });
    headless.emit('keydown', { code: 'Space', key: ' ', repeat: false, ctrl: false, shift: false, alt: false });
    for (let i = 0; i < 12; i++) {
      game.tick();
      await sleep(20);
      checkNoFailures();
    }
    headless.emit('keyup', { code: 'KeyW', key: 'w' });
    headless.emit('keyup', { code: 'Space', key: ' ' });
    for (let i = 0; i < 6; i++) {
      game.tick();
      await sleep(20);
      checkNoFailures();
    }

    const movedDist = Math.hypot(game.player.x - startX, game.player.y - startY, game.player.z - startZ);
    assert.ok(movedDist > 0.05, `Expected player to move after movement ticks, moved=${movedDist}`);
    assert.ok(game.ticks >= ticksBefore + 18, 'Game ticks advanced');
    assert.ok(conn.packetsOut > outBeforeMove, 'Movement ticks sent client packets');

    // Final stability checks
    checkNoFailures();
    assert.equal(decodeErrors.length, 0);
    assert.equal(controlErrors.length, 0);
    assert.equal(unexpectedDisconnects.length, 0);
    assert.equal(handlerErrors.length, 0);
    assert.equal(game.crashed, undefined);

    t.diagnostic(JSON.stringify({
      protocol: PROTOCOL_VERSION,
      username: game.username,
      entityId: game.entityId,
      loadedChunks: game.world.chunks.size,
      nonEmptyChunks,
      totalNonAirBlocks,
      chunksWithBiomes,
      entitiesCount: game.entities.map.size,
      commandNodes: game.commands.nodes.length,
      recipePropertySets: game.recipePropertySets.size,
      advancements: game.advancements.map.size,
      serverTickRate: game.serverTickRate,
      movedDist: Number(movedDist.toFixed(4)),
      packetsIn: conn.packetsIn,
      packetsOut: conn.packetsOut
    }));
  } finally {
    intentionalClose = true;
    try { game?.disconnect(true); } catch {}
    try {
      for (const w of assetsWorkerList(game)) w.terminate?.();
    } catch {}
    headless.closeAll();
    await Promise.allSettled([
      stopChild(proxyProc, { gracefulCommand: null, termMs: 3000 }),
      stopChild(mcServer, { gracefulCommand: 'stop\n', gracefulMs: 7000, termMs: 3000 })
    ]);
  }

  await assertPortFree(MC_PORT, MC_HOST);
  await assertPortFree(PROXY_PORT, MC_HOST);
});

function assetsWorkerList(game) {
  return game?.worker?.workers || [];
}
