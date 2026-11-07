#!/usr/bin/env python3
"""Build JS -> Rust provenance from (a) doc comments/headers, (b) lib.rs mapping table."""
import os, re, json, collections

REPO = r"C:\Users\Nicholas\Documents\Downloads\New folder (5)\Gravrust"
SRC = os.path.join(REPO, "rust", "gravrust-core", "src")

js_to_rs = collections.defaultdict(set)
rs_evidence = {}

for root, dirs, files in os.walk(SRC):
    for f in sorted(files):
        if not f.endswith(".rs"):
            continue
        p = os.path.join(root, f)
        rel = os.path.relpath(p, SRC).replace("\\", "/")
        raw = open(p, encoding="utf-8", errors="replace").read()
        head = "\n".join(raw.split("\n")[:40])
        found = set()
        # find client/js/... or lib/... paths mentioned anywhere in the file
        for m in re.finditer(r'(client/js/[A-Za-z0-9_\-./]+\.js|lib/[A-Za-z0-9_\-./]+\.js|legacy-client/[A-Za-z0-9_\-./]+\.js)', raw):
            found.add(m.group(1))
        for m in re.finditer(r'client/js/([A-Za-z0-9_\-./]+?)\.js', head):
            found.add("client/js/" + m.group(1) + ".js")
        if found:
            rs_evidence[rel] = sorted(found)
            for j in found:
                js_to_rs[j].add(rel)

json.dump({"js_to_rs": {k: sorted(v) for k, v in js_to_rs.items()},
           "rs_evidence": rs_evidence},
          open(r"C:\Users\Nicholas\Documents\Downloads\New folder (5)\prov.json", "w"), indent=1)

print(f"rust files naming >=1 JS source: {len(rs_evidence)}")
print(f"distinct JS paths named by Rust : {len(js_to_rs)}\n")

js205 = [l.strip() for l in open(os.path.expandvars(r"%TEMP%\js205.txt"), encoding="utf-8-sig") if l.strip()]
print(f"tracked client/js files: {len(js205)}")
missing = [j for j in js205 if j not in js_to_rs]
print(f"tracked files with NO Rust mention: {len(missing)}\n")
with open(r"C:\Users\Nicholas\Documents\Downloads\New folder (5)\missing.txt", "w", encoding="utf-8") as fh:
    for j in missing:
        fh.write(j + "\n")
for j in missing:
    print("  MISSING:", j.encode("ascii", "replace").decode())
