//! Port of the music-ticker section of `client/js/audio/sound.js`:
//! `SoundManager._musicType()` (Minecraft.getAmbientMusicType) and
//! `SoundManager._musicTick()` (MusicTicker.update).
//!
//! The previous draft in this file invented a `MusicTimer` struct with a
//! hard-coded `2147483647` reset and no track selection — that state machine
//! does not exist in sound.js (and sound.js has no fade logic at all). It has
//! been replaced by the real state machine below.
//!
//! The audio output itself (`this.play(...)`, `voice.stop()`, `voice.ended`)
//! is browser-bound and stays behind the `SoundAudio` contract in `sound.rs`;
//! this module models the timing/state decisions only.

use wasm_bindgen::prelude::*;

use crate::sound_alg2::RandomSource;

/// JS: `Minecraft.getAmbientMusicType` result — `[event, minDelay, maxDelay]`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct MusicTrack {
    /// JS: the music event name (`music.game`, `music.menu`, ...).
    pub event: &'static str,
    /// JS: minimum delay in ticks.
    pub min_delay: i64,
    /// JS: maximum delay in ticks.
    pub max_delay: i64,
}

/// JS: `const [name, min, max] = this._musicType();`
///
/// `end_boss` is JS `g.hud.bossFlag(2)` (GuiBossOverlay.shouldPlayEndBossMusic)
/// and `creative_flight` is `g.player.creative && g.player.allowFlying`.
pub fn music_type(is_credits: bool, in_world: bool, dimension: i32, end_boss: bool, creative_flight: bool) -> MusicTrack {
    // JS: if (scr && scr.isCredits) return ['music.credits', 2147483647, 2147483647];
    if is_credits {
        return track("music.credits", 2147483647, 2147483647);
    }
    // JS: if (!g.inWorld) return ['music.menu', 20, 600];
    if !in_world {
        return track("music.menu", 20, 600);
    }
    // JS: if (g.dimension === -1) return ['music.nether', 1200, 3600];
    if dimension == -1 {
        return track("music.nether", 1200, 3600);
    }
    // JS: if (g.dimension === 1) return g.hud.bossFlag(2) ? ['music.dragon', 0, 0] : ['music.end', 6000, 24000];
    if dimension == 1 {
        return if end_boss { track("music.dragon", 0, 0) } else { track("music.end", 6000, 24000) };
    }
    // JS: if (g.player.creative && g.player.allowFlying) return ['music.creative', 1200, 3600];
    if creative_flight {
        return track("music.creative", 1200, 3600);
    }
    // JS: return ['music.game', 12000, 24000];
    track("music.game", 12000, 24000)
}

fn track(event: &'static str, min: i64, max: i64) -> MusicTrack {
    MusicTrack { event, min_delay: min, max_delay: max }
}

/// JS: `const rand = (a, b) => (a >= b ? a : a + Math.floor(Math.random() * (b - a + 1)));`
///
/// Draws from `rng` only when `a < b`, exactly like the JS closure.
pub fn music_rand(a: i64, b: i64, rng: &mut dyn RandomSource) -> i64 {
    if a >= b {
        return a;
    }
    let draw = rng.random();
    a + (draw * ((b - a + 1) as f64)).floor() as i64
}

/// JS: the `this.musicTimer` / `this.music` / `this.musicName` / `this.musicPending`
/// fields of SoundManager, grouped.
#[derive(Debug, Clone, PartialEq)]
pub struct MusicTickerState {
    /// JS: `this.musicTimer` — ticks left until the next track attempt (starts at 100).
    pub timer: i64,
    /// JS: `this.music` — token of the active music handle (None = not playing).
    pub music: Option<u64>,
    /// JS: `this.musicName` — the event name requested/playing.
    pub music_name: Option<String>,
    /// JS: `this.musicPending` — a play() request is in flight.
    pub music_pending: bool,
    /// JS: the `[min, max]` captured by the `.then` closure when the play started.
    pub pending_range: (i64, i64),
}

impl Default for MusicTickerState {
    fn default() -> Self {
        Self { timer: 0, music: None, music_name: None, music_pending: false, pending_range: (0, 0) }
    }
}

/// JS: what `MusicTicker.update` asks the engine to do this tick.
#[derive(Debug, Default, Clone, PartialEq, Eq)]
pub struct MusicTickOutput {
    /// JS: `this.music.voice.stop()` — the active track no longer matches the wanted type.
    pub stop_voice: Option<u64>,
    /// JS: `this.play(name, 0, 0, 0, 1, 1, { global: true })`.
    pub start: Option<String>,
}

