# Supplementary TTF skip correction

Native 1.17.1 TrueTypeGlyphProvider constructs its skip set with String.codePoints(). Match that behavior rather than splitting UTF-16 surrogate pairs. A real format-12 cmap fixture verifies that the supplementary glyph exists before testing skip; seven combined font regressions pass. Older character-based targets retain their native behavior.
