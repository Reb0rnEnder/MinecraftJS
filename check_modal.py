#!/usr/bin/env python3
"""For each remaining.json entry, decide: does a real .rs file exist for it?
remaining.json's `mod` is e.g. 'gui_hud_js'; the .rs file would be hud.rs or gui_hud_js.rs."""
import os, re, json

REPO = r"C:\Users\Nicholas\Documents\Downloads\New folder (5)\Gravrust"
SRC = os.path.join(REPO, "rust", "gravrust-core", "src")
WS = r"C:\Users\Nicholas\Documents\Downloads\New folder (5)"

reach = json.load(open(os.path.join(WS, "reach3.json")))
default_on, gated, orphans = set(reach["default"]), set(reach["gated"]), set(reach["orphans"])
remaining = json.load(open(os.path.join(WS, "rust", "remaining.json")))

all_rs = {}
for root, d, files in os.walk(SRC):
    for f in files:
        if f.endswith(".rs"):
            rel = os.path.relpath(os.path.join(root, f), SRC).replace("\\", "/")
            all_rs[rel] = os.path.getsize(os.path.join(root, f))

def find(modname):
    """map mod name like game_tutorial_js -> candidate file(s)"""
    base = modname
    for suf in ("_js", "_1_14_4_js", "_1_15_2_js", "_alg", "_alg2", "_alg3"):
        if base.endswith(suf):
            base = base[: -len(suf)]
            break
    cands = []
    for rel in all_rs:
        stem = os.path.basename(rel)[:-3]
        if stem == base or modname == stem or rel.endswith("/" + base + ".rs"):
            cands.append(rel)
    return sorted(cands)

print(f"{'remaining.json src':55} {'lines':>6} {'pct':>4}  resolved .rs (state)")
print("-" * 140)
noFile = []
for e in remaining:
    cands = find(e["mod"])
    # also try from the src filename
    if not cands:
        jsb = os.path.basename(e["src"])[:-3]
        if jsb.endswith("-1.14.4"):
            jsb = jsb.replace("-1.14.4", "_1144")
        elif jsb.endswith("-1.15.2"):
            jsb = jsb.replace("-1.15.2", "_1152")
        jsb = re.sub(r'[^a-z0-9]', '_', jsb.lower())
        for rel in all_rs:
            if os.path.basename(rel)[:-3] == jsb:
                cands.append(rel)
    state = []
    for c in cands:
        s = "default" if c in default_on else ("gated" if c in gated else ("ORPHAN" if c in orphans else "?"))
        state.append(f"{c}[{s},{all_rs[c]}b]")
    if not cands:
        noFile.append(e)
        state = ["<NO .rs FILE>"]

print(f"\n=== remaining.json entries whose .rs does NOT exist: {len(noFile)} ===")
for e in noFile:
    print(f"  {e['src']:55} mod={e['mod']:40} lines={e['lines']}")

json.dump({"noFile": noFile}, open(os.path.join(WS, "nofile.json"), "w"), indent=1)
