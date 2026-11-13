# Native UI acceptance — 1.20.6

Updated 2026-11-14. This is an implementation ledger, not a full-parity declaration.

Native input: Mojang client SHA-1 `05b6f1c6b46a29d6ea82b4e0d42190e42402030f`, official mappings in `tools/port-1.20.6/target.json`.
The [1.20.5 release notes](https://www.minecraft.net/en-us/article/minecraft-java-edition-1-20-5) describe the menu redesign inherited by this target. The exact target classes and assets determine behavior.

| Area | Implemented and checked | Remaining acceptance |
| --- | --- | --- |
| Backgrounds | Panorama behind out-of-world menus; fixed 10-degree panorama pitch; native menu/list textures and separators, including in-world variants; six `box_blur` passes and native blur threshold/setting | Inspect every exceptional screen; native end-poem portal and dimension loading backgrounds |
| Title | Native logo dimensions/sprites, clickable copyright/credits footer, Hide Splash Texts | Native initial fade, keyboard/controller focus and all title edge cases |
| Options | Native 61/33 header/footer and ten body buttons, Online submenu, Credits & Attribution submenu, disabled unavailable telemetry | Native integrated-server/Realms product scope remains unimplemented |
| Video/Accessibility | Extracted target option order; menu blur in both pages; hide-splash and narrator-shortcut controls; boolean AO; frame-limit increments | Every tooltip, dynamic GUI-scale limit, fixed/scrolled child pages and account-dependent controls |
| Resource packs | Native 200-wide lists separated by 30 GUI pixels, 33-pixel header/footer, title/drop text, native sprites, keyboard select/reorder, native incompatible colors/text/prompts, `supported_formats` ranges, translated built-in names | Moving Default within the resource stack, native drag/drop confirmation/import flow, full keyboard focus transitions and pack filtering metadata |
| Credits | Native JSON content, attribution/licenses link confirmation, menu return callback without respawn, native speed modifiers and reverse scrolling | End-poem portal background and frame-time interpolation |
| Fonts/Language | Existing provider implementation retained; exact two Font Settings options extracted | Reference/filter/Unihex providers, Japanese glyph variants and native Language/Font Settings navigation |
| Other screens | Existing implementations retained | Pause, multiplayer/safety, social, inventories/workstations, accessibility narration and all inherited UI findings still require target acceptance |

## Reproducible evidence

- `tools/port-1.20.6/gui-data.mjs --check` derives 25 Video, 24 Accessibility, 17 Chat, 5 Mouse and 2 Font options from mapped native getters.
- `tools/port-1.20.6/ui-layout-fixtures.mjs --check` executes the native Java layout classes, using size-only widget stand-ins at four logical resolutions. It verifies geometry, not native text rasterization or whole-screen pixels.
- `tools/test-1.20.6-ui.mjs` checks geometry, option construction, native blur definition, resource-pack sprites/compatibility/keyboard actions and menu-credits lifecycle.
- `PLAYWRIGHT_MODULE=... node --test tools/test-menu-blur-browser.mjs` executes WebGL 2, WebGPU and software rendering. The six-pass 31×19 test agrees with an independent box-filter reference within one RGBA channel value on WebGL and exactly on the other two backends. This is not a gameplay performance measurement.
- Chrome smoke captures of Title, Options, Accessibility, Online, Credits & Attribution, and Resource Packs are in ignored `cache/port-1.20.6/ui-audit/`; no console/page errors or missing required textures were recorded.
- Target gate: 141 tests pass, zero skipped. This source batch does not rebuild published distributions.

## Version applicability

The panorama-menu redesign, menu blur, new title footer/navigation and narrator-hotkey row belong to the 1.20.5+ target. `supported_formats` belongs to 1.20.2+. Existing older targets must retain their own layouts/assets and format rules. Native pack-entry sound/localization differences and inherited resource ordering are still part of the cross-version audit; they are not claimed as fully accepted backports here.
