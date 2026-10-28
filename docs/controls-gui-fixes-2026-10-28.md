# Controls and related settings screens — 2026-10-28

Compared the pinned official client jars and mappings: ControlsScreen,
ControlList (including its row entries), AbstractSelectionList, OptionsList,
MouseSettingsScreen and AccessibilityOptionsScreen.

- Extract the Controls list's constructor geometry from bytecode: top 43,
  bottom height - 32, item height 20, width screen width + 45. The old top 63
  reserved an unused second row above the key list.
- Keep labels on integer GUI pixels. Categories do not receive a selection box.
- Use real change/reset widgets, native top-to-bottom keyboard traversal,
  disabled-reset skipping, focus scrolling, conflict colors, Escape unbinding,
  mouse rebinding and reset actions. Modern lists drag via the scrollbar.
- Mouse Settings uses native scrolling rows, 32 to height - 32, 25-pixel item
  spacing, with Done at height - 27. Focused sliders accept arrow keys.
- Accessibility uses its native grid at height / 6, title at 20 and Done at
  height / 6 + 144.

1.15.2 also extracts and implements its two additional accessibility controls:
Hold/Toggle Sneak and Sprint. Presses latch in Toggle mode, key repeats and
releases do not toggle, and losing gameplay focus clears held/toggled input.
These options are not backported to 1.14.4. The 1.15.2 biome-blend option is a
wide row before the video option pairs, as in that version's native init method.

Shared slider arrow-key support is backported through 1.8.9. The modern layout
changes apply to 1.14.4 and 1.15.2; older Controls screens retain their original
layout. Explicit browser-specific options remain. Native monitor/video-mode
selection has no direct browser equivalent and is not added as an inert control.

Checks: generated tables match jar extraction; behavioral tests cover layout
across GUI sizes, binding/reset/conflict behavior, real widget focus/scroll,
mouse rows and slider keys, accessibility controls and toggle input. Browser
checks exercise actual mouse and keyboard rebinding/reset/navigation in both
versions and capture the rendered Controls, Mouse and Accessibility screens.
This comparison does not certify every GUI as fully vanilla-identical.
