#!/usr/bin/env python3
"""Reachability v3: correct #[path] base for inline-module bodies + JS-contamination scan."""
import os, re, json, sys

REPO = r"C:\Users\Nicholas\Documents\Downloads\New folder (5)\Gravrust"
CORE = os.path.join(REPO, "rust", "gravrust-core")
SRC = os.path.join(CORE, "src")
LIB = os.path.join(SRC, "lib.rs")

def rel(p): return os.path.relpath(p, SRC).replace("\\", "/")

lib_lines = open(LIB, encoding="utf-8").read().split("\n")

# inline module dirs register here: mod name -> virtual dir
mods = []           # (name, attr_path, gated, base_dir, lineno)
pending_path = None
gate_depth = None
inline_stack = []   # (name, vdir)

for i, raw in enumerate(lib_lines):
    ln = raw.split("//")[0]
    if gate_depth is None and re.search(r'#\[cfg\(feature\s*=\s*"unsupported"\)\]', ln):
        gate_depth = -1
    mp = re.match(r'\s*#\[path\s*=\s*"([^"]+)"\]', ln)
    if mp:
        pending_path = mp.group(1)

    mi = re.match(r'\s*(?:pub(?:\([^)]*\))?\s+)?mod\s+([A-Za-z_][A-Za-z0-9_]*)\s*\{', ln)
    me = re.match(r'\s*(?:pub(?:\([^)]*\))?\s+)?mod\s+([A-Za-z_][A-Za-z0-9_]*)\s*;', ln)
    if mi and gate_depth == -1:
        gate_depth = 1
        cur_vdir = SRC if not inline_stack else inline_stack[-1][1]
        inline_stack.append((mi.group(1), os.path.join(cur_vdir, mi.group(1))))
        continue
    if me:
        gated = gate_depth is not None and gate_depth >= 0
        base = inline_stack[-1][1] if inline_stack else SRC
        mods.append((me.group(1), pending_path, gated, base, i + 1))
        pending_path = None
        continue
    if gate_depth is not None and gate_depth >= 0:
        gate_depth += ln.count("{") - ln.count("}")
        if gate_depth <= 0:
            gate_depth = None
            if inline_stack:
                inline_stack.pop()

# ---- graph ----
PAT = re.compile(
    r'(?m)(?:^[ \t]*#\[path\s*=\s*"([^"]+)"\][ \t]*\r?\n)?'
    r'^[ \t]*(?:pub(?:\([^)]*\))?[ \t]+)?mod[ \t]+([A-Za-z_][A-Za-z0-9_]*)[ \t]*;')

def parse_mods(fp):
    try:
        t = open(fp, encoding="utf-8", errors="replace").read()
    except Exception:
        return []
    t = re.sub(r'//[^\n]*', '', t)
    t = re.sub(r'/\*.*?\*/', '', t, flags=re.S)
    return [(m.group(1), m.group(2)) for m in PAT.finditer(t)]

file_reach = {}
queue = []
for (name, attr_path, gated, base, lineno) in mods:
    if attr_path:
        cand = os.path.normpath(os.path.join(base, attr_path))
    else:
        cand = os.path.join(base, name + ".rs")
        if not os.path.exists(cand):
            cand = os.path.join(base, name, "mod.rs")
    if not os.path.exists(cand):
        continue
    cr = rel(cand)
    st = file_reach.setdefault(cr, {"gated": True, "paths": []})
    st["paths"].append("crate::" + name)
    if not gated:
        st["gated"] = False
    queue.append((cr, "crate::" + name, gated, os.path.dirname(cand)))

while queue:
    cr, mpath, gated, pdir = queue.pop(0)
    fp = os.path.join(SRC, cr)
    for (attr_path, name) in parse_mods(fp):
        if attr_path:
            cand = os.path.normpath(os.path.join(pdir, attr_path))
        else:
            cand = os.path.join(pdir, name + ".rs")
            if not os.path.exists(cand):
                cand = os.path.join(pdir, name, "mod.rs")
        if not os.path.exists(cand):
            continue
        ccr = rel(cand)
        cpath = mpath + "::" + name
        if ccr in file_reach and cpath in file_reach[ccr]["paths"]:
            continue
        st = file_reach.setdefault(ccr, {"gated": True, "paths": []})
        st["paths"].append(cpath)
        if not gated:
            st["gated"] = False
        queue.append((ccr, cpath, gated, os.path.dirname(cand)))

all_rs = set()
for root, d, files in os.walk(SRC):
    for f in files:
        if f.endswith(".rs"):
            all_rs.add(rel(os.path.join(root, f)))

orphans = sorted(all_rs - set(file_reach))
dflt = sorted([f for f, i in file_reach.items() if not i["gated"]])
gated = sorted([f for f, i in file_reach.items() if i["gated"]])

print(f"total .rs              : {len(all_rs)}")
print(f"declared, default-on   : {len(dflt)}")
print(f"declared, gated        : {len(gated)}")
print(f"orphan (never declared): {len(orphans)}")
print("\n--- GATED (only under `unsupported`) ---")
for g in gated: print("  ", g)

json.dump({"default": dflt, "gated": gated, "orphans": orphans, "file_reach": file_reach},
          open(r"C:\Users\Nicholas\Documents\Downloads\New folder (5)\reach3.json", "w"), indent=1)

# ---- JS contamination scan (JS syntax pasted into .rs) ----
print("\n=== JS-CONTAMINATION SCAN (files with JS-only syntax) ===")
JSPAT = [
    (r'\btypeof\s+[A-Za-z_$]', 'typeof'),
    (r'===', 'strict-equality'),
    (r'!==', 'strict-inequality'),
    (r'\.push\(', 'js .push('),
    (r'\bfunction\s*\(', 'js function('),
    (r'=>\s*\{', 'js arrow fn (also rust closure - weak)'),
    (r'\bundefined\b', 'undefined'),
    (r'\bconsole\.log\(', 'console.log('),
    (r'\bnull\s*\?\?', '??'),
]
hits = {}
for r_ in sorted(all_rs):
    fp = os.path.join(SRC, r_)
    try:
        t = open(fp, encoding="utf-8", errors="replace").read()
    except Exception:
        continue
    found = []
    for pat, label in JSPAT:
        n = len(re.findall(pat, t))
        if n and label not in ('js arrow fn (also rust closure - weak)',):
            found.append(f"{label}x{n}")
    if found:
        hits[r_] = found
for k, v in hits.items():
    print(f"  {k}: {', '.join(v)}")
json.dump(hits, open(r"C:\Users\Nicholas\Documents\Downloads\New folder (5)\js_hits.json", "w"), indent=1)
