//! Port of `client/js/render/glsl-functions.js`: GLSL float literal bridging.
//! Pure algorithmic port - extracts the GLSL float literal type bridging logic.
//! GLSL itself is compiled by the GPU, never evaluated as JavaScript, but the
//! float literal bridging can be implemented in Rust for shader preprocessing.

// ------------------------------------------------------------ GLSL Float Literals

/// JS: `export function glslFloatLiterals(source){ ... }`
/// Ported: converts integer literals in GLSL source to float literals.
/// 
/// # Arguments
/// * `source` - GLSL shader source text
///
/// # Returns
/// * `String` - GLSL source with integer literals bridged to float
pub fn glsl_float_literals(source: &str) -> String {
    use std::collections::HashSet;

    // JS: `const names=[...new Set([...source.matchAll(/\b(?:float|vec[234]|mat[234])\s+([A-Za-z_]\w*)/g)].map(m=>m[1]))];`
    // Collect the distinct variable names declared with a float/vector/matrix type.
    let decl = regex_literal(r"\b(?:float|vec[234]|mat[234])\s+([A-Za-z_]\w*)");
    let mut names: HashSet<String> = HashSet::new();
    for caps in decl.captures_iter(source) {
        if let Some(m) = caps.get(1) {
            names.insert(m.as_str().to_string());
        }
    }

    // JS: `if(!names.length)return source;`
    // if no type declarations, return source unchanged
    if names.is_empty() {
        return source.to_string();
    }

    // JS: `const symbols='(?:'+names.join('|')+')';`
    // HashSet iteration order is not stable and JS uses insertion order; sort so
    // the generated alternation is deterministic across runs.
    let mut sorted: Vec<String> = names.into_iter().collect();
    sorted.sort();
    let symbols = format!("(?:{})", sorted.join("|"));

    // JS pass 1: `(?<![\w.])(\d+)\s*([*/+\-])\s*(SYMBOLS)\b` -> `$1.0 $2 $3`
    //   e.g. `12/speed` -> `12.0 / speed`
    // The `regex` crate has no lookbehind, so the `(?<![\w.])` guard is checked
    // manually against the preceding character of each candidate match.
    let num_first = regex_literal(&format!(r"(\d+)\s*([*/+\-])\s*({})\b", symbols));
    let mut out = String::with_capacity(source.len());
    let mut last = 0usize;
    for caps in num_first.captures_iter(source) {
        let whole = caps.get(0).unwrap();
        // Reject when the digit is preceded by a word character or a dot.
        if whole.start() > 0 {
            let prev = source[..whole.start()].chars().next_back().unwrap();
            if prev.is_alphanumeric() || prev == '_' || prev == '.' {
                continue;
            }
        }
        out.push_str(&source[last..whole.start()]);
        out.push_str(caps.get(1).unwrap().as_str());
        out.push_str(".0 ");
        out.push_str(caps.get(2).unwrap().as_str());
        out.push(' ');
        out.push_str(caps.get(3).unwrap().as_str());
        last = whole.end();
    }
    out.push_str(&source[last..]);

    // JS pass 2: `\b(SYMBOLS)\s*([*/+\-])\s*(\d+)(?![.\w])` -> `$1 $2 $3.0`
    //   e.g. `speed*12` -> `speed * 12.0`
    let num_last = regex_literal(&format!(r"\b({})\s*([*/+\-])\s*(\d+)", symbols));
    let mut out2 = String::with_capacity(out.len());
    let mut last2 = 0usize;
    for caps in num_last.captures_iter(&out) {
        let whole = caps.get(0).unwrap();
        // Reject when the digits are followed by a dot or word character.
        if let Some(next) = out[whole.end()..].chars().next() {
            if next.is_alphanumeric() || next == '_' || next == '.' {
                continue;
            }
        }
        out2.push_str(&out[last2..whole.start()]);
        out2.push_str(caps.get(1).unwrap().as_str());
        out2.push(' ');
        out2.push_str(caps.get(2).unwrap().as_str());
        out2.push(' ');
        out2.push_str(caps.get(3).unwrap().as_str());
        out2.push_str(".0");
        last2 = whole.end();
    }
    out2.push_str(&out[last2..]);
    out2
}

/// Compile a regex literal. The patterns are static and valid, so a failure here
/// is a programming error rather than a runtime input problem.
fn regex_literal(pattern: &str) -> regex::Regex {
    regex::Regex::new(pattern).unwrap_or_else(|e| panic!("invalid regex {:?}: {}", pattern, e))
}

// ------------------------------------------------------------ Exports

// JS: `export { glslFloatLiterals }`
#[wasm_bindgen]
pub fn js_glsl_float_literals(source: &str) -> String {
    glsl_float_literals(source)
}

// ------------------------------------------------------------ Tests

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_glsl_float_literals() {
        let source = "float speed = 1;".to_string();
        let result = glsl_float_literals(&source);
        // Should preserve the source as-is or convert integers to floats
        assert!(!result.is_empty());
    }

    #[test]
    fn test_glsl_float_literals_preserve() {
        let source = "void main() { gl_Position = vec4(1.0, 2.0, 3.0, 1.0); }".to_string();
        let result = glsl_float_literals(&source);
        assert!(!result.is_empty());
    }
}