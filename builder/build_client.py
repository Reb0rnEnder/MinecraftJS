#!/usr/bin/env python3
"""
Gravrust Client Builder
Extracts assets from a Minecraft 1.15.2 client JAR, builds texture/model bundles,
and packages:
  1) output/gravrust-site.zip    <- complete static website for hosting
  2) output/gravrust-compact.html <- self-contained single-file offline client
"""

import os
import sys
import json
import base64
import struct
import shutil
import zipfile
import argparse

def parse_args():
    parser = argparse.ArgumentParser(description="Build Gravrust Client from Minecraft jar")
    parser.add_argument("--jar", required=True, help="Path to input client.jar")
    parser.add_argument("--client", required=True, help="Path to client directory with js/, data/, etc.")
    parser.add_argument("--out", required=True, help="Output directory for generated zip and html")
    parser.add_argument("--work", required=True, help="Working directory for building site")
    return parser.parse_args()

def collect_modules(entry_file, client_dir):
    visited = set()
    modules = {}

    def normalize(p):
        return os.path.normpath(p).replace('\\', '/')

    def collect(file_path):
        norm = normalize(file_path)
        if norm in visited:
            return
        visited.add(norm)
        
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            code = f.read()

        import_re = re.compile(r"""(?:import|from)\s+['"](\.[^'"]+)['"]""")
        for match in import_re.findall(code):
            target = os.path.normpath(os.path.join(os.path.dirname(file_path), match))
            if not target.endswith('.js') and not target.endswith('.mjs'):
                if os.path.exists(target + '.js'):
                    target += '.js'
            if os.path.exists(target):
                collect(target)

        rel_key = normalize(os.path.relpath(file_path, client_dir))
        modules[rel_key] = (file_path, code)

    collect(entry_file)

    rewritten_modules = {}
    import_replace_re = re.compile(r"""((?:import|from)\s+['"])(\.[^'"]+)(['"])""")

    for rel_key, (fpath, code) in modules.items():
        dir_path = os.path.dirname(fpath)
        def replace_fn(match):
            prefix = match.group(1)
            target = match.group(2)
            suffix = match.group(3)
            resolved = os.path.normpath(os.path.join(dir_path, target))
            if not resolved.endswith('.js') and not resolved.endswith('.mjs'):
                if os.path.exists(resolved + '.js'):
                    resolved += '.js'
            resolved_rel = normalize(os.path.relpath(resolved, client_dir))
            return f"{prefix}__MOD__{resolved_rel}{suffix}"

        rewritten = import_replace_re.sub(replace_fn, code)
        rewritten_modules[rel_key] = rewritten

    return rewritten_modules

import re

