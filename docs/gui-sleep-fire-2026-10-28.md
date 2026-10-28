# GUI, narration, sleeping and fire follow-up — 2026-10-28

Native source: each pinned jar's button class and Chat Options array; official
1.14.4/1.15.2 mappings plus AbstractWidget, NarratorChatListener, EditBox,
CommandSuggestions, ServerSelectionList, LevelRenderer, ScreenEffectRenderer,
and legacy RenderPlayer/EntityPlayer sleeping code.

- Extract button text colors per version. 1.15.2 stays white on hover; the older
  versions keep their native gray/yellow behavior. Disabled text stays gray.
- Extract Chat Settings order from each target jar, use native row/title/Done
  positions, and implement Web Links, Prompt on Links and applicable Command
  Suggestions switches. Modern Chat includes Text Background Opacity. Zero
  chat width now reaches 40 pixels; zero chat scale hides the chat cleanly.
- 1.15.2 Accessibility contains working Sneak: Hold and Sprint: Hold switches.
  These are not added to older versions. Browser checks explicitly verify them.
- 1.14+ widget narration uses 750 ms mouse and 200 ms focus/label-change delays,
  translated button/slider/edit-box labels, binding/reset descriptions, server
  selection and selected command suggestions. All/System modes enable GUI
  speech; Chat-only does not. The existing chat/system filtering excludes the
  action bar, as vanilla registers no narrator listener for that message type.
  Speech depends on the browser's speech synthesis support. Native UI narration
  is not backported to versions that did not provide it.
- First-person sleepers render their own body. Legacy sleeping uses native
  -1.8 facing offsets; modern versions retain native eye-height offsets. Wake
  restores standing dimensions. Both variants keep their version's camera math.
- Fire overlays can use local fire/lava contact without waiting for a server
  burning flag, including Creative. Spectators remain excluded. Legacy clients
  now use blocks/fire_layer_1 rather than the modern block/fire_1 sprite; 1.8.9
  also needed the mesh-format/color imports previously hidden by that lookup.

Brigadier fixes apply to 1.13.2–1.15.2 only: branch selection matches Brigadier's
ordering rather than choosing the furthest failed branch; trailing separators,
compound NBT, time, selectors, item slots, criteria, paths, particles and integer
coordinate bounds are checked. Each target has an 81-case fixture generated
using its own vanilla command manager and client deserializer. Cursors and
argument spans match the native fixture, including older syntax restrictions.
The earlier-server autocomplete protocol remains unchanged in 1.8.9/1.12.2.

Checks include target-jar extraction, behavioral tests, the native command
fixtures and browser rendering/input/narration checks across supported versions.
This is scoped verification; full GUI and command parity remains unproven.
