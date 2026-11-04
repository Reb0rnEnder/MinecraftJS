//! Port of `client/js/game/profiler.js`.
//! Minimal Profiler (vanilla's Profiler/ProfilerResult) for the Shift+F3 pie chart.
//! Sections nest with start()/end(); times are smoothed over frames so the chart is readable.

use wasm_bindgen::prelude::*;

/// Platform accessor - wrapped so the profiler can call `platform().now()`.
struct ProfilerPlatform;

#[wasm_bindgen]
impl ProfilerPlatform {
    /// Returns the current time in milliseconds (via performance.now()).
    pub fn now() -> f64 {
        // Since we're in WASM, we call into the JS platform via wasm_bindgen.
        // The platform is set by the host before profiler use.
        todo!() // Will be resolved via the hosted platform context
    }
}

/// Minimal Profiler (vanilla's Profiler/ProfilerResult) for the Shift+F3 pie chart.
/// Sections nest with start()/end(); times are smoothed over frames so the chart is readable.
pub struct Profiler {
    enabled: bool,
    stack: Vec<(String, f64)>, // (path, startTime)
    times: std::collections::HashMap<String, f64>, // path -> smoothed ms per frame
    frame: std::collections::HashMap<String, f64>, // path -> ms in the current frame
    selected: String, // section shown by the pie chart
}

#[wasm_bindgen]
impl Profiler {
    /// Creates a new profiler instance.
    #[wasm_bindgen(constructor)]
    pub fn new() -> Profiler {
        Profiler {
            enabled: false,
            stack: Vec::new(),
            times: std::collections::HashMap::new(),
            frame: std::collections::HashMap::new(),
            selected: "root".to_string(),
        }
    }

    /// St profiling a named section. If the profiler is not enabled, this is a no-op.
    pub fn start(&mut self, name: &str) {
        if !self.enabled {
            return;
        }
        let parent = if self.stack.last().map(|(p, _)| p.as_str()).unwrap_or("") != "" {
            self.stack.last().map(|(p, _)| p.clone()).unwrap_or_default()
        } else {
            "".to_string()
        };
        let path = if parent.is_empty() {
            name.to_string()
        } else {
            format!("{}.{}", parent, name)
        };
        self.stack.push((path, platform_now()));
    }

    /// End profiling the current section. If the profiler is not enabled or the stack is empty, this is a no-op.
    pub fn end(&mut self) {
        if !self.enabled || self.stack.is_empty() {
            return;
        }
        let (path, t0) = self.stack.pop().unwrap();
        let elapsed = platform_now() - t0;
        *self.frame.entry(path.clone()).or_insert(0.0) += elapsed;
    }

    /// End the current section and start a new one.
    pub fn end_start(&mut self, name: &str) {
        self.end();
        self.start(name);
    }

    /// Fold this frame's timings into the smoothed values.
    pub fn end_frame(&mut self) {
        if !self.enabled {
            return;
        }
        for (k, v) in &self.times {
            // smoothed = 0.9 * old + 0.1 * new
            // We need to update in place
        }
        // Actually, let's redo this properly
        let mut new_times = std::collections::HashMap::new();
        for (k, v) in &self.times {
            let frame_v = self.frame.get(k).copied().unwrap_or(0.0);
            new_times.insert(k.clone(), v * 0.9 + frame_v * 0.1);
        }
        for (k, v) in &self.frame {
            if !self.times.contains_key(k) {
                new_times.insert(k.clone(), v);
            }
        }
        self.times = new_times;
        self.frame.clear();
    }

    /// Get the ProfilerResult for a section: children sorted by time, plus "unspecified" for the rest.
    pub fn results(&self, path: &str) -> ProfilerResult {
        let total = self.times.get("root").copied().unwrap_or(0.0);
        let own = self.times.get(path).copied().unwrap_or(0.0);
        let children: Vec<ProfilerChild> = self
            .times
            .keys()
            .filter(|k| k.starts_with(&format!("{}.", path)) && !k.starts_with(&format!("{}.", path).chars().chain(/* rest check */).collect::<String>()))
            .map(|k| {
                let rest = k.strip_prefix(&format!("{}.", path)).unwrap_or(".");
                let ms = self.times.get(k).copied().unwrap_or(0.0);
                ProfilerChild {
                    name: rest.to_string(),
                    ms,
                }
            })
            .collect();
        let sum: f64 = children.iter().map(|c| c.ms).sum();
        let mut out_children = children;
        if own > sum + 0.0001 {
            out_children.push(ProfilerChild {
                name: "unspecified".to_string(),
                ms: own - sum,
            });
        }
        out_children.sort_by(|a, b| b.ms.partial_cmp(&a.ms).unwrap_or(std::cmp::Ordering::Equal));
        let out: Vec<ProfilerEntry> = out_children
            .iter()
            .map(|c| ProfilerEntry {
                name: c.name.clone(),
                parent_pct: if own > 0.0 { c.ms / own * 100.0 } else { 0.0 },
                total_pct: if total > 0.0 { c.ms / total * 100.0 } else { 0.0 },
                color: profiler_color(&c.name),
            })
            .collect();
        ProfilerResult {
            name: path.to_string(),
            total_pct: if total > 0.0 { own / total * 100.0 } else { 0.0 },
            list: out,
        }
    }

    /// Minecraft.updateDebugProfilerName: 0 goes up a level, 1..9 enters that child
    pub fn navigate(&mut self, i: i32) {
        if i == 0 {
            if let Some(p) = self.selected.last_index_of('.') {
                if p >= 0 {
                    self.selected = self.selected.slice(0..p).to_string();
                }
            }
            return;
        }
        let r = self.results(&self.selected);
        if let Some(c) = r.list.get((i - 1) as usize) {
            if c.name != "unspecified" {
                self.selected.push_str(&format!(".{}", c.name));
            }
        }
    }
}

impl Default for Profiler {
    fn default() -> Self {
        Self::new()
    }
}

#[wasm_bindgen]
impl Profiler {
    // Expose constructor via wasm_bindgen
    #[wasm_bindgen(method, getter)]
    pub fn enabled(&self) -> bool {
        self.enabled
    }

    #[wasm_bindgen(method, setter)]
    pub fn set_enabled(&mut self, val: bool) {
        self.enabled = val;
    }
}

#[wasm_bindgen]
pub struct ProfilerResult {
    pub name: String,
    pub total_pct: f64,
    pub list: Vec<ProfilerEntry>,
}

#[wasm_bindgen]
pub struct ProfilerEntry {
    pub name: String,
    pub parent_pct: f64,
    pub total_pct: f64,
    pub color: u32,
}

/// Compute a color from a profiler section name, matching vanilla's algorithm.
fn profiler_color(name: &str) -> u32 {
    let mut h: u32 = 0;
    for c in name.chars() {
        h = (h.wrapping_mul(31) + c as u32) & 0xFFFFFFFF;
    }
    ((h & 0xAAAAAA) + 0x444444) & 0xFFFFFF
}

/// Internal helper to get the current time from the platform.
fn platform_now() -> f64 {
    // This will be hooked up via the hosted platform.
    // In a real WASM context, this would call back into the JS platform.
    0.0 // Placeholder - will be overridden
}

// Public export for the color function
#[wasm_bindgen]
pub fn profiler_color_js(name: &str) -> u32 {
    profiler_color(name)
}