# Prompt for the next AI — complete and polish the Rust rewrite

Copy everything below the line into a fresh session.

---

## ROLE

You are completing a JavaScript → Rust/WebAssembly rewrite of a Minecraft 1.15.2
browser client. A previous team restored the Rust port and pushed a working
baseline. Your job is to finish the migration: make every ported module compile,
verify it against the JavaScript it replaces, wire it in, remove the now-duplicate
JavaScript, deploy, and repeat until the rewrite is complete and polished.

## REPOSITORY AND ACCESS

- Repo: <https://github.com/pkSmp/Gravrust/tree/1.15.2>
- **Work ONLY on branch `1.15.2`.** Never touch `1.19.4` or any other branch.
  Never create a new version branch. Never merge across versions.
- Remote: `https://github.com/pkSmp/Gravrust.git`
- Auth token: **supplied separately by the user — never store it in this file,
  in any committed file, or in `.git/config`.**

  > Ask the user for the token before your first push. Prefer a fine-grained token
  > limited to this repository with only Contents: read/write. Do not commit it or
  > echo it into logs. Pass it inline per push so it is never persisted:
  > `git -c credential.helper= push "https://pkSmp:$TOKEN@github.com/pkSmp/Gravrust.git" 1.15.2:1.15.2`
  >
  > If GitHub rejects the push with `GH013 Push Protection` / "Push cannot contain
  > secrets", a credential-shaped string has been written into a tracked file. Remove
  > it from the file and amend the commit — do not use the "allow secret" URL.

## STARTING STATE (verified 2026-11-04)

- Remote `1.15.2` is at **`1cc261a`**. Confirm with
  `git ls-remote origin refs/heads/1.15.2` before doing anything.
- 205 JavaScript files tracked under `client/js/`.
- 203 Rust files in `rust/gravrust-core/src/`.
- **The crate compiles**: `cargo check` exits 0 for host and `wasm32-unknown-unknown`.
- **119 modules compile; 80 are gated** behind `#[cfg(feature = "unsupported")]`
  because they reference a module tree that does not exist yet.
- `cargo check --features unsupported` **fails** — those are the real remaining errors.
- **No JavaScript has been deleted.** All 205 files are intact.

## READ THESE FIRST — they are load-bearing

1. `rust/gravrust-core/src/lib.rs`
   The header is an **authoritative provenance map**: 195 of 203 modules name the
   exact `client/js/...` file they port, e.g.
   `//!   zoom.rs      <- client/js/game/zoom.js`.
   The file also splits the crate into the compiled set and the `unsupported_port`
   set, and explains why gated modules were quarantined rather than deleted.

2. `docs/js-deletion-audit-2026-11-04.md`
   **Read this before deleting anything.** It established that of the 43 JS files
   whose citing Rust modules all compile, **43 of 43 are still referenced** by live
   client code, build tooling or tests. Nothing is deletable yet.

3. `docs/rust-port-handoff-2026-11-04.md`
   Prior-session handoff: what was fixed, what remains, and known traps.

4. `AGENTS.md`
   Multi-version maintenance rules. Note it requires backports to other version
   branches — **the user has overridden this: work on `1.15.2` only and do not
   backport.** Flag this conflict in your final report rather than silently
   following or ignoring it.

5. `rust/port-status.json` and `port-manifest.json` — the porting status records.

## THE LOOP — repeat until the rewrite is complete and polished

Work one module (or one small coherent group) at a time. Do not batch-delete.

### Step 1 — Document what the JavaScript does
Pick the next JS file. Read it fully. Write down, in a scratch note:
- its public surface (exports, entry points, side effects)
- the algorithms and data structures it owns
- its dependencies on other JS modules and on browser APIs
- whether it is *portable logic* or *browser glue*

**Browser glue stays JavaScript.** The crate documents DOM/WebGL/WebGPU/WebSocket/
WebAudio/workers/model-baking as deliberately un-ported. Never port or delete glue.

### Step 2 — Find the best-matching Rust file
Use the provenance header in `lib.rs` and the module's own header — **not filename
similarity**. This is the mistake that broke the previous audit. Note whether the
module is in the compiled set (119) or the gated set (80).