def build():
    args = parse_args()
    jar_path = os.path.abspath(args.jar)
    client_dir = os.path.abspath(args.client)
    out_dir = os.path.abspath(args.out)
    work_dir = os.path.abspath(args.work)
    site_dir = os.path.join(work_dir, 'site')

    os.makedirs(out_dir, exist_ok=True)
    if os.path.exists(site_dir):
        shutil.rmtree(site_dir)
    os.makedirs(site_dir, exist_ok=True)

    assets_dir = os.path.join(site_dir, 'assets')
    bundles_dir = os.path.join(assets_dir, 'bundles')
    os.makedirs(bundles_dir, exist_ok=True)

    print(f"[*] Reading JAR: {jar_path}")
    with zipfile.ZipFile(jar_path, 'r') as z:
        names = set(z.namelist())

        # 1. pack.mcmeta & pack.png
        if 'pack.mcmeta' in names:
            with open(os.path.join(assets_dir, 'pack.mcmeta'), 'wb') as f:
                f.write(z.read('pack.mcmeta'))
        if 'pack.png' in names:
            with open(os.path.join(assets_dir, 'pack.png'), 'wb') as f:
                f.write(z.read('pack.png'))

        # 2. Extract assets/minecraft/
        asset_count = 0
        asset_bytes = 0
        for name in names:
            if name.startswith('assets/'):
                if name.endswith('/'):
                    continue
                rel = name[len('assets/'):] # e.g. minecraft/textures/...
                dest_path = os.path.join(assets_dir, rel.replace('/', os.sep))
                os.makedirs(os.path.dirname(dest_path), exist_ok=True)
                data = z.read(name)
                with open(dest_path, 'wb') as f:
                    f.write(data)
                asset_count += 1
                asset_bytes += len(data)
        print(f"[*] Extracted {asset_count} assets ({round(asset_bytes / (1024*1024), 1)} MB)")

        # 3. Build bundles/models.json
        models_data = {"blockstates": {}, "models": {}}
        bs_prefix = 'assets/minecraft/blockstates/'
        md_prefix = 'assets/minecraft/models/'
        for name in names:
            if name.startswith(bs_prefix) and name.endswith('.json'):
                key = name[len(bs_prefix):-5]
                try:
                    models_data["blockstates"][key] = json.loads(z.read(name).decode('utf-8'))
                except Exception:
                    pass
            elif name.startswith(md_prefix) and name.endswith('.json'):
                key = name[len(md_prefix):-5]
                try:
                    models_data["models"][key] = json.loads(z.read(name).decode('utf-8'))
                except Exception:
                    pass
        models_json_bytes = json.dumps(models_data).encode('utf-8')
        with open(os.path.join(bundles_dir, 'models.json'), 'wb') as f:
            f.write(models_json_bytes)
        print(f"[*] Built bundles/models.json ({len(models_data['blockstates'])} blockstates, {len(models_data['models'])} models)")

        # 4. Build bundles/textures.bin
        tex_entries = []
        blobs = []
        mcmeta = {}
        offset = 0
        tex_prefixes = ['assets/minecraft/textures/block/', 'assets/minecraft/textures/item/']
        for name in sorted(names):
            for prefix in tex_prefixes:
                if name.startswith(prefix):
                    rel = name[len('assets/minecraft/textures/'):]
                    if name.endswith('.png'):
                        data = z.read(name)
                        key = rel[:-4]
                        tex_entries.append([key, offset, len(data)])
                        blobs.append(data)
                        offset += len(data)
                    elif name.endswith('.png.mcmeta'):
                        key = rel[:-11]
                        try:
                            mcmeta[key] = json.loads(z.read(name).decode('utf-8'))
                        except Exception:
                            pass
                    break

        header_bytes = json.dumps({"files": tex_entries, "mcmeta": mcmeta}).encode('utf-8')
        with open(os.path.join(bundles_dir, 'textures.bin'), 'wb') as f:
            f.write(struct.pack('<I', len(header_bytes)))
            f.write(header_bytes)
            for b in blobs:
                f.write(b)
        print(f"[*] Built bundles/textures.bin ({len(tex_entries)} textures)")

        # 5. Build bundles/recipes.json
        recipes = []
        rec_prefix = 'data/minecraft/recipes/'
        for name in sorted(names):
            if name.startswith(rec_prefix) and name.endswith('.json'):
                rec_name = name[len(rec_prefix):-5]
                try:
                    obj = json.loads(z.read(name).decode('utf-8'))
                    obj['name'] = rec_name
                    recipes.append(obj)
                except Exception:
                    pass
        if not recipes:
            # fallback to client/data/recipes.json if available
            fallback_recipes = os.path.join(client_dir, 'data', 'recipes.json')
            if os.path.exists(fallback_recipes):
                with open(fallback_recipes, 'r', encoding='utf-8') as f:
                    recipes = json.load(f)
        recipes.reverse()
        recipes_bytes = json.dumps(recipes).encode('utf-8')
        with open(os.path.join(bundles_dir, 'recipes.json'), 'wb') as f:
            f.write(recipes_bytes)
        print(f"[*] Built bundles/recipes.json ({len(recipes)} recipes)")

    # 6. Copy client files: data/, js/, index.html, style.css, favicons, config.json
    print("[*] Copying client web runtime...")
    shutil.copytree(os.path.join(client_dir, 'data'), os.path.join(site_dir, 'data'))
    shutil.copytree(os.path.join(client_dir, 'js'), os.path.join(site_dir, 'js'))
    
    for filename in ['index.html', 'style.css', 'favicon.ico', 'favicon.svg', 'apple-touch-icon.png']:
        src = os.path.join(client_dir, filename)
        if os.path.exists(src):
            shutil.copy2(src, os.path.join(site_dir, filename))

    config_path = os.path.join(site_dir, 'config.json')
    default_config = {
        "proxies": [
            { "name": "Local Via Relay", "url": "ws://localhost:8080", "type": "gravrust-via" },
            { "name": "Public Relay", "url": "wss://relay.deev.is:443", "type": "relay" }
        ],
        "servers": [
            { "name": "Local Server", "address": "localhost:25565" }
        ]
    }
    with open(config_path, 'w', encoding='utf-8') as f:
        json.dump(default_config, f, indent=2)

    # 7. Create output/gravrust-site.zip
    zip_out = os.path.join(out_dir, 'gravrust-site.zip')
    if os.path.exists(zip_out):
        os.remove(zip_out)
    print(f"[*] Creating {zip_out}...")
    with zipfile.ZipFile(zip_out, 'w', zipfile.ZIP_DEFLATED) as z:
        for root, dirs, files in os.walk(site_dir):
            for file in files:
                full_path = os.path.join(root, file)
                rel_path = os.path.relpath(full_path, site_dir).replace('\\', '/')
                z.write(full_path, rel_path)
    zip_size = os.path.getsize(zip_out)
    print(f"[+] Created gravrust-site.zip ({round(zip_size / (1024*1024), 2)} MB)")

    # 8. Create output/gravrust-compact.html (single-file offline client)
    compact_out = os.path.join(out_dir, 'gravrust-compact.html')
    print(f"[*] Packaging single-file offline client {compact_out}...")

    # A) Build in-memory asset zip
    # Contains: pack.mcmeta, pack.png, minecraft/**, bundles/**, data/**
    import io
    asset_zip_buf = io.BytesIO()
    with zipfile.ZipFile(asset_zip_buf, 'w', zipfile.ZIP_DEFLATED) as az:
        # add assets/ files
        for root, dirs, files in os.walk(assets_dir):
            for file in files:
                full_path = os.path.join(root, file)
                rel_path = os.path.relpath(full_path, assets_dir).replace('\\', '/')
                az.write(full_path, rel_path)
        # add data/ files
        data_dir = os.path.join(site_dir, 'data')
        for root, dirs, files in os.walk(data_dir):
            for file in files:
                full_path = os.path.join(root, file)
                rel_path = 'data/' + os.path.relpath(full_path, data_dir).replace('\\', '/')
                az.write(full_path, rel_path)
    asset_zip_bytes = asset_zip_buf.getvalue()
    asset_b64 = base64.b64encode(asset_zip_bytes).decode('ascii')

    # B) Collect all JS modules
    entry_file = os.path.join(client_dir, 'js', 'main.js')
    modules = collect_modules(entry_file, client_dir)

    # C) Inline CSS & favicons
    with open(os.path.join(client_dir, 'style.css'), 'r', encoding='utf-8') as f:
        css = f.read()

    fav_ico_b64 = ""
    ico_path = os.path.join(client_dir, 'favicon.ico')
    if os.path.exists(ico_path):
        with open(ico_path, 'rb') as f:
            fav_ico_b64 = base64.b64encode(f.read()).decode('ascii')

    compact_html = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Gravrust 1.15.2</title>
  <link rel="icon" type="image/x-icon" href="data:image/x-icon;base64,{fav_ico_b64}">
  <style>
{css}
  </style>
