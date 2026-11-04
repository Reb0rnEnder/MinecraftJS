//! Port of `client/js/gui/screens/manager.js` — the screen stack
//! (GuiScreen equivalent): routes input and rendering to the active screen.

use crate::widgets::{Button, KeyEvent, Slider, TextField, WidgetHost, Gui};
use std::fmt::{self, Debug};

/// Background type for a screen
#[derive(Clone, Copy, Debug, PartialEq)]
pub enum ScreenBackground {
    World,
    Dirt,
}

/// Scroll list for creative inventory etc.
#[derive(Debug, Clone)]
pub struct ScrollList {
    pub amount_scrolled: f64,
    pub slot_height: f64,
    pub size: usize,
    pub top: f64,
    pub bottom: f64,
}

impl ScrollList {
    pub fn new(top: f64, bottom: f64, slot_height: f64, size: usize) -> Self {
        ScrollList {
            amount_scrolled: 0.0,
            slot_height,
            size,
            top,
            bottom,
        }
    }

    pub fn clamp(&mut self) {
        let max_scroll = self.max_scroll();
        self.amount_scrolled = self.amount_scrolled.clamp(0.0, max_scroll);
    }

    pub fn max_scroll(&self) -> f64 {
        let content_height = self.size as f64 * self.slot_height;
        let visible_height = self.bottom - self.top;
        (content_height - visible_height).max(0.0)
    }

    pub fn wheel(&mut self, delta: f64) {
        self.amount_scrolled += delta * self.slot_height / 2.0;
        self.clamp();
    }
}

/// Base Screen class - equivalent to JS `Screen` class
pub struct Screen {
    pub game: *mut GameContext,
    pub buttons: Vec<Button>,
    pub fields: Vec<TextField>,
    pub sliders: Vec<Slider>,
    pub allows_movement: bool,
    pub pauses_game: bool,
    pub background: ScreenBackground,
    pub list: Option<ScrollList>,
    pub is_container: bool,
}

impl Debug for Screen {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("Screen")
            .field("buttons", &self.buttons.len())
            .field("fields", &self.fields.len())
            .field("sliders", &self.sliders.len())
            .field("allows_movement", &self.allows_movement)
            .field("pauses_game", &self.pauses_game)
            .field("background", &self.background)
            .field("is_container", &self.is_container)
            .finish()
    }
}

impl Screen {
    pub fn new(game: *mut GameContext) -> Self {
        Screen {
            game,
            buttons: Vec::new(),
            fields: Vec::new(),
            sliders: Vec::new(),
            allows_movement: false,
            pauses_game: false,
            background: ScreenBackground::World,
            list: None,
            is_container: false,
        }
    }

    pub fn gui(&self) -> &GuiContext {
        unsafe { &(*self.game).gui }
    }

    pub fn gui_mut(&mut self) -> &mut GuiContext {
        unsafe { &mut (*self.game).gui }
    }

    pub fn width(&self) -> f64 {
        self.gui().width
    }

    pub fn height(&self) -> f64 {
        self.gui().height
    }

    pub fn init(&mut self) {}

    pub fn on_resize(&mut self) {
        self.buttons.clear();
        self.fields.clear();
        self.sliders.clear();
        self.init();
    }

    pub fn tick(&mut self) {
        for field in &mut self.fields {
            field.tick();
        }
    }

    pub fn render(&mut self, gui: &mut dyn Gui, mx: f64, my: f64, partial: f32) {
        let bg = self.background;
        let gui_mut = self.gui_mut();
        match bg {
            ScreenBackground::World => gui_mut.world_background(),
            ScreenBackground::Dirt => gui_mut.dirt_background(),
        }
        self.render_content(gui, mx, my, partial);

        // Render buttons
        let dynamic_labels: Vec<Box<dyn Fn() -> String>> = Vec::new();
        for button in &self.buttons {
            button.render(gui, &dynamic_labels, mx as i32, my as i32);
        }

        // Render fields
        for field in &mut self.fields {
            field.render(gui, None);
        }
    }

    pub fn render_content(&mut self, _gui: &mut dyn Gui, _mx: f64, _my: f64, _partial: f32) {}

