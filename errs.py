import json, re, collections, os

p = os.path.expandvars(r"%TEMP%\unsj.txt")
byfile = collections.defaultdict(list)
n = 0
for line in open(p, encoding="utf-8", errors="replace"):
    line = line.strip()
    if not line.startswith("{"):
        continue
    try:
        o = json.loads(line)
    except Exception:
        continue
    if o.get("reason") != "compiler-message":
        continue
    m = o["message"]
    if m.get("level") != "error":
        continue
    n += 1
    spans = [s for s in m.get("spans", []) if s.get("file_name", "").endswith(".rs")]
    f = spans[0]["file_name"] if spans else "?"
    f = f.replace("gravrust-core\\src\\unsupported_port\\..\\", "")
    key = re.sub(r"^.*?src[\\/]", "", f)
    byfile[key].append(m.get("message", "")[:150])

print(f"total compiler errors: {n}")
print(f"distinct files: {len(byfile)}\n")
for k in sorted(byfile, key=lambda x: -len(byfile[x])):
    print(f"== {k}  ({len(byfile[k])} errors)")
    for e in byfile[k][:3]:
        print("     -", e)
