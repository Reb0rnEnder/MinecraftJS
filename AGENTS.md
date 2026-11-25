# Multi-version maintenance

- Shared correctness and performance fixes must be reviewed and backported to every applicable existing supported version branch. Use each target's native behavior; implementations may differ by release.
- Do not backport features, protocol fields, GUI rows or assets introduced after an older target. Preserve native version differences rather than forcing one layout everywhere.
- Use the existing named branches/worktrees (1.8.9, 1.12.2, 1.13.2, 1.14.4, 1.15.2, 1.16.5, 1.17.1, 1.19.4, 1.20.6, 26.3, and later explicitly created targets). Do not replace an existing target with a duplicate branch.
- 26.3 and later targets ship unobfuscated with the resource and data packs inside the client jar. Extract against the native class names and the jar's own assets; never substitute an official-mapping file, and never reintroduce obfuscated names from an older target.
- Do not carry a mapping download, an external texture fetch or a data-generator step into a target whose jar already contains that data. Verify the jar layout before assuming the 1.20.6 pipeline transfers unchanged.
- Verify parity changes against the exact version's native code and relevant Minecraft Wiki history. The current Wiki page may describe newer behavior. Record unavailable data honestly; do not fabricate Java, server or graphics metrics.
- Run relevant regressions for every affected target. When rebuilding distributions, update the source commits, manifest and checksums together.
- Preserve user screenshots, local servers/worlds, shader packs, session files and configuration. Stage task files explicitly; do not commit these local inputs.
