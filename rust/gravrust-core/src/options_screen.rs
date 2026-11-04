//! Port of `client/js/gui/screens/options.js` — the screen-layout layer.
//!
//! This is the stateful half of options.js: `OptionsBase` and the sub-screen
//! classes (`OptionsScreen`, `AccessibilityScreen`, `MouseSettingsScreen`,
//! `LanguageScreen`, `VideoScreen`, `SoundScreen`, `ChatOptionsScreen`,
//! `SkinScreen`, `ControlsScreen`, `SnooperScreen`,
//! `StreamUnavailableScreen`) — their construction and navigation,
//! apply/undo semantics and layout math. Rendering, live widget instances and
//! DOM event plumbing stay browser-bound; option data comes from
//! [`crate::options`], scroll and focus maths from [`crate::options_alg`].

use crate::options::game_options_ids::REALMS_NOTIFICATIONS;
use crate::options::{
    default_key, make_option, native_option, ordered_video_items, ACCESSIBILITY_OPTIONS,
    CATEGORY_ORDER, KEY_BINDINGS, MOUSE_OPTIONS, OptionWidget, Settings, SOUND_CATEGORIES,
    SKIN_PARTS,
};
use crate::options_alg::{
    category_button_pos, grid_pos, js_floor, pack_rows, sort_bindings, ListGeometry, ListOpts,
    WidgetRect,
};

// -------------------------------------------------------------- shared shell

// JS: the `it` descriptor subset grid()/makeOption() read:
// { slider, wide, enabled }.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct GridItem {
    pub slider: bool,
    pub wide: bool,
    pub enabled: bool,
}

impl GridItem {
    // JS: VANILLA_UI.<list>.map(k => nativeOption(this, k)) — narrator.active
    // stands in for g.narrator.
    pub fn from_native(key: &str, narrator_active: bool) -> Option<GridItem> {
        native_option(key)
            .map(|ot| GridItem { slider: ot.is_slider(), wide: false, enabled: ot.enabled(narrator_active) })
    }
}

// JS: class OptionsBase extends Screen — the shared shell. The Screen base
// class (rendering, event plumbing) and `this.parent` (a live screen object)
// stay browser-bound: done() is `s.save(); game.screens.open(parent)` and
// close() is `done()`.
#[derive(Clone, Debug, PartialEq)]
pub struct OptionsBase {
    pub title_key: &'static str,
    pub in_world: bool,
    pub width: f64,
    pub height: f64,
    pub buttons: Vec<OptionWidget>,
}

impl OptionsBase {
    // JS: constructor(game, parent, titleKey) { ... this.background = game.inWorld ? 'world' : 'dirt'; }
    pub fn new(title_key: &'static str, in_world: bool, width: f64, height: f64) -> OptionsBase {
        OptionsBase { title_key, in_world, width, height, buttons: Vec::new() }
    }

    // JS: this.background
    pub fn background(&self) -> &'static str {
        if self.in_world {
            "world"
        } else {
            "dirt"
        }
    }

    // JS: doneButton(y) — new Button(200, this.width / 2 - 100, y ?? this.height / 6 + 168,
    //   200, 20, tr('gui.done'), () => this.done());
    pub fn push_done_button(&mut self, y: Option<f64>) {
        let y = y.unwrap_or(self.height / 6.0 + 168.0);
        self.buttons.push(make_option(200, self.width / 2.0 - 100.0, y, false, false, true));
    }

    // JS: grid(items, y0 = this.height / 6 - 12) — two-column layout helper
    // (fixed rows); `null` items are skipped.
    pub fn push_grid(&mut self, items: &[Option<GridItem>], y0: f64) {
        for (i, it) in items.iter().enumerate() {
            if let Some(it) = it {
                let (x, y) = grid_pos(i, self.width, y0);
                self.buttons.push(make_option(i, x, y, it.slider, it.wide, it.enabled));
            }
        }
    }

    // JS: renderContent(gui) — gui.textCentered(tr(this.titleKey), this.width / 2, 15, 0xffffff);
    pub const TITLE_Y: f64 = 15.0;
}

// JS: AccessibilityScreen / ChatOptionsScreen renderContent — title at y = 20.
pub const SUB_TITLE_Y: f64 = 20.0;

// JS: MouseSettingsScreen / VideoScreen render — title at y = 5.
pub const LIST_TITLE_Y: f64 = 5.0;
// JS: LanguageScreen render — title at y = 16.
pub const LANGUAGE_TITLE_Y: f64 = 16.0;
// JS: ControlsScreen render — title at y = 8.
pub const CONTROLS_TITLE_Y: f64 = 8.0;

// ---------------------------------------------------------------- list state

// JS: the ListOf (client/js/gui/slot-list.js) state these screens keep across
// re-init (`old.amountScrolled` + clamp).
#[derive(Clone, Debug, PartialEq)]
pub struct ListState {
    pub geometry: ListGeometry,
    pub amount_scrolled: f64,
    pub size: usize,
}

impl ListState {
    pub fn empty() -> ListState {
        ListState {
            geometry: ListGeometry::new(0.0, 0.0, 0.0, 1.0, &ListOpts::default()),
            amount_scrolled: 0.0,
            size: 0,
        }
    }

    pub fn new(
        screen_width: f64,
        top: f64,
        bottom: f64,
        slot_height: f64,
        opts: &ListOpts,
        size: usize,
    ) -> ListState {
        ListState {
            geometry: ListGeometry::new(screen_width, top, bottom, slot_height, opts),
            amount_scrolled: 0.0,
            size,
        }
    }

    // JS: this.list.amountScrolled = old.amountScrolled; this.list.clamp();
    pub fn reopen_from(&mut self, old: &ListState) {
        self.amount_scrolled = old.amount_scrolled;
        self.clamp();
    }

    // JS: clamp() { this.amountScrolled = Math.max(0, Math.min(this.maxScroll(), this.amountScrolled)); }
    pub fn clamp(&mut self) {
        self.amount_scrolled = self.geometry.clamp(self.amount_scrolled, self.size);
    }

    // JS: wheel(d) { this.amountScrolled += d * this.slotHeight / 2; this.clamp(); }
    pub fn wheel(&mut self, d: f64) {
        self.amount_scrolled = self.geometry.wheel(self.amount_scrolled, d, self.size);
    }

    // JS: option-focus.js scroll-into-view for a focused option row.
    pub fn scroll_row_into_view(&mut self, row: usize) {
        self.amount_scrolled = self.geometry.scroll_row_into_view(self.amount_scrolled, row, self.size);
    }
}

// JS: { listWidth: 400, scrollBarOffset: 32, selectionBox: false, scrollbarDragOnly: true }
// — the MouseSettingsScreen and VideoScreen list options.
fn mouse_list_opts() -> ListOpts {
    ListOpts {
        list_width: 400.0,
        scroll_bar_offset: 32.0,
        selection_box: false,
        scrollbar_drag_only: true,
        ..ListOpts::default()
    }
}

// -------------------------------------------------------------- navigation

