#!/usr/bin/env python3
"""Build the definitive 205-row audit table.

Evidence layers per JS file:
  L1 provenance  - a Rust file names this JS path (doc comment / header / // JS: marker)
  L2 reachable   - that Rust file is reachable from lib.rs (default-on vs gated vs orphan)
  L3 invoked     - the Rust API is actually called by a consumer (JS glue or another reachable Rust path)
"""
import os, re, json, collections

REPO = r"C:\Users\Nicholas\Documents\Downloads\New folder (5)\Gravrust"
CORE = os.path.join(REPO, "rust", "gravrust-core")
SRC = os.path.join(CORE, "src")
WS = r"C:\Users\Nicholas\Documents\Downloads\New folder (5)"

reach = json.load(open(os.path.join(WS, "reach3.json")))
prov = json.load(open(os.path.join(WS, "prov.json")))
js_to_rs = prov["js_to_rs"]

default_on = set(reach["default"])
gated = set(reach["gated"])
orphans = set(reach["orphans"])

js205 = [l.strip() for l in open(os.path.join(WS, "js205.txt"), encoding="utf-8-sig") if l.strip()]

# ---------- helper: is a Rust file "invoked"? ----------
# The crate has NO external consumer (verified: no JS imports the wasm pkg).
# So "invoked" is assessed as: reachable from lib.rs AND its public API is
# referenced by another reachable Rust module (not just defined).
def file_path(rel):
    return os.path.join(SRC, rel.replace("/", os.sep))

# collect pub items per reachable file
pub_items = {}
for rel in sorted(default_on):
    p = file_path(rel)
    if not os.path.exists(p):
        continue
    t = open(p, encoding="utf-8", errors="replace").read()
    ids = set()
    for m in re.finditer(r'\bpub\s+(?:async\s+)?(?:unsafe\s+)?fn\s+([A-Za-z_][A-Za-z0-9_]*)', t):
        ids.add(m.group(1))
    for m in re.finditer(r'\bpub\s+(?:struct|enum|trait|type|const|static)\s+([A-Za-z_][A-Za-z0-9_]*)', t):
        ids.add(m.group(1))
    pub_items[rel] = {i for i in ids if not i.startswith("_") and len(i) > 3}

# count cross-references from OTHER reachable files
ref_count = collections.defaultdict(int)
all_reach_text = {}
for rel in sorted(default_on):
    p = file_path(rel)
    if os.path.exists(p):
        all_reach_text[rel] = open(p, encoding="utf-8", errors="replace").read()

for rel, ids in pub_items.items():
    for i in ids:
        n = 0
        for other, txt in all_reach_text.items():
            if other == rel:
                continue
            n += len(re.findall(r'\b' + re.escape(i) + r'\b', txt))
        if n:
            ref_count[rel] += 1

# ---------- classify each JS file ----------
BROWSER_GLUE_HINTS = [
    # path fragments that are pure browser/DOM/WebGL/audio/network glue
    ("client/js/gfx/webgl2.js", "WebGL context wrapper; JS glue by design"),
    ("client/js/gfx/webgpu.js", "WebGPU adapter/device; JS glue by design"),
    ("client/js/gfx/device.js", "device contract; JS glue"),
]

rows = []
for j in js205:
    rss = js_to_rs.get(j, [])
    # prefer reachable ones
    rs_default = [r for r in rss if r in default_on]
    rs_gated = [r for r in rss if r in gated]
    rs_orphan = [r for r in rss if r in orphans]

    all_rs = sorted(set(rs_default + rs_gated + rs_orphan))
    rust_counterpart = "; ".join(rss[:3]) if rss else "none"
    declared = "yes" if rs_default else ("gated-only" if rs_gated else ("orphan-only" if rs_orphan else "no"))

    # verdict
    if rs_default:
        invoked = any(ref_count.get(r, 0) > 0 for r in rs_default)
        verdict = "ported+wired" if invoked else "ported+unwired"
        ev = (f"Rust port(s) {', '.join(rs_default[:2])} reachable from lib.rs (default build); "
              f"cross-module references to its public items: "
              f"{ {r: ref_count.get(r,0) for r in rs_default[:2]} }")
    elif rs_gated:
        verdict = "ported+unwired"
        ev = (f"Rust port(s) {', '.join(rs_gated[:2])} exist but are gated behind "
              f"#[cfg(feature = \"unsupported\")] (src/lib.rs L268-437) and that feature does not compile")
    elif rs_orphan:
        verdict = "ported+unwired"
        ev = (f"Rust port(s) {', '.join(rs_orphan[:2])} exist on disk but are declared nowhere "
              f"in lib.rs (orphan: not compiled)")
    else:
        verdict = "not-ported"
        ev = "no Rust file names this JS path; no counterpart on disk"

    rows.append({
        "js": j,
        "rust": rust_counterpart,
        "declared": declared,
        "verdict": verdict,
        "evidence": ev,
        "rs_default": rs_default,
        "rs_gated": rs_gated,
        "rs_orphan": rs_orphan,
    })

json.dump(rows, open(os.path.join(WS, "rows.json"), "w"), indent=1)

c = collections.Counter(r["verdict"] for r in rows)
print("TOTAL:", len(rows))
for k, v in c.most_common():
    print(f"  {k}: {v}")
print()
print("=== ported+wired rows ===")
for r in rows:
    if r["verdict"] == "ported+wired":
        print("  ", r["js"], "->", r["rust"], r["rs_default"], {x: ref_count.get(x, 0) for x in r["rs_default"]})
