import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import WebSocket, { WebSocketServer } from 'ws';
import { Connection } from '../client/js/net/connection.js';
import { Writer774, Reader774 } from '../client/js/net/configuration-1.21.11.js';
import {
  CONFIGURATION_CLIENTBOUND_774 as CI,
  CONFIGURATION_SERVERBOUND_774 as CO,
  PLAY_CLIENTBOUND_774 as PI
} from '../client/js/net/protocol-1.21.11-ids.js';
import { setPlatform } from '../client/js/platform/platform.js';
import { decodePlayBody774 } from '../client/js/net/play-codec-1.21.11.js';

test('real Eagler WebSocket transitions through native Configuration before exposing Play', { timeout: 10000 }, async () => {
  const server = new WebSocketServer({ host: '127.0.0.1', port: 0 });
  await once(server, 'listening');
  const received = [];
  const errors = [];
  const conn = new Connection();
  server.on('connection', (ws) => {
    let phase = 'handshake';
    ws.on('message', (bytes) => {
      const r = new Reader774(new Uint8Array(bytes));
      const id = r.u8();
      received.push({ phase, id, bytes });
      if (phase === 'handshake') {
        if (id === 1) ws.send(new Writer774().u8(2).u16(3).u16(774).u8(0).u8(0).u8(0).u16(0).build());
        if (id === 4) ws.send(new Writer774().u8(5).u8(7).raw(new TextEncoder().encode('Fixture')).uuid('12345678-1234-4234-8234-123456789abc').build());
        if (id === 8) {
          phase = 'configuration';
          ws.send(new Uint8Array([9]));
          ws.send(new Writer774().varint(CI.feature_flags).varint(1).string('minecraft:vanilla').build());
          ws.send(new Uint8Array([CI.finish_configuration]));
        }
      } else if (phase === 'configuration' && id === CO.finish_configuration) {
        phase = 'play';
        ws.send(new Writer774().varint(PI.update_health).f32(19).varint(18).f32(4).build());
      }
    });
  });
  setPlatform({
    openSocket: (url) => new Promise((resolve, reject) => {
      const ws = new WebSocket(url);
      const handlers = {};
      const emit = (event, value) => { for (const fn of handlers[event] || []) fn(value); };
      ws.on('error', reject);
      ws.on('message', (bytes, binary) => emit(binary ? 'binary' : 'text', binary ? new Uint8Array(bytes) : bytes.toString()));
      ws.on('close', () => emit('close'));
      ws.once('open', () => resolve({
        on(event, fn) { (handlers[event] ??= []).push(fn); },
        sendBinary: (bytes) => ws.send(bytes),
        sendText: (text) => ws.send(text),
        close: () => ws.close()
      }));
    })
  });
  try {
    const health = new Promise((resolve, reject) => {
      conn.on('packet', (packet) => { if (packet.name === 'update_health') resolve(packet); });
      conn.on('control', (message) => {
        if (message.type === 'error' || message.type === 'kicked') {
          errors.push(message);
          reject(Error(JSON.stringify(message)));
        }
      });
    });
    await conn.connect('ws://127.0.0.1:' + server.address().port, 0, 'Fixture');
    assert.equal((await health).health, 19);
    assert.equal(conn.state, 'play');
    assert.equal(conn.ws.configuration.features[0], 'minecraft:vanilla');
    const config = received.filter((p) => p.phase === 'configuration').map((p) => p.id);
    assert.deepEqual(config, [CO.custom_payload, CO.settings, CO.finish_configuration]);
    assert.deepEqual(errors, []);
    assert.equal(received.filter((p) => p.phase === 'handshake' && p.id === 3).length, 0, 'EaglerXServer already sends Login Acknowledged');
  } finally {
    conn.close();
    for (const ws of server.clients) ws.terminate();
    await new Promise((resolve) => server.close(resolve));
  }
});

test('Play custom payloads retain the remaining buffer rather than rejecting the native leaf type', () => {
  const p = decodePlayBody774('custom_payload', new Writer774().string('minecraft:brand').raw(new Uint8Array([1, 2, 3])).build());
  assert.equal(p.channel, 'minecraft:brand');
  assert.deepEqual([...p.data], [1, 2, 3]);
});
