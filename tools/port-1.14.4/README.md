# Native 1.14.4 extraction bootstrap

This is the first implementation milestone of the 1.14.4 port. It prepares and
checks native source data without changing the inherited 1.13.2 runtime codecs.
It uses Node's standard library and Java 11 or newer; `JAVA` may select the Java
executable. Node must provide fetch (Node 18+).

```sh
node tools/port-1.14.4/prepare.mjs
node tools/port-1.14.4/reports.mjs --check
node tools/test-1.14.4-bootstrap.mjs
```

`target.json` pins Mojang's metadata, both jars and both official mapping files
by URL, size and SHA-1. It also pins minecraft-data revision
`5e063fa99cfe8ded065ec6788b66696b7e4ef143` and hashes the two protocol schemas.
Inputs are verified before use, including cached files. A corrupt cache entry
fails explicitly instead of being accepted or silently replaced.

Everything downloaded stays in ignored `cache/port-1.14.4/`. Complete Mojang
mapping files and jars are not committed. The vanilla data generator writes
block, registry and command reports there; it does not run a game server or
open a world. Its logs and side effects also remain in that cache directory.

`baseline.json` is a small generated summary: 676 blocks, 11,271 contiguous block
states, 37 registries and 71 root commands. It records source/report hashes and
packet additions/removals, numeric ID changes, direct schema changes and shared
protocol type changes. There are 93 clientbound and 46 serverbound play packets
in the pinned target schema, compared with 86 and 43 in the starting schema.
This is a change inventory, not an implemented protocol decoder.

`reports.mjs --check` reruns the actual vanilla data generator and compares the
result with the committed baseline. Running without `--check` rewrites that
baseline for deliberate review. The test suite checks source integrity and
report invariants; its native-report case requires the prepared cache and is
skipped otherwise. Both report regeneration and all tests were run successfully
when introducing the bootstrap.

The jars are the authority for behavior. Schema cross-checks derive from the
MIT-licensed [minecraft-data project](https://github.com/PrismarineJS/minecraft-data/tree/5e063fa99cfe8ded065ec6788b66696b7e4ef143).
The next work is adapting the client-side model/shape/GUI extractors with the
verified official mappings, followed by the version-498 binary codecs and
separate chunk/light lifecycle described in the transition plan. Keep all old
runtime tests until their expectations are intentionally ported.
