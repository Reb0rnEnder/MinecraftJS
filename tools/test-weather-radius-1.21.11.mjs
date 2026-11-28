import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initBlocks, blocksByName } from '../client/js/world/blocks.js';
import { initBiomes } from '../client/js/world/biomes.js';
import { Weather } from '../client/js/render/weather.js';
import { FORMAT } from '../client/js/gfx/device.js';
import { JavaRandom } from '../client/js/util/jrandom.js';

// Pinned 1.21.11 WeatherEffectRenderer (hpt): render radius is the weather option,
// splash attempts = (int)(0.225F * (2R+1)^2 * rain * rain), then integer / 2
// for decreased particles. Minimal stops at the first valid sound location.
const json = name => JSON.parse(readFileSync(new URL('../client/data/' + name + '.json', import.meta.url), 'utf8'));
const shapes = json('blockCollisionShapes'), biomes = json('biomes');
initBlocks(json('blocks'), shapes);
initBiomes(biomes, null, null);
const plains = biomes.find(b => b.name === 'plains').id;
const snow = biomes.find(b => b.name === 'snowy_plains').id;
const stone = blocksByName.stone.defaultState;
const camera = [12.5, 65.62, -8.5];

function fixture({ radius = 10, fancy = false, fabulous = false, particles = 0, rain = 1, biome = plains } = {}) {
  const splashes = [], sounds = [], samples = [];
  const section = { nonAir: 4096, get: () => stone };
  const chunk = { getSection: sy => sy < 4 ? section : null };
  const game = {
    settings: { weatherRadius: radius, fancyGraphics: fancy, fabulousGraphics: fabulous, particles },
    inWorld: true,
    assets: { data: { blockCollisionShapes: shapes }, texture: () => ({}) },
    device: { createMesh: () => ({}), updateMesh(mesh, data) { mesh.data = data.slice(); } },
    renderer: { extraDraws: [], camPos: camera },
    player: { x: 1000, y: 64, z: 1000 },
    sound: { play: (...args) => sounds.push(args) },
    particles: { rain: (...args) => splashes.push(args), smoke() { assert.fail('stone must splash'); } },
    world: {
      minY: 0, minSection: 0, maxSection: 16, rainStrength: rain,
      getChunk: () => chunk,
      getState: (x, y, z) => y < 64 ? stone : 0,
      getBiome(x, z, y) { samples.push([x, y, z]); return biome; },
      getSkyLight: () => 15, getBlockLight: () => 0,
    },
  };
  return { game, weather: new Weather(game), splashes, sounds, samples };
}

const graphics = [
  { fancy: false, fabulous: false },
  { fancy: true, fabulous: false },
  { fancy: false, fabulous: true },
];

