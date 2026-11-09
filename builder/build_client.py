#!/usr/bin/env python3
"""
Gravrust Client Builder
Extracts assets from a Minecraft 1.15.2 client JAR, builds texture/model bundles,
and packages:
  1) output/gravrust-site.zip     <- complete static website for hosting
  2) output/gravrust-compact.html <- self-contained single-file offline client (zero-blob, zero-fetch)
"""

import os
import sys
import re
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

def transform_module_to_cjs(code, rel_path, root_dir):
    dir_path = os.path.dirname(os.path.join(root_dir, rel_path))

    def resolve_specifier(spec):
        target = os.path.normpath(os.path.join(dir_path, spec))
        if not target.endswith('.js') and not target.endswith('.mjs'):
            if os.path.exists(target + '.js'):
                target += '.js'
        rel = os.path.normpath(os.path.relpath(target, root_dir)).replace('\\', '/')
        return rel

    # Replace import.meta
    code = code.replace("import.meta.url", "(typeof document !== 'undefined' ? document.baseURI : '')")
    code = code.replace("import.meta", "({ url: (typeof document !== 'undefined' ? document.baseURI : '') })")

    # Dynamic import(...) expressions -> Promise.resolve(__require(...))
    def replace_dyn_import(m):
        spec = m.group(1)
        mod_id = resolve_specifier(spec)
        return f"Promise.resolve(__require('{mod_id}'))"

    code = re.sub(r"""import\s*\(\s*['"]([^'"]+)['"]\s*\)""", replace_dyn_import, code)

    # Static import statements
    def replace_static_import(m):
        star = m.group(1)
        named1 = m.group(2)
        default_name = m.group(3)
        named2 = m.group(4)
        spec = m.group(5)
        mod_id = resolve_specifier(spec)

        stmts = []
        if star:
            name = star.split()[-1]
            stmts.append(f"const {name} = __require('{mod_id}');")
        if default_name:
            stmts.append(f"const {default_name} = __require('{mod_id}').default || __require('{mod_id}');")
        named = named1 or named2
        if named:
            parts = []
            for p in named.split(','):
                p = p.strip()
                if not p:
                    continue
                if ' as ' in p:
                    src, dst = p.split(' as ')
                    parts.append(f"{src.strip()}: {dst.strip()}")
                else:
                    parts.append(p)
            if parts:
                stmts.append(f"const {{ {', '.join(parts)} }} = __require('{mod_id}');")
        return '\n'.join(stmts)

    code = re.sub(
        r"""import\s*(?:(\*\s*as\s+\w+)|(?:\{([^}]+)\})|(\w+)(?:\s*,\s*\{([^}]+)\})?)\s*from\s*['"]([^'"]+)['"];?""",
        replace_static_import,
        code,
        flags=re.DOTALL
    )

    # Bare imports
    def replace_bare_import(m):
        mod_id = resolve_specifier(m.group(1))
        return f"__require('{mod_id}');"

    code = re.sub(
        r"""import\s+['"]([^'"]+)['"];?""",
        replace_bare_import,
        code
    )

    lines = code.split('\n')
    out_lines = []
    getters = []  # live-binding export getters, emitted at top of module
    def add_getter(name, local=None):
        local = local or name
        getters.append(f"Object.defineProperty(exports, '{name}', {{ enumerable: true, configurable: true, get: function() {{ return {local}; }} }});")
    i = 0
    while i < len(lines):
        line = lines[i]
        stripped = line.strip()

        # export default ...
        if stripped.startswith('export default '):
            expr = stripped[len('export default '):].rstrip(';')
            if expr.startswith('function ') or expr.startswith('async function '):
                m_fn = re.match(r"""^(async\s+)?function(?:\s+([a-zA-Z0-9_$]+))?\s*\(""", expr)
                if m_fn and m_fn.group(2):
                    fn_name = m_fn.group(2)
                    out_lines.append(expr); add_getter("default", fn_name)
                else:
                    out_lines.append(f"exports.default = {expr};")
            elif expr.startswith('class ') or expr.startswith('class{'):
                m_cl = re.match(r"""^class(?:\s+([a-zA-Z0-9_$]+))?""", expr)
                if m_cl and m_cl.group(1):
                    cl_name = m_cl.group(1)
                    out_lines.append(expr); add_getter("default", cl_name)
                else:
                    out_lines.append(f"exports.default = {expr};")
            else:
                out_lines.append(f"exports.default = {expr};")
            i += 1
            continue

        # export function / async function
        m_fn_exp = re.match(r"""^export\s+(async\s+)?function\s+([a-zA-Z0-9_$]+)""", stripped)
        if m_fn_exp:
            fn_name = m_fn_exp.group(2)
            clean_line = stripped[len('export '):]
            add_getter(fn_name); out_lines.append(clean_line)
            i += 1
            continue

        # export class
        m_cl_exp = re.match(r"""^export\s+class\s+([a-zA-Z0-9_$]+)""", stripped)
        if m_cl_exp:
            cl_name = m_cl_exp.group(1)
            clean_line = stripped[len('export '):]
            out_lines.append(clean_line); add_getter(cl_name)
            i += 1
            continue

        # export const / let / var
        m_var_exp = re.match(r"""^export\s+(const|let|var)\s+([^=;]+)""", stripped)
        if m_var_exp:
            clean_line = stripped[len('export '):]
            var_names = m_var_exp.group(2).strip()
            exports_stmts = []
            for v in var_names.split(','):
                vn = v.strip().split('=')[0].strip()
                if re.match(r'^[a-zA-Z0-9_$]+$', vn):
                    add_getter(vn)
            out_lines.append(clean_line)
            i += 1
            continue

        # export { a, b as c } [from '...']
        m_exp_named = re.match(r"""^export\s+\{([^}]+)\}(?:\s+from\s+['"]([^'"]+)['"])?;?""", stripped)
        if m_exp_named:
            items = m_exp_named.group(1)
            from_mod = m_exp_named.group(2)
            if from_mod:
                mod_id = resolve_specifier(from_mod)
                for item in items.split(','):
                    item = item.strip()
                    if not item:
                        continue
                    if ' as ' in item:
                        src, dst = item.split(' as ')
                        out_lines.append(f"exports.{dst.strip()} = __require('{mod_id}').{src.strip()};")
                    else:
                        out_lines.append(f"exports.{item} = __require('{mod_id}').{item};")
            else:
                for item in items.split(','):
                    item = item.strip()
                    if not item:
                        continue
                    if ' as ' in item:
                        src, dst = item.split(' as ')
                        add_getter(dst.strip(), src.strip())
                    else:
                        add_getter(item)
            i += 1
            continue

        out_lines.append(line)
        i += 1

    return '\n'.join(getters + out_lines)

