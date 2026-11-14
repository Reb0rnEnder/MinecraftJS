# Native font audit

The default 1.20.6 font contains `reference` providers. Ignoring these made the
whole default set empty, leaving an obsolete ASCII fallback with no glyphs for
Polish accents. Loading only the jar is also insufficient: its Unifont include
is a placeholder overridden by the pinned asset index.

Implemented recursive, layered and namespaced references, inherited `uniform`
and `jp` filters, native Unihex ZIPs/size overrides and lazy glyph atlases.
Native Unihex metrics use integer division and half-pixel bold/shadow offsets.
Custom bitmap and TTF providers remain eligible when their filters allow them.
Negative and zero advances now participate in measurement and bold layout.

Language → Font Settings now opens the native two options, Force Unicode Font
and Japanese Glyph Variants, in the extracted order. Changes refresh chat layout,
entity labels and sign text while preserving chat history. The Japanese default
uses the host browser locale, the browser equivalent available for Java's OS locale.

Evidence: pinned client SHA-1 `05b6f1c6b46a29d6ea82b4e0d42190e42402030f`,
`UnihexProvider`, `GlyphInfo`, `FontSet`, `BitmapProvider.Definition`, `Options`
and `FontOptionsScreen`, plus the pinned asset index.
The native Java oracle records **78 glyph cases**, including Polish letters,
CJK/Japanese variants, emoji, all four Unihex bitmap widths, blank glyphs and
overlapping overrides. Tests compare advances and uploaded CPU pixel hashes.
Additional checks cover references, pack priority, cycles, reloads, custom fonts,
spacing, option actions and existing TTF rasterization. The target gate passes
**206 tests**; its preceding native schema/data oracles also pass.

History: [23w17a](https://feedback.minecraft.net/hc/en-us/articles/15245037698701-Minecraft-Java-Edition-Snapshot-23w17a)
introduced reference/Unihex and removed legacy Unicode providers;
[1.20.5](https://www.minecraft.net/ja-jp/article/minecraft-java-edition-1-20-5)
added provider filters and Japanese variants. The versioned
[Wiki history](https://minecraft.wiki/w/Java_Edition_1.20.5) agrees.
These additions are not backported to earlier targets.

Shared backports: 1.13.2–1.19.4 receive native advance/bold corrections (42
regressions passed across seven worktrees). Native bitmap-space support is
corrected only in 1.19.4; inspected 1.13.2–1.18.2 builders explicitly skip spaces.
1.8.9/1.12.2 use a different font renderer and have no provider-stack change here.

Not certified: authenticated WebMC resource-pack rendering, physical backend
screenshots, every malformed pack/font graph, complete bidi/complex script
shaping, and CFF/OpenType-specific acceptance. Existing TTF support alone does
not establish those. Banner and hanging-sign consumers are separate work.
