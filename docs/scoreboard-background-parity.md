# Native sidebar text background correction

2026-11-15. Sidebar rows/header now use this target's Options.getBackgroundColor defaults (0.3/0.4) and its absolute accessibility opacity when text backgrounds apply everywhere. Previously the client hard-coded different colors and ignored the accessibility setting.

Exact native Gui source anchors from 1.14.4 through 1.19.4: `cyv`, `dci`, `dkv`, `dwm`, `dzq`, `enq`. Two focused regressions pass on each target (12 across six branches), including the actual sidebar; browser bundles pass. Existing older row/header placement stays intact. 1.8.9–1.13.2 retain their fixed colors/layouts.

Custom score number formats, per-score display components and the later empty-objective header arrangement belong to newer releases and are not backported. See [1.20.3 history](https://minecraft.wiki/w/Java_Edition_1.20.3). This source batch does not rebuild distributions or certify full native parity.
