# Dimension debug line, air selection and configurable skin proxy

Updated 2026-10-24.

- In the normal 1.13.2 F3 overlay, the line immediately after
  `MultiplayerChunkCache` identifies the registered dimension:
  `minecraft:overworld FC: n/a`, `minecraft:the_nether FC: n/a` or
  `minecraft:the_end FC: n/a`. These names come from the pinned jar's dimension
  registration. The vanilla multiplayer client does not receive the server's
  force-loaded-chunk list, so its force-loaded count is `n/a`. Reduced-debug
  mode keeps the jar's shorter layout. This display change stays on 1.13.2.
- Cave air and void air are explicitly air in 1.13.2 and cannot be selected or
  stop a block raycast. The world selection-provider contract now preserves an
  explicit `null` shape instead of substituting a full cube; only `undefined`
  requests the generic fallback. That contract correction is shared with the
  older versions, which do not gain cave-air/void-air blocks.
- A separate skin/profile proxy is available from **Proxy Servers → Skin Proxy**
  and through the `skinProxy` setting in site configuration. It is backported
  to 1.12.2 and 1.8.9.

Example `config.json` entry:

```json
{"skinProxy":"https://proxy.example/?url=%R"}
```

`%u` inserts the undashed player UUID. `%R` inserts the percent-encoded target
URL. `%r` (or the legacy `%U` alias) inserts the target URL without encoding, for services that expect a path such as
`https://proxy.example/https://textures.minecraft.net/texture/...`.
Every placeholder is replaced. The configured endpoint must be HTTP(S) and
contain one of these placeholders. Blank retains the automatic MinecraftJS
proxy route. Site configuration supplies the default; saved user settings take
precedence. The same configuration is embedded by the existing `--config` build
option.

URL-based custom routes handle skin, cape and elytra images and the public Mojang session
profile fallback. They work independently of the chosen game-server relay,
including when no MinecraftJS HTTP proxy exists. The CORS service must return
the original PNG or profile JSON response with browser-accessible CORS headers.
Only these public texture/profile URLs use this template; account sign-in and
session authentication keep their existing routes.

Saving a changed template clears the skin records and rebuilds player visuals,
including the local hand and third-person model. A pending response from an old
record is ignored, so changing proxies cannot be overwritten by a stale download.
Cancel or an invalid template does not change settings or trigger a reload.

Trapdoor-forced crawling was not added: the user confirmed the version mismatch.
The pinned 1.13.2 sizing method only selects swimming size for its swimming,
gliding or Riptide state; a vanilla 1.13.2 server does not implement the later
trapdoor-crawling transition.

Validation: shared regression tests exercise URL encoding/raw formatting,
configuration precedence and persistence, independent CORS routing for PNG/JSON,
automatic-route fallback, invalid templates, GUI save/cancel and stale responses.
Selection tests cover explicit-null versus undefined shapes on every branch and
cave/void air in 1.13.2. F3 tests cover all three dimensions and reduced debug.
All native suites and production builds are checked as well.

The 2026-10-25 update changed `%u` to UUID and introduced `%r`/`%R` for URLs.
UUID-only templates fetch skin PNGs directly, including for players without a
textures property. Cape/profile requests use the automatic route in that mode.
