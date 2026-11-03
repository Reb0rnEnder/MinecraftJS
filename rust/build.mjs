#!/usr/bin/env node
import { execFile } from 'child_process';
import fs from 'fs';
import path from 'path';

const ROOT = path.join(process.cwd(), 'rust');
const TARGET = 'wasm32-unknown-unknown';
const OUT_DIR = path.join(process.cwd(), 'client/js/wasm/pkg');

async function run() {
    // Build Rust to WASM
    await execFile('cargo', ['build', '--release', '--target', TARGET], { cwd: ROOT, stdio: 'inherit' });
    
    // wasm-bindgen
    await execFile('wasm-bindgen', [
        '--out-dir', OUT_DIR,
        '--target', 'web',
        '--no-typescript',
        path.join(ROOT, 'target', TARGET, 'release', 'gravrust.wasm')
    ], { stdio: 'inherit' });
    
    // Copy .wasm to lib/via for ViaProxy
    fs.copyFileSync(
        path.join(OUT_DIR, 'gravrust_bg.wasm'),
        path.join(process.cwd(), 'lib', 'via', 'gravrust_bg.wasm')
    );
    
    console.log('WASM build complete');
}

run().catch(e => { console.error(e); process.exit(1); });