/// JS: `_musicTick()` — MusicTicker.update.
///
/// `voice_ended` is JS `this.music.voice.ended` (only meaningful when a track
/// handle exists; a handle that already left `playing` counts as ended).
pub fn music_tick(state: &mut MusicTickerState, track: &MusicTrack, voice_ended: bool, rng: &mut dyn RandomSource) -> MusicTickOutput {
    let mut out = MusicTickOutput::default();
    let name = track.event;
    let (min, max) = (track.min_delay, track.max_delay);
    // JS: if (this.music) {
    if let Some(token) = state.music {
        // JS: if (this.musicName !== name) { this.music.voice.stop(); this.musicTimer = rand(0, Math.floor(min / 2)); }
        if state.music_name.as_deref() != Some(name) {
            out.stop_voice = Some(token);
            state.timer = music_rand(0, ((min as f64) / 2.0).floor() as i64, rng);
        }
        // JS: if (this.music.voice.ended || this.musicName !== name) { this.music = null; this.musicTimer = Math.min(rand(min, max), this.musicTimer); }
        if voice_ended || state.music_name.as_deref() != Some(name) {
            state.music = None;
            state.timer = state.timer.min(music_rand(min, max, rng));
        }
    }
    // JS: if (!this.music && !this.musicPending && this.musicTimer-- <= 0) {
    if state.music.is_none() && !state.music_pending {
        // JS: this.musicTimer-- — post-decrement: compare the old value, then decrement.
        let old = state.timer;
        state.timer -= 1;
        if old <= 0 {
            // JS: this.musicPending = true; this.musicName = name;
            state.music_pending = true;
            state.music_name = Some(name.to_string());
            state.pending_range = (min, max);
            // JS: this.play(name, 0, 0, 0, 1, 1, { global: true }).then(...)
            out.start = Some(name.to_string());
        }
    }
    out
}

/// JS: the `.then((h) => { this.musicPending = false; this.music = h; this.musicTimer = 2147483647; if (!h) this.musicTimer = rand(min, max); })`
/// continuation. `min`/`max` come from the tick that initiated the play (the JS
/// closure captured them), stored in `state.pending_range`.
pub fn music_play_resolved(state: &mut MusicTickerState, handle: Option<u64>, rng: &mut dyn RandomSource) {
    state.music_pending = false;
    state.music = handle;
    state.timer = 2147483647;
    if handle.is_none() {
        let (min, max) = state.pending_range;
        state.timer = music_rand(min, max, rng);
    }
}

// -------------------------------------------------------------- exports

/// JS: `_musicType()` result for wasm consumers.
#[wasm_bindgen(getter_with_clone)]
pub struct MusicTrackInfo {
    pub event: String,
    pub min_delay: f64,
    pub max_delay: f64,
}

/// JS: `SoundManager._musicType()` (internal in JS, exported here for wasm glue).
#[wasm_bindgen]
pub fn music_type_for(is_credits: bool, in_world: bool, dimension: i32, end_boss: bool, creative_flight: bool) -> MusicTrackInfo {
    let t = music_type(is_credits, in_world, dimension, end_boss, creative_flight);
    MusicTrackInfo { event: t.event.to_string(), min_delay: t.min_delay as f64, max_delay: t.max_delay as f64 }
}

/// JS: `const rand = (a, b) => ...` with the Math.random() draw supplied by the
/// caller (wasm-friendly form of [`music_rand`]).
#[wasm_bindgen]
pub fn music_rand_with_draw(a: f64, b: f64, draw: f64) -> f64 {
    if a >= b {
        a
    } else {
        a + (draw * (b - a + 1.0)).floor()
    }
}

// ---------------------------------------------------------------- tests

#[cfg(test)]
mod tests {
    use super::*;
    use crate::sound_alg2::SeqRandom;

    #[test]
    fn music_type_matches_the_js_chain() {
        // JS: scr.isCredits wins over everything.
        assert_eq!(music_type(true, false, 0, false, false), track("music.credits", 2147483647, 2147483647));
        // JS: !g.inWorld -> menu.
        assert_eq!(music_type(false, false, 0, false, false), track("music.menu", 20, 600));
        // JS: dimension -1 -> nether; dimension 1 -> end/dragon.
        assert_eq!(music_type(false, true, -1, false, false), track("music.nether", 1200, 3600));
        assert_eq!(music_type(false, true, 1, true, false), track("music.dragon", 0, 0));
        assert_eq!(music_type(false, true, 1, false, false), track("music.end", 6000, 24000));
        // JS: creative + allowFlying -> creative.
        assert_eq!(music_type(false, true, 0, false, true), track("music.creative", 1200, 3600));
        // JS: default -> game.
        assert_eq!(music_type(false, true, 0, false, false), track("music.game", 12000, 24000));
    }

    #[test]
    fn music_rand_matches_the_js_closure() {
        // a >= b returns a without drawing (an empty SeqRandom proves no draw is needed).
        assert_eq!(music_rand(5, 5, &mut SeqRandom::new(&[])), 5);
        assert_eq!(music_rand(7, 0, &mut SeqRandom::new(&[])), 7);
        assert_eq!(music_rand(0, 0, &mut SeqRandom::new(&[])), 0);
        // JS: a + Math.floor(draw * (b - a + 1))
        assert_eq!(music_rand(2, 5, &mut SeqRandom::new(&[0.0])), 2);
        assert_eq!(music_rand(2, 5, &mut SeqRandom::new(&[0.5])), 4);
        assert_eq!(music_rand(2, 5, &mut SeqRandom::new(&[0.999])), 5);
        // rand(12000, 24000) with draw 0.5 -> 12000 + floor(0.5 * 12001) = 18000
        assert_eq!(music_rand(12000, 24000, &mut SeqRandom::new(&[0.5])), 18000);
    }

