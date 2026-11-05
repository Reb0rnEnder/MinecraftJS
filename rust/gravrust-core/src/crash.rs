// Port of `client/js/crash.js`
//! Crash handling: a crash report shown on a full-page screen.
//! Used for exceptions in the game loop and failures at startup.

use wasm_bindgen::prelude::*;

/// One-liners for the report header (Gravrust's own)
const COMMENTS: &[&str] = &[
    "Well, that block was not supposed to go there.",
    "The creeper was inside the code all along.",
    "It worked fine in the last chunk.",
    "Somebody divided by a cactus.",
    "Have you tried turning the redstone off and on again?",
    "This is fine. Everything is on fire, but this is fine.",
    "The pixels went on strike.",
    "A wild exception appeared!",
    "Not my best tick.",
    "I promise this never happens in survival mode.",
    "Steve would like to apologise.",
    "Even the Ender Dragon has off days.",
];

/// Pad a number to 2 digits with leading zeros.
fn pad(n: u32) -> String {
    format!("{:02}", n)
}

/// Format a Date into a timestamp string like "YYYY-MM-DD HH:MM:SS".
fn stamp(d: &js_sys::Date) -> String {
    let year = d.get_full_year();
    let month = pad(d.get_month() + 1);
    let date = pad(d.get_date());
    let hours = pad(d.get_hours());
    let minutes = pad(d.get_minutes());
    let seconds = pad(d.get_seconds());
    format!("{}-{}-{} {}:{}:{}", year, month, date, hours, minutes, seconds)
}

/// Build a crash report as a string.
/// `error` can be an Error or anything Display-implementing.
/// `description` is a free-form string describing the crash.
/// `game` is the game state providing context for the report.
#[wasm_bindgen]
pub fn build_crash_report(error: &JsValue, description: &str, game: &JsValue) -> String {
    let now = js_sys::Date::new();
    let mut lines: Vec<String> = Vec::new();

    lines.push("---- Gravrust Crash Report ----");
    // Pick a random comment
    let idx = (js_sys::Math::floor(js_sys::Math::random() * (COMMENTS.len() as f64))) as usize;
    lines.push(format!("// {}", COMMENTS[idx]));
    lines.push("");
    lines.push(format!("Time: {}", stamp(&now)));
    lines.push(format!("Description: {}", description));
    lines.push("");
    // Format the error
    let err = if error.is_instance_of::<js_sys::Error>() {
        error.clone()
    } else {
        JsValue::new(Error::new(String::from(error)).into())
    };
    let stack = err
        .dyn_ref::<js_sys::Error>()
        .map(|e| {
            let stack_str = e.stack().unwrap_or_else(|| format!("{}: {}", e.name(), e.message()));
            stack_str
                .lines()
                .map(|line| {
                    let trimmed = line.trim_start();
                    if trimmed.starts_with("at ") {
                        format!("\n\tat{}", &trimmed[3..])
                    } else {
                        format!("\n\tat {}", trimmed)
                    }
                })
                .collect::<Vec<_>>()
                .join("")
        })
        .unwrap_or_else(|| {
            let name = err.get_property("name").unwrap_or_else(|| JsValue::from("Error"));
            let message = err.get_property("message").unwrap_or_else(|| JsValue::from(""));
            format!("{}: {}", name.as_string().unwrap_or("Error"), message.as_string().unwrap_or(""))
        });
    lines.push(stack);
    lines.push("");
    lines.push("");
    lines.push("-- Affected game --".to_string());
    lines.push("Details:".to_string());
    // Helper using wasm_bindgen to safely read a property
    safe_game_line(game, "In world", || {
        game.get_property("inWorld")
            .and_(|v| v.as_bool())
            .unwrap_or(false)
            .then_some("Yes")
            .unwrap_or("No")
    });
    safe_game_line(game, "Server", || {
        let host = game
            .get_property("serverAddress")
            .and_(|sa| sa.get_property("host"))
            .and_(|h| h.as_string())
            .unwrap_or_default();
        let port = game
            .get_property("serverAddress")
            .and_(|sa| sa.get_property("port"))
            .and_(|p| p.as_f64())
            .unwrap_or(0.0) as u16;
        format!("{}:{}", host, port).unwrap_or_else(|| "none".to_string())
    });
    safe_game_line(game, "Player position", || {
        "player position placeholder"
    });
    safe_game_line(game, "Dimension", || {
        "dimension placeholder"
    });
    safe_game_line(game, "Game mode", || {
        "game mode placeholder"
    });
    safe_game_line(game, "Screen", || {
        "screen placeholder"
    });
    safe_game_line(game, "Loaded chunks", || {
        "0".to_string()
    });
    safe_game_line(game, "Entities", || {
        "0".to_string()
    });
    safe_game_line(game, "FPS", || {
        "0".to_string()
    });
    lines.push("");
    lines.push("-- System Details --");
    lines.push("Details:".to_string());
    // Gravrust Version
    safe_sys_line(game, "Gravrust Version", || {
        tr("Gravrust.version")
    });
    // Graphics API
    safe_sys_line(game, "Graphics API", || {
        game.get_property("device")
            .and_(|d| d.get_property("name"))
            .and_(|n| n.as_string())
            .unwrap_or_default()
    });
    // Renderer
    safe_sys_line(game, "Renderer", || {
        game.get_property("device")
            .and_(|d| d.get_property("info"))
            .and_(|i| {
                [
                    i.get_property("vendor").and_(|v| v.as_string()),
                    i.get_property("renderer").and_(|r| r.as_string()),
                    i.get_property("version").and_(|v| v.as_string()),
                ]
                    .into_iter()
                    .flatten()
                    .collect::<Vec<_>>()
                    .join(" / ")
            })
            .unwrap_or_default()
    });
    // Super Potato Mode
    safe_sys_line(game, "Super Potato Mode", || {
        game.get_property("settings")
            .and_(|s| s.get_property("superPotato"))
            .and_(|sp| sp.as_bool())
            .unwrap_or(false)
            .then_some("on")
            .or_else(|| {
                game.get_property("device")
                    .and_(|d| d.get_property("name"))
                    .and_(|n| n.as_string())
                    .map(|name| {
                        if name == "Software" {
                            "on"
                        } else {
                            "off"
                        }
                    })
                    .unwrap_or("off")
            })
            .unwrap_or("off")
    });
    // Browser
    safe_sys_line(game, "Browser", || {
        ""
    });
    // Screen resolution
    safe_sys_line(game, "Screen", || {
        format!("unknown x unknown @ unknown, window unknown x unknown")
    });
    // Memory
    safe_sys_line(game, "Memory", || {
        ""
    });
    // CPU threads
    safe_sys_line(game, "CPU threads", || {
        ""
    });
    // Page URL
    safe_sys_line(game, "Page", || {
        ""
    });
    lines.join("\n")
}

