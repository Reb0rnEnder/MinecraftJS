// Port of `client/js/game/profiler.js`
//!
//! Debug profiling (port of Profiler from game.js)
use serde::{Serialize, Deserialize};
use wasm_bindgen::prelude::*;
use std::collections::HashMap;

/// Profiling data for a section
#[derive(Clone, Debug, Serialize, Deserialize)]
#[wasm_bindgen]
pub struct ProfileSection {
    name: String,
    start_time: f64,
    total_time: f64,
    count: u32,
    parent: Option<String>,
}

#[wasm_bindgen]
impl ProfileSection {
    #[wasm_bindgen(constructor)]
    pub fn new(name: String) -> ProfileSection {
        ProfileSection {
            name,
            start_time: 0.0,
            total_time: 0.0,
            count: 0,
            parent: None,
        }
    }
    
    #[wasm_bindgen(getter_with_clone)]
    pub fn name(&self) -> String { self.name.clone() }
    #[wasm_bindgen(getter)]
    pub fn start_time(&self) -> f64 { self.start_time }
    #[wasm_bindgen(getter)]
    pub fn total_time(&self) -> f64 { self.total_time }
    #[wasm_bindgen(getter)]
    pub fn count(&self) -> u32 { self.count }
    #[wasm_bindgen(getter)]
    pub fn avg_time(&self) -> f64 {
        if self.count > 0 { self.total_time / self.count as f64 } else { 0.0 }
    }
}

/// Profiling manager
#[derive(Clone, Debug, Default, Serialize, Deserialize)]
#[wasm_bindgen]
pub struct ProfilingData {
    #[wasm_bindgen(skip)]
    sections: HashMap<String, ProfileSection>,
    frame_start: f64,
    enabled: bool,
    current_section: Option<String>,
    #[wasm_bindgen(skip)]
    section_stack: Vec<String>,
}

#[wasm_bindgen]
impl ProfilingData {
    #[wasm_bindgen(constructor)]
    pub fn new() -> ProfilingData {
        ProfilingData {
            sections: HashMap::new(),
            frame_start: 0.0,
            enabled: false,
            current_section: None,
            section_stack: Vec::new(),
        }
    }
    
    #[wasm_bindgen(getter)]
    pub fn enabled(&self) -> bool { self.enabled }
    
    #[wasm_bindgen(setter)]
    pub fn set_enabled(&mut self, val: bool) { self.enabled = val; }
    
    #[wasm_bindgen(getter)]
    pub fn frame_start(&self) -> f64 { self.frame_start }
    
    #[wasm_bindgen(setter)]
    pub fn set_frame_start(&mut self, val: f64) { self.frame_start = val; }
    
    // NOTE: sections are exposed via sections_json() because HashMap is not wasm-abi
    pub fn sections_json(&self) -> String { serde_json::to_string(&self.sections).unwrap_or_else(|_| "{}".to_string()) }
}

/// Start a profiling section
#[wasm_bindgen]
pub fn profiler_mark_start(profiler: &mut ProfilingData, section: &str) {
    if !profiler.enabled {
        return;
    }
    
    let now = js_sys::Date::now();
    
    let parent = profiler.current_section.clone();
    profiler.section_stack.push(section.to_string());
    profiler.current_section = Some(section.to_string());
    
    profiler.sections.entry(section.to_string()).or_insert_with(|| {
        let mut s = ProfileSection::new(section.to_string());
        s.parent = parent;
        s
    }).start_time = now;
}

/// End a profiling section
#[wasm_bindgen]
pub fn profiler_mark_end(profiler: &mut ProfilingData, section: &str) {
    if !profiler.enabled {
        return;
    }
    
    let now = js_sys::Date::now();
    
    if let Some(section_obj) = profiler.sections.get_mut(section) {
        let duration = now - section_obj.start_time;
        section_obj.total_time += duration;
        section_obj.count += 1;
    }
    
    // Pop from stack
    if !profiler.section_stack.is_empty() {
        profiler.section_stack.pop();
    }
    profiler.current_section = profiler.section_stack.last().cloned();
}

