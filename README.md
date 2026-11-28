# MinecraftJS 26.3 port

The named **26.3** branch is under development. The default client protocol is
**777** and the runtime data/assets and public version identity target **26.3**.
Native offline login, Configuration and the Play/Game path are implemented; a
real browser joined a live 26.3 server and rendered terrain, entities and the
HUD. Full feature parity is not claimed.

The 26.3 client ships unobfuscated with its resource and data packs inside the
client jar. The port extracts against native class names and does not
redistribute Mojang jars, extracted assets, caches, screenshots or local servers.

The [full-parity checklist](docs/parity-checklist-26.3.md) separates accepted
work, partial implementations and unverified scenarios. The
[transition plan](docs/transition-26.3.md) and
[ordered task ledger](docs/transition-26.3.tasks.json) track the remaining
gates. The port starts from the 1.20.6 baseline at `761970e`; inherited gaps are
carried forward rather than relabelled.

## Setup

```sh
npm ci
npm run prepare:26.3
npm run test:26.3
```

`prepare:26.3` downloads and SHA-verifies the pinned native client jar and
libraries into `cache/port-26.3/`. The cache, jars and extracted assets stay
local and are not committed.

With a disposable native 26.3 server running on `127.0.0.1:25568`:

```sh
npm run probe:26.3
npm run client-net:26.3
```

The probe checks offline login and Configuration. `client-net:26.3` opens the
native Play path and exercises the serverbound connection without a browser.

## Run the client

Start the proxy from this worktree:

```sh
PORT=3003 ALLOW_LOOPBACK=1 npm start
```

Open `http://localhost:3003/` and join a compatible 26.3 server. Loopback is
explicitly allowed for local testing; deployments block it by default.

## Inherited implementation baseline

The 26.3 target inherits the 1.20.6 implementation, including some
renderer/gameplay helpers whose last dedicated parity review was on 1.19.4.
Those helpers are tracked as inherited findings rather than silently certified.
The default network protocol, runtime registries, block/entity data,
visual-state tables, assets and public identity are native 26.3. Older supported
clients remain on their existing named branches.

This is not a full-parity release, and no prebuilt 26.3 distribution is claimed.
