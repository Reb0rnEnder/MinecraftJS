#!/usr/bin/env python3
"""Prove or disprove: is the Rust core's PUBLIC API invoked from outside the crate?

Layers checked:
 A. Does any tracked JS/HTML/tool import the wasm-bindgen package?  (consumer test)
 B. Is `core_version()` (the only #[wasm_bindgen] fn in lib.rs) referenced anywhere?
 C. Within the crate: is a given module's public API used by a *reachable* module
    in real code (not just named in a doc comment)?
"""
import os, re, json, collections

REPO = r"C:\Users\Nicholas\Documents\Downloads\New folder (5)\Gravrust"
SRC = os.path.join(REPO, "rust", "gravrust-core", "src")
WS = r"C:\Users\Nicholas\Documents\Downloads\New folder (5)"
reach = json.load(open(os.path.join(WS, "reach3.json")))
default_on = set(reach["default"])

# --- A: external consumer test ---
print("=== A. external consumers of the wasm package ===")
import subprocess
out = subprocess.run(["git", "-C", REPO, "grep", "-n", "-E",
                      r"wasm/pkg|gravrust_bg|init_wasm|initWasm|WebAssembly\.instantiate"],
                     capture_output=True, text=True).stdout
for line in out.splitlines():
    if any(x in line for x in ("client/js/", "tools/", "legacy-client/", "dist/")):
        print("  ", line[:180])
print("  (above = every tracked JS/tool reference to the wasm pkg)")

# --- B ---
print("\n=== B. references to core_version() ===")
out2 = subprocess.run(["git", "-C", REPO, "grep", "-n", "core_version"],
                      capture_output=True, text=True).stdout
print("  ", out2.strip() or "(none outside its own definition)")

# --- C: intra-crate real usage, doc comments stripped ---
def strip_comments(t):
    t = re.sub(r'//[^\n]*', '', t)
    t = re.sub(r'/\*.*?\*/', '', t, flags=re.S)
    return t

texts = {}
for rel in sorted(default_on):
    p = os.path.join(SRC, rel.replace("/", os.sep))
    if os.path.exists(p):
        texts[rel] = open(p, encoding="utf-8", errors="replace").read()

strip_texts = {k: strip_comments(v) for k, v in texts.items()}

pub_items = {}
for rel, t in texts.items():
    ids = set()
    for m in re.finditer(r'\bpub\s+(?:async\s+)?(?:unsafe\s+)?(?:extern\s+"[^"]*"\s+)?fn\s+([A-Za-z_][A-Za-z0-9_]*)', t):
        ids.add(m.group(1))
    for m in re.finditer(r'\bpub\s+(?:struct|enum|trait|type|const|static)\s+([A-Za-z_][A-Za-z0-9_]*)', t):
        ids.add(m.group(1))
    pub_items[rel] = {i for i in ids if len(i) > 4 and not i.startswith("_")}

real_use = {}
for rel, ids in pub_items.items():
    used = 0
    used_by = set()
    for i in ids:
        for other, st in strip_texts.items():
            if other == rel:
                continue
            # require an actual call/use site, not a type mention in a struct field alone
            if re.search(r'\b' + re.escape(i) + r'\s*\(', st) or \
               re.search(r'crate::[A-Za-z_:]*::' + re.escape(i) + r'\b', st) or \
               re.search(r'\buse\s+[^;]*::' + re.escape(i) + r'\b', st):
                used += 1
                used_by.add(other)
                break
    real_use[rel] = {"used_items": used, "total_items": len(ids), "used_by": sorted(used_by)[:5]}

json.dump(real_use, open(os.path.join(WS, "realuse.json"), "w"), indent=1)

nonzero = {k: v for k, v in real_use.items() if v["used_items"] > 0}
zero = {k: v for k, v in real_use.items() if v["used_items"] == 0 and v["total_items"] > 0}
print(f"\n=== C. intra-crate usage (doc comments stripped) ===")
print(f"reachable modules with >=1 pub item: {len([k for k,v in real_use.items() if v['total_items']>0])}")
print(f"  with >=1 item really used elsewhere: {len(nonzero)}")
print(f"  with 0 items used elsewhere       : {len(zero)}")
