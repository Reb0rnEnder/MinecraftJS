#!/usr/bin/env python3
"""Reachability v2: explicit handling of the `mod unsupported_port { ... }` body."""
import os, re, json, sys

REPO = r"C:\Users\Nicholas\Documents\Downloads\New folder (5)\Gravrust"
SRC = os.path.join(REPO, "rust", "gravrust-core", "src")
LIB = os.path.join(SRC, "lib.rs")

def rel(p): return os.path.relpath(p, SRC).replace("\\", "/")

lib_lines = open(LIB, encoding="utf-8").read().split("\n")

# Walk lib.rs; track whether we are inside `mod unsupported_port { ... }`
mods = []          # (name, attr_path, gated, lineno)
pending_path = None
gate_depth = None
for i, raw in enumerate(lib_lines):
    ln = raw.split("//")[0]
    if gate_depth is None and re.search(r'#\[cfg\(feature\s*=\s*"unsupported"\)\]', ln):
        # the next `mod ... {` opens the gated region
        gate_depth = -1     # armed, waiting for the opening brace
    mp = re.match(r'\s*#\[path\s*=\s*"([^"]+)"\]', ln)
    if mp:
        pending_path = mp.group(1)
    # `mod name;` (external file)
    me = re.match(r'\s*(pub(?:\([^)]*\))?\s+)?mod\s+([A-Za-z_][A-Za-z0-9_]*)\s*;', ln)
    if me:
        gated = gate_depth is not None and gate_depth >= 0
        mods.append((me.group(2), pending_path, gated, i + 1))
        pending_path = None
        continue
    # `mod name {` (inline module body)
    mi = re.match(r'\s*(pub(?:\([^)]*\))?\s+)?mod\s+([A-Za-z_][A-Za-z0-9_]*)\s*\{', ln)
    if mi and gate_depth == -1:
        gate_depth = 1
        continue
    if gate_depth is not None and gate_depth >= 0:
        gate_depth += ln.count("{") - ln.count("}")
        if gate_depth <= 0:
            gate_depth = None

print(f"lib.rs mods (external-file decls): {len(mods)}", file=sys.stderr)
gated_names = [m[0] for m in mods if m[2]]
print(f"  gated by unsupported feature: {len(gated_names)}", file=sys.stderr)

# ---- build the graph ----
PAT = re.compile(
    r'(?m)(?:^[ \t]*#\[path\s*=\s*"([^"]+)"\][ \t]*\r?\n)?'
    r'^[ \t]*(?:pub(?:\([^)]*\))?[ \t]+)?mod[ \t]+([A-Za-z_][A-Za-z0-9_]*)[ \t]*;')

def parse_mods2(fp):
    try:
        t = open(fp, encoding="utf-8", errors="replace").read()
    except Exception:
        return []
    t = re.sub(r'//[^\n]*', '', t)
    t = re.sub(r'/\*.*?\*/', '', t, flags=re.S)
    return [(m.group(1), m.group(2)) for m in PAT.finditer(t)]

file_reach = {}     # rel path -> {"gated": bool, "paths": [...]}

queue = []
for (name, attr_path, gated, lineno) in mods:
    if attr_path:
        cand = os.path.normpath(os.path.join(SRC, attr_path))
    else:
        cand = os.path.join(SRC, name + ".rs")
        if not os.path.exists(cand):
            cand = os.path.join(SRC, name, "mod.rs")
    if not os.path.exists(cand):
        continue
    cr = rel(cand)
    st = file_reach.setdefault(cr, {"gated": True, "paths": []})
    st["paths"].append("crate::" + name)
    if not gated:
        st["gated"] = False
    queue.append((cr, "crate::" + name, gated))

while queue:
    cr, mpath, gated = queue.pop(0)
    fp = os.path.join(SRC, cr)
    pdir = os.path.dirname(fp)
    for (attr_path, name) in parse_mods2(fp):
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
        queue.append((ccr, cpath, gated))

all_rs = set()
for root, dirs, files in os.walk(SRC):
    for f in files:
        if f.endswith(".rs"):
            all_rs.add(rel(os.path.join(root, f)))

orphans = sorted(all_rs - set(file_reach))
dflt = sorted([f for f, i in file_reach.items() if not i["gated"]])
gated = sorted([f for f, i in file_reach.items() if i["gated"]])

print(f"\ntotal .rs             : {len(all_rs)}")
print(f"declared, default-on  : {len(dflt)}")
print(f"declared, gated       : {len(gated)}")
print(f"orphan (never declared): {len(orphans)}")
print("\n--- GATED (unsupported feature) ---")
for g in gated:
    print("  ", g)
print("\n--- ORPHANS ---")
for o in orphans:
    print("  ", o)

json.dump({"default": dflt, "gated": gated, "orphans": orphans,
           "file_reach": file_reach},
          open(r"C:\Users\Nicholas\Documents\Downloads\New folder (5)\reach2.json", "w"), indent=1)