for (const radius of [3, 10]) {
  test(`radius ${radius}: actual rain/snow meshes and draws ignore graphics mode`, () => {
    for (const biome of [plains, snow]) {
      let baseline;
      for (const mode of graphics) {
        const { weather, samples, game } = fixture({ radius, biome, ...mode });
        weather.render(0.25, ...camera);
        const layer = weather.layers[biome === plains ? 'rain' : 'snow'];
        assert.equal(samples.length, (2 * radius + 1) ** 2);
        assert.equal(layer.count, (2 * radius + 1) ** 2 - 1, 'native degenerate camera column is omitted');
        assert.equal(layer.mesh.data.length, layer.count * 4 * FORMAT.lit.stride);
        for (const [x, y, z] of samples) {
          assert.ok(Math.abs(x - Math.floor(camera[0])) <= radius);
          assert.ok(Math.abs(z - Math.floor(camera[2])) <= radius);
          assert.equal(y, Math.floor(camera[1]));
        }
        const data = layer.mesh.data, stride = FORMAT.lit.stride;
        const ys = Array.from({ length: data.length / stride }, (_, i) => data[i * stride + 1]);
        assert.equal(Math.min(...ys), Math.max(64, Math.floor(camera[1]) - radius));
        assert.equal(Math.max(...ys), Math.floor(camera[1]) + radius);
        const draws = [];
        weather.draw({ draw: args => draws.push(args) });
        assert.equal(draws.length, 1);
        assert.equal(draws[0].count, layer.count * 6);
        assert.equal(draws[0].mesh, layer.mesh);
        if (baseline) assert.deepEqual(data, baseline);
        else baseline = data;
        // Changing the option reaches an existing Weather instance, without a restart.
        game.settings.weatherRadius = radius === 3 ? 10 : 3;
        weather.render(0.25, ...camera);
        assert.equal(layer.count, (2 * game.settings.weatherRadius + 1) ** 2 - 1);
      }
    }
  });

  test(`radius ${radius}: actual splash consumer uses native attempts, integer reductions and option-sized offsets`, () => {
    const fullCount = radius === 3 ? 11 : 99;
    for (const particles of [0, 1, 2]) {
      let baseline;
      for (const mode of graphics) {
        const { weather, splashes, sounds, samples } = fixture({ radius, particles, ...mode });
        weather.updateCount = 7;
        weather.rainSoundCounter = 3;
        weather._rainParticles();
        const count = particles === 0 ? fullCount : particles === 1 ? Math.floor(fullCount / 2) : 0;
        assert.equal(splashes.length, count);
        assert.equal(samples.length, particles === 2 ? 1 : count);
        assert.equal(sounds.length, 1, 'minimal particles must still select a rain sound');
        const random = new JavaRandom(7n * 312987231n);
        for (const sample of samples) {
          assert.deepEqual(sample, [
            Math.floor(camera[0]) + random.nextInt(2 * radius + 1) - radius,
            64,
            Math.floor(camera[2]) + random.nextInt(2 * radius + 1) - radius,
          ], 'native seeded offsets must use this radius, not just fall within it');
          if (particles !== 2) { random.nextDouble(); random.nextDouble(); }
        }
        for (const [x, y, z] of samples) {
          assert.ok(Math.abs(x - Math.floor(camera[0])) <= radius);
          assert.ok(Math.abs(z - Math.floor(camera[2])) <= radius);
          assert.equal(y, 64);
        }
        for (const [x, y, z] of splashes) {
          assert.equal(y, 64);
          assert.ok(Math.abs(Math.floor(x) - Math.floor(camera[0])) <= radius);
          assert.ok(Math.abs(Math.floor(z) - Math.floor(camera[2])) <= radius);
        }
        const result = { splashes, sounds, samples };
        if (baseline) assert.deepEqual(result, baseline);
        else baseline = result;
      }
    }
  });
}

test('splash density uses native left-to-right float products and no attempts when dry', () => {
  // Values immediately around integer count boundaries exercise the float cast before truncation.
  for (const radius of [3, 10]) for (const rain of [0, 0.5, Math.sqrt(10 / (0.225 * (2 * radius + 1) ** 2)), 1]) {
    const f = Math.fround;
    let attempts = f(f(0.225) * (2 * radius + 1) ** 2);
    attempts = f(attempts * f(rain));
    attempts = Math.trunc(f(attempts * f(rain)));
    for (const particles of [0, 1]) {
      const { weather, splashes } = fixture({ radius, rain, particles });
      weather._rainParticles();
      assert.equal(splashes.length, particles === 1 ? Math.floor(attempts / 2) : attempts);
    }
  }
});

test('Weather Effect Radius slider displays native block units, not chunks', () => {
  const source = readFileSync(new URL('../client/js/gui/screens/options.js', import.meta.url), 'utf8');
  const row = source.split('\n').find(line => line.includes("key: 'options.weatherRadius'"));
  assert.match(row, /tr\('options\.blocks', \[Math\.round\(3\+v\*7\)\]\)/);
  assert.doesNotMatch(row, /chunks/);
});
