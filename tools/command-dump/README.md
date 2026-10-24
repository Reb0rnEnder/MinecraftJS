This oracle boots the pinned Mojang 1.13.2 command manager, serializes its complete
755-node Declare Commands packet, reads it back through the vanilla client, and
records Brigadier parse cursors and argument ranges. Normal regression tests use
the committed JSON fixture and do not require Java or a server.

To regenerate, put the matching vanilla server jar at /path/to/server.jar and use
a JDK with source-file launch. Run in a temporary directory to contain vanilla logs:

```sh
java -cp /path/to/repo/cache/1.13.2.jar:/path/to/server.jar /path/to/repo/tools/command-dump/Dump.java /path/to/repo/tools/fixtures/commands-1.13.2.json
```

The client jar must be first on the classpath; the server jar supplies Brigadier,
Gson and Netty dependencies. The fixture records the pinned client jar SHA-1.
