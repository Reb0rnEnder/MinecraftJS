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

The generator also accepts target-specific aliases from the official mappings:

```sh
java -cp client.jar:server.jar Dump.java output.json VERSION BOOTSTRAP COMMANDS PACKET BUFFER CLIENT_SHA1
```

For 1.14.4 the aliases are `qx ce ky je`; for 1.15.2 they are `so cr mp kv`.
Use that version's client and server jars together. Run in a temporary working
directory; this boots registries and constructs command managers without opening
a server port or touching a running server. The default aliases remain 1.13.2.

`tools/fixtures/commands-native.json` records an expanded 81-case target-version
oracle: selectors, redirects, invalid inputs, NBT/path syntax, ranges, slots,
particles, time and numeric bounds. `tools/test-command-oracle.mjs` compares
client cursor positions, unread/error status, and every parsed argument range.
1.13.2 retains its older single-quote/NBT-path restrictions. These cases are
regressions, not a claim to exhaust every possible command string.
