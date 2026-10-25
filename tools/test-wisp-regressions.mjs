import assert from 'node:assert/strict';
import {test} from 'node:test';
import net from 'node:net';
import {once} from 'node:events';
import WebSocket, {WebSocketServer} from 'ws';
import {BrowserPlatform} from '../client/js/platform/browser.js';
import {setPlatform} from '../client/js/platform/platform.js';
import {openStream} from '../client/js/net/tcp.js';
import {testProxy} from '../client/js/net/proxies.js';
import {wispUrl, wispPacket} from '../client/js/net/wisp.js';

globalThis.WebSocket = WebSocket;
const frame = (type, id, payload = []) => { const b = new Uint8Array(5 + payload.length); b[0] = type; new DataView(b.buffer).setUint32(1, id, true); b.set(payload, 5); return b; };
const credit = (id, n) => { const b = new Uint8Array(4); new DataView(b.buffer).setUint32(0, n, true); return frame(3, id, b); };
const wait = ms => new Promise(r => setTimeout(r, ms));
setPlatform({openSocket: BrowserPlatform.prototype.openSocket, now: () => performance.now()});
async function server(t, listener) {
  const wss = new WebSocketServer({host: '127.0.0.1', port: 0});
  await once(wss, 'listening');
  wss.on('connection', listener);
  t.after(async () => { for (const ws of wss.clients) ws.terminate(); await new Promise(r => wss.close(r)); });
  return `ws://127.0.0.1:${wss.address().port}/wisp`;
}

test('Wisp endpoint paths end in a slash without altering query credentials', () => {
  assert.equal(wispUrl('ws://localhost:8080/wisp?token=hello%20world'), 'ws://localhost:8080/wisp/?token=hello%20world');
  assert.equal(wispUrl('ws://localhost:8080'), 'ws://localhost:8080/');
  assert.equal(wispUrl('ws://localhost:8080/wisp/'), 'ws://localhost:8080/wisp/');
  assert.equal(wispPacket(credit(1, 0xffffffff)).credit, 0xffffffff);
  assert.equal(wispPacket(frame(3, 0)), null);
});

test('browser socket retains a server-first greeting until listener attachment', async t => {
  const url = await server(t, ws => ws.send(credit(0, 128)));
  const sock = await BrowserPlatform.prototype.openSocket(url);
  await wait(30); // Deliberately attach after the first frame was delivered.
  const received = [];
  sock.on('binary', b => received.push(b));
  assert.equal(received.length, 1);
  assert.equal(wispPacket(received[0]).credit, 128);
  sock.close();
});

test('Wisp v1 probe receives an immediate initial CONTINUE on a normalized path', async t => {
  const url = await server(t, (ws, req) => {
    assert.equal(req.url, '/wisp/');
    assert.equal(req.headers['sec-websocket-protocol'], undefined, 'v1 needs no v2 subprotocol');
    ws.send(credit(0, 128));
  });
  const result = await testProxy({type: 'wisp', url}, 1000);
  assert.equal(result.info?.version, 'v1', JSON.stringify(result));
});

test('DATA respects v1 credits, ignores other streams, resumes and stops after close', async t => {
  let peer; const packets = [];
  const url = await server(t, ws => { peer = ws; ws.on('message', b => packets.push(wispPacket(new Uint8Array(b)))); ws.send(credit(0, 1)); });
  const stream = await openStream({type: 'wisp', url}, '127.0.0.1', 25565);
  stream.write(new Uint8Array([10])); stream.write(new Uint8Array([20])); stream.write(new Uint8Array([30]));
  await wait(40);
  assert.deepEqual(packets.map(p => p.type), [1, 2]);
  assert.equal(new DataView(packets[0].payload.buffer, packets[0].payload.byteOffset).getUint16(1, true), 25565);
  peer.send(credit(2, 100)); peer.send(credit(0, 100)); peer.send(frame(3, 1));
  await wait(30); assert.equal(packets.length, 2);
  peer.send(credit(1, 2));
  await wait(30); assert.deepEqual(packets.filter(p => p.type === 2).map(p => [...p.payload]), [[10], [20], [30]]);
  const data = new Promise(resolve => stream.on('data', b => resolve([b])));
  peer.send(frame(2, 1, [40])); assert.deepEqual([...(await data)[0]], [40]);
  stream.close(); stream.write(new Uint8Array([50]));
  await wait(30); assert.equal(packets.filter(p => p.type === 4).length, 1); assert.equal(packets.filter(p => p.type === 2).length, 3);
});

test('Wisp close reasons survive an immediate server rejection', async t => {
  const url = await server(t, ws => { ws.send(credit(0, 1)); ws.send(frame(4, 1, [0x48])); });
  const stream = await openStream({type: 'wisp', url}, '127.0.0.1', 25565);
  await wait(30);
  const reason = await new Promise(resolve => stream.on('close', resolve));
  assert.equal(reason, 'Wisp: blocked by the Wisp server');
  stream.close();
});

test('closing before the greeting never invents credits or sends a delayed CONNECT', async t => {
  const packets = [];
  const url = await server(t, ws => ws.on('message', b => packets.push(b)));
  const stream = await openStream({type: 'wisp', url}, '127.0.0.1', 25565);
  stream.write(new Uint8Array([1])); stream.close();
  await wait(1600); assert.equal(packets.length, 0);
});

// Optional real-server interoperability: start wisp-python with --allow-loopback,
// then WISP_TEST_URL=ws://127.0.0.1:18888/wisp node tools/test-wisp-regressions.mjs.
test('wisp-python v1: probe and TCP transfer across several flow-control windows', {skip: !process.env.WISP_TEST_URL, timeout: 10000}, async t => {
  const echo = net.createServer(sock => sock.pipe(sock));
  echo.listen(0, '127.0.0.1'); await once(echo, 'listening');
  t.after(() => new Promise(r => echo.close(r)));
  const entry = {type: 'wisp', url: process.env.WISP_TEST_URL};
  const probe = await testProxy(entry, 2000); assert.equal(probe.info?.version, 'v1', JSON.stringify(probe));
  const stream = await openStream(entry, '127.0.0.1', echo.address().port);
  t.after(() => stream.close());
  const total = 600 * 1024, expected = Buffer.alloc(total);
  for (let i = 0; i < expected.length; i++) expected[i] = i % 251;
  const received = []; let size = 0;
  const done = new Promise((resolve, reject) => {
    stream.on('data', b => { received.push(b); size += b.length; if (size === total) resolve(); });
    stream.on('close', why => reject(new Error(why || 'premature close')));
  });
  for (let i = 0; i < 600; i++) stream.write(expected.subarray(i * 1024, (i + 1) * 1024));
  await done; assert.deepEqual(Buffer.concat(received), expected); stream.close();
});
