#!/usr/bin/env python3
"""Cross-check JS -> Rust by: (1) remaining.json mod names, (2) filename-stem similarity,
(3) header keyword match. Report candidates my mention-based scan missed."""
import os, re, json, difflib

REPO = r"C:\Users\Nicholas\Documents\Downloads\New folder (5)\Gravrust"
SRC = os.path.join(REPO, "rust", "gravrust-core", "src")
WS = r"C:\Users\Nicholas\Documents\Downloads\New folder (5)"

reach = json.load(open(os.path.join(WS, "reach3.json")))
prov = json.load(open(os.path.join(WS, "prov.json")))
js_to_rs = prov["js_to_rs"]
default_on, gated, orphans = set(reach["default"]), set(reach["gated"]), set(reach["orphans"])
js205 = [l.strip() for l in open(os.path.join(WS, "js205.txt"), encoding="utf-8-sig") if l.strip()]

# remaining.json:  src -> mod name  (gives a strong declared mapping even when the
# .rs file does not name the .js path)
remaining = json.load(open(os.path.join(WS, "rust", "remaining.json")))
rem_map = {}
for e in remaining:
    rem_map.setdefault(e["src"], []).append((e["mod"], e["lines"], e["pct"]))
print(f"remaining.json entries: {len(remaining)}, distinct src: {len(rem_map)}")

# all .rs stems
stems = {}
for root, d, files in os.walk(SRC):
    for f in files:
        if f.endswith(".rs"):
            rel = os.path.relpath(os.path.join(root, f), SRC).replace("\\", "/")
            stems[rel] = f[:-3]

def norm(s):
    return re.sub(r'[^a-z0-9]', '', s.lower())

# JS stem -> candidate rust files by normalized-stem containment
missed = []
for j in js205:
    if j in js_to_rs:
        continue
    js_stem = os.path.basename(j)[:-3]
    jn = norm(js_stem)
    cands = []
    for rel, st in stems.items():
        sn = norm(st)
        if not sn or sn in ("lib", "main"):
            continue
        if jn == sn or (len(jn) > 5 and (jn in sn or sn in jn)):
            cands.append(rel)
    if cands:
        missed.append((j, sorted(cands), rem_map.get(j)))

print(f"\n=== JS files with NO doc-comment mention but a same-stem Rust file: {len(missed)} ===")
for j, c, rem in missed:
    print(f"  {j}\n      -> {c}   remaining.json: {rem}")

json.dump({"missed": missed}, open(os.path.join(WS, "crossmap.json"), "w"), indent=1)

# also: every remaining.json src not already in js_to_rs
print("\n=== remaining.json srcs with no mention-provenance ===")
for src in sorted(rem_map):
    if src not in js_to_rs and src in js205:
        print("  ", src, rem_map[src])
