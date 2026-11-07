#!/usr/bin/env python3
"""
Gravrust Complete Port - Port all remaining JS files to Rust
Run from Gravrust root directory
"""

import os
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(r"C:\Users\Nicholas\Documents\Downloads\New folder (5)\Gravrust")
SRC_ROOT = ROOT / "client" / "js"
RUST_SRC = ROOT / "rust" / "gravrust-core" / "src"

# Already ported (10 original request)
ALREADY_PORTED = {
    "client/js/webgl2.js", "client/js/webgpu.js", "client/js/browser.js",
    "client/js/main.js", "client/js/widgets.js", "client/js/sound.js",
    "client/js/protocol-1.15.2.js", "client/js/wasm/core.js",
    "client/js/entity-renderer.js", "client/js/options.js",
    "client/js/packed-bootstrap.js", "client/js/assets.js",
    "tools/build.js", "tools/make-offline.mjs", "offline-entry.js"
}

def find_all_js():
    """Find all JS files to port"""
    exclude_dirs = {"node_modules", "dist", "target", ".git", "rust"}
    js_files = []
    
    for root, dirs, files in os.walk("."):
        # Skip excluded directories
        dirs[:] = [d for d in dirs if d not in {"node_modules", "dist", "target", ".git", "rust"}]
        
        for f in files:
            if f.endswith(".js"):
                rel_path = os.path.relpath(os.path.join(root, f))
                rel_path = rel_path.replace("\\", "/")
                if not rel_path.startswith(("node_modules/", "dist/", "target/", ".git/", "rust/")):
                    yield rel_path

def get_port_categories():
    """Categorize files by priority"""
    all_js = set()
    for root, dirs, files in os.walk("."):
        dirs[:] = [d for d in dirs if d not in {"node_modules", "dist", "target", ".git", "rust"}]
        for f in files:
            if f.endswith(".js"):
                rel = os.path.relpath(os.path.join(root, f))
                if not rel.startswith(("node_modules/", "dist/", "target/", ".git/", "rust/")):
                    yield rel_path
    
    # Already ported
    already_ported = {
        "client/js/webgl2.js", "client/js/webgpu.js", "client/js/browser.js",
        "client/js/main.js", "client/js/widgets.js", "client/js/sound.js",
        "client/js/protocol-1.15.2.js", "client/js/wasm/core.js",
        "client/js/entity-renderer.js", "client/js/options.js",
        "client/js/packed-bootstrap.js", "client/js/assets.js",
        "tools/build.js", "tools/make-offline.mjs", "offline-entry.js"
    }
    
    # Collect all JS files
    all_js = set()
    for root, dirs, files in os.walk("."):
        dirs[:] = [d for d in dirs if d not in {"node_modules", "dist", "target", ".git", "rust"}]
        for f in files:
            if f.endswith(".js"):
                rel = os.path.relpath(os.path.join(root, f))
                if not rel.startswith(("node_modules/", "dist/", "target/", ".git/", "rust/")):
                    yield os.path.relpath(os.path.join(root, f)).replace("\\", "/")

def categorize_files():
    already_ported = {
        "client/js/webgl2.js", "client/js/webgpu.js", "client/js/browser.js",
        "client/js/main.js", "client/js/widgets.js", "client/js/sound.js",
        "client/js/protocol-1.15.2.js", "client/js/wasm/core.js",
        "client/js/entity-renderer.js", "client/js/options.js",
        "client/js/packed-bootstrap.js", "client/js/assets.js",
        "tools/build.js", "tools/make-offline.mjs", "offline-entry.js"
    }
    
    categories = {
        "core": [],      # game logic, physics, entities
        "render": [],    # rendering, shaders, mesher
        "gui": [],       # gui screens, widgets
        "net": [],       # networking
        "world": [],     # world, chunks, blocks
        "legacy": [],    # legacy client
        "other": []      # audio, util, lib, other
    }
    
    for root, dirs, files in os.walk("."):
        dirs[:] = [d for d in dirs if d not in {"node_modules", "dist", "target", ".git", "rust"}]
        for f in files:
            if f.endswith(".js"):
                rel = os.path.relpath(os.path.join(root, f))
                if rel in already_ported:
                    continue
                if not rel.startswith(("node_modules/", "dist/", "target/", ".git/", "rust/")):
                    rel = rel.replace("\\", "/")
                    if rel.startswith("client/js/game/") and not any(x in rel for x in ["menus-", "panda-", "signs-"]):
                        yield "core", os.path.relpath(os.path.join(root, f)).replace("\\", "/")
                    elif rel.startswith("client/js/render/"):
                        yield "render", os.path.relpath(os.path.join(root, f)).replace("\\", "/")
                    elif rel.startswith("client/js/gui/screens/") or (rel.startswith("client/js/gui/") and "i18n" not in rel):
                        yield "gui", os.path.relpath(os.path.join(root, f)).replace("\\", "/")
                    elif rel.startswith("client/js/net/"):
                        yield "net", os.path.relpath(os.path.join(root, f)).replace("\\", "/")
                    elif rel.startswith("client/js/world/"):
                        yield "world", os.path.relpath(os.path.join(root, f)).replace("\\", "/")
                    elif rel.startswith(("client/js/audio/", "client/js/util/", "client/js/lib/", "lib/")):
                        yield "other", os.path.relpath(os.path.join(root, f)).replace("\\", "/")
                    elif rel.startswith("legacy-client/"):
                        yield "legacy", os.path.relpath(os.path.join(root, f)).replace("\\", "/")
                    else:
                        yield "other", os.path.relpath(os.path.join(root, f)).replace("\\", "/")

def main():
    os.chdir(r"C:\Users\Nicholas\Documents\Downloads\New folder (5)\Gravrust")
    
    categories = {"core": [], "render": [], "gui": [], "net": [], "world": [], "legacy": [], "other": []}
    
    for cat, f in categorize_files():
        categories[cat].append(f)
    
    print("=== PORTING PLAN ===")
    for cat, files in categories.items():
        print(f"  {cat}: {len(files)} files")
        for f in sorted(files):
            print(f"    {f}")
    
    total = sum(len(v) for v in categories.values())
    print(f"\nTotal: {sum(len(v) for v in categories.values())} files to port")
    
    # Save manifest
    with open("port-manifest.json", "w") as f:
        json.dump({k: sorted(v) for k, v in categories.items()}, f, indent=2)

if __name__ == "__main__":
    main()