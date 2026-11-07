# Verified baseline — Gravrust 1.15.2 Rust rewrite (2026-11-04)

Independently re-verified at session start. Several claims in
`docs/AI-PROMPT-rust-rewrite.md` (and the prompt derived from it) are **wrong**;
corrections are recorded here with the command that produced the evidence.

## Repository reality

| Fact | Prompt claimed | Verified actual | Evidence |
|---|---|---|---|
| Checkout path | (not stated) | `New folder (5)/Gravrust` | nested git repo; parent dir is not a repo |
| Remote branch tip | `1cc261a` | **`6510ab5`** | `git ls-remote origin refs/heads/1.15.2` |
| Local vs remote | — | equal, 0 ahead / 0 behind | `git rev-list --left-right --count` |
| Tracked JS under `client/js/` | 205 | **205 tracked, 204 on disk** | see "deleted files" below |
| Rust files in `src/` | 203 | **203** | correct |
| `rust/port-status.json` | "read this" | **does not exist** | `Test-Path` false |
| `tools/wasm-parity.mjs` | "read this" | **does not exist**; `npm run test:wasm` therefore fails | `Test-Path` false |
| `client/js/wasm/` glue dir | "the JS glue in `client/js/wasm/`" | **does not exist** | only `client/js/lib/truetype-wasm.js` matches "wasm" |

`1cc261a` is the *parent* of `6510ab5`; the prompt commit itself is the tip, so the
starting-state block describes the tree one commit before HEAD.

## Build state — confirmed

- `cargo check` (host): **exit 0**, 166 warnings, 0 errors. Confirmed.
- `cargo check --features unsupported`: **exit 101, 5 errors**. Confirmed.
- 119 compiled / 80 gated module split in `lib.rs`: consistent with the file.

All **5** unsupported errors are *parse-level*, not deep type errors:

```
src/atlas.rs:218:39          error: expected expression, found reserved keyword `typeof`
src/bee_sound_params.rs:19:1 error[E0753]: expected outer doc comment
src/book.rs:84:1             error[E0753]: expected outer doc comment
src/book.rs:104:1            error[E0753]: expected outer doc comment
src/chat.rs:373:5            error: unexpected closing delimiter: `}`
```

This is a much better position than "80 modules reference a module tree that does not
exist". The compiler stops at the first parse error per file, so the *real* type-level
blocker count behind these 5 syntax errors is not yet known — it must be measured by
fixing the syntax first and re-running.

## The client is broken — corrections to the prior audit

`docs/js-deletion-audit-2026-11-04.md` states "No JavaScript has been deleted. All 205
files are intact." **This is false.** Commit `d671f47` ("Remove 10 old JS files ported
to Rust") deleted 4 files, and no commit since has restored them:

```
client/js/assets.js            <- deleted, STILL IMPORTED by live code
client/js/main.js              <- deleted, STILL REFERENCED by client/index.html
client/js/packed-bootstrap.js  <- deleted
tools/build.js                 <- deleted
```

(The commit message says 10; `git show --diff-filter=D --name-only d671f47` lists 4.)

Because `git status` is clean and these paths are no longer tracked, the "205 tracked"
count in the audit and the "204 on disk" count both hold simultaneously — which is how
the discrepancy was missed. The audit counted `git ls-files`, not the working tree.

Live breakage:

1. `client/index.html:20` — `<script type="module" src="js/main.js"></script>` points at
   a file that does not exist. **The browser client has no entry point.**
2. `client/js/game/serverpacks.js:11` — `import { ResourcePack } from '../assets.js';`
   does not resolve. This is the only broken relative import inside `client/js`.
3. `tools/test-client-regressions.mjs:6` — `import { Assets } from '../client/js/assets.js';`
   fails with `ERR_MODULE_NOT_FOUND`, so **the headline regression suite does not even
   load**, let alone pass. This is independent of the Rust port.
4. `Assets` / `ResourcePack` are defined nowhere in the tree any more
   (`grep "class Assets"` over all non-`node_modules` sources: 0 hits).

`rust/gravrust-core/src/main_boot.rs` is the Rust port of the deleted `main.js`, and
`atlas.rs`/`book.rs` etc. carry `assets`-shaped logic — so the Rust counterparts exist,
but the JS entry point was never rewired onto them. Deleting `main.js` removed the
loader without installing the replacement.

## Consequence for the plan

The loop in the prompt assumes JS exists and works, and that deletion is the risk. The
actual most-urgent defect is the reverse: **JS was deleted prematurely and the client is
non-functional**. Restoring the four deleted files (they are one `git show` away, at
`d671f47^`) is a prerequisite for the "client still works" gate in Step 6 of the loop,
and for the regression suites in Step 7 to run at all.

Restoring them is safe and reversible, and it does not conflict with the goal — the
files become deletable again later, once the Rust path is actually wired in and
references are gone.

## Deletion history — bounded and confirmed

Across the last 20 commits touching `client/`, `tools/`, `lib/`, exactly **6** files
were ever deleted, in two commits:

| Commit | Files | Live today? |
|---|---|---|
| `d671f47` | `client/js/assets.js`, `client/js/main.js`, `client/js/packed-bootstrap.js`, `tools/build.js` | **Yes — 2 of them are still referenced** |
| `a01f2e8` | `client/js/net/packets-1.13.2.js`, `client/js/net/protocol-1.14.4-reuse.js` | No — 0 references remain, these are genuinely dead |

Repo-wide reference scan (all `*.html`, `*.js`, `*.mjs`, `*.cjs`, `*.json`, excluding
`node_modules`/`.git`/`target`):

- Broken `src=`/`href=` in HTML: **exactly one** — `client/index.html -> js/main.js`.
- Broken `require()` in `tools/`: **zero**.
- Broken relative ESM import inside `client/js/`: **exactly one** —
  `client/js/game/serverpacks.js -> ../assets.js`.

So the d671f47 damage is precisely scoped: one dead entry point, one dead import,
one unloadable test suite. It is not a repo-wide rot.

## WASM has never been built in this checkout

`rust/build.mjs` targets `client/js/wasm/pkg` and copies
`gravrust_bg.wasm` to `lib/via/gravrust_bg.wasm`. Neither output exists:

- `client/js/wasm/` — absent entirely
- `lib/via/` — exists but is **empty**

The toolchain is present and working (`wasm-bindgen 0.2.129`,
`wasm32-unknown-unknown` installed), so this is simply "nobody ran the build", not a
toolchain problem. Confirmed separately:

- `cargo check --target wasm32-unknown-unknown` → **exit 0** (the prompt's claim holds)

This matters for the loop's Step 7 ("wire it in"): the output directory the build
writes to does not exist yet, and `client/index.html` points at the deleted
`js/main.js` rather than at any WASM loader. Creating the glue is therefore a real
build step, not a config tweak.

## Conflict to flag (not to silently resolve)

`AGENTS.md` requires shared fixes to be backported to every supported version branch.
The user's instruction explicitly overrides this: **work on `1.15.2` only, no backports.**
Per the user's own instruction this is flagged in the final report rather than followed
or ignored silently. No other branch will be touched.
