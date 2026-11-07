#!/usr/bin/env python3
"""Dump the first 6 lines (provenance header) + size of every .rs file, with reachability."""
import os, json, re

SRC = r"C:\Users\Nicholas\Documents\Downloads\New folder (5)\Gravrust\rust\gravrust-core\src"
WS = r"C:\Users\Nicholas\Documents\Downloads\New folder (5)"
reach = json.load(open(os.path.join(WS, "reach3.json")))
default_on, gated, orphans = set(reach["default"]), set(reach["gated"]), set(reach["orphans"])

out = open(os.path.join(WS, "headers.txt"), "w", encoding="utf-8")
for root, d, files in os.walk(SRC):
    for f in sorted(files):
        if not f.endswith(".rs"):
            continue
        p = os.path.join(root, f)
        rel = os.path.relpath(p, SRC).replace("\\", "/")
        st = "default" if rel in default_on else ("gated" if rel in gated else ("ORPHAN" if rel in orphans else "?"))
        size = os.path.getsize(p)
        head = open(p, encoding="utf-8", errors="replace").read().split("\n")[:4]
        head = " | ".join(h.strip().lstrip("/! ").strip() for h in head if h.strip())
        out.write(f"{rel}\t{st}\t{size}\t{head[:220]}\n")
out.close()
print("written headers.txt")
