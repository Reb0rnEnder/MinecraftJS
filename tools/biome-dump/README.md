Generate water and fog colours from every biome in the pinned 1.13.2 client jar
(SHA-1 30bfe37a8db404db11c7edf02cb5165817afb4d9). The matching vanilla server jar
supplies dependencies. Run in a temporary directory to contain Java logs:

```sh
java -cp /path/to/repo/cache/1.13.2.jar:/path/to/server.jar /path/to/repo/tools/biome-dump/Dump.java /path/to/repo/client/js/world/water-biomes.js
```

This includes ocean and End biome IDs absent from the older biome metadata JSON.