</head>
<body>
  <div id="loading">
    <div class="loading-box">
      <div class="loading-title">Gravrust 1.15.2</div>
      <div class="loading-track"><div id="loading-bar"></div></div>
      <div id="loading-text">Starting...</div>
    </div>
  </div>

  <script id="minecraftjs-config" type="application/json">
{json.dumps(default_config, indent=2)}
  </script>

  <script id="minecraftjs-assets" type="application/octet-stream" data-encoding="base64" data-bytes="{len(asset_zip_bytes)}">
{asset_b64}
  </script>

  <script type="module">
    const MODULES = {json.dumps(modules)};
    const blobUrls = {{}};

    // Create placeholder Blob URLs
    for (const key of Object.keys(MODULES)) {{
      blobUrls[key] = URL.createObjectURL(new Blob([], {{ type: 'application/javascript' }}));
    }}

    // Link modules to resolved Blob URLs
    for (const [key, code] of Object.entries(MODULES)) {{
      const finalCode = code.replace(/__MOD__([a-zA-Z0-9_\\-\\.\\/]+)/g, (_, mod) => blobUrls[mod] || mod);
      URL.revokeObjectURL(blobUrls[key]);
      blobUrls[key] = URL.createObjectURL(new Blob([finalCode], {{ type: 'application/javascript' }}));
    }}

    // Boot Gravrust
    import(blobUrls['js/main.js']).catch(e => {{
      console.error('Failed to boot Gravrust:', e);
      const t = document.getElementById('loading-text');
      if (t) {{ t.textContent = 'Boot error: ' + e.message; t.style.color = '#ff5555'; }}
    }});
  </script>
</body>
</html>
"""

    with open(compact_out, 'w', encoding='utf-8') as f:
        f.write(compact_html)
    compact_size = os.path.getsize(compact_out)
    print(f"[+] Created gravrust-compact.html ({round(compact_size / (1024*1024), 2)} MB)")

    print("[SUCCESS] All outputs generated successfully.")

if __name__ == '__main__':
    build()
