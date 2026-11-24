# Native UI acceptance — 1.20.6

Updated 2026-11-23. This is an implementation ledger, not a full-parity declaration.

Native input: Mojang client SHA-1 `05b6f1c6b46a29d6ea82b4e0d42190e42402030f`, official mappings in `tools/port-1.20.6/target.json`.
The [1.20.5 release notes](https://www.minecraft.net/en-us/article/minecraft-java-edition-1-20-5) describe the menu redesign inherited by this target. The exact target classes and assets determine behavior.

| Area | Implemented and checked | Remaining acceptance |
| --- | --- | --- |
| Backgrounds | Panorama behind out-of-world menus; fixed 10-degree panorama pitch; native menu/list textures and separators, including in-world variants; six `box_blur` passes and native blur threshold/setting | Inspect every exceptional screen; dimension loading backgrounds; the End poem's `RenderType.endPortal()` fill (needs the modern `rendertype_end_portal` shader, see UI-05) |
| Title | Native logo dimensions/sprites, clickable copyright/credits footer, Hide Splash Texts; first-show fade (panorama over one second, then widgets, with widgets hidden below alpha 4/255) checked against 12 native `TitleScreen.render` frames; integer logo/button centring | Keyboard/controller focus and all title edge cases |
| Options | Native 61/33 header/footer and ten body buttons, Online submenu, Credits & Attribution submenu, disabled unavailable telemetry | Native integrated-server/Realms product scope remains unimplemented |
| Video/Accessibility | Extracted target option order; menu blur in both pages; hide-splash and narrator-shortcut controls; boolean AO; frame-limit increments | Every tooltip, fixed/scrolled child pages and account-dependent controls. GUI scale now uses native `Window.calculateScale` (Unicode rounding, framebuffer bound), checked against 72 native results, and cycles over 0..`calculateScale(0, forceUnicode)` |
| Resource packs | No pre-1.20.5 header/footer list overlays; nearest-filtered icons; the Default pack.png is ready on the first frame; native 200-wide lists separated by 30 GUI pixels, 33-pixel header/footer, title/drop text, native sprites, keyboard select/reorder, native incompatible colors/text/prompts, `supported_formats` ranges, translated built-in names | Moving Default within the resource stack, native drag/drop confirmation/import flow, full keyboard focus transitions and pack filtering metadata |
| Credits | Native JSON content, attribution/licenses link confirmation, menu return callback without respawn, native speed modifiers and reverse scrolling | End-poem portal background and frame-time interpolation |
| Fonts/Language | Existing provider implementation retained; exact two Font Settings options extracted; Language uses the native 33/53 header/footer, `options.language.title`, the accuracy warning, code-sorted entries and double-click to confirm | Reference/filter/Unihex providers, Japanese glyph variants |
| Lists | 1.20.5+ AbstractSelectionList: list background only inside the list (texture offset getRight()/getBottom()+scroll), separators, scrollbar at realRowLeft + rowWidth + 10, white selection outline when focused; native row widths (Options 310, Key Binds 340, servers 305) | Narrated keyboard navigation for every list |
| Statistics | Native StatsScreen: 33/58 layout, three 120-wide tabs, top-aligned loading dots, name-sorted General list, six sprite columns with native sorting and tooltips, mob rows; stats decoded through the native stat_type/custom_stat/block/item/entity registries with the native Block.asItem pairs and Java-verified formatters | Live server counter comparison |
| Key Binds | Native 33/33 layout, 340-wide rows, label at row left, key/Reset buttons placed from the scrollbar, red conflict bar, `[ key ]` conflicts and duplicate tooltip, Reset All/Done footer | Narration for each binding row |
| Advancements | Native AdvancementsScreen: title header and Done footer around the 252x140 window, sprite tabs (only with more than one root), the selected tab's title, frame/box/title_box sprites with the progress-split hover box, frame-coloured descriptions, native line fitting, wheel scrolling and the advancements key closing to the game | Live server tree and toast acceptance |
| Social Interactions | Native 1.20.6 screen: header/footer, background panel and search icon sprites, bordered 200x15 search box, list from 88 to 88 + max(52, height - 144), mute/unmute/report sprites with 500 ms tooltips, fixed 200-wide blocking hint, scroller sprites and return to the opening screen | Abuse reporting needs a signed Microsoft session, so Report keeps its native disabled state |
| Loading overlay | The Mojang Studios logo samples linearly (LoadingOverlay.LogoTexture blur + clamp), as on 1.16.5+; 1.14.4/1.15.2 and older keep nearest sampling | |
| Pause / multiplayer warning | Pause uses the native GridLayout (padding 4/4/4/0, 50 above the first row, aligned 0.5/0.25) and Player Reporting in place of Open to LAN on remote servers, matching native geometry at four sizes. The multiplayer warning uses the native centred WarningScreen layout: bold title, bordered FocusableTextWidget, 17-pixel Checkbox sprites, then Proceed/Back | Keyboard focus/narration on the warning text widget; full visual capture |
| Other screens | Existing implementations retained | Social, inventories/workstations, accessibility narration and all inherited UI findings still require target acceptance |

## Reproducible evidence

- `tools/port-1.20.6/gui-data.mjs --check` derives 25 Video, 24 Accessibility, 17 Chat, 5 Mouse and 2 Font options from mapped native getters.
- `tools/port-1.20.6/ui-layout-fixtures.mjs --check` executes the native Java layout classes, using size-only widget stand-ins at four logical resolutions. It verifies geometry, not native text rasterization or whole-screen pixels.
- `tools/generate-stat-registry.mjs --check` and `tools/stat-items.mjs --check` regenerate the stat registries and native Block.asItem()/BlockItem.getBlock() pairs from the pinned client; `tools/test-stats-screen.mjs` checks decoding, Java-verified formatters (160 values compared with java.text), lists and geometry.
- `tools/port-1.20.6/ui-state-fixtures.mjs --check` runs native `Window.calculateScale` (6 sizes × 6 requests × Unicode) and `TitleScreen.render` fade state from the unmodified client classes.
- `tools/test-1.20.6-ui.mjs` checks GUI scale/cycling, title fade, Language/Pause geometry, the warning layout and checkbox sprites, as well as option geometry/construction, native blur definition, resource-pack sprites/compatibility/keyboard actions and menu-credits lifecycle.
- `PLAYWRIGHT_MODULE=... node --test tools/test-menu-blur-browser.mjs` executes WebGL 2, WebGPU and software rendering. The six-pass 31×19 test agrees with an independent box-filter reference within one RGBA channel value on WebGL and exactly on the other two backends. This is not a gameplay performance measurement.
- Chrome smoke captures of Title, Options, Accessibility, Online, Credits & Attribution, and Resource Packs are in ignored `cache/port-1.20.6/ui-audit/`; no console/page errors or missing required textures were recorded.
- UI/Creative checkpoint gate: 152 tests passed, zero skipped. The later foliage checkpoint raises the recorded target gate to 162; see the [current parity checklist](parity-checklist-1.20.6.md). These source batches do not rebuild published distributions.

## Version applicability

The panorama-menu redesign, menu blur, new title footer/navigation and narrator-hotkey row belong to the 1.20.5+ target. `supported_formats` belongs to 1.20.2+. Existing older targets must retain their own layouts/assets and format rules. Native pack-entry sound/localization differences and inherited resource ordering are still part of the cross-version audit; they are not claimed as fully accepted backports here.

## Creative inventory follow-up

The empty placeholder catalog caused the reported `background` crash. Native `CreativeModeTabs` now supplies all eight feature combinations and operator permission variants, retaining stable 1.20 content and gating 1.21 experiments. All 1,694 distinct native stacks preserve data-component patches and match native codec bytes after decoding and re-encoding. Tab and scrollbar sprites are native 1.20.6 sprites. A browser check rendered every visible tab and placed a component-bearing enchanted book into the hotbar; the isolated native server accepted its stored enchantment.

The native potion codec has no later-version `customName` field; the generated schema now explicitly corrects that upstream mismatch. Item mechanics, potion/effect metadata consumers, dynamic registry remapping and complete inventory interaction acceptance remain open.

Shared native exception presentation was backported to all nine older targets; native saved-toolbar metadata/item limits were also corrected on 1.16.5–1.19.4. All 76 relevant old-target regressions passed. The 1.20.6 component catalog and sprites are target-specific and were not copied into older versions.

## GUI-scale backport

Every older target shared the same pre-1.13 loop with a cycle capped at 3 and no Unicode rounding. Each now follows its own decompiled client. In 1.8.9/1.12.2, `ScaledResolution` rounds odd Unicode-font scales down (except 1), recomputes after a language/Unicode change and keeps the `& 3` cycle. In 1.13.2–1.16.5, `calculateScale` rounds up and the option uses `remainderUnsigned(value + 1, max + 1)`. In 1.17.1–1.19.4, the option cycles over a 0..max list and toggling Force Unicode resizes the display. `tools/test-gui-scale.mjs` covers each branch. Language, Pause and warning layouts are 1.20.5+ designs and were not backported.

## Statistics backport

Every 1.13+ target still used the 1.12 statistics screen and decoded the 1.13 award-stats packet by name, so opening Statistics crashed (1.14.4+) or misread the packet (1.13.2). All eight targets now decode through their own native registries and draw their own native screen. On 1.13.2–1.19.4 that is the stats_icons screen (General/Items/Mobs, 375-wide item rows): General keeps registration order until 1.16 sorts it, and 1.13.2 has its own mob-row offsets. 1.20.6 uses the sprite screen above. Registry order comes from each target's data-generator report. 1.13.2 has no report, so its order comes from the decompiled StatList. The tutorial's tree and planks checks now read the same counter, using each release's native TREE_BLOCKS set or tag.

## HUD bars and tutorial

The 1.20.6 legacy-sheet adapter mapped icons.png v 64/69 (the old experience bar) to the jump-bar sprites, so the experience bar was drawn blue. The two bars now map to their own sprites. The tutorial on every 1.13+ target identified trees, logs and planks by 1.12 numeric ids and `state >> 4` block ids, so hovering, punching and pickups never advanced it. Each target now follows its decompiled steps: `#logs` and `#planks` block/item tags, and for find-tree the native TREE_BLOCKS set (1.13.2-1.18.2) or `#completes_find_tree_tutorial` (1.19.4+). On 1.20.6 the tutorial toast uses the `toast/*` sprites.

## Horse inventory

Since 1.20.5 the horse-screen packet carries the chest column count, not the container size, and we used it as the size. A plain horse therefore got a 0-slot window, and its player-inventory slots overlapped the saddle and armour slots. The screen now follows HorseInventoryMenu: the saddle slot is active only when the animal is saddleable (a tamed adult, never a llama), the armour slot only for horses and llamas, and chest slots use 5 columns or the llama's strength. It draws the native chest/saddle/armour sprites, titles the window with the animal's name and previews the animal following the mouse. 1.13.2–1.19.4 had the same 1.12 screen (fixed five columns, slot backgrounds always drawn, always titled "Horse"). Each now uses its own native rules: before 1.16 every non-llama horse is saddleable. Their slots, columns and titles are fixed; the mob preview is 1.20.6-only for now.

## Removed texture sheets

A scan of every GUI texture path in the client against the pinned jar found four screens still drawing 1.20.1 sheets that 1.20.2 removed, so their art was invisible. They now draw the native sprites. The villager trading screen uses villager.png plus the container/villager sprites, with native 88-wide offers, the struck-through discount count, the integer scroller step and VillagerData experience thresholds. The bundle tooltip uses the background, slot and blocked_slot sprites. The recipe-book toggle uses recipe_book/button and the chat-modified tag uses icon/chat_modified. Every remaining sheet path is covered by the 1.20.6 sheet adapter.

## Entity metadata (gameplay)

1.20.6 decoded every entity's metadata through the 1.19.4 accessor table. tools/port-1.20.6/metadata-fixtures.mjs now generates the native 1.20.6 table from the pinned client. Fields whose layout changed are read by native symbol: LivingEntity effect particles (formerly a colour), area-effect cloud waiting/particle, llama strength/variant (the carpet moved to the body slot), horse variant, and chested-horse chests. A field-by-field dump also found consumers still using 1.12 positions: zombie and skeleton arms now follow Mob.isAggressive, drowned/curing/stray conversions shake the model, shulker peek and colour are no longer swapped, and witch drinking reads DATA_USING_ITEM. Horse armour from the body slot now renders through the native horse_armor model layer, with dyed leather.