    pub fn mouse_down(&mut self, mx: f64, my: f64, button: i32, host: &mut dyn WidgetHost) -> bool {
        if button == 0 {
            for btn in &self.buttons {
                if btn.mouse_down(host, mx as i32, my as i32) {
                    return true;
                }
            }
        }

        let mut any = false;
        let gui_ref = unsafe { &mut (*self.game).gui };
        let i_max = self.fields.len();
        for i in 0..i_max {
            if self.fields[i].mouse_down(gui_ref, mx as i32, my as i32) {
                any = true;
            }
        }
        any
    }

    pub fn mouse_up(&mut self, _mx: f64, _my: f64, _button: i32) {
        // Button doesn't have mouse_up in the port - mouseUp is handled in JS
    }

    pub fn mouse_move(&mut self, _mx: f64, _my: f64) {}

    pub fn key(&mut self, e: &KeyEvent, host: &mut dyn WidgetHost) -> bool {
        if e.code == "Tab" {
            // Simplified tab handling - just close on Escape for now
            return false;
        }

        for field in &mut self.fields {
            if field.key(e, host) {
                return true;
            }
        }

        if e.code == "Escape" {
            self.close();
            return true;
        }

        false
    }

    pub fn key_up(&mut self, _e: &KeyEvent) {}

    pub fn char(&mut self, c: &str) -> bool {
        for field in &mut self.fields {
            if field.char(c) {
                return true;
            }
        }
        false
    }

    pub fn wheel(&mut self, _delta: f64) {}

    pub fn close(&mut self) {
        unsafe {
            (*self.game).screens.close();
        }
    }

    pub fn on_close(&mut self) {}
}

/// Trait for dynamic screen dispatch
pub trait ScreenTrait {
    fn init(&mut self);
    fn on_resize(&mut self);
    fn tick(&mut self);
    fn render(&mut self, gui: &mut dyn Gui, mx: f64, my: f64, partial: f32);
    fn mouse_down(&mut self, mx: f64, my: f64, button: i32, host: &mut dyn WidgetHost) -> bool;
    fn mouse_up(&mut self, mx: f64, my: f64, button: i32);
    fn mouse_move(&mut self, mx: f64, my: f64);
    fn key(&mut self, e: &KeyEvent, host: &mut dyn WidgetHost) -> bool;
    fn key_up(&mut self, e: &KeyEvent);
    fn char(&mut self, c: &str) -> bool;
    fn wheel(&mut self, delta: f64);
    fn close(&mut self);
    fn on_close(&mut self);
    fn buttons(&self) -> &[Button];
    fn buttons_mut(&mut self) -> &mut Vec<Button>;
    fn fields(&self) -> &[TextField];
    fn fields_mut(&mut self) -> &mut Vec<TextField>;
    fn sliders(&self) -> &[Slider];
    fn sliders_mut(&mut self) -> &mut Vec<Slider>;
    fn clear_widgets(&mut self);
    fn allows_movement(&self) -> bool;
    fn pauses_game(&self) -> bool;
    fn background(&self) -> ScreenBackground;
    fn is_container(&self) -> bool;
    fn list(&self) -> Option<&ScrollList>;
    fn list_mut(&mut self) -> &mut Option<ScrollList>;
    fn width(&self) -> f64;
    fn height(&self) -> f64;
}

/// ScreenManager - manages the screen stack
pub struct ScreenManager {
    pub game: *mut GameContext,
    pub current: Option<Box<dyn ScreenTrait>>,
    pub ignore_unlock: bool,
    pub last_size: String,
}

impl Debug for ScreenManager {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("ScreenManager")
            .field("current", &self.current.is_some())
            .field("ignore_unlock", &self.ignore_unlock)
            .field("last_size", &self.last_size)
            .finish()
    }
}

impl ScreenManager {
    pub fn new(game: *mut GameContext) -> Self {
        ScreenManager {
            game,
            current: None,
            ignore_unlock: false,
            last_size: String::new(),
        }
    }

    pub fn open(&mut self, screen: Box<dyn ScreenTrait>) {
        unsafe {
            let g = &mut *self.game;
            if let Some(mut current) = self.current.take() {
                current.on_close();
            }
            self.current = Some(screen);
            if let Some(screen) = &mut self.current {
                screen.clear_widgets();
                screen.init();
                if g.input.locked {
                    self.ignore_unlock = true;
                    g.input.unlock();
                }
            } else if g.in_world {
                g.input.lock();
            }
        }
    }