    fn state(timer: i64) -> MusicTickerState {
        MusicTickerState { timer, ..MusicTickerState::default() }
    }

    #[test]
    fn music_tick_decrements_without_drawing() {
        let mut s = state(100);
        let out = music_tick(&mut s, &track("music.game", 12000, 24000), false, &mut SeqRandom::new(&[]));
        assert_eq!(out, MusicTickOutput::default());
        assert_eq!(s.timer, 99);
        assert!(!s.music_pending);
    }

    #[test]
    fn music_tick_starts_at_zero_with_post_decrement() {
        // JS: this.musicTimer-- <= 0 compares 0, then stores -1.
        let mut s = state(0);
        let out = music_tick(&mut s, &track("music.game", 12000, 24000), false, &mut SeqRandom::new(&[]));
        assert_eq!(out.start, Some("music.game".to_string()));
        assert!(s.music_pending);
        assert_eq!(s.music_name.as_deref(), Some("music.game"));
        assert_eq!(s.pending_range, (12000, 24000));
        assert_eq!(s.timer, -1);
    }

    #[test]
    fn music_tick_negative_timer_starts_too() {
        let mut s = state(-3);
        let out = music_tick(&mut s, &track("music.menu", 20, 600), false, &mut SeqRandom::new(&[]));
        assert_eq!(out.start, Some("music.menu".to_string()));
        assert_eq!(s.timer, -4);
    }

    #[test]
    fn music_tick_pending_blocks_a_restart() {
        let mut s = state(0);
        s.music_pending = true;
        let out = music_tick(&mut s, &track("music.game", 12000, 24000), false, &mut SeqRandom::new(&[]));
        assert_eq!(out, MusicTickOutput::default());
        // JS: the condition short-circuits, so the timer is not decremented.
        assert_eq!(s.timer, 0);
    }

    #[test]
    fn music_tick_active_track_untouched() {
        let mut s = state(50);
        s.music = Some(7);
        s.music_name = Some("music.game".to_string());
        let out = music_tick(&mut s, &track("music.game", 12000, 24000), false, &mut SeqRandom::new(&[]));
        assert_eq!(out, MusicTickOutput::default());
        assert_eq!(s.music, Some(7));
        assert_eq!(s.timer, 50);
    }

    #[test]
    fn music_tick_active_track_ended() {
        let mut s = state(50);
        s.music = Some(7);
        s.music_name = Some("music.game".to_string());
        // JS: this.music.voice.ended -> this.music = null; timer = Math.min(rand(min, max), timer)
        // rand(12000, 24000) with draw 0.0 = 12000; min(12000, 50) = 50.
        let out = music_tick(&mut s, &track("music.game", 12000, 24000), true, &mut SeqRandom::new(&[0.0]));
        assert_eq!(out.stop_voice, None);
        assert_eq!(s.music, None);
        // JS: the reschedule sets 50, then the unconditional `musicTimer--`
        // post-decrement in the third block lands on 49 (no play: 50 > 0).
        assert_eq!(s.timer, 49);
    }

    #[test]
    fn music_tick_track_type_changed_stops_and_reschedules() {
        let mut s = state(5000);
        s.music = Some(7);
        s.music_name = Some("music.game".to_string());
        // Switching to the menu type: JS stops the voice, timer = rand(0, 6000) then
        // (name still mismatched) timer = Math.min(rand(20, 600), timer).
        // Draws: 0.0 -> rand(0, 6000) = 0; 0.5 -> rand(20, 600) = 20 + 290 = 310; min(310, 0) = 0.
        let out = music_tick(&mut s, &track("music.menu", 20, 600), false, &mut SeqRandom::new(&[0.0, 0.5]));
        assert_eq!(out.stop_voice, Some(7));
        assert_eq!(s.music, None);
        // JS: the reschedule lands on 0, the post-decrement makes it -1 and the
        // play branch fires (0 <= 0); the timer stays -1 until the promise resolves.
        assert_eq!(s.timer, -1);
        assert!(s.music_pending);
    }

    #[test]
    fn music_play_resolved_with_handle_sets_the_sentinel() {
        let mut s = state(0);
        s.music_pending = true;
        s.pending_range = (12000, 24000);
        music_play_resolved(&mut s, Some(42), &mut SeqRandom::new(&[]));
        assert!(!s.music_pending);
        assert_eq!(s.music, Some(42));
        assert_eq!(s.timer, 2147483647);
    }

    #[test]
    fn music_play_resolved_without_handle_rolls_a_new_delay() {
        let mut s = state(0);
        s.music_pending = true;
        s.pending_range = (12000, 24000);
        // JS: this.musicTimer = 2147483647; if (!h) this.musicTimer = rand(min, max);
        // draw 0.5 -> 12000 + floor(0.5 * 12001) = 18000.
        music_play_resolved(&mut s, None, &mut SeqRandom::new(&[0.5]));
        assert!(!s.music_pending);
        assert_eq!(s.music, None);
        assert_eq!(s.timer, 18000);
    }
}
