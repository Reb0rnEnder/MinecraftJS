//! Port of `client/js/game/potionhelper.js` (upstream MinecraftJS 1.8.9).
//!
//! Port of 1.8 PotionHelper: a potion's effects follow from the bits of its
//! damage value through the requirement and amplifier formulas, and its
//! colour from those effects. All `Math.fround` semantics preserved.

use std::collections::HashMap;
use std::sync::Mutex;

/// JS: `const f32 = Math.fround`.
#[inline]
fn f32r(v: f64) -> f64 {
    v as f32 as f64
}

/// One potion entry from JS `POTIONS`.
#[derive(Debug, Clone, Copy)]
pub struct Potion {
    pub id: i64,
    pub color: i64,
    pub eff: f64,
    pub instant: bool,
}

/// JS: `POTIONS` — `{ id: { color, eff, instant } }` (name/bad/mods omitted:
/// not read by the effect/colour functions this module exposes).
pub fn potion(id: i64) -> Option<Potion> {
    let (color, eff, instant) = match id {
        1 => (8171462, 1.0, false),
        2 => (5926017, 0.5, false),
        3 => (14270531, 1.5, false),
        4 => (4866583, 0.5, false),
        5 => (9643043, 1.0, false),
        6 => (16262179, 1.0, true),
        7 => (4393481, 0.5, true),
        8 => (2293580, 1.0, false),
        9 => (5578058, 0.25, false),
        10 => (13458603, 0.25, false),
        11 => (10044730, 1.0, false),
        12 => (14981690, 1.0, false),
        13 => (3035801, 1.0, false),
        14 => (8356754, 1.0, false),
        15 => (2039587, 0.25, false),
        16 => (0x1f1fa1, 1.0, false),
        17 => (5797459, 0.5, false),
        18 => (0x484d48, 0.5, false),
        19 => (5149489, 0.25, false),
        20 => (3484199, 0.25, false),
        21 => (16284963, 1.0, false),
        22 => (0x2552a5, 1.0, false),
        23 => (16262179, 1.0, true),
        _ => return None,
    };
    Some(Potion { id, color, eff, instant })
}

/// JS: `modifierAmount(id, amplifier, amount)` — PotionAttackDamage:
/// strength 1.3 per level, weakness -0.5F per level.
pub fn modifier_amount(id: i64, amplifier: i64, amount: f64) -> f64 {
    if id == 18 {
        return f32r(-0.5 * (amplifier + 1) as f64);
    }
    if id == 5 {
        return 1.3 * (amplifier + 1) as f64;
    }
    amount * (amplifier + 1) as f64
}

/// JS: `REQUIREMENTS` — damage-bit requirement expressions per potion id.
fn requirement(id: i64) -> Option<&'static str> {
    match id {
        10 => Some("0 & !1 & !2 & !3 & 0+6"),
        1 => Some("!0 & 1 & !2 & !3 & 1+6"),
        12 => Some("0 & 1 & !2 & !3 & 0+6"),
        6 => Some("0 & !1 & 2 & !3"),
        19 => Some("!0 & !1 & 2 & !3 & 2+6"),
        18 => Some("!0 & !1 & !2 & 3 & 3+6"),
        7 => Some("!0 & !1 & 2 & 3"),
        2 => Some("!0 & 1 & !2 & 3 & 3+6"),
        5 => Some("0 & !1 & !2 & 3 & 3+6"),
        16 => Some("!0 & 1 & 2 & !3 & 2+6"),
        14 => Some("!0 & 1 & 2 & 3 & 2+6"),
        13 => Some("0 & !1 & 2 & 3 & 2+6"),
        8 => Some("0 & 1 & !2 & 3 & 3+6"),
        _ => None,
    }
}

/// JS: `AMPLIFIERS`.
fn amplifier_expr(id: i64) -> Option<&'static str> {
    match id {
        1 | 3 | 5 | 6 | 7 | 8 | 10 | 11 | 19 => Some("5"),
        _ => None,
    }
}