// JS: open(Cls) targets; the JS glue maps the button ids to
// screens.open(new Cls(g, this)). (ResourcePacksScreen lives in packs.js.)
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum SubScreen {
    Skin,
    Sound,
    Video,
    Controls,
    Language,
    Chat,
    ResourcePacks,
    Accessibility,
    MouseSettings,
}

// JS: btn(110, 0, 0, 'options.skinCustomisation', open(SkinScreen)); ... plus
// ControlsScreen's Button 202 -> MouseSettingsScreen.
pub fn options_sub_screen(id: i32) -> Option<SubScreen> {
    match id {
        110 => Some(SubScreen::Skin),
        106 => Some(SubScreen::Sound),
        101 => Some(SubScreen::Video),
        100 => Some(SubScreen::Controls),
        102 => Some(SubScreen::Language),
        103 => Some(SubScreen::Chat),
        105 => Some(SubScreen::ResourcePacks),
        104 => Some(SubScreen::Accessibility),
        202 => Some(SubScreen::MouseSettings),
        _ => None,
    }
}

// ------------------------------------------------- JS: export class OptionsScreen

// JS: export class OptionsScreen extends OptionsBase (GuiOptions)
#[derive(Clone, Debug, PartialEq)]
pub struct OptionsScreen {
    pub base: OptionsBase,
}

impl OptionsScreen {
    // JS: constructor(game, parent) { super(game, parent, 'options.title'); }
    pub fn new(in_world: bool, width: f64, height: f64) -> OptionsScreen {
        OptionsScreen { base: OptionsBase::new("options.title", in_world, width, height) }
    }

    // JS: init() — FOV slider, difficulty/realms row, sub-screen grid, done button.
    // FOV label/value/set (fovLabel, (s.fov - 30) / 80, s.fov = round(30 + v * 80))
    // are options_alg::fov_*; the difficulty button label is
    // options::difficulty_label_value(g.difficulty, g.hardcore).
    pub fn init(&mut self) {
        let cx = self.base.width / 2.0;
        let h6 = self.base.height / 6.0;
        // JS: new Slider(0, cx - 155, h6 - 12, 150, 20, fovLabel, ...);
        self.base.buttons.push(make_option(0, cx - 155.0, h6 - 12.0, true, false, true));
        if self.base.in_world {
            // JS: Difficulty can only be changed in singleplayer — disabled display button.
            self.base.buttons.push(make_option(108, cx + 5.0, h6 - 12.0, false, false, false));
        } else {
            // JS: 1.12 GuiOptions: REALMS_NOTIFICATIONS on the title screen; init also
            // defaults s.realmsNotifications === undefined to true.
            self.base.buttons.push(make_option(
                REALMS_NOTIFICATIONS as usize,
                cx + 5.0,
                h6 - 12.0,
                false,
                false,
                true,
            ));
        }
        // JS: btn(110, 0, 0, 'options.skinCustomisation', open(SkinScreen)); btn(106, 1, 0, 'options.sounds', ...);
        //     btn(101, 0, 1, 'options.video', ...); btn(100, 1, 1, 'options.controls', ...);
        //     btn(102, 0, 2, 'options.language', ...); btn(103, 1, 2, 'options.chat.title', ...);
        //     btn(105, 0, 3, 'options.resourcepack', ...); btn(104, 1, 3, 'options.accessibility.title', ...);
        let categories: [(i32, usize, usize); 8] = [
            (110, 0, 0),
            (106, 1, 0),
            (101, 0, 1),
            (100, 1, 1),
            (102, 0, 2),
            (103, 1, 2),
            (105, 0, 3),
            (104, 1, 3),
        ];
        for (id, col, row) in categories {
            let (x, y) = category_button_pos(col, row, cx, h6);
            self.base.buttons.push(make_option(id as usize, x, y, false, false, true));
        }
        // JS: this.doneButton();
        self.base.push_done_button(None);
    }
}

// --------------------------------------- JS: export class AccessibilityScreen

// JS: export class AccessibilityScreen extends OptionsBase
#[derive(Clone, Debug, PartialEq)]
pub struct AccessibilityScreen {
    pub base: OptionsBase,
}

impl AccessibilityScreen {
    // JS: constructor(game, parent) { super(game, parent, 'options.accessibility.title'); }
    pub fn new(in_world: bool, width: f64, height: f64) -> AccessibilityScreen {
        AccessibilityScreen { base: OptionsBase::new("options.accessibility.title", in_world, width, height) }
    }

    // JS: init() { this.grid(VANILLA_UI.accessibilityOptions.map(k => nativeOption(this, k)),
    //   Math.floor(this.height / 6)); this.doneButton(Math.floor(this.height / 6) + 144); }
    pub fn init(&mut self, narrator_active: bool) {
        let y0 = js_floor(self.base.height / 6.0);
        let items: Vec<Option<GridItem>> =
            ACCESSIBILITY_OPTIONS.iter().map(|k| GridItem::from_native(k, narrator_active)).collect();
        self.base.push_grid(&items, y0);
        self.base.push_done_button(Some(y0 + 144.0));
    }
}

// ------------------------------------- JS: export class MouseSettingsScreen

// JS: export class MouseSettingsScreen extends OptionsBase
#[derive(Clone, Debug, PartialEq)]
pub struct MouseSettingsScreen {
    pub base: OptionsBase,
    // JS: this.rows — rows of option buttons (indices into base.buttons).
    pub rows: Vec<Vec<usize>>,
    pub list: ListState,
}

impl MouseSettingsScreen {
    // JS: constructor(game, parent) { super(game, parent, 'options.mouse_settings.title'); }
    pub fn new(in_world: bool, width: f64, height: f64) -> MouseSettingsScreen {
        MouseSettingsScreen {
            base: OptionsBase::new("options.mouse_settings.title", in_world, width, height),
            rows: Vec::new(),
            list: ListState::empty(),
        }
    }

    // JS: init() — VANILLA_UI.mouseOptions two per row; doneButton(height - 27);
    // list = new ListOf(this, 32, this.height - 32, 25, {...}, mouse list opts).
    pub fn init(&mut self) {
        let wide = [false; MOUSE_OPTIONS.len()];
        self.rows = pack_rows(&wide);
        // JS: makeOption(i, Math.floor(this.width / 2) - 155 + (i % 2) * 160, 0, nativeOption(this, key))
        for (i, key) in MOUSE_OPTIONS.iter().enumerate() {
            let x = js_floor(self.base.width / 2.0) - 155.0 + ((i % 2) as f64) * 160.0;
            let it = GridItem::from_native(key, true)
                .unwrap_or(GridItem { slider: false, wide: false, enabled: true });
            self.base.buttons.push(make_option(i, x, 0.0, it.slider, it.wide, it.enabled));
        }
        // JS: this.doneButton(this.height - 27);
        self.base.push_done_button(Some(self.base.height - 27.0));
        let size = self.rows.len();
        self.list = ListState::new(
            self.base.width,
            32.0,
            self.base.height - 32.0,
            25.0,
            &mouse_list_opts(),
            size,
        );
    }

    // JS: if (old) { this.list.amountScrolled = old.amountScrolled; this.list.clamp(); }
    pub fn reopen(&mut self, old: &ListState) {
        self.list.reopen_from(old);
    }

