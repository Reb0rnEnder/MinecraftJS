# Static hosting and standalone proxy

From the checkout of the Minecraft version you want to publish:

```sh
npm run build -- --static --out=dist/site \
  --proxy=minecraftjs,wss://proxy.example.com,MyProxy \
  --server=mc.example.com,MyServer
```

Replace the example endpoints with your own. Upload **everything inside dist/site**
to your static host. The output includes index.html, bundled JavaScript with its
mesh worker, style/icons, data, assets and config.json. It works in a subdirectory
and needs no Node process on the static host. `--format=directory` is an alias for
`--static`; `--config=path` reads the same proxy/server/skin-proxy defaults as the
single-file build. Each version checkout writes its own native assets/protocol.

The existing `npm run build -- --out=dist/client.html` still creates a standalone
HTML file. `npm run build -- --help` lists both forms. Saved player choices take
priority over site defaults; an explicit empty `proxies: []` no longer guesses
that a static host also runs a Minecraft proxy.

Run the backend separately:

```sh
npm start -- --proxy-only
```

This retains the WebSocket Minecraft bridge and the auth, skin, profile and
resource-pack HTTP routes, with their cross-origin headers. It serves no client
pages or game assets and skips jar/index loading entirely. PORT sets the listener
port (default 3000); expose it through your HTTPS/WSS endpoint for an HTTPS site.
`PROXY_ONLY=1 npm start` is equivalent. Without that option the proxy also hosts
the source client and its assets as before.

**Loopback target connections are blocked by default**, for both server-list
pings and logins. This includes 127/8, ::1, IPv4-mapped IPv6 loopback, localhost
names, unspecified addresses and DNS answers resolving to them. SRV targets are
also resolved and checked; sockets use the validated IP rather than resolving
again. To connect to a Minecraft server running on the same machine explicitly:

```sh
npm start -- --allow-loopback
# or: npm start -- --proxy-only --allow-loopback
```

`ALLOW_LOOPBACK=1` is the environment equivalent. This controls outbound proxy
targets, not whether a browser may connect to the proxy locally. LAN Minecraft
targets remain supported. Resource pack downloads retain their public-host
restriction, validate each redirect and pin DNS answers too; explicit loopback
opt-in also permits local pack testing.

# Resource and Eagler rendering fixes

Eagler cache clear/eviction now invalidates cached arm/entity geometry before it
can keep using destroyed textures. Player-head blocks and items honor embedded
SkullOwner texture profiles; each distinct profile has a distinct item cache key.
On Eagler V3 connections, foreign head URLs use skin-channel request 0x06 and the
upstream MD5 URL UUID, then share the existing skin reply decoder. Native Java
connections use the configured HTTP skin proxy. Malformed profiles fall back to
the default player head.

Resource packs now load models and their referenced textures from custom
namespaces, including custom texture folders, and correctly resolve minecraft:
parent/texture references. Pack priority remains intact. This supports ordinary
Minecraft JSON models; it does not add OptiFine CEM/CIT or Eagler custom mesh skins.

A brief 2026-10-27 ArchMC lobby connection accepted native protocol 578 and
returned an Eagler preset skin over WebSocket. No server resource pack was sent
during that observation. Packet/model/profile regression fixtures cover the
implemented paths; that observation does not establish full ArchMC compatibility.
