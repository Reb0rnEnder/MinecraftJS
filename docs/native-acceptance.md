# Disposable native-server acceptance

`tools/probe-native-acceptance-browser.mjs` owns a temporary server directory,
separate native server process and optionally its own proxy. It verifies the
pinned matching server jar and copies the already accepted EULA file. It never
connects to or edits the user's server/world. `KEEP_TEST_WORLD=1` retains the
otherwise disposable test directory for investigation.

Both 1.16.5 and 1.17.1 pass the browser/server run with Fabulous enabled in WebGL 2:

- Survival split-stack pickup/place, shift-click merge, hotbar-number swapping,
  stack dropping, drag distribution, double-click collection and chest transfer.
- Creative middle-click cloning. Every operation is checked against the actual
  Java server's player inventory NBT, rather than only local prediction.
- Nether, End and Overworld travel, preserving inventory and rendering terrain.
- For 1.17.1, a dimension spanning -64..319, with platforms at Y=304 and Y=-32,
  proves live high/negative terrain, lighting, collision and worker rendering.
  The dimension is imported only into the disposable world's WorldGenSettings
  using the native inline LevelStem type supported by this target.
- No reported browser errors, relevant packet/mesh warnings or crash. These runs
  complement the packet fixtures and three-backend isolated graphics checks.

This covers the listed sequences. It does not claim exhaustive coverage of every
menu, equipment combination, authenticated account service, resource/shader
pack, hardware adapter or rare release-note behavior. World generation/AI are
provided by Java. Hardware performance is not inferred from software rendering.