    // JS: wheel(d) { this.list.wheel(d); }
    pub fn wheel(&mut self, d: f64) {
        self.list.wheel(d);
    }
}

// ---------------------------------------------------- JS: class LanguageScreen

// JS: class LanguageScreen extends OptionsBase (GuiLanguage + GuiLanguage.List)
#[derive(Clone, Debug, PartialEq)]
pub struct LanguageScreen {
    pub base: OptionsBase,
    pub busy: bool,
    pub pending_language: Option<String>,
    pub codes: Vec<String>,
    pub list: ListState,
}

impl LanguageScreen {
    // JS: constructor(game, parent) { super(game, parent, 'options.language'); this.busy = false; }
    pub fn new(in_world: bool, width: f64, height: f64) -> LanguageScreen {
        LanguageScreen {
            base: OptionsBase::new("options.language", in_world, width, height),
            busy: false,
            pending_language: None,
            codes: Vec::new(),
            list: ListState::empty(),
        }
    }

    // JS: get codes() { const L = this.game.assets.languages; return Object.keys(L).sort((a, b) =>
    //   (L[a].name + L[a].region).localeCompare(L[b].name + L[b].region)); }
    // `languages` holds (code, name, region) triples. localeCompare is locale
    // collation (browser-bound); byte order is the portable approximation.
    pub fn language_codes(languages: &[(String, String, String)]) -> Vec<String> {
        let mut sorted: Vec<&(String, String, String)> = languages.iter().collect();
        sorted.sort_by(|a, b| format!("{}{}", a.1, a.2).cmp(&format!("{}{}", b.1, b.2)));
        sorted.into_iter().map(|l| l.0.clone()).collect()
    }

    // JS: init() — forceUnicodeFont toggle (id 100) + done (id 6) at height - 38;
    // list = new ListOf(this, 32, this.height - 65 + 4, 18, {...}) with the current
    // language selected.
    pub fn init(&mut self, languages: &[(String, String, String)], current_language: &str) {
        let cx = self.base.width / 2.0;
        let height = self.base.height;
        // JS: new Button(100, cx - 155, this.height - 38, 150, 20, forceUnicodeFont label, ...)
        self.base.buttons.push(make_option(100, cx - 155.0, height - 38.0, false, false, true));
        // JS: new Button(6, cx - 155 + 160, this.height - 38, 150, 20, tr('gui.done'), ...)
        self.base.buttons.push(make_option(6, cx - 155.0 + 160.0, height - 38.0, false, false, true));
        self.codes = Self::language_codes(languages);
        let top = 32.0;
        let bottom = height - 65.0 + 4.0;
        let size = self.codes.len();
        self.list = ListState::new(self.base.width, top, bottom, 18.0, &ListOpts::default(), size);
        // JS: else this.list.amountScrolled = codes.indexOf(current) * 18 - (bottom - top) / 2;
        let index = self
            .codes
            .iter()
            .position(|c| c == current_language)
            .map(|i| i as f64)
            .unwrap_or(-1.0);
        self.list.amount_scrolled = index * 18.0 - (bottom - top) / 2.0;
        self.list.clamp();
    }

    // JS: _pick(code) { if (code && !this.busy) this.pendingLanguage = code; }
    pub fn pick(&mut self, code: &str) {
        if !code.is_empty() && !self.busy {
            self.pending_language = Some(code.to_string());
        }
    }

    // JS: async done() { if (this.busy) return; this.busy = true; try {
    //   if (this.pendingLanguage && this.pendingLanguage !== this.game.assets.language)
    //     await this.game.setLanguage(this.pendingLanguage); super.done(); } finally { this.busy = false; } }
    // The await is browser-bound; the port returns the language to apply (if any).
    pub fn done_decision(&self, current_language: &str) -> Option<String> {
        if self.busy {
            return None;
        }
        match &self.pending_language {
            Some(p) if p != current_language => Some(p.clone()),
            _ => None,
        }
    }

    // JS: close() { this.s.save(); this.game.screens.open(this.parent); }
    // Note: LanguageScreen.close skips done() — Escape never applies the pending swap.
}

// -------------------------------------------------------- JS: class VideoScreen

// JS: done() side effects on the game: g.renderer.renderDistance = s.renderDistance;
// g.applyGraphicsSettings(); if (g.inWorld) g.sendSettings(). The game calls
// are browser-bound; the port returns what to apply.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct VideoApply {
    pub render_distance: i32,
    pub send_settings: bool,
}

// JS: class VideoScreen extends OptionsBase (GuiVideoSettings, GuiOptionsRowList)
#[derive(Clone, Debug, PartialEq)]
pub struct VideoScreen {
    pub base: OptionsBase,
    pub rows: Vec<Vec<usize>>,
    pub list: ListState,
    // JS: this.mipsBefore = s.mipmapLevels — the pre-screen mipmap level.
    pub mips_before: i32,
}

impl VideoScreen {
    // JS: constructor(game, parent) { super(game, parent, 'options.videoTitle'); }
    pub fn new(in_world: bool, width: f64, height: f64) -> VideoScreen {
        VideoScreen {
            base: OptionsBase::new("options.videoTitle", in_world, width, height),
            rows: Vec::new(),
            list: ListState::empty(),
            mips_before: 0,
        }
    }

    // JS: init() — ordered vanilla + Gravrust extras, two-column row packing
    // (a wide option starts its own row), done at height - 27, scroll list.
    pub fn init(&mut self, mipmap_levels: i32, device_is_software: bool) {
        self.mips_before = mipmap_levels; // JS: this.mipsBefore = s.mipmapLevels
        let items = ordered_video_items();
        let wide: Vec<bool> = items.iter().map(|it| it.wide).collect();
        self.rows = pack_rows(&wide);
        // JS: orderedItems.forEach((it, i) => { if (it.wide && col === 1) col = 0;
        //   makeOption(i, this.width / 2 - 155 + col * 160, 0, it); ... });
        let mut buttons_by_index: Vec<Option<OptionWidget>> = vec![None; items.len()];
        for row in &self.rows {
            for (col, &item_i) in row.iter().enumerate() {
                let it = items[item_i];
                let x = self.base.width / 2.0 - 155.0 + (col as f64) * 160.0;
                // JS: enabled: g.device.name !== 'Software' — Super Potato (the last
                // extra) is greyed out while the CPU rasteriser forces it on.
                let enabled = if item_i == 18 { !device_is_software } else { true };
                buttons_by_index[item_i] = Some(make_option(item_i, x, 0.0, it.slider, it.wide, enabled));
            }
        }
        self.base.buttons = buttons_by_index.into_iter().flatten().collect();
        // JS: this.buttons.push(new Button(200, this.width / 2 - 100, this.height - 27, 200, 20, tr('gui.done'), () => this.done()));
        self.base.push_done_button(Some(self.base.height - 27.0));
        // JS: this.list = new ListOf(this, 32, this.height - 32, 25, {...}, { listWidth: 400,
        //   scrollBarOffset: 32, selectionBox: false, scrollbarDragOnly: true });
        let size = self.rows.len();
        self.list = ListState::new(
            self.base.width,
            32.0,
            self.base.height - 32.0,
            25.0,
            &mouse_list_opts(),
            size,
        );
    }

