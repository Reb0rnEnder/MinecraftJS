#!/usr/bin/env python3
"""Honest Rust-vs-JS audit. Reports what the shipped client actually executes.

  python tools/audit_rust_port.py [--max-js-files N]   (exit 1 if more JS files than N remain)

A module counts as "ported" only when game code calls into the WASM module. A Rust file existing with a matching
name does not count. parity-matrix.csv is NOT used as evidence.
"""
import argparse, glob, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
JS_DIR = os.path.join(ROOT, 'client', 'js')
PKG = os.path.join(JS_DIR, 'wasm', 'pkg')

def read(p):
    with open(p, encoding='utf-8', errors='ignore') as f:
        return f.read()

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--max-js-files', type=int, default=None)
    a = ap.parse_args()

    game = [p for p in glob.glob(os.path.join(JS_DIR, '**', '*.js'), recursive=True)
            if os.sep + 'wasm' + os.sep not in p]
    lines = sum(read(p).count('\n') + 1 for p in game)
    src = {p: read(p) for p in game}

    glue = os.path.join(PKG, 'gravrust.js')
    exports = set(re.findall(r'^export (?:function|class|const) (\w+)', read(glue), re.M)) if os.path.exists(glue) else set()
    wasm = os.path.join(PKG, 'gravrust_bg.wasm')
    wasm_kb = os.path.getsize(wasm) / 1024 if os.path.exists(wasm) else 0

    # Real use = a call through the wasm namespace (globalThis.gravrust.X / wasmCore.X / import {X} from wasm pkg)
    used = {}
    for p, t in src.items():
        for m in re.finditer(r'(?:gravrust|wasmCore)\.(\w+)', t):
            if m.group(1) in exports:
                used.setdefault(m.group(1), set()).add(os.path.relpath(p, JS_DIR))
        for m in re.finditer(r"import\s*\{([^}]+)\}\s*from\s*'[^']*wasm/pkg/[^']*'", t):
            for n in m.group(1).split(','):
                n = n.strip().split(' as ')[0]
                if n in exports:
                    used.setdefault(n, set()).add(os.path.relpath(p, JS_DIR))
    used.pop('initSync', None); used.pop('core_version', None); used.pop('default', None)

    print('Gravrust Rust-port audit')
    print('  Game JavaScript modules : %d files, %d lines' % (len(game), lines))
    print('  Rust/WASM binary        : %.0f KB, %d exported items' % (wasm_kb, len(exports)))
    print('  WASM exports called by game JS: %d' % len(used))
    for n in sorted(used):
        print('     - %s  (from %s)' % (n, ', '.join(sorted(used[n]))))
    if not used:
        print('  => The running game executes JavaScript only; the WASM core is loaded but unused.')
    if a.max_js_files is not None and len(game) > a.max_js_files:
        print('FAIL: %d JS modules remain (limit %d)' % (len(game), a.max_js_files))
        sys.exit(1)

if __name__ == '__main__':
    main()
