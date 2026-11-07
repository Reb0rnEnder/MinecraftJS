import WebSocket from 'ws';

const ws = new WebSocket('ws://localhost:25566/via');

ws.on('open', () => {
  console.log('Connected to WebSocket');
  // Send a test packet (Minecraft handshake)
  const buffer = Buffer.alloc(100);
  buffer.writeUInt8(0x00, 0); // Handshake packet ID
  // ... rest of handshake
  ws.send(buffer);
});

ws.on('message', (data) => {
  console.log('Received:', data.length, 'bytes');
  console.log('Data:', data.toString('hex'));
});

ws.on('error', (err) => {
  console.error('Error:', err.message);
});

ws.on('close', (code, reason) => {
  console.log('Closed:', code, reason.toString());
});

setTimeout(() => {
  ws.close();
  console.log('Test complete');
}, 5000);