    // JS: if (old) { this.list.amountScrolled = old.amountScrolled; this.list.clamp(); }
    pub fn reopen(&mut self, old: &ListState) {
        self.list.reopen_from(old);
    }

    // JS: wheel(d) { this.list.wheel(d); }
    pub fn wheel(&mut self, d: f64) {
        self.list.wheel(d);
    }

    // JS: done() { g.renderer.renderDistance = this.s.renderDistance; g.applyGraphicsSettings();
    //   if (g.inWorld) g.sendSettings(); super.done(); }
    // (the biome blend slider additionally calls g.applyGraphicsSettings() when its
    // value changes — see options_alg::biome_blend_set)
    pub fn done_apply(&self, s: &Settings) -> VideoApply {
        VideoApply { render_distance: s.render_distance, send_settings: self.base.in_world }
    }
}

// JS: gui.tooltip(gui.font.wrap(tip, Math.min(300, this.width - 20)), mx, my) —
// VideoScreen.render wraps tips 300px wide (narrower on small screens).
pub fn tooltip_wrap_width(width: f64) -> f64 {
    300.0f64.min(width - 20.0)
}

// -------------------------------------------------------- JS: class SoundScreen

// JS: class SoundScreen extends OptionsBase (GuiScreenOptionsSounds)
#[derive(Clone, Debug, PartialEq)]
pub struct SoundScreen {
    pub base: OptionsBase,
}

impl SoundScreen {
    // JS: constructor(game, parent) { super(game, parent, 'options.sounds.title'); }
    pub fn new(in_world: bool, width: f64, height: f64) -> SoundScreen {
        SoundScreen { base: OptionsBase::new("options.sounds.title", in_world, width, height) }
    }

    // JS: init() — master (wide slider), a null slot, every other SoundCategory
    // slider, then "Show Subtitles" and the done button. Volume labels are
    // options_alg::sound_volume_label_value; value/set read s.masterVolume and
    // s.soundVolumes[k] (missing -> 1).
    pub fn init(&mut self) {
        let y0 = self.base.height / 6.0 - 12.0; // JS: this.grid(items) — default y0
        let mut items: Vec<Option<GridItem>> =
            vec![Some(GridItem { slider: true, wide: true, enabled: true }), None];
        for _ in SOUND_CATEGORIES {
            items.push(Some(GridItem { slider: true, wide: false, enabled: true }));
        }
        self.base.push_grid(&items, y0);
        // JS: const i = items.length + 1; new Button(201, this.width / 2 - 75,
        //   this.height / 6 - 12 + 24 * (i >> 1), 150, 20, showSubtitles label, ...)
        let i = items.len() as u64 + 1;
        let y = y0 + 24.0 * ((i >> 1) as f64);
        self.base.buttons.push(make_option(201, self.base.width / 2.0 - 75.0, y, false, false, true));
        // JS: this.doneButton();
        self.base.push_done_button(None);
    }
}

// ------------------------------------------------- JS: ChatOptionsScreen helpers

// JS: export class ChatOptionsScreen extends OptionsBase (ScreenChatOptions)
#[derive(Clone, Debug, PartialEq)]
pub struct ChatOptionsScreen {
    pub base: OptionsBase,
}

impl ChatOptionsScreen {
    // JS: constructor(game, parent) { super(game, parent, 'options.chat.title'); }
    pub fn new(in_world: bool, width: f64, height: f64) -> ChatOptionsScreen {
        ChatOptionsScreen { base: OptionsBase::new("options.chat.title", in_world, width, height) }
    }

    // JS: init() { const options = VANILLA_UI.chatOptions;
    //   this.grid(options.map(key => chatOption(this.game, key)), Math.floor(this.height / 6));
    //   this.buttons.forEach((b, i) => b.optionKey = options[i]);
    //   this.doneButton(Math.floor(this.height / 6) + Math.floor(24 * (options.length + 1) / 2)); }
    // The chatOption descriptors live in client/js/gui/chat-options.js; the port
    // takes the resolved (slider/wide/enabled) items in CHAT_OPTIONS order.
    pub fn init(&mut self, items: &[GridItem]) {
        let y0 = js_floor(self.base.height / 6.0);
        let grid: Vec<Option<GridItem>> = items.iter().map(|it| Some(*it)).collect();
        self.base.push_grid(&grid, y0);
        let n = items.len() as f64;
        self.base.push_done_button(Some(y0 + js_floor(24.0 * (n + 1.0) / 2.0)));
    }

    // JS: done() { if (this.game.inWorld) this.game.sendSettings(); super.done(); }
    pub fn send_settings_on_done(&self) -> bool {
        self.base.in_world
    }
}

// --------------------------------------------------------- JS: class SkinScreen

// JS: class SkinScreen extends OptionsBase (GuiCustomizeSkin)
#[derive(Clone, Debug, PartialEq)]
pub struct SkinScreen {
    pub base: OptionsBase,
}

impl SkinScreen {
    // JS: constructor(game, parent) { super(game, parent, 'options.skinCustomisation.title'); }
    pub fn new(in_world: bool, width: f64, height: f64) -> SkinScreen {
        SkinScreen { base: OptionsBase::new("options.skinCustomisation.title", in_world, width, height) }
    }

    // JS: init() — 7 model-part toggles (labels via options::skin_part_label_value,
    // click via options::toggle_skin_part) + main hand (options::main_hand_label_value /
    // toggle_main_hand); grid at height / 6; Done on the row after the last
    // (odd counts round up).
    pub fn init(&mut self) {
        let count = SKIN_PARTS.len() + 1; // parts + main hand
        let items: Vec<Option<GridItem>> =
            (0..count).map(|_| Some(GridItem { slider: false, wide: false, enabled: true })).collect();
        self.base.push_grid(&items, self.base.height / 6.0);
        // JS: let i = items.length; if (i % 2 === 1) i++; this.doneButton(this.height / 6 + 24 * (i >> 1));
        let mut i = count as u64;
        if i % 2 == 1 {
            i += 1;
        }
        self.base.push_done_button(Some(self.base.height / 6.0 + 24.0 * ((i >> 1) as f64)));
    }

    // JS: done() { if (this.game.inWorld) this.game.sendSettings(); super.done(); }
    pub fn send_settings_on_done(&self) -> bool {
        self.base.in_world
    }
}

// ---------------------------------------------------- JS: class ControlsScreen

// JS: VANILLA_UI.controlsLayout (extracted from the pinned jar).
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct ControlsLayout {
    pub extra_width: f64,
    pub list_top: f64,
    pub bottom_margin: f64,
    pub row_height: f64,
}

pub const CONTROLS_LAYOUT: ControlsLayout =
    ControlsLayout { extra_width: 45.0, list_top: 43.0, bottom_margin: 32.0, row_height: 20.0 };

