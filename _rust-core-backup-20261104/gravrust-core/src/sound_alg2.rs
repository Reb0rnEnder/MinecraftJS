//! Sound algorithm layer - weighted random pick, LCG for cave moods

use rand::Rng;

#[derive(Clone)]
pub struct SoundEvent {
    pub name: String,
    pub weight: f64,
}

pub fn pick_sound(events: &[SoundEvent]) -> &SoundEvent {
    let total: f64 = events.iter().map(|e| e.weight).sum();
    let mut rng = rand::thread_rng();
    let mut accum = 0.0;
    let target = rng.gen::<f64>() * events.iter().map(|e| e.weight).sum::<f64>();
    
    for event in events {
        accum += event.weight;
        if accum >= target {
            return event;
        }
    }
    &events[0]
}

// Cave mood LCG
pub fn mood_lcg_next(state: u64) -> u64 {
    state.wrapping_mul(1103515245).wrapping_add(12345)
}