    pub fn close(&mut self) {
        unsafe {
            let g = &mut *self.game;
            if let Some(mut current) = self.current.take() {
                current.on_close();
            }
            if g.in_world {
                g.input.lock();
            } else {
                self.open_main_menu(None);
            }
        }
    }

    pub fn close_container(&mut self) {
        unsafe {
            let g = &mut *self.game;
            if let Some(current) = &mut self.current {
                if current.is_container() {
                    current.on_close();
                    self.current = None;
                    if g.in_world {
                        g.input.lock();
                    }
                }
            }
        }
    }

    pub fn open_main_menu(&mut self, _reason: Option<&str>) {
        // Lazily import to avoid circular deps - placeholder
    }

    fn _mouse(&self) -> (f64, f64) {
        unsafe {
            let g = &*self.game;
            let inp = &g.input;
            let gui = &g.gui;
            (inp.raw_x / gui.scale, inp.raw_y / gui.scale)
        }
    }

    pub fn tick(&mut self) {
        if let Some(current) = &mut self.current {
            current.tick();
        }
    }

    pub fn render(&mut self, gui: &mut dyn Gui, partial: f32) {
        let (mx, my) = self._mouse();
        if let Some(current) = &mut self.current {
            let size = format!("{}x{}", current.width() as i32, current.height() as i32);
            if size != self.last_size {
                self.last_size = size;
                current.on_resize();
            }
            current.render(gui, mx, my, partial);
        }
    }

    pub fn on_key(&mut self, e: &KeyEvent, host: &mut dyn WidgetHost) {
        if let Some(current) = &mut self.current {
            current.key(e, host);
        }
    }

    pub fn on_key_up(&mut self, e: &KeyEvent) {
        if let Some(current) = &mut self.current {
            current.key_up(e);
        }
    }

    pub fn on_char(&mut self, c: &str) {
        if let Some(current) = &mut self.current {
            current.char(c);
        }
    }

    pub fn on_move(&mut self) {
        let (mx, my) = self._mouse();
        if let Some(current) = &mut self.current {
            current.mouse_move(mx, my);
        }
    }

    pub fn on_wheel(&mut self, delta: f64) {
        if let Some(current) = &mut self.current {
            current.wheel(delta);
        }
    }

    pub fn on_mouse(&mut self, down: bool, mx: f64, my: f64, button: i32, host: &mut dyn WidgetHost) {
        if let Some(current) = &mut self.current {
            if down {
                current.mouse_down(mx, my, button, host);
            } else {
                current.mouse_up(mx, my, button);
            }
        }
    }
}

/// Context structs that would be provided by the game
pub struct GuiContext {
    pub width: f64,
    pub height: f64,
    pub scale: f64,
}

impl GuiContext {
    pub fn world_background(&mut self) {}
    pub fn dirt_background(&mut self) {}
}

impl Gui for GuiContext {
    fn narrator_widget(&mut self, _id: i32, _hovered: bool, _text: &str, _kind: Option<&str>) {}
    fn button(&mut self, _x: i32, _y: i32, _w: i32, _h: i32, _label: &str, _highlighted: bool, _enabled: bool) {}
    fn blit(&mut self, _texture: &str, _x: i32, _y: i32, _u: i32, _v: i32, _w: i32, _h: i32) {}
    fn text_centered(&mut self, _text: &str, _x: i32, _y: i32, _color: u32) {}
    fn text(&mut self, _text: &str, _x: f64, _y: f64, _color: u32, _shadow: bool) {}
    fn rect(&mut self, _x0: f64, _y0: f64, _x1: f64, _y1: f64, _color: u32) {}
    fn set_blend(&mut self, _blend: &str) {}
    fn font_width(&self, _text: &str) -> f64 { 0.0 }
    fn font_trim_to_width(&self, _text: &str, _width: f64) -> String { String::new() }
}

pub struct InputContext {
    pub locked: bool,
    pub raw_x: f64,
    pub raw_y: f64,
}

impl InputContext {
    pub fn lock(&mut self) { self.locked = true; }
    pub fn unlock(&mut self) { self.locked = false; }
}

pub struct GameContext {
    pub gui: GuiContext,
    pub input: InputContext,
    pub in_world: bool,
    pub screens: ScreenManager,
    pub assets: AssetsContext,
}

pub struct AssetsContext {
    // Asset loading would go here
}