fn check_flag(n: i64, bit: i64) -> bool {
    (n & (1 << bit)) != 0
}

fn count_set_flags(mut n: i64) -> i64 {
    let mut c = 0;
    while n > 0 {
        n &= n - 1;
        c += 1;
    }
    c
}

/// JS: `term(not, hasMult, negative, comparison, number, mult, damage)`.
#[allow(clippy::too_many_arguments)]
fn term(not: bool, has_mult: bool, negative: bool, comparison: i64, number: i64, mult: i64, damage: i64) -> i64 {
    let mut v = 0i64;
    if not {
        v = if check_flag(damage, number) { 0 } else { 1 };
    } else if comparison != -1 {
        let c = count_set_flags(damage);
        if (comparison == 0 && c == number) || (comparison == 1 && c > number) || (comparison == 2 && c < number) {
            v = 1;
        }
    } else {
        v = if check_flag(damage, number) { 1 } else { 0 };
    }
    if has_mult {
        v *= mult;
    }
    if negative {
        v *= -1;
    }
    v
}

/// JS: `parsePotionEffects` — recursive vanilla expression parser. Vanilla
/// passes "index of | or & minus 1" as the left part's end.
fn parse(s: &[u8], start: usize, end: i64, damage: i64) -> i64 {
    if start >= s.len() || end < 0 || start as i64 >= end {
        return 0;
    }
    let end = end as usize;
    if let Some(i) = (start..end).find(|&k| s[k] == b'|') {
        let a = parse(s, start, i as i64 - 1, damage);
        if a > 0 {
            return a;
        }
        let b = parse(s, i + 1, end as i64, damage);
        return if b > 0 { b } else { 0 };
    }
    if let Some(i) = (start..end).find(|&k| s[k] == b'&') {
        let a = parse(s, start, i as i64 - 1, damage);
        if a <= 0 {
            return 0;
        }
        let b = parse(s, i + 1, end as i64, damage);
        if b <= 0 {
            return 0;
        }
        return a.max(b);
    }
    let mut after_star = false;
    let mut has_mult = false;
    let mut has_number = false;
    let mut not = false;
    let mut negative = false;
    let mut comparison: i64 = -1;
    let mut number: i64 = 0;
    let mut mult: i64 = 0;
    let mut total: i64 = 0;
    macro_rules! flush {
        () => {{
            total += term(not, has_mult, negative, comparison, number, mult, damage);
            not = false;
            negative = false;
            after_star = false;
            has_mult = false;
            has_number = false;
            mult = 0;
            number = 0;
            comparison = -1;
        }};
    }
    for &c in &s[start..end] {
        if c.is_ascii_digit() {
            let d = (c - b'0') as i64;
            if after_star {
                mult = d;
                has_mult = true;
            } else {
                number = number * 10 + d;
                has_number = true;
            }
        } else {
            match c {
                b'*' => after_star = true,
                b'!' => {
                    if has_number {
                        flush!();
                    }
                    not = true;
                }
                b'-' => {
                    if has_number {
                        flush!();
                    }
                    negative = true;
                }
                b'=' | b'<' | b'>' => {
                    if has_number {
                        flush!();
                    }
                    comparison = match c {
                        b'=' => 0,
                        b'<' => 2,
                        _ => 1,
                    };
                }
                b'+' if has_number => flush!(),
                _ => {}
            }
        }
    }
    if has_number {
        total += term(not, has_mult, negative, comparison, number, mult, damage);
    }
    total
}

/// One effect from JS `getPotionEffects`: `{ id, duration, amplifier, particles }`.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct PotionEffect {
    pub id: i64,
    pub duration: i64,
    pub amplifier: i64,
    pub particles: bool,
}

fn effects_cache() -> &'static Mutex<HashMap<i64, Vec<PotionEffect>>> {
    static CACHE: std::sync::OnceLock<Mutex<HashMap<i64, Vec<PotionEffect>>>> = std::sync::OnceLock::new();
    CACHE.get_or_init(|| Mutex::new(HashMap::new()))
}

