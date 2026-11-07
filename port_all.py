#!/usr/bin/env python3
"""Gravrust Complete Port - Port all remaining JS files to Rust"""
import os
import subprocess
import json
from pathlib import Path

ROOT = Path(r"C:\Users\Nicholas\Documents\Downloads\New folder (5)\Gravrust")

# Already ported (the original 10 files + old build files)
ALREADY_PORTED = {
    "client/js/webgl2.js", "client/js/webgpu.js", "client/js/browser.js",
    "client/js/main.js", "client/js/widgets.js", "client/js/sound.js",
    "client/js/protocol-1.15.2.js", "client/js/wasm/core.js",
    "client/js/entity-renderer.js", "client/js/options.js",
    "client/js/packed-bootstrap.js", "client/js/assets.js",
    "tools/build.js", "tools/make-offline.mjs", "offline-entry.js"
}

def get_all_js_files():
    """Get all JS files in git that need porting"""
    result = subprocess.run(["git", "ls-files", "*.js"], cwd="Gravrust", capture_output=True, text=True)
    files = result.stdout.strip().split("\n")
    return [f for f in files if f and not f.startswith("rust/")]

def categorize_files(files):
    """Categorize files by priority"""
    categories = {
        "core": [],      # game logic, physics, entities
        "render": [],    # rendering, shaders, mesher
        "gui": [],       # gui screens, widgets
        "net": [],       # networking
        "world": [],     # world, chunks, blocks
        "legacy": [],    # legacy client
        "other": []      # audio, util, lib, other
    }
    
    already_ported = {
        "client/js/webgl2.js", "client/js/webgpu.js", "client/js/browser.js",
        "client/js/main.js", "client/js/widgets.js", "client/js/sound.js",
        "client/js/protocol-1.15.2.js", "client/js/wasm/core.js",
        "client/js/entity-renderer.js", "client/js/options.js",
        "client/js/packed-bootstrap.js", "client/js/assets.js",
        "tools/build.js", "tools/make-offline.mjs", "offline-entry.js"
    }
    
    for f in sorted(files):
        if f in already_ported:
            continue
        if f.startswith("client/js/game/") and not any(x in f for x in ["menus-", "panda-", "signs-"]):
            yield "core", f
        elif f.startswith("client/js/render/"):
            yield "render", f
        elif f.startswith("client/js/gui/screens/") or (f.startswith("client/js/gui/") and "i18n" not in f):
            yield "gui", f
        elif f.startswith("client/js/net/"):
            yield "net", f
        elif f.startswith("client/js/world/"):
            yield "world", f
        elif f.startswith("legacy-client/"):
            yield "legacy", f
        elif f.startswith(("client/js/audio/", "client/js/util/", "client/js/lib/", "lib/", "client/js/debug/")):
            yield "other", f
        else:
            yield "other", f

def main():
    os.chdir(r"C:\Users\Nicholas\Documents\Downloads\New folder (5)\Gravrust")
    
    # Get all JS files in git
    result = subprocess.run(["git", "ls-files", "*.js"], capture_output=True, text=True, cwd=r"C:\Users\Nicholas\Documents\Downloads\New folder (5)\Gravrust")
    files = [f for f in result.stdout.strip().split("\n") if f]
    
    already_ported = {
        "client/js/webgl2.js", "client/js/webgpu.js", "client/js/browser.js",
        "client/js/main.js", "client/js/widgets.js", "client/js/sound.js",
        "client/js/protocol-1.15.2.js", "client/js/wasm/core.js",
        "client/js/entity-renderer.js", "client/js/options.js",
        "client/js/packed-bootstrap.js", "client/js/assets.js",
        "tools/build.js", "tools/make-offline.mjs", "offline-entry.js"
    }
    
    to_port = [f for f in sorted(set(files)) if f not in already_ported]
    
    print(f"Total JS files to port: {len(to_port)}")
    for f in to_port:
        print(f)
    
    return to_port

if __name__ == "__main__":
    to_port = main()
    print(f"\nTotal files to port: {len(to_port)}")