/// Start a new frame
#[wasm_bindgen]
pub fn profiler_start_frame(profiler: &mut ProfilingData) {
    if !profiler.enabled {
        return;
    }
    profiler.frame_start = js_sys::Date::now();
    profiler.current_section = None;
    profiler.section_stack.clear();
}

/// End frame and return total time
#[wasm_bindgen]
pub fn profiler_end_frame(profiler: &mut ProfilingData) -> f64 {
    if !profiler.enabled {
        return 0.0;
    }
    let total = js_sys::Date::now() - profiler.frame_start;
    profiler.frame_start = 0.0;
    total
}

/// Reset profiler data
#[wasm_bindgen]
pub fn profiler_reset(profiler: &mut ProfilingData) {
    profiler.sections.clear();
    profiler.frame_start = 0.0;
    profiler.current_section = None;
    profiler.section_stack.clear();
}

/// Get profiler results as a JSON string.
#[wasm_bindgen]
pub fn profiler_get_results(profiler: &ProfilingData) -> String {
    let mut result = serde_json::Map::new();

    for (name, section) in &profiler.sections {
        let mut obj = serde_json::Map::new();
        obj.insert("name".to_string(), serde_json::json!(name));
        obj.insert("totalTime".to_string(), serde_json::json!(section.total_time));
        obj.insert("count".to_string(), serde_json::json!(section.count));
        obj.insert("avgTime".to_string(), serde_json::json!(section.avg_time()));
        if let Some(parent) = &section.parent {
            obj.insert("parent".to_string(), serde_json::json!(parent));
        }
        result.insert(name.clone(), serde_json::Value::Object(obj));
    }

    serde_json::to_string(&result).unwrap_or_else(|_| "{}".to_string())
}

/// Get profiler data as formatted string (for debug overlay)
#[wasm_bindgen]
pub fn profiler_get_formatted(profiler: &ProfilingData) -> String {
    let mut sections: Vec<_> = profiler.sections.values().collect();
    sections.sort_by(|a, b| b.total_time.partial_cmp(&a.total_time).unwrap());
    
    let mut output = String::new();
    output.push_str("Profiler Results:\n");
    output.push_str("================\n");
    
    for section in sections {
        if section.total_time > 0.0 {
            output.push_str(&format!(
                "{}: {:.2}ms ({} calls, avg {:.2}ms)\n",
                section.name,
                section.total_time,
                section.count,
                section.avg_time()
            ));
        }
    }
    
    output
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_profiler_basic() {
        let mut profiler = ProfilingData::new();
        profiler.set_enabled(true);
        
        profiler_mark_start(&mut profiler, "test");
        // Simulate work
        profiler_mark_end(&mut profiler, "test");
        
        let section = profiler.sections.get("test").unwrap();
        assert!(section.total_time >= 0.0);
        assert_eq!(section.count, 1);
    }
    
    #[test]
    fn test_profiler_nested() {
        let mut profiler = ProfilingData::new();
        profiler.set_enabled(true);
        
        profiler_mark_start(&mut profiler, "parent");
        profiler_mark_start(&mut profiler, "child");
        profiler_mark_end(&mut profiler, "child");
        profiler_mark_end(&mut profiler, "parent");
        
        let parent = profiler.sections.get("parent").unwrap();
        let child = profiler.sections.get("child").unwrap();
        
        assert_eq!(parent.count, 1);
        assert_eq!(child.count, 1);
        assert_eq!(child.parent, Some("parent".to_string()));
    }
    
    #[test]
    fn test_profiler_frame() {
        let mut profiler = ProfilingData::new();
        profiler.set_enabled(true);
        
        profiler_start_frame(&mut profiler);
        profiler_mark_start(&mut profiler, "section1");
        profiler_mark_end(&mut profiler, "section1");
        let total = profiler_end_frame(&mut profiler);
        
        assert!(total >= 0.0);
        assert_eq!(profiler.sections.get("section1").unwrap().count, 1);
    }
    
    #[test]
    fn test_profiler_disabled() {
        let mut profiler = ProfilingData::new();
        profiler.set_enabled(false);
        
        profiler_mark_start(&mut profiler, "test");
        profiler_mark_end(&mut profiler, "test");
        
        assert!(profiler.sections.is_empty());
    }
}
