# Active 1.14.4 runtime and independent light updates

Implemented 2026-10-25. This development branch now starts the actual browser
client and proxy as **Java 1.14.4 / protocol 498**. The former 404-only runtime
restriction is removed. This is a working terrain/join milestone, not a claim
of complete 1.14.4 gameplay or visual parity.

## Runtime activation and native inputs

- Browser/server-list protocol, proxy ping/login defaults and advertised protocols
  now agree on 498. UI version labels, resource-pack request headers and creative
  toolbar storage identify 1.14.4. Existing 1.13.2 hotbars are not reinterpreted.
- Block, item, entity, biome, particle, sound and supporting tables come from the
  pinned minecraft-data revision. Block/item/entity/sound IDs and every block's
  state range/default were cross-checked with vanilla's native reports.
  `client/data/runtime-source-1.14.4.json` records input hashes and provenance.
- The verified client jar executes creative tab population and all 11,271
  selection/collision states. Resource-location tags resolve through native
  registries. Extractors run with the matching client/server jars and record errors
  rather than silently substituting cubes. The existing potion/effect/egg styling
  tables are retained for unchanged definitions; new content needs its own audit.
- Asset serving/builds now select the 1.14.4 jar and asset index. Recipes are read
  from `data/minecraft/recipes`, and recipe-book identity uses resource locations.
- Entity model extraction now handles list removal, the native oak-sign texture
  and the correct player constructor. Both player arm widths include all 14
  body/overlay fields and animate without the former missing-sleeve crash.

The 498 codec reuses field decoders only when the pinned schemas match by packet
name. Its reader supplies native positions, particle payloads and metadata types.
Changed packets use native handlers. Serverbound packets remap by name; position-
bearing interactions use native writers. Declare Recipes, commands and tag
updates decode in the actual server session. Common base pose/living metadata
insertions are adapted while retaining raw native metadata on entities.

## World/light lifecycle

Chunk packets now use the native section decoder. Independent light columns can
arrive before terrain and do not fabricate loaded geometry. Terrain replacement
retains current light; partial updates preserve omitted sections. Empty masks
clear their arrays, boundary light sections are retained, and both world queries
and worker slices sample light in sections with no terrain data.

Light updates dirty affected sections and their neighbors. Full terrain replacement
also invalidates removed geometry. Chunk unload clears pending light; world or
dimension reset clears the column lifecycle. Native air/void-air/cave-air states
are treated as empty for section counts.

A section dirtied while a mesh worker is building cannot accept that old snapshot.
Each build also has a token, so delayed replies from an earlier/retried job cannot
clear a newer job or overwrite its geometry. This shared worker fix is backported
to the maintained older clients; 498 layouts, registries and mechanics are not.

## Validation

- 29 native/bootstrap/protocol/chunk/world/font tests and the two shared worker
  snapshot tests pass. Native tests include coordinate bytes, metadata types,
  registry consistency, creative IDs, native model constructors, light before/
  after terrain, empty/partial masks, boundary sections, unload/reset, full
  replacement and delayed-worker behavior.
- A real TCP session against the user's vanilla 1.14.4 server passes status,
  compression, login, teleport and keepalive exchanges and decodes terrain/light.
- The source-served browser client joins through a separate test proxy and
  renders the local world. The self-contained development HTML was also loaded
  over HTTP, joined and rendered terrain, then disconnected/reconnected without
  a browser exception. The build uses the actual 1.14.4 assets and native models.
- The stable 1.13.2 font fix was pushed separately and is included on this branch.
  Stable version branches retain their own protocols and assets.

To regenerate/check inputs:

```sh
node tools/port-1.14.4/prepare.mjs
node tools/port-1.14.4/reports.mjs --check
node tools/port-1.14.4/runtime-data.mjs
node tools/port-1.14.4/finalize-runtime-data.mjs
node --test tools/test-1.14.4-*.mjs tools/test-font-providers.mjs tools/test-worker-snapshots.mjs
npm run build
```

`runtime-data.mjs` imports the pinned upstream tables; `finalize-runtime-data.mjs`
executes the pinned vanilla client with matching server dependencies. Generated
logs, jars and the test server stay outside Git. Restart an already-running proxy
to pick up the version/asset-serving changes; browser JavaScript should be reloaded.

## Remaining port work

Complete native entity metadata/model/animation consumers, new mob renderers,
workstation/merchant interfaces and behavior, native particle sprite sources,
movement poses/crawling, recipe-book/tag ingredient behavior, GUI/F3 extraction,
and remaining packet families not exercised by this milestone. Legacy compatible
menu layouts currently bridge the basic inventory interfaces; that does not make
new workstations visually or behaviorally complete. Cross-version Eaglercraft
translation and full online-mode/third-party-relay validation are not claimed.

Continue checking against the pinned vanilla jar and real server. Keep this build
labeled development until those remaining parity gates pass.
