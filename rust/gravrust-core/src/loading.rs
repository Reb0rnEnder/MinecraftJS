//! Port of `client/js/gui/screens/loading.js`.
//!
//! Native reload overlay: 0.5s fade-in, smoothed progress, then two-stage 2s fade-out.

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct LoadingOverlayAlphas {
    pub fade_in: f64,
    pub out: f64,
    pub background_alpha: f64,
    pub logo_alpha: f64,
    pub bar_alpha: f64,
    pub is_finished: bool,
}

/// Computes fade-in, fade-out, and component alphas for the resource loading screen.
pub fn compute_loading_alphas(
    now_ms: f64,
    started_at_ms: f64,
    completed_at_ms: Option<f64>,
    startup: bool,
) -> LoadingOverlayAlphas {
    let fade_in = if startup {
        1.0
    } else {
        (1.0f64).min((now_ms - started_at_ms) / 500.0)
    };

    let out = match completed_at_ms {
        None => -1.0,
        Some(comp) => (now_ms - comp) / 1000.0,
    };

    let alpha = if out >= 1.0 { (2.0 - out).max(0.0) } else { 1.0 };

    let background_alpha = if out >= 1.0 {
        alpha
    } else {
        fade_in.max(0.15)
    };

    let logo_alpha = if out >= 1.0 {
        alpha
    } else {
        fade_in
    };

    let bar_alpha = if out < 0.0 {
        1.0
    } else {
        (1.0 - out).max(0.0)
    };

    let is_finished = out >= 2.0;

    LoadingOverlayAlphas {
        fade_in,
        out,
        background_alpha,
        logo_alpha,
        bar_alpha,
        is_finished,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_loading_fade_in() {
        let alphas = compute_loading_alphas(250.0, 0.0, None, false);
        assert!((alphas.fade_in - 0.5).abs() < 1e-6);
        assert_eq!(alphas.bar_alpha, 1.0);
        assert!(!alphas.is_finished);
    }

    #[test]
    fn test_loading_completed_fade_out() {
        let alphas = compute_loading_alphas(1500.0, 0.0, Some(0.0), false);
        assert!((alphas.out - 1.5).abs() < 1e-6);
        assert!((alphas.logo_alpha - 0.5).abs() < 1e-6);
        assert_eq!(alphas.bar_alpha, 0.0);
        assert!(!alphas.is_finished);
    }
}
