import assert from 'node:assert/strict';
import {test} from 'node:test';
import {setPlatform} from '../client/js/platform/platform.js';
import {VanillaSocket,openStream} from '../client/js/net/tcp.js';

const encode = (value) => new TextEncoder().encode(JSON.stringify(value));
let fetches = [];
let openedUrl = null;
setPlatform({
  now: () => 0,
  fetchBytes: async (url) => {
    fetches.push(url);
    return encode({Answer: [{type: 33, data: '0 5 25603 target.pksmp.test.'}]});
  },
  openSocket: async (url) => {
    openedUrl = url;
    return {on() {}, sendBinary() {}, close() {}};
  },
});

class CaptureSocket extends VanillaSocket {
  constructor() {
    super({type: 'relay', url: 'wss://relay.test'});
    this.endpoint = null;
    this.writes = [];
  }
  async _open(host, port) {
    this.endpoint = [host, port];
    this.stream = {write: (bytes) => this.writes.push(bytes), close() {}, on() {}};
  }
}

function varint(bytes, offset) {
  let value = 0, shift = 0, index = offset;
  for (;;) {
    const byte = bytes[index++];
    value |= (byte & 0x7f) << shift;
    if (!(byte & 0x80)) return [value, index];
    shift += 7;
  }
}

function handshake(bytes) {
  const array = Uint8Array.from(bytes);
  let [length, offset] = varint(array, 0);
  const body = array.subarray(offset, offset + length);
  let [id, p] = varint(body, 0);
  let [protocol, q] = varint(body, p);
  const [hostLength, h] = varint(body, q);
  const host = new TextDecoder().decode(body.subarray(h, h + hostLength));
  const port = (body[h + hostLength] << 8) | body[h + hostLength + 1];
  return {id, protocol, host, port};
}

test('default-port hostnames resolve SRV once and use that endpoint in the handshake', async () => {
  fetches = [];
  const socket = new CaptureSocket();
  await socket._connect({host: 'pksmp.test', port: 25565, protocol: 762, username: 'Probe'});
  assert.deepEqual(socket.endpoint, ['target.pksmp.test', 25603]);
  assert.equal(fetches.length, 1);
  assert.match(fetches[0], /_minecraft\._tcp\.pksmp\.test/);
  assert.deepEqual(handshake(socket.writes[0]), {id: 0, protocol: 762, host: 'target.pksmp.test', port: 25603});
});

test('an explicit non-default port is used as entered without an SRV lookup', async () => {
  fetches = [];
  const socket = new CaptureSocket();
  await socket._connect({host: 'play.example.test', port: 25603, protocol: 762, username: 'Probe'});
  assert.deepEqual(socket.endpoint, ['play.example.test', 25603]);
  assert.equal(fetches.length, 0);
  assert.deepEqual(handshake(socket.writes[0]), {id: 0, protocol: 762, host: 'play.example.test', port: 25603});
});

test('relay targets always carry the resolved port so every target port is explicit', async () => {
  openedUrl = null;
  const stream = await openStream({type: 'relay', url: 'wss://relay.test'}, 'target.pksmp.test', 25603);
  assert.equal(openedUrl, 'wss://relay.test/minecraft?target=target.pksmp.test%3A25603');
  stream.close();
});

test('status pings resolve SRV and use the same resolved endpoint', async () => {
  fetches = [];
  const socket = new CaptureSocket();
  await socket._ping({host: 'pksmp.test', port: 25565, protocol: 762, id: 7});
  assert.deepEqual(socket.endpoint, ['target.pksmp.test', 25603]);
  assert.deepEqual(handshake(socket.writes[0]), {id: 0, protocol: 762, host: 'target.pksmp.test', port: 25603});
});

test('when every DNS-over-HTTPS lookup fails the relay target leaves the default port off so the relay resolves SRV', async () => {
  const saved = fetches;
  setPlatform({now: () => 0, fetchBytes: async () => { throw new Error('blocked'); }, openSocket: async (url) => { openedUrl = url; return {on() {}, sendBinary() {}, close() {}}; }});
  const socket = new VanillaSocket({type: 'relay', url: 'wss://relay.test'});
  const {host, port} = await socket._resolveEndpoint('pksmp.test', 25565);
  assert.deepEqual([host, port, socket.srvLookupFailed], ['pksmp.test', 25565, true]);
  openedUrl = null;
  const stream = await openStream({type: 'relay', url: 'wss://relay.test'}, host, port, {relayResolvesSrv: true});
  assert.equal(openedUrl, 'wss://relay.test/minecraft?target=pksmp.test');
  stream.close();
  fetches = saved;
});
