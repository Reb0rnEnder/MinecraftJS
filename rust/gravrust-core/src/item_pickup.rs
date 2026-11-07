//! Port of `client/js/game/item-pickup.js` (upstream MinecraftJS 1.8.9).
//!
//! ItemPickupParticle/EntityPickupFX owns a render copy, independently of the
//! server entity. Collect and destroy packets commonly arrive in the same
//! batch. All interpolation math keeps the JS `Math.fround` semantics.

use serde_json::Value;

/// JS: `const HALF_EYE_TARGET = false;` — 1.8.9 aims at feet + 0.5, not half eye.
const HALF_EYE_TARGET: bool = false;

/// JS: `const f = Math.fround`.
#[inline]
fn fround(v: f64) -> f64 {
    v as f32 as f64
}

fn num(v: &Value) -> f64 {
    v.as_f64().unwrap_or(0.0)
}

/// JS: `pickupVisual(source, target, id)` — clones the source entity as a
/// render-only pickup effect: `{...source, id, pickable:false, item: clone,
/// pickupVisual:{age:0, target, start:[x,y,z]}}`.
pub fn pickup_visual(source: &Value, target: &Value, id: i64) -> Value {
    let mut e = source.clone();
    if let Some(obj) = e.as_object_mut() {
        obj.insert("id".into(), Value::from(id));
        obj.insert("pickable".into(), Value::Bool(false));
        // JS shallow-clones source.item one level.
        if let Some(item) = obj.get("item") {
            let item_clone = if item.is_object() {
                let mut m = item.clone();
                if let Some(im) = m.as_object_mut() {
                    // `{...source.item}` is a shallow copy — keep as-is.
                    let _ = im;
                }
                m
            } else {
                item.clone()
            };
            obj.insert("item".into(), item_clone);
        }
        obj.insert(
            "pickupVisual".into(),
            serde_json::json!({
                "age": 0,
                "target": target.clone(),
                "start": [num(source.get("x").unwrap_or(&Value::Null)),
                          num(source.get("y").unwrap_or(&Value::Null)),
                          num(source.get("z").unwrap_or(&Value::Null))],
            }),
        );
    }
    e
}

/// JS: `pickupPosition(effect, player, partial)` — cubic-ease flight from the
/// spawn point toward the collector's interpolated position.
///
/// Returns `(x, y, z)`.
pub fn pickup_position(effect: &Value, player: &Value, partial: f64) -> (f64, f64, f64) {
    let fx = effect.get("pickupVisual").unwrap_or(&Value::Null);
    if fx.is_null() {
        return (num(effect.get("x").unwrap_or(&Value::Null)),
                num(effect.get("y").unwrap_or(&Value::Null)),
                num(effect.get("z").unwrap_or(&Value::Null)));
    }
    // JS: const target = fx.target || player
    let target = match fx.get("target") {
        Some(t) if !t.is_null() => t,
        _ => player,
    };
    let p = fround(partial);
    let lerp = |a: f64, b: f64| a + (b - a) * p;

    // JS: phase = fround(fround(fx.age + p) / 3); phase = fround(phase * phase)
    let age = num(fx.get("age").unwrap_or(&Value::Null));
    let mut phase = fround(fround(age + p) / 3.0);
    phase = fround(phase * phase);

    // JS: eye = typeof target.eyeHeight === 'function' ? target.eyeHeight()
    //        : (target.eyeHeight ?? (target.height || 1.8) * .85)
    // In the Rust entity model eyeHeight is data, never a function; the
    // fallback chain is preserved exactly.
    let eye = match target.get("eyeHeight") {
        Some(v) if !v.is_null() => num(v),
        _ => {
            let h = target.get("height").and_then(|v| v.as_f64()).unwrap_or(0.0);
            (if h != 0.0 { h } else { 1.8 }) * 0.85
        }
    };

    let sx = num(fx.get("start").and_then(|s| s.get(0)).unwrap_or(&Value::Null));
    let sy = num(fx.get("start").and_then(|s| s.get(1)).unwrap_or(&Value::Null));
    let sz = num(fx.get("start").and_then(|s| s.get(2)).unwrap_or(&Value::Null));

    let tx = lerp(
        target.get("prevX").and_then(|v| v.as_f64()).unwrap_or(num(target.get("x").unwrap_or(&Value::Null))),
        num(target.get("x").unwrap_or(&Value::Null)),
    );
    let tz = lerp(
        target.get("prevZ").and_then(|v| v.as_f64()).unwrap_or(num(target.get("z").unwrap_or(&Value::Null))),
        num(target.get("z").unwrap_or(&Value::Null)),
    );
    let ty = if HALF_EYE_TARGET {
        lerp(
            target.get("prevY").and_then(|v| v.as_f64()).unwrap_or(num(target.get("y").unwrap_or(&Value::Null))),
            num(target.get("y").unwrap_or(&Value::Null)) + eye / 2.0,
        )
    } else {
        lerp(
            target.get("prevY").and_then(|v| v.as_f64()).unwrap_or(num(target.get("y").unwrap_or(&Value::Null))),
            num(target.get("y").unwrap_or(&Value::Null)),
        ) + 0.5
    };

    (
        sx + (tx - sx) * phase,
        sy + (ty - sy) * phase,
        sz + (tz - sz) * phase,
    )
}