def bundle_all_modules_cjs(entry_file, client_dir, all_files=False):
    visited = set()
    modules = {}

    def normalize(p):
        return os.path.normpath(p).replace('\\', '/')

    def collect(rel_path):
        norm = normalize(rel_path)
        if norm in visited:
            return
        visited.add(norm)

        full_path = os.path.join(client_dir, norm)
        with open(full_path, 'r', encoding='utf-8', errors='ignore') as f:
            code = f.read()

        import_re = re.compile(r"""(?:import|from)\s*['"](\.[^'"]+)['"]""")
        dir_path = os.path.dirname(full_path)
        for m in import_re.findall(code):
            tgt = os.path.normpath(os.path.join(dir_path, m))
            if not tgt.endswith('.js') and not tgt.endswith('.mjs'):
                if os.path.exists(tgt + '.js'):
                    tgt += '.js'
            if os.path.exists(tgt):
                rel = os.path.relpath(tgt, client_dir)
                collect(rel)

        cjs_code = transform_module_to_cjs(code, norm, client_dir)
        modules[norm] = cjs_code

    if all_files:
        for root, dirs, files in os.walk(client_dir):
            for file in sorted(files):
                if file.endswith('.js'):
                    full = os.path.join(root, file)
                    rel = normalize(os.path.relpath(full, client_dir))
                    if rel == 'js/packed-bootstrap.js':
                        continue
                    collect(rel)
    else:
        rel_entry = normalize(os.path.relpath(entry_file, client_dir))
        collect(rel_entry)

    parts = ["var __modules = {};\n"]
    for k in sorted(modules.keys()):
        code = modules[k]
        parts.append(f'__modules["{k}"] = function(__require, exports, module) {{\n{code}\n}};\n')

    parts.append("""
var __cache = {};
function __require(id) {
  id = id.replace(/\\\\/g, '/');
  if (__cache[id]) return __cache[id].exports;
  var mod = { exports: {} };
  __cache[id] = mod;
  if (!__modules[id]) {
    console.error("Module not found: " + id);
    throw new Error("Module not found: " + id);
  }
  __modules[id](__require, mod.exports, mod);
  return mod.exports;
}
""")

    if entry_file and not all_files:
        rel_entry = normalize(os.path.relpath(entry_file, client_dir))
        parts.append(f'\n__require("{rel_entry}");\n')

    return ''.join(parts)

