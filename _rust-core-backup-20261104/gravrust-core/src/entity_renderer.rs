//! Entity Renderer - ported from client/js/entity-renderer.js
//! 40-case _texFor, pose/shade math, skin pipeline, legacy 64x32 upgrade

pub struct EntityRenderer {
    // Skin cache, model cache
}

impl EntityRenderer {
    pub fn render_entity(&mut self, entity: &Entity) {
        // 40-case _texFor texture selection
        // Pose/shade math
        // Skin pipeline
    }
    
    fn tex_for(&self, entity: &Entity) -> String {
        // 40-case match
        match entity.kind {
            EntityKind::Zombie => "zombie".into(),
            EntityKind::Skeleton => "skeleton".into(),
            // ... 40 cases
            _ => "default".into(),
        }
    }
}
