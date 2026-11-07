#!/usr/bin/env python3
"""Tight JS-contamination scan: strip comments and string literals first."""
import os, re, json

SRC = r"C:\Users\Nicholas\Documents\Downloads\New folder (5)\Gravrust\rust\gravrust-core\src"

def strip(t):
    # remove line comments (// and //!) but keep code
    t = re.sub(r'//[^\n]*', '', t)
    t = re.sub(r'/\*.*?\*/', '', t, flags=re.S)
    # remove string literals
    t = re.sub(r'"(?:[^"\\]|\\.)*"', '""', t)
    t = re.sub(r"'(?:[^'\\]|\\.)*'", "''", t)
    # remove raw strings
    t = re.sub(r'r#*"(?:.|\n)*?"#*', '""', t)
    return t

# JS-only constructs. `===`/`!==`/`undefined`/`typeof` are illegal Rust tokens.
STRONG = [
    ("js-strict-eq",   r'===|!=='),
    ("js-typeof",      r'\btypeof\s+[A-Za-z_$]'),
    ("js-console-log", r'\bconsole\.log\s*\('),
    ("js-undefined",   r'\bundefined\b'),
    ("js-function",    r'\bfunction\s*\('),
    ("js-arrow-brace", r'\)\s*=>\s*\{'),
    ("js-forEach",     r'\.forEach\s*\('),
    ("js-optional-chain", r'[A-Za-z_\)\]]\?\.'),
    ("js-new-Array",   r'\bnew\s+Array\b'),
    ("js-backtick",    r'`'),
]

hits = {}
for root, dirs, files in os.walk(SRC):
    for f in sorted(files):
        if not f.endswith(".rs"):
            continue
        p = os.path.join(root, f)
        rel = os.path.relpath(p, SRC).replace("\\", "/")
        raw = open(p, encoding="utf-8", errors="replace").read()
        t = strip(raw)
        found = {}
        for lab, pat in STRONG:
            m = re.findall(pat, t)
            if m:
                found[lab] = len(m)
        if found:
            hits[rel] = found

print(f"files with JS-only constructs in CODE: {len(hits)}")
for k in sorted(hits):
    print("  ", k, hits[k])

json.dump(hits, open(r"C:\Users\Nicholas\Documents\Downloads\New folder (5)\js_contam.json", "w"), indent=1)
