#!/usr/bin/env python3
"""Compute Rust module reachability from lib.rs and JS->Rust provenance."""
import os, re, json, sys

REPO = r"C:\Users\Nicholas\Documents\Downloads\New folder (5)\Gravrust"
SRC = os.path.join(REPO, "rust", "gravrust-core", "src")
LIB = os.path.join(SRC, "lib.rs")

# module path -> (file, gated)
def crate_relative(p):
    return os.path.relpath(p, SRC).replace("\\", "/")

# --- Step 1: find the unsupported_port block extent in lib.rs ---
lib_text = open(LIB, encoding="utf-8").read()
lines = lib_text.split("\n")
unsupported_start = None
unsupported_end = None
depth = 0
for i, ln in enumerate(lines):
    if unsupported_start is None and re.search(r'#\[cfg\(feature\s*=\s*"unsupported"\)\]', ln):
        unsupported_start = i
    if unsupported_start is not None and i >= unsupported_start:
        if i == unsupported_start:
            continue
        depth += ln.count("{") - ln.count("}")
        if depth <= 0 and "{" in "".join(lines[unsupported_start:i+1]):
            unsupported_end = i
            break
print(f"unsupported_port block: lines {unsupported_start+1}..{unsupported_end+1}", file=sys.stderr)

# --- Step 2: resolve mod declarations to files ---
def resolve_mod_file(modname, parent_dir, attr_path=None):
    """Return candidate file path for a mod declaration."""
    if attr_path:
        return os.path.normpath(os.path.join(parent_dir, attr_path))
    for cand in (os.path.join(parent_dir, modname + ".rs"),
                 os.path.join(parent_dir, modname, "mod.rs")):
        if os.path.exists(cand):
            return cand
    return None

# edges: (from_module_path, to_module_path, file, gated, attr_path)
def parse_mods(file_path, mod_prefix, gated, parent_dir):
    """Parse `mod X;` declarations in file_path. Returns list of (name, file, gated, is_public, attr_path)."""
    try:
        text = open(file_path, encoding="utf-8", errors="replace").read()
    except Exception:
        return []
    out = []
    # strip block comments and line comments crudely to avoid commented-out mods
    text_clean = re.sub(r'//[^\n]*', '', text)
    text_clean = re.sub(r'/\*.*?\*/', '', text_clean, flags=re.S)
    for m in re.finditer(r'(?m)^\s*(?:#\[path\s*=\s*"([^"]+)"\]\s*)?(pub(?:\([^)]*\))?\s+)?mod\s+([A-Za-z_][A-Za-z0-9_]*)\s*;', text_clean):
        # need to find the #[path] attribute immediately preceding - handled by regex above
        attr_path, vis, name = m.group(1), m.group(2), m.group(3)
        block = m.group(0)
        out.append((name, attr_path, gated, bool(vis), block))
    return out

# Because the regex above requires #[path] on the SAME line as mod, redo with a two-pass
def parse_mods2(file_path, gated):
    try:
        text = open(file_path, encoding="utf-8", errors="replace").read()
    except Exception:
        return []
    text = re.sub(r'//[^\n]*', '', text)
    text = re.sub(r'/\*.*?\*/', '', text, flags=re.S)
    out = []
    pattern = re.compile(
        r'(?m)(?:^[ \t]*#\[path\s*=\s*"([^"]+)"\][ \t]*\r?\n)?'
        r'^[ \t]*(pub(?:\([^)]*\))?[ \t]+)?mod[ \t]+([A-Za-z_][A-Za-z0-9_]*)[ \t]*;')
    for m in pattern.finditer(text):
        attr_path, vis, name = m.group(1), m.group(2), m.group(3)
        out.append((name, attr_path, bool(vis)))
    return out

# Build graph. Root = lib.rs at crate root, default (not gated).
all_rs = {}
for root, dirs, files in os.walk(SRC):
    for f in files:
        if f.endswith(".rs"):
            all_rs[crate_relative(os.path.join(root, f))] = os.path.join(root, f)

