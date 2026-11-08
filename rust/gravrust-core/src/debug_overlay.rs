//! Port of `client/js/gui/debug-overlay.js`.
//!
//! Calculates metrics for the F3 debug screen: packet tx/rx rates, local regional difficulty,
//! heightmap queries, and sound pool stats.

/// Calculates packet tx/rx rates per second based on counter deltas.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct PacketRateSample {
    pub last_sample_time_ms: f64,
    pub last_sent: u64,
    pub last_received: u64,
    pub tx_rate: u32,
    pub rx_rate: u32,
}

impl PacketRateSample {
    pub fn new(now_ms: f64, sent: u64, received: u64) -> Self {
        Self {
            last_sample_time_ms: now_ms,
            last_sent: sent,
            last_received: received,
            tx_rate: 0,
            rx_rate: 0,
        }
    }

    pub fn update(&mut self, now_ms: f64, sent: u64, received: u64) -> (u32, u32) {
        let elapsed = now_ms - self.last_sample_time_ms;
        if elapsed >= 1000.0 {
            self.tx_rate = ((sent.saturating_sub(self.last_sent) as f64 * 1000.0) / elapsed).round() as u32;
            self.rx_rate = ((received.saturating_sub(self.last_received) as f64 * 1000.0) / elapsed).round() as u32;
            self.last_sample_time_ms = now_ms;
            self.last_sent = sent;
            self.last_received = received;
        }
        (self.tx_rate, self.rx_rate)
    }
}

/// JS: `localDifficulty(difficulty, time, moonOverride)`
/// Native Minecraft 1.15.2 regional local difficulty calculation.
pub fn local_difficulty(difficulty: f32, time_ticks: i64, moon_override: Option<f32>) -> f32 {
    if difficulty <= 0.0 {
        return 0.0;
    }
    let moon_phases = [1.0f32, 0.75, 0.5, 0.25, 0.0, 0.25, 0.5, 0.75];
    let phase_idx = (((time_ticks / 24000) % 8 + 8) % 8) as usize;
    let moon = moon_override.unwrap_or(moon_phases[phase_idx]);

    let time_f = time_ticks as f32;
    let age = ((time_f - 72000.0) / 1440000.0).clamp(0.0, 1.0) * 0.25;
    let mut extra = (moon * 0.25).clamp(0.0, age);
    if (difficulty - 1.0).abs() < 1e-4 {
        extra *= 0.5;
    }
    difficulty * (0.75 + age + extra)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_packet_rates_update() {
        let mut sample = PacketRateSample::new(1000.0, 100, 200);
        let (tx, rx) = sample.update(2000.0, 150, 280);
        assert_eq!(tx, 50);
        assert_eq!(rx, 80);
    }

    #[test]
    fn test_local_difficulty() {
        let diff = local_difficulty(2.0, 24000 * 5, None);
        assert!(diff >= 1.5 && diff <= 3.0);
    }
}