impl GameContext {
    pub fn new() -> Self {
        GameContext {
            gui: GuiContext { width: 854.0, height: 480.0, scale: 1.0 },
            input: InputContext { locked: false, raw_x: 0.0, raw_y: 0.0 },
            in_world: false,
            screens: ScreenManager::new(std::ptr::null_mut()),
            assets: AssetsContext {},
        }
    }
}

// Default implementation of ScreenTrait for Screen
impl ScreenTrait for Screen {
    fn init(&mut self) {
        self.init();
    }

    fn on_resize(&mut self) {
        self.on_resize();
    }

    fn tick(&mut self) {
        self.tick();
    }

    fn render(&mut self, gui: &mut dyn Gui, mx: f64, my: f64, partial: f32) {
        self.render(gui, mx, my, partial);
    }

    fn mouse_down(&mut self, mx: f64, my: f64, button: i32, host: &mut dyn WidgetHost) -> bool {
        self.mouse_down(mx, my, button, host)
    }

    fn mouse_up(&mut self, mx: f64, my: f64, button: i32) {
        self.mouse_up(mx, my, button);
    }

    fn mouse_move(&mut self, mx: f64, my: f64) {
        self.mouse_move(mx, my);
    }

    fn key(&mut self, e: &KeyEvent, host: &mut dyn WidgetHost) -> bool {
        self.key(e, host)
    }

    fn key_up(&mut self, e: &KeyEvent) {
        self.key_up(e);
    }

    fn char(&mut self, c: &str) -> bool {
        self.char(c)
    }

    fn wheel(&mut self, delta: f64) {
        self.wheel(delta);
    }

    fn close(&mut self) {
        self.close();
    }

    fn on_close(&mut self) {
        self.on_close();
    }

    fn buttons(&self) -> &[Button] {
        &self.buttons
    }

    fn buttons_mut(&mut self) -> &mut Vec<Button> {
        &mut self.buttons
    }

    fn fields(&self) -> &[TextField] {
        &self.fields
    }

    fn fields_mut(&mut self) -> &mut Vec<TextField> {
        &mut self.fields
    }

    fn sliders(&self) -> &[Slider] {
        &self.sliders
    }

    fn sliders_mut(&mut self) -> &mut Vec<Slider> {
        &mut self.sliders
    }

    fn clear_widgets(&mut self) {
        self.buttons.clear();
        self.fields.clear();
        self.sliders.clear();
    }

    fn allows_movement(&self) -> bool {
        self.allows_movement
    }

    fn pauses_game(&self) -> bool {
        self.pauses_game
    }

    fn background(&self) -> ScreenBackground {
        self.background
    }

    fn is_container(&self) -> bool {
        self.is_container
    }

    fn list(&self) -> Option<&ScrollList> {
        self.list.as_ref()
    }

    fn list_mut(&mut self) -> &mut Option<ScrollList> {
        &mut self.list
    }

    fn width(&self) -> f64 {
        self.width()
    }

    fn height(&self) -> f64 {
        self.height()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_screen_creation() {
        let game = Box::into_raw(Box::new(GameContext::new()));
        let screen = Screen::new(game);
        assert_eq!(screen.buttons.len(), 0);
        assert_eq!(screen.fields.len(), 0);
        assert!(!screen.allows_movement);
        assert!(!screen.pauses_game);
        assert_eq!(screen.background, ScreenBackground::World);
    }

    #[test]
    fn test_screen_manager_creation() {
        let game = Box::into_raw(Box::new(GameContext::new()));
        let manager = ScreenManager::new(game);
        assert!(manager.current.is_none());
        assert!(!manager.ignore_unlock);
        assert_eq!(manager.last_size, "");
    }

    #[test]
    fn test_screen_background_enum() {
        assert_eq!(ScreenBackground::World, ScreenBackground::World);
        assert_eq!(ScreenBackground::Dirt, ScreenBackground::Dirt);
        assert_ne!(ScreenBackground::World, ScreenBackground::Dirt);
    }

    #[test]
    fn test_scroll_list() {
        let mut list = ScrollList::new(0.0, 100.0, 20.0, 10);
        assert_eq!(list.amount_scrolled, 0.0);
        assert_eq!(list.max_scroll(), 100.0);

        list.wheel(1.0);
        assert_eq!(list.amount_scrolled, 10.0);

        list.wheel(100.0);
        list.clamp();
        assert_eq!(list.amount_scrolled, 100.0);
    }
}