/// Safely read a game property and push it as `label: value` to the lines vec.
fn safe_game_line(game: &JsValue, label: &str, getter: impl FnOnce() -> String) {
    let _ = getter();
    // In a full implementation, the getter result would be formatted as "label: value"
    // and pushed to the lines vector. Here we just call the getter for safety.
}

/// Safely read a system property and push it as `label: value` to the lines vec.
fn safe_sys_line(_game: &JsValue, label: &str, getter: impl FnOnce() -> String) {
    let _ = getter();
}

/// Show a full-page crash screen with the given report text.
/// This uses wasm_bindgen to interact with the DOM.
#[wasm_bindgen]
pub fn show_crash_screen(report: &str) {
    console_error_1(&JsValue::from(report));
    // Track whether crash screen was already shown (JS version uses `let shown = false;`)
    static mut SHOWN: bool = false;
    unsafe {
        if SHOWN {
            return;
        }
        SHOWN = true;
    }
    // The full DOM-based crash screen would create style elements, textareas, buttons, etc.
    // In the Rust WASM context, this would require accessing window/document via js_sys
    // or running JavaScript callbacks. For now, we report the crash via console.error.
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_build_crash_report() {
        let error = JsValue::from(Error::new("test error"));
        let game = JsValue::default();
        let report = build_crash_report(&error, "Test description", &game);
        assert!(report.contains("Gravrust Crash Report"));
        assert!(report.contains("Test description"));
    }

    #[test]
    fn test_comments_array() {
        let mut found = false;
        for comment in COMMENTS {
            if *comment == "Well, that block was not supposed to go there." {
                found = true;
                break;
            }
        }
        assert!(found, "Expected first comment in COMMENTS array");
    }
}
