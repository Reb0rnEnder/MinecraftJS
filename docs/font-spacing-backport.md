# Font metrics backport

Native 1.16.5 GlyphInfo adds the bold offset even to zero advances. Provider advances (including negative spacing) must be retained by measurement and layout. This patch preserves the target font loader and Unicode behavior. Native bitmap spaces are supported only by the 1.19.4 target; 1.13.2–1.18.2 builders explicitly skip them. No 1.20 reference/Unihex/filter provider or Japanese GUI row is introduced.

Reviewed the exact target client classes (1.13.2 cii/cip; later official GlyphInfo/BitmapProvider mappings). Six provider/spacing regressions pass for this target. 1.8.9/1.12.2 use a separate renderer.