### Step 3 — Fix the Rust until it compiles
- If the module is gated: make it compile, then **move it out of `unsupported_port`
  into the compiled set**. Common blockers are references to a module tree that
  does not exist (`crate::gui::*`, `crate::assets`, `crate::input`, `crate::runtime`,
  `crate::network`). Several gated files do not even parse (e.g. a `typeof` keyword
  in `atlas.rs`, unbalanced braces in `chat.rs`).
- Never delete a file to make the build pass. Never stub a function to silence an
  error. If something genuinely cannot be fixed, report the exact error and leave
  the file in place.
- Gate: `cargo check` exits 0, and `cargo check --features unsupported` has one
  fewer error than before.

### Step 4 — Verify equivalence against the JavaScript
Confirm the Rust actually implements the JS behaviour, not an approximation:
- compare the public surface, constants, and edge cases side by side
- prefer a test that pins the behaviour (see existing tests in the crate and
  `tools/wasm-parity.mjs`)
- if you cannot verify a behaviour, **say so** rather than asserting parity

### Step 5 — Remove duplicates
Only after Steps 3 and 4 pass. Look for:
- a JS file superseded by a now-compiling Rust module
- duplicate Rust modules (known collisions were disambiguated into
  `connection_legacy.rs`, `manager_legacy.rs`, `chunk.rs` vs `world/chunk.rs`,
  `world/world_core.rs` — confirm these are genuinely distinct, and merge or drop
  the losers only if you can prove they are dead)
- stale `#[path]` wiring and unused aliases

### Step 6 — Remove the JavaScript — ONLY when truly superseded
Before deleting any JS file, **all four** must hold:
1. its Rust counterpart compiles and is in the compiled set;
2. equivalence was verified in Step 4;
3. **nothing references it any more** — grep `client/*.html`, `client/js/**`,
   `tools/**`, `rust/build.mjs`, `package.json` for the basename. The previous
   audit found 43/43 candidates still referenced; check again, do not assume;
4. the client still works.

If any condition fails, **do not delete the file** — leave it and note why.

### Step 7 — Deploy
- Build: `node rust/build.mjs` (emits WASM to `client/js/wasm/pkg` and
  `lib/via/gravrust_bg.wasm`).
- Run the real regressions: `node tools/test-client-regressions.mjs`,
  `node tools/test-graphics-backends-browser.mjs`, `npm run test:wasm`.
- Keep `rust/port-status.json`, `port-manifest.json` and checksums consistent with
  reality (AGENTS.md requires updating source commits, manifest and checksums together).
- Commit only task files. **Do not commit** loose screenshots, `node_modules/`,
  `dist/`, `cache/`, `logs/`, `test-results/`, or `rust/target/`. `target/` is
  git-ignored — keep it that way; it previously exposed ~2,096 files / 1.39 GB.
- Push to `origin/1.15.2` and verify the remote SHA matches local.

### Step 8 — Loop
Return to Step 1 with the next file. Continue until the Rust rewrite is complete
and polished.

## HARD RULES

- **Branch `1.15.2` only.** No other branch, no new branches, no cross-version merges.
- **Never delete JavaScript that is not proven superseded.** Deleting working JS is
  the worst outcome in this task.
- **Never fake a green build** — no deleting or stubbing modules to silence errors.
- **Report honestly.** Distinguish "verified", "compiles but unverified", and
  "unfinished". Do not claim a test passed if you did not run it.
- Preserve user data: screenshots, local servers/worlds, shader packs, session files
  and configuration are not yours to commit or delete.
- Do not fabricate parity claims against the Minecraft Wiki or Java code.

## DEFINITION OF DONE

- Every remaining gated module either compiles and is wired in, or is reported with
  a specific reason it cannot be.
- Every deleted JS file has documented, verified Rust equivalence and zero remaining
  references.
- `cargo check` and the real regressions pass.
- `rust/port-status.json` and `port-manifest.json` reflect reality.
- All work is pushed to `origin/1.15.2`, remote SHA verified.
- A written report of what was verified, what was not, and what remains.

Report blockers as blockers. A truthful incomplete result beats a false green one.