/// JS: `getPotionEffects(damage)` — `PotionHelper.getPotionEffects(damage,
/// false)`. Results are cached per damage value exactly like the JS `cache`.
pub fn get_potion_effects(damage: i64) -> Vec<PotionEffect> {
    if let Some(list) = effects_cache().lock().unwrap().get(&damage) {
        return list.clone();
    }
    let mut list = Vec::new();
    for id in 1..32i64 {
        let p = match potion(id) {
            Some(p) => p,
            None => continue,
        };
        let req = match requirement(id) {
            Some(r) => r,
            None => continue,
        };
        // JS parses the requirement against the DAMAGE BITS (the expressions
        // reference bit flags), not the decimal string. Upstream passes the
        // raw damage number into the string parser — reproduce that: the JS
        // string is damage.toString() only in that the parser receives the
        // expression string; the `damage` argument is numeric. The expression
        // string itself is parsed for flags/numbers.
        let level = parse(req.as_bytes(), 0, req.len() as i64, damage);
        if level <= 0 {
            continue;
        }
        let mut amp = 0i64;
        if let Some(as_expr) = amplifier_expr(id) {
            let a = parse(as_expr.as_bytes(), 0, as_expr.len() as i64, damage);
            amp = if a < 0 { 0 } else { a };
        }
        let duration;
        if p.instant {
            duration = 1;
        } else {
            let mut d = 1200 * (level * 3 + (level - 1) * 2);
            d >>= amp;
            d = (d as f64 * p.eff).round() as i64;
            duration = if damage & 0x4000 != 0 { (d as f64 * 0.75 + 0.5).round() as i64 } else { d };
        }
        list.push(PotionEffect { id, duration, amplifier: amp, particles: true });
    }
    effects_cache().lock().unwrap().insert(damage, list.clone());
    list
}

/// JS: `liquidColor(effects)` — `calcPotionLiquidColor`; every amplifier
/// level weighs the same, with f32 accumulation.
pub fn liquid_color(effects: &[PotionEffect]) -> i64 {
    if effects.is_empty() {
        return 3694022;
    }
    let mut r = 0.0f64;
    let mut g = 0.0f64;
    let mut b = 0.0f64;
    let mut n = 0.0f64;
    for e in effects {
        if !e.particles {
            continue;
        }
        let c = potion(e.id).map(|p| p.color).unwrap_or(0);
        for _k in 0..=e.amplifier {
            r = f32r(r + f32r((((c >> 16) & 255) / 255) as f64));
            g = f32r(g + f32r((((c >> 8) & 255) / 255) as f64));
            b = f32r(b + f32r(((c & 255) / 255) as f64));
            n = f32r(n + 1.0);
        }
    }
    if n == 0.0 {
        return 0;
    }
    let ch = |v: f64| f32r(f32r(v / n) * 255.0).trunc() as i64;
    (ch(r) << 16) | (ch(g) << 8) | ch(b)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn speed_potion_from_damage_8194() {
        // Vanilla: damage 8194 = speed II (bit 13 set, flag 1, amplifier expr "5")
        let effects = get_potion_effects(8194);
        assert!(effects.iter().any(|e| e.id == 1), "speed expected: {:?}", effects);
    }

    #[test]
    fn instant_heal_has_duration_one() {
        // heal (id 6): req "0 & !1 & 2 & !3" — damage with flags 0 and 2 set,
        // 1 and 3 clear → bit0 + bit2 = 0x5
        let effects = get_potion_effects(0x5);
        let heal = effects.iter().find(|e| e.id == 6);
        assert!(heal.is_some(), "{:?}", effects);
        assert_eq!(heal.unwrap().duration, 1);
    }

    #[test]
    fn no_effects_for_zero_damage() {
        assert!(get_potion_effects(0).is_empty());
    }

    #[test]
    fn liquid_color_empty_is_water_blue() {
        assert_eq!(liquid_color(&[]), 3694022);
    }
}