def fetch_mojang_panorama(assets_dir):
    """The official jar ships 1x1 placeholder panorama_*.png files; the real ones live in Mojang's asset index.
    Download them (best effort) so the title screen background works. Never fails the build."""
    import urllib.request, hashlib
    tex_dir = os.path.join(assets_dir, 'minecraft', 'textures', 'gui', 'title', 'background')
    names = ['panorama_%d.png' % i for i in range(6)]
    def is_stub(n):
        p = os.path.join(tex_dir, n)
        return (not os.path.exists(p)) or os.path.getsize(p) < 1024
    if not any(is_stub(n) for n in names):
        return
    def get(url):
        req = urllib.request.Request(url, headers={'User-Agent': 'Gravrust-Builder'})
        with urllib.request.urlopen(req, timeout=20) as r:
            return r.read()
    try:
        print("[*] Panorama images are placeholders in the jar; fetching from Mojang asset index...")
        manifest = json.loads(get('https://launchermeta.mojang.com/mc/game/version_manifest_v2.json'))
        ver = next(v for v in manifest['versions'] if v['id'] == '1.15.2')
        vjson = json.loads(get(ver['url']))
        index = json.loads(get(vjson['assetIndex']['url']))['objects']
        os.makedirs(tex_dir, exist_ok=True)
        got = 0
        for n in names:
            obj = index.get('minecraft/textures/gui/title/background/' + n)
            if not obj:
                continue
            data = get('https://resources.download.minecraft.net/%s/%s' % (obj['hash'][:2], obj['hash']))
            if hashlib.sha1(data).hexdigest() != obj['hash']:
                print("[!] Hash mismatch for " + n + ", skipping")
                continue
            with open(os.path.join(tex_dir, n), 'wb') as f:
                f.write(data)
            got += 1
        print("[+] Fetched %d/6 panorama images" % got)
    except Exception as e:
        print("[!] Could not fetch panorama images (%s). Title screen will use the plain gradient background." % e)

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
            fallback_recipes = os.path.join(client_dir, 'data', 'recipes.json')
            if os.path.exists(fallback_recipes):
                with open(fallback_recipes, 'r', encoding='utf-8') as f:
                    recipes = json.load(f)
        recipes.reverse()
        recipes_bytes = json.dumps(recipes).encode('utf-8')
        with open(os.path.join(bundles_dir, 'recipes.json'), 'wb') as f:
            f.write(recipes_bytes)
        print(f"[*] Built bundles/recipes.json ({len(recipes)} recipes)")

    fetch_mojang_panorama(assets_dir)

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

    # 8. Create output/gravrust-compact.html (single-file offline client with ZERO blob URLs)
    compact_out = os.path.join(out_dir, 'gravrust-compact.html')
    print(f"[*] Packaging single-file offline client {compact_out}...")

    # A) Build in-memory asset zip
    import io
    asset_zip_buf = io.BytesIO()
    with zipfile.ZipFile(asset_zip_buf, 'w', zipfile.ZIP_DEFLATED) as az:
        for root, dirs, files in os.walk(assets_dir):
            for file in files:
                full_path = os.path.join(root, file)
                rel_path = os.path.relpath(full_path, assets_dir).replace('\\', '/')
                az.write(full_path, rel_path)
        data_dir = os.path.join(site_dir, 'data')
        for root, dirs, files in os.walk(data_dir):
            for file in files:
                full_path = os.path.join(root, file)
                rel_path = 'data/' + os.path.relpath(full_path, data_dir).replace('\\', '/')
                az.write(full_path, rel_path)
    asset_zip_bytes = asset_zip_buf.getvalue()
    asset_b64 = base64.b64encode(asset_zip_bytes).decode('ascii')

    # B) Bundle all JS modules synchronously into CommonJS (no dynamic import, no blob:null)
    entry_file = os.path.join(client_dir, 'js', 'main.js')
    worker_file = os.path.join(client_dir, 'js', 'render', 'mesh-worker.js')
    # Prefer the esbuild-prebuilt bundles (correct ES-module live bindings / circular imports).
    # Fall back to the legacy regex transform only if they are missing.
    pre_main = os.path.join(client_dir, 'bundle', 'main.bundle.js')
    pre_worker = os.path.join(client_dir, 'bundle', 'worker.bundle.js')
    if os.path.exists(pre_main) and os.path.exists(pre_worker):
        with open(pre_worker, 'r', encoding='utf-8') as f:
            worker_bundle = f.read()
        with open(pre_main, 'r', encoding='utf-8') as f:
            bundle_js = f.read()
        boot_call = ''
    else:
        worker_bundle = bundle_all_modules_cjs(worker_file, client_dir, all_files=False)
        bundle_js = bundle_all_modules_cjs(entry_file, client_dir, all_files=True)
        boot_call = '__require("js/main.js");'

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

  <script>
    var __MESH_WORKER_SOURCE__ = {json.dumps(worker_bundle)};
{bundle_js}

    // Synchronous execution: zero blob URLs, zero fetch, works directly from file:///
    try {{
      {boot_call}
    }} catch (e) {{
      console.error("Failed to boot Gravrust:", e);
      var t = document.getElementById("loading-text");
      if (t) {{ t.textContent = "Boot error: " + e.message; t.style.color = "#ff5555"; }}
    }}
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
