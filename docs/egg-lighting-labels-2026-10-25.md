# Turtle egg lighting and native GUI labels

The pinned 1.13.2 BlockTurtleEgg is not opaque and has light opacity 0. The
imported block metadata incorrectly marked its light filter as 15. The earlier
non-opaque/selection fixes preserved the support face but did not correct that
separate filter. Placing an egg therefore removed skylight from its cell and
darkened the entire support face. The shared block definition now overrides the
filter to 0, so both world lighting and meshing agree with vanilla.

Regression coverage compares the actual support sand quad's packed vertex colours
and light values with/without eggs for all 12 egg/hatch states, with smooth
lighting off and on. Selection/collision checks remain in the existing suite.

Vanilla InputMappings uses GLFW's printable name for letter/digit keys rather
than looking up nonexistent `key.keyboard.r` / `key.keyboard.1` entries. Those
browser codes now produce their printable names directly; special keys continue
to use the language file. GUI scale uses Auto/1/2/3, matching GameSettings in the
1.13.2 jar, instead of querying removed Small/Normal/Large keys.

GUI tests use the real English language file and actual controls/video widgets.
The legacy 1.12.2/1.8.9 labels were checked separately: they correctly retain
Auto/Small/Normal/Large and their LWJGL key names. Turtle eggs are not backported
to those versions, and their valid legacy GUI labels are retained.