reachable = {}   # module_path -> dict(file, gated, declared_by)
queue = []

# Seed with lib.rs
reachable["crate"] = {"file": "lib.rs", "gated": False}
seen_files = {"lib.rs"}

def add_children(file_rel, mod_path, gated):
    fp = os.path.join(SRC, file_rel)
    parent_dir = os.path.dirname(fp)
    for (name, attr_path, is_pub) in parse_mods2(fp, gated):
        child_rel = None
        if attr_path:
            child_rel = crate_relative(os.path.normpath(os.path.join(parent_dir, attr_path)))
        else:
            for cand in (os.path.join(parent_dir, name + ".rs"),
                         os.path.join(parent_dir, name, "mod.rs")):
                if os.path.exists(cand):
                    child_rel = crate_relative(cand)
                    break
        cpath = mod_path + "::" + name
        if child_rel and os.path.exists(os.path.join(SRC, child_rel)):
            if cpath not in reachable:
                reachable[cpath] = {"file": child_rel, "gated": gated,
                                    "declared_in": file_rel, "decl_name": name}
                queue.append((child_rel, cpath, gated))
            else:
                # already present; if this path is ungated and existing is gated, it's still reachable
                if not gated:
                    reachable[cpath]["gated"] = False

# Determine gating by position in lib.rs for inline block
lib_lines = lib_text.split("\n")

def children_of_lib():
    """Parse lib.rs mods with correct gating based on line position."""
    text = re.sub(r'//[^\n]*', '', lib_text)
    text = re.sub(r'/\*.*?\*/', '', text, flags=re.S)
    pattern = re.compile(
        r'(?m)(?:^[ \t]*#\[path\s*=\s*"([^"]+)"\][ \t]*\r?\n)?'
        r'^[ \t]*(pub(?:\([^)]*\))?[ \t]+)?mod[ \t]+([A-Za-z_][A-Za-z0-9_]*)[ \t]*;')
    return [(m.group(1), m.group(3), m.start()) for m in pattern.finditer(text)]

# Map char offset -> line number for gating determination
def offset_to_line(text, off):
    return text.count("\n", 0, off)

lib_clean = re.sub(r'//[^\n]*', '', lib_text)
lib_clean = re.sub(r'/\*.*?\*/', '', lib_clean, flags=re.S)
# offset mapping is approximate after comment stripping; instead do line-based scan
def lib_mods_with_gating():
    res = []
    in_gate = False
    pending_path = None
    depth = 0
    for i, raw in enumerate(lib_lines):
        ln = raw.split("//")[0]
        if re.search(r'#\[cfg\(feature\s*=\s*"unsupported"\)\]', ln):
            in_gate = True
            depth = 0
        m = re.match(r'\s*#\[path\s*=\s*"([^"]+)"\]', ln)
        if m:
            pending_path = m.group(1)
        m2 = re.match(r'\s*(pub(?:\([^)]*\))?\s+)?mod\s+([A-Za-z_][A-Za-z0-9_]*)\s*;', ln)
        if m2:
            res.append((m2.group(2), pending_path, in_gate, i+1))
            pending_path = None
        if in_gate:
            depth += ln.count("{") - ln.count("}")
            if depth <= 0 and "{" in "".join(lib_lines[unsupported_start:i+1]) if unsupported_start is not None else False:
                pass
    return res