/// JS: `tickPickupVisuals(manager)` — ages every pickup; effects live 3 ticks.
/// Returns the expired effects so the caller can run
/// `game.entityRenderer.remove(e)` (renderer ownership stays outside this
/// pure module, matching the JS split where the manager only filters).
pub fn tick_pickup_visuals(pickups: &mut Vec<Value>) -> Vec<Value> {
    let mut expired = Vec::new();
    pickups.retain_mut(|e| {
        let obj = match e.as_object_mut() {
            Some(o) => o,
            None => return false,
        };
        let age = obj.get("pickupVisual").and_then(|p| p.get("age")).and_then(|a| a.as_i64()).unwrap_or(0) + 1;
        if let Some(pv) = obj.get_mut("pickupVisual").and_then(|p| p.as_object_mut()) {
            pv.insert("age".into(), Value::from(age));
        }
        if age >= 3 {
            expired.push(e.clone());
            false
        } else {
            true
        }
    });
    expired
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn pickup_visual_clones_and_flags() {
        let src = json!({"id": 7, "x": 1.0, "y": 2.0, "z": 3.0, "pickable": true, "item": {"count": 1}});
        let target = json!({"x": 5.0, "y": 2.0, "z": 3.0});
        let e = pickup_visual(&src, &target, 99);
        assert_eq!(e["id"], 99);
        assert_eq!(e["pickable"], false);
        assert_eq!(e["item"]["count"], 1);
        assert_eq!(e["pickupVisual"]["age"], 0);
        assert_eq!(e["pickupVisual"]["start"][0], 1.0);
    }

    #[test]
    fn pickup_position_flies_to_feet_plus_half() {
        let mut effect = json!({"pickupVisual": {"age": 0, "start": [0.0, 0.0, 0.0], "target": {"x": 3.0, "y": 0.0, "z": 0.0}}});
        let player = json!({});
        // tick 0: phase = fround(fround(0+0)/3)^2 = 0
        let (x, _y, _z) = pickup_position(&effect, &player, 0.0);
        assert_eq!(x, 0.0);
        // age 1 at partial 0: phase = (1/3)^2
        effect["pickupVisual"]["age"] = json!(1);
        let (x, y, _z) = pickup_position(&effect, &player, 0.0);
        let phase = fround(fround(fround(1.0) / 3.0));
        let phase = fround(phase * phase);
        assert!((x - (3.0 * phase)).abs() < 1e-9);
        assert!((y - (0.0 + 0.5 * phase)).abs() < 1e-9); // HALF_EYE_TARGET=false → +0.5
    }

    #[test]
    fn tick_ages_and_expires_at_three() {
        let mut pickups = vec![
            json!({"pickupVisual": {"age": 0}}),
            json!({"pickupVisual": {"age": 2}}),
        ];
        let expired = tick_pickup_visuals(&mut pickups);
        assert_eq!(pickups.len(), 1);
        assert_eq!(pickups[0]["pickupVisual"]["age"], 1);
        assert_eq!(expired.len(), 1); // the age-2 one hit 3
    }
}
