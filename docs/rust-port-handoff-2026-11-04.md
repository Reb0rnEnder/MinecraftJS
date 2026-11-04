# Rust port restoration — handoff notes (2026-11-04)

Written by the team lead for whoever picks this up next.

## Current state

- Branch `1.15.2`, local commit **`b765915` — "Restore full Rust port (203 sources) and fix the crate build"**.
- **NOT PUSHED.** The push was rejected with HTTP 403:

  ```
  remote: Permission to pkSmp/Gravrust.git denied to nickgencs.
  fatal: unable to access 'https://github.com/pkSmp/Gravrust.git/': The requested URL returned error: 403
  ```

  The local machine is authenticated as `nickgencs` / `realnickgencs`; the repository is owned by
  `pkSmp`. Reads are public, writes are not. There are no SSH keys installed and no `GH_TOKEN`/
  `GITHUB_TOKEN` in the environment, so there is no alternative push route from this machine.

  **To land it:** add `nickgencs` as a collaborator on `pkSmp/Gravrust`, push from an account that has
  write access, or push the commit to a fork.

- The commit is rebased onto the current remote head. Do not rebase blindly: `origin/1.15.2` was
  `d3babff` at the start of this work and moved to `b2950f1` ("Update LICENSE") mid-task.

## What the commit contains (208 files, +95,323 / -365)

- 203 `.rs` sources restored into `rust/gravrust-core/src/`.
- `rust/gravrust-core/Cargo.toml`: `web-sys` feature names were uppercase, which Cargo rejects
  (`web-sys does not have that feature`). Names are now validated against the crate index
  (44 features, 0 invalid). Two entries were invalid under **any** casing and were replaced rather
  than lowercased: `Fetch` -> `Request`/`Response`/`Headers`/`Url`, and `RequestAnimationFrame`
  (a `Window` method, not a feature). `Console` likewise is not a feature.
- Added the missing `rust/Cargo.toml` workspace, which `rust/build.mjs` already assumed (it runs
  cargo with `cwd=rust/`).
- 5 filenames that are not legal Rust module identifiers were renamed and wired through `#[path]`:
  `chunk-1.14.4.rs` -> `chunk_1144.rs`, `chunk-1.15.2.rs` -> `chunk_1152.rs`,
  `EntityRegistry-1.14.4.rs` -> `entity_registry_1144.rs`,
  `EntityRegistry-1.15.2.rs` -> `entity_registry_1152.rs`,
  `packet-bodies-1.14.4.rs` -> `packet_bodies_1144.rs`.
- 4 duplicate module base names were disambiguated, keeping **both** files every time:
  `net/connection.rs` + `connection_legacy.rs`, `screens/manager.rs` + `manager_legacy.rs`,
  `chunk.rs` + `world/chunk.rs`, and `world/mod.rs` preserved as `world/world_core.rs`.
- `.gitignore`: `target/` and `**/target/` were **not** ignored, exposing ~2,096 files / 1.39 GB of
  cargo output to accidental commit. Now ignored.
- Licence: `LICENSE` was GNU GPL v3 while `Cargo.toml` claimed MIT. The Unlicense was already landed
  upstream in `b2950f1`, so this commit does not modify `LICENSE`; it does set the SPDX field to
  `Unlicense` in `rust/gravrust-core/Cargo.toml` and adds `"license": "Unlicense"` to `package.json`.

## Verification actually performed

- `cargo check` exits **0** for host and for `wasm32-unknown-unknown`.
- All 205 tracked `client/js` files are untouched and byte-identical. **No JavaScript was deleted.**
- 0 build artifacts staged.

## The important caveat: ~79 files do not compile

They are gated behind an opt-in feature rather than deleted or hidden:

- Default build: green. `cargo check --features unsupported`: **fails with real errors** (this is
  deliberate proof the gate is not hiding healthy code).
- `src/game.rs` is an unfinished skeleton: 31 types defined nowhere in the crate, its constructor
  fills 3 of 50+ fields, and its method bodies are empty comments. It is superseded by `main_boot.rs`.
- ~70 files reference a module tree with **no Rust source at all**: `assets`, `audio`, `graphics`,
  `gui`, `i18n`, `input`, `inventory`, `network`, `runtime`, `util` — these are `client/js`
  *directory* names, not Rust modules. Several do not parse at all (e.g. `typeof` in `atlas.rs`,
  unbalanced braces in `chat.rs`).

**Consequence for the JS cleanup:** the JS counterparts of these files must NOT be deleted as
"ported". Deletion should be driven by an audit that confirms each module actually compiles *and* is
reachable from `lib.rs`.

## Known tokenizer artifact

The commit subject begins with a U+FEFF BOM because PowerShell's `Out-File -Encoding utf8` inserted
one when the message was written from a here-string. Harmless to git, but clean it up if the message
is ever rewritten.
