#!/usr/bin/env node
// Simple HTTP server for serving the offline client
// Handles large files with proper headers and range requests

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = 8080;
const ROOT = __dirname;

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.wasm': 'application/wasm',
  '.json': 'application/json',
  '.txt': 'text/plain',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.zip': 'application/zip',
  '.gz': 'application/gzip',
};

function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return MIME_TYPES[ext] || 'application/octet-stream';
}

function sendFile(res, filePath, req) {
  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const range = req.headers.range;
  
  const mimeType = getMimeType(filePath);
  
  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunkSize = (end - start) + 1;
    
    const file = fs.createReadStream(filePath, { start, end });
    const head = {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunkSize,
      'Content-Type': mimeType,
      'Content-Disposition': 'inline',
      'Cache-Control': 'public, max-age=31536000',
      'Access-Control-Allow-Origin': '*',
    };
    
    const resStream = file.pipe(res);
    res.writeHead(206, head);
    return resStream;
  } else {
    const head = {
      'Content-Length': fileSize,
      'Content-Type': mimeType,
      'Content-Disposition': 'inline',
      'Cache-Control': 'public, max-age=31536000',
      'Access-Control-Allow-Origin': '*',
      'Accept-Ranges': 'bytes',
    };
    res.writeHead(200, head);
    fs.createReadStream(filePath).pipe(res);
  }
}

const server = http.createServer((req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }
  
  const parsedUrl = url.parse(req.url, true);
  let pathname = path.join(__dirname, decodeURIComponent(parsedUrl.pathname));
  
  // Security: prevent directory traversal
  const resolvedPath = path.resolve(pathname);
  if (!resolvedPath.startsWith(path.resolve(__dirname))) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }
  
  // Handle root - serve index.html
  if (req.url === '/' || req.url === '') {
    const indexPath = path.join(__dirname, 'dist', 'minecraftjs.html');
    if (fs.existsSync(indexPath)) {
      return sendFile(res, indexPath, req);
    }
  }
  
  // Try to serve the requested file
  if (fs.existsSync(pathname) && fs.statSync(pathname).isFile()) {
    return sendFile(res, pathname, req);
  }
  
  // Try dist folder
  const distPath = path.join(__dirname, 'dist', pathname);
  if (fs.existsSync(distPath) && fs.statSync(distPath).isFile()) {
    return sendFile(res, distPath, req);
  }
  
  // Try root
  const rootPath = path.join(__dirname, pathname);
  if (fs.existsSync(rootPath) && fs.statSync(rootPath).isFile()) {
    return sendFile(res, rootPath, req);
  }
  
  // 404
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('File not found');
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running at http://0.0.0.0:${PORT}/`);
  console.log(`Serving files from: ${__dirname}`);
  console.log('');
  console.log('Available files:');
  console.log('  http://localhost:8080/              -> dist/minecraftjs.html (full client)');
  console.log('  http://localhost:8080/offlineclient.html (lightweight core test)');
  console.log('');
  console.log('Share the Cloudflare tunnel URL with others to play from anywhere!');
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use.`);
    process.exit(1);
  }
  throw err;
});