# Simpler robust approach: walk line by line tracking brace depth inside the cfg block
def lib_mods_final():
    res = []
    pending_path = None
    gate_depth = None   # None = not in gate
    for i, raw in enumerate(lib_lines):
        ln = raw.split("//")[0]
        if gate_depth is None and re.search(r'#\[cfg\(feature\s*=\s*"unsupported"\)\]', ln):
            gate_depth = 0
        mp = re.match(r'\s*#\[path\s*=\s*"([^"]+)"\]', ln)
        if mp:
            pending_path = mp.group(1)
        mm = re.match(r'\s*(pub(?:\([^)]*\))?\s+)?mod\s+([A-Za-z_][A-Za-z0-9_]*)\s*;', ln)
        if mm:
            gated = gate_depth is not None and gate_depth >= 0
            res.append((mm.group(2), pending_path, gated, i+1))
            pending_path = None
        if gate_depth is not None:
            gate_depth += ln.count("{") - ln.count("}")
            if gate_depth <= 0 and i > (unsupported_start or 0) + 1 and "{" not in ln:
                gate_depth = None
    return res

lib_mods = lib_mods_final()
print(f"lib.rs mod declarations parsed: {len(lib_mods)}", file=sys.stderr)

for (name, attr_path, gated, lineno) in lib_mods:
    child_rel = None
    if attr_path:
        child_rel = crate_relative(os.path.normpath(os.path.join(SRC, attr_path)))
    else:
        for cand in (os.path.join(SRC, name + ".rs"), os.path.join(SRC, name, "mod.rs")):
            if os.path.exists(cand):
                child_rel = crate_relative(cand)
                break
    cpath = "crate::" + name
    if child_rel and os.path.exists(os.path.join(SRC, child_rel)):
        reachable[cpath] = {"file": child_rel, "gated": gated, "declared_in": "lib.rs",
                            "decl_name": name, "line": lineno}
        queue.append((child_rel, cpath, gated))
    else:
        reachable[cpath] = {"file": None, "gated": gated, "declared_in": "lib.rs",
                            "decl_name": name, "line": lineno, "missing": True}

# BFS
while queue:
    file_rel, mod_path, gated = queue.pop(0)
    fp = os.path.join(SRC, file_rel)
    parent_dir = os.path.dirname(fp)
    for (name, attr_path, is_pub) in parse_mods2(fp, gated):
        child_rel = None
        if attr_path:
            child_rel = crate_relative(os.path.normpath(os.path.join(parent_dir, attr_path)))
        else:
            for cand in (os.path.join(parent_dir, name + ".rs"),
                         os.path.join(parent_dir, name, "mod.rs")):
                if os.path.exists(cand):
                    child_rel = crate_relative(cand)
                    break
        cpath = mod_path + "::" + name
        if child_rel and os.path.exists(os.path.join(SRC, child_rel)):
            if cpath not in reachable:
                reachable[cpath] = {"file": child_rel, "gated": gated,
                                    "declared_in": file_rel, "decl_name": name}
                queue.append((child_rel, cpath, gated))
        else:
            if cpath not in reachable:
                reachable[cpath] = {"file": None, "gated": gated, "declared_in": file_rel,
                                    "decl_name": name, "missing": True}

# file -> reachability info
file_reach = {}
for mpath, info in reachable.items():
    f = info.get("file")
    if not f:
        continue
    if f not in file_reach:
        file_reach[f] = {"paths": [], "gated": True, "missing": False}
    file_reach[f]["paths"].append(mpath)
    if not info["gated"]:
        file_reach[f]["gated"] = False

orphans = sorted(set(all_rs) - set(file_reach))
reachable_default = sorted([f for f, i in file_reach.items() if not i["gated"]])
reachable_gated = sorted([f for f, i in file_reach.items() if i["gated"]])

print(f"total .rs files:       {len(all_rs)}")
print(f"declared (any):        {len(file_reach)}")
print(f"  reachable default:   {len(reachable_default)}")
print(f"  gated unsupported:   {len(reachable_gated)}")
print(f"orphan (never declared): {len(orphans)}")
print()
print("=== ORPHANS ===")
for o in orphans:
    print("  ", o)

json.dump({
    "orphans": orphans,
    "default": reachable_default,
    "gated": reachable_gated,
    "file_reach": {k: v for k, v in file_reach.items()},
}, open(r"C:\Users\Nicholas\Documents\Downloads\New folder (5)\reach.json", "w"), indent=1)