// JS: entries — { header: cat } (KeyBindingList.CategoryEntry) or { key: k }.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum ControlsEntry {
    Header { category: &'static str },
    Binding { key: &'static str },
}

// JS: class ControlsScreen extends OptionsBase (GuiControls + ControlList)
#[derive(Clone, Debug, PartialEq)]
pub struct ControlsScreen {
    pub base: OptionsBase,
    // JS: this.binding — the binding awaiting a new key, or null.
    pub binding: Option<&'static str>,
    pub entries: Vec<ControlsEntry>,
    pub list: ListState,
    // JS: this.maxLabel = Math.max(...keys.map(k => gui.textWidth(tr(...))));
    // textWidth is browser-bound; the port takes it as an argument.
    pub max_label_width: f64,
}

impl ControlsScreen {
    // JS: constructor(game, parent) { super(game, parent, 'controls.title'); this.binding = null; }
    pub fn new(in_world: bool, width: f64, height: f64) -> ControlsScreen {
        ControlsScreen {
            base: OptionsBase::new("controls.title", in_world, width, height),
            binding: None,
            entries: Vec::new(),
            list: ListState::empty(),
            max_label_width: 0.0,
        }
    }

    // JS: init() — mouse settings (202) + autoJump (203) at y = 18; resetAll (201)
    // + done (200) at height - 29; sorted binding entries with category headers;
    // the scroll list.
    pub fn init(&mut self, max_label_width: f64) {
        let cx = js_floor(self.base.width / 2.0);
        // JS: new Button(202, cx - 155, 18, 150, 20, tr('options.mouse_settings'), -> MouseSettingsScreen)
        self.base.buttons.push(make_option(202, cx - 155.0, 18.0, false, false, true));
        // JS: new Button(203, cx + 5, 18, 150, 20, autoJump toggle, ...)
        self.base.buttons.push(make_option(203, cx + 5.0, 18.0, false, false, true));
        // JS: this.resetAll = new Button(201, cx - 155, this.height - 29, 150, 20, tr('controls.resetAll'), () => { s.keys = { ...DEFAULT_KEYS }; });
        self.base.buttons.push(make_option(201, cx - 155.0, self.base.height - 29.0, false, false, true));
        // JS: new Button(200, cx + 5, this.height - 29, 150, 20, tr('gui.done'), () => this.done());
        self.base.buttons.push(make_option(200, cx + 5.0, self.base.height - 29.0, false, false, true));
        // JS: keys = Object.keys(KEY_BINDINGS).sort((a, b) => categoryOrder index, then
        // compareText(tr(description))) — options_alg::sort_bindings.
        let table: Vec<(&'static str, &'static str, &'static str)> =
            KEY_BINDINGS.iter().map(|k| (k.binding, k.description_key, k.category_key)).collect();
        let sorted = sort_bindings(table, &CATEGORY_ORDER);
        self.entries = Vec::new();
        let mut cat: Option<&'static str> = None;
        for (binding, _description, category) in sorted {
            if cat != Some(category) {
                cat = Some(category);
                self.entries.push(ControlsEntry::Header { category });
            }
            self.entries.push(ControlsEntry::Binding { key: binding });
        }
        self.max_label_width = max_label_width;
        // JS: this.list = new ListOf(this, layout.listTop, this.height - layout.bottomMargin,
        //   layout.rowHeight, {...}, { left: 0, width: this.width + layout.extraWidth,
        //   listWidth: 252, scrollBarOffset: 15, selectionBox: false, scrollbarDragOnly: true });
        let opts = ListOpts {
            list_width: 252.0,
            scroll_bar_offset: 15.0,
            selection_box: false,
            scrollbar_drag_only: true,
            left_width: Some((0.0, self.base.width + CONTROLS_LAYOUT.extra_width)),
            ..ListOpts::default()
        };
        let size = self.entries.len();
        self.list = ListState::new(
            self.base.width,
            CONTROLS_LAYOUT.list_top,
            self.base.height - CONTROLS_LAYOUT.bottom_margin,
            CONTROLS_LAYOUT.row_height,
            &opts,
            size,
        );
    }

    // JS: if (old) { this.list.amountScrolled = old.amountScrolled; this.list.clamp(); }
    pub fn reopen(&mut self, old: &ListState) {
        self.list.reopen_from(old);
    }

    // JS: wheel(d) { this.list.wheel(d); }
    pub fn wheel(&mut self, d: f64) {
        self.list.wheel(d);
    }

    // JS: _updateResets() — e.resetButton.enabled = this.s.keys[e.key] !== DEFAULT_KEYS[e.key];
    pub fn reset_enabled(&self, s: &Settings, key: &str) -> bool {
        !s.key_is_default(key)
    }

    // JS: this.resetAll.enabled = entries.some(e => e.key && this.s.keys[e.key] !== DEFAULT_KEYS[e.key])
    // — "Reset Keys" only while something differs from the defaults.
    pub fn reset_all_enabled(&self, s: &Settings) -> bool {
        self.entries
            .iter()
            .any(|e| matches!(e, ControlsEntry::Binding { key } if !s.key_is_default(key)))
    }

    // JS: entry.changeButton click: () => { this.binding = entry.key; }
    pub fn start_binding(&mut self, key: &'static str) {
        self.binding = Some(key);
    }

    // JS: mouseDown: if (this.binding) { this.s.keys[this.binding] = 'mouse' + button; this.binding = null; return true; }
    pub fn capture_mouse(&mut self, s: &mut Settings, button: i32) -> bool {
        match self.binding.take() {
            Some(b) => {
                s.set_key(b, &format!("mouse{}", button));
                true
            }
            None => false,
        }
    }

    // JS: key: if (this.binding) { this.s.keys[this.binding] = e.code === 'Escape' ? '' : e.code; this.binding = null; return true; }
    pub fn capture_key(&mut self, s: &mut Settings, code: &str) -> bool {
        match self.binding.take() {
            Some(b) => {
                s.set_key(b, if code == "Escape" { "" } else { code });
                true
            }
            None => false,
        }
    }

    // JS: _clickEntry guard: if (!e || e.header || e.y === undefined || my < e.y || my >= e.y + 20) return false;
    pub fn row_hit(y: f64, my: f64) -> bool {
        my >= y && my < y + 20.0
    }
}

// JS: entry.resetButton click: () => { s.keys[entry.key] = DEFAULT_KEYS[entry.key]; }
pub fn reset_binding(s: &mut Settings, key: &str) {
    s.set_key(key, default_key(key));
}

// JS: _drawEntry geometry — e.kx = x + 105 (75x20 change button), e.rx = x + 190
// (50x20 reset button), both at the row y.
pub fn change_button_rect(x: f64, y: f64) -> WidgetRect {
    WidgetRect::new(0, x + 105.0, y, 75.0, 20.0)
}

pub fn reset_button_rect(x: f64, y: f64) -> WidgetRect {
    WidgetRect::new(1, x + 190.0, y, 50.0, 20.0)
}

// JS: gui.text(tr(KEY_BINDINGS[k][0]), x + 90 - this.maxLabel, y + Math.floor(h / 2) - 4, 0xffffff, false)
pub fn binding_label_pos(x: f64, y: f64, h: f64, max_label_width: f64) -> (f64, f64) {
    (x + 90.0 - max_label_width, y + js_floor(h / 2.0) - 4.0)
}

// JS: header draw: gui.text(label, Math.floor(this.width / 2) - Math.floor(textWidth / 2), y + h - 9 - 1, ...)
pub fn header_label_pos(width: f64, label_width: f64, y: f64, h: f64) -> (f64, f64) {
    (js_floor(width / 2.0) - js_floor(label_width / 2.0), y + h - 9.0 - 1.0)
}

// JS: const dup = !!code && Object.keys(KEY_BINDINGS).some(o => o !== k && s.keys[o] === code);
pub fn key_is_duplicate(s: &Settings, key: &str, code: &str) -> bool {
    !code.is_empty() && KEY_BINDINGS.iter().any(|k| k.binding != key && s.key(k.binding) == Some(code))
}

// JS: let label = s.keyName(code); if (this.binding === k) label = '§f> §e' + label + '§f <';
// else if (dup) label = '§c' + label;
// keyName() is browser-bound (client/js/game/key-names.js); callers pass the name.
pub fn binding_button_label(name: &str, binding_active: bool, duplicate: bool) -> String {
    if binding_active {
        format!("§f> §e{}§f <", name)
    } else if duplicate {
        format!("§c{}", name)
    } else {
        name.to_string()
    }
}

// ------------------------------------------------------ JS: class SnooperScreen

// JS: class SnooperScreen extends OptionsBase (GuiSnooper) — the toggle and what
// it would report. Gravrust never sends snooper data.
#[derive(Clone, Debug, PartialEq)]
pub struct SnooperScreen {
    pub base: OptionsBase,
    pub data: Vec<(String, String)>,
}

impl SnooperScreen {
    // JS: constructor(game, parent) { super(game, parent, 'options.snooper.title'); }
    pub fn new(in_world: bool, width: f64, height: f64) -> SnooperScreen {
        SnooperScreen { base: OptionsBase::new("options.snooper.title", in_world, width, height), data: Vec::new() }
    }

    // JS: init() — snooper toggle (id 1) + done (id 2) at height - 30; the data table.
    pub fn init(&mut self, s: &Settings, device_name: &str, is_fullscreen: bool, cpu_count: Option<u32>) {
        let cx = self.base.width / 2.0;
        // JS: new Button(1, cx - 152, this.height - 30, 150, 20, snooper toggle, ...)
        self.base.buttons.push(make_option(1, cx - 152.0, self.base.height - 30.0, false, false, true));
        // JS: new Button(2, cx + 2, this.height - 30, 150, 20, tr('gui.done'), ...)
        self.base.buttons.push(make_option(2, cx + 2.0, self.base.height - 30.0, false, false, true));
        // JS: const P = platform(); this.data = [...]
        self.data = vec![
            ("version".to_string(), "1.14.4".to_string()),
            ("client_brand".to_string(), "vanilla".to_string()),
            (
                "display_type".to_string(),
                if is_fullscreen { "fullscreen" } else { "windowed" }.to_string(),
            ),
            ("display_frequency".to_string(), "-".to_string()),
            ("gl_version".to_string(), device_name.to_string()),
            // JS: String(P.cpuCount || '?') — 0 is falsy.
            (
                "cpu_cores".to_string(),
                match cpu_count {
                    Some(n) if n > 0 => n.to_string(),
                    _ => "?".to_string(),
                },
            ),
            ("opengl_version".to_string(), device_name.to_string()),
            ("render_distance".to_string(), s.render_distance.to_string()),
        ];
    }
}

// ------------------------------------------- JS: class StreamUnavailableScreen

// JS: class StreamUnavailableScreen extends OptionsBase (GuiStreamUnavailable) —
// Twitch broadcasting does not exist in the browser.
#[derive(Clone, Debug, PartialEq)]
pub struct StreamUnavailableScreen {
    pub base: OptionsBase,
}

impl StreamUnavailableScreen {
    // JS: constructor(game, parent) { super(game, parent, 'stream.unavailable.title'); }
    pub fn new(in_world: bool, width: f64, height: f64) -> StreamUnavailableScreen {
        StreamUnavailableScreen {
            base: OptionsBase::new("stream.unavailable.title", in_world, width, height),
        }
    }

    // JS: init() { this.buttons.push(new Button(1, this.width / 2 - 155 + 80,
    //   this.height / 4 + 120 + 12, 150, 20, tr('gui.back'), () => this.done())); }
    pub fn init(&mut self) {
        self.base.buttons.push(make_option(
            1,
            self.base.width / 2.0 - 155.0 + 80.0,
            self.base.height / 4.0 + 120.0 + 12.0,
            false,
            false,
            true,
        ));
    }
}

// ----------------------------------------------------------------------- tests

#[cfg(test)]
mod tests {
    use super::*;
    use crate::options::CHAT_OPTIONS;

    const W: f64 = 640.0;
    const H: f64 = 480.0;

    #[test]
    fn main_options_layout() {
        let mut screen = OptionsScreen::new(false, W, H);
        screen.init();
        // FOV slider + realms + 8 categories + done = 11 buttons.
        assert_eq!(screen.base.buttons.len(), 11);
        let b = &screen.base.buttons[0];
        assert!(b.slider);
        assert_eq!((b.rect.x, b.rect.y), (165.0, 68.0)); // cx-155, h6-12
        let realms = &screen.base.buttons[1];
        assert_eq!(realms.rect.id, REALMS_NOTIFICATIONS as i32);
        assert_eq!((realms.rect.x, realms.rect.y), (325.0, 68.0));
        let skin = &screen.base.buttons[2];
        assert_eq!(skin.rect.id, 110);
        assert_eq!((skin.rect.x, skin.rect.y), (165.0, 122.0)); // h6 + 48 - 6
        let done = screen.base.buttons.last().unwrap();
        assert_eq!(done.rect.id, 200);
        assert_eq!((done.rect.x, done.rect.y), (220.0, 248.0)); // width/2-100, h6+168
        // In world the realms button becomes the disabled difficulty display (id 108).
        let mut screen = OptionsScreen::new(true, W, H);
        screen.init();
        assert_eq!(screen.base.buttons[1].rect.id, 108);
        assert!(!screen.base.buttons[1].enabled);
        assert_eq!(screen.base.background(), "world");
    }

    #[test]
    fn sub_screen_navigation() {
        assert_eq!(options_sub_screen(110), Some(SubScreen::Skin));
        assert_eq!(options_sub_screen(104), Some(SubScreen::Accessibility));
        assert_eq!(options_sub_screen(202), Some(SubScreen::MouseSettings));
        assert_eq!(options_sub_screen(999), None);
    }

    #[test]
    fn accessibility_layout() {
        let mut screen = AccessibilityScreen::new(false, W, H);
        screen.init(true);
        // 8 options + done at floor(h/6) + 144.
        assert_eq!(screen.base.buttons.len(), 9);
        let done = screen.base.buttons.last().unwrap();
        assert_eq!((done.rect.x, done.rect.y), (220.0, 80.0 + 144.0));
        // The narrator option is disabled without speech.
        let mut screen = AccessibilityScreen::new(false, W, H);
        screen.init(false);
        assert!(!screen.base.buttons[0].enabled);
        assert!(screen.base.buttons[1].enabled); // showSubtitles stays on
        assert_eq!(screen.base.background(), "dirt");
    }

    #[test]
    fn mouse_settings_layout_and_scroll() {
        let mut screen = MouseSettingsScreen::new(false, W, H);
        screen.init();
        // 5 options in 3 rows (two columns) + done at height - 27.
        assert_eq!(screen.rows, vec![vec![0, 1], vec![2, 3], vec![4]]);
        assert_eq!(screen.base.buttons.len(), 6);
        let done = screen.base.buttons.last().unwrap();
        assert_eq!((done.rect.x, done.rect.y), (220.0, H - 27.0));
        let first = &screen.base.buttons[0];
        assert_eq!((first.rect.x, first.rect.y), (165.0, 0.0)); // y set on draw
        let second = &screen.base.buttons[1];
        assert_eq!(second.rect.x, 325.0);
        // List: (32, height - 32, 25), listWidth 400, scrollBarOffset 32.
        assert_eq!(screen.list.geometry.top, 32.0);
        assert_eq!(screen.list.geometry.bottom, H - 32.0);
        assert_eq!(screen.list.geometry.list_width, 400.0);
        assert_eq!(screen.list.size, 3);
        // Wheel on a 3-row list never scrolls (75px content < 412px window).
        screen.wheel(2.0);
        assert_eq!(screen.list.amount_scrolled, 0.0);
        let mut reopened = MouseSettingsScreen::new(false, W, H);
        reopened.init();
        reopened.reopen(&screen.list);
        assert_eq!(reopened.list.amount_scrolled, 0.0);
    }

    #[test]
    fn video_screen_layout() {
        let mut screen = VideoScreen::new(false, W, H);
        screen.init(4, false);
        assert_eq!(screen.mips_before, 4);
        // 19 option buttons (biomeBlendRadius first and wide) + done.
        assert_eq!(screen.base.buttons.len(), 20);
        assert_eq!(screen.rows.len(), 10);
        assert_eq!(screen.rows[0], vec![0]);
        let first = &screen.base.buttons[0];
        assert_eq!(first.rect.w, 310.0); // wide spans both columns
        let second = &screen.base.buttons[1];
        assert_eq!((second.rect.x, second.rect.w), (165.0, 150.0));
        let third = &screen.base.buttons[2];
        assert_eq!(third.rect.x, 325.0);
        let done = screen.base.buttons.last().unwrap();
        assert_eq!((done.rect.x, done.rect.y), (220.0, H - 27.0));
        // Super Potato (index 18) is greyed out while the CPU rasteriser forces it on.
        assert!(screen.base.buttons[18].enabled);
        let mut screen = VideoScreen::new(false, W, H);
        screen.init(4, true);
        assert!(!screen.base.buttons[18].enabled);
        // done() applies the render distance and syncs settings in world.
        let mut s = Settings::default();
        s.render_distance = 12;
        let apply = screen.done_apply(&s);
        assert_eq!(apply, VideoApply { render_distance: 12, send_settings: false });
        assert_eq!(tooltip_wrap_width(640.0), 300.0);
        assert_eq!(tooltip_wrap_width(200.0), 180.0);
    }

    #[test]
    fn language_screen_layout_and_pick() {
        let languages = vec![
            ("en_us".to_string(), "English".to_string(), "US".to_string()),
            ("de_de".to_string(), "Deutsch".to_string(), "Deutschland".to_string()),
            ("en_au".to_string(), "English".to_string(), "Australia".to_string()),
        ];
        let mut screen = LanguageScreen::new(false, W, H);
        screen.init(&languages, "en_us");
        // Codes sort by name + region: Deutsch < English (US)?? — localeCompare on
        // name+region: "EnglishUS" vs "EnglishAustralia": 'A' < 'U' so en_au first.
        assert_eq!(screen.codes, vec!["de_de", "en_au", "en_us"]);
        // Buttons: forceUnicodeFont (100) + done (6) at height - 38.
        assert_eq!(screen.base.buttons.len(), 2);
        assert_eq!(screen.base.buttons[0].rect.id, 100);
        assert_eq!(screen.base.buttons[1].rect.id, 6);
        assert_eq!((screen.base.buttons[0].rect.x, screen.base.buttons[0].rect.y), (165.0, H - 38.0));
        assert_eq!((screen.base.buttons[1].rect.x), 165.0 + 160.0);
        // List: (32, height - 65 + 4, 18); initial scroll centres the current language.
        assert_eq!(screen.list.geometry.slot_height, 18.0);
        assert_eq!(screen.list.geometry.bottom, H - 61.0);
        // index of en_us = 2 -> 2*18 - (419-32)/2 = -157.5; clamp() keeps 0.
        assert_eq!(screen.list.amount_scrolled, 0.0);
        // A language further down scrolls positively (and clamps at maxScroll).
        let langs: Vec<(String, String, String)> =
            (0..40).map(|i| (format!("c{:02}", i), format!("N{:02}", i), format!("R{:02}", i))).collect();
        let mut screen = LanguageScreen::new(false, W, H);
        screen.init(&langs, "c39");
        // 39*18 - 193.5 = 508.5 -> clamped to maxScroll(40) = 40*18 - (419-32-4) = 337.
        assert_eq!(screen.list.amount_scrolled, 337.0);
        // Picking a language stores it; done() applies it when it differs.
        screen.pick("de_de");
        assert_eq!(screen.done_decision("en_us"), Some("de_de".to_string()));
        assert_eq!(screen.done_decision("de_de"), None);
        // Empty codes are ignored (JS: if (code && ...)).
        screen.pick("");
        assert_eq!(screen.pending_language, Some("de_de".to_string()));
    }

    #[test]
    fn sound_screen_layout() {
        let mut screen = SoundScreen::new(false, W, H);
        screen.init();
        // Master (wide) + 9 categories = 10 grid buttons (null slot skipped:
        // ids run 0, 2..10), + subtitles (201) + done = 12.
        assert_eq!(screen.base.buttons.len(), 12);
        let master = &screen.base.buttons[0];
        assert_eq!(master.rect.w, 310.0);
        let subtitles = &screen.base.buttons[10];
        assert_eq!(subtitles.rect.id, 201);
        // i = items.length + 1 = 12 -> y = h6 - 12 + 24 * 6 = 68 + 144.
        assert_eq!((subtitles.rect.x, subtitles.rect.y), (245.0, 68.0 + 144.0));
        let done = screen.base.buttons.last().unwrap();
        assert_eq!((done.rect.x, done.rect.y), (220.0, 248.0));
    }

    #[test]
    fn chat_options_layout() {
        let items: Vec<GridItem> = CHAT_OPTIONS
            .iter()
            .map(|k| GridItem::from_native(k, true).unwrap_or(GridItem { slider: false, wide: false, enabled: true }))
            .collect();
        let mut screen = ChatOptionsScreen::new(false, W, H);
        screen.init(&items);
        // 13 chat options + done at floor(h/6) + floor(24 * 14 / 2).
        assert_eq!(screen.base.buttons.len(), 14);
        let done = screen.base.buttons.last().unwrap();
        assert_eq!((done.rect.x, done.rect.y), (220.0, 80.0 + 168.0));
        assert!(!screen.send_settings_on_done());
        let screen = ChatOptionsScreen::new(true, W, H);
        assert!(screen.send_settings_on_done());
    }

    #[test]
    fn skin_screen_layout() {
        let mut screen = SkinScreen::new(false, W, H);
        screen.init();
        // 7 parts + main hand = 8 buttons + done on the row after the last.
        assert_eq!(screen.base.buttons.len(), 9);
        let done = screen.base.buttons.last().unwrap();
        assert_eq!((done.rect.x, done.rect.y), (220.0, 80.0 + 24.0 * 4.0));
        assert!(!screen.send_settings_on_done());
    }

    #[test]
    fn controls_screen_layout_and_binding() {
        let mut screen = ControlsScreen::new(false, W, H);
        screen.init(60.0);
        // 4 fixed buttons + 34 bindings + 6 category headers in the entries list.
        assert_eq!(screen.base.buttons.len(), 4);
        assert_eq!(screen.entries.len(), 40);
        // Sorted by categoryOrder: movement first, its descriptions in text order.
        assert_eq!(screen.entries[0], ControlsEntry::Header { category: "key.categories.movement" });
        assert_eq!(screen.entries[1], ControlsEntry::Binding { key: "back" });
        assert_eq!(screen.max_label_width, 60.0);
        // List: left 0, width 640 + 45, listWidth 252, scrollBarOffset 15.
        assert_eq!(screen.list.geometry.right, W + CONTROLS_LAYOUT.extra_width);
        assert_eq!(screen.list.geometry.list_width, 252.0);
        assert_eq!(screen.list.geometry.top, CONTROLS_LAYOUT.list_top);
        // Scrollable (40 rows * 20 = 800 > the 401px window): wheel and reopen carry over.
        screen.wheel(2.0);
        assert_eq!(screen.list.amount_scrolled, 20.0); // d * slotHeight / 2
        let mut reopened = ControlsScreen::new(false, W, H);
        reopened.init(60.0);
        reopened.reopen(&screen.list);
        assert_eq!(reopened.list.amount_scrolled, 20.0);
        reopened.wheel(1000.0);
        assert_eq!(reopened.list.amount_scrolled, reopened.list.geometry.max_scroll(40));

        // Reset enablement follows the keys-vs-defaults comparison.
        let mut s = Settings::default();
        assert!(!screen.reset_all_enabled(&s));
        s.set_key("forward", "KeyJ");
        assert!(screen.reset_enabled(&s, "forward"));
        assert!(!screen.reset_enabled(&s, "left"));
        assert!(screen.reset_all_enabled(&s));
        reset_binding(&mut s, "forward");
        assert_eq!(s.key("forward"), Some("KeyW"));
        assert!(!screen.reset_all_enabled(&s));

        // Binding capture: mouse buttons, keys, Escape clears.
        screen.start_binding("forward");
        assert!(screen.capture_mouse(&mut s, 0));
        assert_eq!(s.key("forward"), Some("mouse0"));
        assert!(screen.binding.is_none());
        assert!(!screen.capture_key(&mut s, "KeyZ")); // nothing pending
        screen.start_binding("jump");
        assert!(screen.capture_key(&mut s, "Escape"));
        assert_eq!(s.key("jump"), Some(""));
        // Duplicates flag any other binding with the same code.
        assert!(!key_is_duplicate(&s, "sneak", "ShiftLeft")); // unique so far
        s.set_key("left", "ShiftLeft");
        assert!(key_is_duplicate(&s, "sneak", "ShiftLeft")); // left shares it now
        // JS: s.keys preloads DEFAULT_KEYS — 'drop' defaults to KeyQ, so KeyQ IS
        // a duplicate for sneak; a code nothing binds is not.
        assert!(key_is_duplicate(&s, "sneak", "KeyQ"));
        assert!(!key_is_duplicate(&s, "sneak", "KeyNumpad9"));
        // Decorated labels.
        assert_eq!(binding_button_label("KeyW", true, false), "§f> §eKeyW§f <");
        assert_eq!(binding_button_label("KeyW", false, true), "§cKeyW");
        assert_eq!(binding_button_label("KeyW", false, false), "KeyW");
        // Entry geometry.
        let change = change_button_rect(100.0, 200.0);
        assert_eq!((change.x, change.w), (205.0, 75.0));
        let reset = reset_button_rect(100.0, 200.0);
        assert_eq!((reset.x, reset.w), (290.0, 50.0));
        assert_eq!(binding_label_pos(100.0, 200.0, 20.0, 60.0), (130.0, 206.0));
        assert_eq!(header_label_pos(640.0, 40.0, 300.0, 20.0), (300.0, 310.0));
        assert!(ControlsScreen::row_hit(200.0, 210.0));
        assert!(!ControlsScreen::row_hit(200.0, 220.0));
    }

    #[test]
    fn snooper_screen_data() {
        let s = Settings::default();
        let mut screen = SnooperScreen::new(false, W, H);
        screen.init(&s, "ANGLE (WebGL2)", true, Some(8));
        assert_eq!(screen.base.buttons.len(), 2);
        assert_eq!((screen.base.buttons[0].rect.x, screen.base.buttons[0].rect.y), (168.0, H - 30.0));
        assert_eq!((screen.base.buttons[1].rect.x), 322.0);
        assert_eq!(
            screen.data,
            vec![
                ("version".to_string(), "1.14.4".to_string()),
                ("client_brand".to_string(), "vanilla".to_string()),
                ("display_type".to_string(), "fullscreen".to_string()),
                ("display_frequency".to_string(), "-".to_string()),
                ("gl_version".to_string(), "ANGLE (WebGL2)".to_string()),
                ("cpu_cores".to_string(), "8".to_string()),
                ("opengl_version".to_string(), "ANGLE (WebGL2)".to_string()),
                ("render_distance".to_string(), "8".to_string()),
            ]
        );
        // JS: String(P.cpuCount || '?') — 0 (and missing) is '?'.
        let mut screen = SnooperScreen::new(false, W, H);
        screen.init(&s, "d", false, Some(0));
        assert_eq!(screen.data[5].1, "?");
        let mut screen = SnooperScreen::new(false, W, H);
        screen.init(&s, "d", false, None);
        assert_eq!(screen.data[5].1, "?");
    }

    #[test]
    fn stream_unavailable_layout() {
        let mut screen = StreamUnavailableScreen::new(false, W, H);
        screen.init();
        assert_eq!(screen.base.buttons.len(), 1);
        let back = &screen.base.buttons[0];
        assert_eq!(back.rect.id, 1);
        assert_eq!((back.rect.x, back.rect.y), (320.0 - 155.0 + 80.0, H / 4.0 + 132.0));
        assert_eq!(screen.base.title_key, "stream.unavailable.title");
    }
}
